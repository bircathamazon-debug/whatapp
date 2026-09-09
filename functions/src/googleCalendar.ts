import { google } from 'googleapis';
import { db } from './admin';
import type { Appointment, Service, Staff } from './types';

/**
 * Sincronización opcional con Google Calendar. Requiere que cada peluquero
 * conecte su cuenta (OAuth2) desde la app de administración; el token se
 * guarda en staff/{id}/private/googleCalendar (fuera de las reglas públicas).
 * Si el peluquero no conectó Calendar, esta sincronización simplemente no
 * hace nada — no es un requisito para que el resto de la app funcione.
 */

function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(staffId: string): string | null {
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) return null;
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: staffId,
  });
}

export async function handleGoogleOAuthCallback(staffId: string, code: string): Promise<void> {
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) throw new Error('Google OAuth no configurado');
  const { tokens } = await oauth2Client.getToken(code);
  await db
    .collection('staff')
    .doc(staffId)
    .collection('private')
    .doc('googleCalendar')
    .set({
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ?? null,
    });
}

async function getCalendarClientForStaff(staffId: string) {
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) return null;
  const tokenDoc = await db.collection('staff').doc(staffId).collection('private').doc('googleCalendar').get();
  if (!tokenDoc.exists) return null;
  const tokens = tokenDoc.data() as { accessToken: string; refreshToken: string; expiryDate: number };
  if (!tokens.refreshToken) return null;
  oauth2Client.setCredentials({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken, expiry_date: tokens.expiryDate });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function syncAppointmentToGoogleCalendar(appointment: Appointment, staff: Staff, service: Service): Promise<void> {
  const calendar = await getCalendarClientForStaff(staff.id);
  if (!calendar) return; // peluquero no conectó Google Calendar

  const event = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: `${service.name} — ${appointment.clientName}`,
      start: { dateTime: new Date(appointment.startsAt).toISOString() },
      end: { dateTime: new Date(appointment.endsAt).toISOString() },
      description: `Cliente: ${appointment.clientName} (${appointment.clientPhone})`,
    },
  });

  if (event.data.id) {
    await db.collection('appointments').doc(appointment.id).update({ googleCalendarEventId: event.data.id });
  }
}

export async function removeAppointmentFromGoogleCalendar(appointment: Appointment): Promise<void> {
  if (!appointment.googleCalendarEventId) return;
  const calendar = await getCalendarClientForStaff(appointment.staffId);
  if (!calendar) return;
  await calendar.events.delete({ calendarId: 'primary', eventId: appointment.googleCalendarEventId }).catch(() => {});
}
