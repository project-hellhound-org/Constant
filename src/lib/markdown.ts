import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.use({ gfm: true, breaks: true });

let hooked = false;
function ensureHooks() {
  if (hooked) return;
  hooked = true;
  // Links in AI output must never navigate the app shell (matters in Electron).
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

/**
 * Markdown -> sanitized HTML string.
 * Model output is untrusted: it is parsed by `marked` and then sanitized by DOMPurify
 * before it ever reaches `innerHTML`.
 */
export function renderMarkdownToHtml(markdown: string): string {
  ensureHooks();
  const rawHtml = marked.parse(markdown ?? '', { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'button', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style', 'srcset'],
  });
}
