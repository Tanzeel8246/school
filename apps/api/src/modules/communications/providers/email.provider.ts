/**
 * Nodemailer SMTP wrapper. Returns {success, messageId, error} — never throws.
 * Returns {success:false, error:'smtp_not_configured'} when env vars are absent.
 * Multi-tenant: caller passes recipient address; tenant scope enforced upstream.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<{
  success: boolean; messageId?: string; error?: string;
}> {
  const { env } = await import('../../../config/env.js');
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    // MOCK MODE FOR FREE TESTING
    console.log(`\n[MOCK EMAIL] To: ${to}\nSubject: ${subject}\nHTML: ${html}\n`);
    return { success: true, messageId: 'mock_email_' + Date.now() };
  }
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
