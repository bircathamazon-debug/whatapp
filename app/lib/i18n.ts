/**
 * Diccionario de idiomas de la app del panel. branch.language decide cuál
 * se usa (hebreo por defecto). Agregar un idioma nuevo = agregar una
 * entrada acá; las pantallas no cambian.
 *
 * OJO: cambiar de un idioma RTL (hebreo) a uno LTR (inglés) no da vuelta el
 * layout al instante — React Native exige reiniciar la app para eso
 * (limitación de I18nManager). El texto sí cambia enseguida.
 */
import { useBranch } from './branchContext';

export type Lang = 'he' | 'en' | 'es';

export const RTL_LANGS: Lang[] = ['he'];

interface Dict {
  tabs: { agenda: string; waitlist: string; waitlistShort: string; clients: string; campaigns: string; questions: string; home: string; more: string };
  home: {
    greeting: string;
    todayApptsLabel: (n: number) => string;
    questionsAlert: (n: number) => string;
    viewQuestions: string;
    nextApptTitle: string;
    nextApptNone: string;
    quickActionsTitle: string;
    upcomingTitle: string;
    upcomingEmpty: string;
  };
  agenda: {
    statusConfirmed: string;
    statusPending: string;
    statusCancelled: string;
    statusCompleted: string;
    statusNoShow: string;
    needBranch: string;
    goToAdmin: string;
    cancelTitle: string;
    cancelMessage: (name: string) => string;
    back: string;
    cancelAppt: string;
    blockedForStaff: (name: string) => string;
    blockedForAll: string;
    today: string;
    noAppointments: string;
    depositReceived: string;
    cancel: string;
  };
  clients: {
    searchPlaceholder: string;
    empty: string;
    requiresDeposit: string;
    haircuts: (count: number, mod: number, threshold: number) => string;
    noShows: (count: number) => string;
  };
  waitlist: {
    statusWaiting: string;
    statusOffered: string;
    empty: string;
    wants: (phone: string, date: string) => string;
  };
  campaigns: {
    title: string;
    subtitle: string;
    send: string;
    sentTo: (count: number, message: string) => string;
    error: string;
    errorGeneric: string;
  };
  questions: {
    empty: string;
    from: (phone: string) => string;
    stepLabel: (step: string) => string;
    resolve: string;
    resolved: string;
    delete: string;
    deleteTitle: string;
    deleteConfirm: string;
    cancel: string;
  };
  adminMenu: {
    title: string;
    branches: string;
    staff: string;
    services: string;
    schedule: string;
    settings: string;
    finance: string;
    logout: string;
    logoutTitle: string;
    logoutConfirm: string;
    cancel: string;
  };
  login: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
    error: string;
    errorMessage: string;
  };
  branches: {
    name: string;
    address: string;
    phone: string;
    geonameId: string;
    namePlaceholder: string;
    addressPlaceholder: string;
    add: string;
    existing: string;
    shabbatModeLine: (mode: string) => string;
    deleteTitle: string;
    deleteConfirm: (name: string) => string;
    cancel: string;
    delete: string;
    shabbatOff: string;
    shabbatSilent: string;
    shabbatClosed: string;
  };
  services: {
    needBranch: string;
    name: string;
    namePlaceholder: string;
    duration: string;
    price: string;
    requiresDeposit: string;
    depositAmount: string;
    add: string;
    meta: (duration: number, price: number, deposit?: number) => string;
    deleteTitle: string;
    deleteConfirm: (name: string) => string;
    cancel: string;
    delete: string;
  };
  staff: {
    needBranch: string;
    name: string;
    namePlaceholder: string;
    phone: string;
    add: string;
    deleteTitle: string;
    deleteConfirm: (name: string) => string;
    cancel: string;
    delete: string;
    durationsBtn: string;
    durationsTitle: string;
    durationsHint: string;
    durationDefaultPlaceholder: (minutes: number) => string;
    save: string;
  };
  schedule: {
    needBranch: string;
    needStaff: string;
    weekdays: string[];
    weeklyHours: string;
    blockedDays: string;
    until: string;
    addBtn: string;
    save: string;
    saving: string;
    invalidFormatTitle: string;
    invalidFormatMessage: string;
    savedTitle: string;
    savedMessage: string;
  };
  settings: {
    title: string;
    needBranch: string;
    maintenanceTitle: string;
    maintenanceHint: string;
    maintenanceActiveHint: string;
    languageTitle: string;
    languageHint: string;
    displayMode: string;
    light: string;
    dark: string;
    blockHoursTitle: string;
    blockHoursHint: string;
    allStaff: string;
    dateLabel: string;
    blockAllDay: string;
    fullDay: string;
    to: string;
    reasonPlaceholder: string;
    addBlock: string;
    deleteBlockTitle: string;
    deleteBlockConfirm: string;
    cancel: string;
    delete: string;
    invalidDateTitle: string;
    invalidDateMessage: string;
    invalidTimeTitle: string;
    invalidTimeMessage: string;
    shabbatMode: (branchName: string) => string;
    shabbatOffLabel: string;
    shabbatOffHint: string;
    shabbatSilentLabel: string;
    shabbatSilentHint: string;
    shabbatClosedLabel: string;
    shabbatClosedHint: string;
    googleCalendar: string;
    googleCalendarHint: string;
    connectCalendar: (staffName: string) => string;
    missingConfigTitle: string;
    missingConfigMessage: string;
    restartTitle: string;
    restartMessage: string;
    systemRules: string;
    loyaltyRule: (threshold: number) => string;
    depositRule: (threshold: number) => string;
    reminderRule: (windows: string) => string;
    hoursShort: (n: number) => string;
    minutesShort: (n: number) => string;
    andSeparator: string;
  };
  finance: {
    title: string;
    needBranch: string;
    todayRevenueTitle: string;
    monthRevenueTitle: string;
    cutsCount: (n: number) => string;
    expensesTitle: string;
    expensesHint: string;
    addExpense: string;
    category: string;
    categoryRent: string;
    categoryUtilities: string;
    categoryStaff: string;
    categorySupplies: string;
    categoryOther: string;
    descriptionPlaceholder: string;
    amountPlaceholder: string;
    dateLabel: string;
    monthExpensesTitle: string;
    netTitle: string;
    deleteTitle: string;
    deleteConfirm: string;
    cancel: string;
    delete: string;
    subscriptionTitle: string;
    subscriptionNone: string;
    subscriptionActive: (date: string) => string;
    subscriptionPastDue: string;
    subscriptionCanceled: string;
    subscribeBtn: string;
    manageBtn: string;
    subscriptionError: string;
    subscriptionErrorMessage: string;
    subscriptionNotConfigured: string;
    cancelSubscriptionBtn: string;
    cancelSubscriptionTitle: string;
    cancelSubscriptionConfirm: string;
    cancelSubscriptionConfirmBtn: string;
  };
}

