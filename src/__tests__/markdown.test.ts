// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMarkdownToHtml } from '../lib/markdown';

describe('renderMarkdownToHtml', () => {
  it('renders common AI response formatting as HTML', () => {
    const html = renderMarkdownToHtml('## Summary\n\n- **Habits**: 4/5\n- `streak`: 14\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<h2');
    expect(html).toContain('<strong>Habits</strong>');
    expect(html).toContain('<li>');
    expect(html).toContain('<code>streak</code>');
    expect(html).toContain('<table>');
  });

  it('strips scripts, event handlers and javascript: URLs', () => {
    const html = renderMarkdownToHtml(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n\n[click](javascript:alert(3))\n\n<iframe src="https://evil"></iframe>'
    );
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toMatch(/<iframe/i);
    expect(html).toContain('click'); // link text survives, only the dangerous href is dropped
  });

  it('forces safe link attributes', () => {
    const html = renderMarkdownToHtml('[docs](https://example.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('noopener');
  });

  it('is safe on partial streamed markdown', () => {
    expect(() => renderMarkdownToHtml('```ts\nconst x =')).not.toThrow();
    expect(renderMarkdownToHtml('')).toBe('');
  });
});
