import { db } from './admin';
import { getTwilioClient } from './twilio';
import { isShabbatNow, nextHavdalah } from './shabbat';
import { getIvrStrings } from './ivrStrings';
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
      language: args.branch.language ?? null,
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

  await dispatchTwilio(args.channel, args.to, args.text, args.relatedAppointmentId, args.awaitingReply, args.branch.language);
}

export async function dispatchTwilio(
  channel: 'sms' | 'call',
  to: string,
  text: string,
  relatedAppointmentId?: string | null,
  awaitingReply?: 'confirm_cancel' | 'waitlist_offer' | null,
  language?: string
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

  // Llamada con texto a voz en el idioma de la sucursal (Twilio Say soporta
  // varios locales vía Polly). Si esperamos respuesta (confirmar/cancelar),
  // se agrega un <Gather> que redirige a ivrReminderResponse para procesar
  // el dígito presionado, pasándole el idioma para que responda igual.
  const s = getIvrStrings(language);
  const base = process.env.TWILIO_IVR_BASE_URL;
  let twiml: string;
  if (awaitingReply === 'confirm_cancel' && relatedAppointmentId && base) {
    twiml = `<Response><Gather numDigits="1" action="${base}/ivrReminderResponse?appointmentId=${relatedAppointmentId}&amp;lang=${language ?? 'he'}" method="POST" timeout="8"><Say language="${s.twilioLang}">${escapeXml(
      text
    )}</Say></Gather><Say language="${s.twilioLang}">${s.noChoice}</Say></Response>`;
  } else {
    twiml = `<Response><Say language="${s.twilioLang}">${escapeXml(text)}</Say></Response>`;
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
      await dispatchTwilio(data.channel, data.to, data.text, data.relatedAppointmentId, data.awaitingReply, data.language);
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

// --- Plantillas de mensajes, por idioma (branch.language; hebreo por defecto) ---

export interface TemplateSet {
  bookingConfirmed: (clientName: string, dateStr: string, timeStr: string, serviceName: string, staffName: string) => string;
  staffNewBooking: (clientName: string, dateStr: string, timeStr: string, serviceName: string) => string;
  reminder: (clientName: string, dateStr: string, timeStr: string) => string;
  cancelledByClient: (clientName: string, dateStr: string, timeStr: string) => string;
  waitlistOffer: (dateStr: string, timeStr: string, minutesToRespond: number) => string;
  depositRequired: (amount: number) => string;
  birthday: (clientName: string) => string;
  loyaltyReward: (clientName: string) => string;
  emptySlotCampaign: (dateStr: string, timeStr: string) => string;
  noShowWarning: (clientName: string) => string;
  comebackReminder: (clientName: string) => string;
}

const templatesHe: TemplateSet = {
  bookingConfirmed: (clientName, dateStr, timeStr, serviceName, staffName) =>
    `שלום ${clientName}! התור שלך אושר:\n📅 ${dateStr} בשעה ${timeStr}\n✂️ ${serviceName} עם ${staffName}\n\nלביטול, כתבו "menu" ובחרו בביטול תור.`,

  staffNewBooking: (clientName, dateStr, timeStr, serviceName) =>
    `תור חדש: ${clientName} — ${serviceName} בתאריך ${dateStr} בשעה ${timeStr}.`,

  reminder: (clientName, dateStr, timeStr) =>
    `שלום ${clientName}, מזכירים לך את התור שלך בתאריך ${dateStr} בשעה ${timeStr}.\nהשיבו 1 לאישור או 2 לביטול.`,

  cancelledByClient: (clientName, dateStr, timeStr) =>
    `${clientName} ביטל/ה את התור מתאריך ${dateStr} בשעה ${timeStr}.`,

  waitlistOffer: (dateStr, timeStr, minutesToRespond) =>
    `התפנה תור בתאריך ${dateStr} בשעה ${timeStr}. השיבו 1 בתוך ${minutesToRespond} דקות כדי לתפוס אותו.`,

  depositRequired: (amount) =>
    `כדי לאשר את התור צריך מקדמה של ₪${amount}. נשלח לך קישור לתשלום. אם לא ישולם תוך 30 דקות, השעה תשוחרר.`,

  birthday: (clientName) =>
    `🎉 יום הולדת שמח ${clientName}! מתנה בשבילך: 15% הנחה על התספורת הבאה החודש. מחכים לך!`,

  loyaltyReward: (clientName) =>
    `🎁 ${clientName}, הגעת ל-10 תספורות אצלנו. התספורת הבאה שלך ב-100% הנחה. תודה על האמון!`,

  emptySlotCampaign: (dateStr, timeStr) =>
    `התפנה תור היום בשעה ${timeStr} (${dateStr}). כתבו "menu" כדי לקבוע.`,

  noShowWarning: (clientName) =>
    `${clientName} לא הגיע/ה לתור. מעכשיו יידרש מקדמה כדי לקבוע תור.`,

  comebackReminder: (clientName) =>
    `שלום ${clientName}! עבר כבר חודש מהתספורת האחרונה שלך ✂️ מוזמנים לקבוע תור חדש — כתבו "menu".`,
};

const templatesEn: TemplateSet = {
  bookingConfirmed: (clientName, dateStr, timeStr, serviceName, staffName) =>
    `Hi ${clientName}! Your appointment is confirmed:\n📅 ${dateStr} at ${timeStr}\n✂️ ${serviceName} with ${staffName}\n\nTo cancel, type "menu" and choose cancel appointment.`,

  staffNewBooking: (clientName, dateStr, timeStr, serviceName) =>
    `New booking: ${clientName} — ${serviceName} on ${dateStr} at ${timeStr}.`,

  reminder: (clientName, dateStr, timeStr) =>
    `Hi ${clientName}, this is a reminder about your appointment on ${dateStr} at ${timeStr}.\nReply 1 to confirm or 2 to cancel.`,

  cancelledByClient: (clientName, dateStr, timeStr) =>
    `${clientName} cancelled their appointment on ${dateStr} at ${timeStr}.`,

  waitlistOffer: (dateStr, timeStr, minutesToRespond) =>
    `A slot opened up on ${dateStr} at ${timeStr}. Reply 1 within ${minutesToRespond} minutes to take it.`,

  depositRequired: (amount) =>
    `A deposit of ₪${amount} is required to confirm the appointment. We'll send you a payment link. If it's not paid within 30 minutes, the slot will be released.`,

  birthday: (clientName) =>
    `🎉 Happy birthday ${clientName}! A gift for you: 15% off your next haircut this month. See you soon!`,

  loyaltyReward: (clientName) =>
    `🎁 ${clientName}, you've reached 10 haircuts with us. Your next one is 100% off. Thanks for your trust!`,

  emptySlotCampaign: (dateStr, timeStr) =>
    `A slot opened up today at ${timeStr} (${dateStr}). Type "menu" to book it.`,

  noShowWarning: (clientName) =>
    `${clientName} didn't show up for their appointment. A deposit will now be required to book.`,

  comebackReminder: (clientName) =>
    `Hi ${clientName}! It's been a month since your last haircut ✂️ Feel free to book a new one — type "menu".`,
};

const templatesEs: TemplateSet = {
  bookingConfirmed: (clientName, dateStr, timeStr, serviceName, staffName) =>
    `¡Hola ${clientName}! Tu turno fue confirmado:\n📅 ${dateStr} a las ${timeStr}\n✂️ ${serviceName} con ${staffName}\n\nPara cancelar, escribí "menu" y elegí cancelar turno.`,

  staffNewBooking: (clientName, dateStr, timeStr, serviceName) =>
    `Turno nuevo: ${clientName} — ${serviceName} el ${dateStr} a las ${timeStr}.`,

  reminder: (clientName, dateStr, timeStr) =>
    `Hola ${clientName}, te recordamos tu turno del ${dateStr} a las ${timeStr}.\nRespondé 1 para confirmar o 2 para cancelar.`,

  cancelledByClient: (clientName, dateStr, timeStr) =>
    `${clientName} canceló el turno del ${dateStr} a las ${timeStr}.`,

  waitlistOffer: (dateStr, timeStr, minutesToRespond) =>
    `Se liberó un turno el ${dateStr} a las ${timeStr}. Respondé 1 dentro de ${minutesToRespond} minutos para tomarlo.`,

  depositRequired: (amount) =>
    `Para confirmar el turno hace falta una seña de ₪${amount}. Te enviamos un link de pago. Si no se paga en 30 minutos, el horario se libera.`,

  birthday: (clientName) =>
    `🎉 ¡Feliz cumpleaños ${clientName}! Un regalo para vos: 15% de descuento en tu próximo corte este mes. ¡Te esperamos!`,

  loyaltyReward: (clientName) =>
    `🎁 ${clientName}, llegaste a 10 cortes con nosotros. Tu próximo corte tiene 100% de descuento. ¡Gracias por tu confianza!`,

  emptySlotCampaign: (dateStr, timeStr) =>
    `Se liberó un turno hoy a las ${timeStr} (${dateStr}). Escribí "menu" para reservarlo.`,

  noShowWarning: (clientName) =>
    `${clientName} no se presentó al turno. De ahora en más va a necesitar seña para reservar.`,

  comebackReminder: (clientName) =>
    `¡Hola ${clientName}! Ya pasó un mes desde tu último corte ✂️ Te invitamos a reservar uno nuevo — escribí "menu".`,
};

const TEMPLATE_SETS: Record<string, TemplateSet> = { he: templatesHe, en: templatesEn, es: templatesEs };

export function getTemplates(language?: string): TemplateSet {
  return TEMPLATE_SETS[language ?? ''] ?? templatesHe;
}
