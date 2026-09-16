/**
 * Bot de WhatsApp (Baileys) para reservar citas de la peluquería.
 *
 * Primera ejecución: escanea el QR con el número de WhatsApp de la sucursal.
 * La sesión se guarda en ./auth_info_baileys/ para las siguientes ejecuciones.
 *
 * Cada instancia del bot atiende UNA sucursal (ver BRANCH_ID en .env). Para
 * varias sucursales, corre una instancia por cada número de WhatsApp.
 */
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import 'dotenv/config';
import { handleIncomingMessage } from './conversation.js';
import { transcribeVoiceMessage } from './transcribe.js';
import { startNotificationsWatcher } from './notificationsWatcher.js';

const BRANCH_ID = process.env.BRANCH_ID;

// Si un cliente escribe su mensaje en varias burbujas seguidas (ej. "Hola" /
// "quiero reservar" / "un corte para mañana"), esperamos este tiempo desde
// el último mensaje antes de procesar, y las juntamos en una sola consulta
// — así no le mandamos 3 respuestas separadas por algo que era un solo
// pensamiento.
const MESSAGE_DEBOUNCE_MS = 4000;

/** phone -> { parts: string[], pushName?: string, timer } */
const pendingByJid = new Map();

function enqueueMessage(sock, jid, text, pushName) {
  let entry = pendingByJid.get(jid);
  if (!entry) {
    entry = { parts: [], pushName, timer: null };
    pendingByJid.set(jid, entry);
  }
  entry.parts.push(text);
  if (pushName) entry.pushName = pushName;
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => flushPending(sock, jid), MESSAGE_DEBOUNCE_MS);
}

async function flushPending(sock, jid) {
  const entry = pendingByJid.get(jid);
  if (!entry) return;
  pendingByJid.delete(jid);
  const text = entry.parts.join(' ').trim();
  if (!text) return;

  try {
    const replies = await handleIncomingMessage(jid, text, BRANCH_ID, entry.pushName);
    for (const reply of replies) {
      await sock.sendMessage(jid, { text: reply });
    }
  } catch (err) {
    console.error('[bot] error procesando mensaje', err);
    await sock.sendMessage(jid, { text: 'אירעה שגיאה. נסו שוב בכתיבת "menu".' }).catch(() => {});
  }
}

if (!BRANCH_ID) {
  console.error('[bot] Falta BRANCH_ID en bot/.env — crea la sucursal en Firestore y copia su id.');
  process.exit(1);
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n[bot] Escanea este código QR con WhatsApp:');
      qrcodeTerminal.generate(qr, { small: true });
      // También lo guardamos como imagen: útil en servidores sin pantalla,
      // donde no se puede leer el QR de la terminal.
      QRCode.toFile('./whatsapp-qr.png', qr, { width: 400 }).catch((err) =>
        console.error('[bot] no se pudo guardar whatsapp-qr.png', err)
      );
      // Dato crudo del QR también en el log: permite reconstruir la imagen
      // desde afuera (ej. leyendo los logs del hosting) sin necesitar
      // acceso a archivos del servidor.
      console.log(`[bot] QR_DATA:${qr}`);
    }

    if (connection === 'close') {
      const shouldReconnect = new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('[bot] Conexión cerrada. Reconectando:', shouldReconnect);
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log(`[bot] Conectado a WhatsApp para la sucursal ${BRANCH_ID}`);
      startNotificationsWatcher(sock, BRANCH_ID);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      const rawJid = msg.key.remoteJid ?? '';
      if (rawJid.endsWith('@g.us') || rawJid.endsWith('@broadcast')) continue; // ignorar grupos y difusión
      if (msg.key.fromMe) continue;

      // WhatsApp puede direccionar chats personales por "LID" (identificador
      // de privacidad, termina en @lid) en vez del número de teléfono
      // (@s.whatsapp.net). Como identificamos clientes por su número real
      // en toda la app, resolvemos siempre la variante con el teléfono real
      // usando remoteJidAlt cuando el chat llega direccionado por LID.
      const jid = rawJid.endsWith('@s.whatsapp.net')
        ? rawJid
        : msg.key.remoteJidAlt?.endsWith('@s.whatsapp.net')
          ? msg.key.remoteJidAlt
          : null;
      if (!jid) {
        console.warn('[bot] no se pudo resolver el número de teléfono real del mensaje', rawJid);
        continue;
      }

      let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.buttonsResponseMessage?.selectedDisplayText || '';

      if (!text && msg.message?.audioMessage) {
        // Nota de voz: la transcribimos a texto y seguimos el mismo camino
        // que un mensaje escrito. Si no se pudo transcribir (sin API key
        // configurada, o error puntual), dejamos que caiga en el flujo de
        // "no entendí" ya existente, que ofrece hablar con el peluquero.
        text = (await transcribeVoiceMessage(msg)) || '[nota de voz — no se pudo transcribir]';
      }

      if (!text) continue;
      enqueueMessage(sock, jid, text, msg.pushName);
    }
  });
}

connectToWhatsApp();
