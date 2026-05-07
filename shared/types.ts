export interface Contact {
  id: string;
  name: string;
  phone: string;
  category: string;
  zone: string;
  review: string;
  recommendedBy: string;
  createdAt: Date;
  updatedAt: Date;
  approved: boolean;
}

export interface Category {
  id: string;
  labelHe: string;
  icon: string;
}

export interface Zone {
  id: string;
  labelHe: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'electrician', labelHe: 'חשמלאים', icon: '⚡' },
  { id: 'plumber', labelHe: 'אינסטלטורים', icon: '🔧' },
  { id: 'doctor', labelHe: 'רופאים', icon: '🏥' },
  { id: 'renovation', labelHe: 'שיפוצניקים', icon: '🏗️' },
  { id: 'transport', labelHe: 'תחבורה', icon: '🚗' },
  { id: 'lawyer', labelHe: 'עורכי דין', icon: '⚖️' },
  { id: 'accountant', labelHe: 'רואי חשבון', icon: '📊' },
  { id: 'restaurant', labelHe: 'מסעדות', icon: '🍽️' },
  { id: 'other', labelHe: 'אחר', icon: '📋' },
];

export const DEFAULT_ZONES: Zone[] = [
  { id: 'beit-shemesh', labelHe: 'בית שמש' },
  { id: 'jerusalem', labelHe: 'ירושלים' },
  { id: 'modiin-illit', labelHe: 'מודיעין עילית' },
  { id: 'beitar-illit', labelHe: 'ביתר עילית' },
  { id: 'ashdod', labelHe: 'אשדוד' },
  { id: 'bnei-brak', labelHe: 'בני ברק' },
  { id: 'nationwide', labelHe: 'ארצי' },
];
