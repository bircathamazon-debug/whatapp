(() => {
  'use strict';
  const App = window.App;
  const { S, api, post, el, toast, can, formSheet, openOv, closeOv, avatar } = App;
  const U = App.util;
  const $ = (id) => document.getElementById(id);

  // reduce una imagen en el teléfono (opcionalmente recortada en cuadrado)
  async function resize(file, max, square) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
    if (!bmp) throw new Error('img');
    let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
    if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
    const k = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('enc'))), 'image/jpeg', 0.85));
  }
  async function sendFile(path, blob) {
    const fd = new FormData(); fd.append('file', blob, 'p.jpg');
    const r = await fetch('/api/' + path, { method: 'POST', body: fd, credentials: 'same-origin' });
    if (!r.ok) throw new Error('upload');
    return r.json();
  }
  const ago = (ms) => {
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return 'עכשיו'; if (m < 60) return `לפני ${m} דק׳`;
    const h = Math.round(m / 60); if (h < 24) return `לפני ${h} שע׳`;
    const d = Math.round(h / 24); return d < 8 ? `לפני ${d} ימים` : new Date(ms).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  };

  // ======================= בית (דשבורד) =======================
  function renderHero() {
    const h = $('hero'); h.replaceChildren();
    const gp = S.settings.gp;
    if (gp) h.append(el('img', { src: `/api/img/group?v=${gp}`, alt: 'תמונת הקבוצה' }));
    else h.classList.add('empty-hero');
    h.classList.toggle('empty-hero', !gp);
    h.append(el('div', { class: 'hero-t' }, el('b', {}, 'התמונות שלנו'), el('span', {}, gp ? 'הקבוצה שלנו' : (can('helper') ? 'הוסיפו תמונת קבוצה' : 'האלבום של הקבוצה'))));
    if (can('helper')) {
      const inp = el('input', { type: 'file', accept: 'image/*', hidden: '' });
      inp.addEventListener('change', async () => {
        if (!inp.files[0]) return;
        try { const r = await sendFile('group-photo', await resize(inp.files[0], 1600, false)); S.settings.gp = r.gp; renderHero(); toast('תמונת הקבוצה עודכנה'); }
        catch { toast('ההחלפה נכשלה'); }
      });
      h.append(el('label', { class: 'hero-edit' }, gp ? 'החלפת תמונה' : 'הוספת תמונה', inp));
    }
  }

  async function loadHome() {
    renderHero();
    const t = U.today0();
    $('greet').textContent = '';
    $('greet').append(el('b', {}, 'שלום, ' + S.me.label), el('span', {}, [U.civil(t), U.hebrew(t)].filter(Boolean).join(' · ')));
    U.loadShabbat('homeShabbat');

    const [ev, posts, photos, trips] = await Promise.all([api('events'), api('posts'), api('photos'), api('trips')]);
    const staff = can('helper');

    // התראות לצוות
    const attn = $('attn'); attn.replaceChildren();
    if (staff) {
      const [pend, songs] = await Promise.all([api('photos?cat=pending'), api('music')]);
      const unpaid = trips.trips.reduce((a, tr) => a + (tr.totals ? tr.totals.pending : 0), 0);
      const hold = posts.posts.filter((p) => !p.approved).length;
      const chips = [
        pend.items.length && [`${pend.items.length} תמונות ממתינות לסידור`, () => { S.cat = 'pending'; App.renderTabs(); App.setSection('photos'); }],
        songs.songs.filter((m) => !m.approved).length && [`${songs.songs.filter((m) => !m.approved).length} שירים לאישור`, () => App.setSection('music')],
        hold && [`${hold} פרסומים לאישור`, () => App.setSection('news')],
        unpaid && [`חסרים ${U.ils(unpaid)} בתשלומי טיולים`, () => App.setSection('trips')],
      ].filter(Boolean);
      for (const [txt, fn] of chips) attn.append(el('button', { class: 'chip warn', onclick: fn }, txt));
    }
    attn.hidden = !attn.children.length;

    // טבלת אירועים
    const items = ev.events.map((e) => ({ e, when: U.nextDate(e) })).filter((x) => x.when >= t).sort((a, b) => a.when - b.when).slice(0, 5);
    const ul = $('homeEvents'); ul.replaceChildren();
    if (!items.length) ul.append(el('li', { class: 'empty-s' }, 'אין אירועים קרובים'));
    for (const { e, when } of items) {
      const days = Math.round((when - t) / 864e5);
      ul.append(el('li', { class: 'trow' },
        el('div', { class: 'td date' }, el('b', {}, String(when.getDate())), el('span', {}, U.fmt(when, { month: 'short' }))),
        el('div', { class: 'td main' }, el('b', {}, (e.type === 'birthday' ? 'יום הולדת: ' : '') + e.title), el('span', {}, [days === 0 ? 'היום' : days === 1 ? 'מחר' : `בעוד ${days} ימים`, U.hebrew(when), e.time, e.place].filter(Boolean).join(' · '))),
        e.type === 'event' ? el('button', { class: 'opt', 'aria-pressed': String(e.mine), onclick: async () => { await post(`events/${e.id}/rsvp`, { going: !e.mine }); loadHome(); } }, e.mine ? 'באה ✓' : 'אני באה') : null));
    }

    // פרסומים
    const hp = $('homePosts'); hp.replaceChildren();
    const latest = posts.posts.filter((p) => p.approved).slice(0, 3);
    if (!latest.length) hp.append(el('p', { class: 'empty-s tc' }, 'עדיין אין פרסומים. אפשר לפרסם את הראשון.'));
    for (const p of latest) hp.append(postCard(p, { compact: true }));
    hp.append(el('button', { class: 'btn line wide', onclick: () => newPost() }, 'פרסום חדש'));

    // תמונות אחרונות
    const st = $('homePhotos'); st.replaceChildren();
    const shots = photos.items.filter((i) => i.cat !== 'pending').slice(0, 12);
    if (!shots.length) st.append(el('p', { class: 'empty-s tc' }, 'עדיין אין תמונות באלבום'));
    for (const it of shots) st.append(el('button', { class: 'shot', 'aria-label': 'לתמונות', onclick: () => { S.cat = ''; App.renderTabs(); App.setSection('photos'); } }, el('img', { src: '/api/img/thumb/' + it.name, loading: 'lazy', alt: '' })));

    // הטיול הבא
    const tr = trips.trips[0];
    $('homeTripBlk').hidden = !tr;
    if (tr) {
      const miss = tr.items.filter((i) => !i.by).length;
      $('homeTrip').replaceChildren(el('div', { class: 'card tap', tabindex: '0', onclick: () => App.setSection('trips') },
        el('div', { class: 'ev-main' },
          el('p', { class: 'ev-t' }, tr.name),
          el('p', { class: 'ev-s' }, [tr.place, tr.from && U.fmt(U.parseDay(tr.from), { day: 'numeric', month: 'long' })].filter(Boolean).join(' · ')),
          el('div', { class: 'ev-a' },
            el('span', { class: 'pill' }, `${tr.people.length} נוסעות`),
            tr.going ? el('span', { class: 'pill ok' }, 'את רשומה') : el('span', { class: 'pill warn' }, 'עוד לא נרשמת'),
            miss ? el('span', { class: 'pill warn' }, `חסר מי שיביא: ${miss}`) : null,
            tr.going && tr.myDue > 0 ? el('span', { class: 'pill warn' }, `נשאר לשלם ${U.ils(tr.myDue)}`) : null))));
    }
  }

  // ======================= מה חדש =======================
  function postCard(p, { compact } = {}) {
    const card = el('article', { class: 'post' + (p.pinned ? ' pinned' : '') });
    card.append(el('header', { class: 'post-h' }, avatar('sm', p.byId, p.by, 0),
      el('div', {}, el('b', {}, p.by), el('span', {}, ago(p.created) + (p.pinned ? ' · מוצמד' : '') + (p.approved ? '' : ' · ממתין לאישור')))));
    card.append(el('p', { class: 'post-t' }, p.text));
    const reload = () => (S.sec === 'home' ? loadHome() : loadNews());
    const rx = el('div', { class: 'rx' });
    for (const emo of ['👍', '❤️', '😂', '🙏']) {
      const r = p.reactions[emo] || { n: 0, me: false };
      rx.append(el('button', { class: 'opt', 'aria-pressed': String(r.me), 'aria-label': emo, onclick: async () => { await post(`posts/${p.id}/react`, { emoji: emo }); reload(); } }, emo + (r.n ? ' ' + r.n : '')));
    }
    card.append(rx);
    if (!compact) {
      const box = el('div', { class: 'comments' });
      for (const c of p.comments) box.append(el('p', { class: 'cmt' }, el('b', {}, c.by + ': '), c.text,
        c.canDelete ? el('button', { class: 'link', 'aria-label': 'מחיקת תגובה', onclick: async () => { await api(`posts/${p.id}/comment/${c.id}`, { method: 'DELETE' }); reload(); } }, '✕') : null));
      const inp = el('input', { type: 'text', maxlength: '300', placeholder: 'כתבי תגובה…', 'aria-label': 'תגובה' });
      const send = async () => { if (inp.value.trim()) { await post(`posts/${p.id}/comment`, { text: inp.value }); reload(); } };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
      box.append(el('div', { class: 'row' }, inp, el('button', { class: 'btn line small', onclick: send }, 'שליחה')));
      card.append(box);
      const acts = el('div', { class: 'ev-a' });
      if (can('helper')) acts.append(el('button', { class: 'link', onclick: async () => { await post(`posts/${p.id}/pin`, {}); reload(); } }, p.pinned ? 'ביטול הצמדה' : 'הצמדה'));
      if (can('helper') && !p.approved) acts.append(el('button', { class: 'btn solid small', onclick: async () => { await post(`posts/${p.id}/approve`, {}); reload(); } }, 'אישור'));
      if (can('helper') || p.mine) acts.append(el('button', { class: 'link', onclick: async (e) => { const b = e.currentTarget; if (b.dataset.arm) { await api('posts/' + p.id, { method: 'DELETE' }); reload(); } else { b.dataset.arm = 1; b.textContent = 'לחצי שוב למחיקה'; } } }, 'מחיקה'));
      card.append(acts);
    }
    return card;
  }
  function newPost() {
    formSheet({
      title: 'פרסום חדש', submit: 'פרסום',
      fields: [{ name: 'text', label: 'מה רוצות לשתף?', type: 'textarea', rows: 4, max: 600, required: true, placeholder: 'מזל טוב, הודעה, תודה, שאלה…' }],
      onSubmit: async (v) => { const r = await post('posts', { text: v.text }); toast(r.approved ? 'פורסם' : 'נשלח לאישור'); S.sec === 'home' ? loadHome() : loadNews(); },
    });
  }
  async function loadNews() {
    const { posts } = await api('posts');
    const box = $('postList'); box.replaceChildren();
    if (!posts.length) box.append(el('p', { class: 'empty-s tc' }, 'עדיין אין פרסומים. אפשר לפרסם את הראשון.'));
    for (const p of posts) box.append(postCard(p));
  }
  $('addPost').onclick = newPost;

  // ======================= חברות (CRM) =======================
  let people = [];
  async function loadPeople() {
    ({ people } = await api('profiles'));
    const me = people.find((p) => p.mine); if (me) { S.me.photo = me.photo; App.paintAvatar(); }
    renderPeople();
  }
  function renderPeople() {
    const q = $('peopleSearch').value.trim();
    const box = $('peopleList'); box.replaceChildren();
    for (const p of people.filter((x) => !q || x.name.includes(q))) {
      const bday = p.birthday ? U.fmt(U.parseDay(p.birthday), { day: 'numeric', month: 'long' }) : '';
      const lines = [p.phone && ['טלפון', p.phone], p.address && ['כתובת', p.address], bday && ['יום הולדת', bday + (U.hebrew(U.parseDay(p.birthday)) ? ' · ' + U.hebrew(U.nextDate({ date: p.birthday, type: 'birthday' })) : '')]].filter(Boolean);
      const card = el('div', { class: 'person' + (p.mine || can('helper') ? ' tap' : ''), tabindex: p.mine || can('helper') ? '0' : null, onclick: () => (p.mine || can('helper')) && openProfile(p.id, p) },
        avatar('md', p.id, p.name, p.photo),
        el('div', { class: 'pmain' }, el('b', {}, p.name + (p.mine ? ' (את)' : '')),
          el('span', { class: 'pill' + (p.role === 'contact' ? ' warn' : '') }, p.role === 'admin' ? 'אחראית' : p.role === 'helper' ? 'עוזרת' : p.role === 'contact' ? 'ללא קוד גישה' : 'חברה'),
          ...lines.map(([k, v]) => el('span', { class: 'pl' }, el('i', {}, k), v)),
          can('helper') && (p.emergency || p.allergies || p.parents) ? el('span', { class: 'pl priv' }, el('i', {}, 'לצוות בלבד'), [p.parents && 'הורים: ' + p.parents, p.emergency && 'חירום: ' + p.emergency, p.allergies && 'אלרגיות: ' + p.allergies].filter(Boolean).join(' · ')) : null));
      box.append(card);
    }
    if (!box.children.length) box.append(el('p', { class: 'empty-s tc' }, 'לא נמצאו חברות'));
  }
  $('peopleSearch').addEventListener('input', renderPeople);

  let profTarget = 'me', profData = null;
  function openProfile(id, data) {
    profTarget = id; 
    const go = (d) => {
      profData = d; const mine = d.mine;
      $('profT').textContent = mine ? 'הפרופיל שלי' : d.name;
      const av = $('profAvatar'); av.replaceChildren(); av.className = 'avatar big';
      if (d.photo) av.append(el('img', { src: `/api/img/profile/${d.id}?v=${d.photo}`, alt: '' })); else av.textContent = d.name.charAt(0);
      const F = (name, label, o = {}) => el('label', { class: 'fld', for: 'p_' + name }, el('span', { class: 'lbl' }, label), el('input', { id: 'p_' + name, type: o.type || 'text', maxlength: '120', value: d[name] || '', dir: o.dir || null, placeholder: o.ph || null }));
      const C = (name, label, on) => { const cb = el('input', { id: 'p_' + name, type: 'checkbox' }); cb.checked = on; return el('label', { class: 'chk', for: 'p_' + name }, cb, el('span', {}, label)); };
      const f = $('profFields'); f.replaceChildren(
        ...(d.role === 'contact' && can('helper') ? [F('name', 'שם')] : []),
        F('phone', 'טלפון', { type: 'tel', dir: 'ltr' }), F('address', 'כתובת'), F('birthday', 'תאריך יום הולדת', { type: 'date' }),
        el('p', { class: 'hint' }, 'מה החברות האחרות רואות?'),
        C('showBirthday', 'להראות את יום ההולדת (ויופיע בלוח השנה)', d.show ? d.show.birthday : true), C('showPhone', 'להראות את הטלפון', d.show && d.show.phone), C('showAddress', 'להראות את הכתובת', d.show && d.show.address),
        el('p', { class: 'hint' }, 'פרטים אלה גלויים רק לך ולאחראית ולעוזרות:'),
        F('parents', 'שם ההורים'), F('emergency', 'איש קשר לחירום'), F('allergies', 'אלרגיות / בריאות'));
      $('profErr').hidden = true; renderProfStaff(d); openOv('prof');
    };
    if (data) go(data); else api('profiles').then(({ people: ps }) => go(ps.find((p) => p.mine)));
  }

  // acciones del equipo sobre una ficha: crear código de acceso o quitar a una amiga que aún no tiene
  function renderProfStaff(d) {
    const box = $('profStaff'); box.replaceChildren();
    box.hidden = !(can('helper') && !d.mine);
    if (box.hidden) return;
    if (d.role !== 'contact') { box.append(el('p', { class: 'hint' }, 'לחברה הזו יש קוד גישה. אפשר לנהל אותו ב"ניהול גישה".')); return; }
    box.append(el('p', { class: 'hint' }, 'אפשר להשאיר אותה רק ברשימה, או לתת לה קוד כדי שתיכנס לאלבום.'));
    const role = el('select', { id: 'accRole', 'aria-label': 'סוג גישה' }, el('option', { value: 'member' }, 'חברה'), el('option', { value: 'helper' }, 'עוזרת'));
    box.append(el('div', { class: 'row' }, role, el('button', { type: 'button', class: 'btn line small', onclick: async () => {
      try {
        const r = await post(`profiles/${d.id}/access`, { role: role.value });
        const link = location.origin + '/?c=' + r.code;
        box.replaceChildren(el('p', { class: 'hint' }, 'הקוד של ' + d.name + ':'), el('p', { class: 'bigcode' }, r.code),
          el('div', { class: 'ev-a' }, el('button', { type: 'button', class: 'btn solid small', onclick: async () => { try { await navigator.clipboard.writeText(link); toast('הקישור הועתק'); } catch { toast(link); } } }, 'העתקת קישור'),
            el('button', { type: 'button', class: 'link', onclick: () => { closeOv('prof'); loadPeople(); } }, 'סיום')));
        loadPeople();
      } catch { toast('יצירת הקוד נכשלה'); }
    } }, 'יצירת קוד גישה')));
    box.append(el('button', { type: 'button', class: 'link red', onclick: async (e) => {
      const b = e.currentTarget;
      if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'לחצי שוב כדי להסיר מהרשימה'; return; }
      try { await api('profiles/' + d.id, { method: 'DELETE' }); closeOv('prof'); toast('הוסרה מהרשימה'); loadPeople(); } catch { toast('המחיקה נכשלה'); }
    } }, 'הסרה מהרשימה'));
  }
  $('addPerson').onclick = () => formSheet({
    title: 'הוספת חברות', submit: 'הוספה',
    fields: [{ name: 'names', label: 'שם בכל שורה', type: 'textarea', rows: 6, max: 2000, required: true, placeholder: 'שרה כהן\nרחל לוי\nדינה מזרחי' }],
    onSubmit: async (v) => {
      const names = v.names.split('\n').map((x) => x.trim()).filter(Boolean);
      const r = await post('profiles', { names }); toast(`נוספו ${r.added.length} חברות`); await loadPeople();
      if (r.added.length === 1) { const p = people.find((x) => x.id === r.added[0].id); if (p) openProfile(p.id, p); }
    },
  });
  $('profClose').onclick = () => closeOv('prof');
  $('prof').addEventListener('click', (e) => { if (e.target === $('prof')) closeOv('prof'); });
  $('profPhoto').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const r = await sendFile(`profiles/${profData.mine ? 'me' : profData.id}/photo`, await resize(f, 512, true));
      profData.photo = r.photo; if (profData.mine) { S.me.photo = r.photo; App.paintAvatar(); }
      const av = $('profAvatar'); av.replaceChildren(el('img', { src: `/api/img/profile/${profData.id}?v=${r.photo}`, alt: '' }));
      toast('התמונה עודכנה'); if (S.sec === 'people') loadPeople();
    } catch { toast('העלאת התמונה נכשלה'); }
    e.target.value = '';
  });
  $('profForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (n) => $('p_' + n).value, c = (n) => $('p_' + n).checked;
    try {
      await post(`profiles/${profData.mine ? 'me' : profData.id}`, { name: profData.role === 'contact' && can('helper') ? v('name') : undefined, phone: v('phone'), address: v('address'), birthday: v('birthday'), parents: v('parents'), emergency: v('emergency'), allergies: v('allergies'), showPhone: c('showPhone'), showAddress: c('showAddress'), showBirthday: c('showBirthday') }, 'PUT');
      closeOv('prof'); toast('נשמר'); if (S.sec === 'people') loadPeople();
    } catch { const er = $('profErr'); er.textContent = 'לא הצלחנו לשמור. בדקי את הפרטים.'; er.hidden = false; }
  });

  // ======================= ניהול קטגוריות =======================
  async function renderCatMgr() {
    await App.loadCats();
    const ul = $('catList'); ul.replaceChildren();
    const cats = S.cats.filter((c) => !c.system);
    const save = async (fn) => { try { await fn(); } catch { toast('הפעולה נכשלה'); } await renderCatMgr(); };
    const move = (i, d) => save(() => { const ids = cats.map((c) => c.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; return post('categories/order', { order: ids }, 'PUT'); });
    cats.forEach((c, i) => {
      const name = el('input', { type: 'text', value: c.name, maxlength: '30', 'aria-label': 'שם הקטגוריה' });
      name.addEventListener('change', () => name.value.trim() && save(() => post('categories/' + c.id, { name: name.value }, 'PATCH')));
      const li = el('li', { class: c.hidden ? 'off' : '' }, name,
        el('button', { class: 'ic', disabled: i === 0 ? '' : null, 'aria-label': 'למעלה', onclick: () => move(i, -1) }, '↑'),
        el('button', { class: 'ic', disabled: i === cats.length - 1 ? '' : null, 'aria-label': 'למטה', onclick: () => move(i, 1) }, '↓'),
        el('button', { class: 'link', onclick: () => save(() => post('categories/' + c.id, { hidden: !c.hidden }, 'PATCH')) }, c.hidden ? 'הצגה' : 'הסתרה'),
        c.fixed ? null : el('button', { class: 'link red', onclick: (e) => { const b = e.currentTarget; if (b.dataset.arm) save(() => api('categories/' + c.id, { method: 'DELETE' })); else { b.dataset.arm = 1; b.textContent = 'בטוחה?'; } } }, 'מחיקה'));
      ul.append(li);
    });
    App.renderTabs();
  }
  App.openCats = () => { openOv('cats'); renderCatMgr(); };
  $('catsClose').onclick = () => { closeOv('cats'); App.loadCats(); };
  $('cats').addEventListener('click', (e) => { if (e.target === $('cats')) { closeOv('cats'); App.loadCats(); } });
  $('catNewBtn').onclick = async () => { const v = $('catNew').value.trim(); if (!v) return; try { await post('categories', { name: v }); $('catNew').value = ''; renderCatMgr(); } catch { toast('אי אפשר להוסיף'); } };
  $('catNew').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('catNewBtn').click(); } });

  App.openProfile = openProfile;
  Object.assign(App.load, { home: loadHome, news: loadNews, people: loadPeople });
})();
