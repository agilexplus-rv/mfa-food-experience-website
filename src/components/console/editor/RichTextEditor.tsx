'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * Lightweight rich-text editor for the staff console that reads and writes
 * Payload's Lexical JSON.
 *
 * The editable area is UNCONTROLLED: React never re-renders its innerHTML
 * while the user types. (A controlled contentEditable resets the DOM on
 * every keystroke, which moves the caret back to the start -- text was
 * being typed backwards -- and threw away headings/lists on re-render.)
 * The DOM is only (re)seeded when `value` changes from outside, e.g. when
 * the form opens a different document.
 */

interface LexicalNode {
  type?: string
  text?: string
  format?: string | number
  tag?: string
  listType?: string
  children?: LexicalNode[]
  fields?: { url?: string; newTab?: boolean; linkType?: string }
  url?: string
  [key: string]: unknown
}

interface RichTextEditorProps {
  value: unknown
  onChange: (json: unknown) => void
  placeholder?: string
}

// Lexical text-format bit flags.
const IS_BOLD = 1
const IS_ITALIC = 1 << 1
const IS_STRIKETHROUGH = 1 << 2
const IS_UNDERLINE = 1 << 3
const IS_CODE = 1 << 4

const BLOCK_BASE = { direction: 'ltr', format: '', indent: 0, version: 1 }

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Lexical JSON -> editor HTML ──────────────────────────────────────

function inlineToHtml(nodes: LexicalNode[] | undefined): string {
  if (!Array.isArray(nodes)) return ''
  return nodes.map((n) => {
    if (n.type === 'linebreak') return '<br>'
    if (n.type === 'text' || typeof n.text === 'string') {
      let html = escapeHtml(n.text || '')
      const f = typeof n.format === 'number' ? n.format : 0
      if (f & IS_CODE) html = `<code>${html}</code>`
      if (f & IS_STRIKETHROUGH) html = `<s>${html}</s>`
      if (f & IS_UNDERLINE) html = `<u>${html}</u>`
      if (f & IS_ITALIC) html = `<em>${html}</em>`
      if (f & IS_BOLD) html = `<strong>${html}</strong>`
      return html
    }
    if (n.type === 'link' || n.type === 'autolink') {
      const url = n.fields?.url || n.url || ''
      return `<a href="${escapeHtml(url)}">${inlineToHtml(n.children)}</a>`
    }
    return inlineToHtml(n.children)
  }).join('')
}

function blockToHtml(n: LexicalNode): string {
  switch (n.type) {
    case 'paragraph': {
      const inner = inlineToHtml(n.children)
      return `<p>${inner || '<br>'}</p>`
    }
    case 'heading': {
      const tag = /^h[1-6]$/.test(String(n.tag)) ? String(n.tag) : 'h3'
      return `<${tag}>${inlineToHtml(n.children) || '<br>'}</${tag}>`
    }
    case 'quote':
      return `<blockquote>${inlineToHtml(n.children) || '<br>'}</blockquote>`
    case 'list': {
      const tag = n.listType === 'number' || n.tag === 'ol' ? 'ol' : 'ul'
      const items = (n.children || []).map((li) => {
        const nested = (li.children || []).filter((c) => c.type === 'list')
        const inline = (li.children || []).filter((c) => c.type !== 'list')
        return `<li>${inlineToHtml(inline) || '<br>'}${nested.map(blockToHtml).join('')}</li>`
      })
      return `<${tag}>${items.join('')}</${tag}>`
    }
    default:
      // Nodes this editor can't edit (uploads, blocks, relationships...)
      // are kept verbatim as a non-editable placeholder so saving from the
      // console never silently deletes them.
      return `<div contenteditable="false" data-lexical-json="${escapeHtml(JSON.stringify(n))}" class="my-2 rounded border border-dashed border-border px-3 py-2 text-xs text-text-light">[${escapeHtml(n.type || 'embedded')} content, edit in the full admin]</div>`
  }
}

export function lexicalToHtml(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const root = (body as { root?: { children?: LexicalNode[] } }).root
  if (!root || !Array.isArray(root.children)) return ''
  return root.children.map(blockToHtml).join('')
}

// ── Editor DOM -> Lexical JSON ───────────────────────────────────────

function textNode(text: string, format: number): LexicalNode {
  return { type: 'text', text, format, detail: 0, mode: 'normal', style: '', version: 1 }
}

