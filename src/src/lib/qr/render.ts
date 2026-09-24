import QRCode from 'qrcode'

/** Render a QR token as a data: URI PNG for inline embedding in emails. */
export async function qrTokenToDataUri(rawToken: string): Promise<string> {
  return QRCode.toDataURL(rawToken, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 440,
    color: {
      dark: '#33483D',
      light: '#FFFFFFFF',
    },
  })
}
