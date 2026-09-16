import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export async function createSubscriptionCheckout(branchId: string): Promise<string> {
  const fn = httpsCallable<{ branchId: string }, { url: string }>(functions, 'stripeCreateCheckoutSession');
  const res = await fn({ branchId });
  return res.data.url;
}

export async function openBillingPortal(branchId: string): Promise<string> {
  const fn = httpsCallable<{ branchId: string }, { url: string }>(functions, 'stripeCustomerPortal');
  const res = await fn({ branchId });
  return res.data.url;
}
