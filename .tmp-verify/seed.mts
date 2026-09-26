import { getPayload } from 'payload'
import config from '/home/builder/food-experience/payload.config'
import { actingAs } from '/home/builder/food-experience/src/lib/audit/helper'
import { completeFinishedEvents } from '/home/builder/food-experience/src/lib/events/auto-close'
import { processCancellationRefund } from '/home/builder/food-experience/src/lib/bookings/refund'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fakeReq = { headers: new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'seed-test' }) }
const check = (label: string, ok: boolean, extra: unknown = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`, extra)

async function main() {
  const p = await getPayload({ config })
  const a = await p.create({ collection: 'users', data: { email: 'admin-a@test.mt', password: 'Str0ng!Passw0rd', role: 'admin', active: true, mfaEnabled: true }, overrideAccess: true, context: { skipWelcomeEmail: true } })
  const A = { id: a.id, email: a.email, role: 'admin' }
  const b = await p.create({ collection: 'users', data: { email: 'admin-b@test.mt', password: 'Str0ng!Passw0rd', role: 'admin', active: true }, overrideAccess: true, ...actingAs(A, fakeReq), context: { ...actingAs(A, fakeReq).context, skipWelcomeEmail: true } })
  const door = await p.create({ collection: 'users', data: { email: 'door@test.mt', password: 'Str0ng!Passw0rd', role: 'door_staff', active: true }, overrideAccess: true, ...actingAs(A, fakeReq), context: { ...actingAs(A, fakeReq).context, skipWelcomeEmail: true } })

  const media = await p.create({ collection: 'media', data: { alt: 'Test image' }, filePath: '/tmp/fe-test/test.png', overrideAccess: true, ...actingAs(A, fakeReq) })
  const svc = await p.create({ collection: 'services', data: { name: 'Cooking Class', slug: 'cooking-class', visible: true, order: 1, imagery: Number(String(media.id)),
    description: { root: { type: 'root', direction: 'ltr', format: '', indent: 0, version: 1, children: [
      { type: 'heading', tag: 'h3', direction: 'ltr', format: '', indent: 0, version: 1, children: [{ type: 'text', text: 'What you will cook', format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] },
      { type: 'list', listType: 'bullet', tag: 'ul', start: 1, direction: 'ltr', format: '', indent: 0, version: 1, children: [
        { type: 'listitem', value: 1, direction: 'ltr', format: '', indent: 0, version: 1, children: [{ type: 'text', text: 'Ħobż biż-żejt', format: 1, detail: 0, mode: 'normal', style: '', version: 1 }] },
        { type: 'listitem', value: 2, direction: 'ltr', format: '', indent: 0, version: 1, children: [{ type: 'text', text: 'Stuffat tal-fenek', format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] } ] } ] } } },
    overrideAccess: true, ...actingAs(A, fakeReq) })
  await p.update({ collection: 'services', id: svc.id, data: { order: 2 }, overrideAccess: true, ...actingAs(A, fakeReq) })

  // Password change by self
  await p.update({ collection: 'users', id: a.id, data: { password: 'N3w!Str0ngPass' }, overrideAccess: true, ...actingAs(A, fakeReq) })

  // Guards
  let err = ''
  try { await p.delete({ collection: 'users', id: a.id, overrideAccess: true, ...actingAs(A, fakeReq) }) } catch (e) { err = (e as Error).message }
  check('admin cannot delete self', /own account/.test(err), err)
  await p.delete({ collection: 'users', id: b.id, overrideAccess: true, ...actingAs(A, fakeReq) })
  err = ''
  try { await p.update({ collection: 'users', id: a.id, data: { role: 'door_staff' }, overrideAccess: true, ...actingAs({ id: door.id, role: 'admin' }, fakeReq) }) } catch (e) { err = (e as Error).message }
  check('cannot demote the last active admin', /active admin/.test(err), err)
  err = ''
  try { await p.delete({ collection: 'users', id: a.id, overrideAccess: true }) } catch (e) { err = (e as Error).message }
  check('cannot delete the last admin (system call)', /last admin/.test(err), err)

  // Site settings hero image with numeric id
  await p.updateGlobal({ slug: 'site-settings', data: { heroBackgroundImage: null }, overrideAccess: true, ...actingAs(A, fakeReq) })

  // Events for auto-close
  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Malta' }).format(now)
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString()
  const mk = (title: string, date: string, end: string, autoClose: number | null) =>
    p.create({ collection: 'events', data: { title, service: svc.id, date, startTime: end, endTime: end, capacity: 10, pricePerPerson: 45.5, locationRef: 'Ta Qali', status: 'scheduled', autoCloseHoursAfter: autoClose }, overrideAccess: true })
  const e1 = await mk('Closes (ended 3h ago, window 1h)', today, hoursAgo(3), 1)
  const e2 = await mk('Stays open (ended 3h ago, window 5h)', today, hoursAgo(3), 5)
  const e3 = await mk('Past date, no window', '2020-01-01', '2020-01-01T18:00:00.000Z', null)
  const e4 = await mk('Yesterday late, window 2h (crosses midnight)', new Date(now.getTime() - 86400_000).toISOString().slice(0, 10), hoursAgo(1.5), 2)
  const future = await mk('Future class', new Date(now.getTime() + 7 * 86400_000).toISOString().slice(0, 10), new Date(now.getTime() + 7 * 86400_000 + 3 * 3600_000).toISOString(), null)
  const r = await completeFinishedEvents(p)
  const status = async (id: string | number) => ((await p.findByID({ collection: 'events', id, overrideAccess: true })) as { status: string }).status
  check('auto-close: window passed -> completed', (await status(e1.id)) === 'completed')
  check('auto-close: window not passed -> scheduled', (await status(e2.id)) === 'scheduled')
  check('auto-close: past date no window -> completed', (await status(e3.id)) === 'completed')
  check('auto-close: yesterday within window -> scheduled', (await status(e4.id)) === 'scheduled')
  check('auto-close: future untouched', (await status(future.id)) === 'scheduled', r)

  // Refunds
  await p.updateGlobal({ slug: 'cancellation-policy', data: { enabled: true, coolingOffEnabled: false, coolingOffHours: 24, tiers: [{ minDaysBeforeEvent: 7, refundPercentage: 100 }, { minDaysBeforeEvent: 3, refundPercentage: 50 }] }, overrideAccess: true })
  const inDays = (d: number) => new Date(now.getTime() + d * 86400_000).toISOString()
  const base = { bookingId: 1, reference: 'MFA-T', status: 'confirmed', totalAmount: 45.5 }
  let rr = await processCancellationRefund({ ...base, eventDate: inDays(4), bookedAt: hoursAgo(1) })
  check('refund 50% tier rounds to cents (22.75)', rr.refundAmountEuros === 22.75, rr)
  rr = await processCancellationRefund({ ...base, eventDate: inDays(1), bookedAt: hoursAgo(1) })
  check('late cancellation (no tier) -> no refund', rr.refundAmountEuros === 0, rr.tierLabel)
  await p.updateGlobal({ slug: 'cancellation-policy', data: { coolingOffEnabled: true, coolingOffHours: 24 }, overrideAccess: true })
  rr = await processCancellationRefund({ ...base, eventDate: inDays(1), bookedAt: hoursAgo(1) })
  check('cooling-off: within 24h -> full refund', rr.refundAmountEuros === 45.5 && rr.coolingOff, rr.tierLabel)
  rr = await processCancellationRefund({ ...base, eventDate: inDays(1), bookedAt: hoursAgo(30) })
  check('cooling-off: after 24h -> tiers apply', rr.refundAmountEuros === 0 && !rr.coolingOff, rr.tierLabel)

  await sleep(1500)
  const logs = await p.find({ collection: 'audit_logs', limit: 100, sort: 'createdAt', depth: 0, overrideAccess: true })
  for (const l of logs.docs as unknown as { action: string; collection: string; detail: string; ipAddress?: string; actor: unknown }[]) {
    console.log(`  audit: ${l.action.padEnd(15)} ${String(l.collection).padEnd(20)} actor=${l.actor} ip=${l.ipAddress ?? '-'}  ${l.detail}`)
  }
  const actions = new Set((logs.docs as unknown as { action: string; collection: string }[]).map((l) => `${l.action}:${l.collection}`))
  for (const k of ['create:users', 'create:media', 'create:services', 'update:services', 'password_change:users', 'delete:users', 'update:site-settings']) {
    check(`audit has ${k}`, actions.has(k))
  }
  console.log('IDS', JSON.stringify({ admin: a.id, door: door.id, media: media.id, service: svc.id, future: future.id }))
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
