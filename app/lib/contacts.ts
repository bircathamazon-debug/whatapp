import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Contact } from '../../shared/types';

const COL = 'contacts';

function toContact(id: string, data: Record<string, unknown>): Contact {
  return {
    id,
    name: data.name as string,
    phone: data.phone as string,
    category: data.category as string,
    zone: data.zone as string,
    review: data.review as string,
    recommendedBy: data.recommendedBy as string,
    approved: data.approved as boolean,
    createdAt: (data.createdAt as Timestamp).toDate(),
    updatedAt: (data.updatedAt as Timestamp).toDate(),
  };
}

/** All approved contacts, optionally filtered by category and/or zone */
export async function getContacts(opts?: {
  category?: string;
  zone?: string;
}): Promise<Contact[]> {
  let q = query(
    collection(db, COL),
    where('approved', '==', true),
    orderBy('createdAt', 'desc')
  );

  const snap = await getDocs(q);
  let contacts = snap.docs.map((d) => toContact(d.id, d.data()));

  if (opts?.category) {
    contacts = contacts.filter((c) => c.category === opts.category);
  }
  if (opts?.zone) {
    contacts = contacts.filter((c) => c.zone === opts.zone);
  }

  return contacts;
}

/** Full-text search across name, review, and recommendedBy */
export async function searchContacts(term: string): Promise<Contact[]> {
  const all = await getContacts();
  const t = term.toLowerCase();
  return all.filter(
    (c) =>
      c.name.toLowerCase().includes(t) ||
      c.review.toLowerCase().includes(t) ||
      c.recommendedBy.toLowerCase().includes(t) ||
      c.phone.includes(t)
  );
}

export async function getContact(id: string): Promise<Contact | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return toContact(snap.id, snap.data());
}

/** Admin: get all unapproved contacts */
export async function getPendingContacts(): Promise<Contact[]> {
  const q = query(
    collection(db, COL),
    where('approved', '==', false),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toContact(d.id, d.data()));
}

/** Admin: approve/update a contact */
export async function updateContact(
  id: string,
  data: Partial<Omit<Contact, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/** Admin: delete a contact */
export async function deleteContact(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

/** Admin: add a contact manually */
export async function addContact(
  data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}
