// Rutas de la Etapa 1: ajustes, calendario, viajes y música.
// Todo se guarda como documentos JSON en R2 (sin base de datos aparte).

const KEYS = {
  settings: '_meta/settings.json',
  events: '_meta/events.json',
  trips: '_meta/trips.json',
  music: '_meta/music.json',
  posts: '_meta/posts.json',
  profiles: '_meta/profiles.json',
  codes: '_meta/codes.json',
  contacts: '_meta/contacts.json',
  group: '_meta/group.jpg',
};
const MAX_IMG = 6 * 1024 * 1024;
const rid = (p) => p + Math.random().toString(36).slice(2, 8);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isHttps = (v) => { try { return new URL(v).protocol === 'https:'; } catch { return false; } };

// Todas las personas: la administradora, cada código de acceso y los contactos agregados a mano (sin acceso)
async function roster_(env) {
  const get = (k) => env.PHOTOS.get(k).then((o) => (o ? o.json() : [])).catch(() => []);
  const [codes, contacts] = await Promise.all([get(KEYS.codes), get(KEYS.contacts)]);
  return [
    { id: 'admin', name: 'אחראית', role: 'admin' },
    ...codes.map((c) => ({ id: c.id, name: c.label, role: c.role })),
    ...contacts.map((c) => ({ id: c.id, name: c.name, role: 'contact' })),
  ];
}

// Vista de un viaje según el rol: las niñas solo ven su propio pago.
function viewTrip(t, me, staff) {
  const people = t.people.map((p) => {
    const mine = p.userId === me.id;
    const o = { id: p.id, name: p.name, mine };
    if (staff || mine) o.paid = p.paid;
    return o;
  });
  const items = t.items.map((i) => ({
    id: i.id, name: i.name, by: i.by || '', done: !!i.done, cost: i.cost || 0,
    mine: !!i.byId && i.byId === me.id, canDelete: staff || i.createdBy === me.id,
  }));
  const out = { id: t.id, name: t.name, place: t.place, from: t.from, to: t.to, price: t.price, deadline: t.deadline, notes: t.notes, people, items };
  out.going = people.some((p) => p.mine);
  const mineP = people.find((p) => p.mine);
  if (mineP) out.myDue = Math.max(0, t.price - (mineP.paid || 0));
  if (staff) {
    const collected = t.people.reduce((a, p) => a + (p.paid || 0), 0);
    out.totals = { expected: t.price * t.people.length, collected, pending: Math.max(0, t.price * t.people.length - collected) };
  }
  return out;
}

