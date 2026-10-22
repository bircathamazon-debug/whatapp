// Textos hablados por el IVR de Telnyx (TeXML <Say>), por idioma (branch.language).

export interface IvrStrings {
  sayLang: string; // atributo <Say language="..."> (TeXML lo ignora salvo con voice="alice"; se deja por si cambia)
  sayVoice: string; // voz neuronal (más natural que la robótica por defecto) para <Say voice="...">: Azure para hebreo (Telnyx no tiene voces de Google), Polly para inglés/español
  greeting: string;
  noChoice: string;
  systemError: string;
  invalidChoice: string;
  noAppointmentFound: string;
  appointmentCancelled: string;
  noSlotsAvailable: string;
  appointmentBooked: (dateStr: string, timeStr: string) => string;
  reminderError: string;
  reminderConfirmed: string;
  reminderCancelled: string;
  defaultPhoneClientName: string;
  maintenanceMessage: string;
  /** Domingo primero (índice 0), igual que Date.getDay(). */
  weekdays: string[];
  askDayIntro: string;
  askDayIntroSchedule: string;
  dayOption: (n: number, label: string) => string;
  askTimeTypedIntro: (dayLabel: string) => string;
  invalidTimeEntry: string;
  outsideWorkingHours: (hoursLabel: string) => string;
  confirmBooking: (dayLabel: string, timeStr: string) => string;
  noSlotsThatDay: (dayLabel: string) => string;
  closedThatDay: (dayLabel: string, reason?: string) => string;
  scheduleResult: (dayLabel: string, times: string[]) => string;
  slotTakenPhone: string;
  askVariantIntro: (serviceName: string) => string;
  variantOption: (n: number, name: string, price: number) => string;
}

const he: IvrStrings = {
  sayLang: 'he-IL',
  sayVoice: 'Azure.he-IL-AvriNeural',
  greeting:
    'שלום, הגעתם למספרה. לקביעת תור הקישו 1. לביטול התור הקרוב שלכם הקישו 2. לשמיעת השעות הפנויות הקישו 3. לשיחה עם המספרה הקישו 0.',
  noChoice: 'לא התקבלה בחירה. להתראות.',
  systemError: 'שגיאה בהגדרת המערכת. אנא נסו שוב מאוחר יותר.',
  invalidChoice: 'בחירה לא תקינה. להתראות.',
  noAppointmentFound: 'לא נמצא תור קרוב על שם המספר הזה.',
  appointmentCancelled: 'התור בוטל בהצלחה. תודה.',
  noSlotsAvailable: 'מצטערים, אין תורים פנויים בקרוב. נציג יחזור אליכם.',
  appointmentBooked: (dateStr, timeStr) => `נקבע לכם תור בתאריך ${dateStr} בשעה ${timeStr}. תקבלו אישור בהודעה.`,
  reminderError: 'שגיאה.',
  reminderConfirmed: 'התור אושר. תודה.',
  reminderCancelled: 'התור בוטל. תודה.',
  defaultPhoneClientName: 'לקוח טלפוני',
  maintenanceMessage: 'המערכת האוטומטית מושבתת זמנית לתחזוקה. מעבירים אתכם ישירות למספרה.',
  weekdays: ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'],
  askDayIntro: 'באיזה יום תרצו לקבוע תור?',
  askDayIntroSchedule: 'לאיזה יום תרצו לשמוע את השעות הפנויות?',
  dayOption: (n, label) => `ל${label}, הקישו ${n}.`,
  askTimeTypedIntro: (dayLabel) =>
    `באיזו שעה תרצו תור ב${dayLabel}? הקישו את השעה ולאחריה סולמית. לדוגמה, לשעה תשע ושלושים הקישו 9, 3, 0, וסולמית.`,
  invalidTimeEntry: 'לא הצלחנו להבין את השעה שהוקשה.',
  outsideWorkingHours: (hoursLabel) => `אין קבלה בשעה הזו — שעות הפעילות הן ${hoursLabel}. נסו שעה אחרת.`,
  confirmBooking: (dayLabel, timeStr) => `${dayLabel} בשעה ${timeStr}. לאישור הקישו 1. לניסיון שעה אחרת הקישו 2.`,
  noSlotsThatDay: (dayLabel) => `אין תורים פנויים ב${dayLabel}. נסו יום אחר.`,
  closedThatDay: (dayLabel, reason) => `המספרה סגורה ב${dayLabel}${reason ? ` (${reason})` : ''}.`,
  scheduleResult: (dayLabel, times) =>
    `השעות הפנויות ב${dayLabel} הן: ${times.join(', ')}. כדי לקבוע תור, התקשרו שוב ובחרו באפשרות הראשונה בתפריט.`,
  slotTakenPhone: 'מצטערים, השעה הזו נתפסה הרגע. נסו שוב מאוחר יותר.',
  askVariantIntro: (serviceName) => `איזה סוג ${serviceName} תרצו?`,
  variantOption: (n, name, price) => `ל${name}, ${price} שקלים, הקישו ${n}.`,
};

