/**
 * Máquina de estados de la conversación de reserva por WhatsApp.
 * El estado de cada cliente se persiste en Firestore (waConversations/{phone})
 * para sobrevivir reinicios del bot.
 */
import { db } from './firebaseClient.js';
import { getAvailableSlots } from '../shared/availability.js';
import * as api from './botApiClient.js';

const CONV_COL = 'waConversations';
const DAYS_TO_OFFER = 6;
const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

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

function mainMenuText() {
  return [
    '¿Qué necesitas?',
    '1️⃣ Agendar una cita',
    '2️⃣ Cancelar una cita',
    '3️⃣ Ver mis próximas citas',
    '',
    'Escribe el número de la opción.',
  ].join('\n');
}

/**
 * Punto de entrada: procesa un mensaje entrante y devuelve el/los textos
 * de respuesta a enviar (el bot los envía en orden).
 */
export async function handleIncomingMessage(jid, rawText, branchId, pushName) {
  const phone = normalizePhone(jid);
  const text = (rawText || '').trim();
  const branch = await getBranch(branchId);
  if (!branch) return ['El bot no está configurado correctamente (falta BRANCH_ID). Avisa al peluquero.'];

  // Comandos globales, funcionan en cualquier paso.
  if (/^(menu|menú|hola|hi)$/i.test(text)) {
    await resetToMainMenu(phone);
    return [`Hola! Bienvenido a ${branch.name}.`, mainMenuText()];
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
    case 'BOOK_RECURRING_ASK':
      return handleRecurringAsk(phone, text, branch, state);
    case 'BOOK_WAITLIST_ASK':
      return handleWaitlistAsk(phone, text, branch, state);
    case 'CANCEL_SELECT':
      return handleCancelSelect(phone, text, branch, state);
    default:
      await resetToMainMenu(phone);
      return [mainMenuText()];
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
      return ['✅ Cita confirmada. ¡Te esperamos!'];
    }
    await api.cancelAppointment(data.relatedAppointmentId);
    await doc.ref.update({ replyHandledAt: Date.now() });
    return ['Tu cita fue cancelada. Escribe "menu" si quieres agendar otra.'];
  }
  if (data.awaitingReply === 'waitlist_offer') {
    if (digit !== '1') {
      await doc.ref.update({ replyHandledAt: Date.now() });
      return ['Entendido, seguirás en la lista de espera.'];
    }
    try {
      await api.acceptWaitlistOffer(data.data?.waitlistId);
      await doc.ref.update({ replyHandledAt: Date.now() });
      return ['✅ Turno confirmado. ¡Te esperamos!'];
    } catch {
      await doc.ref.update({ replyHandledAt: Date.now() });
      return ['Uy, ese turno ya fue tomado por otra persona. Sigues en la lista de espera para el próximo que se libere.'];
    }
  }
  return [mainMenuText()];
}

async function handleMainMenu(phone, text, branch, state) {
  if (text === '1') {
    const services = await getActiveServices(branch.id);
    if (services.length === 0) return ['Aún no hay servicios configurados. Avisa al peluquero.'];
    await saveConversation(phone, { step: 'BOOK_SERVICE', data: { ...state.data, services: services.map((s) => s.id) } });
    const lines = services.map((s, i) => `${i + 1}️⃣ ${s.name} (${s.durationMinutes} min, ₪${s.price})`);
    return ['¿Qué servicio quieres reservar?', ...lines];
  }
  if (text === '2') {
    const appts = await upcomingAppointments(phone);
    if (appts.length === 0) return ['No tienes citas próximas.', mainMenuText()];
    await saveConversation(phone, { step: 'CANCEL_SELECT', data: { ...state.data, appointmentIds: appts.map((a) => a.id) } });
    return ['¿Cuál cita quieres cancelar?', ...appts.map((a, i) => `${i + 1}️⃣ ${a.label}`)];
  }
  if (text === '3') {
    const appts = await upcomingAppointments(phone);
    if (appts.length === 0) return ['No tienes citas próximas.', mainMenuText()];
    return ['Tus próximas citas:', ...appts.map((a) => `• ${a.label}`), '', mainMenuText()];
  }
  return ['No entendí. Escribe "menu" para ver las opciones.', mainMenuText()];
}

