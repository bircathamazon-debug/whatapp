/**
 * Despacha por WhatsApp los mensajes que las Cloud Functions dejaron en la
 * cola `notifications` (recordatorios, confirmaciones, ofertas de lista de
 * espera, campañas de horas vacías, cumpleaños, avisos al peluquero...).
 * Se resuelve por polling (no onSnapshot) porque el filtro `deliverAfter`
 * depende de la hora actual, que cambia constantemente.
 */
import { db } from './firebaseClient.js';

const POLL_INTERVAL_MS = 20000;

export function startNotificationsWatcher(sock, branchId) {
  const tick = async () => {
    try {
      const now = Date.now();
      const snap = await db
        .collection('notifications')
        .where('channel', '==', 'whatsapp')
        .where('status', '==', 'pending')
        .where('branchId', '==', branchId)
        .where('deliverAfter', '<=', now)
        .limit(20)
        .get();

      for (const doc of snap.docs) {
        const data = doc.data();
        try {
          const jid = toJid(data.to);
          await sock.sendMessage(jid, { text: data.text });
          await doc.ref.update({ status: 'sent', sentAt: Date.now() });
        } catch (err) {
          console.error('[notificationsWatcher] error enviando', doc.id, err);
          await doc.ref.update({ status: 'failed', error: String(err?.message ?? err) });
        }
      }
    } catch (err) {
      console.error('[notificationsWatcher] error en el ciclo de polling', err);
    } finally {
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  };
  tick();
}

function toJid(phoneE164) {
  const digits = phoneE164.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}
