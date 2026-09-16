import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export async function createTranzilaCheckoutUrl(branchId: string): Promise<string> {
  const fn = httpsCallable<{ branchId: string }, { url: string }>(functions, 'tranzilaCreateCheckoutUrl');
  const res = await fn({ branchId });
  return res.data.url;
}

export async function cancelTranzilaSubscription(branchId: string): Promise<void> {
  const fn = httpsCallable(functions, 'tranzilaCancelSubscription');
  await fn({ branchId });
}
