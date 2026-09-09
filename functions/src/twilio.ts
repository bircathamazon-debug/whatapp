import twilio from 'twilio';

let client: twilio.Twilio | null = null;

export function getTwilioClient(): twilio.Twilio | null {
  if (client) return client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  client = twilio(sid, token);
  return client;
}
