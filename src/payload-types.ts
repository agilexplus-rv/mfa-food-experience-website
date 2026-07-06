// Minimal local type declarations for the News listing.
//
// Payload v3's `payload generate:types` fails under this repo's
// ESM/tsx setup (ERR_REQUIRE_ASYNC_MODULE — see seed.ts note), so we
// hand-maintain the slim types the public surface needs. Replace this
// file with the generated `src/payload-types.ts` once type generation
// is fixed; the NewsItem/Media shapes below mirror the collection
// configs in src/payload/collections/{NewsItems,Media}.ts.

export interface Media {
  id: string
  alt?: string
  filename?: string
  url?: string
}

/** Shape of a `media` upload relation returned by the Payload Local API. */
export type MediaRelation = Media | string | null | undefined

export interface NewsItem {
  id: string
  title: string
  date: string
  image?: MediaRelation
  /** Lexical rich-text serialized state (body field). */
  body?: unknown
  published?: boolean
  slug: string
}
