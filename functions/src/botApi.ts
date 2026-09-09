import { onRequest } from 'firebase-functions/v2/https';
import { db } from './admin';
import type { Branch, Service, Staff } from './types';
import { getAvailableSlots } from './availability';
import { createAppointment, cancelAppointment, confirmAppointment, SlotTakenError } from './booking';
import { acceptWaitlistOffer } from './waitlist';

/**
 * Endpoints internos usados por el bot de WhatsApp (proceso Node con Baileys,
 * no es un usuario de Firebase Auth). Protegidos con un secreto compartido
 * en vez de Firebase Auth porque el bot corre fuera de la app cliente.
 * Toda la lógica de negocio (transacciones anti-doble-reserva, envío de
 * notificaciones, sincronización con Google Calendar, fidelidad, etc.) vive
 * en booking.ts/waitlist.ts — este archivo es solo la puerta de entrada.
 */
function checkSecret(req: any): boolean {
  const expected = process.env.BOT_SHARED_SECRET;
  if (!expected) return false;
  return req.get('x-bot-secret') === expected;
}

export const botGetAvailability = onRequest(async (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { staffId, serviceId, dateStr } = req.body as { staffId: string; serviceId: string; dateStr: string };
  const [staffSnap, serviceSnap] = await Promise.all([
    db.collection('staff').doc(staffId).get(),
    db.collection('services').doc(serviceId).get(),
  ]);
  if (!staffSnap.exists || !serviceSnap.exists) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const staff = staffSnap.data() as Staff;
  const service = serviceSnap.data() as Service;
  const branchSnap = await db.collection('branches').doc(staff.branchId).get();
  const branch = branchSnap.data() as Branch;

  const apptsSnap = await db
    .collection('appointments')
    .where('staffId', '==', staffId)
    .where('status', 'in', ['confirmed', 'pending_deposit'])
    .get();
  const existing = apptsSnap.docs.map((d) => ({ startsAt: d.data().startsAt, endsAt: d.data().endsAt }));

  const slots = getAvailableSlots(staff, service.durationMinutes, dateStr, existing, branch.timezone, Date.now());
  res.json({ slots });
});

export const botCreateAppointment = onRequest(async (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { branchId, staffId, serviceId, clientPhone, clientName, startsAt, source } = req.body as {
    branchId: string;
    staffId: string;
    serviceId: string;
    clientPhone: string;
    clientName: string;
    startsAt: number;
    source: 'whatsapp' | 'phone';
  };

  try {
    const [branchSnap, staffSnap, serviceSnap] = await Promise.all([
      db.collection('branches').doc(branchId).get(),
      db.collection('staff').doc(staffId).get(),
      db.collection('services').doc(serviceId).get(),
    ]);
    if (!branchSnap.exists || !staffSnap.exists || !serviceSnap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const branch = branchSnap.data() as Branch;
    const staff = staffSnap.data() as Staff;
    const service = serviceSnap.data() as Service;

    const appt = await createAppointment({
      branch,
      staff,
      service,
      clientPhone,
      clientName,
      startsAt,
      endsAt: startsAt + service.durationMinutes * 60000,
      source: source ?? 'whatsapp',
    });
    res.json({ appointment: appt });
  } catch (err) {
    if (err instanceof SlotTakenError) {
      res.status(409).json({ error: 'slot_taken' });
      return;
    }
    console.error('[botApi] createAppointment error', err);
    res.status(500).json({ error: 'internal' });
  }
});

export const botCancelAppointment = onRequest(async (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { appointmentId } = req.body as { appointmentId: string };
  await cancelAppointment(appointmentId, 'client');
  res.json({ ok: true });
});

export const botConfirmAppointment = onRequest(async (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { appointmentId } = req.body as { appointmentId: string };
  await confirmAppointment(appointmentId);
  res.json({ ok: true });
});

export const botAcceptWaitlistOffer = onRequest(async (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { waitlistId } = req.body as { waitlistId: string };
  const appt = await acceptWaitlistOffer(waitlistId);
  if (!appt) {
    res.status(409).json({ error: 'offer_unavailable' });
    return;
  }
  res.json({ appointment: appt });
});

export const botAddToWaitlist = onRequest(async (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { branchId, staffId, serviceId, clientId, clientPhone, clientName, desiredDate, desiredWindow } = req.body as Record<string, any>;
  const ref = db.collection('waitlist').doc();
  await ref.set({
    id: ref.id,
    branchId,
    staffId: staffId ?? null,
    serviceId,
    clientId: clientId ?? '',
    clientPhone,
    clientName,
    desiredDate,
    desiredWindow: desiredWindow ?? null,
    status: 'waiting',
    offeredAppointmentSlot: null,
    offerExpiresAt: null,
    createdAt: Date.now(),
  });
  res.json({ ok: true, waitlistId: ref.id });
});

export const botCreateRecurringBooking = onRequest(async (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { branchId, staffId, serviceId, clientPhone, clientName, dayOfWeek, time } = req.body as Record<string, any>;
  const ref = db.collection('recurringBookings').doc();
  await ref.set({
    id: ref.id,
    branchId,
    staffId,
    serviceId,
    clientPhone,
    clientName,
    dayOfWeek,
    time,
    active: true,
    nextGeneratedThrough: 0,
    createdAt: Date.now(),
  });
  res.json({ ok: true, recurringBookingId: ref.id });
});
