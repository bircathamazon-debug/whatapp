import { db } from './admin';
import { getTelnyxConfig, createTelnyxCall, sendTelnyxSms } from './telnyx';
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
 * llamadas salen directo por la API REST de Telnyx.
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
    // Telnyx no soporta "enviar más tarde" nativamente para SMS/voz de forma
    // sencilla: para respetar el modo silencioso encolamos igual y un cron
    // (flushDueTelnyxNotifications) lo despacha cuando toca.
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

  await dispatchTelnyx(args.channel, args.to, args.text, args.relatedAppointmentId, args.awaitingReply, args.branch.language);
}

export async function dispatchTelnyx(
  channel: 'sms' | 'call',
  to: string,
  text: string,
  relatedAppointmentId?: string | null,
  awaitingReply?: 'confirm_cancel' | 'waitlist_offer' | null,
  language?: string
): Promise<void> {
  const config = getTelnyxConfig();
  if (!config) {
    console.warn('[notify] Telnyx no configurado; se omite envío real', { channel, to, text });
    return;
  }
  if (channel === 'sms') {
    await sendTelnyxSms(config, to, text);
    return;
  }

  // Llamada con texto a voz en el idioma de la sucursal (Say soporta varios
  // locales vía Polly/Azure). Si esperamos respuesta (confirmar/cancelar), se
  // agrega un <Gather> que redirige a ivrReminderResponse para procesar el
  // dígito presionado, pasándole el idioma para que responda igual.
  const s = getIvrStrings(language);
  const base = process.env.FUNCTIONS_BASE_URL;
  let texml: string;
  if (awaitingReply === 'confirm_cancel' && relatedAppointmentId && base) {
    texml = `<Response><Gather numDigits="1" action="${base}/ivrReminderResponse?appointmentId=${relatedAppointmentId}&amp;lang=${language ?? 'he'}" method="POST" timeout="8"><Say language="${s.sayLang}" voice="${s.sayVoice}">${escapeXml(
      text
    )}</Say></Gather><Say language="${s.sayLang}" voice="${s.sayVoice}">${s.noChoice}</Say></Response>`;
  } else {
    texml = `<Response><Say language="${s.sayLang}" voice="${s.sayVoice}">${escapeXml(text)}</Say></Response>`;
  }
  await createTelnyxCall(config, to, texml);
}

/** Cron: despacha por Telnyx los mensajes sms/call cuya deliverAfter ya llegó. */
export async function flushDueTelnyxNotifications(): Promise<number> {
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
      await dispatchTelnyx(data.channel, data.to, data.text, data.relatedAppointmentId, data.awaitingReply, data.language);
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
  weekdayDiscountCampaign: (percent: number, daysLabel: string) => string;
  noShowWarning: (clientName: string) => string;
  comebackReminder: (clientName: string) => string;
}

const templatesHe: TemplateSet = {
  bookingConfirmed: (clientName, dateStr, timeStr, serviceName, staffName) =>
    `✅ *התור שלך אושר*\n──────────\n👤 ${clientName}\n✂️ ${serviceName}\n💈 ${staffName}\n📅 ${dateStr} | 🕐 ${timeStr}\n──────────\nלביטול: כתבו "menu"`,

  staffNewBooking: (clientName, dateStr, timeStr, serviceName) =>
    `תור חדש: ${clientName} — ${serviceName} בתאריך ${dateStr} בשעה ${timeStr}.`,

  reminder: (clientName, dateStr, timeStr) =>
    `⏰ *תזכורת לתור שלך*\n──────────\n👤 ${clientName}\n📅 ${dateStr} | 🕐 ${timeStr}\n──────────\n*1* · לאישור     *2* · לביטול`,

  cancelledByClient: (clientName, dateStr, timeStr) =>
    `${clientName} ביטל/ה את התור מתאריך ${dateStr} בשעה ${timeStr}.`,

  waitlistOffer: (dateStr, timeStr, minutesToRespond) =>
    `התפנה תור בתאריך ${dateStr} בשעה ${timeStr}. השיבו 1 בתוך ${minutesToRespond} דקות כדי לתפוס אותו.`,

  depositRequired: (amount) =>
    `כדי לאשר את התור צריך מקדמה של ₪${amount}. נשלח לך קישור לתשלום.`,

  birthday: (clientName) =>
    `🎉 יום הולדת שמח ${clientName}! מתנה בשבילך: 15% הנחה על התספורת הבאה החודש. מחכים לך!`,

  loyaltyReward: (clientName) =>
    `🎁 ${clientName}, הגעת ל-10 תספורות אצלנו. התספורת הבאה שלך ב-100% הנחה. תודה על האמון!`,

  emptySlotCampaign: (dateStr, timeStr) =>
    `התפנה תור היום בשעה ${timeStr} (${dateStr}). כתבו "menu" כדי לקבוע.`,

  weekdayDiscountCampaign: (percent, daysLabel) =>
    `✂️ ${percent}% הנחה ב${daysLabel}! כתבו "menu" כדי לקבוע תור.`,

  noShowWarning: (clientName) =>
    `${clientName} לא הגיע/ה לתור. מעכשיו יידרש מקדמה כדי לקבוע תור.`,

  comebackReminder: (clientName) =>
    `שלום ${clientName}! עבר כבר חודש מהתספורת האחרונה שלך ✂️ מוזמנים לקבוע תור חדש — כתבו "menu".`,
};

