import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from './admin';
import type { Branch } from './types';
import { requireBranchAccess } from './access';
import { logAudit } from './audit';

/**
 * Suscripción de pago del sistema vía Tranzila — la pasarela israelí que
 * usamos en vez de Stripe para las sucursales en hebreo, porque Stripe no
 * está disponible en Israel (confirmado en stripe.com/global).
 *
 * Cómo funciona (a diferencia de Stripe, que gestiona el calendario de
 * cobros solo): Tranzila no tiene una "suscripción" nativa en la cuenta
 * base (eso es un módulo pago aparte, "My Billing"). En su lugar:
 *   1. El peluquero paga la primera vez en la página alojada por Tranzila
 *      (iframenew.php) — ahí mismo se valida la tarjeta y se genera un
 *      token (TranzilaTK) que representa esa tarjeta sin guardar el
 *      número real.
 *   2. Tranzila nos avisa del resultado en `tranzilaNotify` (parecido a un
 *      webhook) y guardamos el token en `branch.subscription`.
 *   3. Todos los meses, nuestro propio cron (`chargeTranzilaSubscriptions`
 *      en crons.ts) cobra ese token de nuevo llamando directamente al
 *      endpoint clásico de cobro por token — así armamos nosotros mismos
 *      el "cobro recurrente" en vez de depender de un módulo pago extra.
 *
 * OJO: esta integración se armó a partir de la documentación pública de
 * Tranzila (algunas páginas de su documentación oficial no estaban
 * indexadas al momento de escribir esto) — antes de usarla con clientes
 * reales, hay que probarla primero con el terminal de pruebas (sandbox)
 * que Tranzila da al crear la cuenta.
 */

const TOKEN_CHARGE_URL = 'https://secure5.tranzila.com/cgi-bin/tranzila31tk.cgi';

/**
 * `tranzilaNotify` no tenía ninguna verificación de que el pedido viniera
 * de verdad de Tranzila — hallazgo crítico de la revisión de seguridad:
 * cualquiera que supiera (o adivinara) un `branchId` podía mandar
 * `POST /tranzilaNotify?branchId=X` con `Response=000` a mano y activar una
 * suscripción paga gratis para esa sucursal, saltándose por completo el
 * bloqueo de `firestore.rules` que deja "subscription" solo en manos del
 * SDK de administrador (esta función corre justo con ese SDK). Mismo
 * patrón ya usado en oauth.ts: se agrega un token firmado (HMAC) al link de
 * notificación que le damos a Tranzila, y se verifica acá antes de tocar
 * la base de datos — sin el token correcto, no pasa nada.
 */
function signNotifyToken(branchId: string): string {
  const secret = process.env.ADMIN_SHARED_SECRET;
  if (!secret) throw new Error('Falta ADMIN_SHARED_SECRET');
  return createHmac('sha256', secret).update(branchId).digest('hex');
}

function verifyNotifyToken(branchId: string, token: string): boolean {
  let expected: string;
  try {
    expected = signNotifyToken(branchId);
  } catch {
    return false;
  }
  const tokenBuf = Buffer.from(token, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  return tokenBuf.length === expectedBuf.length && timingSafeEqual(tokenBuf, expectedBuf);
}

function getConfig() {
  const terminal = process.env.TRANZILA_TERMINAL_NAME;
  const password = process.env.TRANZILA_PASSWORD;
  const sum = process.env.TRANZILA_SUBSCRIPTION_SUM;
  const baseUrl = process.env.FUNCTIONS_BASE_URL;
  if (!terminal || !password || !sum || !baseUrl) return null;
  return { terminal, password, sum, baseUrl };
}

/** Callable: arma la URL de la página de pago alojada por Tranzila para suscribirse. */
export const tranzilaCreateCheckoutUrl = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Requiere sesión.');
  const { branchId } = request.data as { branchId: string };
  const config = getConfig();
  if (!config) throw new HttpsError('failed-precondition', 'Los pagos todavía no están configurados.');
  await requireBranchAccess(request.auth, branchId);

  const branchSnap = await db.collection('branches').doc(branchId).get();
  if (!branchSnap.exists) throw new HttpsError('not-found', 'Sucursal no encontrada.');
  const branch = { id: branchSnap.id, ...(branchSnap.data() as Omit<Branch, 'id'>) };

  const notifyToken = signNotifyToken(branchId);
  const notifyUrl = `${config.baseUrl}/tranzilaNotify?branchId=${encodeURIComponent(branchId)}&token=${notifyToken}`;
  const doneUrl = `${config.baseUrl}/tranzilaCheckoutDone`;

  const params = new URLSearchParams({
    sum: config.sum,
    currency: '1', // 1 = ILS
    tranmode: 'V', // verifica la tarjeta, cobra y genera un token en un solo paso
    cred_type: '1', // pago único (no cuotas)
    contact: branch.name,
    email: '',
    success_url_address: doneUrl,
    fail_url_address: doneUrl,
    notify_url_address: notifyUrl,
  });

  const url = `https://directng.tranzila.com/${config.terminal}/iframenew.php?${params.toString()}`;
  return { url };
});

