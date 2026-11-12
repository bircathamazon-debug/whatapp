import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import type { Branch } from '../../shared/types';

const COL = 'branches';

/** Sucursales a las que puede entrar la cuenta logueada. El dueño del
 * sistema (isSuperAdmin) ve todas; una barbería cliente solo las suyas
 * (users/{uid}.branchIds) — las reglas de Firestore no le dejan listar la
 * colección entera, así que se leen una por una. */
export async function getBranches(): Promise<Branch[]> {
  const uid = auth.currentUser?.uid;
  const userSnap = uid ? await getDoc(doc(db, 'users', uid)) : null;
  if (!userSnap || userSnap.get('isSuperAdmin') === true) {
    const snap = await getDocs(collection(db, COL));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, 'id'>) }));
  }
  const ids = (userSnap.get('branchIds') as string[] | undefined) ?? [];
  const docs = await Promise.all(ids.map((id) => getDoc(doc(db, COL, id))));
  return docs.filter((d) => d.exists()).map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, 'id'>) }));
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
