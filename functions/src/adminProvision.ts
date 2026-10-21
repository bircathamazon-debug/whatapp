import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { db } from './admin';

/**
 * Endpoints de alta de cuentas/negocios, usados solo manualmente (por fuera
 * de la app, con una herramienta aparte) cuando se incorpora una peluquería
 * nueva al sistema. Protegidos con un secreto compartido como botApi.ts,
 * porque quien los llama no es ni el bot ni un usuario de la app.
 */
function checkSecret(req: any): boolean {
  const expected = process.env.ADMIN_SHARED_SECRET;
  if (!expected) return false;
  return req.get('x-admin-secret') === expected;
}

/** Busca el UID de una cuenta de Firebase Auth ya existente por su mail. */
export const adminLookupUserByEmail = onRequest(async (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { email } = req.body as { email: string };
  try {
    const user = await getAuth().getUserByEmail(email);
    res.json({ uid: user.uid });
  } catch {
    res.status(404).json({ error: 'not_found' });
  }
});

/** Crea una cuenta de Firebase Auth nueva (mail + contraseña) para un peluquero. */
export const adminCreateAuthUser = onRequest(async (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { email, password } = req.body as { email: string; password: string };
  const user = await getAuth().createUser({ email, password });
  res.json({ uid: user.uid });
});

/**
 * Define a qué sucursal(es) puede entrar una cuenta (`branchIds`), o si es
 * administrador general (`isSuperAdmin`, ve todas). Lo leen las reglas de
 * Firestore (`firestore.rules`) para separar los datos entre negocios.
 */
export const adminSetUserAccess = onRequest(async (req, res) => {
  if (!checkSecret(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { uid, isSuperAdmin, branchIds } = req.body as { uid: string; isSuperAdmin?: boolean; branchIds?: string[] };
  const data: Record<string, unknown> = {};
  if (isSuperAdmin !== undefined) data.isSuperAdmin = isSuperAdmin;
  if (branchIds !== undefined) data.branchIds = branchIds;
  await db.collection('users').doc(uid).set(data, { merge: true });
  res.json({ ok: true });
});
