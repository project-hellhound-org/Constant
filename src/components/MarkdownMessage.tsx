import React, { useMemo } from 'react';
import { renderMarkdownToHtml } from '../lib/markdown';

interface MarkdownMessageProps {
  text: string;
  className?: string;
}

/** Renders assistant Markdown (headings, lists, tables, code, quotes) as sanitized HTML. */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = React.memo(({ text, className }) => {
  const html = useMemo(() => renderMarkdownToHtml(text), [text]);
  return <div className={`md-content ${className ?? ''}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />;
});
MarkdownMessage.displayName = 'MarkdownMessage';
