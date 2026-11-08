/**
 * Transcripción de notas de voz de WhatsApp a texto, usando la API de
 * Whisper de OpenAI (pago por uso, aprox. $0.006 por minuto de audio —
 * costo despreciable para el volumen de una peluquería). Requiere
 * OPENAI_API_KEY en bot/.env; si no está configurada, se devuelve null y
 * quien llama decide cómo avisarle al cliente.
 */
import { downloadMediaMessage } from '@whiskeysockets/baileys';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/** Nota de voz que llega por Baileys. @param {import('@whiskeysockets/baileys').WAMessage} msg */
export async function transcribeVoiceMessage(msg) {
  if (!OPENAI_API_KEY) {
    console.warn('[transcribe] falta OPENAI_API_KEY, no se puede transcribir la nota de voz');
    return null;
  }
  try {
    return await transcribeAudioBuffer(await downloadMediaMessage(msg, 'buffer', {}));
  } catch (err) {
    console.error('[transcribe] error descargando nota de voz', err);
    return null;
  }
}

/** Transcribe un audio ya descargado (lo usan Baileys y la API oficial). */
export async function transcribeAudioBuffer(buffer) {
  if (!OPENAI_API_KEY) {
    console.warn('[transcribe] falta OPENAI_API_KEY, no se puede transcribir la nota de voz');
    return null;
  }
  try {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'audio/ogg' }), 'voice.ogg');
    form.append('model', 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });

    if (!res.ok) {
      console.error('[transcribe] la API de transcripción respondió con error', res.status, await res.text().catch(() => ''));
      return null;
    }

    const data = await res.json();
    const text = (data.text || '').trim();
    return text || null;
  } catch (err) {
    console.error('[transcribe] error transcribiendo nota de voz', err);
    return null;
  }
}
