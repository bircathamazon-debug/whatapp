/**
 * Cuenta de cada barbería como cliente del sistema: plan (Básico/Pro), mes
 * gratis, uso del mes, bloqueo por falta de pago y el panel del dueño del
 * sistema (super administrador). Precios y límites en plans.ts; el cobro con
 * tarjeta en tranzila.ts y el cron mensual en crons.ts.
 *
 * Bloqueada = el peluquero no puede usar el panel (ve un aviso para pagar) y
 * el bot/IVR no atienden: le dicen al cliente que hable directo con la
 * barbería (mismo camino que el modo mantenimiento).
 */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getAuth } from 'firebase-admin/auth';
import { db } from './admin';
import type { Branch } from './types';
import { requireBranchAccess, requireBranchWriteAccess } from './access';
import { sendNotification } from './notify';
import { PLANS, TRIAL_DAYS, PAST_DUE_GRACE_DAYS, TRIAL_WARNING_DAYS, DAY_MS, isPlanId, countAppointments, monthRange } from './plans';
import { logAudit } from './audit';

/** True si la barbería no puede usar el sistema por falta de pago o bloqueo manual. */
export function isBranchBlocked(branch: Pick<Branch, 'billing'> | null | undefined): boolean {
  return branch?.billing?.blocked === true;
}

async function requireSuperAdmin(auth: CallableRequest['auth']): Promise<string> {
  if (!auth) throw new HttpsError('unauthenticated', 'Requiere sesión.');
  const snap = await db.collection('users').doc(auth.uid).get();
  if (snap.get('isSuperAdmin') !== true || snap.get('readOnly') === true) {
    throw new HttpsError('permission-denied', 'Solo el dueño del sistema.');
  }
  return auth.uid;
}

const MESSAGES = {
  he: {
    trialEnding: (days: number) => `שלום! תקופת הניסיון החינמית של מערכת התורים מסתיימת בעוד ${days} ימים. כדי להמשיך בלי הפסקה, הכנסו לאפליקציה ← הגדרות ← התוכנית שלי, והוסיפו כרטיס אשראי.`,
    usage80: (used: number, limit: number) => `שימו לב: החודש כבר נקבעו ${used} תורים מתוך ${limit} בתוכנית הבסיסית. אם תעברו את המכסה, החודש יחויב לפי תוכנית פרו (₪${PLANS.pro.price}). הבוט ממשיך לעבוד כרגיל.`,
    blocked: 'החשבון של מערכת התורים הושהה כי התשלום לא עבר. הבוט מפנה את הלקוחות אליכם ישירות. כדי לחדש: אפליקציה ← הגדרות ← התוכנית שלי.',
  },
  en: {
    trialEnding: (days: number) => `Hi! Your free trial of the booking system ends in ${days} days. To keep going, open the app → Settings → My plan and add a card.`,
    usage80: (used: number, limit: number) => `Heads up: ${used} of ${limit} bookings used this month on the Basic plan. If you go over, this month is billed as Pro (₪${PLANS.pro.price}). The bot keeps working as usual.`,
    blocked: 'Your booking system account is paused because the payment did not go through. The bot is sending clients to you directly. To reactivate: app → Settings → My plan.',
  },
  es: {
    trialEnding: (days: number) => `¡Hola! Tu mes gratis del sistema de citas termina en ${days} días. Para seguir sin cortes, entrá a la app → Ajustes → Mi plan y cargá una tarjeta.`,
    usage80: (used: number, limit: number) => `Aviso: este mes ya van ${used} de ${limit} citas del plan Básico. Si te pasás, este mes se cobra como Pro (₪${PLANS.pro.price}). El bot sigue atendiendo normal.`,
    blocked: 'Tu cuenta del sistema de citas quedó en pausa porque no pasó el pago. El bot les pide a los clientes que te contacten directo. Para reactivarla: app → Ajustes → Mi plan.',
  },
};

function msgs(branch: Branch) {
  return MESSAGES[branch.language ?? 'he'] ?? MESSAGES.he;
}

async function notifyOwner(branch: Branch, text: string, template: string) {
  if (!branch.phone) return;
  await sendNotification({ channel: 'whatsapp', to: branch.phone, branch, template, text, respectShabbatSilence: true });
}

