import { collection, doc, getDocs, query, where, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Expense } from '../../shared/types';

const COL = 'expenses';

export async function getExpensesByBranch(branchId: string): Promise<Expense[]> {
  const snap = await getDocs(query(collection(db, COL), where('branchId', '==', branchId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function addExpense(data: Omit<Expense, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, COL), { ...data, createdAt: Date.now() });
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
