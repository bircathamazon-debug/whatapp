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
  phone: string; // número de teléfono para el IVR (Telnyx)
  whatsappJid?: string; // JID del número de WhatsApp del bot para esta sucursal
  themeMode?: 'light' | 'dark'; // tema de la app del peluquero; sin definir = claro
  language?: 'he' | 'en' | 'es'; // idioma del bot, el IVR y la app; sin definir = hebreo
  /** Interruptor de emergencia: pausa el bot y el IVR (llamadas van directo
   *  al peluquero) ante un problema técnico, hasta que se desactive. */
  maintenanceMode?: boolean;
  /**
   * Suscripción de pago del sistema, cobro mensual recurrente.
   * `provider` decide qué pasarela procesa el cobro: Stripe no está
   * disponible en Israel ni Venezuela (solo México), así que las
   * sucursales en hebreo usan Tranzila en su lugar. Con Tranzila, el
   * cobro mensual lo dispara nuestro propio cron (`chargeTranzilaSubscriptions`
   * en functions/src/crons.ts) usando el token guardado — Tranzila no
   * gestiona el calendario de cobros como sí hace Stripe.
   */
  subscription?: {
    provider?: 'stripe' | 'tranzila';
    status: 'none' | 'active' | 'past_due' | 'canceled';
    currentPeriodEnd?: number | null; // epoch ms del próximo cobro
    // Stripe
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    // Tranzila
    tranzilaToken?: string;
    tranzilaExpDate?: string; // 'MMYY'
  };
  /** Campaña de días flojos (ej. domingo/lunes después de Shabat):
   *  descuento automático en el precio de los servicios reservados esos
   *  días. El peluquero la prende/apaga y ajusta desde Campañas. */
  weekdayDiscount?: {
    enabled: boolean;
    weekdays: number[]; // 0=domingo..6=sábado
    percent: number; // 1-100
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

/** Variante dentro de un servicio (ej. el servicio "Corte" puede tener las
 *  variantes "Adulto"/"Niño"/"Con barba", cada una con su propio precio) —
 *  para no tener que crear un servicio suelto por cada combinación. La
 *  duración sigue siendo la del servicio (`Service.durationMinutes`),
 *  compartida por todas sus variantes. */
export interface ServiceVariant {
  id: string;
  name: string;
  price: number;
}

export interface Service {
  id: string;
  branchId: string;
  name: string; // nombre de la categoría si tiene variantes (ej. "Corte"), o el nombre completo si no
  durationMinutes: number;
  price: number; // precio "plano" — solo se usa si el servicio NO tiene variantes
  requiresDeposit: boolean;
  depositAmount: number;
  /** Si tiene 1 o más variantes, el cliente elige una (con su propio
   *  precio) en vez de reservar el servicio directamente con `price`. Sin
   *  variantes (undefined o []), funciona exactamente como antes. */
  variants?: ServiceVariant[];
}

export interface Client {
  id: string;
  phone: string; // E.164, clave de búsqueda principal
  name: string;
  branchId: string;
  birthday?: string; // 'MM-DD'
  notes?: string; // observaciones del peluquero sobre el cliente (editable en el panel)
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
  /** Variante elegida dentro del servicio, si tenía (ej. "Adulto"). Se
   *  guarda también el nombre (`variantName`) para mostrarlo en Agenda/
   *  historial sin tener que ir a buscar el servicio, por si la variante
   *  se borra o se renombra después. */
  variantId?: string | null;
  variantName?: string | null;
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
  /** Precio final cobrado (ya con el descuento de días flojos aplicado si
   *  correspondía) — guardado al reservar, no se recalcula después aunque
   *  cambie el precio del servicio o el descuento. Citas de antes de este
   *  campo no lo tienen; hay que usar el precio del servicio como
   *  respaldo (ver `priceOf()` en cada pantalla que muestra ingresos). */
  price?: number;
  discountPercent?: number | null;
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
 * Registro de auditoría: quién hizo una acción sensible desde el panel y
 * cuándo (altas/bajas/cambios de estado de citas, cancelar la
 * suscripción) — de solo lectura desde el cliente, solo lo escribe el
 * backend (ver `functions/src/audit.ts`).
 */
export interface AuditLogEntry {
  id: string;
  branchId: string;
  uid: string;
  email: string;
  action:
    | 'appointment_created'
    | 'appointment_cancelled'
    | 'appointment_marked_no_show'
    | 'appointment_marked_completed'
    | 'appointment_confirmed'
    | 'subscription_cancelled';
  details?: Record<string, unknown>;
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
