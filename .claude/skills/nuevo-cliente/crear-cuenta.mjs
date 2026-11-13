/**
 * Paso 1 de /nuevo-cliente: crea la barbería en Firestore (con su mes gratis),
 * su cuenta de acceso al panel (mail + contraseña provisoria que tiene que
 * cambiar al entrar), su peluquero principal y sus servicios.
 *
 * Mismo resultado que el botón "Crear barbería" de Más → Mis clientes
 * (ownerCreateBarbershop en functions/src/billing.ts), más el peluquero y los
 * servicios, para que el bot pueda dar citas desde el primer minuto.
 *
 * Se corre con las credenciales de Firebase del bot (no hay que copiarlas):
 *   cd bot && railway run --service bot-peluqueria node ../.claude/skills/nuevo-cliente/crear-cuenta.mjs datos.json
 * datos.json: { name, email, ownerName, ownerPhone, language?, hours?, services: [{name, minutes, price}] }
 * Con --dry-run solo muestra lo que haría.
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../bot/package.json', import.meta.url));
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const TRIAL_DAYS = 30; // igual que functions/src/plans.ts
const DAY_MS = 24 * 3600000;
const DEFAULT_HOURS = { 0: { start: '09:00', end: '19:00' }, 1: { start: '09:00', end: '19:00' }, 2: { start: '09:00', end: '19:00' }, 3: { start: '09:00', end: '19:00' }, 4: { start: '09:00', end: '19:00' }, 5: { start: '09:00', end: '14:00' }, 6: null };

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Uso: node crear-cuenta.mjs datos.json [--dry-run]');
  process.exit(1);
}
const d = JSON.parse(readFileSync(file, 'utf8'));
const e164 = (p) => '+' + String(p ?? '').replace(/\D/g, '');
const problems = [];
if (!d.name?.trim()) problems.push('falta name (nombre de la barbería)');
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email ?? '')) problems.push('email inválido');
if (!d.ownerName?.trim()) problems.push('falta ownerName (nombre del peluquero)');
if (e164(d.ownerPhone).length < 11) problems.push('ownerPhone inválido (con código de país, ej. 972501234567)');
if (!Array.isArray(d.services) || d.services.length === 0) problems.push('falta al menos un servicio');
for (const s of d.services ?? []) if (!s.name || !(s.minutes > 0) || !(s.price >= 0)) problems.push(`servicio incompleto: ${JSON.stringify(s)}`);
if (problems.length) {
  console.error('Datos con problemas:\n- ' + problems.join('\n- '));
  process.exit(1);
}

// Contraseña provisoria legible (sin 0/O/1/l para dictarla sin errores).
const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const password = [...randomBytes(10)].map((b) => alphabet[b % alphabet.length]).join('');
const now = Date.now();
const language = d.language ?? 'he';

const branch = {
  name: d.name.trim(),
  address: d.address ?? '',
  geonameId: d.geonameId ?? '281184', // Jerusalén (horarios de Shabat)
  timezone: d.timezone ?? 'Asia/Jerusalem',
  shabbatMode: 'silent',
  phone: e164(d.ownerPhone),
  language,
  billing: { plan: 'basic', trialEndsAt: now + TRIAL_DAYS * DAY_MS, blocked: false, blockedReason: null, pastDueSince: null },
  subscription: { provider: 'tranzila', status: 'none' },
  createdAt: now,
};
console.log('Barbería:', JSON.stringify({ ...branch, billing: { ...branch.billing, trialEndsAt: new Date(branch.billing.trialEndsAt).toISOString() } }, null, 2));
console.log('Peluquero:', d.ownerName, e164(d.ownerPhone));
console.log('Servicios:', d.services.map((s) => `${s.name} (${s.minutes} min, ${s.price})`).join(' · '));
if (dryRun) {
  console.log('\n--dry-run: no se creó nada.');
  process.exit(0);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});
const db = getFirestore(app);
const auth = getAuth(app);

if (await auth.getUserByEmail(d.email.trim()).catch(() => null)) {
  console.error(`Ya existe una cuenta con ${d.email}. No se creó nada.`);
  process.exit(1);
}
const branchRef = await db.collection('branches').add(branch);
const user = await auth.createUser({ email: d.email.trim(), password, displayName: branch.name });
await db.collection('users').doc(user.uid).set({ branchIds: [branchRef.id], isSuperAdmin: false, readOnly: false, mustChangePassword: true });
await db.collection('staff').add({ branchId: branchRef.id, name: d.ownerName.trim(), phone: e164(d.ownerPhone), hours: d.hours ?? DEFAULT_HOURS, blockedDates: [], active: true });
for (const s of d.services) {
  await db.collection('services').add({ branchId: branchRef.id, name: s.name, durationMinutes: s.minutes, price: s.price, requiresDeposit: false, depositAmount: 0 });
}
const audit = db.collection('auditLog').doc();
await audit.set({ id: audit.id, branchId: branchRef.id, uid: 'skill:nuevo-cliente', email: 'skill:nuevo-cliente', action: 'owner_create_branch', details: {}, createdAt: Date.now() });

console.log(`\nLISTO branchId=${branchRef.id}`);
console.log(`Mail: ${d.email.trim()}`);
console.log(`Contraseña provisoria: ${password}  (la cambia al entrar por primera vez)`);
process.exit(0);
