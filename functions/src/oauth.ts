import { onRequest } from 'firebase-functions/v2/https';
import { getGoogleAuthUrl, handleGoogleOAuthCallback } from './googleCalendar';

/** GET /googleCalendarConnect?staffId=... — redirige al peluquero a Google para autorizar. */
export const googleCalendarConnect = onRequest(async (req, res) => {
  const staffId = String(req.query.staffId ?? '');
  if (!staffId) {
    res.status(400).send('Falta staffId');
    return;
  }
  const url = getGoogleAuthUrl(staffId);
  if (!url) {
    res.status(500).send('Google Calendar no está configurado (faltan credenciales OAuth).');
    return;
  }
  res.redirect(url);
});

/** Callback de Google OAuth: guarda el token del peluquero. */
export const googleCalendarCallback = onRequest(async (req, res) => {
  const code = String(req.query.code ?? '');
  const staffId = String(req.query.state ?? '');
  if (!code || !staffId) {
    res.status(400).send('Falta code o state');
    return;
  }
  try {
    await handleGoogleOAuthCallback(staffId, code);
    res.send('Google Calendar conectado correctamente. Ya puedes cerrar esta ventana.');
  } catch (err) {
    console.error('[oauth] error', err);
    res.status(500).send('Error conectando Google Calendar.');
  }
});
