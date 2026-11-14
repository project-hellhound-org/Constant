/** Small, dependency-free HTML helpers used by data migrations (no DOM required). */

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text -> HTML paragraphs. Blank lines separate paragraphs; single newlines become <br>. */
export function textToHtml(text: string): string {
  const trimmed = (text ?? '').replace(/\r\n/g, '\n').trim();
  if (!trimmed) return '<p></p>';
  return trimmed
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** TipTap-compatible task list markup. */
export function checklistToHtml(items: Array<{ text: string; checked: boolean }>): string {
  if (items.length === 0) return '';
  const lis = items
    .map((i) => `<li data-type="taskItem" data-checked="${i.checked ? 'true' : 'false'}"><p>${escapeHtml(i.text)}</p></li>`)
    .join('');
  return `<ul data-type="taskList">${lis}</ul>`;
}
