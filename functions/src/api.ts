import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin';
import type { Appointment, Branch, Service, Staff } from './types';
import { getAvailableSlots } from './availability';
import { createAppointment, cancelAppointment, confirmAppointment } from './booking';

/** Callable: huecos libres de un peluquero en un día dado (usado por bot e IVR vía import directo, y por la app admin vía HTTPS). */
export const getAvailability = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Requiere sesión.');
  const { staffId, serviceId, dateStr } = request.data as { staffId: string; serviceId: string; dateStr: string };

  const [staffSnap, serviceSnap] = await Promise.all([
    db.collection('staff').doc(staffId).get(),
    db.collection('services').doc(serviceId).get(),
  ]);
  if (!staffSnap.exists || !serviceSnap.exists) throw new HttpsError('not-found', 'Peluquero o servicio no encontrado.');
  const staff = staffSnap.data() as Staff;
  const service = serviceSnap.data() as Service;

  const branchSnap = await db.collection('branches').doc(staff.branchId).get();
  const branch = branchSnap.data() as Branch;

  const apptsSnap = await db.collection('appointments').where('staffId', '==', staffId).where('status', 'in', ['confirmed', 'pending_deposit']).get();
  const existing = apptsSnap.docs.map((d) => d.data() as Appointment).map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt }));

  return { slots: getAvailableSlots(staff, service.durationMinutes, dateStr, existing, branch.timezone, Date.now()) };
});

/** Callable: la app admin crea una cita manualmente (walk-in, teléfono anotado a mano, etc). */
export const adminCreateAppointment = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Requiere sesión.');
  const { branchId, staffId, serviceId, clientPhone, clientName, startsAt } = request.data as {
    branchId: string;
    staffId: string;
    serviceId: string;
    clientPhone: string;
    clientName: string;
    startsAt: number;
  };

  const [branchSnap, staffSnap, serviceSnap] = await Promise.all([
    db.collection('branches').doc(branchId).get(),
    db.collection('staff').doc(staffId).get(),
    db.collection('services').doc(serviceId).get(),
  ]);
  if (!branchSnap.exists || !staffSnap.exists || !serviceSnap.exists) {
    throw new HttpsError('not-found', 'Sucursal, peluquero o servicio no encontrado.');
  }
  const branch = branchSnap.data() as Branch;
  const staff = staffSnap.data() as Staff;
  const service = serviceSnap.data() as Service;

  try {
    const appt = await createAppointment({
      branch,
      staff,
      service,
      clientPhone,
      clientName,
      startsAt,
      endsAt: startsAt + service.durationMinutes * 60000,
      source: 'admin',
    });
    return { appointment: appt };
  } catch (err: any) {
    throw new HttpsError('already-exists', err.message ?? 'El horario ya no está disponible.');
  }
});

export const adminCancelAppointment = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Requiere sesión.');
  const { appointmentId } = request.data as { appointmentId: string };
  await cancelAppointment(appointmentId, 'staff');
  return { ok: true };
});

export const adminConfirmAppointment = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Requiere sesión.');
  const { appointmentId } = request.data as { appointmentId: string };
  await confirmAppointment(appointmentId);
  return { ok: true };
});
