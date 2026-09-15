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
import { startNotificationsWatcher } from './notificationsWatcher.js';

const BRANCH_ID = process.env.BRANCH_ID;

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
      const jid = msg.key.remoteJid ?? '';
      if (!jid.endsWith('@s.whatsapp.net')) continue; // ignorar grupos y broadcasts
      if (msg.key.fromMe) continue;

      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.buttonsResponseMessage?.selectedDisplayText || '';
      if (!text) continue;

      try {
        const replies = await handleIncomingMessage(jid, text, BRANCH_ID, msg.pushName);
        for (const reply of replies) {
          await sock.sendMessage(jid, { text: reply });
        }
      } catch (err) {
        console.error('[bot] error procesando mensaje', err);
        await sock.sendMessage(jid, { text: 'Ocurrió un error. Intenta de nuevo escribiendo "menu".' }).catch(() => {});
      }
    }
  });
}

connectToWhatsApp();
