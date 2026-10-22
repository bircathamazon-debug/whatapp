import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { db } from './admin';

/**
 * Las funciones "callable" (onCall) usan el SDK de administrador, que NO
 * pasa por firestore.rules — así que la separación de datos por sucursal
 * definida ahí (colección `users/{uid}`) no alcanza a protegerlas por sí
 * sola. Cada callable que lee o escribe datos de una sucursal tiene que
 * llamar esto explícitamente con el `branchId` real del recurso (antes de
 * tocar nada), para no dejar que una cuenta con acceso a una sucursal
 * actúe sobre los datos de otra.
 */
export async function requireBranchAccess(auth: CallableRequest['auth'], branchId: string): Promise<void> {
  if (!auth) throw new HttpsError('unauthenticated', 'Requiere sesión.');
  await requireBranchAccessByUid(auth.uid, branchId);
}

/** Misma verificación que `requireBranchAccess`, para endpoints `onRequest`
 * (no `onCall`) donde no hay un `request.auth` ya resuelto — el llamador
 * verifica el token de Firebase por su cuenta y pasa el `uid` resultante. */
export async function requireBranchAccessByUid(uid: string, branchId: string): Promise<void> {
  const userSnap = await db.collection('users').doc(uid).get();
  const data = userSnap.data() as { isSuperAdmin?: boolean; branchIds?: string[] } | undefined;
  if (data?.isSuperAdmin === true) return;
  if (data?.branchIds?.includes(branchId)) return;
  throw new HttpsError('permission-denied', 'No tenés acceso a esta sucursal.');
}
