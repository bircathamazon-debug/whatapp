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
import { t, weekdayNames, dateLocale, isGreeting, isYes, menuNumber } from './i18n.js';
import { interpretFreeText } from './nlu.js';

const CONV_COL = 'waConversations';
const DAYS_TO_OFFER = 6;

/** Junta varias líneas en un solo mensaje de WhatsApp (una sola burbuja)
 * en vez de mandarlas como mensajes separados — así la lista numerada y
 * la instrucción de "escribí el número" quedan pegadas una a la otra, y
 * se entiende que hay que responder con un número en vez de perderse
 * entre varios globos de mensaje sueltos. */
function oneMessage(...lines) {
  return [lines.filter((l) => l !== null && l !== undefined).join('\n')];
}

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

/** Busca el cliente ya registrado (por sucursal+teléfono) para saber si es
 * la primera vez que escribe (nunca completó una reserva) o ya es conocido
 * — así solo le preguntamos el nombre una vez. */
async function getClientRecord(branchId, phone) {
  const snap = await db.collection('clients').where('branchId', '==', branchId).where('phone', '==', phone).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
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

  // Respuesta 1/2 a un recordatorio o a una oferta de lista de espera pendiente,
  // solo si el cliente no está en medio de otro flujo activo.
  if (state.step === 'MAIN_MENU' && (text === '1' || text === '2')) {
    const pendingReply = await findAwaitingReply(phone);
    if (pendingReply) return handlePendingReply(phone, pendingReply, text, branch);
  }

  switch (state.step) {
    case 'MAIN_MENU':
      return handleMainMenu(phone, text, branch, state);
    case 'ASK_NAME':
      return handleAskName(phone, text, branch, state);
    case 'BOOK_SERVICE':
      return handleBookService(phone, text, branch, state);
    case 'BOOK_STAFF':
      return handleBookStaff(phone, text, branch, state);
    case 'BOOK_DAY':
      return handleBookDay(phone, text, branch, state);
    case 'BOOK_TIME':
      return handleBookTime(phone, text, branch, state);
    case 'BOOK_TIME_CONFIRM':
      return handleBookTimeConfirm(phone, text, branch, state);
    case 'BOOK_WAITLIST_ASK':
      return handleWaitlistAsk(phone, text, branch, state);
    case 'CANCEL_SELECT':
      return handleCancelSelect(phone, text, branch, state);
    case 'AVAIL_DAY':
      return handleAvailDay(phone, text, branch, state);
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
    // Primera vez que este teléfono pide una cita (todavía no tiene ficha
    // en "clients"): le preguntamos el nombre antes de mostrar los
    // servicios, para poder llamarlo por su nombre de ahora en más. Si ya
    // es un cliente conocido (con o sin nombre — pudo haber elegido no
    // dejarlo la primera vez), no se le vuelve a preguntar nunca más.
    const client = await getClientRecord(branch.id, phone);
    if (!client) {
      await saveConversation(phone, { step: 'ASK_NAME', data: { ...state.data } });
      return [t(branch, 'askName')];
    }
    const isGenericName = client.name === t(branch, 'defaultClientName');
    const greeting = isGenericName ? [] : [t(branch, 'welcomeBack', client.name)];
    return startServiceSelection(phone, branch, state, isGenericName ? null : client.name, greeting);
  }
  if (text === '2') {
    const appts = await upcomingAppointments(phone, branch);
    if (appts.length === 0) return [t(branch, 'noUpcoming'), t(branch, 'mainMenu')];
    await saveConversation(phone, { step: 'CANCEL_SELECT', data: { ...state.data, appointmentIds: appts.map((a) => a.id) } });
    return oneMessage(t(branch, 'chooseCancelAppt'), ...appts.map((a, i) => `${menuNumber(i + 1)} ${a.label}`), t(branch, 'chooseNumberHint'));
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
  if (text === '5') {
    const dateOptions = buildDateOptions(branch);
    await saveConversation(phone, { step: 'AVAIL_DAY', data: { ...state.data, dateOptions } });
    const lines = dateOptions.map((d, i) => `${menuNumber(i + 1)} ${d.label}`);
    return oneMessage(t(branch, 'chooseDayAvailability'), ...lines, t(branch, 'chooseNumberHint'));
  }

  // No coincide con ninguna opción esperada (ni número, ni comando exacto):
  // puede ser un pedido en lenguaje natural, escrito o transcripto de una
  // nota de voz ("quiero una cita el jueves a las 3"). Antes de rendirnos,
  // probamos interpretarlo con IA — si entendemos una intención clara, lo
  // llevamos directo ahí en vez de mostrarle el menú sin más.
  const nlu = await interpretFreeText(text);
  if (nlu?.intent === 'cancel') return handleMainMenu(phone, '2', branch, state);
  if (nlu?.intent === 'talk_to_human') return handleMainMenu(phone, '4', branch, state);
  if (nlu?.intent === 'book') {
    const client = await getClientRecord(branch.id, phone);
    if (!client) {
      await saveConversation(phone, { step: 'ASK_NAME', data: { ...state.data, pendingNlu: nlu } });
      return [t(branch, 'askName')];
    }
    const isGenericName = client.name === t(branch, 'defaultClientName');
    const greeting = isGenericName ? [] : [t(branch, 'welcomeBack', client.name)];
    return continueBookingFastTrack(phone, branch, state, isGenericName ? null : client.name, greeting, nlu);
  }

  // Tampoco es algo que la IA haya entendido con una intención clara:
  // puede ser una pregunta libre, un emoji, o cualquier otra cosa. Como en
  // este punto el cliente no está en medio de ninguna reserva, en vez de
  // decirle "no entendí" directamente le mostramos el menú principal —
  // así, sea lo que sea que haya escrito, siempre ve las opciones para
  // seguir. Solo se guarda en "Preguntas" si el mensaje tiene un signo de
  // pregunta (es probable que sea algo que el peluquero necesite
  // responder de verdad) — un saludo o un "quiero reservar" no necesita
  // revisión.
  if (text.includes('?') || text.includes('؟')) {
    await logUnansweredMessage(branch, phone, text, 'MAIN_MENU');
  }
  return [t(branch, 'mainMenu')];
}

/** Cuando ya sabemos el nombre del cliente (porque ya era conocido, o
 * porque recién nos lo dijo), sigue el pedido en lenguaje natural
 * (`nlu`, de interpretFreeText) todo lo lejos que se pueda sin volver a
 * preguntar lo que ya entendimos: servicio (si hay uno solo o se pudo
 * identificar), peluquero (el único activo, o "cualquiera" si hay
 * varios), día (si se mencionó) y hora (si se mencionó). Lo que no se
 * pudo resolver solo, se le sigue preguntando normalmente — nunca
 * reserva nada sin que el cliente confirme un horario concreto. */
async function continueBookingFastTrack(phone, branch, state, clientName, greetingLines, nlu) {
  const services = await getActiveServices(branch.id);
  if (services.length === 0) return [t(branch, 'noServices')];

  let service = services[0];
  if (services.length > 1) {
    const hint = (nlu.serviceHint || '').toLowerCase().trim();
    const matched = hint && services.find((s) => {
      const name = s.name.toLowerCase();
      return name.includes(hint) || hint.includes(name);
    });
    if (!matched) {
      // Ambiguo entre varios servicios: mejor preguntar normalmente que
      // adivinar mal cuál quiso decir.
      return startServiceSelection(phone, branch, state, clientName, greetingLines);
    }
    service = matched;
  }

  const staffList = await getActiveStaff(branch.id);
  const staffId = staffList.length === 1 ? staffList[0].id : 'any';

  const dateOptions = buildDateOptions(branch);
  let chosen = null;
  if (nlu.relativeDay === 'today') chosen = dateOptions[0];
  else if (nlu.relativeDay === 'tomorrow') chosen = dateOptions[1];
  else if (nlu.weekday) chosen = dateOptions.find((d) => englishWeekday(d.dateStr) === nlu.weekday);

  const baseData = { ...state.data, serviceId: service.id, staffId, dateOptions };
  if (clientName) baseData.clientName = clientName;

  if (!chosen) {
    // Entendimos que quiere reservar, pero no un día concreto: seguimos
    // como el flujo normal, preguntando qué día — ya sin tener que elegir
    // servicio/peluquero si se pudieron resolver solos.
    await saveConversation(phone, { step: 'BOOK_DAY', data: baseData });
    const lines = dateOptions.map((d, i) => `${menuNumber(i + 1)} ${d.label}`);
    return oneMessage(...greetingLines, ...(greetingLines.length ? [''] : []), t(branch, 'chooseDay'), ...lines, t(branch, 'chooseNumberHint'));
  }

  const dayView = await enterDayTimeSelection(phone, branch, { data: baseData }, chosen, greetingLines);

  const typed = parseNluTime(nlu.time);
  if (!typed) return dayView;

  // Si enterDayTimeSelection encontró huecos ese día, guardó el estado en
  // BOOK_TIME con todo lo necesario para resolveTypedTime (la misma
  // función que ya usa el flujo de "escribí la hora directamente") — la
  // reusamos así la hora pedida se busca/confirma exactamente igual.
  const freshState = await getConversation(phone);
  if (freshState.step !== 'BOOK_TIME') return dayView; // ese día no había huecos (ya se ofreció lista de espera)
  return resolveTypedTime(phone, branch, freshState, typed);
}

/** "HH:MM" (lo que devuelve la IA) a {h, m}, o null si no vino o es inválido. */
function parseNluTime(timeStr) {
  const match = /^(\d{2}):(\d{2})$/.exec(timeStr || '');
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

const ENGLISH_WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Día de la semana de un "dateStr" (YYYY-MM-DD) en inglés fijo, sin
 * depender del idioma de la sucursal — para comparar contra lo que
 * devuelve la IA (interpretFreeText siempre contesta en inglés). */
function englishWeekday(dateStr) {
  return ENGLISH_WEEKDAYS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
}

/** Respuesta a "¿cuál es tu nombre?". 0️⃣ = no quiere dejarlo (usa el
 * nombre genérico). Cualquier otra cosa se guarda como el nombre. */
async function handleAskName(phone, text, branch, state) {
  const skipped = text.trim() === '0';
  const name = skipped ? t(branch, 'defaultClientName') : text.trim().slice(0, 60);
  const greeting = skipped ? [] : [t(branch, 'nameThanks', name)];

  // Si llegamos acá porque la IA ya había entendido un pedido de reserva
  // (ej. una nota de voz) y solo faltaba preguntar el nombre, seguimos
  // ese pedido en vez de mostrar la lista de servicios desde cero.
  if (state.data.pendingNlu) {
    const { pendingNlu, ...rest } = state.data;
    return continueBookingFastTrack(phone, branch, { data: rest }, name, greeting, pendingNlu);
  }
  return startServiceSelection(phone, branch, state, name, greeting);
}

/** Muestra la lista de servicios y pasa a BOOK_SERVICE. `greetingLines` son
 * líneas opcionales a mostrar antes (ej. "¡un placer, Dana!" la primera
 * vez, o "hola de nuevo, Dana!" en una reserva siguiente). */
async function startServiceSelection(phone, branch, state, clientName, greetingLines = []) {
  const services = await getActiveServices(branch.id);
  if (services.length === 0) return [t(branch, 'noServices')];
  const newData = { ...state.data, services: services.map((s) => s.id) };
  if (clientName) newData.clientName = clientName;
  await saveConversation(phone, { step: 'BOOK_SERVICE', data: newData });
  const lines = services.map((s, i) => `${menuNumber(i + 1)} ✂️ ${s.name} — ₪${s.price}`);
  return oneMessage(...greetingLines, ...(greetingLines.length ? [''] : []), t(branch, 'chooseService'), ...lines, t(branch, 'chooseNumberHint'));
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
  const lines = staff.map((s, i) => `${menuNumber(i + 1)} ${s.name}`);
  return oneMessage(t(branch, 'chooseStaff'), t(branch, 'anyStaff'), ...lines, t(branch, 'chooseNumberHint'));
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
  const lines = dateOptions.map((d, i) => `${menuNumber(i + 1)} ${d.label}`);
  return oneMessage(t(branch, 'chooseDay'), ...lines, t(branch, 'chooseNumberHint'));
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
  return enterDayTimeSelection(phone, branch, state, chosen);
}

/** Dado un día ya elegido (`chosen`: {dateStr, label}), calcula los huecos
 * libres y muestra la lista de horarios (o pasa a lista de espera si no
 * queda nada). Compartido entre elegir el día a mano (handleBookDay) y el
 * pedido en lenguaje natural ya resuelto (continueBookingFastTrack) —
 * `greetingLines` opcionales van antes del mensaje (ej. "¡un placer, Dana!"). */
async function enterDayTimeSelection(phone, branch, state, chosen, greetingLines = []) {
  const service = await docById('services', state.data.serviceId);
  const staffList = state.data.staffId === 'any' ? await getActiveStaff(branch.id) : [await docById('staff', state.data.staffId)];
  const allSlots = await availableSlotsForDay(branch, staffList, service, chosen.dateStr);

  if (allSlots.length === 0) {
    await saveConversation(phone, { step: 'BOOK_WAITLIST_ASK', data: { ...state.data, dateStr: chosen.dateStr, dateLabel: chosen.label } });
    return oneMessage(...greetingLines, ...(greetingLines.length ? [''] : []), t(branch, 'noSlotsThatDay', chosen.label), t(branch, 'askWaitlist'));
  }

  // allSlotsForDay: lista completa del día (para buscar "la hora más cercana"
  // si el cliente escribe una hora directamente). slots: solo lo que se
  // muestra numerado ahora mismo (máx. 8, o menos si venimos de una
  // búsqueda por hora). occupiedAttempts arranca en 0 en cada día nuevo.
  const displaySlots = allSlots.slice(0, 8);
  await saveConversation(phone, { step: 'BOOK_TIME', data: { ...state.data, dateStr: chosen.dateStr, dateLabel: chosen.label, slots: displaySlots, allSlotsForDay: allSlots, occupiedAttempts: 0 } });
  const lines = displaySlots.map((s, i) => `${menuNumber(i + 1)} ${formatTime(s.startsAt, branch)}${staffList.length > 1 ? ` — ${s.staffName}` : ''}`);
  return oneMessage(
    ...greetingLines,
    ...(greetingLines.length ? [''] : []),
    t(branch, 'chooseTimePrompt', chosen.label),
    t(branch, 'orChooseFromList'),
    ...lines,
    t(branch, 'chooseOtherDay')
  );
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
    const lines = (state.data.dateOptions || []).map((d, i) => `${menuNumber(i + 1)} ${d.label}`);
    return oneMessage(t(branch, 'chooseDay'), ...lines);
  }

  const idx = Number(text) - 1;
  const numberedSlot = state.data.slots?.[idx];
  if (numberedSlot) {
    return bookChosenSlot(phone, branch, state, numberedSlot);
  }

  // No fue un número de la lista: probamos si escribió una hora directamente
  // (ej. "9:30", "930", "17:00", "9 30", "9.30").
  const typed = parseTimeInput(text);
  if (typed) {
    return resolveTypedTime(phone, branch, state, typed);
  }

  await logUnansweredMessage(branch, phone, text, 'BOOK_TIME');
  const talkLines = await buildTalkToStaffLines(branch);
  return [t(branch, 'didNotUnderstandTime'), t(branch, 'timeHelp'), ...(talkLines ? [t(branch, 'askTalkToStaff'), ...talkLines] : [])];
}

/** Formatea hora+minuto como "HH:MM" para pasarle a toEpoch(). */
function hhmm(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Dado un minuto cualquiera, devuelve los candidatos de 15 en 15 más
 * cercanos (los turnos siempre caen en :00/:15/:30/:45), ordenados del
 * más cercano al más lejano. `hourOffset` es 1 cuando redondear para
 * arriba cruza a la hora siguiente (ej. minuto 50 -> xx:00 de la hora
 * que viene). */
function quarterCandidates(m) {
  if (m % 15 === 0) return [{ hourOffset: 0, m }];
  const lower = Math.floor(m / 15) * 15;
  const upperM = lower + 15;
  const upper = upperM === 60 ? { hourOffset: 1, m: 0 } : { hourOffset: 0, m: upperM };
  return [
    { hourOffset: 0, m: lower, dist: m - lower },
    { ...upper, dist: upperM - m },
  ].sort((a, b) => a.dist - b.dist);
}

/**
 * El cliente escribió una hora directamente (no eligió un número de la
 * lista). Busca el turno más adecuado para lo que escribió, aunque no
 * haya sido prolijo — tres casos que antes el bot no resolvía:
 *  1) Separador raro o sin separador ("2 20", "2.20", "220") — ya se
 *     interpreta igual gracias a parseTimeInput().
 *  2) Minuto que no es múltiplo de 15 (ej. "2:20") — se ofrece el
 *     horario libre de 15 minutos más cercano (2:15 o 2:30, el que
 *     esté disponible).
 *  3) Hora que puede ser de mañana o de tarde/noche (ej. "8" cuando la
 *     sucursal solo atiende de tarde) — se prueba también la versión
 *     +12 horas, según el horario que configuró el peluquero.
 * En los casos 2 y 3 el bot tuvo que "adivinar", así que antes de
 * reservar le confirma al cliente qué hora entendió, en vez de asumir
 * directamente (caso 1 solo, con el horario exacto libre, reserva
 * directo como siempre).
 */
async function resolveTypedTime(phone, branch, state, typed) {
  const daySlots = state.data.allSlotsForDay || state.data.slots || [];
  const service = await docById('services', state.data.serviceId);
  const staffList = state.data.staffId === 'any' ? await getActiveStaff(branch.id) : [await docById('staff', state.data.staffId)];

  const literalEpoch = toEpoch(state.data.dateStr, hhmm(typed.h, typed.m), branch.timezone);
  const literalSlot = daySlots.find((s) => s.startsAt === literalEpoch);
  if (literalSlot) {
    return bookChosenSlot(phone, branch, state, literalSlot);
  }

  // Probamos la hora tal cual, y si la sucursal/peluquero no atiende a
  // esa hora de la mañana, la misma hora +12 (de tarde/noche) — en ambos
  // casos, con el minuto redondeado al múltiplo de 15 libre más cercano.
  const hourCandidates = [typed.h];
  if (typed.h >= 1 && typed.h <= 11) hourCandidates.push(typed.h + 12);

  for (const h of hourCandidates) {
    for (const q of quarterCandidates(typed.m)) {
      const qh = (h + q.hourOffset) % 24;
      const epoch = toEpoch(state.data.dateStr, hhmm(qh, q.m), branch.timezone);
      if (epoch === literalEpoch) continue; // ya lo probamos arriba, no estaba libre
      const slot = daySlots.find((s) => s.startsAt === epoch);
      if (slot) return askTimeConfirmation(phone, branch, state, slot);
    }
  }

  // Ningún candidato tiene hueco libre. Si la hora pedida (redondeada al
  // múltiplo de 15 de abajo, para poder chequear el horario de atención)
  // cae dentro de algún horario configurado, está ocupada por otra cita;
  // si no, directamente está cerrado a esa hora.
  for (const h of hourCandidates) {
    const flooredM = Math.floor(typed.m / 15) * 15;
    const openCheckEpoch = toEpoch(state.data.dateStr, hhmm(h, flooredM), branch.timezone);
    const isOpen = await withinWorkingHours(branch, staffList, service, state.data.dateStr, openCheckEpoch);
    if (isOpen) {
      const attemptedEpoch = toEpoch(state.data.dateStr, hhmm(h, typed.m), branch.timezone);
      return handleOccupiedSlot(phone, branch, state, { startsAt: attemptedEpoch });
    }
  }

  const lines = (state.data.slots || []).map((s, i) => `${menuNumber(i + 1)} ${formatTime(s.startsAt, branch)}${staffList.length > 1 ? ` — ${s.staffName}` : ''}`);
  return oneMessage(t(branch, 'outsideWorkingHours', state.data.dateLabel), ...lines, t(branch, 'chooseOtherDay'));
}

/** Guarda el horario candidato y le pregunta al cliente si era ese antes
 * de reservar — se usa cuando el bot tuvo que "adivinar" algo (redondeo
 * de 15 minutos, o mañana/tarde). */
async function askTimeConfirmation(phone, branch, state, slot) {
  await saveConversation(phone, { step: 'BOOK_TIME_CONFIRM', data: { ...state.data, pendingSlot: slot } });
  return [t(branch, 'confirmGuessedTime', formatTime(slot.startsAt, branch))];
}

/** Respuesta a "¿te referís a las HH:MM?". */
async function handleBookTimeConfirm(phone, text, branch, state) {
  const { pendingSlot, ...rest } = state.data;
  if (isYes(branch, text) && pendingSlot) {
    return bookChosenSlot(phone, branch, { data: rest }, pendingSlot);
  }
  await saveConversation(phone, { step: 'BOOK_TIME', data: rest });
  const lines = (rest.slots || []).map((s, i) => `${menuNumber(i + 1)} ${formatTime(s.startsAt, branch)}`);
  return oneMessage(t(branch, 'chooseTimePrompt', rest.dateLabel), t(branch, 'orChooseFromList'), ...lines, t(branch, 'chooseOtherDay'));
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
  const lines = nearest.map((s, i) => `${menuNumber(i + 1)} ${formatTime(s.startsAt, branch)}${(state.data.staffId === 'any' && nearest.some((n) => n.staffId !== s.staffId)) ? ` — ${s.staffName}` : ''}`);
  return oneMessage(t(branch, 'slotTakenRetry'), ...lines, t(branch, 'chooseOtherDay'));
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
    const dateLabel = formatDateWithWeekday(state.data.dateStr, slot.startsAt, branch);
    return [t(branch, 'appointmentConfirmed', dateLabel, formatTime(slot.startsAt, branch))];
  } catch (err) {
    if (err.code === 'slot_taken') {
      return handleOccupiedSlot(phone, branch, state, slot);
    }
    console.error('[conversation] error creando cita', err);
    const talkLines = await buildTalkToStaffLines(branch);
    return [t(branch, 'bookingError'), ...(talkLines ? [t(branch, 'askTalkToStaff'), ...talkLines] : [])];
  }
}

/** Interpreta una hora escrita a mano: "9:30", "930", "9", "17:00", "9 30",
 * "9.30", etc. — acepta los dos puntos, punto, coma, espacio, o nada como
 * separador entre hora y minutos (errores comunes al escribir rápido). */
function parseTimeInput(text) {
  const match = text.trim().match(/^(\d{1,2})[:.,\s]?(\d{2})?$/);
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

/** Opción 5️⃣ del menú: solo mostrar las horas libres de un día, sin
 * reservar nada (el cliente decide después si quiere confirmar un turno,
 * volviendo a escribir "menu" y usando la opción 1️⃣). Usa el primer
 * servicio activo (para calcular la duración de los turnos) y todos los
 * peluqueros activos juntos, igual que "cualquiera que esté disponible"
 * en la reserva normal. */
async function handleAvailDay(phone, text, branch, state) {
  const idx = Number(text) - 1;
  const chosen = state.data.dateOptions?.[idx];
  if (!chosen) return [t(branch, 'invalidChoice')];

  const services = await getActiveServices(branch.id);
  if (services.length === 0) {
    await resetToMainMenu(phone);
    return [t(branch, 'noServices')];
  }
  const staffList = await getActiveStaff(branch.id);
  const allSlots = await availableSlotsForDay(branch, staffList, services[0], chosen.dateStr);

  await resetToMainMenu(phone);
  if (allSlots.length === 0) {
    return [t(branch, 'noSlotsThatDay', chosen.label), t(branch, 'mainMenu')];
  }
  const times = allSlots.map((s) => `${formatTime(s.startsAt, branch)}${staffList.length > 1 ? ` — ${s.staffName}` : ''}`);
  return [t(branch, 'availableTimesHeader', chosen.label), ...times, '', t(branch, 'mainMenu')];
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

/** Fecha + día de la semana en el idioma de la sucursal, para la
 * confirmación final de una cita (ej. "jueves, 23/10/2026") — `dateStr`
 * (YYYY-MM-DD) es el día ya elegido en la conversación, para no
 * recalcularlo del epoch (mismo truco que ya usa buildDateOptions). */
function formatDateWithWeekday(dateStr, epochMs, branch) {
  const weekdays = weekdayNames(branch);
  const weekday = weekdays[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
  return `${weekday}, ${formatDate(epochMs, branch)}`;
}

function formatTime(epochMs, branch) {
  return new Intl.DateTimeFormat(dateLocale(branch), { timeZone: branch.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(epochMs);
}
