/**
 * Cliente HTTP hacia las Cloud Functions "bot*" (functions/src/botApi.ts).
 * Toda la lógica de negocio (transacciones anti-doble-reserva, notificaciones,
 * Google Calendar, fidelidad) vive del lado de las Cloud Functions; el bot
 * solo la invoca.
 */
import 'dotenv/config';

const BASE = process.env.FUNCTIONS_BASE_URL;
const SECRET = process.env.BOT_SHARED_SECRET;

async function call(path, body) {
  if (!BASE || !SECRET) {
    throw new Error('FUNCTIONS_BASE_URL / BOT_SHARED_SECRET no configurados en bot/.env');
  }
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bot-secret': SECRET },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = json.error;
    throw err;
  }
  return json;
}

export const getAvailability = (staffId, serviceId, dateStr) => call('botGetAvailability', { staffId, serviceId, dateStr });

export const createAppointment = (payload) => call('botCreateAppointment', payload);

export const cancelAppointment = (appointmentId) => call('botCancelAppointment', { appointmentId });

export const confirmAppointment = (appointmentId) => call('botConfirmAppointment', { appointmentId });

export const acceptWaitlistOffer = (waitlistId) => call('botAcceptWaitlistOffer', { waitlistId });

export const addToWaitlist = (payload) => call('botAddToWaitlist', payload);

export const createRecurringBooking = (payload) => call('botCreateRecurringBooking', payload);
