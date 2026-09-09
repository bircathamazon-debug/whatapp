import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

export const app = getApps().length ? getApps()[0] : initializeApp();
export const db = getFirestore(app);
export { FieldValue, Timestamp };
