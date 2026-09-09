/**
 * Cálculo de huecos disponibles para reservar.
 * Módulo JS puro (sin dependencias) para poder importarse tanto desde
 * el bot de WhatsApp (Node/ESM) como desde las Cloud Functions (TS, allowJs).
 */

const SLOT_STEP_MINUTES = 15;

/**
 * @param {{hours: Record<number, {start:string,end:string}|null>, blockedDates: string[]}} staff
 * @param {number} durationMinutes duración del servicio
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {{startsAt:number, endsAt:number}[]} existingAppointments citas ya confirmadas ese día para ese staff
 * @param {string} timezone IANA tz, ej 'Asia/Jerusalem'
 * @param {number} nowMs epoch ms actual (para no ofrecer huecos en el pasado)
 * @returns {{startsAt:number, endsAt:number}[]}
 */
function getAvailableSlots(staff, durationMinutes, dateStr, existingAppointments, timezone, nowMs) {
  if (staff.blockedDates.includes(dateStr)) return [];

  const date = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = date.getDay();
  const hours = staff.hours[dayOfWeek];
  if (!hours) return [];

  const dayStart = toEpoch(dateStr, hours.start, timezone);
  const dayEnd = toEpoch(dateStr, hours.end, timezone);

  const slots = [];
  for (let t = dayStart; t + durationMinutes * 60000 <= dayEnd; t += SLOT_STEP_MINUTES * 60000) {
    const slotEnd = t + durationMinutes * 60000;
    if (t < nowMs) continue;
    const overlaps = existingAppointments.some(
      (a) => t < a.endsAt && slotEnd > a.startsAt
    );
    if (!overlaps) slots.push({ startsAt: t, endsAt: slotEnd });
  }
  return slots;
}

/**
 * Verifica si un horario propuesto sigue libre (usar dentro de una transacción
 * de Firestore justo antes de escribir la cita, para evitar doble reserva por
 * condición de carrera entre WhatsApp y teléfono).
 * @param {{startsAt:number, endsAt:number}[]} existingAppointments
 */
function isSlotFree(existingAppointments, startsAt, endsAt) {
  return !existingAppointments.some((a) => startsAt < a.endsAt && endsAt > a.startsAt);
}

/** Convierte 'YYYY-MM-DD' + 'HH:mm' (hora local de la sucursal) a epoch ms. */
function toEpoch(dateStr, timeStr, timezone) {
  // Enfoque simple y dependency-free: asumimos que el servidor corre en UTC
  // y aplicamos el offset fijo de Israel (+2 invierno / +3 verano) resuelto
  // vía Intl, que sí conoce DST reales.
  const [h, m] = timeStr.split(':').map(Number);
  const naive = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, naive);
  return naive.getTime() - offsetMinutes * 60000;
}

function getTimezoneOffsetMinutes(timezone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUTC - date.getTime()) / 60000;
}

module.exports = { getAvailableSlots, isSlotFree, toEpoch, getTimezoneOffsetMinutes, SLOT_STEP_MINUTES };
