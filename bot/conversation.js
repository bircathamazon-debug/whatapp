/**
 * Máquina de estados de la conversación de reserva por WhatsApp.
 * El estado de cada cliente se persiste en Firestore (waConversations/{phone})
 * para sobrevivir reinicios del bot.
 *
 * Todos los textos que ve el cliente están en hebreo (el negocio es en Israel).
 * Los comentarios del código quedan en español para quien mantiene el proyecto.
 */
import { db } from './firebaseClient.js';
import { getAvailableSlots, toEpoch } from './availability.js';
import * as api from './botApiClient.js';

const CONV_COL = 'waConversations';
// Recordatorio explícito de que hay que ESCRIBIR el número como respuesta
// (no es un botón que se toca) — se repite en cada pantalla con opciones.
const CHOOSE_NUMBER_HINT = '✍️ כתבו את המספר של האפשרות הרצויה בהודעה.';
const DAYS_TO_OFFER = 6;
const WEEKDAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

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
    'במה נוכל לעזור?',
    '1️⃣ לקבוע תור',
    '2️⃣ לבטל תור',
    '3️⃣ לצפייה בתורים הקרובים שלי',
    '4️⃣ לדבר ישירות עם הספר',
    '',
    'כתבו את מספר האפשרות הרצויה.',
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
  if (!branch) return ['הבוט לא הוגדר כראוי (חסר מזהה סניף). יש להודיע לספר.'];

  // Comandos globales, funcionan en cualquier paso.
  if (/^(menu|תפריט|היי|שלום|hi)$/i.test(text)) {
    await resetToMainMenu(phone);
    return [`שלום! ברוכים הבאים ל${branch.name}.`, mainMenuText()];
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
      return ['✅ התור אושר. מחכים לך!'];
    }
    await api.cancelAppointment(data.relatedAppointmentId);
    await doc.ref.update({ replyHandledAt: Date.now() });
    return ['התור בוטל. כתבו "menu" כדי לקבוע תור חדש.'];
  }
  if (data.awaitingReply === 'waitlist_offer') {
    if (digit !== '1') {
      await doc.ref.update({ replyHandledAt: Date.now() });
      return ['הבנו, תישארו ברשימת ההמתנה.'];
    }
    try {
      await api.acceptWaitlistOffer(data.data?.waitlistId);
      await doc.ref.update({ replyHandledAt: Date.now() });
      return ['✅ התור אושר. מחכים לך!'];
    } catch {
      await doc.ref.update({ replyHandledAt: Date.now() });
      return ['אופס, התור הזה כבר נתפס על ידי מישהו אחר. תישארו ברשימת ההמתנה לתור הבא שיתפנה.'];
    }
  }
  return [mainMenuText()];
}

async function handleMainMenu(phone, text, branch, state) {
  if (text === '1') {
    const services = await getActiveServices(branch.id);
    if (services.length === 0) return ['עדיין לא הוגדרו שירותים. יש להודיע לספר.'];
    await saveConversation(phone, { step: 'BOOK_SERVICE', data: { ...state.data, services: services.map((s) => s.id) } });
    const lines = services.map((s, i) => `${i + 1}️⃣ ✂️ ${s.name} — ₪${s.price}`);
    return ['איזה שירות תרצו להזמין?', ...lines, CHOOSE_NUMBER_HINT];
  }
  if (text === '2') {
    const appts = await upcomingAppointments(phone);
    if (appts.length === 0) return ['אין לך תורים קרובים.', mainMenuText()];
    await saveConversation(phone, { step: 'CANCEL_SELECT', data: { ...state.data, appointmentIds: appts.map((a) => a.id) } });
    return ['איזה תור תרצו לבטל?', ...appts.map((a, i) => `${i + 1}️⃣ ${a.label}`), CHOOSE_NUMBER_HINT];
  }
  if (text === '3') {
    const appts = await upcomingAppointments(phone);
    if (appts.length === 0) return ['אין לך תורים קרובים.', mainMenuText()];
    return ['התורים הקרובים שלך:', ...appts.map((a) => `• ${a.label}`), '', mainMenuText()];
  }
  if (text === '4') {
    const staff = await getActiveStaff(branch.id);
    if (staff.length === 0) return ['לא הוגדר ספר בסניף כרגע. נסו שוב מאוחר יותר.', mainMenuText()];
    const primary = staff[0];
    const waLink = `https://wa.me/${primary.phone.replace(/\D/g, '')}`;
    return [
      `אפשר לדבר ישירות עם ${primary.name}:`,
      `📞 ${primary.phone}`,
      waLink,
      '',
      mainMenuText(),
    ];
  }
  return ['לא הבנתי. כתבו "menu" לצפייה באפשרויות.', mainMenuText()];
}