const he: Dict = {
  tabs: { agenda: 'יומן', waitlist: 'רשימת המתנה', waitlistShort: 'המתנה', clients: 'לקוחות', campaigns: 'קמפיינים', questions: 'שאלות', home: 'בית', more: 'עוד' },
  home: {
    greeting: 'שלום',
    todayApptsLabel: (n) => `${n} תורים היום`,
    questionsAlert: (n) => `יש ${n} שאלות שממתינות למענה`,
    viewQuestions: 'לצפייה',
    nextApptTitle: 'התור הבא',
    nextApptNone: 'אין תורים נוספים היום',
    quickActionsTitle: 'קיצורי דרך',
    upcomingTitle: 'התורים הקרובים',
    upcomingEmpty: 'אין תורים נוספים היום.',
  },
  agenda: {
    statusConfirmed: 'מאושר',
    statusPending: 'ממתין למקדמה',
    statusCancelled: 'בוטל',
    statusCompleted: 'הושלם',
    statusNoShow: 'לא הגיע',
    needBranch: 'קודם צריך ליצור סניף בפאנל הניהול.',
    goToAdmin: 'לפאנל הניהול',
    cancelTitle: 'ביטול תור',
    cancelMessage: (name) => `לבטל את התור של ${name}?`,
    back: 'חזרה',
    cancelAppt: 'ביטול התור',
    blockedForStaff: (name) => `חסום ל${name}`,
    blockedForAll: 'חסום לכל הצוות',
    today: 'היום',
    noAppointments: 'אין תורים ביום הזה.',
    depositReceived: '✓ קדמה התקבלה',
    cancel: '✕ ביטול',
  },
  clients: {
    searchPlaceholder: 'חיפוש לפי שם או טלפון',
    empty: 'אין עדיין לקוחות.',
    requiresDeposit: 'דורש מקדמה',
    haircuts: (count, mod, threshold) => `✂️ ${count} תספורות (${mod}/${threshold} לפרס הבא)`,
    noShows: (count) => `⚠️ ${count} אי-הגעות`,
  },
  waitlist: {
    statusWaiting: 'ממתין',
    statusOffered: 'הוצע תור',
    empty: 'אין אף אחד ברשימת ההמתנה. כשלקוח לא מוצא תור פנוי בוואטסאפ, הוא יופיע כאן ויקבל הודעה אוטומטית אם יתפנה תור.',
    wants: (phone, date) => `${phone} · רוצה ל-${date}`,
  },
  campaigns: {
    title: 'שעות פנויות היום',
    subtitle: 'מחפש את התור הפנוי הקרוב ביותר היום ושולח הודעת וואטסאפ ל-50 הלקוחות האחרונים של הסניף: "התפנה היום תור בשעה 16:30".',
    send: 'שליחת קמפיין עכשיו',
    sentTo: (count, message) => `נשלח ל-${count} לקוחות: "${message}"`,
    error: 'שגיאה',
    errorGeneric: 'לא ניתן היה לשלוח את הקמפיין.',
  },
  questions: {
    empty: 'אין שאלות שהבוט לא ידע לענות עליהן. מעולה!',
    from: (phone) => `מאת ${phone}`,
    stepLabel: (step) => `בשלב: ${step}`,
    resolve: '✓ סימון כטופל',
    resolved: 'טופל',
    delete: '🗑️',
    deleteTitle: 'מחיקת שאלה',
    deleteConfirm: 'למחוק את השאלה הזו?',
    cancel: 'ביטול',
  },
  adminMenu: {
    title: 'הפאנל שלי',
    branches: 'סניפים',
    staff: 'ספרים',
    services: 'שירותים',
    schedule: 'שעות עבודה וימים חסומים',
    settings: 'הגדרות (מקדמות, שבת, Google Calendar)',
    finance: 'כספים',
    logout: 'יציאה מהחשבון',
    logoutTitle: 'יציאה מהחשבון',
    logoutConfirm: 'לצאת מהחשבון?',
    cancel: 'ביטול',
  },
  login: {
    title: 'כניסת צוות',
    subtitle: 'מערכת התורים של המספרה',
    email: 'אימייל',
    password: 'סיסמה',
    submit: 'כניסה',
    submitting: 'מתחבר...',
    error: 'שגיאה',
    errorMessage: 'אימייל או סיסמה שגויים',
  },
  branches: {
    name: 'שם',
    address: 'כתובת',
    phone: 'טלפון (למענה הקולי / להעברת שיחה)',
    geonameId: 'מזהה Geoname (Hebcal, לשעות שבת)',
    namePlaceholder: 'מספרה מרכזית',
    addressPlaceholder: 'רחוב, עיר',
    add: 'הוספת סניף',
    existing: 'סניפים קיימים',
    shabbatModeLine: (mode) => `מצב שבת: ${mode}`,
    deleteTitle: 'מחיקת סניף',
    deleteConfirm: (name) => `למחוק את "${name}"?`,
    cancel: 'ביטול',
    delete: 'מחיקה',
    shabbatOff: 'כבוי',
    shabbatSilent: 'שקט',
    shabbatClosed: 'סגור',
  },
  services: {
    needBranch: 'יש ליצור סניף קודם.',
    name: 'שם השירות',
    namePlaceholder: 'תספורת',
    duration: "משך (דקות)",
    price: 'מחיר (₪)',
    requiresDeposit: 'דורש מקדמה להזמנה',
    depositAmount: 'סכום המקדמה (₪)',
    add: 'הוספת שירות',
    meta: (duration, price, deposit) => `${duration} דק' · ₪${price}${deposit ? ` · מקדמה ₪${deposit}` : ''}`,
    deleteTitle: 'מחיקת שירות',
    deleteConfirm: (name) => `למחוק את "${name}"?`,
    cancel: 'ביטול',
    delete: 'מחיקה',
  },
  staff: {
    needBranch: 'יש ליצור סניף קודם.',
    name: 'שם',
    namePlaceholder: 'דוד',
    phone: 'טלפון (יקבל הודעות על תורים חדשים)',
    add: 'הוספת ספר',
    deleteTitle: 'מחיקת ספר',
    deleteConfirm: (name) => `למחוק את ${name}?`,
    cancel: 'ביטול',
    delete: 'מחיקה',
    durationsBtn: '⏱️ זמן לפי שירות',
    durationsTitle: 'זמן תספורת לכל שירות',
    durationsHint: 'אם משאירים ריק, ייעשה שימוש בזמן ברירת המחדל של השירות.',
    durationDefaultPlaceholder: (minutes) => `ברירת מחדל: ${minutes} דק׳`,
    save: 'שמירה',
  },
  schedule: {
    needBranch: 'יש ליצור סניף קודם.',
    needStaff: 'יש להוסיף ספר קודם.',
    weekdays: ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'],
    weeklyHours: 'שעות עבודה שבועיות',
    blockedDays: 'ימים חסומים (חופשות, חגים)',
    until: 'עד',
    addBtn: 'הוספה',
    save: 'שמירת שעות עבודה',
    saving: 'שומר...',
    invalidFormatTitle: 'פורמט לא תקין',
    invalidFormatMessage: 'יש להזין בפורמט YYYY-MM-DD, למשל 2026-04-23',
    savedTitle: 'נשמר',
    savedMessage: 'שעות העבודה עודכנו.',
  },
  settings: {
    title: 'הגדרות',
    needBranch: 'יש לבחור סניף קודם.',
    maintenanceTitle: '🚨 מצב תחזוקה (השבתת המערכת האוטומטית)',
    maintenanceHint: 'להפעיל רק אם יש תקלה טכנית. הבוט בוואטסאפ והמענה הטלפוני יופסקו זמנית, והלקוחות יופנו ישירות לספר, עד שהמתג הזה יכובה.',
    maintenanceActiveHint: '🔴 פעיל כרגע: הבוט בוואטסאפ והמענה הטלפוני מושבתים, לקוחות מופנים ישירות לספר. לכבות ברגע שהתקלה נפתרה.',
    languageTitle: 'שפת המערכת',
    languageHint: 'קובעת את השפה של הבוט בוואטסאפ, השיחות הקוליות וגם את הפאנל הזה.',
    displayMode: 'מצב תצוגה',
    light: '☀️ בהיר',
    dark: '🌙 כהה',
    blockHoursTitle: 'חסימת שעות עבודה',
    blockHoursHint: 'לחגים, תורים אישיים או חופשות — השעות החסומות לא יוצעו ללקוחות בוואטסאפ או בטלפון.',
    allStaff: 'כל הצוות',
    dateLabel: 'תאריך (YYYY-MM-DD)',
    blockAllDay: 'לחסום את היום כולו',
    fullDay: 'יום שלם',
    to: 'עד',
    reasonPlaceholder: 'סיבה (לא חובה) — למשל חופשה',
    addBlock: '➕ הוספת חסימה',
    deleteBlockTitle: 'מחיקת חסימה',
    deleteBlockConfirm: 'למחוק את החסימה הזו?',
    cancel: 'ביטול',
    delete: 'מחיקה',
    invalidDateTitle: 'תאריך לא תקין',
    invalidDateMessage: 'יש להזין תאריך בפורמט YYYY-MM-DD, למשל 2026-09-20.',
    invalidTimeTitle: 'שעה לא תקינה',
    invalidTimeMessage: 'יש להזין שעה בפורמט HH:mm, למשל 13:00.',
    shabbatMode: (branchName) => `מצב שבת — ${branchName}`,
    shabbatOffLabel: 'כבוי',
    shabbatOffHint: 'אפשר להזמין תור ומודיעים לספר בכל שעה.',
    shabbatSilentLabel: 'שקט (מומלץ)',
    shabbatSilentHint: 'אפשר להזמין תור בשבת, אבל ההודעה לספר מתעכבת עד מוצאי שבת.',
    shabbatClosedLabel: 'סגור',
    shabbatClosedHint: 'לא מתקבלות הזמנות חדשות בשבת.',
    googleCalendar: 'Google Calendar (אופציונלי)',
    googleCalendarHint: 'כל ספר יכול לחבר את יומן הגוגל האישי שלו — התורים שלו יתווספו אליו אוטומטית.',
    connectCalendar: (staffName) => `חיבור היומן של ${staffName}`,
    missingConfigTitle: 'חסרה הגדרה',
    missingConfigMessage: 'יש להגדיר EXPO_PUBLIC_FUNCTIONS_BASE_URL בקובץ app/.env כדי לחבר את Google Calendar.',
    restartTitle: 'צריך לפתוח מחדש את האפליקציה',
    restartMessage: 'השפה שינתה כיוון כתיבה — כדי שהמסך יתהפך נכון, סגרו ופתחו את האפליקציה מחדש.',
    systemRules: 'חוקי המערכת',
    loyaltyRule: (threshold) => `🎁 מועדון לקוחות: הנחה כל ${threshold} תספורות שהושלמו.`,
    depositRule: (threshold) => `⚠️ מקדמה חובה אחרי ${threshold} אי-הגעות.`,
    reminderRule: (windows) => `⏰ תזכורות אוטומטיות: ${windows} לפני התור.`,
    hoursShort: (n) => `${n} שעות`,
    minutesShort: (n) => `${n} דק'`,
    andSeparator: ' ו-',
  },
  finance: {
    title: 'כספים',
    needBranch: 'יש לבחור סניף קודם.',
    todayRevenueTitle: 'הכנסות היום',
    monthRevenueTitle: 'הכנסות החודש',
    cutsCount: (n) => `${n} תספורות`,
    expensesTitle: 'הוצאות',
    expensesHint: 'שכר דירה, מים וחשמל, עובדים, ציוד וכו׳.',
    addExpense: 'הוספת הוצאה',
    category: 'קטגוריה',
    categoryRent: 'שכר דירה',
    categoryUtilities: 'מים וחשמל',
    categoryStaff: 'עובדים',
    categorySupplies: 'ציוד/מלאי',
    categoryOther: 'אחר',
    descriptionPlaceholder: 'תיאור (אופציונלי)',
    amountPlaceholder: 'סכום',
    dateLabel: 'תאריך',
    monthExpensesTitle: 'הוצאות החודש',
    netTitle: 'רווח נקי החודש (הכנסות פחות הוצאות)',
    deleteTitle: 'מחיקת הוצאה',
    deleteConfirm: 'למחוק את ההוצאה הזו?',
    cancel: 'ביטול',
    delete: 'מחיקה',
    subscriptionTitle: 'מנוי המערכת',
    subscriptionNone: 'עדיין אין מנוי פעיל.',
    subscriptionActive: (date) => `✅ מנוי פעיל · החיוב הבא: ${date}`,
    subscriptionPastDue: '⚠️ החיוב האחרון נכשל. יש לעדכן את אמצעי התשלום.',
    subscriptionCanceled: 'המנוי בוטל.',
    subscribeBtn: 'הרשמה למנוי',
    manageBtn: 'ניהול המנוי',
    subscriptionError: 'שגיאה',
    subscriptionErrorMessage: 'לא ניתן היה לפתוח את עמוד התשלום. נסו שוב מאוחר יותר.',
    subscriptionNotConfigured: 'תשלומים עדיין לא הוגדרו במערכת.',
    cancelSubscriptionBtn: 'ביטול המנוי',
    cancelSubscriptionTitle: 'ביטול המנוי',
    cancelSubscriptionConfirm: 'לבטל את המנוי? החיוב החודשי הבא לא יתבצע.',
    cancelSubscriptionConfirmBtn: 'ביטול המנוי',
  },
};

