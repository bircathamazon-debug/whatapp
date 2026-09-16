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
  themeMode?: 'light' | 'dark'; // tema de la app del peluquero; sin definir = claro
  language?: 'he' | 'en' | 'es'; // idioma del bot, el IVR y la app; sin definir = hebreo
  /** Interruptor de emergencia: pausa el bot y el IVR (llamadas van directo
   *  al peluquero) ante un problema técnico, hasta que se desactive. */
  maintenanceMode?: boolean;
  /** Suscripción de pago del sistema (Stripe), cobro mensual recurrente. */
  subscription?: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    status: 'none' | 'active' | 'past_due' | 'canceled';
    currentPeriodEnd?: number | null; // epoch ms del próximo cobro
  };
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
  /** Minutos que le toma a ESTE peluquero cada servicio, si difiere del
   *  durationMinutes por defecto del servicio (serviceId -> minutos). */
  serviceDurations?: Record<string, number>;
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
  remindersSent: number[]; // horas-antes ya notificadas, ej. [24, 2, 0.5]
  comebackReminderSentAt?: number | null; // aviso de "volvé a cortarte el pelo" al mes
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

/**
 * Horario en el que un peluquero (o toda la sucursal, si staffId es null)
 * no trabaja: feriado, turno médico, vacaciones, o el día entero cerrado
 * (allDay: true, ignora startTime/endTime). El motor de disponibilidad
 * excluye estos huecos al ofrecer horarios por WhatsApp/teléfono/panel.
 */
export interface BlockedTime {
  id: string;
  branchId: string;
  staffId: string | null; // null = aplica a todos los peluqueros de la sucursal
  date: string; // 'YYYY-MM-DD'
  allDay: boolean;
  startTime: string | null; // 'HH:mm', null si allDay
  endTime: string | null; // 'HH:mm', null si allDay
  reason?: string;
  createdAt: number;
}

/**
 * Pregunta o mensaje libre del cliente que el bot no supo interpretar
 * (no coincidía con ninguna opción esperada). Queda guardado para que el
 * peluquero lo revise en la app y, si hace falta, se le enseñe al bot a
 * responderlo — retroalimentación para no quedarse nunca sin respuesta.
 */
export interface UnansweredMessage {
  id: string;
  branchId: string;
  phone: string;
  clientName?: string;
  text: string;
  step: string; // en qué pantalla de la conversación pasó (ej. 'MAIN_MENU')
  resolved: boolean;
  createdAt: number;
}

/**
 * Gasto del negocio (alquiler, agua/luz, empleados, insumos, otro) cargado
 * a mano por el peluquero en la pantalla de Finanzas, para poder comparar
 * ingresos contra gastos.
 */
export interface Expense {
  id: string;
  branchId: string;
  category: 'rent' | 'utilities' | 'staff' | 'supplies' | 'other';
  description?: string;
  amount: number;
  date: string; // 'YYYY-MM-DD'
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
export const REMINDER_WINDOWS_HOURS = [24, 2, 0.5]; // recordatorios antes de la cita (horas; 0.5 = 30 min)