async function handleBookService(phone, text, branch, state) {
  const services = await getActiveServices(branch.id);
  const idx = Number(text) - 1;
  const service = services[idx];
  if (!service) return ['בחירה לא תקינה. כתבו את מספר השירות.'];

  const staff = await getActiveStaff(branch.id);
  await saveConversation(phone, { step: 'BOOK_STAFF', data: { ...state.data, serviceId: service.id, staffOptions: staff.map((s) => s.id) } });

  if (staff.length === 1) {
    return handleBookStaff(phone, '1', branch, { data: { ...state.data, serviceId: service.id, staffOptions: [staff[0].id] } });
  }
  const lines = staff.map((s, i) => `${i + 1}️⃣ ${s.name}`);
  return ['עם מי תרצו לקבוע את התור?', '0️⃣ כל מי שפנוי', ...lines, CHOOSE_NUMBER_HINT];
}

async function handleBookStaff(phone, text, branch, state) {
  const allStaff = await getActiveStaff(branch.id);
  let staffId;
  if (text === '0') {
    staffId = 'any';
  } else {
    const idx = Number(text) - 1;
    const chosen = allStaff[idx];
    if (!chosen) return ['בחירה לא תקינה.'];
    staffId = chosen.id;
  }

  const dateOptions = buildDateOptions(branch.timezone);
  await saveConversation(phone, { step: 'BOOK_DAY', data: { ...state.data, staffId, dateOptions } });
  const lines = dateOptions.map((d, i) => `${i + 1}️⃣ ${d.label}`);
  return ['איזה יום מתאים לך?', ...lines, CHOOSE_NUMBER_HINT];
}

async function handleBookDay(phone, text, branch, state) {
  const idx = Number(text) - 1;
  const chosen = state.data.dateOptions?.[idx];
  if (!chosen) return ['בחירה לא תקינה. יש לבחור אחד מהימים ברשימה.'];

  const service = await docById('services', state.data.serviceId);
  const staffList = state.data.staffId === 'any' ? await getActiveStaff(branch.id) : [await docById('staff', state.data.staffId)];

  let allSlots = [];
  for (const staff of staffList.filter(Boolean)) {
    const existing = await appointmentsForStaffOnDay(staff.id, chosen.dateStr, branch.timezone);
    const slots = getAvailableSlots(staff, service.durationMinutes, chosen.dateStr, existing, branch.timezone, Date.now());
    allSlots.push(...slots.map((s) => ({ ...s, staffId: staff.id, staffName: staff.name })));
  }
  allSlots.sort((a, b) => a.startsAt - b.startsAt);

  if (allSlots.length === 0) {
    await saveConversation(phone, { step: 'BOOK_WAITLIST_ASK', data: { ...state.data, dateStr: chosen.dateStr, dateLabel: chosen.label } });
    return [`אין תורים פנויים ב-${chosen.label}.`, 'נעדכן אותך אוטומטית אם יתפנה תור באותו היום? כתבו כן או לא.'];
  }

  // allSlotsForDay: lista completa del día (para buscar "la hora más cercana"
  // si el cliente escribe una hora directamente). slots: solo lo que se
  // muestra numerado ahora mismo (máx. 8, o menos si venimos de una
  // búsqueda por hora).
  const displaySlots = allSlots.slice(0, 8);
  await saveConversation(phone, { step: 'BOOK_TIME', data: { ...state.data, dateStr: chosen.dateStr, slots: displaySlots, allSlotsForDay: allSlots } });
  const lines = displaySlots.map((s, i) => `${i + 1}️⃣ ${formatTime(s.startsAt, branch.timezone)}${staffList.length > 1 ? ` — ${s.staffName}` : ''}`);
  return [
    `באיזו שעה נוח לך ב-${chosen.label}? אפשר לכתוב את השעה ישירות (למשל 9:30) — השעות הן בקפיצות של 15 דקות: 9:00, 9:15, 9:30...`,
    'או לבחור אחת מהשעות הפנויות:',
    ...lines,
    '0️⃣ לבחור יום אחר',
  ];
}