export async function extraRoutes({ request, env, me, parts, method, json, readJson, saveJson, can }) {
  const route = parts[0];
  const staff = can(me, 'helper');
  const body = async () => request.json().catch(() => ({}));

  // ---------- Ajustes (enlace del grupo, ciudad, moderación, foto del grupo) ----------
  if (route === 'settings') {
    const cur = { wa: '', city: 'jerusalem', moderate: false, gp: 0, ...(await readJson(env, KEYS.settings, {})) };
    if (method === 'GET') return json(cur);
    if (method === 'PUT') {
      if (!can(me, 'admin')) return json({ error: 'forbidden' }, 403);
      const b = await body();
      const wa = str(b.wa, 300);
      if (wa && !isHttps(wa)) return json({ error: 'wa' }, 400);
      const next = { ...cur, wa, city: str(b.city, 30) || 'jerusalem', moderate: !!b.moderate };
      await saveJson(env, KEYS.settings, next);
      return json(next);
    }
  }

  // ---------- Foto del grupo (dashboard) ----------
  if (route === 'group-photo' && method === 'POST') {
    if (!staff) return json({ error: 'forbidden' }, 403);
    const f = (await request.formData()).get('file');
    if (!f || typeof f === 'string' || f.size > MAX_IMG) return json({ error: 'file' }, 400);
    await env.PHOTOS.put(KEYS.group, f.stream(), { httpMetadata: { contentType: 'image/jpeg' } });
    const cur = await readJson(env, KEYS.settings, {});
    cur.gp = Date.now();
    await saveJson(env, KEYS.settings, cur);
    return json({ ok: true, gp: cur.gp });
  }
  if (route === 'img' && method === 'GET' && (parts[1] === 'group' || (parts[1] === 'profile' && /^[a-z0-9]{1,12}$/i.test(parts[2] || '')))) {
    const obj = await env.PHOTOS.get(parts[1] === 'group' ? KEYS.group : `profiles/${parts[2]}.jpg`);
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable' } });
  }

  // ---------- Calendario ----------
  if (route === 'events') {
    const list = await readJson(env, KEYS.events, []);
    if (method === 'GET') {
      const out = list.map((e) => ({
        id: e.id, type: e.type, title: e.title, date: e.date, time: e.time, place: e.place, desc: e.desc,
        going: e.going.length, mine: e.going.some((g) => g.id === me.id),
        names: staff ? e.going.map((g) => g.name) : undefined,
      }));
      // cumpleaños que salen solos de las fichas (si la niña quiere mostrarlo)
      const profiles = await readJson(env, KEYS.profiles, {});
      const roster = await roster_(env);
      for (const u of roster) {
        const pr = profiles[u.id];
        if (pr && isDate(pr.birthday) && (pr.show?.birthday !== false || staff)) {
          out.push({ id: 'b-' + u.id, type: 'birthday', auto: true, title: u.name, date: pr.birthday, time: '', place: '', desc: '', going: 0, mine: false });
        }
      }
      return json({ events: out });
    }
    if (method === 'POST' && !parts[1]) {
      if (!staff) return json({ error: 'forbidden' }, 403);
      const b = await body();
      const type = b.type === 'birthday' ? 'birthday' : 'event';
      const title = str(b.title, 80);
      if (!title || !isDate(b.date)) return json({ error: 'bad' }, 400);
      const ev = { id: rid('e'), type, title, date: b.date, time: str(b.time, 5), place: str(b.place, 80), desc: str(b.desc, 400), going: [] };
      list.push(ev);
      await saveJson(env, KEYS.events, list);
      return json({ ok: true, id: ev.id });
    }
    const ev = list.find((e) => e.id === parts[1]);
    if (ev && parts[2] === 'rsvp' && method === 'POST') {
      const { going } = await body();
      ev.going = ev.going.filter((g) => g.id !== me.id);
      if (going) ev.going.push({ id: me.id, name: me.label });
      await saveJson(env, KEYS.events, list);
      return json({ ok: true });
    }
    if (ev && method === 'DELETE') {
      if (!staff) return json({ error: 'forbidden' }, 403);
      await saveJson(env, KEYS.events, list.filter((e) => e.id !== ev.id));
      return json({ ok: true });
    }
    if (ev && method === 'PATCH') {
      if (!staff) return json({ error: 'forbidden' }, 403);
      const b = await body();
      if (b.title !== undefined) ev.title = str(b.title, 80) || ev.title;
      if (b.date !== undefined && isDate(b.date)) ev.date = b.date;
      if (b.time !== undefined) ev.time = str(b.time, 5);
      if (b.place !== undefined) ev.place = str(b.place, 80);
      if (b.desc !== undefined) ev.desc = str(b.desc, 400);
      await saveJson(env, KEYS.events, list);
      return json({ ok: true });
    }
  }

  // ---------- Viajes ----------
  if (route === 'trips') {
    const trips = await readJson(env, KEYS.trips, []);
    if (method === 'GET' && !parts[1]) return json({ trips: trips.map((t) => viewTrip(t, me, staff)) });

    if (method === 'POST' && !parts[1]) {
      if (!staff) return json({ error: 'forbidden' }, 403);
      const b = await body();
      const name = str(b.name, 80);
      if (!name) return json({ error: 'bad' }, 400);
      const t = {
        id: rid('t'), name, place: str(b.place, 80),
        from: isDate(b.from) ? b.from : '', to: isDate(b.to) ? b.to : '',
        price: num(b.price), deadline: isDate(b.deadline) ? b.deadline : '', notes: str(b.notes, 400),
        people: [],
        items: (Array.isArray(b.items) ? b.items : []).slice(0, 60).map((n) => ({ id: rid('i'), name: str(n, 60), by: '', byId: '', done: false, cost: 0, createdBy: me.id })).filter((i) => i.name),
      };
      trips.push(t);
      await saveJson(env, KEYS.trips, trips);
      return json({ ok: true, id: t.id });
    }

    const t = trips.find((x) => x.id === parts[1]);
    if (!t) return json({ error: 'nf' }, 404);

    if (method === 'DELETE') {
      if (!staff) return json({ error: 'forbidden' }, 403);
      await saveJson(env, KEYS.trips, trips.filter((x) => x.id !== t.id));
      return json({ ok: true });
    }
    if (method === 'PATCH') {
      if (!staff) return json({ error: 'forbidden' }, 403);
      const b = await body();
      if (b.name !== undefined) t.name = str(b.name, 80) || t.name;
      if (b.place !== undefined) t.place = str(b.place, 80);
      if (b.from !== undefined) t.from = isDate(b.from) ? b.from : '';
      if (b.to !== undefined) t.to = isDate(b.to) ? b.to : '';
      if (b.price !== undefined) t.price = num(b.price);
      if (b.deadline !== undefined) t.deadline = isDate(b.deadline) ? b.deadline : '';
      if (b.notes !== undefined) t.notes = str(b.notes, 400);
      await saveJson(env, KEYS.trips, trips);
      return json({ ok: true });
    }
    if (method === 'GET') return json(viewTrip(t, me, staff));

    if (method === 'POST' && parts[2] === 'act') {
      const b = await body();
      const item = () => t.items.find((i) => i.id === b.iid);
      const person = () => t.people.find((p) => p.id === b.pid);
      switch (b.op) {
        case 'join':
          if (!t.people.some((p) => p.userId === me.id)) t.people.push({ id: rid('p'), userId: me.id, name: me.label, paid: 0 });
          break;
        case 'leave': {
          const p = t.people.find((x) => x.userId === me.id);
          if (p && p.paid > 0 && !staff) return json({ error: 'paid' }, 409);
          t.people = t.people.filter((x) => x.userId !== me.id);
          t.items.forEach((i) => { if (i.byId === me.id) { i.by = ''; i.byId = ''; } });
          break;
        }
        case 'addPerson':
          if (!staff) return json({ error: 'forbidden' }, 403);
          if (str(b.name, 40)) t.people.push({ id: rid('p'), userId: '', name: str(b.name, 40), paid: 0 });
          break;
        case 'setPaid':
          if (!staff) return json({ error: 'forbidden' }, 403);
          if (person()) person().paid = num(b.paid);
          break;
        case 'removePerson':
          if (!staff) return json({ error: 'forbidden' }, 403);
          t.people = t.people.filter((p) => p.id !== b.pid);
          break;
        case 'addItem':
          if (str(b.name, 60)) t.items.push({ id: rid('i'), name: str(b.name, 60), by: '', byId: '', done: false, cost: 0, createdBy: me.id });
          break;
        case 'claim': {
          const i = item(); if (!i) break;
          if (i.byId && !staff) return json({ error: 'taken' }, 409);
          i.by = me.label; i.byId = me.id;
          break;
        }
        case 'assign': {
          if (!staff) return json({ error: 'forbidden' }, 403);
          const i = item(); if (!i) break;
          i.by = str(b.name, 40); i.byId = '';
          break;
        }
        case 'unclaim': {
          const i = item(); if (!i) break;
          if (i.byId !== me.id && !staff) return json({ error: 'forbidden' }, 403);
          i.by = ''; i.byId = ''; i.done = false;
          break;
        }
        case 'setItem': {
          const i = item(); if (!i) break;
          if (!staff && i.byId !== me.id) return json({ error: 'forbidden' }, 403);
          if (b.done !== undefined) i.done = !!b.done;
          if (b.cost !== undefined) i.cost = num(b.cost);
          break;
        }
        case 'removeItem': {
          const i = item(); if (!i) break;
          if (!staff && i.createdBy !== me.id) return json({ error: 'forbidden' }, 403);
          t.items = t.items.filter((x) => x.id !== i.id);
          break;
        }
        default: return json({ error: 'op' }, 400);
      }
      await saveJson(env, KEYS.trips, trips);
      return json(viewTrip(t, me, staff));
    }
  }

  // ---------- Música ----------
  if (route === 'music') {
    const list = await readJson(env, KEYS.music, []);
    if (method === 'GET') {
      return json({ songs: list.filter((m) => m.approved || staff || m.byId === me.id).map((m) => ({ id: m.id, title: m.title, url: m.url, by: m.by, approved: m.approved, mine: m.byId === me.id })) });
    }
    if (method === 'POST' && !parts[1]) {
      const b = await body();
      const title = str(b.title, 80), url = str(b.url, 400);
      if (!title || !isHttps(url)) return json({ error: 'bad' }, 400);
      const m = { id: rid('m'), title, url, by: me.label, byId: me.id, approved: staff, created: Date.now() };
      list.push(m);
      await saveJson(env, KEYS.music, list);
      return json({ ok: true, approved: m.approved });
    }
    const m = list.find((x) => x.id === parts[1]);
    if (m && parts[2] === 'approve' && method === 'POST') {
      if (!staff) return json({ error: 'forbidden' }, 403);
      m.approved = true;
      await saveJson(env, KEYS.music, list);
      return json({ ok: true });
    }
    if (m && method === 'DELETE') {
      if (!staff && m.byId !== me.id) return json({ error: 'forbidden' }, 403);
      await saveJson(env, KEYS.music, list.filter((x) => x.id !== m.id));
      return json({ ok: true });
    }
  }

  // ---------- Fichas (CRM) ----------
  if (route === 'profiles') {
    const profiles = await readJson(env, KEYS.profiles, {});
    const FIELDS = ['phone', 'address', 'birthday'];            // visibles para las demás si ella lo permite
    const PRIVATE = ['emergency', 'allergies', 'parents'];       // solo ella y el equipo de orden
    if (method === 'GET' && !parts[1]) {
      const roster = await roster_(env);
      const people = roster.map((u) => {
        const pr = profiles[u.id] || {};
        const mine = u.id === me.id;
        const full = staff || mine;
        const o = { id: u.id, name: u.name, role: u.role, mine, photo: pr.photo || 0 };
        for (const f of FIELDS) if (full || pr.show?.[f]) o[f] = pr[f] || '';
        if (full) { for (const f of PRIVATE) o[f] = pr[f] || ''; o.show = { phone: !!pr.show?.phone, address: !!pr.show?.address, birthday: pr.show?.birthday !== false }; }
        return o;
      });
      return json({ people });
    }
    // agregar amigas a mano (sin código de acceso todavía)
    if (method === 'POST' && !parts[1]) {
      if (!staff) return json({ error: 'forbidden' }, 403);
      const b = await body();
      const names = (Array.isArray(b.names) ? b.names : [b.name]).map((n) => str(n, 40)).filter(Boolean).slice(0, 60);
      if (!names.length) return json({ error: 'bad' }, 400);
      const contacts = await readJson(env, KEYS.contacts, []);
      if (contacts.length + names.length > 300) return json({ error: 'limit' }, 400);
      const added = names.map((name) => ({ id: rid('k'), name }));
      await saveJson(env, KEYS.contacts, contacts.concat(added));
      return json({ ok: true, added });
    }
    const target = parts[1] === 'me' ? me.id : parts[1];
    if (target !== me.id && !staff) return json({ error: 'forbidden' }, 403);
    const roster = await roster_(env);
    if (!roster.some((u) => u.id === target)) return json({ error: 'nf' }, 404);
    const isContact = target.startsWith('k');
    if (method === 'DELETE' && !parts[2]) {
      if (!staff || !isContact) return json({ error: 'forbidden' }, 403);
      const contacts = await readJson(env, KEYS.contacts, []);
      await saveJson(env, KEYS.contacts, contacts.filter((c) => c.id !== target));
      delete profiles[target];
      await saveJson(env, KEYS.profiles, profiles);
      await env.PHOTOS.delete(`profiles/${target}.jpg`);
      return json({ ok: true });
    }
    if (method === 'POST' && parts[2] === 'access') {
      if (!staff || !isContact) return json({ error: 'forbidden' }, 403);
      const b = await body();
      const role = b.role === 'helper' ? 'helper' : 'member';
      const contacts = await readJson(env, KEYS.contacts, []);
      const c = contacts.find((x) => x.id === target);
      if (!c) return json({ error: 'nf' }, 404);
      const codes = await readJson(env, KEYS.codes, []);
      let code; do { code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0'); } while (codes.some((x) => x.code === code));
      const entry = { id: rid('u'), code, role, label: c.name, created: Date.now() };
      codes.push(entry);
      await saveJson(env, KEYS.codes, codes);
      // la ficha y la foto pasan a la nueva identidad
      if (profiles[target]) { profiles[entry.id] = profiles[target]; delete profiles[target]; }
      const img = await env.PHOTOS.get(`profiles/${target}.jpg`);
      if (img) { await env.PHOTOS.put(`profiles/${entry.id}.jpg`, img.body, { httpMetadata: { contentType: 'image/jpeg' } }); await env.PHOTOS.delete(`profiles/${target}.jpg`); }
      await saveJson(env, KEYS.profiles, profiles);
      await saveJson(env, KEYS.contacts, contacts.filter((x) => x.id !== target));
      return json({ ok: true, id: entry.id, code: entry.code, role });
    }
    if (method === 'PUT' && !parts[2]) {
      const b = await body();
      if (isContact && staff && str(b.name, 40)) {
        const contacts = await readJson(env, KEYS.contacts, []);
        const c = contacts.find((x) => x.id === target);
        if (c) { c.name = str(b.name, 40); await saveJson(env, KEYS.contacts, contacts); }
      }
      const cur = profiles[target] || {};
      const next = {
        ...cur,
        phone: str(b.phone, 30), address: str(b.address, 120),
        birthday: isDate(b.birthday) ? b.birthday : '',
        emergency: str(b.emergency, 120), allergies: str(b.allergies, 120), parents: str(b.parents, 80),
        show: { phone: !!b.showPhone, address: !!b.showAddress, birthday: b.showBirthday !== false },
      };
      profiles[target] = next;
      await saveJson(env, KEYS.profiles, profiles);
      return json({ ok: true });
    }
    if (method === 'POST' && parts[2] === 'photo') {
      const f = (await request.formData()).get('file');
      if (!f || typeof f === 'string' || f.size > MAX_IMG) return json({ error: 'file' }, 400);
      await env.PHOTOS.put(`profiles/${target}.jpg`, f.stream(), { httpMetadata: { contentType: 'image/jpeg' } });
      profiles[target] = { ...(profiles[target] || {}), photo: Date.now() };
      await saveJson(env, KEYS.profiles, profiles);
      return json({ ok: true, photo: profiles[target].photo });
    }
  }

  // ---------- Publicaciones (מה חדש) ----------
  if (route === 'posts') {
    const posts = await readJson(env, KEYS.posts, []);
    const view = (p) => ({
      id: p.id, text: p.text, by: p.by, byId: p.byId, created: p.created, pinned: !!p.pinned, approved: p.approved !== false,
      mine: p.byId === me.id,
      reactions: Object.fromEntries(Object.entries(p.reactions || {}).map(([k, v]) => [k, { n: v.length, me: v.includes(me.id) }])),
      comments: (p.comments || []).map((c) => ({ id: c.id, by: c.by, text: c.text, created: c.created, canDelete: staff || c.byId === me.id })),
    });
    if (method === 'GET') {
      const vis = posts.filter((p) => p.approved !== false || staff || p.byId === me.id);
      vis.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.created - a.created);
      return json({ posts: vis.slice(0, 60).map(view) });
    }
    if (method === 'POST' && !parts[1]) {
      const text = str((await body()).text, 600);
      if (!text) return json({ error: 'bad' }, 400);
      const settings = await readJson(env, KEYS.settings, {});
      const p = { id: rid('p'), text, by: me.label, byId: me.id, created: Date.now(), pinned: false, approved: staff || !settings.moderate, reactions: {}, comments: [] };
      posts.unshift(p);
      await saveJson(env, KEYS.posts, posts.slice(0, 300));
      return json({ ok: true, approved: p.approved });
    }
    const p = posts.find((x) => x.id === parts[1]);
    if (p) {
      const save = () => saveJson(env, KEYS.posts, posts);
      if (method === 'DELETE' && !parts[2]) {
        if (!staff && p.byId !== me.id) return json({ error: 'forbidden' }, 403);
        await saveJson(env, KEYS.posts, posts.filter((x) => x.id !== p.id));
        return json({ ok: true });
      }
      if (method === 'POST' && parts[2] === 'react') {
        const emoji = str((await body()).emoji, 4);
        if (!['👍', '❤️', '😂', '🙏'].includes(emoji)) return json({ error: 'bad' }, 400);
        p.reactions ||= {};
        const arr = p.reactions[emoji] || [];
        p.reactions[emoji] = arr.includes(me.id) ? arr.filter((x) => x !== me.id) : [...arr, me.id];
        await save();
        return json({ ok: true });
      }
      if (method === 'POST' && parts[2] === 'comment') {
        const text = str((await body()).text, 300);
        if (!text) return json({ error: 'bad' }, 400);
        (p.comments ||= []).push({ id: rid('c'), by: me.label, byId: me.id, text, created: Date.now() });
        await save();
        return json({ ok: true });
      }
      if (method === 'DELETE' && parts[2] === 'comment') {
        const c = (p.comments || []).find((x) => x.id === parts[3]);
        if (c && (staff || c.byId === me.id)) { p.comments = p.comments.filter((x) => x.id !== c.id); await save(); }
        return json({ ok: true });
      }
      if (method === 'POST' && parts[2] === 'pin') { if (!staff) return json({ error: 'forbidden' }, 403); p.pinned = !p.pinned; await save(); return json({ ok: true }); }
      if (method === 'POST' && parts[2] === 'approve') { if (!staff) return json({ error: 'forbidden' }, 403); p.approved = true; await save(); return json({ ok: true }); }
    }
  }

  return null;
}
