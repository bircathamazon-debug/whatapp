import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import type { Client } from '../../shared/types';

const COL = 'clients';

export async function getClientsByBranch(branchId: string): Promise<Client[]> {
  const snap = await getDocs(query(collection(db, COL), where('branchId', '==', branchId), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) }));
}
