/**
 * Transporte por la API oficial de WhatsApp (WhatsApp Cloud API de Meta), en
 * lugar de Baileys. No usa un celular vinculado: Meta recibe los mensajes y
 * nos los avisa por un webhook (un POST a este servidor), y nosotros
 * respondemos llamando a la Graph API. Así no hay sesión que se pueda
 * "desvincular" ni código/QR que renovar.
 *
 * Un solo servidor puede atender VARIOS números (una barbería por número):
 * cada aviso de Meta trae el phone_number_id al que escribió el cliente, y
 * `servesNumber(id)` decide si es nuestro. Se responde desde ese mismo número
 * con `sockFor(id)`.
 *
 * Variables de entorno:
 *   WA_PHONE_NUMBER_ID  número de la sucursal original (no es secreto)
 *   WA_ACCESS_TOKEN     token de acceso de la app (SECRETO)
 *   WA_APP_SECRET       "clave secreta de la app" de Meta, para verificar que
 *                       cada aviso del webhook viene de verdad de Meta (SECRETO)
 *   WA_VERIFY_TOKEN     palabra que se escribe al configurar el webhook en Meta
 *   PORT                puerto HTTP (Railway lo pone solo)
 */
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const GRAPH = 'https://graph.facebook.com/v21.0';

export function createCloudTransport({ accessToken, appSecret, verifyToken, servesNumber }) {
  for (const [name, value] of Object.entries({ WA_ACCESS_TOKEN: accessToken, WA_APP_SECRET: appSecret, WA_VERIFY_TOKEN: verifyToken })) {
    if (!value) throw new Error(`[cloud] Falta ${name}`);
  }
  const auth = { Authorization: `Bearer ${accessToken}` };

  async function sendText(phoneNumberId, phoneDigits, text) {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phoneDigits, type: 'text', text: { body: text, preview_url: true } }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Graph API ${res.status}: ${body.slice(0, 500)}`);
    }
  }

  /** Descarga un archivo (ej. nota de voz) que el cliente mandó. */
  async function downloadMedia(mediaId) {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: auth });
    if (!meta.ok) throw new Error(`media ${mediaId}: ${meta.status}`);
    const { url, mime_type } = await meta.json();
    const file = await fetch(url, { headers: auth });
    if (!file.ok) throw new Error(`descarga media ${mediaId}: ${file.status}`);
    return { buffer: Buffer.from(await file.arrayBuffer()), mimeType: mime_type };
  }

  /** Igual que sock.sendMessage de Baileys (para reusar el resto del bot),
   * mandando desde el número `phoneNumberId`. */
  const socks = new Map();
  function sockFor(phoneNumberId) {
    if (!socks.has(phoneNumberId)) {
      socks.set(phoneNumberId, {
        sendMessage: (jid, { text }) => sendText(phoneNumberId, jid.split('@')[0].replace(/\D/g, ''), text),
      });
    }
    return socks.get(phoneNumberId);
  }

  function validSignature(raw, header) {
    if (!header?.startsWith('sha256=')) return false;
    const expected = Buffer.from('sha256=' + createHmac('sha256', appSecret).update(raw).digest('hex'));
    const got = Buffer.from(header);
    return got.length === expected.length && timingSafeEqual(got, expected);
  }

  /**
   * Arranca el servidor. onMessage({ phoneNumberId, id, from, name, type, text, mediaId })
   * se llama por cada mensaje entrante de un cliente.
   */
  function start(onMessage, port = Number(process.env.PORT) || 8080) {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');

      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200).end('ok');
        return;
      }

      // Meta confirma el webhook con un GET al configurarlo.
      if (req.method === 'GET' && url.pathname === '/webhook') {
        const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === verifyToken;
        console.log('[cloud] verificación del webhook:', ok ? 'aceptada' : 'rechazada');
        if (ok) res.writeHead(200, { 'Content-Type': 'text/plain' }).end(url.searchParams.get('hub.challenge') ?? '');
        else res.writeHead(403).end();
        return;
      }

      if (req.method === 'POST' && url.pathname === '/webhook') {
        const chunks = [];
        let size = 0;
        req.on('data', (c) => {
          size += c.length;
          if (size > 1_000_000) req.destroy();
          else chunks.push(c);
        });
        req.on('end', () => {
          const raw = Buffer.concat(chunks);
          if (!validSignature(raw, req.headers['x-hub-signature-256'])) {
            console.warn('[cloud] aviso con firma inválida, descartado');
            res.writeHead(401).end();
            return;
          }
          // Se responde enseguida: si Meta no recibe 200 rápido, reintenta.
          res.writeHead(200).end();
          let body;
          try {
            body = JSON.parse(raw.toString('utf8'));
          } catch {
            return;
          }
          for (const entry of body.entry ?? []) {
            for (const change of entry.changes ?? []) {
              const value = change.value ?? {};
              console.log('[cloud] aviso de Meta:', JSON.stringify({
                campo: change.field,
                numero: value.metadata?.phone_number_id,
                mensajes: (value.messages ?? []).map((m) => ({ de: m.from, tipo: m.type })),
                estados: (value.statuses ?? []).map((st) => st.status),
              }));
              const phoneNumberId = value.metadata?.phone_number_id;
              if (!servesNumber(phoneNumberId)) {
                console.warn(`[cloud] aviso para un número que ninguna barbería tiene asignado (${phoneNumberId}), se ignora`);
                continue;
              }
              for (const st of value.statuses ?? []) {
                if (st.status === 'failed') console.error('[cloud] Meta no pudo entregar un mensaje a', st.recipient_id, JSON.stringify(st.errors ?? null));
              }
              const names = Object.fromEntries((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
              for (const m of value.messages ?? []) {
                const text =
                  m.text?.body ??
                  m.button?.text ??
                  m.interactive?.button_reply?.title ??
                  m.interactive?.list_reply?.title ??
                  '';
                Promise.resolve(
                  onMessage({ phoneNumberId, id: m.id, from: m.from, name: names[m.from], type: m.type, text, mediaId: m.audio?.id })
                ).catch((err) => console.error('[cloud] error manejando mensaje', err));
              }
            }
          }
        });
        return;
      }

      res.writeHead(404).end();
    });
    server.listen(port, () => console.log(`[cloud] Webhook de WhatsApp escuchando en el puerto ${port}`));
    return server;
  }

  return { sockFor, start, downloadMedia };
}
