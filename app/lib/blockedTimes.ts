import { collection, doc, getDocs, query, where, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { BlockedTime } from '../../shared/types';

const COL = 'blockedTimes';

export async function getBlockedTimesByBranch(branchId: string): Promise<BlockedTime[]> {
  const snap = await getDocs(query(collection(db, COL), where('branchId', '==', branchId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<BlockedTime, 'id'>) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function addBlockedTime(data: Omit<BlockedTime, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, COL), { ...data, createdAt: Date.now() });
}

export async function deleteBlockedTime(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
