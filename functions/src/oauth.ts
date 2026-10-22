import { onRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { createHmac, timingSafeEqual } from 'crypto';
import { getGoogleAuthUrl, handleGoogleOAuthCallback } from './googleCalendar';
import { db } from './admin';
import { requireBranchAccessByUid } from './access';

/**
 * Este endpoint se abre con un link directo del navegador (Linking.openURL
 * en la app), no con el SDK de Firebase, así que no llega con el token de
 * sesión puesto solo — por eso `googleCalendarConnect` lo recibe como
 * parámetro (`idToken`, el `getIdToken()` del usuario ya logueado en el
 * panel) y lo verifica acá mismo. Sin esto, cualquiera que supiera el
 * `staffId` de un peluquero (sin ninguna sesión) podía conectar SU PROPIA
 * cuenta de Google al calendario de otro peluquero — hallazgo real de la
 * revisión de seguridad de hoy, antes de abrir el sistema a negocios
 * externos.
 *
 * El `state` que viaja a través de Google también va firmado (HMAC), para
 * que no sirva armar a mano un `googleCalendarCallback?code=...&state=<otro
 * staffId>` con un `code` propio conseguido de forma legítima para otro
 * peluquero — sin la firma, el callback lo rechaza.
 */
function signState(staffId: string): string {
  const secret = process.env.ADMIN_SHARED_SECRET || '';
  return createHmac('sha256', secret).update(staffId).digest('hex');
}

function verifyState(state: string): string | null {
  const sepIndex = state.lastIndexOf('.');
  if (sepIndex === -1) return null;
  const staffId = state.slice(0, sepIndex);
  const signature = state.slice(sepIndex + 1);
  const expected = signState(staffId);
  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
  return staffId;
}

/** GET /googleCalendarConnect?staffId=...&idToken=... — redirige al peluquero a Google para autorizar. */
export const googleCalendarConnect = onRequest(async (req, res) => {
  const staffId = String(req.query.staffId ?? '');
  const idToken = String(req.query.idToken ?? '');
  if (!staffId || !idToken) {
    res.status(400).send('Falta staffId o idToken');
    return;
  }

  let uid: string;
  try {
    uid = (await getAuth().verifyIdToken(idToken)).uid;
  } catch {
    res.status(401).send('Sesión inválida o vencida. Volvé a entrar al panel e intentá de nuevo.');
    return;
  }

  const staffSnap = await db.collection('staff').doc(staffId).get();
  if (!staffSnap.exists) {
    res.status(404).send('Peluquero no encontrado.');
    return;
  }
  try {
    await requireBranchAccessByUid(uid, (staffSnap.data() as { branchId: string }).branchId);
  } catch {
    res.status(403).send('No tenés acceso a este peluquero.');
    return;
  }

  const url = getGoogleAuthUrl(`${staffId}.${signState(staffId)}`);
  if (!url) {
    res.status(500).send('Google Calendar no está configurado (faltan credenciales OAuth).');
    return;
  }
  res.redirect(url);
});

/** Callback de Google OAuth: guarda el token del peluquero. */
export const googleCalendarCallback = onRequest(async (req, res) => {
  const code = String(req.query.code ?? '');
  const state = String(req.query.state ?? '');
  if (!code || !state) {
    res.status(400).send('Falta code o state');
    return;
  }
  const staffId = verifyState(state);
  if (!staffId) {
    res.status(400).send('Solicitud inválida.');
    return;
  }
  try {
    await handleGoogleOAuthCallback(staffId, code);
    res.send('Google Calendar conectado correctamente. Ya puedes cerrar esta ventana.');
  } catch (err) {
    console.error('[oauth] error', err);
    res.status(500).send('Error conectando Google Calendar.');
  }
});
