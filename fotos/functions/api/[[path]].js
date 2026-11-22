import { extraRoutes } from '../../lib/extras.js';

// API de la galería · Cloudflare Pages Function + R2 (binding: PHOTOS)
//
// Roles:
//   admin  (אחראית)  – una sola, entra con ADMIN_PIN. Todo + crea/revoca códigos.
//   helper (עוזרת)   – código generado por la admin. Ve, sube, mueve, borra, crea categorías.
//   member (חברה)    – código generado por la admin. Ve, sube y borra SUS propias fotos.

const PENDING = { id: 'pending', name: 'ממתינות לסידור' };
const FIXED = [
  { id: 'friends', name: 'חברות' },
  { id: 'family', name: 'משפחה' },
  { id: 'shabbat', name: 'שבת וחגים' },
  { id: 'trips', name: 'טיולים' },
  { id: 'selfie', name: 'סלפי' },
  { id: 'memories', name: 'זכרונות' },
  PENDING,
];
const SUGGESTIONS = ['יום הולדת', 'סמינר', 'מחנה קיץ', 'בית ספר', 'חתונה', 'אוכל', 'חיות', 'אמנות'];
const CATS_KEY = '_meta/categories.json';
const CODES_KEY = '_meta/codes.json';
const SETTINGS_KEY = '_meta/settings.json';
const EVENTS_KEY = '_meta/events.json';
const TRIPS_KEY = '_meta/trips.json';
const MUSIC_KEY = '_meta/music.json';
const MAX_BYTES = 12 * 1024 * 1024;
const RANK = { member: 1, helper: 2, admin: 3 };

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const adminToken = (env) => sha256(env.ADMIN_PIN + '|tmunot-admin');

function getCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
const cookie = (v) => `gal=${encodeURIComponent(v)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;

async function readJson(env, key, fallback) {
  const obj = await env.PHOTOS.get(key);
  if (!obj) return fallback;
  try { return await obj.json(); } catch { return fallback; }
}
const saveJson = (env, key, data) => env.PHOTOS.put(key, JSON.stringify(data));

// Devuelve { role, id, label } o null
async function session(request, env) {
  const c = getCookie(request, 'gal');
  if (!c) return null;
  if (c.startsWith('a.')) {
    return c.slice(2) === (await adminToken(env)) ? { role: 'admin', id: 'admin', label: 'אחראית' } : null;
  }
  if (c.startsWith('c.')) {
    const codes = await readJson(env, CODES_KEY, []);
    const hit = codes.find((x) => x.code === c.slice(2));
    return hit ? { role: hit.role, id: hit.id, label: hit.label } : null;
  }
  return null;
}

const safeName = (n) => /^[0-9]{13}-[a-z0-9]{6}\.jpg$/.test(n);
const can = (me, role) => RANK[me.role] >= RANK[role];

function newCode(existing) {
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    const code = String(n).padStart(6, '0');
    if (!existing.some((x) => x.code === code)) return code;
  }
}

export async function onRequest({ request, env, params }) {
  const parts = (params.path || []).map(decodeURIComponent);
  const url = new URL(request.url);
  const method = request.method;
  const route = parts[0];

  if (!env.ADMIN_PIN) return json({ error: 'setup', message: 'ADMIN_PIN is not configured' }, 503);

  // ---------- Login ----------
  if (route === 'login' && method === 'POST') {
    const { pin } = await request.json().catch(() => ({}));
    const value = String(pin || '').trim();
    if (value && value === String(env.ADMIN_PIN)) {
      return json({ ok: true, role: 'admin', label: 'אחראית' }, 200, { 'set-cookie': cookie('a.' + (await adminToken(env))) });
    }
    const codes = await readJson(env, CODES_KEY, []);
    const hit = codes.find((x) => x.code === value);
    if (hit) return json({ ok: true, role: hit.role, label: hit.label }, 200, { 'set-cookie': cookie('c.' + hit.code) });
    await new Promise((r) => setTimeout(r, 1000)); // frena adivinanzas
    return json({ ok: false }, 401);
  }
  if (route === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': 'gal=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax' });
  }

  const me = await session(request, env);
  if (route === 'me') return json(me ? { authed: true, role: me.role, label: me.label } : { authed: false });
  if (!me) return json({ error: 'auth' }, 401);

  // ---------- Códigos de acceso (solo admin) ----------
  if (route === 'codes') {
    if (!can(me, 'admin')) return json({ error: 'forbidden' }, 403);
    const codes = await readJson(env, CODES_KEY, []);
    if (method === 'GET') return json({ codes });
    if (method === 'POST') {
      const { label, role } = await request.json().catch(() => ({}));
      const clean = String(label || '').trim().slice(0, 30);
      if (!clean || !(role === 'member' || role === 'helper')) return json({ error: 'bad' }, 400);
      const entry = { id: 'u' + Math.random().toString(36).slice(2, 8), code: newCode(codes), role, label: clean, created: Date.now() };
      codes.push(entry);
      await saveJson(env, CODES_KEY, codes);
      return json(entry);
    }
    if (method === 'DELETE' && parts[1]) {
      await saveJson(env, CODES_KEY, codes.filter((x) => x.id !== parts[1]));
      return json({ ok: true });
    }
  }

  // ---------- Categorías ----------
  if (route === 'categories') {
    const custom = await readJson(env, CATS_KEY, []);
    if (method === 'GET') {
      return json({ fixed: FIXED, custom, suggestions: SUGGESTIONS.filter((s) => !custom.some((c) => c.name === s)) });
    }
    if (method === 'POST') {
      if (!can(me, 'helper')) return json({ error: 'forbidden' }, 403);
      const { name } = await request.json().catch(() => ({}));
      const clean = String(name || '').trim().slice(0, 30);
      if (!clean) return json({ error: 'name' }, 400);
      const dup = [...FIXED, ...custom].find((c) => c.name === clean);
      if (dup) return json(dup);
      const cat = { id: 'c' + Math.random().toString(36).slice(2, 8), name: clean };
      custom.push(cat);
      await saveJson(env, CATS_KEY, custom);
      return json(cat);
    }
  }

  // ---------- Listado ----------
  if (route === 'photos' && method === 'GET') {
    const cat = url.searchParams.get('cat') || '';
    const want = 120;
    const staff = can(me, 'helper');
    const items = [];
    let cursor = url.searchParams.get('cursor') || undefined;
    let done = false;
    while (items.length < want && !done) {
      const res = await env.PHOTOS.list({ prefix: 'photos/', limit: 500, cursor, include: ['customMetadata'] });
      for (const o of res.objects) {
        const meta = o.customMetadata || {};
        if (cat && meta.cat !== cat) continue;
        if (!staff && meta.cat === 'pending' && meta.by !== me.id) continue; // la bandeja es privada
        items.push({
          name: o.key.slice('photos/'.length),
          cat: meta.cat || '',
          date: Number(meta.date) || o.uploaded.getTime(),
          by: meta.byLabel || '',
          mine: meta.by === me.id,
        });
      }
      if (res.truncated) cursor = res.cursor; else { done = true; cursor = undefined; }
    }
    return json({ items, cursor: done ? null : cursor });
  }

  // ---------- Subida (todas) ----------
  if (route === 'upload' && method === 'POST') {
    const form = await request.formData();
    const file = form.get('file');
    const thumb = form.get('thumb');
    const cat = String(form.get('cat') || '') || 'pending';
    const takenAt = Number(form.get('date')) || Date.now();
    if (!file || typeof file === 'string' || !thumb || typeof thumb === 'string') return json({ error: 'files' }, 400);
    if (file.size > MAX_BYTES) return json({ error: 'too_big' }, 413);
    const custom = await readJson(env, CATS_KEY, []);
    if (![...FIXED, ...custom].some((c) => c.id === cat)) return json({ error: 'cat' }, 400);
    const rev = String(9999999999999 - Date.now()).padStart(13, '0'); // las nuevas primero
    const name = `${rev}-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}.jpg`;
    const http = { httpMetadata: { contentType: 'image/jpeg' } };
    await env.PHOTOS.put('thumbs/' + name, thumb.stream(), http);
    await env.PHOTOS.put('photos/' + name, file.stream(), {
      ...http,
      customMetadata: { cat, date: String(takenAt), by: me.id, byLabel: me.label },
    });
    return json({ ok: true, name });
  }

  // ---------- Mover / borrar ----------
  if (route === 'photos' && parts[1] && safeName(parts[1])) {
    const name = parts[1];
    const head = await env.PHOTOS.head('photos/' + name);
    if (!head) return json({ error: 'nf' }, 404);
    if (method === 'DELETE') {
      const own = (head.customMetadata || {}).by === me.id;
      if (!can(me, 'helper') && !own) return json({ error: 'forbidden' }, 403);
      await env.PHOTOS.delete(['photos/' + name, 'thumbs/' + name]);
      return json({ ok: true });
    }
    if (method === 'PATCH') {
      if (!can(me, 'helper')) return json({ error: 'forbidden' }, 403);
      const { cat } = await request.json().catch(() => ({}));
      const custom = await readJson(env, CATS_KEY, []);
      if (![...FIXED, ...custom].some((c) => c.id === cat)) return json({ error: 'cat' }, 400);
      const obj = await env.PHOTOS.get('photos/' + name);
      await env.PHOTOS.put('photos/' + name, obj.body, {
        httpMetadata: obj.httpMetadata,
        customMetadata: { ...(obj.customMetadata || {}), cat },
      });
      return json({ ok: true });
    }
  }

  // ---------- Ajustes, calendario, viajes, música ----------
  {
    const r = await extraRoutes({ request, env, me, parts, method, json, readJson, saveJson, can });
    if (r) return r;
  }

  // ---------- Imágenes ----------
  if (route === 'img' && method === 'GET' && (parts[1] === 'full' || parts[1] === 'thumb') && safeName(parts[2] || '')) {
    const obj = await env.PHOTOS.get((parts[1] === 'thumb' ? 'thumbs/' : 'photos/') + parts[2]);
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, {
      headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable' },
    });
  }

  return json({ error: 'not_found' }, 404);
}
