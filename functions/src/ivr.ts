import { onRequest } from 'firebase-functions/v2/https';
import { db } from './admin';
import type { Appointment, Branch, BlockedTime, Service, Staff } from './types';
import { createAppointment, confirmAppointment, cancelAppointment, formatDate, formatTime } from './booking';
import { getAvailableSlots, getStaffServiceDuration, toEpoch } from './availability';
import { getIvrStrings, IvrStrings } from './ivrStrings';
import { getTelnyxConfig } from './telnyx';

/**
 * IVR telefónico con Telnyx (TeXML: mismas etiquetas <Gather>/<Say>/<Dial> que
 * TwiML de Twilio, Telnyx las traduce igual) en el idioma de la sucursal,
 * para clientes con teléfono kasher que no pueden usar WhatsApp. Flujo:
 *  1 = reservar un turno (elegir día por nombre del día de la semana,
 *      después escribir la hora con el teclado, y confirmar antes de
 *      agendar)
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
 * El estado de una llamada en curso (qué día eligió, qué hora escribió) se
 * guarda en Firestore (`ivrSessions/{CallSid}`, igual que
 * `waConversations/{phone}` para WhatsApp) porque Telnyx no mantiene estado
 * entre un <Gather> y el siguiente — cada paso es un pedido HTTP nuevo.
 * `CallSid` lo manda Telnyx solo en cada pedido, no hace falta pasarlo a
 * mano por la URL.
 *
 * El día se identifica siempre con el mismo número en cualquier llamada:
 * domingo=1, lunes=2, martes=3, miércoles=4, jueves=5, viernes=6, sábado=7
 * (igual que en hebreo los días de la semana ya se nombran así — "יום
 * ראשון", "יום שני"...). Se ofrece una semana completa (7 días) a partir
 * de hoy, así cada número aparece una sola vez y un cliente que ya conoce
 * el sistema puede apretar directamente el día que quiere sin escuchar
 * todo el menú.
 */

const DAYS_TO_OFFER = 7; // una semana completa: cada día de la semana aparece una sola vez
const MAX_SCHEDULE_TIMES = 6; // tope al leer la lista de horarios libres (opción "escuchar horarios")

interface SlotWithStaff {
  startsAt: number;
  endsAt: number;
  staffId: string;
}

interface DateOption {
  dateStr: string;
  digit: number; // domingo=1 ... sábado=7, fijo sin importar qué día es "hoy"
  label: string;
}

interface IvrSessionData {
  intent: 'book' | 'schedule';
  clientPhone: string;
  dateOptions: DateOption[];
  dateStr?: string;
  dateLabel?: string;
  pendingSlot?: SlotWithStaff;
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
    const daySpeech = [intro, ...dateOptions.map((d) => s.dayOption(d.digit, d.label))].join(' ');
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

/** Procesa el día elegido (apretado en respuesta a ivrMenu, identificado
 * siempre por el mismo número de día de semana). Si la llamada venía de
 * la opción "escuchar horarios" (3), lee la lista y cuelga; si venía de
 * "reservar" (1), pide que escriban la hora con el teclado. */
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

  const chosen = session.data.dateOptions.find((d) => d.digit === Number(digit));
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

  if (session.data.intent === 'schedule') {
    const times = allSlots.slice(0, MAX_SCHEDULE_TIMES).map((sl) => formatTime(sl.startsAt, branch.timezone));
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.scheduleResult(chosen.label, times)));
    return;
  }

  await saveIvrSession(callSid, { branchId, data: { ...session.data, dateStr: chosen.dateStr, dateLabel: chosen.label } });
  const base = process.env.FUNCTIONS_BASE_URL ?? '';
  res.send(askTimeGather(base, branchId, s, chosen.label));
});

/** Procesa la hora escrita con el teclado (terminada en #). Busca el hueco
 * exacto; si no existe, prueba redondear a múltiplos de 15 minutos y, para
 * horas de 1 a 11, también la tarde (ej. "3" podría ser 3pm) — misma
 * lógica que usa el bot de WhatsApp cuando el cliente escribe una hora a
 * mano (ver resolveTypedTime en bot/conversation.js). Si encuentra un
 * horario, pide confirmación antes de reservar. */