/** Callable: uso del mes y datos del plan, para "Mi plan" y el panel del dueño. */
export const billingStatus = onCall(async (request) => {
  const { branchId } = request.data as { branchId: string };
  await requireBranchAccess(request.auth, branchId);
  const snap = await db.collection('branches').doc(branchId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Sucursal no encontrada.');
  const branch = snap.data() as Branch;
  const { from, to } = monthRange();
  const used = await countAppointments(branchId, from, to);
  const plan = branch.billing?.plan ?? 'basic';
  return {
    plan,
    limit: PLANS[plan].monthlyLimit,
    used,
    prices: { basic: PLANS.basic.price, pro: PLANS.pro.price },
    basicLimit: PLANS.basic.monthlyLimit,
    trialEndsAt: branch.billing?.trialEndsAt ?? null,
    blocked: isBranchBlocked(branch),
    blockedReason: branch.billing?.blockedReason ?? null,
    subscriptionStatus: branch.subscription?.status ?? 'none',
    nextChargeAt: branch.subscription?.currentPeriodEnd ?? null,
    lastChargeAmount: branch.billing?.lastChargeAmount ?? null,
  };
});

/** Callable: la barbería cambia su plan (vale desde el próximo cobro). */
export const billingSetPlan = onCall(async (request) => {
  const { branchId, plan } = request.data as { branchId: string; plan: string };
  if (!isPlanId(plan)) throw new HttpsError('invalid-argument', 'Plan inválido.');
  await requireBranchWriteAccess(request.auth, branchId);
  await db.collection('branches').doc(branchId).update({ 'billing.plan': plan });
  await logAudit(request.auth!.uid, branchId, plan === 'pro' ? 'billing_plan_pro' : 'billing_plan_basic');
  return { ok: true };
});

/** Callable (dueño): bloquear/desbloquear, cambiar plan o extender el mes gratis. */
export const ownerUpdateBilling = onCall(async (request) => {
  const uid = await requireSuperAdmin(request.auth);
  const { branchId, blocked, plan, extendTrialDays } = request.data as {
    branchId: string;
    blocked?: boolean;
    plan?: string;
    extendTrialDays?: number;
  };
  const ref = db.collection('branches').doc(branchId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Sucursal no encontrada.');
  const branch = snap.data() as Branch;
  const update: Record<string, unknown> = {};
  if (typeof blocked === 'boolean') {
    update['billing.blocked'] = blocked;
    update['billing.blockedReason'] = blocked ? 'manual' : null;
    if (!blocked) update['billing.pastDueSince'] = null;
  }
  if (plan !== undefined) {
    if (!isPlanId(plan)) throw new HttpsError('invalid-argument', 'Plan inválido.');
    update['billing.plan'] = plan;
  }
  if (extendTrialDays && extendTrialDays > 0 && extendTrialDays <= 365) {
    const base = Math.max(Date.now(), branch.billing?.trialEndsAt ?? 0);
    update['billing.trialEndsAt'] = base + extendTrialDays * DAY_MS;
    update['billing.trialWarned'] = false;
    if (branch.billing?.blockedReason === 'unpaid') {
      update['billing.blocked'] = false;
      update['billing.blockedReason'] = null;
    }
  }
  if (Object.keys(update).length === 0) throw new HttpsError('invalid-argument', 'Nada para cambiar.');
  await ref.update(update);
  await logAudit(uid, branchId, 'owner_billing_update');
  return { ok: true };
});

/**
 * Callable (dueño): da de alta una barbería nueva con su cuenta de acceso
 * (mail + contraseña) y el mes gratis ya corriendo.
 */
export const ownerCreateBarbershop = onCall(async (request) => {
  const uid = await requireSuperAdmin(request.auth);
  const { name, email, password, phone, language } = request.data as {
    name: string;
    email: string;
    password: string;
    phone?: string;
    language?: 'he' | 'en' | 'es';
  };
  if (!name?.trim() || !email?.trim() || !password || password.length < 8) {
    throw new HttpsError('invalid-argument', 'Faltan datos (nombre, mail y contraseña de al menos 8 caracteres).');
  }
  const auth = getAuth();
  const existing = await auth.getUserByEmail(email.trim()).catch(() => null);
  if (existing) throw new HttpsError('already-exists', 'Ya existe una cuenta con ese mail.');

  const now = Date.now();
  const branchRef = await db.collection('branches').add({
    name: name.trim(),
    address: '',
    geonameId: '281184', // Jerusalén (horarios de Shabat); se cambia en Sucursales
    timezone: 'Asia/Jerusalem',
    shabbatMode: 'silent',
    phone: (phone ?? '').trim(),
    language: language ?? 'he',
    billing: { plan: 'basic', trialEndsAt: now + TRIAL_DAYS * DAY_MS, blocked: false, blockedReason: null, pastDueSince: null },
    subscription: { provider: 'tranzila', status: 'none' },
    createdAt: now,
  });
  const user = await auth.createUser({ email: email.trim(), password, displayName: name.trim() });
  await db.collection('users').doc(user.uid).set({ branchIds: [branchRef.id], isSuperAdmin: false, readOnly: false, mustChangePassword: true });
  await logAudit(uid, branchRef.id, 'owner_create_branch');
  return { branchId: branchRef.id, uid: user.uid };
});

/**
 * Diario 09:00: avisos y bloqueos de la cuenta de cada barbería.
 * - Mes gratis por terminar (sin tarjeta) → aviso; terminado → bloqueo.
 * - Cobro fallido hace más de PAST_DUE_GRACE_DAYS → bloqueo.
 * - Básico al 80 % del límite del mes → aviso (una vez por mes).
 */
/**
 * Adónde le llegan al dueño del sistema sus recordatorios diarios: doc
 * `config/platform` en Firestore ({ ownerPhone, alertBranchId }), con
 * valores por defecto. `alertBranchId` es la barbería cuyo bot de WhatsApp
 * manda el mensaje (hoy la del piloto).
 */
async function ownerAlertTarget(): Promise<{ phone: string; branch: Branch } | null> {
  const cfg = (await db.collection('config').doc('platform').get()).data() ?? {};
  const phone = (cfg.ownerPhone as string | undefined) ?? '+972543147000';
  const branchId = (cfg.alertBranchId as string | undefined) ?? 'lvR7XmCtJEFm1FDxW7r7';
  const snap = await db.collection('branches').doc(branchId).get();
  if (!snap.exists || !phone) return null;
  return { phone, branch: { id: snap.id, ...(snap.data() as Omit<Branch, 'id'>) } as Branch };
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('es-AR', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit' });
}

export const billingDaily = onSchedule({ schedule: '0 9 * * *', timeZone: 'Asia/Jerusalem' }, async () => {
  const now = Date.now();
  const { from, to, key } = monthRange(now);
  const snap = await db.collection('branches').get();
  // Resumen para el dueño del sistema: qué barberías necesitan atención hoy.
  const digest: string[] = [];
  for (const doc of snap.docs) {
    const branch = { id: doc.id, ...(doc.data() as Omit<Branch, 'id'>) } as Branch;
    const billing = branch.billing;
    if (!billing) continue; // sucursales sin plan (ej. la del piloto) no se tocan
    const paying = branch.subscription?.status === 'active';
    const m = msgs(branch);
    try {
      if (!paying && billing.trialEndsAt && !billing.blocked) {
        const left = billing.trialEndsAt - now;
        if (left <= 0) {
          await doc.ref.update({ 'billing.blocked': true, 'billing.blockedReason': 'unpaid' });
          await notifyOwner(branch, m.blocked, 'billingBlocked');
          digest.push(`⛔ ${branch.name}: terminó el mes gratis sin tarjeta → quedó BLOQUEADA hoy`);
          continue;
        }
        if (left <= TRIAL_WARNING_DAYS * DAY_MS) {
          digest.push(`⏳ ${branch.name}: el mes gratis termina el ${fmtDate(billing.trialEndsAt)} y todavía no cargó tarjeta`);
          if (!billing.trialWarned) {
            await doc.ref.update({ 'billing.trialWarned': true });
            await notifyOwner(branch, m.trialEnding(Math.max(1, Math.ceil(left / DAY_MS))), 'billingTrialEnding');
          }
        }
      }
      if (branch.subscription?.status === 'past_due' && billing.pastDueSince && !billing.blocked) {
        if (now - billing.pastDueSince > PAST_DUE_GRACE_DAYS * DAY_MS) {
          await doc.ref.update({ 'billing.blocked': true, 'billing.blockedReason': 'unpaid' });
          await notifyOwner(branch, m.blocked, 'billingBlocked');
          digest.push(`⛔ ${branch.name}: el cobro falla desde el ${fmtDate(billing.pastDueSince)} → quedó BLOQUEADA hoy`);
          continue;
        }
        digest.push(`⚠️ ${branch.name}: falló el cobro el ${fmtDate(billing.pastDueSince)} (se bloquea a los ${PAST_DUE_GRACE_DAYS} días si no paga)`);
      }
      const limit = PLANS[billing.plan ?? 'basic'].monthlyLimit;
      if (limit && billing.usageWarnedMonth !== key) {
        const used = await countAppointments(branch.id, from, to);
        if (used >= Math.floor(limit * 0.8)) {
          await doc.ref.update({ 'billing.usageWarnedMonth': key });
          await notifyOwner(branch, m.usage80(used, limit), 'billingUsage80');
          digest.push(`📈 ${branch.name}: ya va ${used} de ${limit} citas del Básico este mes`);
        }
      }
    } catch (err) {
      console.error('[billingDaily] error en', branch.id, err);
    }
  }

  const openRequests = await db.collection('changeRequests').where('status', '==', 'open').count().get();
  const nOpen = openRequests.data().count;
  if (nOpen > 0) digest.push(`📝 Tenés ${nOpen} pedido(s) de cambio sin responder (Más → Mis clientes)`);

  if (digest.length > 0) {
    const target = await ownerAlertTarget();
    if (target) {
      await sendNotification({
        channel: 'whatsapp', to: target.phone, branch: target.branch, template: 'ownerDailyDigest',
        text: `Resumen de tus barberías (${fmtDate(now)}):\n${digest.join('\n')}`, respectShabbatSilence: true,
      });
    }
  }
});

/** Callable: la cuenta avisa que ya cambió la contraseña provisoria (la
 * ficha `users/{uid}` no la puede escribir el cliente, ver firestore.rules). */
export const accountPasswordChanged = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Requiere sesión.');
  await db.collection('users').doc(request.auth.uid).set({ mustChangePassword: false }, { merge: true });
  return { ok: true };
});
