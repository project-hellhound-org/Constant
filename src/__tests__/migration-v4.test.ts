// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { V4_STORES } from './helpers/legacySchemas';

describe('Dexie v4 -> v6 upgrade (users who never installed v5)', () => {
  it('folds subtasks into Do-List items, drops startDate, converts notes/wishlist, splits AI profiles', async () => {
    const old = new Dexie('HabitOSDB');
    old.version(4).stores(V4_STORES);
    await old.open();
    await old.table('tasks').bulkAdd([
      { id: 't1', title: 'Write report', status: 'todo', priority: 'high', startDate: '2026-10-01', startTime: '09:30', dueDate: '2026-10-10', createdAt: 'x', updatedAt: 'x' },
      { id: 't2', title: 'Done thing', status: 'completed', completedAt: '2026-10-02T10:00:00.000Z', priority: 'low', startDate: '2026-10-02', createdAt: 'x', updatedAt: 'x' },
    ]);
    await old.table('subtasks').bulkAdd([
      { id: 's1', taskId: 't1', title: 'Outline', completed: true, order: 0 },
      { id: 's2', taskId: 't1', title: 'Draft', completed: false, order: 1 },
      { id: 's3', taskId: 't2', title: 'Ship', completed: true, order: 0 },
    ]);
    await old.table('notes').add({ id: 'n1', title: 'Plan', content: 'Line one\n\nA <b>tag</b> & more', category: 'General', tags: ['Study'], createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z', pinned: true });
    await old.table('wishlistItems').add({ id: 'w1', title: 'Laptop', description: 'For labs', category: 'purchase', estimatedCost: 80000, url: 'https://example.com/x', priority: 'high', status: 'in_progress', tags: ['gear'], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z' });
    await old.table('aiSettings').add({ id: 'default', mode: 'cloud', provider: 'cloud', model: 'deepseek-chat', apiKey: 'sk-secret-1234', endpoint: 'https://api.deepseek.com/v1', temperature: 0.4, privacy: {}, enableStreaming: true });
    old.close();

    const { db } = await import('../db/schema');
    await db.open();

    // Tasks lost startDate/startTime but kept everything else
    const t1 = (await db.tasks.get('t1')) as any;
    expect('startDate' in t1).toBe(false);
    expect('startTime' in t1).toBe(false);
    expect(t1.dueDate).toBe('2026-10-10');
    expect(db.tasks.schema.idxByName['startDate']).toBeUndefined();

    // Do-List: subtasks kept (with state), the old start date became a scheduled step, order is contiguous
    const t1Items = (await db.doItems.where('taskId').equals('t1').sortBy('order'));
    // (v4 passes through the v5 step first, which turns each old start date into a scheduled step)
    expect(t1Items.map((i) => [i.title, i.completed])).toEqual([['Outline', true], ['Draft', false], ['Write report', false]]);
    expect(t1Items.map((i) => i.order)).toEqual([0, 1, 2]);
    expect(t1Items[2]).toMatchObject({ scheduledDate: '2026-10-01', scheduledTime: '09:30' });
    const t2Items = await db.doItems.where('taskId').equals('t2').sortBy('order');
    expect(t2Items.map((i) => [i.title, i.completed])).toEqual([['Ship', true], ['Done thing', true]]);

    // Notes: plain text -> safe HTML paragraphs, flags preserved
    const n1 = (await db.notes.get('n1'))!;
    expect(n1.format).toBe('html');
    expect(n1.kind).toBe('note');
    expect(n1.content).toBe('<p>Line one</p><p>A &lt;b&gt;tag&lt;/b&gt; &amp; more</p>');
    expect(n1.pinned).toBe(true);
    expect(n1.tags).toEqual(['Study']);

    // Wishlist -> note of kind wishlist with its metadata
    const w1 = (await db.notes.get('w1'))!;
    expect(w1.kind).toBe('wishlist');
    expect(w1.wishlist).toMatchObject({ status: 'in_progress', priority: 'high', estimatedCost: 80000, url: 'https://example.com/x' });
    expect(w1.content).toContain('For labs');
    expect(w1.content).toContain('href="https://example.com/x"');

    // Old tables are gone
    for (const gone of ['subtasks', 'wishlistItems', 'todoItems', 'topics']) expect(db.tables.some((t) => t.name === gone)).toBe(false);

    // AI profiles
    const ai = (await db.aiSettings.get('default'))!;
    expect(ai.profiles!.cloud).toMatchObject({ model: 'deepseek-chat', apiKey: 'sk-secret-1234' });
    expect(ai.profiles!.local.model).toBe('llama3.1');
  });
});
