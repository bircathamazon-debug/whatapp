import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type { Appointment } from '../../shared/types';

const COL = 'appointments';

export async function getAppointmentsForDay(branchId: string, dayStartMs: number, dayEndMs: number): Promise<Appointment[]> {
  const snap = await getDocs(
    query(collection(db, COL), where('branchId', '==', branchId), where('startsAt', '>=', dayStartMs), where('startsAt', '<', dayEndMs), orderBy('startsAt', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) }));
}

export async function getAvailability(staffId: string, serviceId: string, dateStr: string): Promise<{ startsAt: number; endsAt: number }[]> {
  const fn = httpsCallable<{ staffId: string; serviceId: string; dateStr: string }, { slots: { startsAt: number; endsAt: number }[] }>(functions, 'getAvailability');
  const res = await fn({ staffId, serviceId, dateStr });
  return res.data.slots;
}

export async function adminCreateAppointment(payload: {
  branchId: string;
  staffId: string;
  serviceId: string;
  clientPhone: string;
  clientName: string;
  startsAt: number;
}): Promise<void> {
  const fn = httpsCallable(functions, 'adminCreateAppointment');
  await fn(payload);
}

export async function adminCancelAppointment(appointmentId: string): Promise<void> {
  const fn = httpsCallable(functions, 'adminCancelAppointment');
  await fn({ appointmentId });
}

export async function adminConfirmAppointment(appointmentId: string): Promise<void> {
  const fn = httpsCallable(functions, 'adminConfirmAppointment');
  await fn({ appointmentId });
}
