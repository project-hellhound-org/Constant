import { checklistToHtml, escapeHtml, textToHtml } from '../lib/html';
import type { DoItem, NoteItem } from './schema';

/**
 * Rows as they existed before the Do-List / Notepad consolidation.
 * Used by BOTH the Dexie v6 upgrade and by backup import, so old backups restore correctly.
 */
export interface LegacyInput {
  tasks?: any[];
  subtasks?: any[];
  todoLists?: any[];
  todoItems?: any[];
  notes?: any[];
  wishlistItems?: any[];
  checklists?: any[];
  checklistItems?: any[];
}

export interface LegacyOutput {
  /** null = nothing legacy to convert (leave the table alone). */
  doItems: DoItem[] | null;
  notes: NoteItem[] | null;
}

const byOrder = (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0);

/**
 * Pure conversion:
 *  - subtasks + to-do list items  -> one flat Do-List per task (`DoItem`)
 *  - plain-text notes             -> rich-text (HTML) notes
 *  - wishlist items               -> notes with kind "wishlist"
 *  - checklists                   -> task-list content (appended to their wishlist note, else a standalone note)
 *  Topics and entity links are intentionally dropped (the feature was removed).
 */
export function convertLegacy(input: LegacyInput, now: string = new Date().toISOString()): LegacyOutput {
  const tasks = input.tasks ?? [];
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const hasDoSource = (input.subtasks?.length ?? 0) > 0 || (input.todoItems?.length ?? 0) > 0;

  let doItems: DoItem[] | null = null;
  if (hasDoSource) {
    doItems = [];
    const counters = new Map<string, number>();
    const next = (taskId: string) => {
      const n = counters.get(taskId) ?? 0;
      counters.set(taskId, n + 1);
      return n;
    };

    for (const s of [...(input.subtasks ?? [])].sort(byOrder)) {
      const parent = taskById.get(s.taskId);
      doItems.push({
        id: s.id,
        taskId: s.taskId,
        title: s.title,
        completed: !!s.completed,
        completedAt: s.completed ? parent?.completedAt || now : null,
        order: next(s.taskId),
        createdAt: parent?.createdAt || now,
        updatedAt: now,
      });
    }

    const listOrder = new Map((input.todoLists ?? []).map((l) => [l.id, l.order ?? 0]));
    const todos = [...(input.todoItems ?? [])].sort(
      (a, b) => (listOrder.get(a.listId) ?? 0) - (listOrder.get(b.listId) ?? 0) || byOrder(a, b)
    );
    for (const t of todos) {
      doItems.push({
        id: t.id,
        taskId: t.taskId,
        title: t.title,
        completed: !!t.completed,
        completedAt: t.completedAt ?? null,
        scheduledDate: t.scheduledDate,
        scheduledTime: t.scheduledTime,
        durationMinutes: t.durationMinutes,
        notes: t.notes,
        order: next(t.taskId),
        createdAt: t.createdAt || now,
        updatedAt: t.updatedAt || now,
      });
    }
  }

  const hasNoteSource =
    (input.notes?.length ?? 0) > 0 || (input.wishlistItems?.length ?? 0) > 0 || (input.checklists?.length ?? 0) > 0;
  let notes: NoteItem[] | null = null;

  if (hasNoteSource) {
    // 1. Existing notes: plain text -> HTML (skip rows already converted)
    const out: NoteItem[] = (input.notes ?? []).map((n) => {
      const { topicId: _drop, ...rest } = n;
      if (rest.format === 'html') return rest as NoteItem;
      return { ...rest, kind: rest.kind ?? 'note', format: 'html', content: textToHtml(rest.content ?? '') } as NoteItem;
    });
    const byId = new Map(out.map((n) => [n.id, n]));

    // 2. Wishlist items -> notes
    for (const w of input.wishlistItems ?? []) {
      if (byId.has(w.id)) continue;
      const urlHtml = w.url ? `<p><a href="${escapeHtml(w.url)}">${escapeHtml(w.url)}</a></p>` : '';
      const note: NoteItem = {
        id: w.id,
        title: w.title,
        content: `${w.description ? textToHtml(w.description) : '<p></p>'}${urlHtml}`,
        format: 'html',
        kind: 'wishlist',
        category: w.category,
        tags: w.tags ?? [],
        pinned: false,
        wishlist: { status: w.status ?? 'saved', priority: w.priority ?? 'medium', estimatedCost: w.estimatedCost, url: w.url },
        createdAt: w.createdAt || now,
        updatedAt: w.updatedAt || now,
      };
      out.push(note);
      byId.set(note.id, note);
    }

    // 3. Checklists -> task lists inside the owning wishlist note, otherwise standalone notes
    const itemsByList = new Map<string, any[]>();
    for (const i of input.checklistItems ?? []) itemsByList.set(i.checklistId, [...(itemsByList.get(i.checklistId) ?? []), i]);
    for (const c of input.checklists ?? []) {
      const list = checklistToHtml((itemsByList.get(c.id) ?? []).sort(byOrder).map((i) => ({ text: i.text, checked: !!i.checked })));
      const owner = c.ownerType === 'wishlist' && c.ownerId ? byId.get(c.ownerId) : undefined;
      if (owner) {
        owner.content += `<h3>${escapeHtml(c.title)}</h3>${list}`;
      } else {
        out.push({
          id: c.id,
          title: c.title,
          content: list || '<p></p>',
          format: 'html',
          kind: 'note',
          tags: ['checklist'],
          pinned: false,
          createdAt: c.createdAt || now,
          updatedAt: c.updatedAt || now,
        });
      }
    }
    notes = out;
  }

  return { doItems, notes };
}
