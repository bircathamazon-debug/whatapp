import { onRequest } from 'firebase-functions/v2/https';
import { db } from './admin';
import type { Appointment, Branch, BlockedTime, Service, Staff } from './types';
import { createAppointment, confirmAppointment, cancelAppointment, formatDate, formatTime } from './booking';
import { getAvailableSlots, getStaffServiceDuration } from './availability';
import { getIvrStrings } from './ivrStrings';
import { getTelnyxConfig } from './telnyx';

/**
 * IVR telefónico con Telnyx (TeXML: mismas etiquetas <Gather>/<Say>/<Dial> que
 * TwiML de Twilio, Telnyx las traduce igual) en el idioma de la sucursal,
 * para clientes con teléfono kasher que no pueden usar WhatsApp. Flujo:
 *  1 = reservar un turno (elegir día y hora, igual que por WhatsApp)
 *  2 = cancelar mi próxima cita
 *  3 = escuchar los horarios disponibles de un día, sin reservar
 *  0 = hablar con la peluquería (transferencia a la línea directa)
 *
 * Configurar en el portal de Telnyx: crear una "TeXML Application" con
 * Voice Method = POST y la URL del webhook ->
 * https://<region>-<project>.cloudfunctions.net/ivrIncomingCall?branchId=<ID>,
 * y asignarle el número comprado en la pestaña "Numbers" de esa misma
 * aplicación.
 *
 * El estado de una llamada en curso (qué día eligió, qué horas se le
 * ofrecieron) se guarda en Firestore (`ivrSessions/{CallSid}`, igual que
 * `waConversations/{phone}` para WhatsApp) porque Telnyx no mantiene estado
 * entre un <Gather> y el siguiente — cada paso es un pedido HTTP nuevo.
 * `CallSid` lo manda Telnyx solo en cada pedido, no hace falta pasarlo a
 * mano por la URL.
 */

const DAYS_TO_OFFER = 4; // acotado para que el menú hablado no sea eterno
const MAX_TIME_OPTIONS = 6; // un dígito por hora (1-6)

interface SlotWithStaff {
  startsAt: number;
  endsAt: number;
  staffId: string;
}

interface IvrSessionData {
  intent: 'book' | 'schedule';
  clientPhone: string;
  dateOptions: { dateStr: string; label: string }[];
  dateStr?: string;
  dateLabel?: string;
  slots?: SlotWithStaff[];
}

interface IvrSession {
  branchId: string;
  data: IvrSessionData;
}

export const ivrIncomingCall = onRequest(async (req, res) => {
  const branchId = String(req.query.branchId ?? req.body.branchId ?? '');
  const branchSnap = branchId ? await db.collection('branches').doc(branchId).get() : null;
  const branch = branchSnap?.exists ? (branchSnap.data() as Branch) : null;
  const s = getIvrStrings(branch?.language);

  res.set('Content-Type', 'text/xml');

  // Interruptor de emergencia: si el peluquero activó "modo mantenimiento"
  // en Ajustes, no se ofrece el menú automático — se transfiere directo.
  if (branch?.maintenanceMode) {
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${s.sayLang}" voice="${s.sayVoice}">${s.maintenanceMessage}</Say>
  <Dial callerId="${callerId()}">${branch.phone}</Dial>
</Response>`);
    return;
  }

  const base = process.env.FUNCTIONS_BASE_URL ?? '';
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${base}/ivrMenu?branchId=${branchId}" method="POST" timeout="8">
    <Say language="${s.sayLang}" voice="${s.sayVoice}">${s.greeting}</Say>
  </Gather>
  <Say language="${s.sayLang}" voice="${s.sayVoice}">${s.noChoice}</Say>
</Response>`);
});