const en: Dict = {
  tabs: { agenda: 'Agenda', waitlist: 'Waitlist', waitlistShort: 'Waitlist', clients: 'Clients', campaigns: 'Campaigns', questions: 'Questions', home: 'Home', more: 'More' },
  home: {
    greeting: 'Hello',
    todayApptsLabel: (n) => `${n} appointments today`,
    questionsAlert: (n) => `${n} questions waiting for an answer`,
    viewQuestions: 'View',
    nextApptTitle: 'Next appointment',
    nextApptNone: 'No more appointments today',
    quickActionsTitle: 'Quick actions',
    upcomingTitle: 'Upcoming today',
    upcomingEmpty: 'No more appointments today.',
  },
  agenda: {
    statusConfirmed: 'Confirmed',
    statusPending: 'Awaiting deposit',
    statusCancelled: 'Cancelled',
    statusCompleted: 'Completed',
    statusNoShow: 'No-show',
    needBranch: 'First create a branch in the admin panel.',
    goToAdmin: 'Go to admin panel',
    cancelTitle: 'Cancel appointment',
    cancelMessage: (name) => `Cancel ${name}'s appointment?`,
    back: 'Back',
    cancelAppt: 'Cancel appointment',
    blockedForStaff: (name) => `Blocked for ${name}`,
    blockedForAll: 'Blocked for the whole team',
    today: 'Today',
    noAppointments: 'No appointments this day.',
    depositReceived: '✓ Deposit received',
    cancel: '✕ Cancel',
  },
  clients: {
    searchPlaceholder: 'Search by name or phone',
    empty: 'No clients yet.',
    requiresDeposit: 'Requires deposit',
    haircuts: (count, mod, threshold) => `✂️ ${count} haircuts (${mod}/${threshold} to next reward)`,
    noShows: (count) => `⚠️ ${count} no-shows`,
  },
  waitlist: {
    statusWaiting: 'Waiting',
    statusOffered: 'Offer sent',
    empty: "No one is on the waitlist. When a client can't find a free slot on WhatsApp, they'll show up here and get notified automatically if one opens up.",
    wants: (phone, date) => `${phone} · wants ${date}`,
  },
  campaigns: {
    title: "Today's open slots",
    subtitle: 'Finds the next free slot today and sends a WhatsApp message to the branch\'s last 50 clients: "A slot opened up today at 4:30pm".',
    send: 'Send campaign now',
    sentTo: (count, message) => `Sent to ${count} clients: "${message}"`,
    error: 'Error',
    errorGeneric: 'Could not send the campaign.',
  },
  questions: {
    empty: "No unanswered questions right now. Great!",
    from: (phone) => `From ${phone}`,
    stepLabel: (step) => `At step: ${step}`,
    resolve: '✓ Mark as handled',
    resolved: 'Handled',
    delete: '🗑️',
    deleteTitle: 'Delete question',
    deleteConfirm: 'Delete this question?',
    cancel: 'Cancel',
  },
  adminMenu: {
    title: 'My panel',
    branches: 'Branches',
    staff: 'Stylists',
    services: 'Services',
    schedule: 'Hours & blocked days',
    settings: 'Settings (deposits, Shabbat, Google Calendar)',
    finance: 'Finances',
    logout: 'Log out',
    logoutTitle: 'Log out',
    logoutConfirm: 'Log out of your account?',
    cancel: 'Cancel',
  },
  login: {
    title: 'Staff login',
    subtitle: "The salon's appointment system",
    email: 'Email',
    password: 'Password',
    submit: 'Log in',
    submitting: 'Logging in...',
    error: 'Error',
    errorMessage: 'Incorrect email or password',
  },
  branches: {
    name: 'Name',
    address: 'Address',
    phone: 'Phone (for the IVR / call transfer)',
    geonameId: 'Geoname ID (Hebcal, for Shabbat times)',
    namePlaceholder: 'Main Salon',
    addressPlaceholder: 'Street, city',
    add: 'Add branch',
    existing: 'Existing branches',
    shabbatModeLine: (mode) => `Shabbat mode: ${mode}`,
    deleteTitle: 'Delete branch',
    deleteConfirm: (name) => `Delete "${name}"?`,
    cancel: 'Cancel',
    delete: 'Delete',
    shabbatOff: 'Off',
    shabbatSilent: 'Silent',
    shabbatClosed: 'Closed',
  },
  services: {
    needBranch: 'First create a branch.',
    name: 'Service name',
    namePlaceholder: 'Haircut',
    duration: 'Duration (minutes)',
    price: 'Price (₪)',
    requiresDeposit: 'Requires a deposit to book',
    depositAmount: 'Deposit amount (₪)',
    add: 'Add service',
    meta: (duration, price, deposit) => `${duration} min · ₪${price}${deposit ? ` · deposit ₪${deposit}` : ''}`,
    deleteTitle: 'Delete service',
    deleteConfirm: (name) => `Delete "${name}"?`,
    cancel: 'Cancel',
    delete: 'Delete',
  },
  staff: {
    needBranch: 'First create a branch.',
    name: 'Name',
    namePlaceholder: 'David',
    phone: 'Phone (will receive new-booking alerts)',
    add: 'Add stylist',
    deleteTitle: 'Delete stylist',
    deleteConfirm: (name) => `Delete ${name}?`,
    cancel: 'Cancel',
    delete: 'Delete',
    durationsBtn: '⏱️ Time per service',
    durationsTitle: 'Haircut time per service',
    durationsHint: "Leave blank to use the service's default duration.",
    durationDefaultPlaceholder: (minutes) => `Default: ${minutes} min`,
    save: 'Save',
  },
  schedule: {
    needBranch: 'First create a branch.',
    needStaff: 'First add a stylist.',
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    weeklyHours: 'Weekly hours',
    blockedDays: 'Blocked days (holidays, time off)',
    until: 'to',
    addBtn: 'Add',
    save: 'Save hours',
    saving: 'Saving...',
    invalidFormatTitle: 'Invalid format',
    invalidFormatMessage: 'Use YYYY-MM-DD, e.g. 2026-04-23',
    savedTitle: 'Saved',
    savedMessage: 'Hours updated.',
  },
  settings: {
    title: 'Settings',
    needBranch: 'First select a branch.',
    maintenanceTitle: '🚨 Maintenance mode (pause the automated system)',
    maintenanceHint: 'Turn this on only if there is a technical problem. The WhatsApp bot and phone system will be paused, and clients will be sent straight to the stylist, until you turn this off again.',
    maintenanceActiveHint: '🔴 Currently on: the WhatsApp bot and phone system are paused, clients are routed directly to the stylist. Turn off as soon as the problem is fixed.',
    languageTitle: 'System language',
    languageHint: 'Sets the language of the WhatsApp bot, phone calls, and this panel.',
    displayMode: 'Display mode',
    light: '☀️ Light',
    dark: '🌙 Dark',
    blockHoursTitle: 'Block work hours',
    blockHoursHint: "For holidays, personal appointments or time off — blocked hours won't be offered to clients on WhatsApp or by phone.",
    allStaff: 'Whole team',
    dateLabel: 'Date (YYYY-MM-DD)',
    blockAllDay: 'Block the whole day',
    fullDay: 'Whole day',
    to: 'to',
    reasonPlaceholder: 'Reason (optional) — e.g. time off',
    addBlock: '➕ Add block',
    deleteBlockTitle: 'Delete block',
    deleteBlockConfirm: 'Delete this block?',
    cancel: 'Cancel',
    delete: 'Delete',
    invalidDateTitle: 'Invalid date',
    invalidDateMessage: 'Enter a date as YYYY-MM-DD, e.g. 2026-09-20.',
    invalidTimeTitle: 'Invalid time',
    invalidTimeMessage: 'Enter a time as HH:mm, e.g. 13:00.',
    shabbatMode: (branchName) => `Shabbat mode — ${branchName}`,
    shabbatOffLabel: 'Off',
    shabbatOffHint: 'Bookings are accepted and the stylist is notified at any time.',
    shabbatSilentLabel: 'Silent (recommended)',
    shabbatSilentHint: "Bookings are accepted during Shabbat, but the stylist's notification is delayed until after Shabbat ends.",
    shabbatClosedLabel: 'Closed',
    shabbatClosedHint: 'No new bookings are accepted during Shabbat.',
    googleCalendar: 'Google Calendar (optional)',
    googleCalendarHint: 'Each stylist can connect their own Google Calendar — their appointments will be added automatically.',
    connectCalendar: (staffName) => `Connect ${staffName}'s calendar`,
    missingConfigTitle: 'Missing configuration',
    missingConfigMessage: 'Set EXPO_PUBLIC_FUNCTIONS_BASE_URL in app/.env to enable connecting Google Calendar.',
    restartTitle: 'Please restart the app',
    restartMessage: 'The language changed text direction — close and reopen the app for the layout to flip correctly.',
    systemRules: 'System rules',
    loyaltyRule: (threshold) => `🎁 Loyalty: a discount every ${threshold} completed haircuts.`,
    depositRule: (threshold) => `⚠️ Deposit required after ${threshold} no-shows.`,
    reminderRule: (windows) => `⏰ Automatic reminders: ${windows} before the appointment.`,
    hoursShort: (n) => `${n}h`,
    minutesShort: (n) => `${n} min`,
    andSeparator: ' and ',
  },
  finance: {
    title: 'Finances',
    needBranch: 'First select a branch.',
    todayRevenueTitle: "Today's revenue",
    monthRevenueTitle: "This month's revenue",
    cutsCount: (n) => `${n} haircuts`,
    expensesTitle: 'Expenses',
    expensesHint: 'Rent, water/electricity, staff, supplies, etc.',
    addExpense: 'Add expense',
    category: 'Category',
    categoryRent: 'Rent',
    categoryUtilities: 'Water/electricity',
    categoryStaff: 'Staff',
    categorySupplies: 'Supplies',
    categoryOther: 'Other',
    descriptionPlaceholder: 'Description (optional)',
    amountPlaceholder: 'Amount',
    dateLabel: 'Date',
    monthExpensesTitle: "This month's expenses",
    netTitle: 'Net profit this month (revenue minus expenses)',
    deleteTitle: 'Delete expense',
    deleteConfirm: 'Delete this expense?',
    cancel: 'Cancel',
    delete: 'Delete',
    subscriptionTitle: 'System subscription',
    subscriptionNone: 'No active subscription yet.',
    subscriptionActive: (date) => `✅ Active · next charge: ${date}`,
    subscriptionPastDue: '⚠️ The last charge failed. Please update your payment method.',
    subscriptionCanceled: 'Subscription cancelled.',
    subscribeBtn: 'Subscribe',
    manageBtn: 'Manage subscription',
    subscriptionError: 'Error',
    subscriptionErrorMessage: 'Could not open the payment page. Please try again later.',
    subscriptionNotConfigured: 'Payments are not set up yet.',
    cancelSubscriptionBtn: 'Cancel subscription',
    cancelSubscriptionTitle: 'Cancel subscription',
    cancelSubscriptionConfirm: "Cancel the subscription? The next monthly charge won't happen.",
    cancelSubscriptionConfirmBtn: 'Cancel subscription',
  },
};

