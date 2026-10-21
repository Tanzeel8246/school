/**
 * Thin Twilio SMS wrapper. Returns {success, sid, error} — never throws.
 * Returns {success:false, error:'twilio_not_configured'} when env vars are absent.
 * Multi-tenant: caller passes the recipient phone; tenant scoping is done upstream.
 */
export async function sendSms(to: string, body: string): Promise<{
  success: boolean; sid?: string; error?: string;
}> {
  const { env } = await import('../../../config/env.js');
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    // MOCK MODE FOR FREE TESTING
    console.log(`\n[MOCK SMS] To: ${to}\nMessage: ${body}\n`);
    return { success: true, sid: 'mock_sms_' + Date.now() };
  }
  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    const msg = await client.messages.create({ body, from: env.TWILIO_FROM_NUMBER, to });
    return { success: true, sid: msg.sid };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
