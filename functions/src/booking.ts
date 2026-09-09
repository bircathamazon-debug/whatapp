import { db } from './admin';
import type { Appointment, Branch, Client, Service, Staff } from './types';
import { NO_SHOW_DEPOSIT_THRESHOLD } from './types';
import { sendNotification, templates } from './notify';
import { syncAppointmentToGoogleCalendar, removeAppointmentFromGoogleCalendar } from './googleCalendar';

export class SlotTakenError extends Error {
  constructor() {
    super('El horario ya no está disponible.');
  }
}

const DEPOSIT_HOLD_MINUTES = 30;

export interface CreateAppointmentInput {
  branch: Branch;
  staff: Staff;
  service: Service;
  clientPhone: string;
  clientName: string;
  startsAt: number;
  endsAt: number;
  source: Appointment['source'];
  recurringBookingId?: string | null;
}

/**
 * Crea una cita de forma atómica: dentro de una transacción de Firestore
 * vuelve a comprobar que no haya solapamiento para ese peluquero antes de
 * escribir, así una reserva por WhatsApp y otra por teléfono que lleguen
 * al mismo tiempo nunca generan doble cita.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const client = await getOrCreateClient(input.branch.id, input.clientPhone, input.clientName);

  const needsDeposit = input.service.requiresDeposit || client.blockedForDeposit;
  const apptRef = db.collection('appointments').doc();

  const appointment = await db.runTransaction(async (tx) => {
    const overlapSnap = await tx.get(
      db
        .collection('appointments')
        .where('staffId', '==', input.staff.id)
        .where('status', 'in', ['confirmed', 'pending_deposit'])
        .where('startsAt', '<', input.endsAt)
    );
    const overlaps = overlapSnap.docs.some((d) => {
      const a = d.data() as Appointment;
      return a.endsAt > input.startsAt;
    });
    if (overlaps) throw new SlotTakenError();

    const now = Date.now();
    const appt: Appointment = {
      id: apptRef.id,
      branchId: input.branch.id,
      staffId: input.staff.id,
      serviceId: input.service.id,
      clientId: client.id,
      clientPhone: client.phone,
      clientName: client.name,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: needsDeposit ? 'pending_deposit' : 'confirmed',
      source: input.source,
      recurringBookingId: input.recurringBookingId ?? null,
      remindersSent: [],
      confirmedAt: needsDeposit ? null : Date.now(),
      depositPaid: false,
      googleCalendarEventId: null,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(apptRef, appt);
    return appt;
  });

  const dateStr = formatDate(appointment.startsAt, input.branch.timezone);
  const timeStr = formatTime(appointment.startsAt, input.branch.timezone);

  if (appointment.status === 'pending_deposit') {
    await sendNotification({
      channel: client.preferredChannel,
      to: client.phone,
      branch: input.branch,
      template: 'depositRequired',
      text: templates.depositRequired(input.service.depositAmount),
    });
  } else {
    await sendNotification({
      channel: client.preferredChannel,
      to: client.phone,
      branch: input.branch,
      template: 'bookingConfirmed',
      text: templates.bookingConfirmed(client.name, dateStr, timeStr, input.service.name, input.staff.name),
      relatedAppointmentId: appointment.id,
    });
    await sendNotification({
      channel: 'whatsapp',
      to: input.staff.phone,
      branch: input.branch,
      template: 'staffNewBooking',
      text: templates.staffNewBooking(client.name, dateStr, timeStr, input.service.name),
      relatedAppointmentId: appointment.id,
      respectShabbatSilence: true,
    });
    await syncAppointmentToGoogleCalendar(appointment, input.staff, input.service).catch((err) =>
      console.error('[booking] google calendar sync failed', err)
    );
  }

  return appointment;
}

export async function confirmAppointment(appointmentId: string): Promise<void> {
  const ref = db.collection('appointments').doc(appointmentId);
  await ref.update({ status: 'confirmed', confirmedAt: Date.now(), updatedAt: Date.now() });
}

export async function cancelAppointment(appointmentId: string, cancelledBy: 'client' | 'staff' | 'system'): Promise<void> {
  const ref = db.collection('appointments').doc(appointmentId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const appt = snap.data() as Appointment;
  if (appt.status === 'cancelled') return;

  await ref.update({ status: 'cancelled', updatedAt: Date.now() });

  if (appt.googleCalendarEventId) {
    await removeAppointmentFromGoogleCalendar(appt).catch((err) =>
      console.error('[booking] google calendar remove failed', err)
    );
  }

  if (cancelledBy === 'client') {
    const branchSnap = await db.collection('branches').doc(appt.branchId).get();
    const staffSnap = await db.collection('staff').doc(appt.staffId).get();
    if (branchSnap.exists && staffSnap.exists) {
      const branch = branchSnap.data() as Branch;
      const staff = staffSnap.data() as Staff;
      const dateStr = formatDate(appt.startsAt, branch.timezone);
      const timeStr = formatTime(appt.startsAt, branch.timezone);
      await sendNotification({
        channel: 'whatsapp',
        to: staff.phone,
        branch,
        template: 'cancelledByClient',
        text: templates.cancelledByClient(appt.clientName, dateStr, timeStr),
        respectShabbatSilence: true,
      });
    }
  }

  // El disparador de waitlist (waitlist.ts, Firestore trigger onUpdate) se
  // encarga de ofrecer el hueco liberado automáticamente.
}

export async function markNoShow(appointmentId: string): Promise<void> {
  const ref = db.collection('appointments').doc(appointmentId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const appt = snap.data() as Appointment;
  if (appt.status === 'no_show' || appt.status === 'cancelled' || appt.status === 'completed') return;

  await ref.update({ status: 'no_show', updatedAt: Date.now() });

  const clientRef = db.collection('clients').doc(appt.clientId);
  await db.runTransaction(async (tx) => {
    const clientSnap = await tx.get(clientRef);
    if (!clientSnap.exists) return;
    const client = clientSnap.data() as Client;
    const noShowCount = (client.noShowCount ?? 0) + 1;
    tx.update(clientRef, {
      noShowCount,
      blockedForDeposit: noShowCount >= NO_SHOW_DEPOSIT_THRESHOLD,
    });
  });
}

export async function markCompleted(appointmentId: string): Promise<void> {
  const ref = db.collection('appointments').doc(appointmentId);
  await ref.update({ status: 'completed', updatedAt: Date.now() });
}

/** Libera reservas pending_deposit vencidas (más de DEPOSIT_HOLD_MINUTES sin pagar). */
export async function releaseExpiredDepositHolds(): Promise<number> {
  const cutoff = Date.now() - DEPOSIT_HOLD_MINUTES * 60000;
  const snap = await db
    .collection('appointments')
    .where('status', '==', 'pending_deposit')
    .where('createdAt', '<', cutoff)
    .limit(100)
    .get();
  for (const doc of snap.docs) {
    await doc.ref.update({ status: 'cancelled', updatedAt: Date.now() });
  }
  return snap.size;
}

async function getOrCreateClient(branchId: string, phone: string, name: string): Promise<Client> {
  const existing = await db.collection('clients').where('branchId', '==', branchId).where('phone', '==', phone).limit(1).get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    return { id: doc.id, ...(doc.data() as Omit<Client, 'id'>) };
  }
  const ref = db.collection('clients').doc();
  const client: Client = {
    id: ref.id,
    phone,
    name,
    branchId,
    noShowCount: 0,
    completedCount: 0,
    preferredChannel: 'whatsapp',
    blockedForDeposit: false,
    createdAt: Date.now(),
  };
  await ref.set(client);
  return client;
}

export function formatDate(epochMs: number, timezone: string): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(epochMs);
}

export function formatTime(epochMs: number, timezone: string): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(epochMs);
}
