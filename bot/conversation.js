/**
 * Máquina de estados de la conversación de reserva por WhatsApp.
 * El estado de cada cliente se persiste en Firestore (waConversations/{phone})
 * para sobrevivir reinicios del bot.
 *
 * Los textos que ve el cliente salen de i18n.js según branch.language
 * (hebreo por defecto). Los comentarios del código quedan en español para
 * quien mantiene el proyecto.
 */
import { db } from './firebaseClient.js';
import { getAvailableSlots, getStaffServiceDuration, toEpoch } from './availability.js';
import * as api from './botApiClient.js';
import { t, weekdayNames, dateLocale, isGreeting, isYes } from './i18n.js';

const CONV_COL = 'waConversations';
const DAYS_TO_OFFER = 6;

function normalizePhone(jid) {
  return `+${jid.split('@')[0].replace(/\D/g, '')}`;
}

async function getConversation(phone) {
  const snap = await db.collection(CONV_COL).doc(phone).get();
  if (snap.exists) return snap.data();
  return { step: 'MAIN_MENU', data: {} };
}

async function saveConversation(phone, state) {
  await db.collection(CONV_COL).doc(phone).set({ ...state, updatedAt: Date.now() });
}

async function resetToMainMenu(phone) {
  await saveConversation(phone, { step: 'MAIN_MENU', data: {} });
}

