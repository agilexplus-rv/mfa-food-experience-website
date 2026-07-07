/**
 * Brand-styled HTML confirmation email per ADR-004 step 2 / FR-4.6.
 *
 * Uses the Malta Food Experience palette (Lunar Green #33483D,
 * Terracotta #C9643D, Matte Gold #B8974D, Soft Beige #F9F4EF) and a
 * system font stack (email clients do not reliably load custom web
 * fonts like Montserrat). The QR code is embedded as a data: URI PNG
 * so it renders with no external image hosting dependency.
 *
 * Bilingual (EN/MT) -- a simple duplicated-template approach per the
 * task brief (no full i18n library needed for two languages).
 */

export interface ConfirmationEmailData {
  reference: string
  eventTitle: string
  eventDate: string
  eventTimeRange: string
  locationRef: string
  persons: number
  totalAmount: number
  language: 'en' | 'mt'
  qrDataUri: string
  cancellationPolicyUrl: string
}

const COPY = {
  en: {
    subject: (ref: string) => `Booking confirmed - ${ref} - Malta Food Experience`,
    preheader: 'Your booking is confirmed. See your details and QR code below.',
    heading: 'Booking confirmed',
    intro: 'Thank you for booking with Malta Food Experience. Your seats are reserved -- see your booking details below.',
    referenceLabel: 'Booking reference',
    eventLabel: 'Experience',
    dateLabel: 'Date and time',
    locationLabel: 'Location',
    personsLabel: 'Persons',
    totalLabel: 'Amount paid',
    qrHeading: 'Your entry QR code',
    qrBody: 'Show this QR code at the door on the day of your experience. It is unique to your booking and can only be used once.',
    policyText: 'Please review our',
    policyLink: 'cancellation policy',
    footer: 'Malta Food Agency - Pitkali Road, Ta Qali, Attard, Malta',
  },
  mt: {
    subject: (ref: string) => `Prenotazzjoni kkonfermata - ${ref} - Malta Food Experience`,
    preheader: 'Il-prenotazzjoni tieghek hija kkonfermata. Ara d-dettalji u l-kodici QR taht.',
    heading: 'Prenotazzjoni kkonfermata',
    intro: 'Grazzi talli ipprenotajt ma Malta Food Experience. Il-postijiet tieghek huma riservati -- ara d-dettalji taht.',
    referenceLabel: 'Referenza tal-prenotazzjoni',
    eventLabel: 'Esperjenza',
    dateLabel: 'Data u hin',
    locationLabel: 'Post',
    personsLabel: 'Persuni',
    totalLabel: 'Ammont imhallas',
    qrHeading: 'Il-kodici QR tal-dhul tieghek',
    qrBody: 'Uri dan il-kodici QR fil-bieb fil-jum tal-esperjenza tieghek. Huwa uniku ghall-prenotazzjoni tieghek u jista jintuza darba biss.',
    policyText: 'Jekk joghgbok ara l-',
    policyLink: 'politika ta kancellazzjoni',
    footer: 'Malta Food Agency - Pitkali Road, Ta Qali, Attard, Malta',
  },
} as const

export function renderConfirmationSubject(reference: string, language: 'en' | 'mt'): string {
  return COPY[language].subject(reference)
}

export function renderConfirmationEmailHtml(data: ConfirmationEmailData): string {
  const t = COPY[data.language]
  return `<!doctype html>
<html lang="${data.language}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t.heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#F9F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#33483D;">
  <span style="display:none;max-height:0;overflow:hidden;">${t.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F4EF;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background-color:#33483D;padding:28px 32px;">
              <span style="color:#F9F4EF;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Malta Food Experience</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:900;color:#33483D;">${t.heading}</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#6B7F74;">${t.intro}</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D4C8B8;border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #D4C8B8;">
                    <span style="display:block;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#B8974D;">${t.referenceLabel}</span>
                    <span style="display:block;margin-top:4px;font-size:16px;font-weight:700;color:#33483D;">${data.reference}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #D4C8B8;">
                    <span style="display:block;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#B8974D;">${t.eventLabel}</span>
                    <span style="display:block;margin-top:4px;font-size:16px;font-weight:700;color:#33483D;">${data.eventTitle}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #D4C8B8;">
                    <span style="display:block;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#B8974D;">${t.dateLabel}</span>
                    <span style="display:block;margin-top:4px;font-size:15px;color:#33483D;">${data.eventDate} - ${data.eventTimeRange}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #D4C8B8;">
                    <span style="display:block;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#B8974D;">${t.locationLabel}</span>
                    <span style="display:block;margin-top:4px;font-size:15px;color:#33483D;">${data.locationRef}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #D4C8B8;">
                    <span style="display:block;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#B8974D;">${t.personsLabel}</span>
                    <span style="display:block;margin-top:4px;font-size:15px;color:#33483D;">${data.persons}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="display:block;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#B8974D;">${t.totalLabel}</span>
                    <span style="display:block;margin-top:4px;font-size:18px;font-weight:900;color:#C9643D;">EUR ${data.totalAmount.toFixed(2)}</span>
                  </td>
                </tr>
              </table>

              <div style="margin-top:32px;text-align:center;">
                <h2 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#33483D;">${t.qrHeading}</h2>
                <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#6B7F74;">${t.qrBody}</p>
                <img src="${data.qrDataUri}" alt="Booking entry QR code" width="220" height="220" style="display:inline-block;border:8px solid #F9F4EF;border-radius:8px;" />
              </div>

              <p style="margin:32px 0 0;font-size:13px;line-height:1.6;color:#6B7F74;">
                ${t.policyText} <a href="${data.cancellationPolicyUrl}" style="color:#C9643D;font-weight:700;">${t.policyLink}</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F9F4EF;padding:20px 32px;text-align:center;">
              <span style="font-size:12px;color:#6B7F74;">${t.footer}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
