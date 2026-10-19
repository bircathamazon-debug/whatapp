/**
 * Cliente mínimo (sin SDK) de la API REST de Telnyx para llamadas de voz,
 * en reemplazo de Twilio (functions/src/twilio.ts, eliminado) desde que
 * Telnyx emitió el número real del IVR. Telnyx no tiene un SDK oficial de
 * Node tan simple como el de Twilio, pero su API es REST+JSON normal, así
 * que alcanza con `fetch` (igual que ya hace tranzila.ts).
 */

export interface TelnyxConfig {
  apiKey: string;
  connectionId: string;
  phoneNumber: string;
}

/** Lee la config de Telnyx; devuelve null si falta alguna variable (se omite el envío real, como antes con Twilio). */
export function getTelnyxConfig(): TelnyxConfig | null {
  const apiKey = process.env.TELNYX_API_KEY;
  const connectionId = process.env.TELNYX_CONNECTION_ID;
  const phoneNumber = process.env.TELNYX_PHONE_NUMBER;
  if (!apiKey || !connectionId || !phoneNumber) return null;
  return { apiKey, connectionId, phoneNumber };
}

/**
 * Inicia una llamada saliente con instrucciones TeXML en línea (reemplaza a
 * `client.calls.create({ to, from, twiml })` de Twilio).
 * Doc: https://developers.telnyx.com/api-reference/texml-rest-commands/create-a-connection-scoped-texml-call
 */
export async function createTelnyxCall(config: TelnyxConfig, to: string, texml: string): Promise<void> {
  const res = await fetch(`https://api.telnyx.com/v2/texml/calls/${config.connectionId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ To: to, From: config.phoneNumber, Texml: texml }),
  });
  if (!res.ok) {
    throw new Error(`Telnyx call error ${res.status}: ${await res.text()}`);
  }
}

/** Manda un SMS por Telnyx (requiere tener un "Messaging Profile" asignado al número en el portal). */
export async function sendTelnyxSms(config: TelnyxConfig, to: string, text: string): Promise<void> {
  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.phoneNumber, to, text }),
  });
  if (!res.ok) {
    throw new Error(`Telnyx SMS error ${res.status}: ${await res.text()}`);
  }
}
