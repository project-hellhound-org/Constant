// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { V5_STORES } from './helpers/legacySchemas';

describe('Dexie v5 -> v6 upgrade (users on the previous release)', () => {
  it('merges to-do lists+subtasks into one ordered Do-List, wishlist/checklists into notes, drops topics/links', async () => {
    const old = new Dexie('HabitOSDB');
    old.version(5).stores(V5_STORES);
    await old.open();
    const stamp = '2026-10-05T00:00:00.000Z';
    await old.table('tasks').add({ id: 't1', title: 'Ship', status: 'todo', priority: 'low', createdAt: stamp, updatedAt: stamp });
    await old.table('subtasks').add({ id: 's1', taskId: 't1', title: 'Old subtask', completed: false, order: 0 });
    await old.table('todoLists').bulkAdd([
      { id: 'L2', taskId: 't1', title: 'Later', order: 1, createdAt: stamp, updatedAt: stamp },
      { id: 'L1', taskId: 't1', title: 'First', order: 0, createdAt: stamp, updatedAt: stamp },
    ]);
    await old.table('todoItems').bulkAdd([
      { id: 'i-late', listId: 'L2', taskId: 't1', title: 'Late step', completed: false, order: 0, createdAt: stamp, updatedAt: stamp },
      { id: 'i-first', listId: 'L1', taskId: 't1', title: 'First step', completed: true, completedAt: stamp, scheduledDate: '2026-10-12', scheduledTime: '09:00', order: 0, createdAt: stamp, updatedAt: stamp },
    ]);
    await old.table('topics').add({ id: 'tp', name: 'Networking', parentId: null, order: 0, createdAt: stamp, updatedAt: stamp });
    await old.table('entityLinks').add({ id: 'lk', fromType: 'topic', fromId: 'tp', toType: 'habit', toId: 'h', createdAt: stamp });
    await old.table('notes').add({ id: 'n1', title: 'Topic note', content: 'hello', topicId: 'tp', createdAt: stamp, updatedAt: stamp });
    await old.table('wishlistItems').add({ id: 'w1', title: 'Phone', category: 'purchase', priority: 'low', status: 'saved', createdAt: stamp, updatedAt: stamp });
    await old.table('checklists').bulkAdd([
      { id: 'c-owned', title: 'Buy steps', ownerType: 'wishlist', ownerId: 'w1', createdAt: stamp, updatedAt: stamp },
      { id: 'c-free', title: 'Packing', ownerType: 'general', createdAt: stamp, updatedAt: stamp },
    ]);
    await old.table('checklistItems').bulkAdd([
      { id: 'ci1', checklistId: 'c-owned', text: 'Compare prices', checked: true, order: 0 },
      { id: 'ci2', checklistId: 'c-owned', text: 'Check warranty <now>', checked: false, order: 1 },
      { id: 'ci3', checklistId: 'c-free', text: 'Passport', checked: false, order: 0 },
    ]);
    old.close();

    const { db } = await import('../db/schema');
    await db.open();

    // One flat Do-List per task: subtasks first, then list items in list order; nothing lost, order contiguous
    const items = await db.doItems.where('taskId').equals('t1').sortBy('order');
    expect(items.map((i) => i.title)).toEqual(['Old subtask', 'First step', 'Late step']);
    expect(items.map((i) => i.order)).toEqual([0, 1, 2]);
    expect(items[1]).toMatchObject({ completed: true, scheduledDate: '2026-10-12', scheduledTime: '09:00' });

    // Notes lost their topic; text converted to HTML
    const n1 = (await db.notes.get('n1')) as any;
    expect('topicId' in n1).toBe(false);
    expect(n1.content).toBe('<p>hello</p>');

    // Checklist attached to a wishlist item is embedded in that note (escaped, with check state)…
    const w1 = (await db.notes.get('w1'))!;
    expect(w1.kind).toBe('wishlist');
    expect(w1.content).toContain('<h3>Buy steps</h3>');
    expect(w1.content).toContain('data-checked="true"><p>Compare prices</p>');
    expect(w1.content).toContain('Check warranty &lt;now&gt;');
    // …and a standalone checklist became its own note
    const free = (await db.notes.get('c-free'))!;
    expect(free.content).toContain('data-type="taskList"');
    expect(free.content).toContain('Passport');

    for (const gone of ['topics', 'entityLinks', 'todoLists', 'todoItems', 'checklists', 'checklistItems', 'subtasks', 'wishlistItems']) {
      expect(db.tables.some((t) => t.name === gone)).toBe(false);
    }
  });
});