function formatFor(el: HTMLElement, format: number): number {
  const tag = el.tagName.toLowerCase()
  let f = format
  if (tag === 'b' || tag === 'strong') f |= IS_BOLD
  if (tag === 'i' || tag === 'em') f |= IS_ITALIC
  if (tag === 'u') f |= IS_UNDERLINE
  if (tag === 's' || tag === 'strike' || tag === 'del') f |= IS_STRIKETHROUGH
  if (tag === 'code') f |= IS_CODE
  // execCommand may emit <span style="font-weight: bold"> in some browsers.
  const style = el.style
  if (style) {
    if (style.fontWeight === 'bold' || Number(style.fontWeight) >= 600) f |= IS_BOLD
    if (style.fontStyle === 'italic') f |= IS_ITALIC
    if ((style.textDecorationLine || style.textDecoration || '').includes('underline')) f |= IS_UNDERLINE
    if ((style.textDecorationLine || style.textDecoration || '').includes('line-through')) f |= IS_STRIKETHROUGH
  }
  return f
}

function serializeInline(nodes: NodeListOf<ChildNode> | ChildNode[], format = 0): LexicalNode[] {
  const out: LexicalNode[] = []
  for (const node of Array.from(nodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\u200B/g, '')
      if (text) out.push(textNode(text, format))
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    if (tag === 'br') {
      out.push({ type: 'linebreak', version: 1 })
    } else if (tag === 'a') {
      const children = serializeInline(el.childNodes, format)
      if (children.length) {
        out.push({
          type: 'link',
          children,
          ...BLOCK_BASE,
          version: 3,
          fields: { url: el.getAttribute('href') || '', newTab: el.getAttribute('target') === '_blank', linkType: 'custom' },
        })
      }
    } else {
      out.push(...serializeInline(el.childNodes, formatFor(el, format)))
    }
  }
  // A trailing <br> is just the browser's placeholder for an empty line.
  if (out.length && out[out.length - 1].type === 'linebreak') out.pop()
  return out
}

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'li'])

function isBlock(node: ChildNode): boolean {
  return node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as HTMLElement).tagName.toLowerCase())
}

function paragraph(children: LexicalNode[]): LexicalNode {
  return { type: 'paragraph', children, ...BLOCK_BASE, textFormat: 0 }
}

function serializeList(el: HTMLElement): LexicalNode {
  const ordered = el.tagName.toLowerCase() === 'ol'
  const items: LexicalNode[] = []
  let value = 1
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const c = child as HTMLElement
    const ctag = c.tagName.toLowerCase()
    if (ctag === 'ul' || ctag === 'ol') {
      // Nested list directly inside a list: Lexical nests it in its own listitem.
      items.push({ type: 'listitem', children: [serializeList(c)], ...BLOCK_BASE, value: value++ })
      continue
    }
    const inlineParts = Array.from(c.childNodes).filter((n) => !(n.nodeType === Node.ELEMENT_NODE && ['ul', 'ol'].includes((n as HTMLElement).tagName.toLowerCase())))
    const nested = Array.from(c.childNodes).filter((n) => n.nodeType === Node.ELEMENT_NODE && ['ul', 'ol'].includes((n as HTMLElement).tagName.toLowerCase())) as HTMLElement[]
    items.push({ type: 'listitem', children: serializeInline(inlineParts), ...BLOCK_BASE, value: value++ })
    for (const n of nested) {
      items.push({ type: 'listitem', children: [serializeList(n)], ...BLOCK_BASE, value: value++ })
    }
  }
  return {
    type: 'list',
    listType: ordered ? 'number' : 'bullet',
    tag: ordered ? 'ol' : 'ul',
    start: 1,
    children: items,
    ...BLOCK_BASE,
  }
}

function serializeBlocks(nodes: NodeListOf<ChildNode> | ChildNode[]): LexicalNode[] {
  const blocks: LexicalNode[] = []
  let inlineRun: ChildNode[] = []
  const flush = () => {
    if (inlineRun.length) {
      const children = serializeInline(inlineRun)
      if (children.length) blocks.push(paragraph(children))
      inlineRun = []
    }
  }

  for (const node of Array.from(nodes)) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset?.lexicalJson) {
      flush()
      try {
        blocks.push(JSON.parse((node as HTMLElement).dataset.lexicalJson as string))
      } catch { /* drop unparseable placeholder */ }
      continue
    }
    if (!isBlock(node)) {
      inlineRun.push(node)
      continue
    }
    flush()
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    if (/^h[1-6]$/.test(tag)) {
      blocks.push({ type: 'heading', tag, children: serializeInline(el.childNodes), ...BLOCK_BASE })
    } else if (tag === 'ul' || tag === 'ol') {
      blocks.push(serializeList(el))
    } else if (tag === 'blockquote') {
      blocks.push({ type: 'quote', children: serializeInline(el.childNodes), ...BLOCK_BASE })
    } else if (Array.from(el.childNodes).some(isBlock)) {
      // e.g. <div><p>..</p><ul>..</ul></div> from pasted content
      blocks.push(...serializeBlocks(el.childNodes))
    } else {
      blocks.push(paragraph(serializeInline(el.childNodes)))
    }
  }
  flush()
  return blocks
}

