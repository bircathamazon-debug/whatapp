import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import 'dotenv/config';

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = getFirestore(app);

/**
 * Insert a new contact or update the review if the phone already exists.
 * New contacts are marked approved:false for admin review.
 */
export async function upsertContact(data) {
  const { phone, name, category, zone, review, recommendedBy } = data;

  const existing = await db
    .collection('contacts')
    .where('phone', '==', phone)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    await doc.ref.update({ review, updatedAt: Timestamp.now() });
    console.log(`[firebase] updated contact ${phone}`);
    return;
  }

  await db.collection('contacts').add({
    name,
    phone,
    category,
    zone,
    review,
    recommendedBy,
    approved: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  console.log(`[firebase] added new contact ${name} (${phone})`);
}
