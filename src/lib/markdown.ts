/**
 * Turns the simple formatting used in Admin → Pages into safe HTML.
 *
 *   ## Heading          ### Smaller heading
 *   **bold**   *italic*   [link text](/products)
 *   - bullet list       1. numbered list       > quote
 *   A blank line starts a new paragraph; a single line break stays a line break.
 *   A line with only [Button text](/link) becomes a button.
 *
 * Everything is escaped first, so HTML or scripts typed into a page are shown as plain text.
 * Links may only point to this site (/…), https://, mailto: or tel:.
 */
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const safeHref = (href: string) => {
  const url = href.trim();
  if (/^\/(?!\/)/.test(url) || /^https:\/\/[^\s"<>]+$/i.test(url) || /^mailto:[^\s"<>]+$/i.test(url) || /^tel:[+\d\s()-]+$/i.test(url)) return url;
  return '';
};

/** Bold, italic and links inside one line (text is already escaped). */
function inline(text: string) {
  return text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
      const safe = safeHref(href.replace(/&amp;/g, '&'));
      if (!safe) return label;
      const external = /^https:/i.test(safe);
      return `<a href="${escapeHtml(safe)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

export function renderMarkdown(source: string): string {
  const lines = escapeHtml(String(source || '').replace(/\r\n?/g, '\n')).split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    if (paragraph.length) { out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = []; }
    if (list) { out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`); list = null; }
    if (quote.length) { out.push(`<blockquote><p>${quote.map(inline).join('<br>')}</p></blockquote>`); quote = []; }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{2,4})\s+(.+)$/))) { flush(); const level = Math.min(4, m[1].length); out.push(`<h${level}>${inline(m[2].trim())}</h${level}>`); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.+)$/))) { if (paragraph.length || quote.length || list?.type === 'ol') flush(); list ??= { type: 'ul', items: [] }; list.items.push(m[1]); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.+)$/))) { if (paragraph.length || quote.length || list?.type === 'ul') flush(); list ??= { type: 'ol', items: [] }; list.items.push(m[1]); continue; }
    if ((m = line.match(/^&gt;\s?(.*)$/))) { if (paragraph.length || list) flush(); quote.push(m[1]); continue; }
    // A line that is only a link becomes a button.
    if ((m = line.trim().match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)) && !paragraph.length) {
      flush();
      const href = safeHref(m[2].replace(/&amp;/g, '&'));
      out.push(href ? `<p><a class="button" href="${escapeHtml(href)}"${/^https:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${m[1]}</a></p>` : `<p>${m[1]}</p>`);
      continue;
    }
    if (list || quote.length) flush();
    paragraph.push(line.trim());
  }
  flush();
  return out.join('\n');
}

/** Plain-text summary (for meta descriptions). */
export function markdownToText(source: string, max = 160) {
  const text = String(source || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
