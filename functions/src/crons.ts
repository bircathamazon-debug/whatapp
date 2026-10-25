import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './admin';
import type { Appointment, Branch, Client, RecurringBooking, Staff } from './types';
import { REMINDER_WINDOWS_HOURS } from './types';
import { sendNotification, getTemplates, flushDueTelnyxNotifications } from './notify';
import { markCompleted, releaseExpiredDepositHolds, formatDate, formatTime, createAppointment } from './booking';
import { toEpoch, getStaffServiceDuration } from './availability';
import { chargeTranzilaToken } from './tranzila';

/** Cada 15 minutos: recordatorios 24h y 2h antes, por el canal preferido del cliente. */
export const sendReminders = onSchedule({ schedule: 'every 15 minutes', timeZone: 'Asia/Jerusalem' }, async () => {
  const now = Date.now();

  for (const hoursBefore of REMINDER_WINDOWS_HOURS) {
    const windowStart = now + hoursBefore * 3600000;
    const windowEnd = windowStart + 15 * 60000;

    const snap = await db
      .collection('appointments')
      .where('status', '==', 'confirmed')
      .where('startsAt', '>=', windowStart)
      .where('startsAt', '<', windowEnd)
      .get();

    for (const doc of snap.docs) {
      const appt = doc.data() as Appointment;
      if ((appt.remindersSent ?? []).includes(hoursBefore)) continue;

      const branchSnap = await db.collection('branches').doc(appt.branchId).get();
      const clientSnap = await db.collection('clients').doc(appt.clientId).get();
      if (!branchSnap.exists || !clientSnap.exists) continue;
      const branch = branchSnap.data() as Branch;
      const client = clientSnap.data() as Client;

      await sendNotification({
        channel: client.preferredChannel,
        to: client.phone,
        branch,
        template: 'reminder',
        text: getTemplates(branch.language).reminder(client.name, formatDate(appt.startsAt, branch.timezone), formatTime(appt.startsAt, branch.timezone)),
        relatedAppointmentId: appt.id,
        awaitingReply: 'confirm_cancel',
      });

      await doc.ref.update({ remindersSent: [...(appt.remindersSent ?? []), hoursBefore] });
    }
  }
});

/**
 * Cada 15 minutos: una vez que terminó la hora de una cita confirmada, se
 * da por hecho que el cliente vino y se marca "completada" sola — así
 * aparece el ingreso en Finanzas sin que el peluquero tenga que hacer
 * nada. Si el cliente realmente no vino, el peluquero lo corrige a mano
 * desde la Agenda (`adminMarkNoShow`). Antes era al revés (esta misma
 * función marcaba "no vino" sola a los 20 minutos de la hora de inicio),
 * lo que significaba que ninguna cita llegaba nunca a "completada" — por
 * eso Finanzas siempre mostraba ₪0, no era un error de cálculo.
 */
export const autoCompleteAppointments = onSchedule({ schedule: 'every 15 minutes', timeZone: 'Asia/Jerusalem' }, async () => {
  const cutoff = Date.now() - 10 * 60000; // 10 min de gracia tras el fin de la cita
  const snap = await db.collection('appointments').where('status', '==', 'confirmed').where('endsAt', '<', cutoff).limit(100).get();
  for (const doc of snap.docs) {
    await markCompleted(doc.id);
  }
});

/** Cada 30 minutos: libera reservas con depósito pendiente vencido. */
export const releaseDeposits = onSchedule({ schedule: 'every 30 minutes' }, async () => {
  await releaseExpiredDepositHolds();
});

/** Cada 15 minutos: despacha SMS/llamadas que quedaron retenidos por modo Shabat silencioso. */
export const flushDelayedTelnyx = onSchedule({ schedule: 'every 15 minutes' }, async () => {
  await flushDueTelnyxNotifications();
});

