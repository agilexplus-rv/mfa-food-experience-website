import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Diagnostic endpoint: mimics console events POST handler exactly
 * to isolate the p.create() failure. No auth, no middleware — pure
 * Payload local API test.
 */
export async function GET() {
  const results: string[] = []
  
  try {
    const p = await getPayload({ config })
    results.push(`getPayload: OK`)

    // Mimic exactly what console POST does
    const body = {
      title: 'DIAG FIX TEST ' + Date.now(),
      serviceId: '1',   // NOTE: string!  Tests whether Number() fix works
      date: '2027-12-31',
      startTime: '2027-12-31T18:00',
      endTime: '2027-12-31T22:00',
      capacity: 5,
      pricePerPerson: 25,
      locationRef: 'Test',
      status: 'scheduled',
      fullyBookedOverride: false,
    }

    const date = body.date
    const baseStart = body.startTime || body.date
    const baseEnd = body.endTime || body.date

    const shiftToDate = (dateTime: string, newDate: string): string => {
      const timePart = dateTime.includes('T') ? dateTime.slice(dateTime.indexOf('T')) : 'T00:00:00.000Z'
      return `${newDate}${timePart}`
    }

    results.push(`Prepared data — title: ${body.title}, serviceId type: ${typeof body.serviceId}`)

    // NOTE: Number() coercion — this is the fix
    const ev = await p.create({
      collection: 'events',
      data: {
        title: body.title.trim(),
        service: Number(body.serviceId),
        date,
        startTime: shiftToDate(baseStart, date),
        endTime: shiftToDate(baseEnd, date),
        capacity: body.capacity,
        pricePerPerson: body.pricePerPerson,
        locationRef: body.locationRef || '',
        status: body.status || 'scheduled',
        fullyBookedOverride: body.fullyBookedOverride ?? false,
      },
      overrideAccess: true,
    })

    results.push(`Created: ${String(ev.id)}`)

    // Now test WITHOUT Number() coercion (old behavior)
    const ev2 = await p.create({
      collection: 'events',
      data: {
        title: 'DIAG NO-FIX ' + Date.now(),
        service: body.serviceId as any,  // string, like old code
        date: '2027-12-31',
        startTime: '2027-12-31T18:00:00.000Z',
        endTime: '2027-12-31T22:00:00.000Z',
        capacity: 5,
        pricePerPerson: 25,
        locationRef: 'Test 2',
        status: 'scheduled',
        fullyBookedOverride: false,
      },
      overrideAccess: true,
    })

    results.push(`Also created without fix: ${String(ev2.id)}`)
    results.push(`Surprising — string service ID worked too!`)

    return NextResponse.json({ ok: true, results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack?.slice(0, 500)}` : JSON.stringify(err)
    results.push(`FAIL: ${msg}`)
    return NextResponse.json({ ok: false, results, error: msg }, { status: 500 })
  }
}