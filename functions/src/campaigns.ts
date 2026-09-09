import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin';
import type { Appointment, Branch, Client, Staff } from './types';
import { sendNotification, templates } from './notify';
import { getAvailableSlots } from './availability';
import { formatDate, formatTime } from './booking';

/**
 * Llamada desde la app de administración: "Hoy quedó libre un turno a las
 * 16:30" — busca huecos libres de HOY para la sucursal y los ofrece por
 * WhatsApp a los últimos clientes que visitaron esa sucursal.
 */
export const broadcastEmptySlots = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Solo el personal autenticado puede lanzar campañas.');

  const branchId = request.data?.branchId as string;
  if (!branchId) throw new HttpsError('invalid-argument', 'branchId es requerido.');

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
    return { sentTo: 0, message: 'No quedan huecos libres hoy.' };
  }

  const nextFree = freeSlots.sort((a, b) => a.startsAt - b.startsAt)[0];
  const text = templates.emptySlotCampaign(formatDate(nextFree.startsAt, branch.timezone), formatTime(nextFree.startsAt, branch.timezone));

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
