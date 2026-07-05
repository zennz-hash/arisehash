import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.EMAIL_FROM || 'AriseHash <onboarding@resend.dev>'

async function send({ to, subject, html }) {
  if (!resend) {
    console.log(`[Email][skip] to=${to} subject="${subject}"`)
    return { id: 'skipped' }
  }
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html })
    return result
  } catch (err) {
    console.error('[Email] send failed:', err.message)
  }
}

export function sendWelcomeEmail(to, name) {
  return send({
    to,
    subject: 'Selamat datang di AriseHash!',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto">
        <h2>Halo, ${name}!</h2>
        <p>Terima kasih telah bergabung di <strong>AriseHash</strong>.</p>
        <p>Kamu bisa langsung mulai membuat PRD, mendesain arsitektur, dan menghasilkan prototipe kode langsung dari browser.</p>
        <p>Jika ada pertanyaan, balas email ini kapan saja.</p>
        <p>Salam,<br/>Tim AriseHash</p>
      </div>
    `,
  })
}

export function sendCollaboratorInvite(to, projectName, inviterName) {
  return send({
    to,
    subject: `${inviterName} mengundangmu ke proyek "${projectName}"`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto">
        <h2>Undangan Kolaborasi</h2>
        <p><strong>${inviterName}</strong> telah menambahkanmu sebagai kolaborator di proyek <strong>${projectName}</strong>.</p>
        <p>Login ke AriseHash untuk mulai berkolaborasi.</p>
        <p>Salam,<br/>Tim AriseHash</p>
      </div>
    `,
  })
}

export function sendQuotaWarning(to, planType, used, limit) {
  const pct = Math.round((used / limit) * 100)
  return send({
    to,
    subject: `Peringatan Kuota AriseHash — ${pct}% terpakai`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto">
        <h2>Kuota Hampir Habis</h2>
        <p>Kamu sudah menggunakan <strong>${used}/${limit}</strong> kuota harian pada plan <strong>${planType}</strong>.</p>
        <p>Pertimbangkan untuk upgrade agar tidak kehabisan kuota.</p>
        <p>Salam,<br/>Tim AriseHash</p>
      </div>
    `,
  })
}

// End of email utilities

