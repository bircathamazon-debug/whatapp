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

// --- Plantillas de mensajes (todas en hebreo: son lo que ve el cliente) ---

export const templates = {
  bookingConfirmed: (clientName: string, dateStr: string, timeStr: string, serviceName: string, staffName: string) =>
    `שלום ${clientName}! התור שלך אושר:\n📅 ${dateStr} בשעה ${timeStr}\n✂️ ${serviceName} עם ${staffName}\n\nלביטול, כתבו "menu" ובחרו בביטול תור.`,

  staffNewBooking: (clientName: string, dateStr: string, timeStr: string, serviceName: string) =>
    `תור חדש: ${clientName} — ${serviceName} בתאריך ${dateStr} בשעה ${timeStr}.`,

  reminder: (clientName: string, dateStr: string, timeStr: string) =>
    `שלום ${clientName}, מזכירים לך את התור שלך בתאריך ${dateStr} בשעה ${timeStr}.\nהשיבו 1 לאישור או 2 לביטול.`,

  cancelledByClient: (clientName: string, dateStr: string, timeStr: string) =>
    `${clientName} ביטל/ה את התור מתאריך ${dateStr} בשעה ${timeStr}.`,

  waitlistOffer: (dateStr: string, timeStr: string, minutesToRespond: number) =>
    `התפנה תור בתאריך ${dateStr} בשעה ${timeStr}. השיבו 1 בתוך ${minutesToRespond} דקות כדי לתפוס אותו.`,

  depositRequired: (amount: number) =>
    `כדי לאשר את התור צריך מקדמה של ₪${amount}. נשלח לך קישור לתשלום. אם לא ישולם תוך 30 דקות, השעה תשוחרר.`,

  birthday: (clientName: string) =>
    `🎉 יום הולדת שמח ${clientName}! מתנה בשבילך: 15% הנחה על התספורת הבאה החודש. מחכים לך!`,

  loyaltyReward: (clientName: string) =>
    `🎁 ${clientName}, הגעת ל-10 תספורות אצלנו. התספורת הבאה שלך ב-100% הנחה. תודה על האמון!`,

  emptySlotCampaign: (dateStr: string, timeStr: string) =>
    `התפנה תור היום בשעה ${timeStr} (${dateStr}). כתבו "menu" כדי לקבוע.`,

  noShowWarning: (clientName: string) =>
    `${clientName} לא הגיע/ה לתור. מעכשיו יידרש מקדמה כדי לקבוע תור.`,

  comebackReminder: (clientName: string) =>
    `שלום ${clientName}! עבר כבר חודש מהתספורת האחרונה שלך ✂️ מוזמנים לקבוע תור חדש — כתבו "menu".`,
};