/** Diario 09:00 hora de Israel: felicitaciones de cumpleaños con descuento. */
export const sendBirthdayMessages = onSchedule({ schedule: '0 9 * * *', timeZone: 'Asia/Jerusalem' }, async () => {
  const mmdd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', month: '2-digit', day: '2-digit' }).format(Date.now());
  const [day, month] = mmdd.split('/');
  const key = `${month}-${day}`;

  const snap = await db.collection('clients').where('birthday', '==', key).get();
  for (const doc of snap.docs) {
    const client = doc.data() as Client;
    const branchSnap = await db.collection('branches').doc(client.branchId).get();
    if (!branchSnap.exists) continue;
    const branch = branchSnap.data() as Branch;
    await sendNotification({
      channel: 'whatsapp',
      to: client.phone,
      branch,
      template: 'birthday',
      text: getTemplates(branch.language).birthday(client.name),
    });
  }
});

/**
 * Diario 06:00: materializa la próxima ocurrencia de cada reserva recurrente
 * ("todos los jueves a las 18:00") con 4 semanas de antelación, respetando
 * disponibilidad real del peluquero.
 */
export const generateRecurringAppointments = onSchedule({ schedule: '0 6 * * *', timeZone: 'Asia/Jerusalem' }, async () => {
  const HORIZON_MS = 28 * 24 * 3600000;
  const snap = await db.collection('recurringBookings').where('active', '==', true).get();

  for (const doc of snap.docs) {
    const rb = doc.data() as RecurringBooking;
    const [branchSnap, staffSnap, serviceSnap] = await Promise.all([
      db.collection('branches').doc(rb.branchId).get(),
      db.collection('staff').doc(rb.staffId).get(),
      db.collection('services').doc(rb.serviceId).get(),
    ]);
    if (!branchSnap.exists || !staffSnap.exists || !serviceSnap.exists) continue;
    const branch = branchSnap.data() as Branch;
    const staff = staffSnap.data() as Staff;
    const service = serviceSnap.data() as { durationMinutes: number; name: string; price: number; requiresDeposit: boolean; depositAmount: number; id: string; branchId: string };

    let cursor = Math.max(rb.nextGeneratedThrough, Date.now());
    const target = Date.now() + HORIZON_MS;
    let lastGenerated = rb.nextGeneratedThrough;

    while (cursor < target) {
      const next = nextOccurrence(cursor, rb.dayOfWeek, rb.time, branch.timezone);
      if (next > target) break;
      try {
        await createAppointment({
          branch,
          staff,
          service: service as any,
          clientPhone: rb.clientPhone,
          clientName: rb.clientName,
          startsAt: next,
          endsAt: next + getStaffServiceDuration(staff, service) * 60000,
          source: 'recurring',
          recurringBookingId: rb.id,
        });
      } catch {
        // hueco ocupado por otra reserva puntual: se omite esta semana
      }
      lastGenerated = next;
      cursor = next + 24 * 3600000;
    }

    if (lastGenerated !== rb.nextGeneratedThrough) {
      await doc.ref.update({ nextGeneratedThrough: lastGenerated });
    }
  }
});

/**
 * Diario 10:00: a quienes se cortaron el pelo hace ~30 días (cita marcada
 * como completada) se les invita automáticamente a reservar de nuevo.
 */
export const sendComebackReminders = onSchedule({ schedule: '0 10 * * *', timeZone: 'Asia/Jerusalem' }, async () => {
  const THIRTY_DAYS_MS = 30 * 24 * 3600000;
  const now = Date.now();
  const windowStart = now - THIRTY_DAYS_MS - 12 * 3600000;
  const windowEnd = now - THIRTY_DAYS_MS + 12 * 3600000;

  const snap = await db
    .collection('appointments')
    .where('status', '==', 'completed')
    .where('startsAt', '>=', windowStart)
    .where('startsAt', '<', windowEnd)
    .get();

  for (const doc of snap.docs) {
    const appt = doc.data() as Appointment;
    if (appt.comebackReminderSentAt) continue;

    const branchSnap = await db.collection('branches').doc(appt.branchId).get();
    if (!branchSnap.exists) continue;
    const branch = branchSnap.data() as Branch;

    await sendNotification({
      channel: 'whatsapp',
      to: appt.clientPhone,
      branch,
      template: 'comebackReminder',
      text: getTemplates(branch.language).comebackReminder(appt.clientName),
    });
    await doc.ref.update({ comebackReminderSentAt: Date.now() });
  }
});

