import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET() {
  try {
    const p = await getPayload({ config })
    
    // Test 1: find
    const list = await p.find({ collection: 'events', limit: 1, overrideAccess: true })
    
    // Test 2: create
    const ev = await p.create({
      collection: 'events',
      data: {
        title: 'TEST CREATE ' + Date.now(),
        service: 1,
        date: '2027-12-31',
        startTime: '2027-12-31T18:00:00.000Z',
        endTime: '2027-12-31T22:00:00.000Z',
        capacity: 5,
        pricePerPerson: 25,
        locationRef: 'Test venue',
        status: 'scheduled',
      },
      overrideAccess: true,
    })

    return NextResponse.json({ 
      ok: true, 
      found: list.totalDocs, 
      created: String(ev.id),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : JSON.stringify(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}