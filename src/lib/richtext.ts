import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'

/**
 * Render a Lexical rich-text value to HTML for public pages (server-side
 * only). Returns '' for empty/invalid values so callers can simply check
 * truthiness.
 */
export function richTextToHtml(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const root = (body as { root?: { children?: unknown[] } }).root
  if (!root || !Array.isArray(root.children) || root.children.length === 0) return ''
  try {
    const html = convertLexicalToHTML({ data: body as never, disableContainer: true })
    // An editor with only empty paragraphs renders as "<p></p>" etc.
    return typeof html === 'string' && html.replace(/<[^>]*>/g, '').trim() ? html : ''
  } catch {
    return ''
  }
}
