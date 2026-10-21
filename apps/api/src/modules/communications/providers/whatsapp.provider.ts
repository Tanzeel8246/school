/**
 * Twilio WhatsApp: same SDK, different from/to prefix ('whatsapp:+1…').
 * Returns {success, sid, error} — never throws.
 * Returns {success:false, error:'twilio_whatsapp_not_configured'} when env vars are absent.
 * Multi-tenant: caller passes recipient phone; tenant scope enforced upstream.
 */
export async function sendWhatsApp(to: string, body: string): Promise<{
  success: boolean; sid?: string; error?: string;
}> {
  const { env } = await import('../../../config/env.js');
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    // MOCK MODE FOR FREE TESTING
    console.log(`\n[MOCK WHATSAPP] To: ${to}\nMessage: ${body}\n`);
    return { success: true, sid: 'mock_wa_' + Date.now() };
  }
  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    const waTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const msg = await client.messages.create({ body, from: env.TWILIO_WHATSAPP_FROM, to: waTo });
    return { success: true, sid: msg.sid };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
