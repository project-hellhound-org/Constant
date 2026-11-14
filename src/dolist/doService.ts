import { db, DoItem } from '../db/schema';

const uid = () => `do-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export interface DoProgress {
  total: number;
  done: number;
  pct: number;
}

export function summarizeDoItems(items: Pick<DoItem, 'completed'>[]): DoProgress {
  const done = items.filter((i) => i.completed).length;
  return { total: items.length, done, pct: items.length === 0 ? 0 : Math.round((done / items.length) * 100) };
}

/** Items scheduled for `dateStr`, ordered by time (untimed last), then manual order. */
export function itemsForDate(items: DoItem[], dateStr: string): DoItem[] {
  return items
    .filter((i) => i.scheduledDate === dateStr)
    .sort((a, b) => (a.scheduledTime ?? '99:99').localeCompare(b.scheduledTime ?? '99:99') || a.order - b.order);
}

export interface NewDoItem {
  title: string;
  scheduledDate?: string;
  scheduledTime?: string;
  durationMinutes?: number;
  notes?: string;
}

/**
 * Keep the parent task consistent with its Do-List:
 *  - every item done            -> task completed
 *  - task completed, item open  -> task re-opened (in_progress if something is done, else planned)
 * A task with no items is never auto-changed, and neither is one whose `autoComplete` is turned off.
 */
export async function syncTaskStatus(taskId: string): Promise<void> {
  const [task, items] = await Promise.all([db.tasks.get(taskId), db.doItems.where('taskId').equals(taskId).toArray()]);
  if (!task || items.length === 0 || task.status === 'cancelled' || task.autoComplete === false) return;
  const now = new Date().toISOString();
  const allDone = items.every((i) => i.completed);
  if (allDone && task.status !== 'completed') {
    await db.tasks.update(taskId, { status: 'completed', completedAt: now, updatedAt: now });
  } else if (!allDone && task.status === 'completed') {
    await db.tasks.update(taskId, { status: items.some((i) => i.completed) ? 'in_progress' : 'planned', completedAt: null, updatedAt: now });
  }
}

export async function addDoItem(taskId: string, input: NewDoItem): Promise<DoItem | null> {
  const title = input.title.trim();
  if (!title) return null;
  const now = new Date().toISOString();
  const order = await db.doItems.where('taskId').equals(taskId).count();
  const item: DoItem = {
    id: uid(),
    taskId,
    title,
    completed: false,
    completedAt: null,
    scheduledDate: input.scheduledDate || undefined,
    scheduledTime: input.scheduledDate ? input.scheduledTime || undefined : undefined, // a time without a date is meaningless
    durationMinutes: input.durationMinutes,
    notes: input.notes,
    order,
    createdAt: now,
    updatedAt: now,
  };
  await db.doItems.add(item);
  await syncTaskStatus(taskId);
  return item;
}

export async function toggleDoItem(item: DoItem): Promise<void> {
  const now = new Date().toISOString();
  const completed = !item.completed;
  await db.doItems.update(item.id, { completed, completedAt: completed ? now : null, updatedAt: now });
  await syncTaskStatus(item.taskId);
}

export async function scheduleDoItem(item: DoItem, scheduledDate?: string, scheduledTime?: string): Promise<void> {
  await db.doItems.update(item.id, {
    scheduledDate: scheduledDate || undefined,
    scheduledTime: scheduledDate ? scheduledTime || undefined : undefined,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteDoItem(item: DoItem): Promise<void> {
  await db.doItems.delete(item.id);
  await syncTaskStatus(item.taskId);
}

/** Mark the task (and every item in its Do-List) complete, or re-open the task. */
export async function setTaskCompleted(taskId: string, completed: boolean): Promise<void> {
  const now = new Date().toISOString();
  await db.tasks.update(taskId, {
    status: completed ? 'completed' : 'planned',
    completedAt: completed ? now : null,
    updatedAt: now,
  });
  if (completed) {
    await db.doItems.where('taskId').equals(taskId).modify((i) => {
      if (!i.completed) {
        i.completed = true;
        i.completedAt = now;
        i.updatedAt = now;
      }
    });
  }
}

export async function deleteTaskWithItems(taskId: string): Promise<void> {
  await db.transaction('rw', db.tasks, db.doItems, async () => {
    await db.doItems.where('taskId').equals(taskId).delete();
    await db.tasks.delete(taskId);
  });
}
