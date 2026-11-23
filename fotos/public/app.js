(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const RANK = { member: 1, helper: 2, admin: 3 };
  const ROLE_HE = { admin: 'אחראית', helper: 'עוזרת', member: 'חברה' };

  const S = { me: null, cats: [], suggestions: [], cat: '', items: [], cursor: null, queue: [], viewIdx: -1, uploading: false, pickCat: '', sec: 'home', sel: null, settings: { wa: '', city: 'jerusalem' } };
  const can = (role) => S.me && RANK[S.me.role] >= RANK[role];
  const catName = (id) => (S.cats.find((c) => c.id === id) || {}).name || '';

  // ---------- util ----------
  async function api(path, opts = {}) {
    const res = await fetch('/api/' + path, { credentials: 'same-origin', ...opts });
    if (res.status === 401 && !path.startsWith('login')) { showGate(); throw new Error('auth'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || 'error'); e.status = res.status; e.data = data; throw e; }
    return data;
  }
  const post = (p, body, method = 'POST') => api(p, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let toastT;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2800); }
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
    }
    n.append(...kids.filter((k) => k != null && k !== false)); return n;
  };
  const fmtDate = (ms) => new Date(ms).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

  // ---------- acceso ----------
  function showGate() { $('gate').hidden = false; setTimeout(() => $('gateInput').focus(), 50); }
  async function login(pin) {
    try { await post('login', { pin }); return true; } catch { return false; }
  }
  $('gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await login($('gateInput').value.trim());
    $('gateErr').hidden = ok;
    if (ok) { $('gateInput').value = ''; $('gate').hidden = true; boot(); }
  });
  $('logoutBtn').addEventListener('click', async () => { await post('logout', {}); location.reload(); });

  // ---------- inicio ----------
  async function init() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    // enlace personal: /?c=123456
    const params = new URLSearchParams(location.search);
    const code = params.get('c');
    if (code) {
      await login(code);
      history.replaceState(null, '', location.pathname + (params.get('share') ? '?share=' + params.get('share') : ''));
    }
    let me;
    try { me = await api('me'); } catch (e) {
      if (e.status === 503) { document.body.innerHTML = '<p style="padding:40px;text-align:center">האתר עדיין לא הוגדר: חסר ADMIN_PIN. ראו README.</p>'; return; }
      me = { authed: false };
    }
    if (!me.authed) return showGate();
    boot();
  }

  async function boot() {
    S.me = await api('me');
    $('adminBtn').hidden = S.me.role !== 'admin';
    $('settingsBtn').hidden = S.me.role !== 'admin';
    $('menuCats').hidden = !can('helper');
    $('catMgr').hidden = !can('helper');
    $('railAdminG').hidden = !can('helper');
    $('addPerson').hidden = !can('helper');
    $('selToggle').hidden = !can('helper');
    await loadSettings();
    await loadCats();
    paintAvatar();
    setSection('home');
    consumeShare();
  }

  // ---------- categorías ----------
  async function loadCats() {
    const d = await api('categories');
    S.cats = d.cats;
    S.suggestions = d.suggestions;
    renderTabs();
  }
  function renderTabs() {
    const tabs = $('tabs'); tabs.replaceChildren();
    const mk = (id, name) => el('button', { class: 'tab', role: 'tab', 'aria-selected': String(S.cat === id), onclick: () => { S.cat = id; renderTabs(); loadPhotos(true); } }, name);
    tabs.append(mk('', 'הכל'), ...S.cats.filter((c) => !c.hidden).map((c) => mk(c.id, c.name)));
    tabs.hidden = S.sec !== 'photos';
  }

  // ---------- fotos ----------
  async function loadPhotos(reset) {
    if (reset) { S.items = []; S.cursor = null; }
    const q = new URLSearchParams();
    if (S.cat) q.set('cat', S.cat);
    if (!reset && S.cursor) q.set('cursor', S.cursor);
    const d = await api('photos?' + q);
    S.items = S.items.concat(d.items); S.cursor = d.cursor;
    renderGrid();
  }
  function renderGrid() {
    const g = $('grid'); g.replaceChildren();
    S.items.forEach((it, i) => {
      const img = el('img', { src: '/api/img/thumb/' + it.name, loading: 'lazy', alt: '' });
      const on = S.sel && S.sel.has(it.name);
      g.append(el('button', { class: 'cell' + (on ? ' sel' : ''), 'aria-label': 'פתיחת תמונה', 'aria-pressed': S.sel ? String(!!on) : null, onclick: () => (S.sel ? toggleSel(it.name) : openViewer(i)) }, img));
    });
    $('empty').hidden = S.items.length > 0;
    updateSel();
    $('more').hidden = !S.cursor;
  }
  $('more').addEventListener('click', () => loadPhotos(false));

  // ---------- visor ----------
  function openViewer(i) {
    S.viewIdx = i; $('viewer').hidden = false; document.body.style.overflow = 'hidden'; showViewer();
  }
  function showViewer() {
    const it = S.items[S.viewIdx]; if (!it) return closeViewer();
    $('vImg').src = '/api/img/full/' + it.name;
    $('vBy').textContent = it.by ? 'הועלתה על ידי ' + it.by : '';
    $('vDate').textContent = fmtDate(it.date);
    const dl = $('vDl'); dl.href = '/api/img/full/' + it.name; dl.setAttribute('download', 'photo-' + it.name);
    const sel = $('vCat'); sel.replaceChildren(...S.cats.filter((c) => !c.hidden || c.id === it.cat).map((c) => el('option', { value: c.id }, c.name)));
    sel.value = it.cat; sel.hidden = !can('helper');
    const del = $('vDel'); del.hidden = !(can('helper') || it.mine);
    del.textContent = 'מחיקה'; del.classList.remove('armed');
  }
  function closeViewer() { $('viewer').hidden = true; $('vImg').src = ''; document.body.style.overflow = ''; }
  const step = (d) => { const n = S.viewIdx + d; if (n >= 0 && n < S.items.length) { S.viewIdx = n; showViewer(); } };
  $('vClose').onclick = closeViewer;
  $('vNext').onclick = () => step(1);   // RTL: "הבאה" בצד שמאל
  $('vPrev').onclick = () => step(-1);
  document.addEventListener('keydown', (e) => {
    if ($('viewer').hidden) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowLeft') step(1);
    if (e.key === 'ArrowRight') step(-1);
  });
  let tx = 0;
  $('viewer').addEventListener('touchstart', (e) => (tx = e.touches[0].clientX), { passive: true });
  $('viewer').addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1); });
  $('vCat').addEventListener('change', async (e) => {
    const it = S.items[S.viewIdx];
    try { await post('photos/' + it.name, { cat: e.target.value }, 'PATCH'); toast('התמונה הועברה ל' + catName(e.target.value)); it.cat = e.target.value; if (S.cat && S.cat !== it.cat) { S.items.splice(S.viewIdx, 1); renderGrid(); if (S.viewIdx >= S.items.length) S.viewIdx = S.items.length - 1; showViewer(); } } catch { toast('ההעברה נכשלה'); }
  });
  $('vDel').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'לחצי שוב למחיקה'; return; }
    const it = S.items[S.viewIdx];
    try { await api('photos/' + it.name, { method: 'DELETE' }); S.items.splice(S.viewIdx, 1); renderGrid(); toast('התמונה נמחקה'); if (S.viewIdx >= S.items.length) S.viewIdx = S.items.length - 1; showViewer(); } catch { toast('המחיקה נכשלה'); }
  });

  // ---------- העלאה ----------
  function openSheet() {
    $('sheet').hidden = false; document.body.style.overflow = 'hidden';
    S.pickCat = S.pickCat || (S.cat && S.cat !== 'pending' ? S.cat : '');
    renderPick(); updateQueue();
    $('catAdd').hidden = !can('helper'); $('catHint').hidden = can('helper');
  }
  function closeSheet() { if (S.uploading) return; $('sheet').hidden = true; document.body.style.overflow = ''; }
  function renderPick() {
    const box = $('catPick'); box.replaceChildren(...S.cats.filter((c) => c.id !== 'pending' && !c.hidden).map((c) => el('button', { class: 'opt', type: 'button', 'aria-pressed': String(S.pickCat === c.id), onclick: () => { S.pickCat = S.pickCat === c.id ? '' : c.id; renderPick(); updateQueue(); } }, c.name)));
    const sg = $('sugg'); sg.replaceChildren(...S.suggestions.slice(0, 6).map((s) => el('button', { class: 'opt', type: 'button', onclick: () => addCategory(s) }, '+ ' + s)));
  }
  async function addCategory(name) {
    name = name.trim(); if (!name) return;
    try { const c = await post('categories', { name }); await loadCats(); S.pickCat = c.id; $('newCat').value = ''; renderPick(); updateQueue(); } catch { toast('אי אפשר להוסיף קטגוריה'); }
  }
  $('fab').onclick = openSheet;
  $('sheetClose').onclick = closeSheet;
  $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });
  $('addCat').onclick = () => addCategory($('newCat').value);
  $('newCat').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(e.target.value); } });
  for (const id of ['fileGallery', 'fileCamera']) {
    $(id).addEventListener('change', (e) => { S.queue.push(...[...e.target.files].map((f) => ({ file: f, date: f.lastModified || Date.now() }))); e.target.value = ''; updateQueue(); });
  }
  function updateQueue() {
    const n = S.queue.length, info = $('queueInfo'), go = $('go');
    info.hidden = n === 0; go.hidden = n === 0;
    if (n) {
      info.textContent = S.pickCat ? `${n} תמונות מוכנות להעלאה אל "${catName(S.pickCat)}"` : `${n} תמונות מוכנות. בלי קטגוריה הן ימתינו לסידור`;
      go.disabled = S.uploading;
    }
  }

  async function toJpeg(file, max, quality) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { bmp = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); }); }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('encode'))), 'image/jpeg', quality));
  }
  async function uploadOne(item) {
    const [full, thumb] = await Promise.all([toJpeg(item.file, 2000, 0.85), toJpeg(item.file, 480, 0.8)]);
    const fd = new FormData();
    fd.append('file', full, 'p.jpg'); fd.append('thumb', thumb, 't.jpg'); fd.append('cat', S.pickCat || 'pending'); fd.append('date', String(item.date));
    const res = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
    if (!res.ok) throw new Error('upload');
  }
  $('go').addEventListener('click', async () => {
    if (S.uploading || !S.queue.length) return;
    S.uploading = true; $('go').disabled = true; $('prog').hidden = false;
    const total = S.queue.length; let done = 0, failed = [];
    const bar = $('prog').firstElementChild;
    const work = async () => {
      while (S.queue.length) {
        const it = S.queue.shift();
        try { await uploadOne(it); } catch { failed.push(it); }
        done++; bar.style.width = (done / total * 100) + '%';
        $('queueInfo').textContent = `מעלה… ${done} מתוך ${total}`;
      }
    };
    await Promise.all([work(), work()]);
    S.queue = failed; S.uploading = false; $('prog').hidden = true; bar.style.width = '0';
    toast(failed.length ? `${total - failed.length} הועלו, ${failed.length} נכשלו. אפשר לנסות שוב` : `${total} תמונות הועלו`);
    if (!failed.length) { $('sheet').hidden = true; document.body.style.overflow = ''; }
    updateQueue(); loadPhotos(true);
  });

  // תמונות שנשלחו מתפריט "שיתוף" (אנדרואיד)
  async function consumeShare() {
    const p = new URLSearchParams(location.search);
    if (!p.get('share')) return;
    history.replaceState(null, '', location.pathname);
    try {
      const cache = await caches.open('shared-photos');
      for (const req of await cache.keys()) {
        const r = await cache.match(req); const blob = await r.blob();
        S.queue.push({ file: blob, date: Number(r.headers.get('x-date')) || Date.now() });
        await cache.delete(req);
      }
    } catch {}
    if (S.queue.length) openSheet();
  }

  // ---------- ניהול גישה ----------
  async function openAdmin() { $('admin').hidden = false; document.body.style.overflow = 'hidden'; renderCodes(); }
  function closeAdmin() { $('admin').hidden = true; document.body.style.overflow = ''; }
  async function copy(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg); } catch { toast(text); }
  }
  async function renderCodes() {
    const { codes } = await api('codes');
    const ul = $('codeList'); ul.replaceChildren();
    if (!codes.length) ul.append(el('li', { class: 'hint' }, 'עדיין לא נוצרו קודים. הוסיפי את החברה הראשונה למעלה.'));
    for (const c of codes) {
      const link = location.origin + '/?c=' + c.code;
      ul.append(el('li', { class: 'code' },
        el('b', {}, c.label + ' · ' + ROLE_HE[c.role]),
        el('span', { class: 'num' }, c.code),
        el('div', { class: 'acts' },
          el('button', { class: 'link', onclick: () => copy(link, 'הקישור הועתק') }, 'העתקת קישור'),
          el('button', { class: 'link', onclick: () => copy(c.code, 'הקוד הועתק') }, 'העתקת קוד'),
          el('button', { class: 'link', onclick: async () => { await api('codes/' + c.id, { method: 'DELETE' }); toast('הגישה בוטלה'); renderCodes(); } }, 'ביטול גישה'))));
    }
  }
  $('adminBtn').onclick = openAdmin;
  $('adminClose').onclick = closeAdmin;
  $('admin').addEventListener('click', (e) => { if (e.target === $('admin')) closeAdmin(); });
  $('codeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await post('codes', { label: $('codeLabel').value, role: $('codeRole').value }); $('codeLabel').value = ''; renderCodes(); } catch { toast('יצירת הקוד נכשלה'); }
  });

  // ---------- ajustes y WhatsApp ----------
  async function loadSettings() {
    try { S.settings = await api('settings'); } catch {}
    const a = $('waBtn');
    a.hidden = !S.settings.wa;
    if (S.settings.wa) a.href = S.settings.wa;
  }
  $('settingsBtn').onclick = () => formSheet({
    title: 'הגדרות',
    fields: [
      { name: 'wa', label: 'קישור להזמנה לקבוצת הוואטסאפ', type: 'url', value: S.settings.wa, placeholder: 'https://chat.whatsapp.com/…' },
      { name: 'city', label: 'עיר (לזמני הדלקת נרות)', type: 'select', value: S.settings.city, options: Object.entries(window.CITIES || {}).map(([k, v]) => [k, v.name]) },
      { name: 'moderate', label: 'פרסומים של חברות מופיעים רק אחרי אישור', type: 'checkbox', value: S.settings.moderate },
    ],
    onSubmit: async (v) => { S.settings = await post('settings', { wa: v.wa, city: v.city, moderate: v.moderate }, 'PUT'); await loadSettings(); toast('ההגדרות נשמרו'); if (App.onSettings) App.onSettings(); },
  });

  // ---------- בחירה מרובה (עוזרות ואחראית) ----------
  function toggleSel(name) { S.sel.has(name) ? S.sel.delete(name) : S.sel.add(name); renderGrid(); }
  function updateSel() {
    const on = !!S.sel;
    $('selBar').hidden = !on; $('selToggle').hidden = on || !can('helper') || S.sec !== 'photos';
    if (on) $('selCount').textContent = S.sel.size ? `נבחרו ${S.sel.size}` : 'בחרי תמונות';
    $('selGo').disabled = !S.sel || !S.sel.size;
  }
  $('selToggle').onclick = () => {
    S.sel = new Set();
    $('selCat').replaceChildren(...S.cats.filter((c) => !c.hidden).map((c) => el('option', { value: c.id }, c.name)));
    renderGrid();
  };
  $('selCancel').onclick = () => { S.sel = null; renderGrid(); };
  $('selGo').onclick = async () => {
    const cat = $('selCat').value, names = [...S.sel];
    $('selGo').disabled = true;
    let ok = 0;
    for (const n of names) { try { await post('photos/' + n, { cat }, 'PATCH'); ok++; } catch {} }
    toast(`${ok} תמונות הועברו אל "${catName(cat)}"`);
    S.sel = null; loadPhotos(true);
  };

  // ---------- טופס כללי ----------
  function openOv(id) { $(id).hidden = false; document.body.style.overflow = 'hidden'; }
  function closeOv(id) { $(id).hidden = true; if (!document.querySelector('.overlay:not([hidden])')) document.body.style.overflow = ''; }
  let formHandler = null;
  function formSheet({ title, fields, onSubmit, submit = 'שמירה', top }) {
    $('formT').textContent = title; $('formSubmit').textContent = submit; $('formErr').hidden = true;
    const body = $('formBody'); body.replaceChildren();
    if (top) body.append(top);
    for (const f of fields) {
      if (f.type === 'checkbox') {
        const cb = el('input', { id: 'f_' + f.name, type: 'checkbox' }); cb.checked = !!f.value;
        body.append(el('label', { class: 'chk', for: 'f_' + f.name }, cb, el('span', {}, f.label)));
        continue;
      }
      const id = 'f_' + f.name;
      let input;
      if (f.type === 'textarea') input = el('textarea', { id, rows: f.rows || 3, maxlength: f.max || 400 });
      else if (f.type === 'select') { input = el('select', { id }); for (const [v, l] of f.options) input.append(el('option', { value: v }, l)); }
      else input = el('input', { id, type: f.type || 'text', maxlength: f.max || 120 });
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.required = true;
      if (f.type === 'number') { input.min = '0'; input.step = '0.5'; input.inputMode = 'decimal'; }
      if (f.type === 'url') input.dir = 'ltr';
      input.value = f.value ?? '';
      body.append(el('label', { class: 'fld', for: id }, el('span', { class: 'lbl' }, f.label), input));
    }
    formHandler = async () => {
      const v = {}; for (const f of fields) { const n = $('f_' + f.name); v[f.name] = f.type === 'checkbox' ? n.checked : n.value; }
      try { await onSubmit(v); closeOv('form'); } catch (e) { const er = $('formErr'); er.textContent = 'לא הצלחנו לשמור. בדקי את הפרטים ונסי שוב.'; er.hidden = false; }
    };
    openOv('form');
    setTimeout(() => body.querySelector('input,textarea,select')?.focus(), 50);
  }
  $('formEl').addEventListener('submit', (e) => { e.preventDefault(); formHandler && formHandler(); });
  $('formClose').onclick = () => closeOv('form');
  $('form').addEventListener('click', (e) => { if (e.target === $('form')) closeOv('form'); });

  // ---------- אזורים ----------
  const SECTIONS = ['home', 'photos', 'cal', 'news', 'trips', 'music', 'people'];
  const TITLES = { home: 'בית', photos: 'תמונות', cal: 'לוח שנה', news: 'מה חדש', trips: 'טיולים', music: 'מוזיקה', people: 'חברות' };
  function setSection(name) {
    S.sec = name; collapseRail();
    for (const s of SECTIONS) $('sec-' + s).hidden = s !== name;
    document.querySelectorAll('#rail [data-go]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.go === name)));
    $('pageTitle').textContent = TITLES[name];
    $('tabs').hidden = name !== 'photos';
    document.querySelector('.dock').hidden = name !== 'photos';
    updateSel();
    window.scrollTo(0, 0);
    if (name === 'photos') loadPhotos(true);
    else if (App.load && App.load[name]) App.load[name]();
  }
  // panel lateral con íconos: se despliega al tocarlo
  function collapseRail() { $('rail').classList.remove('open'); $('railShade').hidden = true; $('railToggle').setAttribute('aria-expanded', 'false'); }
  function toggleRail() { const o = $('rail').classList.toggle('open'); $('railShade').hidden = !o; $('railToggle').setAttribute('aria-expanded', String(o)); }
  $('railToggle').onclick = toggleRail;
  $('railShade').onclick = collapseRail;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') collapseRail(); });
  document.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) setSection(g.dataset.go); });
  $('menuCats').onclick = () => { collapseRail(); App.openCats && App.openCats(); };
  $('catMgr').onclick = () => App.openCats && App.openCats();
  $('settingsBtn').addEventListener('click', collapseRail);
  $('adminBtn').addEventListener('click', collapseRail);
  $('logoutBtn').addEventListener('click', collapseRail);
  $('meBtn').onclick = () => App.openProfile && App.openProfile('me');

  // avatar
  function avatar(cls, id, name, photo) {
    const d = el('div', { class: 'avatar ' + (cls || '') });
    if (photo) d.append(el('img', { src: `/api/img/profile/${id}?v=${photo}`, alt: '' })); else d.textContent = (name || '?').trim().charAt(0);
    return d;
  }
  function paintAvatar() { const b = $('meBtn'); b.replaceChildren(); b.textContent = (S.me.label || '?').trim().charAt(0); if (S.me.photo) { b.textContent = ''; b.append(el('img', { src: `/api/img/profile/${S.me.id}?v=${S.me.photo}`, alt: '' })); } }

  // ---------- מראה (בהיר / כהה / אוטומטי) ----------
  const THEMES = { light: 'מראה: בהיר', dark: 'מראה: כהה', auto: 'מראה: לפי הטלפון' };
  const getTheme = () => { try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; } };
  function applyTheme(t) {
    try { localStorage.setItem('theme', t); } catch {}
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name=theme-color]').setAttribute('content', dark ? '#160e12' : '#fff5f8');
    document.querySelector('meta[name=color-scheme]').setAttribute('content', t === 'dark' ? 'dark' : t === 'auto' ? 'light dark' : 'only light');
    $('themeBtn').querySelector('.lab').textContent = THEMES[t];
  }
  $('themeBtn').onclick = () => applyTheme({ light: 'dark', dark: 'auto', auto: 'light' }[getTheme()]);
  applyTheme(getTheme());
  const BUILD = 'גרסה 7';
  $('ver').textContent = BUILD + ' · הטלפון במצב ' + (matchMedia('(prefers-color-scheme: dark)').matches ? 'כהה' : 'בהיר');

  // ---------- התקנה כאפליקציה ----------
  let deferredInstall = null;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function renderInstall() {
    const b = $('install'); b.replaceChildren();
    let dismissed = false; try { dismissed = localStorage.getItem('noinstall') === '1'; } catch {}
    if (isStandalone() || dismissed) { b.hidden = true; return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    b.append(el('div', { class: 'in-t' }, el('b', {}, 'להתקין כאפליקציה'),
      el('span', {}, ios ? 'בספארי: לחצי על כפתור השיתוף ואז "הוספה למסך הבית". האלבום ייפתח במסך מלא, כמו אפליקציה.' : deferredInstall ? 'האלבום ייפתח במסך מלא, בלי דפדפן, ויהיה זמין גם בתפריט השיתוף.' : 'בתפריט של כרום (⋮) בחרי "הוספה למסך הבית" או "התקנת אפליקציה".')),
      el('div', { class: 'in-a' },
        deferredInstall ? el('button', { class: 'btn solid small', onclick: async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; renderInstall(); } }, 'התקנה') : null,
        el('button', { class: 'link', onclick: () => { try { localStorage.setItem('noinstall', '1'); } catch {} b.hidden = true; } }, 'לא עכשיו')));
    b.hidden = false;
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; renderInstall(); });
  window.addEventListener('appinstalled', () => { $('install').hidden = true; toast('האפליקציה הותקנה'); });
  renderInstall();

  const App = { S, api, post, el, toast, can, fmtDate, formSheet, openOv, closeOv, catName, setSection, avatar, paintAvatar, loadCats, renderTabs, renderPick, load: {} };
  window.App = App;

  init();
})();