async function getBranch(branchId) {
  const snap = await db.collection('branches').doc(branchId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getActiveServices(branchId) {
  const snap = await db.collection('services').where('branchId', '==', branchId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getActiveStaff(branchId) {
  const snap = await db.collection('staff').where('branchId', '==', branchId).where('active', '==', true).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Líneas para hablar directo con el peluquero — reutilizadas en la opción
 * 4️⃣ del menú y también cuando el bot no sabe qué responder. */
async function buildTalkToStaffLines(branch) {
  const staff = await getActiveStaff(branch.id);
  if (staff.length === 0) return null;
  const primary = staff[0];
  const waLink = `https://wa.me/${primary.phone.replace(/\D/g, '')}`;
  return [t(branch, 'talkTo', primary.name), `📞 ${primary.phone}`, waLink];
}

/** Guarda una pregunta/mensaje que el bot no supo interpretar, para que el
 * peluquero la revise en la app (pantalla "Preguntas") y, si hace falta,
 * se le enseñe al bot a responderla — así no se pierde ninguna. */
async function logUnansweredMessage(branch, phone, text, step) {
  try {
    const ref = db.collection('unansweredMessages').doc();
    await ref.set({
      id: ref.id,
      branchId: branch.id,
      phone,
      text,
      step,
      resolved: false,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error('[conversation] error guardando pregunta sin responder', err);
  }
}

/**
 * Punto de entrada: procesa un mensaje entrante y devuelve el/los textos
 * de respuesta a enviar (el bot los envía en orden).
 */
export async function handleIncomingMessage(jid, rawText, branchId, pushName) {
  const phone = normalizePhone(jid);
  const text = (rawText || '').trim();
  const branch = await getBranch(branchId);
  if (!branch) return [t(null, 'botNotConfigured')];

  // Interruptor de emergencia: si el peluquero activó "modo mantenimiento"
  // en Ajustes, no se procesa ningún flujo — se avisa y se da el contacto
  // directo, hasta que se desactive desde la app.
  if (branch.maintenanceMode) {
    const lines = await buildTalkToStaffLines(branch);
    return [t(branch, 'maintenanceMessage'), ...(lines || [])];
  }

  // Comandos globales, funcionan en cualquier paso.
  if (isGreeting(branch, text)) {
    await resetToMainMenu(phone);
    return [t(branch, 'welcome', branch.name), t(branch, 'mainMenu')];
  }

  const state = await getConversation(phone);
  if (!state.data.clientName && pushName) state.data.clientName = pushName;

  // Respuesta 1/2 a un recordatorio o a una oferta de lista de espera pendiente,
  // solo si el cliente no está en medio de otro flujo activo.
  if (state.step === 'MAIN_MENU' && (text === '1' || text === '2')) {
    const pendingReply = await findAwaitingReply(phone);
    if (pendingReply) return handlePendingReply(phone, pendingReply, text, branch);
  }

  switch (state.step) {
    case 'MAIN_MENU':
      return handleMainMenu(phone, text, branch, state);
    case 'BOOK_SERVICE':
      return handleBookService(phone, text, branch, state);
    case 'BOOK_STAFF':
      return handleBookStaff(phone, text, branch, state);
    case 'BOOK_DAY':
      return handleBookDay(phone, text, branch, state);
    case 'BOOK_TIME':
      return handleBookTime(phone, text, branch, state);
    case 'BOOK_WAITLIST_ASK':
      return handleWaitlistAsk(phone, text, branch, state);
    case 'CANCEL_SELECT':
      return handleCancelSelect(phone, text, branch, state);
    default:
      await resetToMainMenu(phone);
      return [t(branch, 'mainMenu')];
  }
}

async function findAwaitingReply(phone) {
  const snap = await db
    .collection('notifications')
    .where('to', '==', phone)
    .where('channel', '==', 'whatsapp')
    .where('status', '==', 'sent')
    .orderBy('sentAt', 'desc')
    .limit(5)
    .get();
  const doc = snap.docs.find((d) => d.data().awaitingReply && !d.data().replyHandledAt);
  return doc ?? null;
}

async function handlePendingReply(phone, doc, digit, branch) {
  const data = doc.data();
  if (data.awaitingReply === 'confirm_cancel') {
    if (digit === '1') {
      await api.confirmAppointment(data.relatedAppointmentId);
      await doc.ref.update({ replyHandledAt: Date.now() });
      return [t(branch, 'reminderConfirmed')];
    }
    await api.cancelAppointment(data.relatedAppointmentId);
    await doc.ref.update({ replyHandledAt: Date.now() });
    return [t(branch, 'reminderCancelled')];
  }
  if (data.awaitingReply === 'waitlist_offer') {
    if (digit !== '1') {
      await doc.ref.update({ replyHandledAt: Date.now() });
      return [t(branch, 'waitlistDeclined')];
    }
    try {
      await api.acceptWaitlistOffer(data.data?.waitlistId);
      await doc.ref.update({ replyHandledAt: Date.now() });
      return [t(branch, 'reminderConfirmed')];
    } catch {
      await doc.ref.update({ replyHandledAt: Date.now() });
      return [t(branch, 'waitlistTaken')];
    }
  }
  return [t(branch, 'mainMenu')];
}

async function handleMainMenu(phone, text, branch, state) {
  if (text === '1') {
    const services = await getActiveServices(branch.id);
    if (services.length === 0) return [t(branch, 'noServices')];
    await saveConversation(phone, { step: 'BOOK_SERVICE', data: { ...state.data, services: services.map((s) => s.id) } });
    const lines = services.map((s, i) => `${i + 1}️⃣ ✂️ ${s.name} — ₪${s.price}`);
    return [t(branch, 'chooseService'), ...lines, t(branch, 'chooseNumberHint')];
  }
  if (text === '2') {
    const appts = await upcomingAppointments(phone, branch);
    if (appts.length === 0) return [t(branch, 'noUpcoming'), t(branch, 'mainMenu')];
    await saveConversation(phone, { step: 'CANCEL_SELECT', data: { ...state.data, appointmentIds: appts.map((a) => a.id) } });
    return [t(branch, 'chooseCancelAppt'), ...appts.map((a, i) => `${i + 1}️⃣ ${a.label}`), t(branch, 'chooseNumberHint')];
  }
  if (text === '3') {
    const appts = await upcomingAppointments(phone, branch);
    if (appts.length === 0) return [t(branch, 'noUpcoming'), t(branch, 'mainMenu')];
    return [t(branch, 'upcomingListHeader'), ...appts.map((a) => `• ${a.label}`), '', t(branch, 'mainMenu')];
  }
  if (text === '4') {
    const lines = await buildTalkToStaffLines(branch);
    if (!lines) return [t(branch, 'noStaffConfigured'), t(branch, 'mainMenu')];
    return [...lines, '', t(branch, 'mainMenu')];
  }

  // No coincide con ninguna opción esperada: puede ser una pregunta
  // libre, un emoji o cualquier otra cosa. Como en este punto el
  // cliente no está en medio de ninguna reserva, en vez de decirle
  // "no entendí" directamente le mostramos el menú principal — así,
  // sea lo que sea que haya escrito, siempre ve las opciones para
  // seguir. Igual se guarda para que el peluquero lo revise en
  // "Preguntas".
  await logUnansweredMessage(branch, phone, text, 'MAIN_MENU');
  return [t(branch, 'mainMenu')];
}

async function handleBookService(phone, text, branch, state) {
  const services = await getActiveServices(branch.id);
  const idx = Number(text) - 1;
  const service = services[idx];
  if (!service) return [t(branch, 'invalidChoiceService')];

  const staff = await getActiveStaff(branch.id);
  await saveConversation(phone, { step: 'BOOK_STAFF', data: { ...state.data, serviceId: service.id, staffOptions: staff.map((s) => s.id) } });

  if (staff.length === 1) {
    return handleBookStaff(phone, '1', branch, { data: { ...state.data, serviceId: service.id, staffOptions: [staff[0].id] } });
  }
  const lines = staff.map((s, i) => `${i + 1}️⃣ ${s.name}`);
  return [t(branch, 'chooseStaff'), t(branch, 'anyStaff'), ...lines, t(branch, 'chooseNumberHint')];
}

async function handleBookStaff(phone, text, branch, state) {
  const allStaff = await getActiveStaff(branch.id);
  let staffId;
  if (text === '0') {
    staffId = 'any';
  } else {
    const idx = Number(text) - 1;
    const chosen = allStaff[idx];
    if (!chosen) return [t(branch, 'invalidChoice')];
    staffId = chosen.id;
  }

  const dateOptions = buildDateOptions(branch);
  await saveConversation(phone, { step: 'BOOK_DAY', data: { ...state.data, staffId, dateOptions } });
  const lines = dateOptions.map((d, i) => `${i + 1}️⃣ ${d.label}`);
  return [t(branch, 'chooseDay'), ...lines, t(branch, 'chooseNumberHint')];
}

/** Calcula los huecos libres de ese día para la lista de peluqueros dada,
 * respetando el tiempo de corte propio de cada uno si lo configuró. */
async function availableSlotsForDay(branch, staffList, service, dateStr) {
  const blockedTimes = await blockedTimesForDay(branch.id, dateStr);
  let allSlots = [];
  for (const staff of staffList.filter(Boolean)) {
    const existing = await appointmentsForStaffOnDay(staff.id, dateStr, branch.timezone);
    const duration = getStaffServiceDuration(staff, service);
    const slots = getAvailableSlots(staff, duration, dateStr, existing, branch.timezone, Date.now(), blockedTimes);
    allSlots.push(...slots.map((s) => ({ ...s, staffId: staff.id, staffName: staff.name })));
  }
  allSlots.sort((a, b) => a.startsAt - b.startsAt);
  return allSlots;
}

async function handleBookDay(phone, text, branch, state) {
  const idx = Number(text) - 1;
  const chosen = state.data.dateOptions?.[idx];
  if (!chosen) return [t(branch, 'invalidChoice')];

  const service = await docById('services', state.data.serviceId);
  const staffList = state.data.staffId === 'any' ? await getActiveStaff(branch.id) : [await docById('staff', state.data.staffId)];
  const allSlots = await availableSlotsForDay(branch, staffList, service, chosen.dateStr);

  if (allSlots.length === 0) {
    await saveConversation(phone, { step: 'BOOK_WAITLIST_ASK', data: { ...state.data, dateStr: chosen.dateStr, dateLabel: chosen.label } });
    return [t(branch, 'noSlotsThatDay', chosen.label), t(branch, 'askWaitlist')];
  }

  // allSlotsForDay: lista completa del día (para buscar "la hora más cercana"
  // si el cliente escribe una hora directamente). slots: solo lo que se
  // muestra numerado ahora mismo (máx. 8, o menos si venimos de una
  // búsqueda por hora). occupiedAttempts arranca en 0 en cada día nuevo.
  const displaySlots = allSlots.slice(0, 8);
  await saveConversation(phone, { step: 'BOOK_TIME', data: { ...state.data, dateStr: chosen.dateStr, dateLabel: chosen.label, slots: displaySlots, allSlotsForDay: allSlots, occupiedAttempts: 0 } });
  const lines = displaySlots.map((s, i) => `${i + 1}️⃣ ${formatTime(s.startsAt, branch)}${staffList.length > 1 ? ` — ${s.staffName}` : ''}`);
  return [
    t(branch, 'chooseTimePrompt', chosen.label),
    t(branch, 'orChooseFromList'),
    ...lines,
    t(branch, 'chooseOtherDay'),
  ];
}

/** Dice si una hora concreta cae dentro del horario de atención de alguno
 * de los peluqueros dados (ignorando si ya hay una cita puesta ahí) — para
 * distinguir "cerrado a esa hora" de "ocupado por otra cita". */
async function withinWorkingHours(branch, staffList, service, dateStr, epoch) {
  const blockedTimes = await blockedTimesForDay(branch.id, dateStr);
  for (const staff of staffList.filter(Boolean)) {
    const duration = getStaffServiceDuration(staff, service);
    const slots = getAvailableSlots(staff, duration, dateStr, [], branch.timezone, Date.now(), blockedTimes);
    if (slots.some((s) => s.startsAt === epoch)) return true;
  }
  return false;
}

async function handleBookTime(phone, text, branch, state) {
  if (text === '0') {
    await saveConversation(phone, { step: 'BOOK_DAY', data: state.data });
    const lines = (state.data.dateOptions || []).map((d, i) => `${i + 1}️⃣ ${d.label}`);
    return [t(branch, 'chooseDay'), ...lines];
  }

  const idx = Number(text) - 1;
  const numberedSlot = state.data.slots?.[idx];
  if (numberedSlot) {
    return bookChosenSlot(phone, branch, state, numberedSlot);
  }

  // No fue un número de la lista: probamos si escribió una hora directamente
  // (ej. "9:30", "930", "17:00").
  const typed = parseTimeInput(text);
  if (typed) {
    const daySlots = state.data.allSlotsForDay || state.data.slots || [];
    const desiredEpoch = toEpoch(state.data.dateStr, `${String(typed.h).padStart(2, '0')}:${String(typed.m).padStart(2, '0')}`, branch.timezone);
    const exactMatch = daySlots.find((s) => s.startsAt === desiredEpoch);
    if (exactMatch) {
      return bookChosenSlot(phone, branch, state, exactMatch);
    }

    const service = await docById('services', state.data.serviceId);
    const staffList = state.data.staffId === 'any' ? await getActiveStaff(branch.id) : [await docById('staff', state.data.staffId)];
    const isOpen = await withinWorkingHours(branch, staffList, service, state.data.dateStr, desiredEpoch);
    if (!isOpen) {
      const lines = (state.data.slots || []).map((s, i) => `${i + 1}️⃣ ${formatTime(s.startsAt, branch)}${staffList.length > 1 ? ` — ${s.staffName}` : ''}`);
      return [t(branch, 'outsideWorkingHours', state.data.dateLabel), ...lines, t(branch, 'chooseOtherDay')];
    }

    return handleOccupiedSlot(phone, branch, state, { startsAt: desiredEpoch });
  }

  await logUnansweredMessage(branch, phone, text, 'BOOK_TIME');
  const talkLines = await buildTalkToStaffLines(branch);
  return [t(branch, 'didNotUnderstandTime'), t(branch, 'timeHelp'), ...(talkLines ? [t(branch, 'askTalkToStaff'), ...talkLines] : [])];
}

/**
 * Se llama cuando un horario elegido/escrito resulta ocupado (alguien se
 * adelantó, o ya estaba ocupado desde el vamos). El primer intento del día
 * solo avisa y deja que el cliente elija de nuevo por su cuenta; recién
 * desde el segundo intento seguido el bot busca automáticamente y ofrece
 * las horas libres más cercanas a lo que pidió (o lista de espera si ese
 * día ya no queda nada) — así no lo satura de mensajes a la primera.
 */
async function handleOccupiedSlot(phone, branch, state, attemptedSlot) {
  const attempts = (state.data.occupiedAttempts || 0) + 1;

  if (attempts === 1) {
    await saveConversation(phone, { step: 'BOOK_TIME', data: { ...state.data, occupiedAttempts: attempts } });
    return [t(branch, 'slotTakenFirstTry')];
  }

  const service = await docById('services', state.data.serviceId);
  const staffList = state.data.staffId === 'any' ? await getActiveStaff(branch.id) : [await docById('staff', state.data.staffId)];
  const freshSlots = await availableSlotsForDay(branch, staffList, service, state.data.dateStr);

  if (freshSlots.length === 0) {
    await saveConversation(phone, { step: 'BOOK_WAITLIST_ASK', data: { ...state.data, occupiedAttempts: attempts } });
    return [t(branch, 'slotTakenNoneLeft'), t(branch, 'askWaitlist')];
  }

  const nearest = [...freshSlots]
    .sort((a, b) => Math.abs(a.startsAt - attemptedSlot.startsAt) - Math.abs(b.startsAt - attemptedSlot.startsAt))
    .slice(0, 3)
    .sort((a, b) => a.startsAt - b.startsAt);

  await saveConversation(phone, { step: 'BOOK_TIME', data: { ...state.data, occupiedAttempts: attempts, slots: nearest, allSlotsForDay: freshSlots } });
  const lines = nearest.map((s, i) => `${i + 1}️⃣ ${formatTime(s.startsAt, branch)}${(state.data.staffId === 'any' && nearest.some((n) => n.staffId !== s.staffId)) ? ` — ${s.staffName}` : ''}`);
  return [t(branch, 'slotTakenRetry'), ...lines, t(branch, 'chooseOtherDay')];
}

async function bookChosenSlot(phone, branch, state, slot) {
  const service = await docById('services', state.data.serviceId);

  try {
    const { appointment } = await api.createAppointment({
      branchId: branch.id,
      staffId: slot.staffId,
      serviceId: service.id,
      clientPhone: phone,
      clientName: state.data.clientName || t(branch, 'defaultClientName'),
      startsAt: slot.startsAt,
      source: 'whatsapp',
    });
    await resetToMainMenu(phone);
    return [t(branch, 'appointmentConfirmed', formatDate(slot.startsAt, branch), formatTime(slot.startsAt, branch))];
  } catch (err) {
    if (err.code === 'slot_taken') {
      return handleOccupiedSlot(phone, branch, state, slot);
    }
    console.error('[conversation] error creando cita', err);
    const talkLines = await buildTalkToStaffLines(branch);
    return [t(branch, 'bookingError'), ...(talkLines ? [t(branch, 'askTalkToStaff'), ...talkLines] : [])];
  }
}

/** Interpreta una hora escrita a mano: "9:30", "930", "9", "17:00", etc. */
function parseTimeInput(text) {
  const match = text.trim().match(/^(\d{1,2})[:.,]?(\d{2})?$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = match[2] ? Number(match[2]) : 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

async function handleWaitlistAsk(phone, text, branch, state) {
  if (isYes(branch, text)) {
    await api.addToWaitlist({
      branchId: branch.id,
      staffId: state.data.staffId === 'any' ? null : state.data.staffId,
      serviceId: state.data.serviceId,
      clientPhone: phone,
      clientName: state.data.clientName || t(branch, 'defaultClientName'),
      desiredDate: state.data.dateStr,
      desiredWindow: null,
    });
    await resetToMainMenu(phone);
    return [t(branch, 'waitlistConfirmed'), t(branch, 'mainMenu')];
  }
  await resetToMainMenu(phone);
  return [t(branch, 'mainMenu')];
}

async function handleCancelSelect(phone, text, branch, state) {
  const idx = Number(text) - 1;
  const appointmentId = state.data.appointmentIds?.[idx];
  if (!appointmentId) return [t(branch, 'invalidChoice')];
  await api.cancelAppointment(appointmentId);
  await resetToMainMenu(phone);
  return [t(branch, 'apptCancelled'), t(branch, 'mainMenu')];
}

// --- Helpers ---

async function docById(col, id) {
  if (!id) return null;
  const snap = await db.collection(col).doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function blockedTimesForDay(branchId, dateStr) {
  const snap = await db.collection('blockedTimes').where('branchId', '==', branchId).where('date', '==', dateStr).get();
  return snap.docs.map((d) => d.data());
}

async function appointmentsForStaffOnDay(staffId, dateStr, timezone) {
  const snap = await db.collection('appointments').where('staffId', '==', staffId).where('status', 'in', ['confirmed', 'pending_deposit']).get();
  return snap.docs
    .map((d) => d.data())
    .filter((a) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(a.startsAt) === dateStr)
    .map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt }));
}

async function upcomingAppointments(phone, branch) {
  const snap = await db
    .collection('appointments')
    .where('clientPhone', '==', phone)
    .where('status', 'in', ['confirmed', 'pending_deposit'])
    .orderBy('startsAt', 'asc')
    .limit(5)
    .get();
  return snap.docs.map((d) => {
    const a = d.data();
    return { id: d.id, label: `${formatDate(a.startsAt, branch)} ${formatTime(a.startsAt, branch)}` };
  });
}

function buildDateOptions(branch) {
  const options = [];
  const now = Date.now();
  const weekdays = weekdayNames(branch);
  for (let i = 0; i < DAYS_TO_OFFER; i++) {
    const time = now + i * 86400000;
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: branch.timezone }).format(time);
    const weekday = weekdays[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
    const label = i === 0 ? t(branch, 'today', weekday) : i === 1 ? t(branch, 'tomorrow', weekday) : t(branch, 'otherDay', weekday, dateStr.slice(8, 10), dateStr.slice(5, 7));
    options.push({ dateStr, label });
  }
  return options;
}

function formatDate(epochMs, branch) {
  return new Intl.DateTimeFormat(dateLocale(branch), { timeZone: branch.timezone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(epochMs);
}

function formatTime(epochMs, branch) {
  return new Intl.DateTimeFormat(dateLocale(branch), { timeZone: branch.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(epochMs);
}
