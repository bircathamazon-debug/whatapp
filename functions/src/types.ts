// Copia de shared/types.ts limitada a lo que usan las Cloud Functions.
// (Firebase solo despliega functions/, sin acceso al resto del monorepo.)

export type NotificationChannel = 'whatsapp' | 'sms' | 'call';

export type AppointmentStatus = 'pending_deposit' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface Branch {
  id: string;
  name: string;
  address: string;
  geonameId: string;
  timezone: string;
  shabbatMode: 'off' | 'closed' | 'silent';
  phone: string;
  whatsappJid?: string;
}

export interface WeeklyHours {
  [dayOfWeek: number]: { start: string; end: string } | null;
}

export interface Staff {
  id: string;
  branchId: string;
  name: string;
  phone: string;
  hours: WeeklyHours;
  blockedDates: string[];
  active: boolean;
}

export interface Service {
  id: string;
  branchId: string;
  name: string;
  durationMinutes: number;
  price: number;
  requiresDeposit: boolean;
  depositAmount: number;
}

export interface Client {
  id: string;
  phone: string;
  name: string;
  branchId: string;
  birthday?: string;
  noShowCount: number;
  completedCount: number;
  loyaltyRedeemedAt?: number[];
  preferredChannel: NotificationChannel;
  blockedForDeposit: boolean;
  createdAt: number;
}

export interface Appointment {
  id: string;
  branchId: string;
  staffId: string;
  serviceId: string;
  clientId: string;
  clientPhone: string;
  clientName: string;
  startsAt: number;
  endsAt: number;
  status: AppointmentStatus;
  source: 'whatsapp' | 'phone' | 'admin' | 'recurring';
  recurringBookingId?: string | null;
  remindersSent: number[]; // horas-antes ya notificadas, ej. [24, 2]
  confirmedAt?: number | null;
  depositPaid: boolean;
  googleCalendarEventId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface WaitlistEntry {
  id: string;
  branchId: string;
  staffId: string | null;
  serviceId: string;
  clientId: string;
  clientPhone: string;
  clientName: string;
  desiredDate: string;
  desiredWindow: { start: string; end: string } | null;
  status: 'waiting' | 'offered' | 'booked' | 'expired' | 'cancelled';
  offeredAppointmentSlot?: { startsAt: number; endsAt: number; staffId: string } | null;
  offerExpiresAt?: number | null;
  createdAt: number;
}

export interface RecurringBooking {
  id: string;
  branchId: string;
  staffId: string;
  serviceId: string;
  clientId: string;
  clientPhone: string;
  clientName: string;
  dayOfWeek: number;
  time: string;
  active: boolean;
  nextGeneratedThrough: number;
  createdAt: number;
}

export interface OutboundNotification {
  id: string;
  channel: NotificationChannel;
  to: string;
  branchId: string;
  template: string;
  data: Record<string, string>;
  text: string;
  status: 'pending' | 'sent' | 'failed';
  deliverAfter: number;
  relatedAppointmentId?: string | null;
  awaitingReply?: 'confirm_cancel' | 'waitlist_offer' | null;
  createdAt: number;
  sentAt?: number | null;
  error?: string | null;
}

export const LOYALTY_THRESHOLD = 10;
export const NO_SHOW_DEPOSIT_THRESHOLD = 2;
export const REMINDER_WINDOWS_HOURS = [24, 2];
