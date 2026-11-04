import { rewrite } from './update-contact-email.ts'

const input = {
  root: {
    children: [
      { type: 'text', text: 'Cancellation requests to ' },
      { type: 'text', text: 'bookings@foodagency.mt', format: 'bold' },
      { type: 'text', text: ' or info@foodagency.mt. Keep 7 unchanged.' },
      { type: 'listitem', value: 42 },
    ],
  },
}
const r = rewrite(input)
const json = JSON.stringify(r.value)
if (r.replacements !== 2) throw new Error('expected 2 replacements, got ' + r.replacements)
if (json.includes('foodagency.mt')) throw new Error('old address survived')
if ((json.match(/foodexperience\.mfa@gov\.mt/g) || []).length !== 2) throw new Error('expected 2 new addresses')
if (r.value.root.children[3].value !== 42) throw new Error('non-string value changed')

// Idempotent: second pass changes nothing.
const again = rewrite(r.value)
if (again.replacements !== 0) throw new Error('not idempotent')

console.log('update-contact-email rewrite: OK')