const en: IvrStrings = {
  sayLang: 'en-US',
  sayVoice: 'Polly.Joanna-Neural',
  greeting:
    'Hello, you have reached the salon. To book an appointment, press 1. To cancel your upcoming appointment, press 2. To hear the available times, press 3. To speak with the salon, press 0.',
  noChoice: 'No option was selected. Goodbye.',
  systemError: 'There was a system configuration error. Please try again later.',
  invalidChoice: 'Invalid choice. Goodbye.',
  noAppointmentFound: 'No upcoming appointment was found for this number.',
  appointmentCancelled: 'Your appointment was successfully cancelled. Thank you.',
  noSlotsAvailable: "Sorry, there are no available appointments coming up. We'll call you back.",
  appointmentBooked: (dateStr, timeStr) => `Your appointment is booked for ${dateStr} at ${timeStr}. You'll receive a confirmation message.`,
  reminderError: 'Error.',
  reminderConfirmed: 'Your appointment is confirmed. Thank you.',
  reminderCancelled: 'Your appointment was cancelled. Thank you.',
  defaultPhoneClientName: 'Phone client',
  maintenanceMessage: 'The automated system is temporarily paused for maintenance. Transferring you directly to the salon.',
  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  askDayIntro: 'Which day would you like to book?',
  askDayIntroSchedule: 'Which day would you like to hear the available times for?',
  dayOption: (n, label) => `For ${label}, press ${n}.`,
  askTimeTypedIntro: (dayLabel) =>
    `What time would you like on ${dayLabel}? Enter the time followed by the pound key. For example, for 9:30, press 9, 3, 0, then pound.`,
  invalidTimeEntry: "We couldn't understand that time.",
  outsideWorkingHours: (hoursLabel) => `We're closed at that time — working hours are ${hoursLabel}. Please try another time.`,
  confirmBooking: (dayLabel, timeStr) => `${dayLabel} at ${timeStr}. Press 1 to confirm. Press 2 to try a different time.`,
  noSlotsThatDay: (dayLabel) => `There are no available appointments on ${dayLabel}. Please try another day.`,
  closedThatDay: (dayLabel, reason) => `The salon is closed on ${dayLabel}${reason ? ` (${reason})` : ''}.`,
  scheduleResult: (dayLabel, times) =>
    `The available times on ${dayLabel} are: ${times.join(', ')}. To book, call again and choose the first option in the menu.`,
  slotTakenPhone: 'Sorry, that time slot was just taken. Please try again later.',
  askVariantIntro: (serviceName) => `What type of ${serviceName} would you like?`,
  variantOption: (n, name, price) => `For ${name}, ${price} shekels, press ${n}.`,
};

const es: IvrStrings = {
  sayLang: 'es-ES',
  sayVoice: 'Polly.Lucia-Neural',
  greeting:
    'Hola, se comunicó con la peluquería. Para reservar un turno, marque 1. Para cancelar su próximo turno, marque 2. Para escuchar los horarios disponibles, marque 3. Para hablar con la peluquería, marque 0.',
  noChoice: 'No se recibió ninguna opción. Hasta luego.',
  systemError: 'Hubo un error de configuración del sistema. Por favor, intente de nuevo más tarde.',
  invalidChoice: 'Opción inválida. Hasta luego.',
  noAppointmentFound: 'No se encontró ningún turno próximo con este número.',
  appointmentCancelled: 'Su turno fue cancelado con éxito. Gracias.',
  noSlotsAvailable: 'Lo sentimos, no hay turnos disponibles próximamente. Lo vamos a contactar.',
  appointmentBooked: (dateStr, timeStr) => `Se reservó su turno para el ${dateStr} a las ${timeStr}. Va a recibir una confirmación por mensaje.`,
  reminderError: 'Error.',
  reminderConfirmed: 'El turno fue confirmado. Gracias.',
  reminderCancelled: 'El turno fue cancelado. Gracias.',
  defaultPhoneClientName: 'Cliente telefónico',
  maintenanceMessage: 'El sistema automático está pausado temporalmente por mantenimiento. Lo transferimos directo a la peluquería.',
  weekdays: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  askDayIntro: '¿Para qué día querés el turno?',
  askDayIntroSchedule: '¿Para qué día querés escuchar los horarios disponibles?',
  dayOption: (n, label) => `Para el ${label}, marque ${n}.`,
  askTimeTypedIntro: (dayLabel) =>
    `¿A qué hora querés el turno el ${dayLabel}? Marcá la hora seguida de la tecla numeral. Por ejemplo, para las 9:30, marque 9, 3, 0, y numeral.`,
  invalidTimeEntry: 'No pudimos entender esa hora.',
  outsideWorkingHours: (hoursLabel) => `Está cerrado a esa hora — el horario de atención es de ${hoursLabel}. Probá con otra hora.`,
  confirmBooking: (dayLabel, timeStr) => `${dayLabel} a las ${timeStr}. Marque 1 para confirmar. Marque 2 para probar otra hora.`,
  noSlotsThatDay: (dayLabel) => `No hay turnos disponibles el ${dayLabel}. Intente otro día.`,
  closedThatDay: (dayLabel, reason) => `La peluquería está cerrada el ${dayLabel}${reason ? ` (${reason})` : ''}.`,
  scheduleResult: (dayLabel, times) =>
    `Los horarios disponibles el ${dayLabel} son: ${times.join(', ')}. Para reservar, llame de nuevo y elija la primera opción del menú.`,
  slotTakenPhone: 'Lo sentimos, ese horario se acaba de ocupar. Intente de nuevo más tarde.',
  askVariantIntro: (serviceName) => `¿Qué tipo de ${serviceName} querés?`,
  variantOption: (n, name, price) => `Para ${name}, ${price} shékels, marque ${n}.`,
};

const IVR_SETS: Record<string, IvrStrings> = { he, en, es };

export function getIvrStrings(language?: string): IvrStrings {
  return IVR_SETS[language ?? ''] ?? he;
}
