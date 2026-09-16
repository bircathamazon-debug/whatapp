// Textos hablados por el IVR de Twilio (<Say>), por idioma (branch.language).

export interface IvrStrings {
  twilioLang: string; // código de voz que espera Twilio <Say language="...">
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
}

const he: IvrStrings = {
  twilioLang: 'he-IL',
  greeting: 'שלום, הגעתם למספרה. לתיאום תור הקרוב ביותר הקישו 1. לביטול התור הקרוב שלכם הקישו 2. לשיחה עם המספרה הקישו 0.',
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
};

const en: IvrStrings = {
  twilioLang: 'en-US',
  greeting: 'Hello, you have reached the salon. To book the next available appointment, press 1. To cancel your upcoming appointment, press 2. To speak with the salon, press 0.',
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
};

const es: IvrStrings = {
  twilioLang: 'es-ES',
  greeting: 'Hola, se comunicó con la peluquería. Para reservar el próximo turno disponible, marque 1. Para cancelar su próximo turno, marque 2. Para hablar con la peluquería, marque 0.',
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
};

const IVR_SETS: Record<string, IvrStrings> = { he, en, es };

export function getIvrStrings(language?: string): IvrStrings {
  return IVR_SETS[language ?? ''] ?? he;
}
