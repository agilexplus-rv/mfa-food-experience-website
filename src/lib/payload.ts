import type { Media, MediaRelation } from "@/payload-types"

/**
 * Resolve the public URL for a Payload `media` upload relation.
 *
 * Returns a path relative to the site origin (e.g. "/storage/foo.jpg")
 * when the media doc has a filename, or the raw `url` if set, or null
 * if there is no usable image. We deliberately avoid pulling
 * `NEXT_PUBLIC_SERVER_URL` in here so the markup is origin-relative and
 * cache-friendly.
 */
export function getMediaUrl(image: MediaRelation): string | null {
  if (!image) return null
  if (typeof image === "string") return null
  if (image.url) return image.url
  if (image.filename) return `/storage/${image.filename}`
  return null
}

interface LexicalTextNode {
  type: "text"
  text: string
}
interface LexicalElementNode {
  type: string
  children?: LexicalNode[]
}
type LexicalNode = LexicalTextNode | LexicalElementNode | { type: string }
interface LexicalState {
  root?: { children?: LexicalNode[] }
}

function isTextNode(n: LexicalNode): n is LexicalTextNode {
  return n?.type === "text" && typeof (n as LexicalTextNode).text === "string"
}

function isElementNode(n: LexicalNode): n is LexicalElementNode {
  return Array.isArray((n as LexicalElementNode).children)
}

function walk(nodes: LexicalNode[] | undefined, acc: string[]): void {
  if (!nodes) return
  for (const n of nodes) {
    if (isTextNode(n)) {
      acc.push(n.text)
    } else if (isElementNode(n)) {
      walk(n.children, acc)
    }
  }
}

/**
 * Extract plain text from a Lexical rich-text `body` field.
 *
 * Returns an empty string for missing/unrecognised shapes — the caller
 * decides whether to show an excerpt.
 */
export function getExcerpt(body: unknown, max = 220): string {
  if (!body || typeof body !== "object") return ""
  const state = body as LexicalState
  if (!state.root?.children) return ""
  const parts: string[] = []
  walk(state.root.children, parts)
  const text = parts.join(" ").replace(/\s+/g, " ").trim()
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const lastSpace = slice.lastIndexOf(" ")
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max)}…`
}