/**
 * Diario 08:00: cobra de nuevo el token de Tranzila de las sucursales con
 * suscripción activa cuyo período ya venció — así armamos el "cobro
 * mensual recurrente" nosotros mismos, ya que Tranzila no lo gestiona
 * solo (eso es un módulo pago aparte). Las sucursales con Stripe no
 * pasan por acá: Stripe ya cobra solo y avisa por su propio webhook.
 */
export const chargeTranzilaSubscriptions = onSchedule({ schedule: '0 8 * * *', timeZone: 'Asia/Jerusalem' }, async () => {
  const now = Date.now();
  const snap = await db
    .collection('branches')
    .where('subscription.provider', '==', 'tranzila')
    .where('subscription.status', '==', 'active')
    .get();

  for (const doc of snap.docs) {
    const branch = { id: doc.id, ...(doc.data() as Omit<Branch, 'id'>) };
    if (!branch.subscription?.currentPeriodEnd || branch.subscription.currentPeriodEnd > now) continue;

    const success = await chargeTranzilaToken(branch);
    if (success) {
      await doc.ref.update({ 'subscription.currentPeriodEnd': now + 30 * 24 * 3600000 });
    } else {
      await doc.ref.update({ 'subscription.status': 'past_due' });
    }
  }
});

const BOT_DOWN_THRESHOLD_MS = 15 * 60000; // sin latido del bot por más de esto = se considera caído
const HEALTH_ALERT_COOLDOWN_MS = 60 * 60000; // no repetir la alerta más de una vez por hora

/**
 * Cada 10 minutos: si el bot de WhatsApp de alguna sucursal dejó de avisar
 * que sigue vivo (`systemHealth/{branchId}.lastHeartbeat`, que el propio
 * bot actualiza cada pocos minutos), avisa con una LLAMADA al teléfono de
 * la sucursal — una llamada y no un WhatsApp a propósito, porque si el bot
 * está caído, un aviso por WhatsApp nunca saldría (lo manda el mismo bot
 * caído). Antes se mandaba por SMS, pero el número de Telnyx nunca tuvo un
 * "Messaging Profile" asignado en el portal (hace falta para poder mandar
 * SMS) — la alerta se encolaba pero fallaba en silencio y nunca llegaba de
 * verdad. Se cambió a llamada porque la voz ya está probada y funcionando
 * (es el mismo mecanismo del IVR), sin depender de configurar nada nuevo.
 */
export const checkSystemHealth = onSchedule({ schedule: 'every 10 minutes', timeZone: 'Asia/Jerusalem' }, async () => {
  const now = Date.now();
  const healthSnap = await db.collection('systemHealth').get();

  for (const doc of healthSnap.docs) {
    const health = doc.data() as { branchId: string; lastHeartbeat: number; lastAlertSentAt?: number };
    if (now - health.lastHeartbeat <= BOT_DOWN_THRESHOLD_MS) continue;
    if (health.lastAlertSentAt && now - health.lastAlertSentAt < HEALTH_ALERT_COOLDOWN_MS) continue;

    const branchSnap = await db.collection('branches').doc(health.branchId).get();
    if (!branchSnap.exists) continue;
    const branch = branchSnap.data() as Branch;
    if (!branch.phone) continue;

    const minutesDown = Math.round((now - health.lastHeartbeat) / 60000);
    try {
      await sendNotification({
        channel: 'call',
        to: branch.phone,
        branch,
        template: 'systemDown',
        text: getTemplates(branch.language).systemDown(branch.name, minutesDown),
      });
    } catch (err) {
      console.error('[crons] error enviando alerta de sistema caído', err);
    }
    await doc.ref.update({ lastAlertSentAt: now });
  }
});

function nextOccurrence(fromMs: number, dayOfWeek: number, time: string, timezone: string): number {
  let cursor = fromMs;
  for (let i = 0; i < 8; i++) {
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(cursor); // 'YYYY-MM-DD'
    const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
    if (dow === dayOfWeek) return toEpoch(dateStr, time, timezone);
    cursor += 24 * 3600000;
  }
  return toEpoch(new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(cursor), time, timezone);
}
