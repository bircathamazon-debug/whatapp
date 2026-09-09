import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db } from './admin';
import type { Appointment, Branch, Client } from './types';
import { LOYALTY_THRESHOLD } from './types';
import { sendNotification, templates } from './notify';

/** Al completar una cita: suma al contador de fidelidad y premia cada 10 cortes. */
export const onAppointmentCompletedUpdateLoyalty = onDocumentUpdated('appointments/{appointmentId}', async (event) => {
  const before = event.data?.before.data() as Appointment | undefined;
  const after = event.data?.after.data() as Appointment | undefined;
  if (!before || !after) return;
  if (before.status === 'completed' || after.status !== 'completed') return;

  const clientRef = db.collection('clients').doc(after.clientId);
  const rewardEarned = await db.runTransaction(async (tx) => {
    const snap = await tx.get(clientRef);
    if (!snap.exists) return false;
    const client = snap.data() as Client;
    const completedCount = (client.completedCount ?? 0) + 1;
    const alreadyRedeemed = (client.loyaltyRedeemedAt ?? []).includes(completedCount);
    const earned = completedCount % LOYALTY_THRESHOLD === 0 && !alreadyRedeemed;

    tx.update(clientRef, {
      completedCount,
      ...(earned ? { loyaltyRedeemedAt: [...(client.loyaltyRedeemedAt ?? []), completedCount] } : {}),
      // Un no-show ya pagado con un corte completado sin faltar de nuevo mejora la confianza.
    });
    return earned;
  });

  if (rewardEarned) {
    const branchSnap = await db.collection('branches').doc(after.branchId).get();
    const clientSnap = await clientRef.get();
    if (branchSnap.exists && clientSnap.exists) {
      const branch = branchSnap.data() as Branch;
      const client = clientSnap.data() as Client;
      await sendNotification({
        channel: 'whatsapp',
        to: client.phone,
        branch,
        template: 'loyaltyReward',
        text: templates.loyaltyReward(client.name),
      });
    }
  }
});
