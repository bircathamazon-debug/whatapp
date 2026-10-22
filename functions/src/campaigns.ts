import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin';
import type { Appointment, Branch, Client, Staff } from './types';
import { sendNotification, getTemplates } from './notify';
import { getAvailableSlots } from './availability';
import { formatDate, formatTime } from './booking';
import { getIvrStrings } from './ivrStrings';
import { requireBranchAccess } from './access';

/**
 * Llamada desde la app de administración: "Hoy quedó libre un turno a las
 * 16:30" — busca huecos libres de HOY para la sucursal y los ofrece por
 * WhatsApp a los últimos clientes que visitaron esa sucursal.
 */
export const broadcastEmptySlots = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Solo el personal autenticado puede lanzar campañas.');

  const branchId = request.data?.branchId as string;
  if (!branchId) throw new HttpsError('invalid-argument', 'branchId es requerido.');
  await requireBranchAccess(request.auth, branchId);

  const branchSnap = await db.collection('branches').doc(branchId).get();
  if (!branchSnap.exists) throw new HttpsError('not-found', 'Sucursal no encontrada.');
  const branch = branchSnap.data() as Branch;

  const staffSnap = await db.collection('staff').where('branchId', '==', branchId).where('active', '==', true).get();
  const now = Date.now();
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: branch.timezone }).format(now);

  const dayStart = new Date(`${dateStr}T00:00:00Z`).getTime() - 12 * 3600000;
  const dayEnd = dayStart + 48 * 3600000;
  const apptsSnap = await db.collection('appointments').where('branchId', '==', branchId).where('startsAt', '>=', dayStart).where('startsAt', '<', dayEnd).get();
  const appts = apptsSnap.docs.map((d) => d.data() as Appointment).filter((a) => a.status === 'confirmed' || a.status === 'pending_deposit');

  const freeSlots: { startsAt: number; endsAt: number }[] = [];
  for (const staffDoc of staffSnap.docs) {
    const staff = staffDoc.data() as Staff;
    const existing = appts.filter((a) => a.staffId === staff.id).map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt }));
    freeSlots.push(...getAvailableSlots(staff, 30, dateStr, existing, branch.timezone, now));
  }

  if (freeSlots.length === 0) {
    const noSlotsMessage = { he: 'אין תורים פנויים היום.', en: 'No slots left today.', es: 'No quedan huecos libres hoy.' };
    return { sentTo: 0, message: noSlotsMessage[branch.language ?? 'he'] ?? noSlotsMessage.he };
  }

  const nextFree = freeSlots.sort((a, b) => a.startsAt - b.startsAt)[0];
  const text = getTemplates(branch.language).emptySlotCampaign(formatDate(nextFree.startsAt, branch.timezone), formatTime(nextFree.startsAt, branch.timezone));

  // Últimos 50 clientes de la sucursal (los más recurrentes primero).
  const clientsSnap = await db.collection('clients').where('branchId', '==', branchId).orderBy('createdAt', 'desc').limit(50).get();

  let sentTo = 0;
  for (const doc of clientsSnap.docs) {
    const client = doc.data() as Client;
    await sendNotification({ channel: 'whatsapp', to: client.phone, branch, template: 'emptySlotCampaign', text });
    sentTo++;
  }

  await db.collection('campaigns').add({
    branchId,
    type: 'empty_slot',
    message: text,
    sentTo,
    createdAt: now,
  });

  return { sentTo, message: text };
});

const WIN_BACK_DAYS = 30;

/** Último turno "venido de verdad" (completado) de un cliente, o null si
 * nunca tuvo uno. Reusa el índice `clientPhone + status + startsAt` que
 * ya existía para el historial del cliente en el panel. */
async function lastVisitOf(clientPhone: string): Promise<number | null> {
  const snap = await db
    .collection('appointments')
    .where('clientPhone', '==', clientPhone)
    .where('status', '==', 'completed')
    .orderBy('startsAt', 'desc')
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0].data() as Appointment).startsAt;
}

/**
 * Llamada desde la app: manda el mensaje de la campaña de "días flojos"
 * (el descuento configurado en `branch.weekdayDiscount`) a los clientes
 * que hace más de 30 días que no vienen (o que nunca vinieron) — para
 * eso sirve la campaña, traerlos de vuelta en un día flojo. El descuento
 * en sí ya se aplica solo al reservar (ver `priceForAppointment` en
 * booking.ts) — esto solo avisa, siempre por WhatsApp.
 */
export const broadcastWeekdayDiscount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Solo el personal autenticado puede lanzar campañas.');

  const branchId = request.data?.branchId as string;
  if (!branchId) throw new HttpsError('invalid-argument', 'branchId es requerido.');
  await requireBranchAccess(request.auth, branchId);

  const branchSnap = await db.collection('branches').doc(branchId).get();
  if (!branchSnap.exists) throw new HttpsError('not-found', 'Sucursal no encontrada.');
  const branch = branchSnap.data() as Branch;

  const discount = branch.weekdayDiscount;
  if (!discount?.enabled || discount.weekdays.length === 0) {
    throw new HttpsError('failed-precondition', 'La campaña de días flojos no está activada.');
  }

  const weekdayNames = getIvrStrings(branch.language).weekdays; // domingo=0..sábado=6
  const locale = { he: 'he-IL', en: 'en-US', es: 'es-ES' }[branch.language ?? 'he'] ?? 'he-IL';
  const daysLabel = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    discount.weekdays
      .slice()
      .sort((a, b) => a - b)
      .map((d) => weekdayNames[d])
  );

  const text = getTemplates(branch.language).weekdayDiscountCampaign(discount.percent, daysLabel);

  const clientsSnap = await db.collection('clients').where('branchId', '==', branchId).limit(500).get();
  const cutoff = Date.now() - WIN_BACK_DAYS * 86400000;

  let sentTo = 0;
  for (const doc of clientsSnap.docs) {
    const client = doc.data() as Client;
    const lastVisit = await lastVisitOf(client.phone);
    if (lastVisit !== null && lastVisit >= cutoff) continue; // vino hace menos de 30 días, no es a quien hay que traer de vuelta
    await sendNotification({ channel: 'whatsapp', to: client.phone, branch, template: 'weekdayDiscountCampaign', text });
    sentTo++;
  }

  await db.collection('campaigns').add({
    branchId,
    type: 'weekday_discount',
    message: text,
    sentTo,
    createdAt: Date.now(),
  });

  return { sentTo, message: text };
});
