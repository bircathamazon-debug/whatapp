(() => {
  'use strict';
  const { S, api, post, el, toast, can, formSheet, openOv, closeOv } = window.App;
  const $ = (id) => document.getElementById(id);

  // ciudades para el horario de Shabat (Hebcal acepta coordenadas)
  window.CITIES = {
    jerusalem: { name: 'ירושלים', lat: 31.7683, lon: 35.2137 },
    bneibrak: { name: 'בני ברק', lat: 32.0807, lon: 34.8338 },
    telaviv: { name: 'תל אביב', lat: 32.0853, lon: 34.7818 },
    bethshemesh: { name: 'בית שמש', lat: 31.7469, lon: 34.9886 },
    modiin: { name: 'מודיעין עילית', lat: 31.9333, lon: 35.0417 },
    beitar: { name: 'ביתר עילית', lat: 31.6962, lon: 35.1176 },
    ashdod: { name: 'אשדוד', lat: 31.8044, lon: 34.6553 },
    haifa: { name: 'חיפה', lat: 32.794, lon: 34.9896 },
  };

  const ils = (n) => '₪' + (Math.round(n * 100) / 100).toLocaleString('he-IL');
  const parseDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmt = (d, opts) => d.toLocaleDateString('he-IL', opts);
  const civil = (d) => fmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
  let hebFmt; try { hebFmt = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long' }); } catch {}
  const hebrew = (d) => (hebFmt ? hebFmt.format(d) : '');
  const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };

  // ======================= לוח שנה =======================
  async function loadShabbat() {
    const box = $('shabbat'); const c = window.CITIES[S.settings.city] || window.CITIES.jerusalem;
    try {
      const r = await fetch(`https://www.hebcal.com/shabbat?cfg=json&geo=pos&latitude=${c.lat}&longitude=${c.lon}&tzid=Asia%2FJerusalem&M=on`);
      const d = await r.json();
      const candles = d.items.find((i) => i.category === 'candles');
      const parsha = d.items.find((i) => i.category === 'parashat');
      const havdalah = d.items.find((i) => i.category === 'havdalah');
      const tm = (i) => new Date(i.date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      box.replaceChildren(
        el('p', { class: 'eyebrow' }, 'שבת הקרובה · ' + c.name),
        el('p', { class: 'sh-t' }, parsha ? parsha.hebrew : 'שבת'),
        el('p', { class: 'sh-s' }, [candles && 'הדלקת נרות ' + tm(candles), havdalah && 'צאת השבת ' + tm(havdalah)].filter(Boolean).join(' · ')));
      box.hidden = false;
    } catch { box.hidden = true; }
  }

  // המופע הבא של אירוע (יום הולדת חוזר כל שנה)
  function nextDate(e) {
    const d = parseDay(e.date);
    if (e.type !== 'birthday') return d;
    const t = today0(); const n = new Date(t.getFullYear(), d.getMonth(), d.getDate());
    if (n < t) n.setFullYear(t.getFullYear() + 1);
    return n;
  }

  function eventForm(ev) {
    formSheet({
      title: ev ? 'עריכת אירוע' : 'אירוע חדש',
      fields: [
        { name: 'type', label: 'סוג', type: 'select', value: ev ? ev.type : 'event', options: [['event', 'פעילות'], ['birthday', 'יום הולדת (חוזר כל שנה)']] },
        { name: 'title', label: 'שם', required: true, value: ev?.title, max: 80, placeholder: 'למשל: ערב בנות בגינה' },
        { name: 'date', label: 'תאריך', type: 'date', required: true, value: ev?.date },
        { name: 'time', label: 'שעה', type: 'time', value: ev?.time },
        { name: 'place', label: 'מקום', value: ev?.place, max: 80 },
        { name: 'desc', label: 'פרטים', type: 'textarea', value: ev?.desc },
      ],
      onSubmit: async (v) => { await (ev ? post('events/' + ev.id, v, 'PATCH') : post('events', v)); toast('נשמר'); loadCal(); },
    });
  }

  async function loadCal() {
    $('addEvent').hidden = !can('helper');
    loadShabbat();
    const { events } = await api('events');
    const t = today0();
    const items = events.map((e) => ({ e, when: nextDate(e) })).filter((x) => x.when >= t).sort((a, b) => a.when - b.when);
    const ul = $('eventList'); ul.replaceChildren();
    if (!items.length) ul.append(el('li', { class: 'empty-s' }, can('helper') ? 'אין אירועים קרובים. לחצי "הוספה" כדי ליצור את הראשון.' : 'אין אירועים קרובים כרגע.'));
    for (const { e, when } of items) {
      const days = Math.round((when - t) / 864e5);
      const soon = days === 0 ? 'היום' : days === 1 ? 'מחר' : `בעוד ${days} ימים`;
      ul.append(el('li', { class: 'card' },
        el('div', { class: 'ev-date' }, el('b', {}, String(when.getDate())), el('span', {}, fmt(when, { month: 'short' }))),
        el('div', { class: 'ev-main' },
          el('p', { class: 'ev-t' }, (e.type === 'birthday' ? 'יום הולדת: ' : '') + e.title),
          el('p', { class: 'ev-s' }, [civil(when), hebrew(when), e.time, e.place].filter(Boolean).join(' · ')),
          e.desc ? el('p', { class: 'ev-d' }, e.desc) : null,
          el('div', { class: 'ev-a' },
            el('span', { class: 'pill' }, soon),
            e.type === 'event' ? el('button', { class: 'opt', 'aria-pressed': String(e.mine), onclick: async () => { await post(`events/${e.id}/rsvp`, { going: !e.mine }); loadCal(); } }, e.mine ? 'אני באה ✓' : 'אני באה') : null,
            e.type === 'event' ? el('span', { class: 'ev-s' }, e.going ? `${e.going} מגיעות` : '') : null,
            can('helper') ? el('button', { class: 'link', onclick: () => eventForm(e) }, 'עריכה') : null,
            can('helper') ? el('button', { class: 'link', onclick: async (ev) => { const b = ev.currentTarget; if (b.dataset.arm) { await api('events/' + e.id, { method: 'DELETE' }); loadCal(); } else { b.dataset.arm = 1; b.textContent = 'לחצי שוב למחיקה'; } } }, 'מחיקה') : null),
          e.names && e.names.length ? el('p', { class: 'ev-s' }, 'מגיעות: ' + e.names.join(', ')) : null)));
    }
  }
  $('addEvent').onclick = () => eventForm();

  // ======================= טיולים =======================
  const DEFAULT_ITEMS = ['שתייה', 'חטיפים', 'רמקול', 'גריל', 'פחמים', 'צלחות וכוסות', 'קרח', 'משחקים', 'ערכת עזרה ראשונה', 'שקיות אשפה'];

  function tripForm(t) {
    formSheet({
      title: t ? 'עריכת טיול' : 'טיול חדש',
      fields: [
        { name: 'name', label: 'שם הטיול', required: true, value: t?.name, max: 80, placeholder: 'למשל: סוף שבוע בצפון' },
        { name: 'place', label: 'יעד', value: t?.place, max: 80 },
        { name: 'from', label: 'מתאריך', type: 'date', value: t?.from },
        { name: 'to', label: 'עד תאריך', type: 'date', value: t?.to },
        { name: 'price', label: 'מחיר לכל אחת (₪)', type: 'number', value: t?.price ?? '' },
        { name: 'deadline', label: 'לשלם עד', type: 'date', value: t?.deadline },
        { name: 'notes', label: 'הערות', type: 'textarea', value: t?.notes },
        ...(t ? [] : [{ name: 'items', label: 'מה צריך להביא (שורה לכל דבר)', type: 'textarea', rows: 6, max: 1200, value: DEFAULT_ITEMS.join('\n') }]),
      ],
      onSubmit: async (v) => {
        if (t) { await post('trips/' + t.id, v, 'PATCH'); openTrip(t.id); }
        else { await post('trips', { ...v, items: v.items.split('\n').map((x) => x.trim()).filter(Boolean) }); }
        toast('נשמר'); loadTrips();
      },
    });
  }

  async function loadTrips() {
    $('addTrip').hidden = !can('helper');
    const { trips } = await api('trips');
    const ul = $('tripList'); ul.replaceChildren();
    if (!trips.length) ul.append(el('li', { class: 'empty-s' }, can('helper') ? 'עדיין אין טיולים. לחצי "טיול חדש".' : 'אין טיולים קרובים כרגע.'));
    for (const t of trips) {
      const missing = t.items.filter((i) => !i.by).length;
      ul.append(el('li', { class: 'card tap', tabindex: '0', onclick: () => openTrip(t.id), onkeydown: (e) => e.key === 'Enter' && openTrip(t.id) },
        el('div', { class: 'ev-main' },
          el('p', { class: 'ev-t' }, t.name),
          el('p', { class: 'ev-s' }, [t.place, t.from && fmt(parseDay(t.from), { day: 'numeric', month: 'long' }), t.price ? ils(t.price) + ' לאחת' : ''].filter(Boolean).join(' · ')),
          el('div', { class: 'ev-a' },
            el('span', { class: 'pill' }, `${t.people.length} נוסעות`),
            t.going ? el('span', { class: 'pill ok' }, 'את רשומה') : null,
            missing ? el('span', { class: 'pill warn' }, `חסר מי שיביא: ${missing}`) : null))));
    }
  }
  $('addTrip').onclick = () => tripForm();

  let curTrip = null;
  async function openTrip(id, data) {
    const t = data || await api('trips/' + id);
    curTrip = t;
    $('tripT').textContent = t.name;
    const body = $('tripBody'); body.replaceChildren();
    const act = async (payload) => { try { const nt = await post(`trips/${t.id}/act`, payload); openTrip(t.id, nt); } catch (e) { toast(e.status === 409 ? 'זה כבר נתפס או שיש תשלום רשום' : 'הפעולה נכשלה'); } };
    const staff = can('helper');

    // פרטים
    body.append(el('p', { class: 'ev-s' }, [t.place, t.from && (civil(parseDay(t.from)) + (t.to ? ' עד ' + fmt(parseDay(t.to), { day: 'numeric', month: 'long' }) : '')), t.price ? 'מחיר: ' + ils(t.price) + ' לאחת' : '', t.deadline && 'לשלם עד ' + fmt(parseDay(t.deadline), { day: 'numeric', month: 'long' })].filter(Boolean).join(' · ')));
    if (t.notes) body.append(el('p', { class: 'ev-d' }, t.notes));
    if (staff) body.append(el('div', { class: 'ev-a' }, el('button', { class: 'link', onclick: () => tripForm(t) }, 'עריכת פרטים'),
      el('button', { class: 'link', onclick: async (e) => { const b = e.currentTarget; if (b.dataset.arm) { await api('trips/' + t.id, { method: 'DELETE' }); closeOv('trip'); loadTrips(); } else { b.dataset.arm = 1; b.textContent = 'לחצי שוב למחיקת הטיול'; } } }, 'מחיקת הטיול')));

    // התשלום שלי
    if (t.going) {
      const me = t.people.find((p) => p.mine);
      body.append(el('div', { class: 'mine' }, el('b', {}, t.price ? (t.myDue > 0 ? `נשאר לשלם: ${ils(t.myDue)}` : 'שולם במלואו ✓') : 'את רשומה לטיול'), t.price ? el('span', { class: 'ev-s' }, `שילמת ${ils(me.paid || 0)} מתוך ${ils(t.price)}`) : null));
    }

    // סיכום (עוזרות)
    if (t.totals) body.append(el('div', { class: 'totals' },
      el('div', {}, el('span', {}, 'נאסף'), el('b', {}, ils(t.totals.collected))),
      el('div', {}, el('span', {}, 'חסר'), el('b', {}, ils(t.totals.pending))),
      el('div', {}, el('span', {}, 'צפוי'), el('b', {}, ils(t.totals.expected)))));

    // נוסעות
    body.append(el('h3', {}, `מי נוסעת (${t.people.length})`));
    body.append(el('button', { class: 'btn ' + (t.going ? 'line' : 'solid') + ' small', onclick: () => act({ op: t.going ? 'leave' : 'join' }) }, t.going ? 'ביטול הרשמה' : 'אני נוסעת'));
    const pl = el('ul', { class: 'plist' });
    for (const p of t.people) {
      const li = el('li', {}, el('span', {}, p.name + (p.mine ? ' (את)' : '')));
      if (staff) {
        const paid = el('input', { type: 'number', min: '0', step: '0.5', value: String(p.paid || 0), inputmode: 'decimal', 'aria-label': 'שולם', class: 'amt' });
        paid.addEventListener('change', () => act({ op: 'setPaid', pid: p.id, paid: paid.value }));
        li.append(paid, el('span', { class: 'pill ' + ((p.paid || 0) >= t.price && t.price ? 'ok' : 'warn') }, (p.paid || 0) >= t.price && t.price ? 'שילמה' : 'לא שילמה'),
          el('button', { class: 'link', onclick: () => act({ op: 'removePerson', pid: p.id }) }, 'הסרה'));
      }
      pl.append(li);
    }
    body.append(pl);
    if (staff) {
      const inp = el('input', { type: 'text', maxlength: '40', placeholder: 'הוספת נוסעת בשם', id: 'addP' });
      body.append(el('div', { class: 'row' }, inp, el('button', { class: 'btn line small', onclick: () => inp.value.trim() && act({ op: 'addPerson', name: inp.value }) }, 'הוספה')));
    }

    // מה להביא
    const missing = t.items.filter((i) => !i.by);
    body.append(el('h3', {}, 'מי מביאה מה'));
    if (missing.length) body.append(el('p', { class: 'pill warn wrapt' }, `עדיין חסר מי שיביא: ${missing.map((i) => i.name).join(', ')}`));
    const il = el('ul', { class: 'ilist' });
    for (const i of t.items) {
      const li = el('li', { class: i.by ? '' : 'free' });
      li.append(el('span', { class: 'iname' + (i.done ? ' done' : '') }, i.name));
      if (!i.by) {
        li.append(el('button', { class: 'opt', onclick: () => act({ op: 'claim', iid: i.id }) }, 'אני מביאה'));
        if (staff) li.append(el('button', { class: 'link', onclick: () => { formSheet({ title: 'מי מביאה: ' + i.name, fields: [{ name: 'name', label: 'שם', required: true, max: 40 }], onSubmit: async (v) => { await act({ op: 'assign', iid: i.id, name: v.name }); } }); } }, 'שיוך'));
      } else {
        li.append(el('span', { class: 'ev-s' }, i.by + (i.mine ? ' (את)' : '')));
        if (i.mine || staff) {
          li.append(el('button', { class: 'link', onclick: () => act({ op: 'setItem', iid: i.id, done: !i.done }) }, i.done ? 'בטלי ✓' : 'הבאתי ✓'),
            el('button', { class: 'link', onclick: () => act({ op: 'unclaim', iid: i.id }) }, 'ביטול'));
        }
      }
      if (i.canDelete) li.append(el('button', { class: 'link', 'aria-label': 'מחיקת פריט', onclick: () => act({ op: 'removeItem', iid: i.id }) }, '✕'));
      il.append(li);
    }
    body.append(il);
    const ni = el('input', { type: 'text', maxlength: '60', placeholder: 'עוד משהו שצריך להביא…', id: 'addI' });
    body.append(el('div', { class: 'row' }, ni, el('button', { class: 'btn line small', onclick: () => ni.value.trim() && act({ op: 'addItem', name: ni.value }) }, 'הוספה')));
    openOv('trip');
  }
  $('tripClose').onclick = () => { closeOv('trip'); loadTrips(); };
  $('trip').addEventListener('click', (e) => { if (e.target === $('trip')) { closeOv('trip'); loadTrips(); } });

  // ======================= מוזיקה =======================
  function embedUrl(u) {
    try {
      const x = new URL(u); const h = x.hostname.replace(/^www\.|^m\./, '');
      if (h === 'youtu.be') return 'https://www.youtube.com/embed/' + x.pathname.slice(1);
      if (h === 'youtube.com' || h === 'music.youtube.com') {
        if (x.searchParams.get('list') && !x.searchParams.get('v')) return 'https://www.youtube.com/embed/videoseries?list=' + x.searchParams.get('list');
        if (x.searchParams.get('v')) return 'https://www.youtube.com/embed/' + x.searchParams.get('v');
        const m = x.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/); if (m) return 'https://www.youtube.com/embed/' + m[1];
      }
      if (h === 'open.spotify.com') { const m = x.pathname.match(/\/(track|playlist|album|episode|show)\/(\w+)/); if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}`; }
    } catch {}
    return '';
  }
  async function loadMusic() {
    const { songs } = await api('music');
    const ul = $('songList'); ul.replaceChildren();
    if (!songs.length) ul.append(el('li', { class: 'empty-s' }, 'עדיין אין שירים. הוסיפי את הראשון.'));
    for (const m of songs) {
      const src = embedUrl(m.url);
      const holder = el('div', { class: 'player' });
      ul.append(el('li', { class: 'card col' },
        el('p', { class: 'ev-t' }, m.title),
        el('p', { class: 'ev-s' }, 'הוסיפה: ' + m.by + (m.approved ? '' : ' · ממתין לאישור')),
        el('div', { class: 'ev-a' },
          src ? el('button', { class: 'btn line small', onclick: (e) => { if (holder.firstChild) { holder.replaceChildren(); e.currentTarget.textContent = 'ניגון'; } else { holder.append(el('iframe', { src, allow: 'autoplay; encrypted-media', loading: 'lazy', title: m.title, height: m.url.includes('spotify') ? '152' : '220' })); e.currentTarget.textContent = 'סגירה'; } } }, 'ניגון')
              : el('a', { class: 'btn line small', href: m.url, target: '_blank', rel: 'noopener noreferrer' }, 'פתיחת הקישור'),
          !m.approved && can('helper') ? el('button', { class: 'btn solid small', onclick: async () => { await post(`music/${m.id}/approve`, {}); loadMusic(); } }, 'אישור') : null,
          can('helper') || m.mine ? el('button', { class: 'link', onclick: async () => { await api('music/' + m.id, { method: 'DELETE' }); loadMusic(); } }, 'מחיקה') : null),
        holder));
    }
  }
  $('addSong').onclick = () => formSheet({
    title: 'הוספת שיר',
    fields: [{ name: 'title', label: 'שם השיר או הרשימה', required: true, max: 80 }, { name: 'url', label: 'קישור (YouTube או Spotify)', type: 'url', required: true, max: 400, placeholder: 'https://…' }],
    onSubmit: async (v) => { const r = await post('music', v); toast(r.approved ? 'השיר נוסף' : 'נשלח לאישור'); loadMusic(); },
  });

  window.App.load = { cal: loadCal, trips: loadTrips, music: loadMusic };
  window.App.onSettings = () => { if (S.sec === 'cal') loadShabbat(); };
})();
