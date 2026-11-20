// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { getAISettings, saveAISettings } from '../services/aiProviderService';
import { exportAllTables, importTables } from '../db/backup';
import { setSubHabitState } from '../engine/subHabitEngine';
import { addDoItem, deleteDoItem, setTaskCompleted, toggleDoItem } from '../dolist/doService';
import type { Habit, Task } from '../db/schema';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('AI settings: independent profiles', () => {
  it('saving the cloud profile never overwrites the local one (and survives a re-read)', async () => {
    await saveAISettings({ mode: 'local', profiles: { local: { model: 'qwen2.5:3b', endpoint: 'http://localhost:11434/v1/chat/completions', apiKey: '' } } });
    await saveAISettings({ mode: 'cloud', profiles: { cloud: { model: 'gpt-4o', endpoint: 'https://api.openai.com/v1', apiKey: 'sk-cloud-1' } } });

    let s = await getAISettings();
    expect(s.mode).toBe('cloud');
    expect(s.model).toBe('gpt-4o');          // mirrors the ACTIVE profile for older readers
    expect(s.apiKey).toBe('sk-cloud-1');
    expect(s.profiles!.local.model).toBe('qwen2.5:3b'); // untouched

    // Switching back to local must NOT reset the cloud profile
    await saveAISettings({ mode: 'local' });
    s = await getAISettings();
    expect(s.mode).toBe('local');
    expect(s.model).toBe('qwen2.5:3b');
    expect(s.profiles!.cloud).toMatchObject({ model: 'gpt-4o', apiKey: 'sk-cloud-1' });
  });

  it('serialises concurrent saves so none are lost', async () => {
    await Promise.all([
      saveAISettings({ profiles: { cloud: { apiKey: 'k1' } } }),
      saveAISettings({ profiles: { cloud: { model: 'm2' } } }),
      saveAISettings({ temperature: 1.1 }),
    ]);
    const s = await getAISettings();
    expect(s.profiles!.cloud).toMatchObject({ apiKey: 'k1', model: 'm2' });
    expect(s.temperature).toBe(1.1);
  });
});

describe('backup', () => {
  it('round-trips every table including do-items + finance + notes, and strips legacy task start dates', async () => {
    const now = new Date().toISOString();
    await db.notes.add({ id: 'n1', title: 'N', content: 'c', createdAt: now, updatedAt: now });
    await db.doItems.add({ id: 'd1', taskId: 'tk', title: 'Step', completed: false, order: 0, createdAt: now, updatedAt: now });
    await db.financeAccounts.add({ id: 'a1', name: 'Bank', type: 'bank', balance: 1, currency: 'INR', createdAt: now });
    const dump = JSON.parse(JSON.stringify(await exportAllTables()));
    expect(dump.notes).toHaveLength(1);
    expect(dump.doItems).toHaveLength(1);
    expect(dump.financeAccounts).toHaveLength(1);

    await Promise.all(db.tables.map((t) => t.clear()));
    dump.tasks = [{ id: 't', title: 'Old', status: 'todo', priority: 'low', startDate: '2026-01-01', startTime: '08:00', createdAt: now, updatedAt: now }];
    await importTables(dump);
    expect(await db.notes.count()).toBe(1);
    expect(await db.doItems.count()).toBe(1);
    const t = (await db.tasks.get('t')) as any;
    expect(t.startDate).toBeUndefined();
  });
});

describe('sub-habits', () => {
  const habit: Habit = {
    id: 'h1', name: 'Study', category: 'Learning & Growth', color: '#000', archived: 0, createdAt: 'x',
    subHabits: [
      { id: 's1', title: 'Handshake', topic: 'Networking', completed: false },
      { id: 's2', title: 'Subnetting', topic: 'Networking', completed: false },
    ],
  };

  it('completes the parent habit only when every sub-habit is done, and reverts when one is undone', async () => {
    await db.habits.add(habit);
    await setSubHabitState(habit, 's1', 'completed', '2026-10-07');
    let log = await db.habitLogs.where('[habitId+date]').equals(['h1', '2026-10-07']).first();
    expect(log).toMatchObject({ status: 'partial', value: 0.5 });

    await setSubHabitState(habit, 's2', 'completed', '2026-10-07');
    log = await db.habitLogs.where('[habitId+date]').equals(['h1', '2026-10-07']).first();
    expect(log).toMatchObject({ status: 'completed', value: 1 });

    await setSubHabitState(habit, 's2', 'completed', '2026-10-07'); // toggle off
    log = await db.habitLogs.where('[habitId+date]').equals(['h1', '2026-10-07']).first();
    expect(log!.status).toBe('partial');
    expect(await db.habitLogs.count()).toBe(1); // one log per habit/day, never duplicates
  });
});

