import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import type { WaitlistEntry } from '../../shared/types';

const COL = 'waitlist';

export async function getActiveWaitlist(branchId: string): Promise<WaitlistEntry[]> {
  const snap = await getDocs(
    query(collection(db, COL), where('branchId', '==', branchId), where('status', 'in', ['waiting', 'offered']), orderBy('createdAt', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WaitlistEntry, 'id'>) }));
}
