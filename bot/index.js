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
// pensamiento. Pero esto NO debe aplicarse a los números de menú (1, 2,
// 3...): esos son respuestas cerradas a una pregunta que el bot ya hizo, no
// hace falta "esperar a ver si sigue escribiendo", y hacerlo esperar los
// hacía sentir lentos en cada paso de una reserva.
const MESSAGE_DEBOUNCE_MS = 4000;

/** phone -> { parts: string[], pushName?: string, timer } */
const pendingByJid = new Map();

/** phone -> promesa del último mensaje en proceso para ese cliente. Todo
 * mensaje de un mismo cliente (rápido o por debounce) se encadena acá, para
 * que nunca se procesen dos mensajes suyos al mismo tiempo: si eso pasara,
 * los dos leerían el mismo estado de conversación desde Firestore, y el que
 * termina de escribir último pisaría el avance del otro — el cliente vería
 * que el bot "se pierde" y siempre vuelve al menú principal. */
const inFlightByJid = new Map();

function runSerialized(jid, task) {
  const previous = inFlightByJid.get(jid) || Promise.resolve();
  const current = previous.then(task, task);
  inFlightByJid.set(jid, current);
  current.finally(() => {
    if (inFlightByJid.get(jid) === current) inFlightByJid.delete(jid);
  });
  return current;
}

/** Un solo dígito (0-9): respuesta directa a un menú numerado, no hace
 * falta agruparla con nada más. */
function isQuickMenuReply(text) {
  return /^[0-9]$/.test(text.trim());
}

function enqueueMessage(sock, jid, text, pushName) {
  const entry = pendingByJid.get(jid);
  // Si no hay nada ya esperando a juntarse y el mensaje es un dígito suelto,
  // se procesa al instante en vez de esperar los 4 segundos del debounce.
  if ((!entry || entry.parts.length === 0) && isQuickMenuReply(text)) {
    pendingByJid.delete(jid);
    runSerialized(jid, () => processMessage(sock, jid, text, pushName));
    return;
  }

  let queued = entry;
  if (!queued) {
    queued = { parts: [], pushName, timer: null };
    pendingByJid.set(jid, queued);
  }
  queued.parts.push(text);
  if (pushName) queued.pushName = pushName;
  if (queued.timer) clearTimeout(queued.timer);
  queued.timer = setTimeout(() => flushPending(sock, jid), MESSAGE_DEBOUNCE_MS);
}

async function flushPending(sock, jid) {
  const entry = pendingByJid.get(jid);
  if (!entry) return;
  pendingByJid.delete(jid);
  const text = entry.parts.join(' ').trim();
  if (!text) return;
  await runSerialized(jid, () => processMessage(sock, jid, text, entry.pushName));
}

async function processMessage(sock, jid, text, pushName) {
  try {
    const replies = await handleIncomingMessage(jid, text, BRANCH_ID, pushName);
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
