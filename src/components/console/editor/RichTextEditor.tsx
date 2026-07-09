'use client'

import { useCallback, useRef } from 'react'

interface LexicalTextNode {
  text?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  children?: LexicalNode[]
}

interface LexicalNode {
  type?: string
  text?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  children?: LexicalNode[]
  tag?: string
  direction?: string
  format?: string | number
  indent?: number
  url?: string
  alt?: string
  src?: string
}

interface RichTextEditorProps {
  value: unknown
  onChange: (json: unknown) => void
  placeholder?: string
}

export function lexicalToHtml(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const root = (body as { root?: { children?: LexicalNode[] } }).root
  if (!root || !Array.isArray(root.children)) return ''

  const parts: string[] = []
  walkNodes(root.children as unknown[], parts)
  return parts.join('<br />')
}

function walkNodes(nodes: unknown[], acc: string[], indent = 0): void {
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const n = node as LexicalNode

    if (n.type === 'paragraph') {
      if (acc.length > 0 && acc[acc.length - 1] !== '') acc.push('')
      if (Array.isArray(n.children)) walkNodes(n.children, acc, indent)
      continue
    }

    if (n.type === 'heading') {
      if (acc.length > 0) acc.push('')
      if (Array.isArray(n.children)) walkNodes(n.children, acc, indent)
      if (acc.length > 0) acc.push('')
      continue
    }

    if (n.type === 'list' || n.type === 'listitem') {
      if (Array.isArray(n.children)) walkNodes(n.children, acc, indent)
      continue
    }

    if (n.type === 'link') {
      if (Array.isArray(n.children)) walkNodes(n.children, acc, indent)
      continue
    }

    if (typeof n.text === 'string') {
      acc.push(n.text)
    }

    if (Array.isArray(n.children)) walkNodes(n.children, acc, indent)
  }
}

export function htmlToLexical(html: string): Record<string, unknown> {
  // Convert simple HTML/plain-text to Lexical JSON
  const lines = html.split(/\n|<br\s*\/?>/i).filter(Boolean)
  const children: LexicalNode[] = []

  for (const line of lines) {
    const trimmed = line.replace(/<\/?[^>]+(>|$)/g, '').trim()
    if (trimmed) {
      children.push({
        children: [{ type: 'text', text: trimmed, format: 0 }],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
      })
    }
  }

  if (children.length === 0) {
    children.push({
      children: [{ type: 'text', text: '', format: 0 }],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'paragraph',
    })
  }

  return {
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
    },
  }
}

export default function RichTextEditor({ value, onChange, placeholder = 'Start typing...' }: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  

  const extractPlainText = useCallback((body: unknown): string => {
    if (!body || typeof body !== 'object') return ''
    const root = (body as { root?: { children?: LexicalNode[] } }).root
    if (!root || !Array.isArray(root.children)) return ''

    const parts: string[] = []
    const collectText = (nodes: unknown[]): void => {
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue
        const n = node as LexicalNode
        if (typeof n.text === 'string') {
          parts.push(n.text)
        }
        if (Array.isArray(n.children)) collectText(n.children)
      }
    }
    collectText(root.children)
    return parts.join('\n')
  }, [])

  const currentText = extractPlainText(value)

  const handleInput = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const html = el.innerHTML
    const text = (el.textContent || '').trim()

    // If empty, produce empty lexical
    if (!text) {
      onChange({
        root: {
          children: [{ children: [{ type: 'text', text: '', format: 0 }], direction: 'ltr', format: '', indent: 0, type: 'paragraph' }],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'root',
        },
      })
      return
    }

    // Parse the contentEditable HTML into lexical paragraphs
    // Each block-level element becomes a paragraph
    const blocks = html.split(/<\/div>|<br\s*\/?>/i)
    const children: LexicalNode[] = []

    for (const block of blocks) {
      const stripped = block.replace(/<[^>]*>/g, '').trim()
      if (stripped) {
        children.push({
          children: [{ type: 'text', text: stripped, format: 0 }],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'paragraph',
        })
      }
    }

    if (children.length === 0) {
      children.push({
        children: [{ type: 'text', format: 0, text: '' }],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
      })
    }

    onChange({
      root: {
        children,
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
      },
    })
  }, [onChange])

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
        <button
          type="button"
          title="Bold (Ctrl+B)"
          onClick={(e) => {
            e.preventDefault()
            document.execCommand('bold')
            containerRef.current?.focus()
          }}
          className="rounded px-2 py-1 text-xs font-bold text-text-light hover:bg-soft-beige hover:text-lunar-green transition-colors"
        >
          B
        </button>
        <button
          type="button"
          title="Italic (Ctrl+I)"
          onClick={(e) => {
            e.preventDefault()
            document.execCommand('italic')
            containerRef.current?.focus()
          }}
          className="rounded px-2 py-1 text-xs italic text-text-light hover:bg-soft-beige hover:text-lunar-green transition-colors"
        >
          I
        </button>
        <button
          type="button"
          title="Underline (Ctrl+U)"
          onClick={(e) => {
            e.preventDefault()
            document.execCommand('underline')
            containerRef.current?.focus()
          }}
          className="rounded px-2 py-1 text-xs underline text-text-light hover:bg-soft-beige hover:text-lunar-green transition-colors"
        >
          U
        </button>
        <span className="text-border mx-1">|</span>
        <button
          type="button"
          title="Heading"
          onClick={(e) => {
            e.preventDefault()
            document.execCommand('formatBlock', false, '<h3>')
            containerRef.current?.focus()
          }}
          className="rounded px-2 py-1 text-xs font-semibold text-text-light hover:bg-soft-beige hover:text-lunar-green transition-colors"
        >
          H
        </button>
        <button
          type="button"
          title="Unordered list"
          onClick={(e) => {
            e.preventDefault()
            document.execCommand('insertUnorderedList')
            containerRef.current?.focus()
          }}
          className="rounded px-2 py-1 text-xs font-semibold text-text-light hover:bg-soft-beige hover:text-lunar-green transition-colors"
        >
          &bull; List
        </button>
      </div>
      <div
        ref={containerRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        className={[
          'min-h-[200px] p-4 text-sm text-lunar-green outline-none',
          'focus:ring-2 focus:ring-lunar-green/20 focus:ring-inset',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-text-light/40',
          'prose prose-sm max-w-none',
          '[&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-lunar-green [&_h3]:mb-2',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2',
          '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2',
        ].join(' ')}
        dangerouslySetInnerHTML={{
          __html: currentText
            .split('\n')
            .map((line) =>
              line ? `<div>${escapeHtml(line)}</div>` : '<div><br /></div>'
            )
            .join(''),
        }}
      />
    </div>
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
