/**
 * Paso final de /nuevo-cliente: le asigna a la barbería su número de la API
 * oficial de WhatsApp (phone_number_id de Meta). El bot oficial
 * (bot-oficial-prueba en Railway) lo toma en vivo, sin redesplegar.
 *
 *   cd bot && railway run --service bot-peluqueria node ../.claude/skills/nuevo-cliente/conectar-whatsapp.mjs <branchId> <phoneNumberId>
 */
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../bot/package.json', import.meta.url));
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const [branchId, phoneNumberId] = process.argv.slice(2);
if (!branchId || !/^\d{10,20}$/.test(phoneNumberId ?? '')) {
  console.error('Uso: node conectar-whatsapp.mjs <branchId> <phoneNumberId (solo dígitos)>');
  process.exit(1);
}
const db = getFirestore(
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  })
);
const ref = db.collection('branches').doc(branchId);
const snap = await ref.get();
if (!snap.exists) {
  console.error(`No existe la barbería ${branchId}.`);
  process.exit(1);
}
const taken = await db.collection('branches').where('whatsappPhoneNumberId', '==', phoneNumberId).get();
const other = taken.docs.find((d) => d.id !== branchId);
if (other) {
  console.error(`Ese número ya lo tiene la barbería ${other.id} (${other.get('name')}). No se cambió nada.`);
  process.exit(1);
}
await ref.update({ whatsappPhoneNumberId: phoneNumberId });
console.log(`LISTO: ${snap.get('name')} (${branchId}) atiende WhatsApp con el número ${phoneNumberId}.`);
process.exit(0);