export const ivrMenu = onRequest(async (req, res) => {
  const digit = String(req.body.Digits ?? '');
  const from = normalizePhone(String(req.body.From ?? ''));
  const callSid = String(req.body.CallSid ?? '');
  const branchId = String(req.query.branchId ?? '');

  res.set('Content-Type', 'text/xml');

  const branchSnap = await db.collection('branches').doc(branchId).get();
  const branch = branchSnap.exists ? (branchSnap.data() as Branch) : null;
  const s = getIvrStrings(branch?.language);
  if (!branch) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.systemError));
    return;
  }

  if (digit === '0') {
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${callerId()}">${branch.phone}</Dial></Response>`);
    return;
  }

  if (digit === '2') {
    const next = await findNextAppointment(from);
    if (!next) {
      res.send(sayAndHangup(s.sayLang, s.sayVoice, s.noAppointmentFound));
      return;
    }
    await cancelAppointment(next.id, 'client');
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.appointmentCancelled));
    return;
  }

  if (digit === '1' || digit === '3') {
    const dateOptions = buildDateOptions(branch);
    await saveIvrSession(callSid, { branchId, data: { intent: digit === '1' ? 'book' : 'schedule', clientPhone: from, dateOptions } });

    const base = process.env.FUNCTIONS_BASE_URL ?? '';
    const intro = digit === '1' ? s.askDayIntro : s.askDayIntroSchedule;
    const daySpeech = [intro, ...dateOptions.map((d, i) => s.dayOption(i + 1, d.label))].join(' ');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${base}/ivrDay?branchId=${branchId}" method="POST" timeout="8">
    <Say language="${s.sayLang}" voice="${s.sayVoice}">${daySpeech}</Say>
  </Gather>
  <Say language="${s.sayLang}" voice="${s.sayVoice}">${s.noChoice}</Say>
</Response>`);
    return;
  }

  res.send(sayAndHangup(s.sayLang, s.sayVoice, s.invalidChoice));
});

/** Procesa el día elegido (apretado en respuesta a ivrMenu). Si la llamada
 * venía de la opción "escuchar horarios" (3), lee la lista y cuelga; si
 * venía de "reservar" (1), pregunta la hora con otro <Gather>. */
export const ivrDay = onRequest(async (req, res) => {
  const digit = String(req.body.Digits ?? '');
  const callSid = String(req.body.CallSid ?? '');
  const branchId = String(req.query.branchId ?? '');

  res.set('Content-Type', 'text/xml');

  const branchSnap = await db.collection('branches').doc(branchId).get();
  const branch = branchSnap.exists ? (branchSnap.data() as Branch) : null;
  const s = getIvrStrings(branch?.language);
  const session = await getIvrSession(callSid);
  if (!branch || !session) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.systemError));
    return;
  }

  const chosen = session.data.dateOptions[Number(digit) - 1];
  if (!chosen) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.invalidChoice));
    return;
  }

  const servicesSnap = await db.collection('services').where('branchId', '==', branch.id).limit(1).get();
  if (servicesSnap.empty) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.noSlotsAvailable));
    return;
  }
  const service = servicesSnap.docs[0].data() as Service;
  const staffSnap = await db.collection('staff').where('branchId', '==', branch.id).where('active', '==', true).get();
  const staffList = staffSnap.docs.map((d) => d.data() as Staff);

  const allSlots = await availableSlotsForDay(branch, staffList, service, chosen.dateStr);
  if (allSlots.length === 0) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.noSlotsThatDay(chosen.label)));
    return;
  }
  const displaySlots = allSlots.slice(0, MAX_TIME_OPTIONS);

  if (session.data.intent === 'schedule') {
    const times = displaySlots.map((sl) => formatTime(sl.startsAt, branch.timezone));
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.scheduleResult(chosen.label, times)));
    return;
  }

  await saveIvrSession(callSid, { branchId, data: { ...session.data, dateStr: chosen.dateStr, dateLabel: chosen.label, slots: displaySlots } });

  const base = process.env.FUNCTIONS_BASE_URL ?? '';
  const timeSpeech = [
    s.askTimeIntro(chosen.label),
    ...displaySlots.map((sl, i) => s.timeOption(i + 1, formatTime(sl.startsAt, branch.timezone))),
  ].join(' ');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${base}/ivrTime?branchId=${branchId}" method="POST" timeout="8">
    <Say language="${s.sayLang}" voice="${s.sayVoice}">${timeSpeech}</Say>
  </Gather>
  <Say language="${s.sayLang}" voice="${s.sayVoice}">${s.noChoice}</Say>
</Response>`);
});

/** Procesa la hora elegida y crea la cita (transacción anti-doble-reserva,
 * misma que usan WhatsApp y el panel — ver booking.ts). */
export const ivrTime = onRequest(async (req, res) => {
  const digit = String(req.body.Digits ?? '');
  const callSid = String(req.body.CallSid ?? '');
  const branchId = String(req.query.branchId ?? '');

  res.set('Content-Type', 'text/xml');

  const branchSnap = await db.collection('branches').doc(branchId).get();
  const branch = branchSnap.exists ? (branchSnap.data() as Branch) : null;
  const s = getIvrStrings(branch?.language);
  const session = await getIvrSession(callSid);
  if (!branch || !session) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.systemError));
    return;
  }

  const slot = session.data.slots?.[Number(digit) - 1];
  if (!slot) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.invalidChoice));
    return;
  }

  const servicesSnap = await db.collection('services').where('branchId', '==', branch.id).limit(1).get();
  const staffSnap = await db.collection('staff').doc(slot.staffId).get();
  if (servicesSnap.empty || !staffSnap.exists) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.systemError));
    return;
  }
  const service = servicesSnap.docs[0].data() as Service;
  const staff = staffSnap.data() as Staff;

  try {
    const appt = await createAppointment({
      branch,
      staff,
      service,
      clientPhone: session.data.clientPhone,
      clientName: s.defaultPhoneClientName,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      source: 'phone',
    });
    await deleteIvrSession(callSid);
    const dateStr = formatDate(appt.startsAt, branch.timezone);
    const timeStr = formatTime(appt.startsAt, branch.timezone);
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.appointmentBooked(dateStr, timeStr)));
  } catch {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.slotTakenPhone));
  }
});

