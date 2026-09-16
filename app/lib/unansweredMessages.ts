import { collection, doc, getDocs, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { UnansweredMessage } from '../../shared/types';

const COL = 'unansweredMessages';

export async function getUnansweredByBranch(branchId: string): Promise<UnansweredMessage[]> {
  const snap = await getDocs(query(collection(db, COL), where('branchId', '==', branchId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<UnansweredMessage, 'id'>) }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function markMessageResolved(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { resolved: true });
}

export async function deleteUnansweredMessage(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
