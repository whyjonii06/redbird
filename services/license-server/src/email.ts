const RESEND_API_URL = 'https://api.resend.com/emails'

export type LicenseEmailData = {
  to: string
  licenseKey: string
  plan: string
}

function licenseEmailHtml(data: LicenseEmailData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <!-- Header -->
    <div style="background:#0a0a0a;padding:32px 40px">
      <div style="color:#E8302A;font-size:22px;font-weight:700;letter-spacing:-0.5px">Redbird</div>
      <div style="color:#888;font-size:13px;margin-top:4px">Your license key is ready</div>
    </div>
    <!-- Body -->
    <div style="padding:40px">
      <p style="margin:0 0 16px;color:#111;font-size:15px">Welcome to <strong>Redbird ${data.plan.toUpperCase()}</strong>.</p>
      <p style="margin:0 0 24px;color:#444;font-size:14px;line-height:1.6">
        Your license key is below. Add it to your <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px;font-size:13px">createRedbird</code> config to unlock all official plugins.
      </p>

      <!-- License key box -->
      <div style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
        <div style="font-size:11px;font-weight:600;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">License key</div>
        <code style="font-size:14px;font-weight:600;color:#111;word-break:break-all;letter-spacing:0.5px">${data.licenseKey}</code>
      </div>

      <!-- Code snippet -->
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#444">Usage</p>
      <pre style="background:#0a0a0a;color:#e4e4e7;padding:16px;border-radius:8px;font-size:12px;overflow-x:auto;margin:0 0 24px"><code>import { createRedbird } from '@redbirdshop/core'

const redbird = createRedbird({
  licenseKey: '${data.licenseKey}',
  // ... rest of your config
})</code></pre>

      <p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.6">
        Keep this key safe. If you lose it, you can retrieve it from your
        <a href="https://marketplace.redbird.io/dashboard" style="color:#E8302A;text-decoration:none">dashboard</a>.
      </p>
    </div>
    <!-- Footer -->
    <div style="padding:24px 40px;border-top:1px solid #f0f0f0;background:#fafafa">
      <p style="margin:0;font-size:12px;color:#999">
        Redbird · Questions? <a href="mailto:support@redbird.io" style="color:#666;text-decoration:none">support@redbird.io</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function licenseEmailText(data: LicenseEmailData): string {
  return `Welcome to Redbird ${data.plan.toUpperCase()}!

Your license key: ${data.licenseKey}

Add it to your createRedbird config:

  createRedbird({
    licenseKey: '${data.licenseKey}',
  })

Dashboard: https://marketplace.redbird.io/dashboard
Support: support@redbird.io
`
}

export async function sendLicenseEmail(data: LicenseEmailData): Promise<void> {
  const apiKey = process.env['RESEND_API_KEY']
  const from = process.env['RESEND_FROM'] ?? 'Redbird <noreply@marketplace.redbird.io>'

  if (!apiKey) {
    // Fallback: log to console if no Resend key configured
    console.log('\n─────────────────────────────────────────────')
    console.log(`LICENSE KEY EMAIL (no RESEND_API_KEY configured)`)
    console.log(`To:      ${data.to}`)
    console.log(`Key:     ${data.licenseKey}`)
    console.log('─────────────────────────────────────────────\n')
    return
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [data.to],
      subject: `Your Redbird ${data.plan.toUpperCase()} license key`,
      html: licenseEmailHtml(data),
      text: licenseEmailText(data),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Failed to send license email: ${res.status} ${body}`)
  } else {
    console.log(`License email sent to ${data.to}`)
  }
}
