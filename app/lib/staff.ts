import { collection, doc, getDocs, query, where, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Staff } from '../../shared/types';

const COL = 'staff';

export async function getStaffByBranch(branchId: string): Promise<Staff[]> {
  const snap = await getDocs(query(collection(db, COL), where('branchId', '==', branchId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Staff, 'id'>) }));
}

export async function addStaff(data: Omit<Staff, 'id'>): Promise<void> {
  await addDoc(collection(db, COL), data);
}

export async function updateStaff(id: string, data: Partial<Omit<Staff, 'id'>>): Promise<void> {
  await updateDoc(doc(db, COL, id), data as Record<string, unknown>);
}

export async function deleteStaff(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

export function emptyWeeklyHours(): Staff['hours'] {
  return { 0: null, 1: { start: '09:00', end: '19:00' }, 2: { start: '09:00', end: '19:00' }, 3: { start: '09:00', end: '19:00' }, 4: { start: '09:00', end: '19:00' }, 5: { start: '09:00', end: '14:00' }, 6: null };
}