/** Llamada saliente (crons.ts la usa a través de notify.dispatchTelnyx) al presionar 1/2 en la llamada de recordatorio. */
export const ivrReminderResponse = onRequest(async (req, res) => {
  const digit = String(req.body.Digits ?? '');
  const appointmentId = String(req.query.appointmentId ?? '');
  const s = getIvrStrings(req.query.lang as string | undefined);
  res.set('Content-Type', 'text/xml');

  if (!appointmentId) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.reminderError));
    return;
  }

  if (digit === '1') {
    await confirmAppointment(appointmentId);
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.reminderConfirmed));
  } else if (digit === '2') {
    await cancelAppointment(appointmentId, 'client');
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.reminderCancelled));
  } else {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.invalidChoice));
  }
});

async function findNextAppointment(clientPhone: string): Promise<Appointment | null> {
  const snap = await db
    .collection('appointments')
    .where('clientPhone', '==', clientPhone)
    .where('status', 'in', ['confirmed', 'pending_deposit'])
    .orderBy('startsAt', 'asc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as Appointment;
}

/** Huecos libres de un día para una lista de peluqueros (cada uno con su
 * propia duración de servicio si la configuró), juntos y ordenados —
 * misma lógica que `availableSlotsForDay` de bot/conversation.js. */
async function availableSlotsForDay(branch: Branch, staffList: Staff[], service: Service, dateStr: string): Promise<SlotWithStaff[]> {
  const blockedSnap = await db.collection('blockedTimes').where('branchId', '==', branch.id).where('date', '==', dateStr).get();
  const blockedTimes = blockedSnap.docs.map((d) => d.data() as BlockedTime);

  const allSlots: SlotWithStaff[] = [];
  for (const staff of staffList) {
    const apptsSnap = await db.collection('appointments').where('staffId', '==', staff.id).where('status', 'in', ['confirmed', 'pending_deposit']).get();
    const existing = apptsSnap.docs.map((d) => d.data() as Appointment).map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt }));
    const duration = getStaffServiceDuration(staff, service);
    const slots = getAvailableSlots(staff, duration, dateStr, existing, branch.timezone, Date.now(), blockedTimes);
    allSlots.push(...slots.map((sl) => ({ ...sl, staffId: staff.id })));
  }
  allSlots.sort((a, b) => a.startsAt - b.startsAt);
  return allSlots;
}

/** "Hoy" / "mañana" / fecha numérica para los próximos DAYS_TO_OFFER días
 * (sin nombre de día de semana, para que el menú hablado sea más corto). */
function buildDateOptions(branch: Branch): { dateStr: string; label: string }[] {
  const s = getIvrStrings(branch.language);
  const options: { dateStr: string; label: string }[] = [];
  const now = Date.now();
  for (let i = 0; i < DAYS_TO_OFFER; i++) {
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: branch.timezone }).format(now + i * 86400000);
    const label = i === 0 ? s.today : i === 1 ? s.tomorrow : `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;
    options.push({ dateStr, label });
  }
  return options;
}

async function getIvrSession(callSid: string): Promise<IvrSession | null> {
  if (!callSid) return null;
  const snap = await db.collection('ivrSessions').doc(callSid).get();
  return snap.exists ? (snap.data() as IvrSession) : null;
}

async function saveIvrSession(callSid: string, session: IvrSession): Promise<void> {
  if (!callSid) return;
  await db.collection('ivrSessions').doc(callSid).set({ ...session, updatedAt: Date.now() });
}

async function deleteIvrSession(callSid: string): Promise<void> {
  if (!callSid) return;
  await db.collection('ivrSessions').doc(callSid).delete();
}

function sayAndHangup(lang: string, voice: string, text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="${lang}" voice="${voice}">${text}</Say><Hangup/></Response>`;
}

function normalizePhone(from: string): string {
  return from; // Telnyx ya entrega el From en formato E.164
}

/** Caller ID para transferencias (<Dial>): el número de Telnyx, si está configurado. */
function callerId(): string {
  return getTelnyxConfig()?.phoneNumber ?? '';
}
