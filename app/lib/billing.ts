import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, doc, getDoc, getDocs, query, where, orderBy, setDoc, updateDoc } from 'firebase/firestore';
import { db, functions, auth } from './firebase';
import type { ChangeRequest } from '../../shared/types';

export interface BillingStatus {
  plan: 'basic' | 'pro';
  limit: number | null;
  used: number;
  prices: { basic: number; pro: number };
  basicLimit: number | null;
  trialEndsAt: number | null;
  blocked: boolean;
  blockedReason: 'unpaid' | 'manual' | null;
  subscriptionStatus: 'none' | 'active' | 'past_due' | 'canceled';
  nextChargeAt: number | null;
  lastChargeAmount: number | null;
}

export async function getBillingStatus(branchId: string): Promise<BillingStatus> {
  const fn = httpsCallable<{ branchId: string }, BillingStatus>(functions, 'billingStatus');
  return (await fn({ branchId })).data;
}

export async function setBillingPlan(branchId: string, plan: 'basic' | 'pro'): Promise<void> {
  await httpsCallable(functions, 'billingSetPlan')({ branchId, plan });
}

// --- Panel del dueño ---

export async function ownerUpdateBilling(branchId: string, data: { blocked?: boolean; plan?: 'basic' | 'pro'; extendTrialDays?: number }): Promise<void> {
  await httpsCallable(functions, 'ownerUpdateBilling')({ branchId, ...data });
}

export async function ownerCreateBarbershop(data: { name: string; email: string; password: string; phone?: string; language?: 'he' | 'en' | 'es' }): Promise<{ branchId: string }> {
  const fn = httpsCallable<typeof data, { branchId: string; uid: string }>(functions, 'ownerCreateBarbershop');
  return (await fn(data)).data;
}

export async function getAccountNotes(branchId: string): Promise<string> {
  const snap = await getDoc(doc(db, 'accountNotes', branchId));
  return (snap.get('notes') as string | undefined) ?? '';
}

export async function saveAccountNotes(branchId: string, notes: string): Promise<void> {
  await setDoc(doc(db, 'accountNotes', branchId), { notes, updatedAt: Date.now() }, { merge: true });
}

// --- Pedidos de cambio ---

export async function getChangeRequests(branchId: string): Promise<ChangeRequest[]> {
  const q = query(collection(db, 'changeRequests'), where('branchId', '==', branchId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChangeRequest, 'id'>) }));
}

export async function getOpenChangeRequests(): Promise<ChangeRequest[]> {
  const q = query(collection(db, 'changeRequests'), where('status', '==', 'open'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChangeRequest, 'id'>) }));
}

export async function createChangeRequest(branchId: string, text: string): Promise<void> {
  await addDoc(collection(db, 'changeRequests'), {
    branchId,
    text: text.trim(),
    createdAt: Date.now(),
    createdByEmail: auth.currentUser?.email ?? null,
    status: 'open',
    reply: null,
    doneAt: null,
  });
}

export async function resolveChangeRequest(id: string, reply: string): Promise<void> {
  await updateDoc(doc(db, 'changeRequests', id), { status: 'done', reply: reply.trim() || null, doneAt: Date.now() });
}