/** Callable: cancela la suscripción de Tranzila (para el próximo cron, deja de cobrarse). */
export const tranzilaCancelSubscription = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Requiere sesión.');
  const { branchId } = request.data as { branchId: string };
  await requireBranchAccess(request.auth, branchId);
  await db.collection('branches').doc(branchId).update({ 'subscription.status': 'canceled' });
  await logAudit(request.auth.uid, branchId, 'subscription_cancelled');
  return { ok: true };
});

/** Página simple que ve el peluquero al volver de la página de pago de Tranzila. */
export const tranzilaCheckoutDone = onRequest((req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(
    '<html><body style="font-family: sans-serif; text-align: center; padding: 60px 20px;"><h2>¡Listo!</h2><p>Ya podés cerrar esta ventana y volver a la app.</p></body></html>'
  );
});

/** Callback de Tranzila con el resultado del pago (equivalente a un webhook). */
export const tranzilaNotify = onRequest(async (req, res) => {
  const branchId = String(req.query.branchId ?? '');
  const token = String(req.query.token ?? '');
  if (!branchId || !token || !verifyNotifyToken(branchId, token)) {
    res.status(401).send('Token inválido');
    return;
  }

  const body = req.body as Record<string, string>;
  const success = body?.Response === '000';

  if (branchId && success) {
    const nextMonth = Date.now() + 30 * 24 * 3600000;
    await db
      .collection('branches')
      .doc(branchId)
      .update({
        'subscription.provider': 'tranzila',
        'subscription.status': 'active',
        'subscription.tranzilaToken': body.TranzilaTK ?? null,
        'subscription.tranzilaExpDate': body.expdate ?? null,
        'subscription.currentPeriodEnd': nextMonth,
      });
  } else if (branchId) {
    // No se loguea el body completo: TranzilaTK es un token de tarjeta
    // (no el número real, pero igual es un dato sensible que no debería
    // quedar en los logs de Cloud Logging).
    console.error('[tranzila] notify con error', { Response: body?.Response, Error: body?.Error });
  }

  res.status(200).send('OK');
});

/**
 * Cobra el token guardado de una sucursal (usado por el cron mensual en
 * crons.ts). Devuelve true si el cobro fue exitoso.
 */
export async function chargeTranzilaToken(branch: Branch): Promise<boolean> {
  const config = getConfig();
  const token = branch.subscription?.tranzilaToken;
  const expdate = branch.subscription?.tranzilaExpDate;
  if (!config || !token || !expdate) return false;

  const params = new URLSearchParams({
    supplier: config.terminal,
    TranzilaPW: config.password,
    TranzilaTK: token,
    expdate,
    sum: config.sum,
    currency: '1',
    cred_type: '1',
  });

  try {
    const res = await fetch(TOKEN_CHARGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const text = await res.text();
    const result = new URLSearchParams(text);
    return result.get('Response') === '000';
  } catch (err) {
    console.error('[tranzila] error cobrando el token', err);
    return false;
  }
}
