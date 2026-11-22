// Entrada para subir un zip por el panel de Cloudflare (modo "_worker.js").
// Reutiliza la misma API de functions/api/[[path]].js.
import { onRequest } from './functions/api/[[path]].js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const path = url.pathname.slice(5).split('/').filter(Boolean);
      return onRequest({ request, env, params: { path } });
    }
    return env.ASSETS.fetch(request);
  },
};
