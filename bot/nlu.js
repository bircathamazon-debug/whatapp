/**
 * Entiende un pedido de cita en lenguaje natural (texto libre, escrito o
 * transcripto de una nota de voz) — en vez de obligar al cliente a navegar
 * el menú numerado paso a paso. Usa un modelo de OpenAI (gpt-4o-mini, barato
 * y rápido) para sacar del texto: la intención (reservar, cancelar, hablar
 * con el peluquero, u otra cosa) y, si es una reserva, el día y la hora que
 * pidió. Si no hay OPENAI_API_KEY o la llamada falla, devuelve null — quien
 * llama cae al comportamiento de siempre (mostrar el menú).
 *
 * A propósito el modelo NO calcula una fecha concreta (le pediría saber
 * "hoy" y es una fuente más de errores) — solo devuelve el nombre del día
 * de la semana o "today"/"tomorrow", y el código de `conversation.js` lo
 * convierte a una fecha real a partir de hoy.
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `You read a short message a client sent to a hair salon's booking bot over WhatsApp (it may be in Hebrew, English, Spanish, or any other language, and may come from a transcribed voice note so it can have small transcription errors). Extract the client's intent as strict JSON, no prose, no markdown:

{
  "intent": "book" | "cancel" | "talk_to_human" | "other",
  "weekday": "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | null,
  "relativeDay": "today" | "tomorrow" | null,
  "time": "HH:MM" (24h) | null,
  "serviceHint": string | null
}

Rules:
- "book" = wants to schedule/book an appointment (even if day/time are missing).
- "cancel" = wants to cancel an existing appointment.
- "talk_to_human" = explicitly asks to speak with a person/the stylist, not the bot.
- "other" = anything else (greetings, questions, complaints, unrelated chat).
- Set "weekday" OR "relativeDay", never both — prefer relativeDay for "today"/"tomorrow".
- "time" is only a specific clock time mentioned (e.g. "3pm"/"a las 3" -> "15:00"). null if none.
- "serviceHint" is the raw word(s) for a service/treatment if mentioned, else null.
- Respond with ONLY the JSON object, nothing else.`;

export async function interpretFreeText(text) {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 150,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text.slice(0, 500) },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error('[nlu] la API respondió con error', res.status, await res.text().catch(() => ''));
      return null;
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!['book', 'cancel', 'talk_to_human', 'other'].includes(parsed.intent)) return null;
    return parsed;
  } catch (err) {
    console.error('[nlu] error interpretando texto libre', err);
    return null;
  }
}
