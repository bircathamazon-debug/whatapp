/**
 * Cálculo de huecos disponibles para reservar.
 * Copia en TypeScript de shared/availability.js — se mantiene independiente
 * porque Firebase despliega solo el contenido de functions/ (sin acceso al
 * resto del monorepo). Cualquier cambio de lógica debe reflejarse en ambos.
 */

export interface DayHours {
  start: string;
  end: string;
}
export type WeeklyHours = Record<number, DayHours | null>;

const SLOT_STEP_MINUTES = 15;

export function getAvailableSlots(
  staff: { hours: WeeklyHours; blockedDates: string[] },
  durationMinutes: number,
  dateStr: string,
  existingAppointments: { startsAt: number; endsAt: number }[],
  timezone: string,
  nowMs: number
): { startsAt: number; endsAt: number }[] {
  if (staff.blockedDates.includes(dateStr)) return [];

  const date = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = date.getDay();
  const hours = staff.hours[dayOfWeek];
  if (!hours) return [];

  const dayStart = toEpoch(dateStr, hours.start, timezone);
  const dayEnd = toEpoch(dateStr, hours.end, timezone);

  const slots: { startsAt: number; endsAt: number }[] = [];
  for (let t = dayStart; t + durationMinutes * 60000 <= dayEnd; t += SLOT_STEP_MINUTES * 60000) {
    const slotEnd = t + durationMinutes * 60000;
    if (t < nowMs) continue;
    const overlaps = existingAppointments.some((a) => t < a.endsAt && slotEnd > a.startsAt);
    if (!overlaps) slots.push({ startsAt: t, endsAt: slotEnd });
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