const templatesEn: TemplateSet = {
  bookingConfirmed: (clientName, dateStr, timeStr, serviceName, staffName) =>
    `✅ *Your appointment is confirmed*\n──────────\n👤 ${clientName}\n✂️ ${serviceName}\n💈 ${staffName}\n📅 ${dateStr} | 🕐 ${timeStr}\n──────────\nTo cancel: type "menu"`,

  staffNewBooking: (clientName, dateStr, timeStr, serviceName) =>
    `New booking: ${clientName} — ${serviceName} on ${dateStr} at ${timeStr}.`,

  reminder: (clientName, dateStr, timeStr) =>
    `⏰ *Appointment reminder*\n──────────\n👤 ${clientName}\n📅 ${dateStr} | 🕐 ${timeStr}\n──────────\n*1* · Confirm     *2* · Cancel`,

  cancelledByClient: (clientName, dateStr, timeStr) =>
    `${clientName} cancelled their appointment on ${dateStr} at ${timeStr}.`,

  waitlistOffer: (dateStr, timeStr, minutesToRespond) =>
    `A slot opened up on ${dateStr} at ${timeStr}. Reply 1 within ${minutesToRespond} minutes to take it.`,

  depositRequired: (amount) =>
    `A deposit of ₪${amount} is required to confirm the appointment. We'll send you a payment link.`,

  birthday: (clientName) =>
    `🎉 Happy birthday ${clientName}! A gift for you: 15% off your next haircut this month. See you soon!`,

  loyaltyReward: (clientName) =>
    `🎁 ${clientName}, you've reached 10 haircuts with us. Your next one is 100% off. Thanks for your trust!`,

  emptySlotCampaign: (dateStr, timeStr) =>
    `A slot opened up today at ${timeStr} (${dateStr}). Type "menu" to book it.`,

  weekdayDiscountCampaign: (percent, daysLabel) =>
    `✂️ ${percent}% off on ${daysLabel}! Type "menu" to book an appointment.`,

  noShowWarning: (clientName) =>
    `${clientName} didn't show up for their appointment. A deposit will now be required to book.`,

  comebackReminder: (clientName) =>
    `Hi ${clientName}! It's been a month since your last haircut ✂️ Feel free to book a new one — type "menu".`,
};

const templatesEs: TemplateSet = {
  bookingConfirmed: (clientName, dateStr, timeStr, serviceName, staffName) =>
    `✅ *Tu turno fue confirmado*\n──────────\n👤 ${clientName}\n✂️ ${serviceName}\n💈 ${staffName}\n📅 ${dateStr} | 🕐 ${timeStr}\n──────────\nPara cancelar: escribí "menu"`,

  staffNewBooking: (clientName, dateStr, timeStr, serviceName) =>
    `Turno nuevo: ${clientName} — ${serviceName} el ${dateStr} a las ${timeStr}.`,

  reminder: (clientName, dateStr, timeStr) =>
    `⏰ *Recordatorio de tu turno*\n──────────\n👤 ${clientName}\n📅 ${dateStr} | 🕐 ${timeStr}\n──────────\n*1* · Confirmar     *2* · Cancelar`,

  cancelledByClient: (clientName, dateStr, timeStr) =>
    `${clientName} canceló el turno del ${dateStr} a las ${timeStr}.`,

  waitlistOffer: (dateStr, timeStr, minutesToRespond) =>
    `Se liberó un turno el ${dateStr} a las ${timeStr}. Respondé 1 dentro de ${minutesToRespond} minutos para tomarlo.`,

  depositRequired: (amount) =>
    `Para confirmar el turno hace falta una seña de ₪${amount}. Te enviamos un link de pago.`,

  birthday: (clientName) =>
    `🎉 ¡Feliz cumpleaños ${clientName}! Un regalo para vos: 15% de descuento en tu próximo corte este mes. ¡Te esperamos!`,

  loyaltyReward: (clientName) =>
    `🎁 ${clientName}, llegaste a 10 cortes con nosotros. Tu próximo corte tiene 100% de descuento. ¡Gracias por tu confianza!`,

  emptySlotCampaign: (dateStr, timeStr) =>
    `Se liberó un turno hoy a las ${timeStr} (${dateStr}). Escribí "menu" para reservarlo.`,

  weekdayDiscountCampaign: (percent, daysLabel) =>
    `✂️ ¡${percent}% de descuento los ${daysLabel}! Escribí "menu" para reservar tu turno.`,

  noShowWarning: (clientName) =>
    `${clientName} no se presentó al turno. De ahora en más va a necesitar seña para reservar.`,

  comebackReminder: (clientName) =>
    `¡Hola ${clientName}! Ya pasó un mes desde tu último corte ✂️ Te invitamos a reservar uno nuevo — escribí "menu".`,
};

const TEMPLATE_SETS: Record<string, TemplateSet> = { he: templatesHe, en: templatesEn, es: templatesEs };

export function getTemplates(language?: string): TemplateSet {
  return TEMPLATE_SETS[language ?? ''] ?? templatesHe;
}
