import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export async function broadcastEmptySlots(branchId: string): Promise<{ sentTo: number; message: string }> {
  const fn = httpsCallable<{ branchId: string }, { sentTo: number; message: string }>(functions, 'broadcastEmptySlots');
  const res = await fn({ branchId });
  return res.data;
}
