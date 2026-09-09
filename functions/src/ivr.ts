import { onRequest } from 'firebase-functions/v2/https';
import { db } from './admin';
import type { Appointment, Branch, Client, Service, Staff } from './types';
import { createAppointment, confirmAppointment, cancelAppointment, formatDate, formatTime } from './booking';
import { getAvailableSlots } from './availability';

/**
 * IVR telefónico con Twilio (<Gather> + <Say> en hebreo) para clientes con
 * teléfono kasher que no pueden usar WhatsApp. Flujo:
 *  1 = agendar la próxima hora libre con cualquier peluquero
 *  2 = cancelar mi próxima cita
 *  0 = hablar con la peluquería (transferencia a la línea directa)
 *
 * Configurar en Twilio: "A CALL COMES IN" -> Webhook ->
 * https://<region>-<project>.cloudfunctions.net/ivrIncomingCall
 */
export const ivrIncomingCall = onRequest(async (req, res) => {
  const branchId = String(req.query.branchId ?? req.body.branchId ?? '');
  const branchSnap = branchId ? await db.collection('branches').doc(branchId).get() : null;
  const branch = branchSnap?.exists ? (branchSnap.data() as Branch) : null;

  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/ivrMenu?branchId=${branchId}" method="POST" timeout="8">
    <Say language="he-IL">שלום, הגעתם למספרה. לתיאום תור הקרוב ביותר הקישו 1. לביטול התור הקרוב שלכם הקישו 2. לשיחה עם המספרה הקישו 0.</Say>
  </Gather>
  <Say language="he-IL">לא התקבלה בחירה. להתראות.</Say>
</Response>`);
});

export const ivrMenu = onRequest(async (req, res) => {
  const digit = String(req.body.Digits ?? '');
  const from = normalizePhone(String(req.body.From ?? ''));
  const branchId = String(req.query.branchId ?? '');

  res.set('Content-Type', 'text/xml');

  const branchSnap = await db.collection('branches').doc(branchId).get();
  const branch = branchSnap.exists ? (branchSnap.data() as Branch) : null;
  if (!branch) {
    res.send(sayAndHangup('he-IL', 'שגיאה בהגדרת המערכת. אנא נסו שוב מאוחר יותר.'));
    return;
  }

  if (digit === '0') {
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${branch.phone}</Dial></Response>`);
    return;
  }

  if (digit === '2') {
    const next = await findNextAppointment(from);
    if (!next) {
      res.send(sayAndHangup('he-IL', 'לא נמצא תור קרוב על שם המספר הזה.'));
      return;
    }
    await cancelAppointment(next.id, 'client');
    res.send(sayAndHangup('he-IL', 'התור בוטל בהצלחה. תודה.'));
    return;
  }

  if (digit === '1') {
    const booked = await bookNextAvailableSlot(branch, from);
    if (!booked) {
      res.send(sayAndHangup('he-IL', 'מצטערים, אין תורים פנויים בקרוב. נציג יחזור אליכם.'));
      return;
    }
    const dateStr = formatDate(booked.startsAt, branch.timezone);
    const timeStr = formatTime(booked.startsAt, branch.timezone);
    res.send(sayAndHangup('he-IL', `נקבע לכם תור בתאריך ${dateStr} בשעה ${timeStr}. תקבלו אישור בהודעה.`));
    return;
  }

  res.send(sayAndHangup('he-IL', 'בחירה לא תקינה. להתראות.'));
});

/** Llamada saliente (reminders.ts la usa a través de notify.dispatchTwilio) al presionar 1/2 en la llamada de recordatorio. */
export const ivrReminderResponse = onRequest(async (req, res) => {
  const digit = String(req.body.Digits ?? '');
  const appointmentId = String(req.query.appointmentId ?? '');
  res.set('Content-Type', 'text/xml');

  if (!appointmentId) {
    res.send(sayAndHangup('he-IL', 'שגיאה.'));
    return;
  }

  if (digit === '1') {
    await confirmAppointment(appointmentId);
    res.send(sayAndHangup('he-IL', 'התור אושר. תודה.'));
  } else if (digit === '2') {
    await cancelAppointment(appointmentId, 'client');
    res.send(sayAndHangup('he-IL', 'התור בוטל. תודה.'));
  } else {
    res.send(sayAndHangup('he-IL', 'בחירה לא תקינה.'));
  }
});

async function findNextAppointment(clientPhone: string): Promise<Appointment | null> {
  const snap = await db
    .collection('appointments')
    .where('clientPhone', '==', clientPhone)
    .where('status', 'in', ['confirmed', 'pending_deposit'])
    .orderBy('startsAt', 'asc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as Appointment;
}

async function bookNextAvailableSlot(branch: Branch, clientPhone: string): Promise<Appointment | null> {
  const staffSnap = await db.collection('staff').where('branchId', '==', branch.id).where('active', '==', true).get();
  const servicesSnap = await db.collection('services').where('branchId', '==', branch.id).limit(1).get();
  if (servicesSnap.empty) return null;
  const service = servicesSnap.docs[0].data() as Service;

  const now = Date.now();
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: branch.timezone }).format(now + dayOffset * 86400000);
    for (const staffDoc of staffSnap.docs) {
      const staff = staffDoc.data() as Staff;
      const apptsSnap = await db.collection('appointments').where('staffId', '==', staff.id).where('status', 'in', ['confirmed', 'pending_deposit']).get();
      const existing = apptsSnap.docs.map((d) => d.data() as Appointment).map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt }));
      const slots = getAvailableSlots(staff, service.durationMinutes, dateStr, existing, branch.timezone, now);
      if (slots.length > 0) {
        try {
          return await createAppointment({
            branch,
            staff,
            service,
            clientPhone,
            clientName: 'Cliente telefónico',
            startsAt: slots[0].startsAt,
            endsAt: slots[0].endsAt,
            source: 'phone',
          });
        } catch {
          continue; // otro proceso tomó el hueco justo antes; probar el siguiente
        }
      }
    }
  }
  return null;
}

function sayAndHangup(lang: string, text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="${lang}">${text}</Say><Hangup/></Response>`;
}

function normalizePhone(twilioFrom: string): string {
  return twilioFrom; // Twilio ya entrega el From en formato E.164
}
