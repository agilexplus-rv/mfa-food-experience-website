import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { seed } from '@/payload/seed'

export async function POST() {
  try {
    const payload = await getPayload({ config })

    // Step 1: try with body
    const testBody = {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        textFormat: 0,
        textStyle: '',
        children: [{
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          textFormat: 0,
          textStyle: '',
          children: [{
            type: 'text',
            text: 'Test',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          }],
        }],
      },
    }

    const results: string[] = []

    // Try with body
    const existing1 = await payload.find({
      collection: 'policies',
      where: { slug: { equals: 'diag-1' } },
      limit: 1,
    })
    if (existing1.totalDocs === 0) {
      try {
        await payload.create({
          collection: 'policies',
          data: { slug: 'diag-1', title: 'With Body', body: testBody },
          overrideAccess: true,
        })
        results.push('with-body: OK')
      } catch (e) {
        results.push(`with-body: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // Try without body
    const existing2 = await payload.find({
      collection: 'policies',
      where: { slug: { equals: 'diag-2' } },
      limit: 1,
    })
    if (existing2.totalDocs === 0) {
      try {
        await payload.create({
          collection: 'policies',
          data: { slug: 'diag-2', title: 'No Body' },
          overrideAccess: true,
        })
        results.push('no-body: OK')
      } catch (e) {
        results.push(`no-body: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // Try with body as stringified JSON
    const existing3 = await payload.find({
      collection: 'policies',
      where: { slug: { equals: 'diag-3' } },
      limit: 1,
    })
    if (existing3.totalDocs === 0) {
      try {
        await payload.create({
          collection: 'policies',
          data: { slug: 'diag-3', title: 'Body as string', body: JSON.stringify(testBody) },
          overrideAccess: true,
        })
        results.push('body-as-string: OK')
      } catch (e) {
        results.push(`body-as-string: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    await seed(payload)
    return NextResponse.json({ ok: true, diagnostics: results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 },
    )
  }
}