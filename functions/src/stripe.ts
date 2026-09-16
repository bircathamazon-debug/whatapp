import Stripe from 'stripe';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin';
import type { Branch } from './types';

/**
 * Suscripción de pago del sistema (cobro mensual recurrente a la
 * peluquería), vía Stripe Checkout + Billing Portal — páginas alojadas por
 * Stripe, no hace falta construir ningún formulario de tarjeta acá.
 * Requiere que el usuario cree su cuenta de Stripe, un producto con un
 * precio recurrente, y un webhook apuntando a stripeWebhook (ver
 * STRIPE_SECRET_KEY / STRIPE_PRICE_ID / STRIPE_WEBHOOK_SECRET /
 * FUNCTIONS_BASE_URL en functions/.env.example). Si falta esa
 * configuración, las funciones devuelven un error claro en vez de fallar
 * en silencio.
 */

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

function getBaseUrl(): string | null {
  return process.env.FUNCTIONS_BASE_URL || null;
}

async function getOrCreateCustomer(stripe: Stripe, branch: Branch): Promise<string> {
  if (branch.subscription?.stripeCustomerId) return branch.subscription.stripeCustomerId;
  const customer = await stripe.customers.create({
    name: branch.name,
    metadata: { branchId: branch.id },
  });
  await db.collection('branches').doc(branch.id).update({
    'subscription.provider': 'stripe',
    'subscription.stripeCustomerId': customer.id,
    'subscription.status': 'none',
  });
  return customer.id;
}

/** Callable: crea una sesión de pago de Stripe y devuelve la URL para abrir. */
export const stripeCreateCheckoutSession = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Requiere sesión.');
  const { branchId } = request.data as { branchId: string };
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  const baseUrl = getBaseUrl();
  if (!stripe || !priceId || !baseUrl) {
    throw new HttpsError('failed-precondition', 'Los pagos todavía no están configurados.');
  }

  const branchSnap = await db.collection('branches').doc(branchId).get();
  if (!branchSnap.exists) throw new HttpsError('not-found', 'Sucursal no encontrada.');
  const branch = { id: branchSnap.id, ...(branchSnap.data() as Omit<Branch, 'id'>) };

  const customerId = await getOrCreateCustomer(stripe, branch);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/stripeCheckoutDone?result=success`,
    cancel_url: `${baseUrl}/stripeCheckoutDone?result=cancel`,
    client_reference_id: branchId,
    metadata: { branchId },
  });

  if (!session.url) throw new HttpsError('internal', 'No se pudo crear la sesión de pago.');
  return { url: session.url };
});

/** Callable: abre el portal de Stripe para gestionar/cancelar la suscripción. */
export const stripeCustomerPortal = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Requiere sesión.');
  const { branchId } = request.data as { branchId: string };
  const stripe = getStripe();
  const baseUrl = getBaseUrl();
  if (!stripe || !baseUrl) {
    throw new HttpsError('failed-precondition', 'Los pagos todavía no están configurados.');
  }

  const branchSnap = await db.collection('branches').doc(branchId).get();
  if (!branchSnap.exists) throw new HttpsError('not-found', 'Sucursal no encontrada.');
  const branch = branchSnap.data() as Branch;
  const customerId = branch.subscription?.stripeCustomerId;
  if (!customerId) throw new HttpsError('failed-precondition', 'Todavía no hay una suscripción para esta sucursal.');

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/stripeCheckoutDone?result=return`,
  });
  return { url: session.url };
});

/** Página simple que ve el peluquero al volver del Checkout/Portal de Stripe. */
export const stripeCheckoutDone = onRequest((req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(
    '<html><body style="font-family: sans-serif; text-align: center; padding: 60px 20px;"><h2>¡Listo!</h2><p>Ya podés cerrar esta ventana y volver a la app.</p></body></html>'
  );
});

/** Webhook de Stripe: mantiene branch.subscription al día según los eventos. */
export const stripeWebhook = onRequest(async (req, res) => {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    res.status(500).send('Stripe no configurado');
    return;
  }

  const signature = req.headers['stripe-signature'];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature as string, webhookSecret);
  } catch (err) {
    console.error('[stripe] firma de webhook inválida', err);
    res.status(400).send('Firma inválida');
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const branchId = session.client_reference_id || session.metadata?.branchId;
        if (branchId && session.customer && session.subscription) {
          await db
            .collection('branches')
            .doc(branchId)
            .update({
              'subscription.stripeCustomerId': customerIdOf(session.customer),
              'subscription.stripeSubscriptionId': subscriptionIdOf(session.subscription),
              'subscription.status': 'active',
            });
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await updateBranchByCustomerId(stripe, customerIdOf(invoice.customer), async (subscription) => ({
          'subscription.status': 'active',
          'subscription.currentPeriodEnd': subscription ? subscription.current_period_end * 1000 : null,
        }));
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await updateBranchByCustomerId(stripe, customerIdOf(invoice.customer), async () => ({
          'subscription.status': 'past_due',
        }));
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await updateBranchByCustomerId(stripe, customerIdOf(subscription.customer), async () => ({
          'subscription.status': 'canceled',
        }));
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe] error procesando webhook', err);
    res.status(500).send('Error procesando el evento');
  }
});

function customerIdOf(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

function subscriptionIdOf(subscription: string | Stripe.Subscription | null): string | null {
  if (!subscription) return null;
  return typeof subscription === 'string' ? subscription : subscription.id;
}

async function updateBranchByCustomerId(
  stripe: Stripe,
  customerId: string | null,
  buildUpdate: (subscription: Stripe.Subscription | null) => Promise<Record<string, unknown>>
): Promise<void> {
  if (!customerId) return;
  const snap = await db.collection('branches').where('subscription.stripeCustomerId', '==', customerId).limit(1).get();
  if (snap.empty) return;
  const branch = snap.docs[0].data() as Branch;
  const subscriptionId = branch.subscription?.stripeSubscriptionId;
  const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;
  const update = await buildUpdate(subscription);
  await snap.docs[0].ref.update(update);
}