async function handleBookService(phone, text, branch, state) {
  const services = await getActiveServices(branch.id);
  const idx = Number(text) - 1;
  const service = services[idx];
  if (!service) return ['Opción inválida. Escribe el número del servicio.'];

  const staff = await getActiveStaff(branch.id);
  await saveConversation(phone, { step: 'BOOK_STAFF', data: { ...state.data, serviceId: service.id, staffOptions: staff.map((s) => s.id) } });

  if (staff.length === 1) {
    return handleBookStaff(phone, '1', branch, { data: { ...state.data, serviceId: service.id, staffOptions: [staff[0].id] } });
  }
  const lines = staff.map((s, i) => `${i + 1}️⃣ ${s.name}`);
  return ['¿Con quién prefieres tu cita?', `0️⃣ Cualquiera disponible`, ...lines];
}

async function handleBookStaff(phone, text, branch, state) {
  const allStaff = await getActiveStaff(branch.id);
  let staffId;
  if (text === '0') {
    staffId = 'any';
  } else {
    const idx = Number(text) - 1;
    const chosen = allStaff[idx];
    if (!chosen) return ['Opción inválida.'];
    staffId = chosen.id;
  }

  const dateOptions = buildDateOptions(branch.timezone);
  await saveConversation(phone, { step: 'BOOK_DAY', data: { ...state.data, staffId, dateOptions } });
  const lines = dateOptions.map((d, i) => `${i + 1}️⃣ ${d.label}`);
  return ['¿Qué día te viene bien?', ...lines];
}

async function handleBookDay(phone, text, branch, state) {
  const idx = Number(text) - 1;
  const chosen = state.data.dateOptions?.[idx];
  if (!chosen) return ['Opción inválida. Elige uno de los días de la lista.'];

  const service = await docById('services', state.data.serviceId);
  const staffList = state.data.staffId === 'any' ? await getActiveStaff(branch.id) : [await docById('staff', state.data.staffId)];

  let allSlots = [];
  for (const staff of staffList.filter(Boolean)) {
    const existing = await appointmentsForStaffOnDay(staff.id, chosen.dateStr, branch.timezone);
    const slots = getAvailableSlots(staff, service.durationMinutes, chosen.dateStr, existing, branch.timezone, Date.now());
    allSlots.push(...slots.map((s) => ({ ...s, staffId: staff.id, staffName: staff.name })));
  }
  allSlots.sort((a, b) => a.startsAt - b.startsAt);
  allSlots = allSlots.slice(0, 8);

  if (allSlots.length === 0) {
    await saveConversation(phone, { step: 'BOOK_WAITLIST_ASK', data: { ...state.data, dateStr: chosen.dateStr, dateLabel: chosen.label } });
    return [`No quedan horarios libres el ${chosen.label}.`, '¿Quieres que te avisemos automáticamente si se libera un turno ese día? (responde SI o NO)'];
  }

  await saveConversation(phone, { step: 'BOOK_TIME', data: { ...state.data, dateStr: chosen.dateStr, slots: allSlots } });
  const lines = allSlots.map((s, i) => `${i + 1}️⃣ ${formatTime(s.startsAt, branch.timezone)}${staffList.length > 1 ? ` — ${s.staffName}` : ''}`);
  return [`Horarios disponibles el ${chosen.label}:`, ...lines];
}

async function handleBookTime(phone, text, branch, state) {
  const idx = Number(text) - 1;
  const slot = state.data.slots?.[idx];
  if (!slot) return ['Opción inválida. Elige uno de los horarios de la lista.'];

  const service = await docById('services', state.data.serviceId);

  try {
    const { appointment } = await api.createAppointment({
      branchId: branch.id,
      staffId: slot.staffId,
      serviceId: service.id,
      clientPhone: phone,
      clientName: state.data.clientName || 'Cliente',
      startsAt: slot.startsAt,
      source: 'whatsapp',
    });
    await saveConversation(phone, {
      step: 'BOOK_RECURRING_ASK',
      data: {
        ...state.data,
        appointmentId: appointment.id,
        dayOfWeek: new Date(slot.startsAt).getDay(),
        time: formatTime(slot.startsAt, branch.timezone),
        staffId: slot.staffId,
        serviceId: service.id,
      },
    });
    return [
      `✅ Cita confirmada el ${formatDate(slot.startsAt, branch.timezone)} a las ${formatTime(slot.startsAt, branch.timezone)}.`,
      '¿Quieres que se repita automáticamente cada semana a esta misma hora? (SI / NO)',
    ];
  } catch (err) {
    if (err.code === 'slot_taken') {
      return ['Uy, justo alguien tomó ese horario. Escribe "menu" para elegir otro.'];
    }
    console.error('[conversation] error creando cita', err);
    return ['Ocurrió un error agendando la cita. Intenta de nuevo en unos minutos.'];
  }
}

