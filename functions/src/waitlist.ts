import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db } from './admin';
import type { Appointment, Branch, Service, Staff, WaitlistEntry } from './types';
import { sendNotification, templates } from './notify';
import { createAppointment } from './booking';
import { formatDate, formatTime } from './booking';

const OFFER_WINDOW_MINUTES = 15;

/**
 * Cuando una cita pasa a 'cancelled', busca en la lista de espera a quien
 * la esperaba y le ofrece automáticamente el hueco liberado.
 */
export const onAppointmentCancelledOfferWaitlist = onDocumentUpdated('appointments/{appointmentId}', async (event) => {
  const before = event.data?.before.data() as Appointment | undefined;
  const after = event.data?.after.data() as Appointment | undefined;
  if (!before || !after) return;
  if (before.status === 'cancelled' || after.status !== 'cancelled') return;

  await offerSlotToWaitlist(after);
});

export async function offerSlotToWaitlist(freedAppointment: Appointment): Promise<void> {
  const dateStr = new Intl.DateTimeFormat('en-CA').format(freedAppointment.startsAt); // YYYY-MM-DD (UTC-ish, suficiente para filtrar por día)

  const candidatesSnap = await db
    .collection('waitlist')
    .where('status', '==', 'waiting')
    .where('serviceId', '==', freedAppointment.serviceId)
    .where('desiredDate', '==', dateStr)
    .orderBy('createdAt', 'asc')
    .limit(10)
    .get();

  const candidate = candidatesSnap.docs.find((d) => {
    const w = d.data() as WaitlistEntry;
    if (w.staffId && w.staffId !== freedAppointment.staffId) return false;
    if (!w.desiredWindow) return true;
    const startsAtStr = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
      freedAppointment.startsAt
    );
    return startsAtStr >= w.desiredWindow.start && startsAtStr <= w.desiredWindow.end;
  });

  if (!candidate) return;

  const branchSnap = await db.collection('branches').doc(freedAppointment.branchId).get();
  if (!branchSnap.exists) return;
  const branch = branchSnap.data() as Branch;

  const dateLabel = formatDate(freedAppointment.startsAt, branch.timezone);
  const timeLabel = formatTime(freedAppointment.startsAt, branch.timezone);

  await candidate.ref.update({
    status: 'offered',
    offeredAppointmentSlot: { startsAt: freedAppointment.startsAt, endsAt: freedAppointment.endsAt, staffId: freedAppointment.staffId },
    offerExpiresAt: Date.now() + OFFER_WINDOW_MINUTES * 60000,
  });

  const w = candidate.data() as WaitlistEntry;
  await sendNotification({
    channel: 'whatsapp',
    to: w.clientPhone,
    branch,
    template: 'waitlistOffer',
    text: templates.waitlistOffer(dateLabel, timeLabel, OFFER_WINDOW_MINUTES),
    awaitingReply: 'waitlist_offer',
    data: { waitlistId: candidate.id },
  });
}

/** Llamado por el bot cuando el cliente en lista de espera responde "1" (acepta). */
export async function acceptWaitlistOffer(waitlistId: string): Promise<Appointment | null> {
  const ref = db.collection('waitlist').doc(waitlistId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const w = snap.data() as WaitlistEntry;
  if (w.status !== 'offered' || !w.offeredAppointmentSlot) return null;
  if (w.offerExpiresAt && Date.now() > w.offerExpiresAt) {
    await ref.update({ status: 'expired' });
    return null;
  }

  const [branchSnap, serviceSnap, staffSnap] = await Promise.all([
    db.collection('branches').doc(w.branchId).get(),
    db.collection('services').doc(w.serviceId).get(),
    db.collection('staff').doc(w.offeredAppointmentSlot.staffId).get(),
  ]);
  if (!branchSnap.exists || !serviceSnap.exists || !staffSnap.exists) return null;
  const branch = branchSnap.data() as Branch;
  const service = serviceSnap.data() as Service;
  const staff = staffSnap.data() as Staff;

  try {
    const appt = await createAppointment({
      branch,
      staff,
      service,
      clientPhone: w.clientPhone,
      clientName: w.clientName,
      startsAt: w.offeredAppointmentSlot.startsAt,
      endsAt: w.offeredAppointmentSlot.endsAt,
      source: 'whatsapp',
    });
    await ref.update({ status: 'booked' });
    return appt;
  } catch {
    // alguien más tomó el hueco justo antes
    await ref.update({ status: 'expired' });
    return null;
  }
}

/** Cron: vence ofertas no respondidas y pasa al siguiente en la lista. */
export async function expireStaleWaitlistOffers(): Promise<number> {
  const now = Date.now();
  const snap = await db.collection('waitlist').where('status', '==', 'offered').where('offerExpiresAt', '<', now).limit(50).get();

  let expired = 0;
  for (const doc of snap.docs) {
    const w = doc.data() as WaitlistEntry;
    await doc.ref.update({ status: 'expired' });
    expired++;
    if (w.offeredAppointmentSlot) {
      await offerSlotToWaitlist({
        ...w,
        id: '',
        clientId: '',
        status: 'confirmed',
        source: 'admin',
        recurringBookingId: null,
        remindersSent: [],
        confirmedAt: null,
        depositPaid: false,
        googleCalendarEventId: null,
        createdAt: 0,
        updatedAt: 0,
        staffId: w.offeredAppointmentSlot.staffId,
        startsAt: w.offeredAppointmentSlot.startsAt,
        endsAt: w.offeredAppointmentSlot.endsAt,
      } as Appointment);
    }
  }
  return expired;
}