export const ivrTimeTyped = onRequest(async (req, res) => {
  const digits = String(req.body.Digits ?? '');
  const callSid = String(req.body.CallSid ?? '');
  const branchId = String(req.query.branchId ?? '');

  res.set('Content-Type', 'text/xml');

  const branchSnap = await db.collection('branches').doc(branchId).get();
  const branch = branchSnap.exists ? (branchSnap.data() as Branch) : null;
  const s = getIvrStrings(branch?.language);
  const session = await getIvrSession(callSid);
  const base = process.env.FUNCTIONS_BASE_URL ?? '';
  if (!branch || !session || !session.data.dateStr || !session.data.dateLabel) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.systemError));
    return;
  }

  const typed = parseDigitsToTime(digits);
  if (!typed) {
    res.send(askTimeGather(base, branchId, s, session.data.dateLabel, s.invalidTimeEntry));
    return;
  }

  const servicesSnap = await db.collection('services').where('branchId', '==', branch.id).limit(1).get();
  const staffSnap = await db.collection('staff').where('branchId', '==', branch.id).where('active', '==', true).get();
  if (servicesSnap.empty || staffSnap.empty) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.systemError));
    return;
  }
  const service = servicesSnap.docs[0].data() as Service;
  const staffList = staffSnap.docs.map((d) => d.data() as Staff);
  const allSlots = await availableSlotsForDay(branch, staffList, service, session.data.dateStr);

  const match = resolveTypedTime(branch, session.data.dateStr, allSlots, typed);
  if (!match) {
    res.send(askTimeGather(base, branchId, s, session.data.dateLabel, s.invalidTimeEntry));
    return;
  }

  await saveIvrSession(callSid, { branchId, data: { ...session.data, pendingSlot: match } });
  const timeStr = formatTime(match.startsAt, branch.timezone);
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${base}/ivrConfirm?branchId=${branchId}" method="POST" timeout="8">
    <Say language="${s.sayLang}" voice="${s.sayVoice}">${s.confirmBooking(session.data.dateLabel, timeStr)}</Say>
  </Gather>
  <Say language="${s.sayLang}" voice="${s.sayVoice}">${s.noChoice}</Say>