async function handleRecurringAsk(phone, text, branch, state) {
  if (/^s(i|í)/i.test(text)) {
    await api.createRecurringBooking({
      branchId: branch.id,
      staffId: state.data.staffId,
      serviceId: state.data.serviceId,
      clientPhone: phone,
      clientName: state.data.clientName || 'Cliente',
      dayOfWeek: state.data.dayOfWeek,
      time: state.data.time,
    });
    await resetToMainMenu(phone);
    return [`Listo, quedará reservado todos los ${WEEKDAY_NAMES[state.data.dayOfWeek]} a las ${state.data.time}.`, mainMenuText()];
  }
  await resetToMainMenu(phone);
  return ['Perfecto, nos vemos en tu cita.', mainMenuText()];
}

async function handleWaitlistAsk(phone, text, branch, state) {
  if (/^s(i|í)/i.test(text)) {
    await api.addToWaitlist({
      branchId: branch.id,
      staffId: state.data.staffId === 'any' ? null : state.data.staffId,
      serviceId: state.data.serviceId,
      clientPhone: phone,
      clientName: state.data.clientName || 'Cliente',
      desiredDate: state.data.dateStr,
      desiredWindow: null,
    });
    await resetToMainMenu(phone);
    return ['Te avisaremos por aquí en cuanto se libere un turno ese día.', mainMenuText()];
  }
  await resetToMainMenu(phone);
  return [mainMenuText()];
}

async function handleCancelSelect(phone, text, branch, state) {
  const idx = Number(text) - 1;
  const appointmentId = state.data.appointmentIds?.[idx];
  if (!appointmentId) return ['Opción inválida.'];
  await api.cancelAppointment(appointmentId);
  await resetToMainMenu(phone);
  return ['Tu cita fue cancelada.', mainMenuText()];
}

// --- Helpers ---

async function docById(col, id) {
  if (!id) return null;
  const snap = await db.collection(col).doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function appointmentsForStaffOnDay(staffId, dateStr, timezone) {
  const snap = await db.collection('appointments').where('staffId', '==', staffId).where('status', 'in', ['confirmed', 'pending_deposit']).get();
  return snap.docs
    .map((d) => d.data())
    .filter((a) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(a.startsAt) === dateStr)
    .map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt }));
}

async function upcomingAppointments(phone) {
  const snap = await db
    .collection('appointments')
    .where('clientPhone', '==', phone)
    .where('status', 'in', ['confirmed', 'pending_deposit'])
    .orderBy('startsAt', 'asc')
    .limit(5)
    .get();
  return snap.docs.map((d) => {
    const a = d.data();
    return { id: d.id, label: `${formatDate(a.startsAt, 'Asia/Jerusalem')} ${formatTime(a.startsAt, 'Asia/Jerusalem')}` };
  });
}

function buildDateOptions(timezone) {
  const options = [];
  const now = Date.now();
  for (let i = 0; i < DAYS_TO_OFFER; i++) {
    const t = now + i * 86400000;
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(t);
    const weekday = WEEKDAY_NAMES[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
    const label = i === 0 ? `Hoy (${weekday})` : i === 1 ? `Mañana (${weekday})` : `${weekday} ${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;
    options.push({ dateStr, label });
  }
  return options;
}

function formatDate(epochMs, timezone) {
  return new Intl.DateTimeFormat('es-ES', { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(epochMs);
}

function formatTime(epochMs, timezone) {
  return new Intl.DateTimeFormat('es-ES', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(epochMs);
}
