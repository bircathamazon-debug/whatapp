import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './admin';
import type { Appointment, Branch, Client, RecurringBooking, Staff } from './types';
import { REMINDER_WINDOWS_HOURS } from './types';
import { sendNotification, templates, flushDueTwilioNotifications } from './notify';
import { markNoShow, releaseExpiredDepositHolds, formatDate, formatTime, createAppointment } from './booking';
import { toEpoch } from './availability';

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
        text: templates.reminder(client.name, formatDate(appt.startsAt, branch.timezone), formatTime(appt.startsAt, branch.timezone)),
        relatedAppointmentId: appt.id,
        awaitingReply: 'confirm_cancel',
      });

      await doc.ref.update({ remindersSent: [...(appt.remindersSent ?? []), hoursBefore] });
    }
  }
});

/** Cada 15 minutos: marca no-show a citas confirmadas cuya hora ya pasó sin check-in/cancelación. */
export const markNoShows = onSchedule({ schedule: 'every 15 minutes', timeZone: 'Asia/Jerusalem' }, async () => {
  const cutoff = Date.now() - 20 * 60000; // 20 min de gracia tras la hora de la cita
  const snap = await db.collection('appointments').where('status', '==', 'confirmed').where('startsAt', '<', cutoff).limit(100).get();
  for (const doc of snap.docs) {
    await markNoShow(doc.id);
  }
});

/** Cada 30 minutos: libera reservas con depósito pendiente vencido. */
export const releaseDeposits = onSchedule({ schedule: 'every 30 minutes' }, async () => {
  await releaseExpiredDepositHolds();
});

/** Cada 15 minutos: despacha SMS/llamadas que quedaron retenidos por modo Shabat silencioso. */
export const flushDelayedTwilio = onSchedule({ schedule: 'every 15 minutes' }, async () => {
  await flushDueTwilioNotifications();
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
    await sendNotification({
      channel: 'whatsapp',
      to: client.phone,
      branch: branchSnap.data() as Branch,
      template: 'birthday',
      text: templates.birthday(client.name),
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
          endsAt: next + service.durationMinutes * 60000,
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