</Response>`);
});

/** Confirma (1) o descarta (cualquier otra tecla) el día+hora leídos por
 * ivrTimeTyped. Confirmar crea la cita de verdad (misma transacción
 * anti-doble-reserva que usan WhatsApp y el panel — ver booking.ts). */
export const ivrConfirm = onRequest(async (req, res) => {
  const digit = String(req.body.Digits ?? '');
  const callSid = String(req.body.CallSid ?? '');
  const branchId = String(req.query.branchId ?? '');

  res.set('Content-Type', 'text/xml');

  const branchSnap = await db.collection('branches').doc(branchId).get();
  const branch = branchSnap.exists ? (branchSnap.data() as Branch) : null;
  const s = getIvrStrings(branch?.language);
  const session = await getIvrSession(callSid);
  if (!branch || !session || !session.data.pendingSlot || !session.data.dateLabel) {
    res.send(sayAndHangup(s.sayLang, s.sayVoice, s.systemError));
    return;
  }

  if (digit !== '1') {
    const base = process.env.FUNCTIONS_BASE_URL ?? '';
    await saveIvrSession(callSid, { branchId, data: { ...session.data, pendingSlot: undefined } });
    res.send(askTimeGather(base, branchId, s, session.data.dateLabel));
    return;
  }

  const slot = session.data.pendingSlot;
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

/** Los próximos DAYS_TO_OFFER días (una semana completa), cada uno con su
 * nombre de día de semana y el número fijo que le corresponde (domingo=1
 * ... sábado=7) — el mismo número de "yom rishón"/"yom shení" etc. que ya
 * usa el hebreo, así un cliente habitual aprende a apretar directo el día
 * que quiere sin tener que escuchar todo el menú. */
function buildDateOptions(branch: Branch): DateOption[] {
  const s = getIvrStrings(branch.language);
  const options: DateOption[] = [];
  const now = Date.now();
  for (let i = 0; i < DAYS_TO_OFFER; i++) {
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: branch.timezone }).format(now + i * 86400000);
    const weekday = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=domingo ... 6=sábado
    options.push({ dateStr, digit: weekday + 1, label: s.weekdays[weekday] });
  }
  return options;
}

/** Interpreta los dígitos escritos con el teclado como hora:hora:minuto.
 * 1-2 dígitos = solo la hora ("9" -> 9:00, "17" -> 17:00). 3 dígitos = hora
 * de un dígito + minutos ("930" -> 9:30). 4 dígitos = hora de dos dígitos +
 * minutos ("1730" -> 17:30). */
function parseDigitsToTime(raw: string): { h: number; m: number } | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return null;
  let h: number;
  let m: number;
  if (digits.length <= 2) {
    h = Number(digits);
    m = 0;
  } else if (digits.length === 3) {
    h = Number(digits.slice(0, 1));
    m = Number(digits.slice(1));
  } else {
    h = Number(digits.slice(0, 2));
    m = Number(digits.slice(2, 4));
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function hhmm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Candidatos de 15 en 15 minutos más cercanos al minuto escrito (los
 * turnos siempre caen en :00/:15/:30/:45), ordenados del más cercano al
 * más lejano — misma lógica que quarterCandidates() de bot/conversation.js. */
function quarterCandidates(m: number): { hourOffset: number; m: number; dist: number }[] {
  if (m % 15 === 0) return [{ hourOffset: 0, m, dist: 0 }];
  const lower = Math.floor(m / 15) * 15;
  const upperM = lower + 15;
  const upper = upperM === 60 ? { hourOffset: 1, m: 0 } : { hourOffset: 0, m: upperM };
  return [
    { hourOffset: 0, m: lower, dist: m - lower },
    { ...upper, dist: upperM - m },
  ].sort((a, b) => a.dist - b.dist);
}

/** Busca el hueco que mejor corresponde a la hora escrita: primero el
 * horario exacto, después redondeando a múltiplos de 15 minutos, y para
 * horas de 1 a 11 también probando la tarde (ej. "3" con 3pm) — misma
 * idea que resolveTypedTime() de bot/conversation.js. */
function resolveTypedTime(branch: Branch, dateStr: string, allSlots: SlotWithStaff[], typed: { h: number; m: number }): SlotWithStaff | null {
  const literalEpoch = toEpoch(dateStr, hhmm(typed.h, typed.m), branch.timezone);
  const literalSlot = allSlots.find((sl) => sl.startsAt === literalEpoch);
  if (literalSlot) return literalSlot;

  const hourCandidates = [typed.h];
  if (typed.h >= 1 && typed.h <= 11) hourCandidates.push(typed.h + 12);

  for (const h of hourCandidates) {
    for (const q of quarterCandidates(typed.m)) {
      const qh = (h + q.hourOffset) % 24;
      const epoch = toEpoch(dateStr, hhmm(qh, q.m), branch.timezone);
      if (epoch === literalEpoch) continue;
      const slot = allSlots.find((sl) => sl.startsAt === epoch);
      if (slot) return slot;
    }
  }
  return null;
}

/** TeXML para pedir la hora escrita con el teclado: sin numDigits fijo,
 * termina al apretar # (finishOnKey, por defecto en Telnyx) o a los pocos
 * segundos entre dígitos. `errorPrefix` opcional se antepone cuando se
 * repite el pedido por una hora inválida. */
function askTimeGather(base: string, branchId: string, s: IvrStrings, dayLabel: string, errorPrefix?: string): string {
  const speech = `${errorPrefix ? errorPrefix + ' ' : ''}${s.askTimeTypedIntro(dayLabel)}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather finishOnKey="#" timeout="6" maxDigits="4" action="${base}/ivrTimeTyped?branchId=${branchId}" method="POST">
    <Say language="${s.sayLang}" voice="${s.sayVoice}">${speech}</Say>
  </Gather>
  <Say language="${s.sayLang}" voice="${s.sayVoice}">${s.noChoice}</Say>
</Response>`;
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