function emptyState(): Record<string, unknown> {
  return { root: { type: 'root', children: [paragraph([])], ...BLOCK_BASE } }
}

export function htmlToLexical(html: string): Record<string, unknown> {
  if (typeof document === 'undefined') return emptyState()
  const container = document.createElement('div')
  container.innerHTML = html
  const children = serializeBlocks(container.childNodes)
  return { root: { type: 'root', children: children.length ? children : [paragraph([])], ...BLOCK_BASE } }
}

// ── Component ────────────────────────────────────────────────────────

type ToolbarActionId = 'bold' | 'italic' | 'underline' | 'heading' | 'bullets' | 'numbers'

const TOOLBAR: { id: ToolbarActionId; label: React.ReactNode; title: string; className: string }[] = [
  { id: 'bold', label: 'B', title: 'Bold (Ctrl+B)', className: 'font-bold' },
  { id: 'italic', label: 'I', title: 'Italic (Ctrl+I)', className: 'italic' },
  { id: 'underline', label: 'U', title: 'Underline (Ctrl+U)', className: 'underline' },
  { id: 'heading', label: 'H', title: 'Heading (toggle)', className: 'font-semibold' },
  { id: 'bullets', label: <>&bull; List</>, title: 'Bulleted list', className: 'font-semibold' },
  { id: 'numbers', label: '1. List', title: 'Numbered list', className: 'font-semibold' },
]

export default function RichTextEditor({ value, onChange, placeholder = 'Start typing...' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  // JSON of the last value this editor emitted; lets us tell our own
  // onChange echoes apart from genuinely external value changes.
  const lastEmitted = useRef<string | null>(null)

  const emit = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const children = serializeBlocks(el.childNodes)
    const state = { root: { type: 'root', children: children.length ? children : [paragraph([])], ...BLOCK_BASE } }
    lastEmitted.current = JSON.stringify(state)
    onChange(state)
  }, [onChange])

  // Seed / re-seed the DOM only when the value changes externally.
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const incoming = value ? JSON.stringify(value) : null
    if (incoming !== null && incoming === lastEmitted.current) return
    el.innerHTML = lexicalToHtml(value)
    lastEmitted.current = incoming
  }, [value])

  const runAction = useCallback((id: ToolbarActionId) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const exec = (command: string, arg?: string) => document.execCommand(command, false, arg)
    switch (id) {
      case 'bold': exec('bold'); break
      case 'italic': exec('italic'); break
      case 'underline': exec('underline'); break
      case 'bullets': exec('insertUnorderedList'); break
      case 'numbers': exec('insertOrderedList'); break
      case 'heading': {
        // Toggle: turn the current heading back into a paragraph.
        let node: Node | null = window.getSelection()?.anchorNode ?? null
        let inHeading = false
        while (node && node !== editor) {
          if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName.toLowerCase() === 'h3') inHeading = true
          node = node.parentNode
        }
        exec('formatBlock', inHeading ? 'p' : 'h3')
        break
      }
    }
    emit()
  }, [emit])

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5" role="toolbar" aria-label="Formatting">
        {TOOLBAR.map((a, i) => (
          <span key={a.id} className="contents">
            {i === 3 && <span className="text-border mx-1" aria-hidden="true">|</span>}
            <button
              type="button"
              title={a.title}
              aria-label={a.title}
              // Keep the caret/selection in the editor: clicking a button
              // would otherwise move focus and the command would miss.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runAction(a.id)}
              className={`rounded px-2 py-1 text-xs text-text-light hover:bg-soft-beige hover:text-lunar-green transition-colors ${a.className || ''}`}
            >
              {a.label}
            </button>
          </span>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'p')}
        onInput={emit}
        data-placeholder={placeholder}
        className={[
          'min-h-[200px] p-4 text-sm text-lunar-green outline-none',
          'focus:ring-2 focus:ring-lunar-green/20 focus:ring-inset',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-text-light/40',
          '[&_p]:mb-2',
          '[&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold',
          '[&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-lunar-green [&_h3]:mb-2',
          '[&_h4]:font-bold [&_h5]:font-bold [&_h6]:font-bold',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2',
          '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-matte-gold/50 [&_blockquote]:pl-3 [&_blockquote]:italic',
          '[&_a]:underline [&_a]:text-accent-text',
        ].join(' ')}
      />
    </div>
  )
}