async function handleBookTime(phone, text, branch, state) {
  if (text === '0') {
    await saveConversation(phone, { step: 'BOOK_DAY', data: state.data });
    const lines = (state.data.dateOptions || []).map((d, i) => `${i + 1}️⃣ ${d.label}`);
    return ['איזה יום מתאים לך?', ...lines];
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

    const nearest = [...daySlots]
      .sort((a, b) => Math.abs(a.startsAt - desiredEpoch) - Math.abs(b.startsAt - desiredEpoch))
      .slice(0, 3)
      .sort((a, b) => a.startsAt - b.startsAt);

    if (nearest.length === 0) {
      return ['לא נשארו תורים פנויים באותו יום. כתבו 0️⃣ לבחור יום אחר.'];
    }

    await saveConversation(phone, { step: 'BOOK_TIME', data: { ...state.data, slots: nearest } });
    const lines = nearest.map((s, i) => `${i + 1}️⃣ ${formatTime(s.startsAt, branch.timezone)}${(state.data.staffId === 'any' && nearest.some((n) => n.staffId !== s.staffId)) ? ` — ${s.staffName}` : ''}`);
    return [`השעה ${String(typed.h).padStart(2, '0')}:${String(typed.m).padStart(2, '0')} תפוסה. הכי קרובות פנויות:`, ...lines, '0️⃣ לבחור יום אחר'];
  }

  return [
    'לא הבנתי את הבחירה.',
    'כתבו את מספר השעה מהרשימה, כתבו שעה ישירות (למשל 9:30), או 0️⃣ כדי לבחור יום אחר.',
  ];
}

async function bookChosenSlot(phone, branch, state, slot) {
  const service = await docById('services', state.data.serviceId);

  try {
    const { appointment } = await api.createAppointment({
      branchId: branch.id,
      staffId: slot.staffId,
      serviceId: service.id,
      clientPhone: phone,
      clientName: state.data.clientName || 'לקוח',
      startsAt: slot.startsAt,
      source: 'whatsapp',
    });
    await resetToMainMenu(phone);
    return [`✅ התור אושר לתאריך ${formatDate(slot.startsAt, branch.timezone)} בשעה ${formatTime(slot.startsAt, branch.timezone)}.`];
  } catch (err) {
    if (err.code === 'slot_taken') {
      return ['אופס, מישהו אחר תפס את השעה הזו הרגע. כתבו "menu" לבחירת שעה אחרת.'];
    }
    console.error('[conversation] error creando cita', err);
    return ['אירעה שגיאה בקביעת התור. נסו שוב בעוד כמה דקות.'];
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
  if (/^כן/.test(text)) {
    await api.addToWaitlist({
      branchId: branch.id,
      staffId: state.data.staffId === 'any' ? null : state.data.staffId,
      serviceId: state.data.serviceId,
      clientPhone: phone,
      clientName: state.data.clientName || 'לקוח',
      desiredDate: state.data.dateStr,
      desiredWindow: null,
    });
    await resetToMainMenu(phone);
    return ['נודיע לך כאן ברגע שיתפנה תור באותו היום.', mainMenuText()];
  }
  await resetToMainMenu(phone);
  return [mainMenuText()];
}

async function handleCancelSelect(phone, text, branch, state) {
  const idx = Number(text) - 1;
  const appointmentId = state.data.appointmentIds?.[idx];
  if (!appointmentId) return ['בחירה לא תקינה.'];
  await api.cancelAppointment(appointmentId);
  await resetToMainMenu(phone);
  return ['התור בוטל.', mainMenuText()];
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
    const label = i === 0 ? `היום (${weekday})` : i === 1 ? `מחר (${weekday})` : `${weekday} ${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;
    options.push({ dateStr, label });
  }
  return options;
}

function formatDate(epochMs, timezone) {
  return new Intl.DateTimeFormat('he-IL', { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(epochMs);
}

function formatTime(epochMs, timezone) {
  return new Intl.DateTimeFormat('he-IL', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(epochMs);
}
