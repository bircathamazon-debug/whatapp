import { collection, doc, getDocs, query, where, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Service } from '../../shared/types';

const COL = 'services';

export async function getServicesByBranch(branchId: string): Promise<Service[]> {
  const snap = await getDocs(query(collection(db, COL), where('branchId', '==', branchId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) }));
}

export async function addService(data: Omit<Service, 'id'>): Promise<void> {
  await addDoc(collection(db, COL), data);
}

export async function updateService(id: string, data: Partial<Omit<Service, 'id'>>): Promise<void> {
  await updateDoc(doc(db, COL, id), data);
}

export async function deleteService(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