describe('Do-List', () => {
  const task: Task = { id: 'tk', title: 'Ship', status: 'todo', priority: 'low', createdAt: 'x', updatedAt: 'x' };

  it('completes the task when all steps are done and re-opens it when one is unchecked', async () => {
    await db.tasks.add(task);
    const a = (await addDoItem('tk', { title: 'A', scheduledDate: '2026-10-08' }))!;
    const b = (await addDoItem('tk', { title: 'B' }))!;

    await toggleDoItem(a);
    expect((await db.tasks.get('tk'))!.status).toBe('todo');
    await toggleDoItem(b);
    expect((await db.tasks.get('tk'))!.status).toBe('completed');
    await toggleDoItem((await db.doItems.get(a.id))!);
    expect((await db.tasks.get('tk'))!.status).toBe('in_progress');
  });

  it('adding a step to a completed task re-opens it; deleting the last open step completes it', async () => {
    await db.tasks.add({ ...task, status: 'completed', completedAt: 'x' });
    const done = (await addDoItem('tk', { title: 'Done already' }))!;
    await toggleDoItem(done); // task completed again
    expect((await db.tasks.get('tk'))!.status).toBe('completed');
    const extra = (await addDoItem('tk', { title: 'New work' }))!;
    expect((await db.tasks.get('tk'))!.status).toBe('in_progress');
    await deleteDoItem(extra);
    expect((await db.tasks.get('tk'))!.status).toBe('completed');
  });

  it('completing a task checks all its steps; a time is never kept without a date', async () => {
    await db.tasks.add(task);
    await addDoItem('tk', { title: 'A' });
    const timed = (await addDoItem('tk', { title: 'B', scheduledTime: '09:00' }))!;
    expect(timed.scheduledTime).toBeUndefined();
    await setTaskCompleted('tk', true);
    expect((await db.doItems.where('taskId').equals('tk').toArray()).every((i) => i.completed)).toBe(true);
  });
});

describe('importing a backup made by an older version', () => {
  it('converts subtasks, to-do items, wishlist and plain-text notes into the new model', async () => {
    const stamp = '2026-10-01T00:00:00.000Z';
    await importTables({
      version: 2,
      tasks: [{ id: 't', title: 'Old', status: 'todo', priority: 'low', startDate: '2026-10-01', createdAt: stamp, updatedAt: stamp }],
      subtasks: [{ id: 's', taskId: 't', title: 'Sub', completed: true, order: 0 }],
      todoLists: [{ id: 'l', taskId: 't', title: 'L', order: 0 }],
      todoItems: [{ id: 'ti', listId: 'l', taskId: 't', title: 'Todo', completed: false, order: 0, scheduledDate: '2026-10-09', createdAt: stamp, updatedAt: stamp }],
      notes: [{ id: 'n', title: 'N', content: 'plain', createdAt: stamp, updatedAt: stamp }],
      wishlistItems: [{ id: 'w', title: 'Wish', category: 'purchase', priority: 'low', status: 'saved', createdAt: stamp, updatedAt: stamp }],
      topics: [{ id: 'x' }],
    });
    expect(((await db.tasks.get('t')) as any).startDate).toBeUndefined();
    expect((await db.doItems.where('taskId').equals('t').sortBy('order')).map((i) => i.title)).toEqual(['Sub', 'Todo']);
    expect((await db.notes.get('n'))!.content).toBe('<p>plain</p>');
    expect((await db.notes.get('w'))!.kind).toBe('wishlist');
  });
});
