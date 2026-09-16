/**
 * Cálculo de huecos disponibles para reservar.
 * Copia en TypeScript de bot/availability.js — se mantiene independiente
 * porque tanto Firebase Functions como el hosting del bot despliegan solo
 * su propia carpeta (sin acceso al resto del monorepo). Cualquier cambio
 * de lógica debe reflejarse en ambas copias.
 */

export interface DayHours {
  start: string;
  end: string;
}
export type WeeklyHours = Record<number, DayHours | null>;

const SLOT_STEP_MINUTES = 15;

export interface BlockedTimeWindow {
  staffId: string | null;
  date: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
}

export function getAvailableSlots(
  staff: { id: string; hours: WeeklyHours; blockedDates: string[] },
  durationMinutes: number,
  dateStr: string,
  existingAppointments: { startsAt: number; endsAt: number }[],
  timezone: string,
  nowMs: number,
  blockedTimes: BlockedTimeWindow[] = []
): { startsAt: number; endsAt: number }[] {
  if (staff.blockedDates.includes(dateStr)) return [];

  const date = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = date.getDay();
  const hours = staff.hours[dayOfWeek];
  if (!hours) return [];

  const relevantBlocks = blockedTimes.filter((b) => b.date === dateStr && (b.staffId === null || b.staffId === staff.id));
  if (relevantBlocks.some((b) => b.allDay)) return [];

  const dayStart = toEpoch(dateStr, hours.start, timezone);
  const dayEnd = toEpoch(dateStr, hours.end, timezone);
  const blockedWindows = relevantBlocks.map((b) => ({
    startsAt: toEpoch(dateStr, b.startTime as string, timezone),
    endsAt: toEpoch(dateStr, b.endTime as string, timezone),
  }));

  const slots: { startsAt: number; endsAt: number }[] = [];
  for (let t = dayStart; t + durationMinutes * 60000 <= dayEnd; t += SLOT_STEP_MINUTES * 60000) {
    const slotEnd = t + durationMinutes * 60000;
    if (t < nowMs) continue;
    const overlaps = existingAppointments.some((a) => t < a.endsAt && slotEnd > a.startsAt);
    const blocked = blockedWindows.some((b) => t < b.endsAt && slotEnd > b.startsAt);
    if (!overlaps && !blocked) slots.push({ startsAt: t, endsAt: slotEnd });
  }
  return slots;
}

export function isSlotFree(
  existingAppointments: { startsAt: number; endsAt: number }[],
  startsAt: number,
  endsAt: number
): boolean {
  return !existingAppointments.some((a) => startsAt < a.endsAt && endsAt > a.startsAt);
}

export function toEpoch(dateStr: string, timeStr: string, timezone: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  const naive = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, naive);
  return naive.getTime() - offsetMinutes * 60000;
}

/** Minutos que le toma a este peluquero este servicio (usa su propio
 * override si lo configuró; si no, la duración por defecto del servicio). */
export function getStaffServiceDuration(
  staff: { serviceDurations?: Record<string, number> },
  service: { id: string; durationMinutes: number }
): number {
  return staff.serviceDurations?.[service.id] ?? service.durationMinutes;
}

export function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
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
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value])) as Record<
    string,
    string
  >;
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
