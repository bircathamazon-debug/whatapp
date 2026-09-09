import { db } from './admin';
import { getTwilioClient } from './twilio';
import { isShabbatNow, nextHavdalah } from './shabbat';
import type { NotificationChannel, Branch } from './types';

interface SendArgs {
  channel: NotificationChannel;
  to: string; // teléfono E.164
  branch: Branch;
  template: string;
  text: string;
  relatedAppointmentId?: string | null;
  awaitingReply?: 'confirm_cancel' | 'waitlist_offer' | null;
  /** Datos extra que el bot pueda necesitar al procesar la respuesta (ej. waitlistId). */
  data?: Record<string, string>;
  /**
   * Si true, y la sucursal está en shabbatMode 'silent', el mensaje se
   * retiene hasta Motzaei Shabat en lugar de enviarse de inmediato.
   * Se usa para avisos al peluquero (no al cliente, que sí debe recibir
   * su confirmación de reserva al instante si el modo no es 'closed').
   */
  respectShabbatSilence?: boolean;
}

/**
 * Punto único de salida de mensajes. WhatsApp se encola en Firestore y lo
 * envía el proceso del bot (Baileys, requiere sesión persistente). SMS y
 * llamadas salen directo por la API REST de Twilio.
 */
export async function sendNotification(args: SendArgs): Promise<void> {
  const now = Date.now();
  let deliverAfter = now;

  if (args.respectShabbatSilence && args.branch.shabbatMode === 'silent') {
    if (await isShabbatNow(args.branch.geonameId, now)) {
      deliverAfter = (await nextHavdalah(args.branch.geonameId, now)) ?? now;
    }
  }

  if (args.channel === 'whatsapp') {
    await db.collection('notifications').add({
      channel: 'whatsapp',
      to: args.to,
      branchId: args.branch.id,
      template: args.template,
      data: args.data ?? {},
      text: args.text,
      status: 'pending',
      deliverAfter,
      relatedAppointmentId: args.relatedAppointmentId ?? null,
      awaitingReply: args.awaitingReply ?? null,
      createdAt: now,
      sentAt: null,
      error: null,
    });
    return;
  }

  if (deliverAfter > now) {
    // Twilio no soporta "enviar más tarde" nativamente para SMS/voz de forma
    // sencilla: para respetar el modo silencioso encolamos igual y un cron
    // (flushDelayedTwilio) lo despacha cuando toca.
    await db.collection('notifications').add({
      channel: args.channel,
      to: args.to,
      branchId: args.branch.id,
      template: args.template,
      data: {},
      text: args.text,
      status: 'pending',
      deliverAfter,
      relatedAppointmentId: args.relatedAppointmentId ?? null,
      awaitingReply: args.awaitingReply ?? null,
      createdAt: now,
      sentAt: null,
      error: null,
    });
    return;
  }

  await dispatchTwilio(args.channel, args.to, args.text, args.relatedAppointmentId, args.awaitingReply);
}

export async function dispatchTwilio(
  channel: 'sms' | 'call',
  to: string,
  text: string,
  relatedAppointmentId?: string | null,
  awaitingReply?: 'confirm_cancel' | 'waitlist_offer' | null
): Promise<void> {
  const client = getTwilioClient();
  if (!client) {
    console.warn('[notify] Twilio no configurado; se omite envío real', { channel, to, text });
    return;
  }
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    console.warn('[notify] TWILIO_PHONE_NUMBER no configurado; se omite envío real', { channel, to });
    return;
  }
  if (channel === 'sms') {
    await client.messages.create({ to, from, body: text });
    return;
  }

  // Llamada con texto a voz en hebreo (Twilio Say soporta locales he-IL en Polly).
  // Si esperamos respuesta (confirmar/cancelar), se agrega un <Gather> que
  // redirige a ivrReminderResponse para procesar el dígito presionado.
  const base = process.env.TWILIO_IVR_BASE_URL;
  let twiml: string;
  if (awaitingReply === 'confirm_cancel' && relatedAppointmentId && base) {
    twiml = `<Response><Gather numDigits="1" action="${base}/ivrReminderResponse?appointmentId=${relatedAppointmentId}" method="POST" timeout="8"><Say language="he-IL">${escapeXml(
      text
    )}</Say></Gather><Say language="he-IL">לא התקבלה בחירה.</Say></Response>`;
  } else {
    twiml = `<Response><Say language="he-IL">${escapeXml(text)}</Say></Response>`;
  }
  await client.calls.create({ to, from, twiml });
}

/** Cron: despacha por Twilio los mensajes sms/call cuya deliverAfter ya llegó. */
export async function flushDueTwilioNotifications(): Promise<number> {
  const now = Date.now();
  const snap = await db
    .collection('notifications')
    .where('channel', 'in', ['sms', 'call'])
    .where('status', '==', 'pending')
    .where('deliverAfter', '<=', now)
    .limit(100)
    .get();

  let sent = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    try {
      await dispatchTwilio(data.channel, data.to, data.text, data.relatedAppointmentId, data.awaitingReply);
      await doc.ref.update({ status: 'sent', sentAt: now });
      sent++;
    } catch (err: any) {
      await doc.ref.update({ status: 'failed', error: String(err?.message ?? err) });
    }
  }
  return sent;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string));
}

// --- Plantillas de mensajes (español, con datos en hebreo cuando aplica) ---

export const templates = {
  bookingConfirmed: (clientName: string, dateStr: string, timeStr: string, serviceName: string, staffName: string) =>
    `Hola ${clientName}! Tu cita quedó confirmada:\n📅 ${dateStr} a las ${timeStr}\n💈 ${serviceName} con ${staffName}\n\nResponde CANCELAR si necesitas anular.`,

  staffNewBooking: (clientName: string, dateStr: string, timeStr: string, serviceName: string) =>
    `Nueva cita: ${clientName} — ${serviceName} el ${dateStr} a las ${timeStr}.`,

  reminder: (clientName: string, dateStr: string, timeStr: string) =>
    `Hola ${clientName}, te recordamos tu cita el ${dateStr} a las ${timeStr}.\nResponde 1 para CONFIRMAR o 2 para CANCELAR.`,

  cancelledByClient: (clientName: string, dateStr: string, timeStr: string) =>
    `${clientName} canceló su cita del ${dateStr} a las ${timeStr}.`,

  waitlistOffer: (dateStr: string, timeStr: string, minutesToRespond: number) =>
    `Se liberó un turno el ${dateStr} a las ${timeStr}. Responde 1 en los próximos ${minutesToRespond} minutos para tomarlo.`,

  depositRequired: (amount: number) =>
    `Para confirmar tu cita necesitamos un depósito de ₪${amount}. Te enviaremos el link de pago. Si no se completa en 30 minutos, se liberará el horario.`,

  birthday: (clientName: string) =>
    `🎉 ¡Feliz cumpleaños ${clientName}! Como regalo tienes 15% de descuento en tu próximo corte este mes. ¡Te esperamos!`,

  loyaltyReward: (clientName: string) =>
    `🎁 ${clientName}, llegaste a 10 cortes con nosotros. Tu próximo corte tiene 100% de descuento. ¡Gracias por tu confianza!`,

  emptySlotCampaign: (dateStr: string, timeStr: string) =>
    `Hoy quedó libre un turno a las ${timeStr} (${dateStr}). Responde RESERVAR si te sirve.`,

  noShowWarning: (clientName: string) =>
    `${clientName} no se presentó a su cita. A partir de ahora se le pedirá depósito para reservar.`,
};