const es: Dict = {
  tabs: { agenda: 'Agenda', waitlist: 'Lista de espera', waitlistShort: 'Espera', clients: 'Clientes', campaigns: 'Campañas', questions: 'Preguntas', home: 'Inicio', more: 'Más' },
  home: {
    greeting: 'Hola',
    todayApptsLabel: (n) => `${n} citas hoy`,
    questionsAlert: (n) => `Tenés ${n} preguntas sin responder`,
    viewQuestions: 'Ver',
    nextApptTitle: 'Próxima cita',
    nextApptNone: 'No hay más citas hoy',
    quickActionsTitle: 'Accesos rápidos',
    upcomingTitle: 'Próximas citas de hoy',
    upcomingEmpty: 'No hay más citas hoy.',
  },
  agenda: {
    statusConfirmed: 'Confirmada',
    statusPending: 'Espera depósito',
    statusCancelled: 'Cancelada',
    statusCompleted: 'Completada',
    statusNoShow: 'No se presentó',
    needBranch: 'Primero creá una sucursal en el panel de administración.',
    goToAdmin: 'Ir al panel',
    cancelTitle: 'Cancelar cita',
    cancelMessage: (name) => `¿Cancelar la cita de ${name}?`,
    back: 'Volver',
    cancelAppt: 'Cancelar cita',
    blockedForStaff: (name) => `Bloqueado para ${name}`,
    blockedForAll: 'Bloqueado para todo el equipo',
    today: 'Hoy',
    noAppointments: 'No hay citas este día.',
    depositReceived: '✓ Depósito recibido',
    cancel: '✕ Cancelar',
  },
  clients: {
    searchPlaceholder: 'Buscar por nombre o teléfono',
    empty: 'Sin clientes todavía.',
    requiresDeposit: 'Requiere depósito',
    haircuts: (count, mod, threshold) => `✂️ ${count} cortes (${mod}/${threshold} para el próximo premio)`,
    noShows: (count) => `⚠️ ${count} inasistencias`,
  },
  waitlist: {
    statusWaiting: 'Esperando',
    statusOffered: 'Turno ofrecido',
    empty: 'Nadie en lista de espera. Cuando un cliente no encuentra hueco por WhatsApp, aparecerá aquí y se le avisará automáticamente si se libera un turno.',
    wants: (phone, date) => `${phone} · quiere el ${date}`,
  },
  campaigns: {
    title: 'Horas vacías de hoy',
    subtitle: 'Busca el próximo hueco libre de hoy y le avisa por WhatsApp a tus últimos 50 clientes de esta sucursal: "Hoy quedó libre un turno a las 16:30".',
    send: 'Enviar campaña ahora',
    sentTo: (count, message) => `Enviado a ${count} clientes: "${message}"`,
    error: 'Error',
    errorGeneric: 'No se pudo enviar la campaña.',
  },
  questions: {
    empty: '¡No hay preguntas sin responder por ahora!',
    from: (phone) => `De ${phone}`,
    stepLabel: (step) => `En el paso: ${step}`,
    resolve: '✓ Marcar como resuelta',
    resolved: 'Resuelta',
    delete: '🗑️',
    deleteTitle: 'Eliminar pregunta',
    deleteConfirm: '¿Eliminar esta pregunta?',
    cancel: 'Cancelar',
  },
  adminMenu: {
    title: 'Panel del peluquero',
    branches: 'Sucursales',
    staff: 'Peluqueros',
    services: 'Servicios',
    schedule: 'Horarios y días bloqueados',
    settings: 'Configuración (depósitos, Shabat, Google Calendar)',
    finance: 'Finanzas',
    logout: 'Cerrar sesión',
    logoutTitle: 'Cerrar sesión',
    logoutConfirm: '¿Seguro que querés salir?',
    cancel: 'Cancelar',
  },
  login: {
    title: 'Acceso del personal',
    subtitle: 'Sistema de citas de la peluquería',
    email: 'Email',
    password: 'Contraseña',
    submit: 'Ingresar',
    submitting: 'Ingresando...',
    error: 'Error',
    errorMessage: 'Email o contraseña incorrectos',
  },
  branches: {
    name: 'Nombre',
    address: 'Dirección',
    phone: 'Teléfono (para el IVR / transferencia)',
    geonameId: 'Geoname ID (Hebcal, para horarios de Shabat)',
    namePlaceholder: 'Peluquería Central',
    addressPlaceholder: 'Calle, ciudad',
    add: 'Agregar sucursal',
    existing: 'Sucursales existentes',
    shabbatModeLine: (mode) => `Modo Shabat: ${mode}`,
    deleteTitle: 'Eliminar sucursal',
    deleteConfirm: (name) => `¿Eliminar "${name}"?`,
    cancel: 'Cancelar',
    delete: 'Eliminar',
    shabbatOff: 'Desactivado',
    shabbatSilent: 'Silencioso',
    shabbatClosed: 'Cerrado',
  },
  services: {
    needBranch: 'Creá primero una sucursal.',
    name: 'Nombre del servicio',
    namePlaceholder: 'Corte de cabello',
    duration: 'Duración (minutos)',
    price: 'Precio (₪)',
    requiresDeposit: 'Exige depósito para reservar',
    depositAmount: 'Monto del depósito (₪)',
    add: 'Agregar servicio',
    meta: (duration, price, deposit) => `${duration} min · ₪${price}${deposit ? ` · depósito ₪${deposit}` : ''}`,
    deleteTitle: 'Eliminar servicio',
    deleteConfirm: (name) => `¿Eliminar "${name}"?`,
    cancel: 'Cancelar',
    delete: 'Eliminar',
  },
  staff: {
    needBranch: 'Creá primero una sucursal.',
    name: 'Nombre',
    namePlaceholder: 'David',
    phone: 'Teléfono (recibirá avisos de nuevas citas)',
    add: 'Agregar peluquero',
    deleteTitle: 'Eliminar peluquero',
    deleteConfirm: (name) => `¿Eliminar a ${name}?`,
    cancel: 'Cancelar',
    delete: 'Eliminar',
    durationsBtn: '⏱️ Duración por servicio',
    durationsTitle: 'Duración de corte por servicio',
    durationsHint: 'Si lo dejás vacío, se usa la duración por defecto del servicio.',
    durationDefaultPlaceholder: (minutes) => `Por defecto: ${minutes} min`,
    save: 'Guardar',
  },
  schedule: {
    needBranch: 'Creá primero una sucursal.',
    needStaff: 'Agregá primero un peluquero.',
    weekdays: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    weeklyHours: 'Horario semanal',
    blockedDays: 'Días bloqueados (vacaciones, feriados)',
    until: 'a',
    addBtn: 'Agregar',
    save: 'Guardar horario',
    saving: 'Guardando...',
    invalidFormatTitle: 'Formato inválido',
    invalidFormatMessage: 'Usá AAAA-MM-DD, ej. 2026-04-23',
    savedTitle: 'Guardado',
    savedMessage: 'Horario actualizado.',
  },
  settings: {
    title: 'Configuración',
    needBranch: 'Seleccioná una sucursal primero.',
    maintenanceTitle: '🚨 Modo mantenimiento (pausar el sistema automático)',
    maintenanceHint: 'Activalo solo si hay un problema técnico. El bot de WhatsApp y el sistema telefónico se pausan, y los clientes son derivados directo al peluquero, hasta que lo desactives.',
    maintenanceActiveHint: '🔴 Activo ahora: el bot de WhatsApp y el sistema telefónico están pausados, los clientes son derivados directo al peluquero. Desactivalo apenas se resuelva el problema.',
    languageTitle: 'Idioma del sistema',
    languageHint: 'Define el idioma del bot de WhatsApp, las llamadas telefónicas y este panel.',
    displayMode: 'Modo de visualización',
    light: '☀️ Claro',
    dark: '🌙 Oscuro',
    blockHoursTitle: 'Bloquear horarios de trabajo',
    blockHoursHint: 'Para feriados, turnos personales o vacaciones — las horas bloqueadas no se ofrecerán a los clientes por WhatsApp o teléfono.',
    allStaff: 'Todo el equipo',
    dateLabel: 'Fecha (AAAA-MM-DD)',
    blockAllDay: 'Bloquear el día completo',
    fullDay: 'Día completo',
    to: 'a',
    reasonPlaceholder: 'Motivo (opcional) — por ej. vacaciones',
    addBlock: '➕ Agregar bloqueo',
    deleteBlockTitle: 'Eliminar bloqueo',
    deleteBlockConfirm: '¿Eliminar este bloqueo?',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    invalidDateTitle: 'Fecha inválida',
    invalidDateMessage: 'Ingresá una fecha como AAAA-MM-DD, ej. 2026-09-20.',
    invalidTimeTitle: 'Hora inválida',
    invalidTimeMessage: 'Ingresá una hora como HH:mm, ej. 13:00.',
    shabbatMode: (branchName) => `Modo Shabat — ${branchName}`,
    shabbatOffLabel: 'Desactivado',
    shabbatOffHint: 'Se puede reservar y se avisa al peluquero en cualquier momento.',
    shabbatSilentLabel: 'Silencioso (recomendado)',
    shabbatSilentHint: 'Se puede reservar en Shabat, pero el aviso al peluquero se retiene hasta Motzaei Shabat.',
    shabbatClosedLabel: 'Cerrado',
    shabbatClosedHint: 'No se aceptan reservas nuevas durante Shabat.',
    googleCalendar: 'Google Calendar (opcional)',
    googleCalendarHint: 'Cada peluquero puede conectar su propio Google Calendar; sus citas se agregarán automáticamente.',
    connectCalendar: (staffName) => `Conectar calendario de ${staffName}`,
    missingConfigTitle: 'Falta configuración',
    missingConfigMessage: 'Definí EXPO_PUBLIC_FUNCTIONS_BASE_URL en app/.env para habilitar la conexión con Google Calendar.',
    restartTitle: 'Hace falta reabrir la app',
    restartMessage: 'El idioma cambió el sentido de lectura de la pantalla — cerrá y volvé a abrir la app para que se acomode bien.',
    systemRules: 'Reglas del sistema',
    loyaltyRule: (threshold) => `🎁 Fidelidad: descuento cada ${threshold} cortes completados.`,
    depositRule: (threshold) => `⚠️ Depósito obligatorio tras ${threshold} inasistencias.`,
    reminderRule: (windows) => `⏰ Recordatorios automáticos: ${windows} antes de la cita.`,
    hoursShort: (n) => `${n}h`,
    minutesShort: (n) => `${n} min`,
    andSeparator: ' y ',
  },
  finance: {
    title: 'Finanzas',
    needBranch: 'Seleccioná una sucursal primero.',
    todayRevenueTitle: 'Ingresos de hoy',
    monthRevenueTitle: 'Ingresos del mes',
    cutsCount: (n) => `${n} cortes`,
    expensesTitle: 'Gastos',
    expensesHint: 'Alquiler, agua/luz, empleados, insumos, etc.',
    addExpense: 'Agregar gasto',
    category: 'Categoría',
    categoryRent: 'Alquiler',
    categoryUtilities: 'Agua/luz',
    categoryStaff: 'Empleados',
    categorySupplies: 'Insumos',
    categoryOther: 'Otro',
    descriptionPlaceholder: 'Descripción (opcional)',
    amountPlaceholder: 'Monto',
    dateLabel: 'Fecha',
    monthExpensesTitle: 'Gastos del mes',
    netTitle: 'Ganancia neta del mes (ingresos menos gastos)',
    deleteTitle: 'Eliminar gasto',
    deleteConfirm: '¿Eliminar este gasto?',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    subscriptionTitle: 'Suscripción del sistema',
    subscriptionNone: 'Todavía no hay una suscripción activa.',
    subscriptionActive: (date) => `✅ Activa · próximo cobro: ${date}`,
    subscriptionPastDue: '⚠️ El último cobro falló. Actualizá el método de pago.',
    subscriptionCanceled: 'La suscripción fue cancelada.',
    subscribeBtn: 'Suscribirse',
    manageBtn: 'Gestionar suscripción',
    subscriptionError: 'Error',
    subscriptionErrorMessage: 'No se pudo abrir la página de pago. Probá de nuevo más tarde.',
    subscriptionNotConfigured: 'Los pagos todavía no están configurados en el sistema.',
    cancelSubscriptionBtn: 'Cancelar suscripción',
    cancelSubscriptionTitle: 'Cancelar suscripción',
    cancelSubscriptionConfirm: '¿Cancelar la suscripción? El próximo cobro mensual no se va a hacer.',
    cancelSubscriptionConfirmBtn: 'Cancelar suscripción',
  },
};

const DICTS: Record<Lang, Dict> = { he, en, es };

export function useLang(): Lang {
  const { branches, branchId } = useBranch();
  const branch = branches.find((b) => b.id === branchId);
  return DICTS[branch?.language as Lang] ? (branch!.language as Lang) : 'he';
}

export function useT(): Dict {
  return DICTS[useLang()];
}

export function isRtl(lang: Lang): boolean {
  return RTL_LANGS.includes(lang);
}

/** Nombre de cada idioma en su propio idioma — no se traduce, se usa igual en las tres columnas. */
export const LANGUAGE_NAMES: Record<Lang, string> = { he: 'עברית', en: 'English', es: 'Español' };

const DATE_LOCALES: Record<Lang, string> = { he: 'he-IL', en: 'en-GB', es: 'es-ES' };

export function useDateLocale(): string {
  return DATE_LOCALES[useLang()];
}
