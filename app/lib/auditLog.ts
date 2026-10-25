import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { AuditLogEntry } from '../../shared/types';

const COL = 'auditLog';

export async function getAuditLog(branchId: string): Promise<AuditLogEntry[]> {
  const snap = await getDocs(query(collection(db, COL), where('branchId', '==', branchId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogEntry, 'id'>) }))
    .sort((a, b) => b.createdAt - a.createdAt);
}
