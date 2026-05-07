/**
 * Yeshiva Contacts WhatsApp Bot (Baileys)
 *
 * First run: scan the QR code with the admin WhatsApp account.
 * Session is saved to ./auth_info_baileys/ for subsequent runs.
 *
 * Set WA_GROUP_ID in .env. To find it, run this bot and send any
 * message to the target group — the group JID will be logged.
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import cron from 'node-cron';
import 'dotenv/config';
import { parseMessage } from './parser.js';
import { upsertContact } from './firebaseClient.js';

const GROUP_ID = process.env.WA_GROUP_ID;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket.default({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n[bot] Scan this QR code with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        new Boom(lastDisconnect?.error)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log('[bot] Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('[bot] Connected to WhatsApp');
      if (!GROUP_ID) {
        console.log(
          '[bot] WA_GROUP_ID not set. Listening for ANY group message to discover group IDs...'
        );
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      const jid = msg.key.remoteJid ?? '';
      if (!jid.endsWith('@g.us')) continue;

      // Help user discover group JID
      if (!GROUP_ID) {
        console.log(`[bot] Group JID detected: ${jid}`);
        continue;
      }

      if (jid !== GROUP_ID) continue;
      if (msg.key.fromMe) continue;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';

      const senderName =
        msg.pushName || msg.key.participant?.split('@')[0] || 'לא ידוע';

      const contact = parseMessage(text, senderName);
      if (contact) {
        console.log(`[bot] Parsed contact from ${senderName}:`, contact);
        await upsertContact(contact).catch(console.error);
      }
    }
  });
}

connectToWhatsApp();

// Daily sync reminder log at 02:00 Israel time (UTC+3)
cron.schedule('0 23 * * *', () => {
  console.log('[cron] Daily sync check — bot is live and listening.');
});
