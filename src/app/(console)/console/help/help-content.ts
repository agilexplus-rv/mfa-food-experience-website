/**
 * Staff help content for /console/help.
 *
 * Three levels: category -> procedure -> steps. Every label in **bold**
 * is copied from the live UI, and `code` marks references (URLs, booking
 * references, CSV columns). Keep it in sync with the pages it describes:
 * the help-guard workflow (.github/workflows/help-guard.yml) fails PRs
 * that change console / check-in UI without touching this directory.
 *
 * Inline markup understood by the help page renderer:
 *   **text**  -> UI label (bold)
 *   `text`    -> reference (monospace)
 */

export type HelpRole = 'admin' | 'door_staff'

export interface HelpNote {
  kind: 'tip' | 'warning' | 'prereq'
  text: string
}

export interface HelpProcedure {
  id: string
  title: string
  roles: HelpRole[]
  /** Where the procedure starts, shown as a monospace reference. */
  path: string
  steps: string[]
  notes?: HelpNote[]
}

export interface HelpCategory {
  id: string
  title: string
  summary: string
  procedures: HelpProcedure[]
}

const ADMIN: HelpRole[] = ['admin']
const BOTH: HelpRole[] = ['admin', 'door_staff']

export const HELP_CATEGORIES: HelpCategory[] = [
  // ── 1. Bookings ────────────────────────────────────────────────
  {
    id: 'bookings',
    title: 'Bookings',
    summary: 'Find, create, cancel and refund bookings, and resend confirmation emails.',
    procedures: [
      {
        id: 'bookings-search',
        title: 'Search and filter bookings',
        roles: ADMIN,
        path: '/console/bookings',
        steps: [
          'Click **Bookings** in the sidebar.',
          'Type a booking reference (e.g. `MFA-7K3QZ9`), the lead attendee\'s name or their email into the **Search by reference, name, or email...** box. The list updates as you type.',
          'To narrow the list, pick a status from the **All Statuses** dropdown: **Pending**, **Confirmed**, **Cancelled** or **Checked In**.',
          'Press Enter or click **Search** to refresh the results.',
          'Read the row: **Status** shows the booking state plus any **NO-SHOW** or **refund:** badge; **Checked In** and **By** show when, and by whom, the guest was admitted.',
          'If there is more than one page, use **Previous** and **Next** under the table (25 bookings per page).',
        ],
        notes: [
          { kind: 'tip', text: 'Search matches part of a word, so a surname or the last few characters of a reference is enough.' },
        ],
      },
      {
        id: 'bookings-detail',
        title: 'View a booking\'s full details',
        roles: ADMIN,
        path: '/console/bookings/[id]',
        steps: [
          'Click **Bookings** in the sidebar and find the booking.',
          'Click anywhere on the booking\'s row (not on its action buttons) to open **Booking Detail**.',
          'The **Details** card shows status, event, attendee, email, phone, persons, language, total and any coupon used.',
          'The **Check-in & Financial** card shows **Checked In**, **Checked In By**, **Payment Method**, **Refund Status** and **Refund ID**. Dietary notes and the guest\'s consent appear here when given.',
          '**Audit Trail** lists every recorded change to this booking. **Waitlist** lists people waiting for the same event.',
          'Click **← Back to Bookings** to return to the list.',
        ],
        notes: [
          { kind: 'tip', text: 'Booking Detail is read-only. **Cancel**, **Resend** and **No-show** are buttons on the booking\'s row in the Bookings list.' },
        ],
      },
      {
        id: 'bookings-create',
        title: 'Create a manual booking (phone, walk-in or comp)',
        roles: ADMIN,
        path: '/console/bookings',
        steps: [
          'Click **Bookings** in the sidebar.',
          'Click **+ New Booking** (top right).',
          'Choose the **Event** from the list.',
          'Fill in **Lead Attendee Name**, **Email** and **Persons** (all required). **Phone** and **Dietary Notes** are optional.',
          'Choose the **Payment Method**: **Cash**, **Bank Transfer**, **Comped** or **Pending Payment**.',
          'Leave **Total Amount (EUR), leave empty to auto-calculate** blank to charge the event price × persons, or type an amount to override it. **Comped** bookings are always €0.',
          'Click **Create Booking**. The booking is saved as **confirmed** and appears in the list.',
        ],
        notes: [
          { kind: 'warning', text: 'The console does not check remaining seats. Look at the **Rem.** column on the **Events** page first, or you can overbook the event.' },
          { kind: 'warning', text: 'Manual bookings get no confirmation email and no QR code. Tell the guest their reference; door staff check them in with **Look Up Booking** on the scanner.' },
          { kind: 'tip', text: '**Pending Payment** only records how the guest will pay. The booking is still confirmed and holds its seats.' },
        ],
      },
      {
        id: 'bookings-cancel',
        title: 'Cancel a booking (refunds are automatic)',
        roles: ADMIN,
        path: '/console/bookings',
        steps: [
          'Click **Bookings** in the sidebar and search for the booking.',
          'Check the reference, event and attendee carefully. Open the row if you need to be sure, then click **← Back to Bookings**.',
          'In the **Actions** column, click **Cancel**.',
          'Wait for the list to refresh. The status changes to **cancelled**, and a **refund:** badge appears if a refund was issued.',
          'If an alert reading `refund_failed` appears, the booking was NOT cancelled. Try again later or check the payment in Viva.',
          'Open the booking and read **Refund Status** / **Refund ID** to confirm the refund.',
        ],
        notes: [
          { kind: 'warning', text: 'There is no "Are you sure?" prompt. **Cancel** acts immediately and cannot be undone from the console.' },
          { kind: 'prereq', text: 'The refund amount comes from **Settings → Cancellation Policy** (the tier for how many days before the event, or a full refund inside the cooling-off period). Cancelling from the **Bookings Dashboard** (`/dashboard`) instead always refunds in full.' },
          { kind: 'tip', text: 'Cancelling frees the seats and automatically emails the first **Waiting** person on that event\'s waitlist.' },
        ],
      },
      {
        id: 'bookings-refund',
        title: 'Refund a booking and check its refund status',
        roles: ADMIN,
        path: '/console/bookings',
        steps: [
          'Refunds are issued by cancelling the booking. Follow **Cancel a booking** above; there is no separate refund button.',
          'To review refunds, click **Bookings** and set the status filter to **Cancelled**.',
          'In the **Status** column, read the **refund:** badge: `pending`, `succeeded` or `failed`. No badge means no refund was issued.',
          'Click the row. **Check-in & Financial** shows **Refund Status** and the Viva **Refund ID**.',
          'To see which policy tier was applied, open **Audit Log** and look for the `Cancelled MFA-…` entry. Its **Detail** reads `refund tier: …`.',
        ],
        notes: [
          { kind: 'warning', text: 'The console cannot refund a different amount from the one the policy gives, or refund a booking without cancelling it.' },
          { kind: 'tip', text: 'Cash, bank-transfer and comped bookings have no online payment, so cancelling them issues no refund. Settle any money owed outside the console.' },
        ],
      },
      {
        id: 'bookings-resend',
        title: 'Resend a confirmation email',
        roles: ADMIN,
        path: '/dashboard',
        steps: [
          'Open the **Bookings Dashboard** by typing `/dashboard` after the site address in your browser.',
          'Search for the booking by reference, name or email and click **Search**.',
          'Check the **Status** is **confirmed**. **Resend** only appears on confirmed bookings.',
          'In the **Actions** column, click **Resend**.',
          'Wait for the alert **Confirmation email resent.**',
          'Ask the guest to check their spam folder, and to use the NEW email: its QR code replaces the old one.',
        ],
        notes: [
          { kind: 'warning', text: 'Resending issues a new QR code, and the QR in any earlier email stops working.' },
          { kind: 'warning', text: 'Known issue: the **Resend** button in the console **Bookings** list does not currently send an email. Use the Bookings Dashboard button above.' },
        ],
      },
      {
        id: 'bookings-no-show',
        title: 'Mark a booking as a no-show',
        roles: ADMIN,
        path: '/console/bookings',
        steps: [
          'Click **Bookings** in the sidebar.',
          'Search for the booking. **No-show** only appears on **confirmed** bookings that were never checked in.',
          'In the **Actions** column, click **No-show**.',
          'The row now shows a red **NO-SHOW** badge, and **Booking Detail** shows **Marked as No-Show**.',
          'No-shows are counted in the `No-shows` column of the events CSV export.',
        ],
        notes: [
          { kind: 'warning', text: 'There is no confirmation prompt and no undo button. Only mark a no-show after the event has started.' },
        ],
      },
    ],
  },

  // ── 2. Check-in ────────────────────────────────────────────────
  {
    id: 'check-in',
    title: 'Check-in',
    summary: 'Door tools: QR scanning, manual tokens, look-up, the offline queue and live capacity.',
    procedures: [
      {
        id: 'check-in-scan',
        title: 'Check in a guest by scanning their QR code',
        roles: BOTH,
        path: '/scan',
        steps: [
          'Open **Door Check-In** at `/scan`. From the Bookings Dashboard, click **← Scanner**.',
          'If an **Event** box is shown, choose tonight\'s event so the **checked in** counter tracks the right one.',
          'Make sure the **QR / Token** tab is selected.',
          'Tap **Start QR Scanner** and allow camera access if the browser asks.',
          'Hold the guest\'s QR code (on their phone or a printout) steady inside the frame.',
          'On the green **Checked In** card, confirm the **Attendee** name, the **Experience** and **Persons** with the guest. Pass any **Dietary** note to the host or kitchen.',
          'Tap **Scan Another** for the next guest.',
        ],
        notes: [
          { kind: 'warning', text: 'The scanner does not reject bookings for other events or cancelled bookings. Always check the **Experience** on the green card is tonight\'s event.' },
          { kind: 'tip', text: 'An amber **Already Checked In** card shows when the code was first used. If the group is already inside, no action is needed; if someone else presents the code, check the name with the lead attendee.' },
          { kind: 'tip', text: 'A red **Invalid Token** card means the code matches no booking. Use **Look Up Booking** instead.' },
        ],
      },
      {
        id: 'check-in-token',
        title: 'Enter a QR token manually (camera not working)',
        roles: BOTH,
        path: '/scan',
        steps: [
          'On **Door Check-In**, select the **QR / Token** tab.',
          'If the camera is running, tap **Stop Scanner**.',
          'Under **Or paste the token manually**, paste the token into the **Paste QR token here** box.',
          'Tap **Check In**.',
          'Read the result card, then tap **Scan Another** (success) or **Try Again** (error).',
        ],
        notes: [
          { kind: 'tip', text: '"Camera access was denied" means you need to allow the camera in the browser\'s site settings and reload. "No camera found" means you should use manual entry or **Look Up Booking**.' },
          { kind: 'tip', text: 'A **Rate Limited** card means too many attempts too quickly. Wait a moment and try again.' },
        ],
      },
      {
        id: 'check-in-lookup',
        title: 'Look up a booking and check in by name or reference',
        roles: BOTH,
        path: '/scan',
        steps: [
          'On **Door Check-In**, tap the **Look Up Booking** tab.',
          'Type the guest\'s name or booking reference into **Name or reference...**.',
          'Press Enter or tap **Search**. Up to 5 matching bookings are shown.',
          'Find the right booking: check the reference, event name, number of persons and any **Dietary** note.',
          'Tap the gold **Check In** button on that booking. It only appears on bookings that are not already checked in or cancelled.',
          'Read the green **Checked In** card, then tap **Scan Another**.',
        ],
        notes: [
          { kind: 'warning', text: 'Look-up searches every event, not only the one selected at the top. Make sure the event name matches tonight\'s event before tapping **Check In**.' },
          { kind: 'tip', text: 'Use this for guests without a QR code, including manual bookings made by an admin (these never get a QR code).' },
          { kind: 'tip', text: 'If you see **No bookings found matching that query.**, try only the surname or the reference.' },
        ],
      },
      {
        id: 'check-in-offline',
        title: 'Keep scanning when the connection drops (offline queue)',
        roles: BOTH,
        path: '/scan',
        steps: [
          'If the Wi-Fi or mobile data drops, keep scanning QR codes as normal.',
          'An amber **Queued** card means the scan was saved on this device but not yet confirmed. Tap **Continue Scanning**.',
          'A banner shows **N scans queued. Will sync when back online** (N is the number of queued scans).',
          'When the connection returns, the page syncs by itself and retries every 30 seconds. A **Syncing...** banner shows progress.',
          'Keep the **Door Check-In** page open until the queue banner disappears.',
          'If a red banner says scans **could not be synced**, check those guests in manually with **Look Up Booking**, then tap **Dismiss**.',
        ],
        notes: [
          { kind: 'warning', text: 'Queued scans are stored in this browser on this device and only sync while the page is open. Do not clear browser data or switch devices until the queue is empty.' },
          { kind: 'warning', text: 'A queued scan is dropped after 3 failed sync attempts or 24 hours. You will see the red banner when that happens.' },
          { kind: 'tip', text: '**Look Up Booking** needs a connection. While offline, only QR / token scans can be queued.' },
        ],
      },
      {
        id: 'check-in-capacity',
        title: 'Watch live capacity during an event',
        roles: BOTH,
        path: '/scan',
        steps: [
          'On **Door Check-In**, the **Event** box shows **X / Y checked in** for the selected event.',
          'Choose another event from the **Event** dropdown to watch it instead. Only scheduled events from today onwards are listed.',
          'The counter refreshes every 30 seconds and after every check-in.',
          'On the **Bookings Dashboard** (`/dashboard`), the header shows the same **X / Y checked in** counter for the next upcoming event.',
          'For a full seat count (booked vs remaining), an admin can check **Cap.**, **Booked** and **Rem.** on the **Events** page.',
        ],
        notes: [
          { kind: 'tip', text: 'The first number counts bookings (groups) checked in, not individual guests. The second number is the event\'s seat capacity.' },
        ],
      },
      {
        id: 'check-in-dashboard',
        title: 'Search bookings on the Bookings Dashboard',
        roles: BOTH,
        path: '/dashboard',
        steps: [
          'Open the **Bookings Dashboard** at `/dashboard`. Door staff land here after signing in; from the scanner, tap **Bookings dashboard**.',
          'Type a reference, name or email into **Search by reference, name, or email...**.',
          'Optionally choose a status from **All Statuses**.',
          'Click **Search**.',
          'Read the **Dietary**, **Status**, **Checked In** and **Checked In By** columns. Hover over a dietary note to see the full text.',
          'Use **Previous** and **Next** under the table to move between pages.',
        ],
        notes: [
          { kind: 'tip', text: 'The dashboard is for looking up and verifying bookings. To check a guest in, click **← Scanner** and use **Look Up Booking**.' },
          { kind: 'tip', text: 'Admins also see a **Total** column, **Cancel** / **Resend** / **No-show** buttons and an **Export CSV...** picker here.' },
        ],
      },
    ],
  },

  // ── 3. Events & Services ───────────────────────────────────────
  {
    id: 'events',
    title: 'Events & Services',
    summary: 'Create, edit and delete events and recurring series; booking cutoffs, capacity, attendee rosters and services.',
    procedures: [
      {
        id: 'events-create',
        title: 'Create a single event',
        roles: ADMIN,
        path: '/console/events',
        steps: [
          'Click **Events** in the sidebar.',
          'Click **+ New Event**.',
          'Fill in **Title**, choose the **Service** (the experience it belongs to) and pick the **Date**.',
          'Leave **Repeat** set to **Does not repeat**.',
          'Set **Start Time** and **End Time**. An end time earlier than the start means the event runs past midnight.',
          'Enter **Capacity** (seats), **Price/person (EUR)** and **Location**.',
          'Leave **Status** as **Scheduled**. Optionally set **Auto-close before (hours)** (see "Set a booking cutoff").',
          'Click **Create Event**.',
        ],
        notes: [
          { kind: 'prereq', text: 'The service must already exist. Create it on the **Services** page first.' },
        ],
      },
      {
        id: 'events-series',
        title: 'Create a recurring series of events',
        roles: ADMIN,
        path: '/console/events',
        steps: [
          'Click **Events** in the sidebar, then **+ New Event**.',
          'Fill in the form for the FIRST date: **Title**, **Service**, **Date**, times, **Capacity**, **Price/person (EUR)**, **Location**.',
          'Set **Repeat** to **Weekly**, **Every 2 weeks** or **Monthly**.',
          'Pick the **Repeat until** date.',
          'Click **Create Event**.',
          'Each date now appears as its own row, with **↻** next to the date to mark it as part of a series.',
        ],
        notes: [
          { kind: 'tip', text: 'A series can have at most 52 events. Each one can be edited or cancelled on its own afterwards.' },
          { kind: 'tip', text: 'To turn an existing single event into a series, click **Edit**, set **Repeat** and **Repeat until**, then save. New dates are only added from today onwards and start with no bookings.' },
        ],
      },
      {
        id: 'events-edit',
        title: 'Edit an event or a whole series',
        roles: ADMIN,
        path: '/console/events',
        steps: [
          'Click **Events** in the sidebar.',
          'Click **Edit** on the event\'s row.',
          'Change the fields you need.',
          'If the event is part of a series, choose **This event only** or **This and future events**.',
          'Click **Save Changes**.',
        ],
        notes: [
          { kind: 'tip', text: '**This and future events** copies title, service, capacity, price, location, status and start/end times to later dates. Each occurrence keeps its own date.' },
        ],
      },
      {
        id: 'events-cutoff',
        title: 'Set a booking cutoff (auto-close before start)',
        roles: ADMIN,
        path: '/console/events',
        steps: [
          'Click **Events** in the sidebar.',
          'Click **Edit** on the event (or **+ New Event** for a new one).',
          'In **Auto-close before (hours)**, enter how many hours before the start online bookings should stop (e.g. `2`; halves such as `1.5` are allowed).',
          'Click **Save Changes** (or **Create Event**).',
          'The event\'s row now shows a **closes Nh before** label under the time.',
        ],
        notes: [
          { kind: 'tip', text: 'Leave the field empty for no cutoff. Manual bookings made in the console are not affected.' },
        ],
      },
      {
        id: 'events-status',
        title: 'Stop sales, mark fully booked or cancel an event',
        roles: ADMIN,
        path: '/console/events',
        steps: [
          'Click **Events** in the sidebar and click **Edit** on the event.',
          'To stop online sales but keep the event, tick **Fully Booked Override**. The public site shows it as fully booked and guests can join the waitlist.',
          'To cancel the event, set **Status** to **Cancelled**. After it has run, you can set **Completed**.',
          'For a series, choose **This event only** or **This and future events**.',
          'Click **Save Changes**.',
        ],
        notes: [
          { kind: 'warning', text: 'Setting **Status** to **Cancelled** does NOT cancel, refund or email the guests who already booked. Cancel each booking on the **Attendees** roster or the **Bookings** page.' },
        ],
      },
      {
        id: 'events-capacity',
        title: 'Track capacity and seats remaining',
        roles: ADMIN,
        path: '/console/events',
        steps: [
          'Click **Events** in the sidebar.',
          'Find the event. **Cap.** is total seats, **Booked** is seats taken (pending, confirmed and checked-in bookings), and **Rem.** is seats left.',
          'For guest-level detail, click **Attendees** on the row.',
          'For a spreadsheet of every event, click **Export CSV** (see Reports & Audit).',
          'On event night, door staff see live **checked in** counts on the scanner.',
        ],
        notes: [
          { kind: 'tip', text: '**Rem.** is always capacity minus booked seats. It does not change when **Fully Booked Override** is ticked, even though the public site then shows the event as full.' },
        ],
      },
      {
        id: 'events-attendees',
        title: 'View and print an event\'s attendee roster',
        roles: ADMIN,
        path: '/console/events/[id]/attendees',
        steps: [
          'Click **Events** in the sidebar.',
          'Click **Attendees** on the event\'s row.',
          'The summary shows **X of Y seats booked across N bookings**.',
          'Read the table: **Attendee** (name and reference), **Contact**, **Persons**, **Status**, and **Dietary** (hover over **Yes** to read the note).',
          'Click a row to open that booking\'s detail page.',
          'Click **Print Roster** for a paper copy for the door.',
          'Click **← Back to Events** when done.',
        ],
        notes: [
          { kind: 'warning', text: 'The roster also lists cancelled bookings, and they count in "seats booked". Check the **Status** column, and use **Rem.** on the Events page for true free seats.' },
        ],
      },
      {
        id: 'events-delete',
        title: 'Delete an event',
        roles: ADMIN,
        path: '/console/events',
        steps: [
          'Click **Events** in the sidebar.',
          'Click **Delete** on the event\'s row.',
          'Read the **Delete Event** box. If the event has bookings, it cannot be deleted. Cancel them first, or set the event\'s **Status** to **Cancelled** instead.',
          'If there are no bookings, click **Delete Event** to confirm.',
        ],
        notes: [
          { kind: 'warning', text: 'Deleting an event cannot be undone.' },
        ],
      },
      {
        id: 'services-manage',
        title: 'Create or edit a service (experience)',
        roles: ADMIN,
        path: '/console/services',
        steps: [
          'Click **Services** in the sidebar.',
          'Click **+ New Service**, or **Edit** on an existing row.',
          'Fill in **Name** and **Slug** (required; the slug is the lowercase web-address name, e.g. `street-food-tour`).',
          'Set **Order** to control where it appears in lists (lower numbers first).',
          'Choose an **Image** from the media library and write the **Description**.',
          'Tick **Visible on public site** to show it to customers.',
          'Click **Create Service** or **Save Changes**.',
        ],
        notes: [
          { kind: 'prereq', text: 'Upload the image on the **Media** page first.' },
          { kind: 'warning', text: 'A service can only be deleted (**Delete** → **Delete Service**) when no events use it. Deleting cannot be undone. Untick **Visible on public site** to hide it instead.' },
        ],
      },
    ],
  },

  // ── 4. Waitlist ────────────────────────────────────────────────
  {
    id: 'waitlist',
    title: 'Waitlist',
    summary: 'See who is waiting for a sold-out event and whether they have been notified.',
    procedures: [
      {
        id: 'waitlist-view',
        title: 'View and filter the waitlist',
        roles: ADMIN,
        path: '/console/waitlist',
        steps: [
          'Click **Waitlist** in the sidebar.',
          'To see one event, choose it from the **Event** dropdown (default **All Events**).',
          'To see one state, choose from **Status**: **Waiting**, **Notified** or **Expired**.',
          'Read each row: **Event**, **Email**, **Name**, **Phone**, **Persons**, **Status**, **Notified** (when the email went out) and **Created** (when they joined).',
          'Use **Previous** and **Next** under the table for more entries.',
        ],
        notes: [
          { kind: 'tip', text: 'The waitlist for a single event is also shown at the bottom of any of that event\'s **Booking Detail** pages.' },
        ],
      },
      {
        id: 'waitlist-notified',
        title: 'Check whether a waitlisted guest was notified',
        roles: ADMIN,
        path: '/console/waitlist',
        steps: [
          'Click **Waitlist** in the sidebar.',
          'Choose the event from the **Event** dropdown.',
          'Find the guest. **Waiting** means no email has been sent yet.',
          '**Notified** means they were emailed "Seats available: …". The **Notified** column shows when.',
          'Order matters: guests are notified oldest-first (earliest **Created**), one guest per cancelled booking.',
        ],
        notes: [
          { kind: 'tip', text: 'Notifications are sent automatically when an admin cancels a booking for that event. The console has no button to notify someone manually.' },
          { kind: 'warning', text: 'A notification is not a reservation. The guest still has to book on the website, and anyone else can take the seat first.' },
        ],
      },
    ],
  },

  // ── 5. Coupons ─────────────────────────────────────────────────
  {
    id: 'coupons',
    title: 'Coupons',
    summary: 'Create discount codes, change or disable them, and track how often they are used.',
    procedures: [
      {
        id: 'coupons-create',
        title: 'Create a coupon',
        roles: ADMIN,
        path: '/console/coupons',
        steps: [
          'Click **Coupons** in the sidebar.',
          'Click **+ Create Coupon**.',
          'Type a code in **Coupon Code (optional, auto-generated)** (e.g. `SUMMER25`), or leave it blank to get a random code.',
          'Choose the **Type**: **Percentage** or **Fixed (EUR)**, then enter the **Value**.',
          'Set **Valid From** and **Valid Until**.',
          'Optionally set **Max Total Uses (optional)** (blank means unlimited) and **Max Uses Per Booking**.',
          'Leave **Active immediately** ticked, or untick it to switch the coupon on later.',
          'Click **Create Coupon**.',
        ],
        notes: [
          { kind: 'warning', text: 'Codes are saved in capitals, and guests must type them in capitals exactly as shown at checkout. `summer25` does not match `SUMMER25`.' },
        ],
      },
      {
        id: 'coupons-edit',
        title: 'Edit, disable or re-enable a coupon',
        roles: ADMIN,
        path: '/console/coupons',
        steps: [
          'Click **Coupons** in the sidebar.',
          'To change a coupon, click **Edit** on its row, update the fields and click **Save Changes**.',
          'To stop a coupon working right away, click **Disable**. Its status changes to **Disabled**.',
          'To switch it back on, click **Enable**.',
        ],
        notes: [
          { kind: 'warning', text: 'Changing the **Coupon Code** invalidates the old code, and guests who have it can no longer use it.' },
          { kind: 'tip', text: 'Coupons cannot be deleted. Disable them instead, which keeps their usage history.' },
        ],
      },
      {
        id: 'coupons-usage',
        title: 'Track coupon usage and discounts given',
        roles: ADMIN,
        path: '/console/coupons',
        steps: [
          'Click **Coupons** in the sidebar.',
          '**Uses** shows times used, and the limit if one is set (e.g. `12 / 50`).',
          '**Discount Redeemed** shows the total euros discounted, with the number of redemptions in brackets.',
          '**Status** shows **Active**, **N days left** / **Last day** (expiring within a week), **Starts …**, **Expired**, **Exhausted** (limit reached) or **Disabled**.',
          'To see who used a code, export bookings (Reports & Audit) and filter the `Coupon` column. The code also shows as **Coupon** on each **Booking Detail**.',
        ],
      },
    ],
  },

  // ── 6. Content & Media ─────────────────────────────────────────
  {
    id: 'content',
    title: 'Content & Media',
    summary: 'News articles, legal policies, customer testimonials and the image library.',
    procedures: [
      {
        id: 'content-news-create',
        title: 'Write and publish a news article',
        roles: ADMIN,
        path: '/console/content/news',
        steps: [
          'Click **Content** in the sidebar, then the **News** card.',
          'Click **+ New Article**.',
          'Fill in **Title**, **Slug** (lowercase words joined by hyphens, e.g. `summer-menu-2026`) and **Date**.',
          'Optionally choose an **Image (optional)** from the media library.',
          'Write the article in **Body**.',
          'Tick **Published** to show it on the website now, or leave it unticked to save a draft.',
          'Click **Create Article**.',
        ],
        notes: [
          { kind: 'prereq', text: 'Upload the image on the **Media** page first.' },
        ],
      },
      {
        id: 'content-news-manage',
        title: 'Edit, unpublish or delete a news article',
        roles: ADMIN,
        path: '/console/content/news',
        steps: [
          'Click **Content** in the sidebar, then the **News** card.',
          'To change an article, click **Edit**, make your changes and click **Save Changes**.',
          'To take it off the website without deleting it, click **Unpublish**. **Publish** puts it back.',
          'To remove it for good, click **Delete** and confirm the browser prompt.',
        ],
        notes: [
          { kind: 'warning', text: 'Deleted articles cannot be recovered. Use **Unpublish** if you might need it again.' },
        ],
      },
      {
        id: 'content-policies',
        title: 'Update a policy document',
        roles: ADMIN,
        path: '/console/content/policies',
        steps: [
          'Click **Content** in the sidebar, then the **Policies** card.',
          'Click **Edit** on the policy (e.g. privacy notice, cookie policy).',
          'Update the **Body** text.',
          'Bump the **Version** (e.g. `1.0` → `1.1`).',
          '**Last Reviewed** updates automatically when the body changes. You can also set it by hand.',
          'Click **Save Changes**.',
        ],
        notes: [
          { kind: 'warning', text: 'These are legal documents. Get changes approved before saving. Do not change the **Slug**: it is the page\'s address (`/legal/<slug>`) and footer links depend on it.' },
          { kind: 'tip', text: 'Policies cannot be created or deleted here. The cancellation policy is edited under **Settings → Cancellation Policy**.' },
        ],
      },
      {
        id: 'content-testimonials',
        title: 'Approve or reject testimonials',
        roles: ADMIN,
        path: '/console/content/testimonials',
        steps: [
          'Click **Content** in the sidebar, then the **Testimonials** card.',
          'Choose **Pending** from the filter to see new submissions, then click **Refresh**.',
          'Read the **Testimonial** text, **Name** and **Event**.',
          'Click **Approve** to show it on the website.',
          'To take an approved testimonial down, click **Reject**. It goes back to pending and is hidden.',
        ],
      },
      {
        id: 'media-upload',
        title: 'Upload an image to the media library',
        roles: ADMIN,
        path: '/console/media',
        steps: [
          'Click **Media** in the sidebar.',
          'Click **+ Upload**.',
          'Click **Click to select an image** and choose a PNG, JPG or WebP file up to 10MB.',
          'Describe the image in **Alt Text** (read aloud to visually impaired visitors), e.g. "Chef plating ftira at the Valletta market".',
          'Click **Upload**. The image appears in the library and in the image pickers for services, news and site settings.',
        ],
      },
      {
        id: 'media-manage',
        title: 'View, copy the link of, or delete an image',
        roles: ADMIN,
        path: '/console/media',
        steps: [
          'Click **Media** in the sidebar.',
          'Click a thumbnail, or **View** in the table, to open **Media Detail**.',
          'Read the **Filename**, **Type**, **Size**, **Uploaded** date and **Alt Text**.',
          'To copy the image address, click the **URL** text (it selects all) and copy.',
          'To delete, click **Delete** and confirm the browser prompt. Otherwise click **Close**.',
        ],
        notes: [
          { kind: 'warning', text: 'Deleted images cannot be recovered. Images used by a service or news article cannot be deleted until you remove them there first.' },
          { kind: 'warning', text: 'The homepage hero image is NOT protected. Check **Settings → Site Settings** before deleting an image.' },
        ],
      },
    ],
  },

  // ── 7. Settings & Staff ────────────────────────────────────────
  {
    id: 'settings',
    title: 'Settings & Staff',
    summary: 'Staff accounts, site-wide settings, the cancellation policy, social links and your own account.',
    procedures: [
      {
        id: 'staff-invite',
        title: 'Invite a new staff member',
        roles: ADMIN,
        path: '/console/staff',
        steps: [
          'Click **Staff** in the sidebar.',
          'Under **Invite New Staff**, type their email address.',
          'Choose the role: **Door Staff** (scanner and dashboard only) or **Admin** (full console).',
          'Click **Invite**.',
          'They receive an email with a temporary password. If the email fails, the temporary password is shown on screen instead. Pass it on privately.',
          'Ask them to sign in and change the password straight away (see "Change your password").',
        ],
        notes: [
          { kind: 'tip', text: 'Admins must set up two-factor authentication (MFA) the first time they sign in.' },
          { kind: 'tip', text: '"A user with this email already exists." means they already have an account. Find them in the list below instead.' },
        ],
      },
      {
        id: 'staff-manage',
        title: 'Change a role, deactivate, or reset a password or MFA',
        roles: ADMIN,
        path: '/console/staff',
        steps: [
          'Click **Staff** in the sidebar and find the person.',
          'To change their role, pick **Door Staff** or **Admin** in their **Role** dropdown and confirm the prompt.',
          'To block sign-in, click **Deactivate**. **Activate** restores access.',
          'To send a password-reset email, click **Reset PW**.',
          'If they lost their authenticator app, click **Reset MFA**, then **Confirm**. They will set MFA up again at their next sign-in.',
          'To remove an account permanently, click **Delete** and confirm the prompt.',
        ],
        notes: [
          { kind: 'warning', text: '**Delete** cannot be undone. Prefer **Deactivate**, which you can reverse with **Activate**.' },
          { kind: 'tip', text: 'You cannot change your own role, deactivate yourself or delete yourself. Your row shows "(you)".' },
        ],
      },
      {
        id: 'settings-site',
        title: 'Change site settings (hero image, contact recipients)',
        roles: ADMIN,
        path: '/console/settings/site-settings',
        steps: [
          'Click **Settings** in the sidebar, then **Site Settings**.',
          'Under **Homepage Hero Background Image**, click **Select from Media** to pick an image, or **Upload New**. Click **Clear** to go back to the text-only hero.',
          'Under **Contact Form Recipients**, enter the email address(es) that receive Contact-page messages, separated by semicolons (e.g. `info@foodagency.mt; bookings@foodagency.mt`).',
          'Click **Save Settings**.',
          'Open the public homepage to check the result.',
        ],
        notes: [
          { kind: 'tip', text: 'Leave **Contact Form Recipients** empty to use the server\'s default admin address.' },
        ],
      },
      {
        id: 'settings-cancellation',
        title: 'Edit the cancellation and refund policy',
        roles: ADMIN,
        path: '/console/settings/cancellation-policy',
        steps: [
          'Click **Settings** in the sidebar, then **Cancellation Policy**.',
          'Leave **Cancellations enabled** ticked (unticking it tells customers cancellations are not permitted).',
          'Optionally tick **Offer a cooling-off period** and set **Cooling-off period (hours)** (e.g. 24, 48 or 72).',
          'Under **Cancellation Tiers**, list tiers from MOST days to FEWEST. For each, set **Min days before event**, **Refund %** and an optional **Label**. Use **+ Add Tier** and **Remove** as needed.',
          'Update **Introductory Text** and **Organiser Cancellation Text** if needed.',
          'Click **Save Policy**.',
        ],
        notes: [
          { kind: 'warning', text: 'Tiers take effect immediately: the next booking an admin cancels is refunded using the new percentages.' },
          { kind: 'warning', text: 'Only edit **Withdrawal Right Disclosure (Art. 16(l) / Art. 6(1)(k))** if legal advice confirms a change is needed.' },
        ],
      },
      {
        id: 'settings-social',
        title: 'Update social media links in the footer',
        roles: ADMIN,
        path: '/console/settings/social-media',
        steps: [
          'Click **Settings** in the sidebar, then **Social Media**.',
          'For each row, check the **Platform** (**Instagram**, **Facebook** or **X**).',
          'Enter the full **Profile URL** (e.g. `https://instagram.com/yourpage`).',
          'Tick **Published** to show the icon in the footer; untick it to hide the icon.',
          'Click **Save Settings**.',
        ],
      },
      {
        id: 'account-password',
        title: 'Change your password',
        roles: BOTH,
        path: '/console/account · /account',
        steps: [
          'Click **Change password** in the top-right of the console. Door staff can also use the **Change password** link on the dashboard or scanner.',
          'Enter your **Current password**.',
          'Enter a **New password**: at least 12 characters, with an uppercase letter, a lowercase letter, a number and a symbol.',
          'Type it again in **Confirm new password**.',
          'Click **Change password** and wait for **Your password has been changed.**',
        ],
        notes: [
          { kind: 'tip', text: 'Forgotten your password? Ask an admin to click **Reset PW** for you on the **Staff** page.' },
        ],
      },
      {
        id: 'account-shell',
        title: 'Sign out, and collapse or expand the sidebar',
        roles: BOTH,
        path: '/console',
        steps: [
          'To sign out, click **Logout** in the top-right corner of any console page (including this Help page).',
          'On a desktop, click the double-arrow button left of the page title to collapse the sidebar to icons (**Collapse sidebar**).',
          'Hover an icon to see its name. Click the button again to **Expand sidebar**.',
          'On a phone or tablet, tap the menu (☰) button to open the sidebar, and tap outside it to close.',
          'Always sign out on shared devices at the venue.',
        ],
      },
    ],
  },

  // ── 8. Reports & Audit ─────────────────────────────────────────
  {
    id: 'reports',
    title: 'Reports & Audit',
    summary: 'CSV exports of bookings and events, and reading the audit log.',
    procedures: [
      {
        id: 'reports-bookings-csv',
        title: 'Export bookings to CSV',
        roles: ADMIN,
        path: '/console/bookings',
        steps: [
          'Click **Bookings** in the sidebar.',
          'Optionally narrow the list with the search box and the status filter.',
          'Click **Export Filtered** (shown when a filter is active) or **Export All**.',
          'The CSV opens in a new tab or downloads. Open it in Excel or Google Sheets.',
          'Columns include `Reference`, `Status`, `Experience`, `Lead attendee`, `Email`, `Persons`, `Total (EUR)`, `Payment method`, `Coupon`, `Dietary notes (consented)`, `Checked in at`, `No-show` and `Refund status`.',
        ],
        notes: [
          { kind: 'tip', text: 'Exports follow your search and status filter, but not the page you are on: every matching booking is included, not only the 25 on screen.' },
          { kind: 'warning', text: 'The file contains personal data (names, emails, phones, dietary notes). Store it securely and delete it when you are done. Every export is recorded in the audit log.' },
        ],
      },
      {
        id: 'reports-event-bookings-csv',
        title: 'Export one event\'s bookings to CSV',
        roles: ADMIN,
        path: '/console/bookings',
        steps: [
          'Click **Bookings** in the sidebar.',
          'In the export area on the right, open **Export one event...** and choose the event.',
          'Click **Export**.',
          'The CSV opens in a new tab or downloads. It has the same columns as the full bookings export.',
          'On the **Bookings Dashboard** (`/dashboard`), admins can do the same with **Export CSV...** and **Export**.',
        ],
        notes: [
          { kind: 'tip', text: 'The one-event export ignores the search box and status filter.' },
        ],
      },
      {
        id: 'reports-events-csv',
        title: 'Export all events to CSV',
        roles: ADMIN,
        path: '/console/events',
        steps: [
          'Click **Events** in the sidebar.',
          'Click **Export CSV** (top right, next to **+ New Event**).',
          'The CSV opens in a new tab or downloads.',
          'Use columns such as `Capacity`, `Seats booked`, `Seats remaining`, `Checked-in guests`, `No-shows`, `Cancelled bookings` and `Revenue (EUR)` for reporting.',
        ],
      },
      {
        id: 'audit-filter',
        title: 'Filter the audit log',
        roles: ADMIN,
        path: '/console/audit-log',
        steps: [
          'Click **Audit Log** in the sidebar.',
          'Choose an **Action**: **Create**, **Update**, **Delete**, **Login**, **Failed Login**, **Logout**, **Password Change**, **MFA Reset**, **Check-in** or **Export**.',
          'Set **From** and/or **To** dates to limit the time range.',
          'Use **Previous** and **Next** to page through results.',
          'Click **Clear Filters** to reset.',
        ],
        notes: [
          { kind: 'tip', text: 'Several **Failed Login** entries in a row from one **IP Address** may mean someone is guessing a password. Tell the account owner and consider **Reset PW**.' },
        ],
      },
      {
        id: 'audit-read',
        title: 'Read an audit log entry',
        roles: ADMIN,
        path: '/console/audit-log',
        steps: [
          'Click **Audit Log** in the sidebar and filter as needed.',
          '**Timestamp**: when it happened. **Actor**: which staff account did it.',
          '**Action** and **Collection**: what kind of change, and to what (e.g. `update` on `bookings`).',
          '**Document ID**: the record that changed. **Detail**: a plain summary, e.g. `Cancelled MFA-… refund tier: …`.',
          '**IP Address**: where the request came from.',
          'For the history of one booking, open its **Booking Detail** and read **Audit Trail**.',
        ],
        notes: [
          { kind: 'tip', text: 'Entries cannot be edited or deleted from the console. The log is the record of who did what.' },
        ],
      },
    ],
  },
]
