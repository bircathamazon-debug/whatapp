// Rutas de la Etapa 1: ajustes, calendario, viajes y música.
// Todo se guarda como documentos JSON en R2 (sin base de datos aparte).

const KEYS = {
  settings: '_meta/settings.json',
  events: '_meta/events.json',
  trips: '_meta/trips.json',
  music: '_meta/music.json',
};
const rid = (p) => p + Math.random().toString(36).slice(2, 8);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isHttps = (v) => { try { return new URL(v).protocol === 'https:'; } catch { return false; } };

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

  // ---------- Ajustes (enlace del grupo, ciudad) ----------
  if (route === 'settings') {
    const cur = await readJson(env, KEYS.settings, { wa: '', city: 'jerusalem' });
    if (method === 'GET') return json(cur);
    if (method === 'PUT') {
      if (!can(me, 'admin')) return json({ error: 'forbidden' }, 403);
      const b = await body();
      const wa = str(b.wa, 300);
      if (wa && !isHttps(wa)) return json({ error: 'wa' }, 400);
      const next = { wa, city: str(b.city, 30) || 'jerusalem' };
      await saveJson(env, KEYS.settings, next);
      return json(next);
    }
  }

  // ---------- Calendario ----------
  if (route === 'events') {
    const list = await readJson(env, KEYS.events, []);
    if (method === 'GET') {
      return json({
        events: list.map((e) => ({
          id: e.id, type: e.type, title: e.title, date: e.date, time: e.time, place: e.place, desc: e.desc,
          going: e.going.length, mine: e.going.some((g) => g.id === me.id),
          names: staff ? e.going.map((g) => g.name) : undefined,
        })),
      });
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

  return null;
}
