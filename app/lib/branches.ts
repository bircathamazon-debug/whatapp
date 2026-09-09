import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Branch } from '../../shared/types';

const COL = 'branches';

export async function getBranches(): Promise<Branch[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, 'id'>) }));
}

export async function addBranch(data: Omit<Branch, 'id'>): Promise<void> {
  await addDoc(collection(db, COL), data);
}

export async function updateBranch(id: string, data: Partial<Omit<Branch, 'id'>>): Promise<void> {
  await updateDoc(doc(db, COL, id), data);
}

export async function deleteBranch(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
