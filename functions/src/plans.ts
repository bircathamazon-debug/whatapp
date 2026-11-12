/**
 * Planes que paga cada barbería por usar el sistema (precios en ₪).
 *
 * - Básico ₪99: hasta BASIC_MONTHLY_LIMIT citas por mes.
 * - Pro ₪150: sin límite.
 * Si una barbería en Básico pasa el límite en un mes, el bot NUNCA deja de
 * atender: se le avisa al 80 % y ese mes se cobra el precio Pro. El mes
 * siguiente vuelve a ₪99 si usa menos. La barbería puede cambiar de plan
 * cuando quiera desde su panel (Ajustes → Mi plan).
 *
 * El límite sale del estudio de precios (reports/Precio del bot Israel
 * Venezuela España.md): con ~250 citas el costo de mensajes de Meta deja
 * un margen sano a ₪99; con más, el margen cae fuerte.
 */
import { db } from './admin';

export const PLANS = {
  basic: { price: 99, monthlyLimit: 250 as number | null },
  pro: { price: 150, monthlyLimit: null as number | null },
} as const;

export type PlanId = keyof typeof PLANS;

export const TRIAL_DAYS = 30;
/** Días que se espera después de un cobro fallido antes de bloquear. */
export const PAST_DUE_GRACE_DAYS = 3;
/** Días antes del fin del mes gratis en que se avisa. */
export const TRIAL_WARNING_DAYS = 3;
export const DAY_MS = 24 * 3600000;

export function isPlanId(p: unknown): p is PlanId {
  return p === 'basic' || p === 'pro';
}

/** Citas no canceladas de una sucursal con inicio en [from, to). */
export async function countAppointments(branchId: string, from: number, to: number): Promise<number> {
  const snap = await db
    .collection('appointments')
    .where('branchId', '==', branchId)
    .where('startsAt', '>=', from)
    .where('startsAt', '<', to)
    .select('status')
    .get();
  return snap.docs.filter((d) => d.get('status') !== 'cancelled').length;
}

/** Inicio y fin del mes calendario (hora de Israel aproximada con UTC+2/3 no
 * hace falta acá: el límite es mensual y unas horas de borde no cambian nada). */
export function monthRange(at = Date.now()): { from: number; to: number; key: string } {
  const d = new Date(at);
  const from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const to = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return { from, to, key };
}

/** Monto a cobrar por el período [from, to) según el plan y el uso real. */
export async function amountForPeriod(branchId: string, plan: PlanId, from: number, to: number): Promise<{ amount: number; used: number; exceeded: boolean }> {
  const used = await countAppointments(branchId, from, to);
  const limit = PLANS[plan].monthlyLimit;
  const exceeded = limit !== null && used > limit;
  return { amount: exceeded ? PLANS.pro.price : PLANS[plan].price, used, exceeded };
}
