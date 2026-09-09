// Dominio: Sistema de citas para peluquería (multi-sucursal)

export type NotificationChannel = 'whatsapp' | 'sms' | 'call';

export type AppointmentStatus =
  | 'pending_deposit' // esperando pago de depósito antes de confirmar
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export interface Branch {
  id: string;
  name: string;
  address: string;
  /** Ciudad/geoname usado para calcular horarios de Shabat (Hebcal) */
  geonameId: string;
  timezone: string; // ej. 'Asia/Jerusalem'
  /** 'off' = nunca cierra por Shabat, 'closed' = no acepta reservas durante Shabat,
   *  'silent' = acepta reservas pero no notifica al peluquero hasta Motzaei Shabat */
  shabbatMode: 'off' | 'closed' | 'silent';
  phone: string; // número de teléfono para el IVR (Twilio)
  whatsappJid?: string; // JID del número de WhatsApp del bot para esta sucursal
}

export interface WeeklyHours {
  // 0 = domingo ... 6 = sábado
  [dayOfWeek: number]: { start: string; end: string } | null; // null = cerrado
}

export interface Staff {
  id: string;
  branchId: string;
  name: string;
  phone: string;
  hours: WeeklyHours;
  blockedDates: string[]; // 'YYYY-MM-DD', vacaciones/días sueltos bloqueados
  active: boolean;
  googleCalendarTokens?: {
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
  } | null;
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
  phone: string; // E.164, clave de búsqueda principal
  name: string;
  branchId: string;
  birthday?: string; // 'MM-DD'
  noShowCount: number;
  completedCount: number; // cortes completados, para fidelidad
  loyaltyRedeemedAt?: number[]; // completedCount en el momento de canjear premio
  preferredChannel: NotificationChannel;
  blockedForDeposit: boolean; // true = debe pagar depósito para reservar (por historial de no-show)
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
  startsAt: number; // epoch ms
  endsAt: number; // epoch ms
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
  staffId: string | null; // null = cualquier peluquero
  serviceId: string;
  clientId: string;
  clientPhone: string;
  clientName: string;
  desiredDate: string; // 'YYYY-MM-DD'
  desiredWindow: { start: string; end: string } | null; // franja horaria preferida, null = todo el día
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
  dayOfWeek: number; // 0-6
  time: string; // 'HH:mm'
  active: boolean;
  nextGeneratedThrough: number; // epoch ms — hasta cuándo ya se generaron citas
  createdAt: number;
}

/** Cola de salida: functions escribe aquí, el bot de WhatsApp los envía */
export interface OutboundNotification {
  id: string;
  channel: NotificationChannel;
  to: string; // teléfono E.164 o JID
  branchId: string;
  template: string;
  data: Record<string, string>;
  text: string; // mensaje ya renderizado
  status: 'pending' | 'sent' | 'failed';
  deliverAfter: number; // epoch ms — permite retener mensajes en Shabat
  relatedAppointmentId?: string | null;
  awaitingReply?: 'confirm_cancel' | 'waitlist_offer' | null;
  createdAt: number;
  sentAt?: number | null;
  error?: string | null;
}

export interface Campaign {
  id: string;
  branchId: string;
  type: 'empty_slot' | 'birthday' | 'custom';
  message: string;
  sentTo: number;
  createdAt: number;
}

export const LOYALTY_THRESHOLD = 10; // cortes para desbloquear descuento
export const NO_SHOW_DEPOSIT_THRESHOLD = 2; // no-shows antes de exigir depósito
export const REMINDER_WINDOWS_HOURS = [24, 2]; // recordatorios antes de la cita
