/**
 * Parses WhatsApp group messages to extract contact recommendations.
 *
 * Expected Hebrew patterns:
 *   "ממליץ על דוד כהן, חשמלאי, בית שמש, 050-1234567 - מקצוען אמיתי"
 *   "יש לי אינסטלטור טוב: יוסי לוי 052-9876543 ירושלים"
 *   Free-form messages containing a phone number and known category keyword
 */

const PHONE_RE = /(?:\+972|0)([5][0-9][-\s]?\d{3}[-\s]?\d{4})/;

const CATEGORY_KEYWORDS = {
  חשמלאי: 'electrician',
  חשמלאים: 'electrician',
  אינסטלטור: 'plumber',
  אינסטלטורים: 'plumber',
  שרברב: 'plumber',
  רופא: 'doctor',
  רופאים: 'doctor',
  שיפוצניק: 'renovation',
  שיפוצים: 'renovation',
  קבלן: 'renovation',
  מונית: 'transport',
  נהג: 'transport',
  תחבורה: 'transport',
  עורך דין: 'lawyer',
  עורכי דין: 'lawyer',
  'רואה חשבון': 'accountant',
  'רואי חשבון': 'accountant',
  מסעדה: 'restaurant',
  מסעדות: 'restaurant',
};

const ZONE_KEYWORDS = {
  'בית שמש': 'beit-shemesh',
  ירושלים: 'jerusalem',
  'מודיעין עילית': 'modiin-illit',
  'ביתר עילית': 'beitar-illit',
  אשדוד: 'ashdod',
  'בני ברק': 'bnei-brak',
  ארצי: 'nationwide',
  'כל הארץ': 'nationwide',
};

/**
 * @param {string} text - Raw message text
 * @param {string} senderName - Display name of the WA sender
 * @returns {{ name:string, phone:string, category:string, zone:string, review:string, recommendedBy:string }|null}
 */
export function parseMessage(text, senderName) {
  if (!text || text.length < 10) return null;

  const phoneMatch = text.match(PHONE_RE);
  if (!phoneMatch) return null;

  const rawPhone = phoneMatch[0].replace(/\D/g, '');
  const phone = rawPhone.startsWith('972') ? `0${rawPhone.slice(3)}` : rawPhone;

  let category = 'other';
  for (const [keyword, catId] of Object.entries(CATEGORY_KEYWORDS)) {
    if (text.includes(keyword)) {
      category = catId;
      break;
    }
  }

  let zone = 'nationwide';
  for (const [keyword, zoneId] of Object.entries(ZONE_KEYWORDS)) {
    if (text.includes(keyword)) {
      zone = zoneId;
      break;
    }
  }

  // Extract name: the longest Hebrew word sequence before the phone number
  const beforePhone = text.slice(0, text.indexOf(phoneMatch[0])).trim();
  const nameMatch = beforePhone.match(/[א-ת\s'"-]{2,30}$/);
  const name = nameMatch ? nameMatch[0].trim() : 'לא ידוע';

  const review = text.replace(PHONE_RE, '').trim().slice(0, 300);

  return { name, phone, category, zone, review, recommendedBy: senderName };
}
