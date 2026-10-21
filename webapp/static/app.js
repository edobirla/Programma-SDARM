/* Pannello di controllo — Gestione programma SDARM 2.0
   Stato in S, render per zona (header fisso, main per vista, dock in onda),
   azioni con data-a="nome" smistate da un solo listener. */
'use strict';

/* /m = telefono: stessa app, impaginazione da telefono; audio, timer e
   campanello suonano sempre dal Mac (RA = lettori "a distanza") */
const REMOTE = location.pathname === '/m' || window.CLOUD;
const xfetch = (u, o) => (window.CLOUD ? window.cloudFetch(u, o) : fetch(u, o));   // con i dati: attraverso Firebase
const RA = {};
const $ = (s, r = document) => (REMOTE && RA[s]) || r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HDR = () => ({ 'Content-Type': 'application/json', 'X-Client': CLIENT });
const api = {
  get: (u) => xfetch(u).then((r) => r.json()),
  put: (u, b) => xfetch(u, { method: 'PUT', headers: HDR(), body: JSON.stringify(b) }).then((r) => r.json()),
  post: (u, b) => xfetch(u, { method: 'POST', headers: HDR(), body: JSON.stringify(b) }).then((r) => r.json()),
};
/* telefono: se il Mac non risponde compare una schermata a tutto schermo */
if (REMOTE) {
  const off = document.createElement('div');
  off.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:32px;text-align:center;background:var(--solid,#111);color:var(--text,#fff);font:16px system-ui';
  off.innerHTML = '<div style="font-size:44px">📡</div><b style="font-size:20px">Programma non raggiungibile</b><span style="opacity:.7;max-width:300px">L\'app sul Mac è chiusa oppure è offline. Controlla che sia aperta e connessa a internet: appena torna, questa schermata sparisce da sola.</span>';
  document.documentElement.appendChild(off);   // subito: non dipende da quando parte lo script
  let bad = 0;
  const ping = () => Promise.race([xfetch('/api/live').then((r) => r.ok), new Promise((_, ko) => setTimeout(ko, 4000))])
    .then((ok) => { bad = ok ? 0 : bad + 1; }, () => { bad++; })
    .then(() => { off.style.display = bad >= 2 ? 'flex' : 'none'; });   // ponytail: serve un secondo errore di fila, un singolo ritardo non basta
  setInterval(ping, 4000); window.addEventListener('online', ping); window.addEventListener('offline', () => { bad = 2; off.style.display = 'flex'; });
}
const amedia = (p) => '/media?p=' + encodeURIComponent(p);   // audio e video: anche con i dati (li suona il Mac)
const media = (p) => (window.NO_MEDIA ? '' : '/media?p=' + encodeURIComponent(p));
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (sec) => { sec = Math.max(0, Math.floor(sec || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const ICON = {
  scaletta: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  inno: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  bibbia: 'M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z',
  preghiera: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z',
  media: 'M3 5h18v14H3zM10 9l5 3-5 3z',
  versetto: 'M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z',
  lezione: 'M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h14',
  timer: 'M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 9v4l2 2M9 2h6',
  video: 'M3 5h18v14H3zM10 9l5 3-5 3z', audio: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  qrcode: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z',
  presentazione: 'M3 4h18v12H3zM8 20h8M12 16v4', documento: 'M6 2h9l5 5v15H6zM14 2v6h6',
  immagine: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6', testo: 'M4 6h16M4 12h16M4 18h10',
  skipb: 'M5 5h2.4v14H5zM19 5.6v12.8L8.8 12z', skipf: 'M16.6 5H19v14h-2.4zM5 5.6v12.8L15.2 12z',
  pointer: 'M5 3l14 7-6 2-2 6z',
  x: 'M6 6l12 12M18 6L6 18', play: 'M7 4l13 8-13 8z', pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  restart: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5', prev: 'M15 18l-6-6 6-6', next: 'M9 18l6-6-6-6',
  sunset: 'M17 18a5 5 0 0 0-10 0M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 5l-4 4-4-4',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2', vol: 'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7',
  nero: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z', sfondo: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6', congela: 'M12 2v20M4.9 7l14.2 10M4.9 17L19.1 7',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  plus: 'M12 5v14M5 12h14', pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', chev: 'M6 9l6 6 6-6',
  phone: 'M7 2h10v20H7zM11 18h2', sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6', screen: 'M3 4h18v12H3zM8 20h8M12 16v4',
};
const svg = (name, size = 16, fill = false, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${fill ? 'fill="currentColor"' : `fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`}><path d="${ICON[name]}"/></svg>`;
const GRIP = '<svg width="8" height="14" viewBox="0 0 8 18" fill="currentColor"><circle cx="2" cy="3" r="1.5"/><circle cx="6" cy="3" r="1.5"/><circle cx="2" cy="9" r="1.5"/><circle cx="6" cy="9" r="1.5"/><circle cx="2" cy="15" r="1.5"/><circle cx="6" cy="15" r="1.5"/></svg>';

const COLORS = { inno: '#888dec', video: '#6198ee', audio: '#12b382', versetto: '#de7949', lezione: '#5aae5f', presentazione: '#00a7b0',
  timer: '#e38d3d', documento: '#8f9298', preghiera: '#ee7c90', testo: '#cb86db', qrcode: '#8f9298', immagine: '#d4b01f', campana: '#e38d3d', altro: '#8f9298' };
const LABELS = { inno: 'Inno', video: 'Video', audio: 'Audio', versetto: 'Versetto', lezione: 'Lezione', presentazione: 'Presentazione', timer: 'Timer',
  documento: 'Documento', preghiera: 'Preghiere', testo: 'Testo', qrcode: 'QR Offerta', immagine: 'Immagine', campana: 'Campana', altro: 'Elemento' };
const FILE_TYPES = ['immagine', 'video', 'audio', 'presentazione'];   // si scelgono dal Mac (finestra dei file)
const ADDABLE = ['inno', 'versetto', 'lezione', 'timer', 'testo', 'immagine', 'qrcode', 'preghiera', 'presentazione', 'video', 'audio'];
const PRAYER_COLORS = ['#e0607a', '#2f8fd6', '#c48a12', '#2f9e5a', '#8a63d2', '#d9622b'];

/* ── stato ──────────────────────────────────────────────────────────────── */
const S = {
  view: 'scaletta', secs: [], prayers: [], settings: {}, dbs: [], langs: [], version: '',
  hymns: [], hymnsDb: '', hymnQ: '', baseOnly: false, hymnSel: 0, dbMenu: false,
  sel: null, lesson: null, lessonDay: null, qIdx: 0, intro: false,
  live: { kind: 'none' }, liveV: 0, hl: null, dragFrom: null, zoom: true,
  bib: { testament: 'NT', book: 43, chapter: 3, verse: 16, books: [], chapters: [], verses: [] },
  timer: { total: 600, remaining: 600, running: false, endAt: 0, warned: false, faded: false },
  pm: { files: [], idx: 0, on: false },
  undo: null, editSec: null, editTime: null, drag: null, over: null, cat: 'versione',
};
const lang = () => S.settings.bible_primary_lang || (S.langs[0] || {}).code || 'it';

/* ── persistenza ───────────────────────────────────────────────────────── */
function secsToSchedule() {
  return S.secs.map((s) => ({ id: s.id, name: s.name, time: s.time || '', slots: s.slots }));
}
let saveT = 0;
function saveSchedule() { clearTimeout(saveT); saveT = setTimeout(() => api.put('/api/schedule', secsToSchedule()), 250); }
const savePrayers = () => api.put('/api/prayers', S.prayers);
const setSetting = (k, v) => { S.settings[k] = v; return api.put('/api/settings', { [k]: v }); };

/* ── toast & modal ─────────────────────────────────────────────────────── */
let toastT = 0;
function toast(msg, undo, ms) {
  const t = $('#toast');
  t.innerHTML = `<div class="toast solid pop"><span style="flex:1">${esc(msg)}</span>${undo ? '<button class="btn sm pri" data-a="undo">Annulla</button>' : ''}</div>`;
  clearTimeout(toastT); toastT = setTimeout(() => { t.innerHTML = ''; }, ms || (undo ? 4500 : 1800));
}
function modal(html, width = 440) {
  $('#modal').innerHTML = `<div class="scrim pop" data-a="closeModal" data-self="1"><div class="modal solid pop" style="width:${width}px">${html}</div></div>`;
  const f = $('#modal [autofocus]'); if (f) f.focus();
}
const closeModal = () => { $('#modal').innerHTML = ''; };

/* ── live: quello che vede la sala ─────────────────────────────────────── */
function setLive(state, keepHl) {
  if (!keepHl) { S.hl = null; S.ptrOn = false; }   // contenuto nuovo: il puntatore si spegne
  // un nuovo contenuto mantiene Nero/Sfondo/Congela: si prepara in privato
  S.live = Object.assign({ overlay: S.live.overlay || null }, state);
  if (REMOTE && state.kind !== 'none' && !keepHl && !$('#dock').classList.contains('ropen')) { closeModal(); act.closeSheet(); setTimeout(act.remoteOpen, 0); }   // telefono: si apre il telecomando
  pushLive();
}
const CLIENT = uid();
function pushLive() {
  const st = Object.assign({}, S.live, { hl: S.hl, zoom: S.zoom, from: CLIENT });
  api.post('/api/live', st);
  // telefono: l'anteprima si aggiorna subito, senza aspettare il giro via Mac
  if (REMOTE) $$('#dock iframe, iframe.pv').forEach((f) => f.contentWindow && f.contentWindow.postMessage(JSON.stringify({ state: st }), '*'));
  autoOutputs();
  renderDock(); markLiveRows();
}
function stopLive() { if (S.live.kind === 'hymn') $('#baseAudio').pause();   // tolto l'inno, si ferma anche la base
  S.live = { kind: 'none' }; S.hl = null; pushLive(); }

/* ── avvio ─────────────────────────────────────────────────────────────── */
/* telefono non ancora collegato: codice breve o QR inquadrato dall'app */
function pairScreen() {
  document.documentElement.classList.add('phone');
  document.body.innerHTML = `<div style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:28px;text-align:center">
    <span class="logo" style="width:60px;height:52px"></span><b style="font-size:21px">Collega il telefono al Mac</b>
    <span style="color:var(--sub);max-width:320px">Sul Mac apri Impostazioni › Telefono: trovi il codice QR e un codice di 8 caratteri.</span>
    <button class="btn pri" id="scanBtn" style="height:50px;border-radius:25px;width:260px">Inquadra il codice QR</button>
    <video id="scanVid" muted style="display:none;width:260px;height:260px;object-fit:cover;border-radius:20px;background:#000"></video>
    <span style="color:var(--faint)">oppure scrivi il codice</span>
    <input class="field" id="pairCode" maxlength="9" autocapitalize="characters" autocomplete="off" placeholder="ABCD-EFGH" style="width:260px;height:54px;text-align:center;font-size:24px;letter-spacing:.15em">
    <button class="btn" id="pairBtn" style="height:46px;width:260px;border-radius:23px">Collega</button>
    <span id="pairErr" role="alert" style="color:var(--danger);min-height:20px;max-width:320px"></span></div>`;
  const err = (e) => { $('#pairErr').textContent = e.message || String(e); };
  $('#pairBtn').onclick = () => window.pairWith($('#pairCode').value).catch(err);
  $('#scanBtn').onclick = () => { $('#scanVid').style.display = 'block'; window.scanQR($('#scanVid')).catch(() => err(new Error('Fotocamera non disponibile: scrivi il codice'))); };
}
// barra della finestra dello stesso colore dell'app (Chrome la colora così)
const setThemeColor = (t) => { const m = $('meta[name="theme-color"]'); if (m) m.content = t === 'chiaro' ? '#d9e4fa' : '#0f1b33'; };
async function boot() {
  if (window.CLOUD && !window.ROOM) return pairScreen();
  const b = await api.get('/api/bootstrap');
  S.settings = b.settings || {}; S.prayers = b.prayers || []; S.dbs = b.dbs; S.langs = b.langs; S.version = b.version; S.data = b.data;
  S.secs = (b.schedule || []).map((s) => ({ id: s.id || uid(), name: s.name, time: s.time || '', slots: s.slots || [] }));
  if (!S.secs.length) S.secs = ['Scuola del Sabato', 'Culto', 'Pausa', 'Pomeriggio'].map((n) => ({ id: uid(), name: n, time: '', slots: [] }));
  if (b.live && b.live.state && b.live.state.kind !== 'none') S.live = b.live.state;
  document.documentElement.classList.toggle('phone', REMOTE);
  document.documentElement.classList.toggle('native', new URLSearchParams(location.search).has('native'));   // finestra dell'app per Mac
  if (REMOTE) $('#app').appendChild($('#tabs'));   // fuori dalla barra sfocata, sennò non resta in basso
  const theme = localStorage.getItem('theme') || (S.settings.appearance_mode === 'Light' ? 'chiaro' : 'scuro');
  document.documentElement.dataset.theme = theme;
  setThemeColor(theme);
  S.hymnsDb = S.settings.last_database || (S.dbs[0] || {}).path || '';
  S.sel = (S.secs.flatMap((s) => s.slots)[0] || {}).id || null;
  buildTabs(); tick(); setInterval(tick, 1000);
  render();
  loadHymns(); loadLesson(); loadBooks(); pollJobs();
  setupBell(); setupAudio(); setupKeys();
  api.get('/api/live').then((r) => { S.outputs = r.outputs || 0; renderDock(); });
  if (REMOTE) api.post('/api/cmd', { cmd: 'hello' });
  else api.get('/api/update').then((u) => { S.upd = u; $('#moreBtn').classList.toggle('badge', !!u.newer); }).catch(() => {});   // il Mac risponde con lo stato audio e timer
  const es = window.CLOUD ? {} : new EventSource('/api/events');
  if (window.CLOUD) window.cloudEvents((e) => es.onmessage(e));

  // cambi fatti da un'altra parte (Esc sull'uscita, telefono): il pannello si allinea
  es.onmessage = (e) => { if (S.cloudFwd) S.cloudFwd(e.data); $$('#dock iframe, iframe.pv').forEach((f) => f.contentWindow && f.contentWindow.postMessage(e.data, '*')); const m = JSON.parse(e.data);
    if (m.view) return;
    if (m.cmd || m.el) return REMOTE || runCmd(m);
    if (m.status) return REMOTE && applyStatus(m.status);
    if (m.sync) return m.from !== CLIENT && resync();
    if ('outputs' in m) { S.outputs = m.outputs; renderDock(); return; }
    const st = m.state || { kind: 'none' };
    if (st.from === CLIENT) return; S.live = st; autoOutputs(); S.hl = st.hl || null; renderDock(); markLiveRows(); };
}

/* ── telefono <-> Mac ───────────────────────────────────────────────────── */
// dati cambiati altrove: si ricaricano (senza disturbare chi sta scrivendo)
async function resync() {
  const b = await api.get('/api/bootstrap');
  S.settings = b.settings || {}; S.prayers = b.prayers || []; S.dbs = b.dbs;
  if (!S.drag) S.secs = (b.schedule || []).map((s) => ({ id: s.id || uid(), name: s.name, time: s.time || '', slots: s.slots || [] }));
  const a = document.activeElement;
  if (!(a && a.matches('input,textarea,select') && a.closest('#main,#modal'))) renderMain();
}
const FWD = ['tUntil', 'audioRate', 'audioSkip', 'tAdj', 'tSet', 'tToggle', 'pmPrev', 'pmNext', 'audioToggle', 'audioRestart', 'audioOff', 'testBell'];
// Mac: esegue i comandi arrivati dal telefono
function runCmd(m) {
  if (m.cmd && (FWD.includes(m.cmd) || m.cmd === 'step' || m.cmd === 'stop')) act[m.cmd]({ dataset: m.d || {} }, m.d || {}, {});   // anche le frecce premute sul proiettore
  if (m.el) {
    const a = $('#' + m.el + 'Audio');
    if (m.op === 'play' && m.v && a.dataset.p !== m.v) m = Object.assign({}, m, { op: 'src', v: media(m.v), then: 'play' });
    if (m.op === 'src') { a.src = m.v; a.dataset.p = new URL(m.v, location.href).searchParams.get('p') || ''; if (m.el === 'base') S.baseTitle = fileName(a.dataset.p).replace(/\.[^.]+$/, ''); }
    if (m.op === 'play' || m.then === 'play') a.play().catch(() => {});
    if (m.op === 'pause') a.pause();
    if (m.op === 'seek') a.currentTime = m.v;
    if (m.op === 'volume') a.volume = m.v;
    renderDock();
  }
  sendStatus();
}
// Mac: racconta al telefono cosa sta suonando e il timer
let statusT = 0;
function sendStatus() {
  if (REMOTE) return;
  clearTimeout(statusT);
  statusT = setTimeout(() => {
    const aud = (k) => { const a = $('#' + k + 'Audio'); return { p: a.dataset.p || '', playing: !a.paused, t: a.currentTime || 0, at: Date.now(), dur: a.duration || 0, vol: a.volume, rate: +(a.dataset.rate || 1) }; };
    const T = S.timer;
    api.post('/api/cmd', { status: { base: aud('base'), pm: Object.assign(aud('pm'), { on: S.pm.on, cur: S.pm.files[S.pm.idx] || '' }), baseTitle: S.baseTitle || '',
      timer: { running: T.running, endAt: T.endAt, remaining: T.remaining, total: T.total } } });
  }, 120);
}
// telefono: lettore che mostra lo stato del Mac e gli manda i comandi
class RAudio extends EventTarget {
  constructor(k) { super(); this.k = k; this.m = { p: '', playing: false, t: 0, at: 0, dur: 0, vol: 1 }; }
  cmd(op, v) { api.post('/api/cmd', { el: this.k, op, v }); }
  get dataset() { return { p: this.m.p }; }
  get src() { return this.m.p ? amedia(this.m.p) : ''; }
  set src(v) { if (!v) return; this.m.p = new URL(v, location.href).searchParams.get('p') || ''; this.cmd('src', v); }
  get paused() { return !this.m.playing; }
  get duration() { return this.m.dur; }
  get currentTime() { return Math.min(this.m.dur || 1e9, this.m.t + (this.m.playing ? (Date.now() - this.m.at) / 1000 : 0)); }
  set currentTime(v) { this.m.t = v; this.m.at = Date.now(); this.cmd('seek', v); }
  get playbackRate() { return this.m.rate || 1; }
  get volume() { return this.m.vol; }
  set volume(v) { this.cmd('volume', v); }
  play() { this.m.playing = true; this.cmd('play', this.m.p); return Promise.resolve(); }   // con il file: arriva anche se il comando 'src' è in ritardo
  pause() { this.m.playing = false; this.cmd('pause'); }
}
if (REMOTE) ['base', 'pm', 'fx'].forEach((k) => { RA['#' + k + 'Audio'] = new RAudio(k); });
let lastFlags = '';
function applyStatus(st) {
  RA['#baseAudio'].m = st.base; RA['#pmAudio'].m = st.pm;
  S.baseTitle = st.baseTitle; S.pm.on = st.pm.on; S.pm.files = [st.pm.cur]; S.pm.idx = 0;
  Object.assign(S.timer, st.timer);
  const flags = JSON.stringify([st.base.p, st.base.playing, st.pm.on, st.pm.playing, st.pm.cur, st.timer.running, st.timer.total]);
  if (flags !== lastFlags) { lastFlags = flags; renderDock(); if (S.view === 'scaletta' && $('#timerBig')) $('#detail').innerHTML = detailHtml(); }
  ['#baseAudio', '#pmAudio'].forEach((k) => RA[k].dispatchEvent(new Event('timeupdate')));
}
async function refreshBoot() { const b = await api.get('/api/bootstrap'); S.dbs = b.dbs; S.settings = b.settings; renderMain(); }
async function loadHymns(force) {
  if (!S.hymnsDb) { S.hymns = []; return; }
  // già caricato: subito, senza aspettare
  S.hymnsBy = S.hymnsBy || {};
  const db = S.hymnsDb;
  if (force || !S.hymnsBy[db]) {
    const r = await api.get('/api/hymns?db=' + encodeURIComponent(db) + (REMOTE ? '&lite=1' : ''));
    S.hymnsBy[db] = r.hymns || [];
    S.hymnsBy[db].forEach((h) => { h._k = (h.number + ' ' + h.title).toLowerCase(); h._t = (h.slides || []).join(' · ').toLowerCase(); });   // ricerca veloce
  }
  if (db !== S.hymnsDb) return;
  S.hymns = S.hymnsBy[db];
  if (S.view === 'inni') renderMain();
}
async function loadLesson() {
  S.lesson = await api.get('/api/lesson');
  if (S.view === 'scaletta') renderMain();
}
async function loadBooks() {
  S.bib.books = await api.get('/api/bible/books?lang=' + lang());
  await loadChapter();
}
async function loadChapter() {
  const b = S.bib;
  b.chapters = await api.get(`/api/bible/chapters?lang=${lang()}&book=${b.book}`);
  b.verses = await api.get(`/api/bible/verses?lang=${lang()}&book=${b.book}&ch=${b.chapter}`);
  if (S.view === 'bibbia') renderMain();
}
const bookName = (n) => (S.bib.books.find((x) => x[0] === n) || [n, 'Libro ' + n])[1];

/* ── header: orologio, tramonto, schede ────────────────────────────────── */
function tick() {
  const d = new Date();
  $('#clock').textContent = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  $('#date').textContent = cap(GIORNI[d.getDay()]) + ' ' + d.getDate() + ' ' + MESI[d.getMonth()];
  const lat = +S.settings.church_lat || 43.567, lon = +S.settings.church_lon || 11.865;
  const st = window.sunTimes(d, lat, lon);
  const hm = (x) => x.getHours() + ':' + String(x.getMinutes()).padStart(2, '0');
  const diff = Math.round((st.sunset - d) / 60000);
  const dur = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') : m + ' min');
  const sun = $('#sun');
  sun.className = 'sun' + (diff > 0 && diff <= 30 ? ' near' : '');
  sun.innerHTML = `${svg('sunset', 18, false, 1.9)}<b>${hm(st.sunset)}</b><span style="opacity:.8">${diff > 0 ? 'tra ' + dur(diff) : 'tramontato'}</span>`;
  S.sun = { st, diff, hm, dur, lat, lon };
  // il telefono resta allineato: ogni secondo mentre qualcosa suona o il timer va, e quando si ferma
  const busy = !$('#baseAudio').paused || !$('#pmAudio').paused || S.timer.running;
  if (!REMOTE && (busy || S.wasBusy)) sendStatus();
  S.wasBusy = busy;
  if (S.live.kind === 'video' && S.live.playing) { const sk = $('#vseek'), pos = vpos(S.live); if (sk && document.activeElement !== sk) sk.value = pos; const t = $('#vtime'); if (t) t.textContent = fmt(Math.floor(pos)) + ' / ' + fmt(Math.floor(vdur(S.live.file))); }
  timerTick();
}
function renderSunPop() {
  const { st, diff, hm, dur } = S.sun;
  const d = new Date(); const fri = new Date(d); fri.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  const sat = new Date(fri); sat.setDate(fri.getDate() + 1);
  const ts = (x) => hm(window.sunTimes(x, S.sun.lat, S.sun.lon).sunset);
  $('#sunPop').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;color:var(--warn)">${svg('sunset', 26, false, 1.8)}
      <span style="font-size:26px;font-weight:700;color:var(--text)">${hm(st.sunset)}</span>
      <span style="color:var(--sub);font-weight:600">${diff > 0 ? 'mancano ' + dur(diff) : 'tramontato da ' + dur(-diff)}</span></div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px;font-size:13px">
      <div class="soft" style="display:flex;justify-content:space-between;padding:8px 10px"><span style="color:var(--sub)">Inizio del sabato · ven ${fri.getDate()}</span><b>${ts(fri)}</b></div>
      <div class="soft" style="display:flex;justify-content:space-between;padding:8px 10px"><span style="color:var(--sub)">Fine del sabato · sab ${sat.getDate()}</span><b>${ts(sat)}</b></div>
      <div class="soft" style="display:flex;justify-content:space-between;padding:8px 10px"><span style="color:var(--sub)">Alba di oggi</span><b>${hm(st.sunrise)}</b></div>
    </div>
    <div style="font-size:11.5px;color:var(--faint);margin-top:10px">${esc(S.settings.church_place || 'Capolona (AR)')} · cambia la località in Impostazioni</div>`;
}
const TABS = [['scaletta', 'Scaletta'], ['inni', 'Inni'], ['bibbia', 'Bibbia'], ['media', 'Media'], ['preghiere', 'Preghiere'], ['impostazioni', 'Impostazioni']];
function buildTabs() {
  $('#tabs').insertAdjacentHTML('beforeend', TABS.filter((t) => t[0] !== 'impostazioni').map(([k, l]) =>
    `<button data-a="nav" data-v="${k}" data-tab="${k}">${svg(k === 'inni' ? 'inno' : k === 'preghiere' ? 'preghiera' : k === 'media' ? 'video' : k, 16, false, 1.9)}${l}</button>`).join('')
    // telefono: il telecomando è un pulsante a parte, così non occupa spazio mentre cerchi
  );
  // telefono: il telecomando è un pulsante a parte, sopra le schede
  if (REMOTE) document.body.insertAdjacentHTML('beforeend', `<button data-a="remoteOpen" class="rbtn" aria-label="In onda: apri il telecomando">${svg('screen', 24, false, 2)}</button>`);
}
function placePill() {
  const b = $(`#tabs [data-tab="${S.view}"]`), pill = $('#tabPill');
  $$('#tabs [data-tab]').forEach((x) => x.classList.toggle('on', x === b));
  if (!b) { pill.style.opacity = 0; return; }
  pill.style.opacity = 1; pill.style.left = b.offsetLeft + 'px'; pill.style.width = b.offsetWidth + 'px';
}
function renderMore() {
  const theme = document.documentElement.dataset.theme;
  $('#morePop').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px 8px"><b>Tema</b>
      <div class="seg"><button class="${theme === 'scuro' ? 'on' : ''}" data-a="theme" data-v="scuro">Scuro</button><button class="${theme === 'chiaro' ? 'on' : ''}" data-a="theme" data-v="chiaro">Chiaro</button></div></div>
    <button class="menu-row" data-a="openOutputs">${svg('screen', 17)}<span style="flex:1">Apri le uscite sui proiettori</span>${S.outputs === 0 ? '<span class="offpulse" title="Spente"></span>' : ''}</button>
    <button class="menu-row" data-a="closeOutputs">${svg('x', 17)}<span style="flex:1">Chiudi le uscite</span></button>
    ${REMOTE ? '' : `<button class="menu-row" data-a="nav" data-v="impostazioni">${svg('sliders', 17)}<span style="flex:1">Impostazioni</span></button>`}
    ${S.upd && S.upd.newer ? `<button class="menu-row" data-a="goUpdate" style="color:var(--accent)">${svg('next', 17)}<span style="flex:1">Disponibile la versione ${esc(S.upd.latest)}</span></button>` : ''}`;
}

/* ── render ─────────────────────────────────────────────────────────────── */
function render() { renderMain(); renderDock(); }
function renderMain() {
  placePill();
  const m = $('#main');
  const v = { scaletta: viewScaletta, inni: viewInni, bibbia: viewBibbia, media: viewMedia, preghiere: viewPreghiere, impostazioni: viewSettings }[S.view];
  m.innerHTML = v();
  // stessa sezione: niente animazione di entrata, sennò ogni clic fa un lampo
  if (S.lastView === S.view) m.querySelectorAll('.enter').forEach((e) => e.classList.remove('enter'));
  S.lastView = S.view;
  if (S.view === 'scaletta') afterScaletta();
  hydrateThumbs();
  if (S.view === 'bibbia') { fitBib(); const v = $('#bibSel'); if (v) v.scrollIntoView({ block: 'nearest' }); }
  if ($('#bigPrev')) requestAnimationFrame(scalePreview);
}
const findSlot = (id) => { for (const s of S.secs) { const x = s.slots.find((y) => y.id === id); if (x) return [s, x]; } return [null, null]; };
const slotTitle = (sl) => (sl.data && sl.data.title) || sl.display_name || LABELS[sl.slot_type] || 'Elemento';

function viewScaletta() {
  const n = S.secs.reduce((a, s) => a + s.slots.length, 0);
  const secs = S.secs.map((sec, si) => `
    <div class="sec" data-sec="${si}" draggable="true">
      <div class="gap" data-gap="${si}:sec"></div>
      <div class="sec-head">
        <span class="grip tool">${GRIP}</span>
        <span style="flex:1;min-width:0">${S.editSec === sec.id
          ? `<input class="inline-edit" data-edit="secname" data-id="${sec.id}" value="${esc(sec.name)}" style="width:100%;text-transform:uppercase;letter-spacing:.06em">`
          : `<button class="sec-name" data-a="renameSec" data-id="${sec.id}" title="Clicca per rinominare">${esc(sec.name)}</button>`}</span>
        <span style="position:relative;display:flex">
          <button class="xbtn tool" data-a="delSec" data-id="${sec.id}" aria-label="Elimina sezione" style="position:absolute;right:calc(100% + 6px);top:1px">${svg('x', 11, false, 2.6)}</button>
          ${S.editTime === sec.id
            ? `<input type="time" class="inline-edit" data-edit="sectime" data-id="${sec.id}" value="${esc((sec.time || '').padStart(5, '0'))}" style="width:84px">`
            : `<button class="sec-time" data-a="editTime" data-id="${sec.id}" title="Clicca per cambiare l'orario">${svg('clock', 11, false, 2.2)}${esc(sec.time || '--:--')}</button>`}
        </span>
        <button class="sec-add" data-a="addItem" data-s="${si}" aria-label="Aggiungi in ${esc(sec.name)}" title="Aggiungi qui">${svg('plus', 12, false, 2.6)}</button>
      </div>
      ${sec.slots.length ? '' : `<button class="empty-sec" data-a="addItem" data-s="${si}">${svg('plus', 13, false, 2.4)}Clicca per aggiungere, o trascina qui un file</button>`}
      ${sec.slots.map((sl, sj) => `
        <div class="gap" data-gap="${si}:${sj}"></div>
        <div class="row ${sl.id === S.sel ? 'sel' : ''}" draggable="true" data-row="${si}:${sj}" data-a="pick" data-id="${sl.id}">
          <span class="grip tool">${GRIP}</span>
          <span class="ic" style="background:${COLORS[sl.slot_type] || '#888'}2e;color:${COLORS[sl.slot_type] || '#888'}">${svg(sl.slot_type in ICON ? sl.slot_type : 'testo', 15)}</span>
          <span class="tt"><b>${esc(slotTitle(sl))}</b><span>${LABELS[sl.slot_type] || ''}</span></span>
          <span class="mark" data-mark="${sl.id}"></span>
          <button class="xbtn tool" data-a="delSlot" data-id="${sl.id}" aria-label="Togli dalla scaletta">${svg('x', 11, false, 2.6)}</button>
        </div>`).join('')}
      <div class="gap" data-gap="${si}:end"></div>
    </div>`).join('');
  return `
  <section class="panel glass enter" style="width:300px;flex-shrink:0">
    <div class="sched-head"><div style="flex:1"><div style="font-size:20px;font-weight:750;letter-spacing:-.02em">Scaletta</div>
      <div style="color:var(--faint);font-size:12px">${n} elementi in ${S.secs.length} sezioni</div></div>
      <button class="ibtn" data-a="addSec" aria-label="Aggiungi sezione">${svg('plus', 16, false, 2.2)}</button></div>
    <div class="sched-list scr" id="schedList">${secs}</div>
    <div class="sched-foot"><button class="btn sm" data-a="addItem">Aggiungi</button><button class="btn sm" data-a="templates">Modelli</button><button class="btn sm danger" data-a="askClear">Svuota</button></div>
  </section>
  <section class="panel glass detail scr enter sheet ${S.sheet ? 'open' : ''}" id="detail">${detailHtml()}</section>`;
}
function markLiveRows() {
  $$('[data-mark]').forEach((m) => {
    const id = m.dataset.mark;
    m.innerHTML = S.live.slotId === id && S.live.kind !== 'none' ? '<span class="livedot" style="display:block"></span>' : '';
  });
}
function afterScaletta() { markLiveRows(); const i = $('[data-edit]'); if (i) { i.focus(); i.select && i.select(); } }

/* ── dettaglio dell'elemento selezionato ───────────────────────────────── */
const SHEET_X = '<button class="sheet-x" data-a="closeSheet" aria-label="Chiudi"></button>';
function detailHtml() {
  const [sec, sl] = findSlot(S.sel);
  if (!sl) return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--sub);text-align:center">
    ${svg('scaletta', 40, false, 1.5)}<span style="font-size:17px;font-weight:650;color:var(--text)">Seleziona un elemento</span>
    <span>Oppure aggiungine uno con «Aggiungi» o dalla ricerca in alto.</span></div>`;
  const t = sl.slot_type, c = COLORS[t] || '#888';
  const head = `<div><span class="label" style="color:${c}">${LABELS[t]} · ${esc(sec.name)}</span><h1>${esc(slotTitle(sl))}</h1></div>`;
  const body = ({ inno: detInno, versetto: detVersetto, lezione: detLezione, timer: detTimer, testo: detTesto,
    immagine: detImmagine, qrcode: detQr, preghiera: detPreghiera, presentazione: detDeck, video: detVideo, audio: detAudio }[t] || detGeneric)(sl);
  // i pulsanti principali (proietta, modifica, cambia) vanno sulla riga del titolo
  const tmp = document.createElement('div'); tmp.innerHTML = body; const acts = tmp.querySelector('.det-acts'); if (acts) acts.remove();
  return SHEET_X + `<div class="det-head">${head}${acts ? acts.outerHTML : ''}</div><div style="display:flex;flex-direction:column;gap:14px">${tmp.innerHTML}</div>`;
}
function playerHtml(id, title, kind) {
  const a = kind === 'pm' ? $('#pmAudio') : $('#baseAudio');
  const dur = a.duration || 0, pos = a.currentTime || 0, playing = !a.paused;
  const col = kind === 'pm' ? 'var(--warn)' : 'var(--accent)';
  return `<div class="card player" data-player="${kind}">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="width:30px;height:30px;border-radius:10px;background:${kind === 'pm' ? 'rgba(227,141,61,.2)' : 'rgba(136,141,236,.22)'};color:${kind === 'pm' ? '#e38d3d' : '#aab0ff'};display:flex;align-items:center;justify-content:center">${svg('inno', 15)}</span>
      <div style="display:flex;flex-direction:column;flex:1;min-width:0"><span class="label">${kind === 'pm' ? 'Musica di pausa' : 'Base musicale'}</span><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" data-ptitle>${esc(title)}</b></div>
      <span style="font-size:11px;font-weight:650;color:${playing ? '#2fb350' : 'var(--faint)'}" data-pstate>${playing ? 'In riproduzione' : 'Pronta'}</span>
      <button class="ibtn" style="width:26px;height:26px" data-a="audioOff" data-k="${kind}" aria-label="Spegni">${svg('x', 11, false, 2.6)}</button>
    </div>
    <input type="range" min="0" max="${Math.max(1, Math.floor(dur))}" value="${Math.floor(pos)}" data-seek="${kind}" aria-label="Posizione" style="accent-color:${col}">
    <div class="times"><span data-ppos>${fmt(pos)}</span><span data-pdur>${fmt(dur)}</span></div>
    <div class="transport">
      ${kind === 'pm' ? `<button class="tbtn" data-a="pmPrev" aria-label="Brano precedente">${svg('skipb', 20, true)}</button>` : `<button class="tbtn" data-a="audioRestart" data-k="${kind}" aria-label="Torna all'inizio" title="Torna all'inizio">${svg('skipb', 20, true)}</button>`}
      <button class="tbtn t10" data-a="audioSkip" data-k="${kind}" data-s="-10" aria-label="Indietro 10 secondi">−10</button>
      <button class="tplay" data-a="audioToggle" data-k="${kind}" data-pbtn aria-label="${playing ? 'Pausa' : 'Riproduci'}">${svg(playing ? 'pause' : 'play', 22, true)}</button>
      <button class="tbtn t10" data-a="audioSkip" data-k="${kind}" data-s="10" aria-label="Avanti 10 secondi">+10</button>
      ${kind === 'pm' ? `<button class="tbtn" data-a="pmNext" aria-label="Brano successivo">${svg('skipf', 20, true)}</button>` : '<span class="tbtn" aria-hidden="true"></span>'}
    </div>
    ${kind === 'base' ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--sub)"><span style="flex:1">Velocità</span>
      <button class="ibtn" style="width:30px;height:30px" data-a="audioRate" data-d="-0.05" aria-label="Più lenta">−</button>
      <button class="btn sm" data-a="audioRate" data-d="0" data-prate title="Torna a 100%" style="height:30px;min-width:62px;font-variant-numeric:tabular-nums">${Math.round((REMOTE ? a.playbackRate : +(a.dataset.rate || 1)) * 100)}%</button>
      <button class="ibtn" style="width:30px;height:30px" data-a="audioRate" data-d="0.05" aria-label="Più veloce">+</button></div>` : ''}
    <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--sub)">${svg('vol', 15)}<input type="range" min="0" max="100" value="${Math.round(a.volume * 100)}" data-vol="${kind}" style="flex:1;accent-color:${col}"></label>
  </div>`;
}
function detInno(sl) {
  const h = sl.data.hymn;
  if (!h) return `<button class="btn pri" data-a="changeIn" data-id="${sl.id}" data-v="inni" style="align-self:flex-start">Scegli l'inno</button>`;
  const liveI = S.live.kind === 'hymn' && S.live.file === h.path ? S.live.i : -1;
  return `<div class="slides" data-thumbs="${esc(h.path)}" data-id="${sl.id}" data-live="${liveI}"></div>
    ${h.audio_path ? playerHtml('base', h.number + ' — ' + h.title, 'base') : ''}
    <div class="det-acts"><button class="btn pri" data-a="projHymn" data-id="${sl.id}" data-i="0">Proietta inno</button>
    <button class="btn" data-a="editHymn" data-p="${esc(h.path)}">Modifica testo e dimensione</button>
    <button class="btn" data-a="changeIn" data-id="${sl.id}" data-v="inni">Cambia inno</button></div>`;
}
/* caratteri degli inni: quelli di Windows (Berlin Sans FB, Calibri…) sul Mac
   non ci sono; si caricano nell'app e da lì li usano pannello e proiettori */
function hasFont(f) {
  const c = document.createElement('canvas').getContext('2d'), t = 'mmmmmmmmmmlli WQ 12345';
  return ['monospace', 'serif'].some((b) => { c.font = `40px ${b}`; const w = c.measureText(t).width; c.font = `40px '${f}', ${b}`; return c.measureText(t).width !== w; });
}
async function fontBox() {
  const r = await api.get('/api/fonts'), el = $('#fontBox'); if (!el) return;
  await document.fonts.ready;
  el.outerHTML = `<div class="soft" id="fontBox" style="display:flex;flex-direction:column;gap:8px;margin-top:10px"><b>Caratteri degli inni</b>
    ${r.used.length ? r.used.map((f) => { const ok = r.loaded.some((x) => x.family === f) || hasFont(f);
      return `<div style="display:flex;align-items:center;gap:10px"><span style="font-family:'${esc(f)}';font-size:18px;flex:1">${esc(f)}</span>
        <span style="font-size:12px;font-weight:650;color:${ok ? '#2fb350' : 'var(--danger)'}">${ok ? 'presente' : 'manca: caricalo'}</span></div>`; }).join('') : '<span style="color:var(--faint)">Aggiungi un innario per vedere quali caratteri usa.</span>'}
    ${r.loaded.length ? `<span style="font-size:12px;color:var(--sub)">Caricati: ${r.loaded.map((x) => esc(x.family + ' ' + x.style)).join(', ')}</span>` : ''}
    <div style="display:flex;gap:8px;align-items:center"><button class="btn sm" data-a="addFont">Carica carattere…</button>
    <span style="font-size:12px;color:var(--faint)">Sul PC Windows sono in C:\\Windows\\Fonts (es. Berlin Sans FB = BRLNSR.TTF). Copiali su una chiavetta.</span></div></div>`;
}
async function phoneBox() {
  const r = await api.get('/api/phone'), el = $('#phoneBox'); if (!el) return;
  const qr = (u) => `<img src="/api/phone/qr?u=${encodeURIComponent(u)}" alt="Codice QR" style="width:150px;height:150px;border-radius:14px;background:#fff;padding:6px;flex-shrink:0">`;
  el.innerHTML = `<div style="display:flex;gap:18px;align-items:center">${qr(r.cloud)}
      <div style="display:flex;flex-direction:column;gap:6px"><b style="color:var(--text);font-size:15px">Inquadra il codice con la fotocamera del telefono</b>
      <span>Funziona ovunque: con la Wi-Fi della chiesa e con i dati cellulare. Serve che il Mac sia acceso, con il programma aperto e collegato a internet.</span>
      <span>Poi su iPhone: Condividi › Aggiungi alla schermata Home, e si apre come un'app.</span>
      <span>Oppure, nell'app del telefono, scrivi il codice <b style="color:var(--text);font-size:17px;letter-spacing:.12em">${esc(r.code.slice(0, 4) + '-' + r.code.slice(4))}</b></span>
      <span style="font-size:12px">Il codice è la chiave: se perdi un telefono premi «Cambia codice» e ricollega gli altri.</span>
      <button class="btn sm danger" data-a="newRoom" style="align-self:flex-start">Cambia codice</button></div></div>
    <details style="margin-top:14px"><summary style="cursor:default;font-weight:650;color:var(--text)">Senza internet in chiesa (solo Wi-Fi, più veloce)</summary>
      ${!r.url ? '<div style="margin-top:8px">Il Mac non è collegato a una rete Wi-Fi.</div>' : !r.pin ? '<div style="margin-top:8px">Scegli un PIN qui sopra per usare questo collegamento.</div>'
        : `<div style="display:flex;gap:18px;align-items:center;margin-top:10px">${qr(r.url)}<span>Apri <b style="color:var(--text)">${esc(r.url)}</b> sulla stessa Wi-Fi ed entra con il PIN.</span></div>`}</details>`;
}
/* editor dell'inno: si disegna una volta; cambiando diapositiva si aggiornano
   solo anteprima e testo. Il testo tiene corsivo, grassetto e colori */
function heLines(i) {
  const he = S.he, v = he.texts[i];
  if (Array.isArray(v)) return v;
  if (v != null) return v.split('\n').map((t) => (t ? [{ t }] : []));
  const box = he.data.slides[i][mainBox(he.data.slides[i])];
  return box && box.text ? box.text.paras.map((p) => p.runs.filter((r) => r.t).map((r) => ({ t: r.t, i: !!r.i, b: !!r.b, c: r.c || '' }))) : [];
}
const heLinesHtml = (lines) => lines.map((runs) => `<div>${runs.length ? runs.map((r) => `<span data-c="${esc(r.c || '')}" style="${r.i ? 'font-style:italic;' : ''}${r.b ? 'font-weight:700;' : ''}${r.c ? 'color:' + esc(r.c) : ''}">${esc(r.t)}</span>`).join('') : '<br>'}</div>`).join('');
// dal riquadro modificabile alle righe: ogni pezzo con il suo stile
function heRead(root) {
  const lines = []; let cur = null;
  const end = () => { lines.push(cur || []); cur = null; };
  const walk = (n) => { for (const c of n.childNodes) {
    if (c.nodeType === 3) { const t = c.data.replace(/\n/g, ''); if (!t) continue; cur = cur || [];
      const el = c.parentElement, cs = getComputedStyle(el), k = el.closest('[data-c]');
      const r = { t, i: cs.fontStyle === 'italic', b: +cs.fontWeight >= 600, c: (k && k.dataset.c) || '' }, l = cur[cur.length - 1];
      if (l && l.i === r.i && l.b === r.b && l.c === r.c) l.t += t; else cur.push(r); }
    else if (c.nodeName === 'BR') { cur = cur || []; end(); }
    else if (/^(DIV|P)$/.test(c.nodeName)) { if (cur && cur.length) end(); walk(c); if (cur) end(); }
    else if (c.nodeType === 1) walk(c);
  } };
  walk(root); if (cur) end();
  return lines;
}
function heShow() {
  const he = S.he, i = he.i, edit = { scale: he.scale, texts: he.texts };
  $$('#heThumbs [data-i]').forEach((b) => b.classList.toggle('live', +b.dataset.i === i));
  $('#hePrev').innerHTML = thumb(he.data, i, edit);
  $('#heText').innerHTML = heLinesHtml(heLines(i));
  $('#heDelBtn').textContent = he.confirm === i ? 'Sicuro? Tocca di nuovo' : 'Elimina questa diapositiva';
}
function renderHymnEditor() {
  const he = S.he, data = he.data, edit = { scale: he.scale, texts: he.texts };
  modal(`<div style="display:flex;align-items:baseline;gap:10px"><span style="font-size:19px;font-weight:750;flex:1">Modifica inno</span><span style="color:var(--faint);font-size:12px">Il file PowerPoint originale non viene toccato</span></div>
    <div style="display:flex;gap:16px;min-height:0">
      <div class="scr" id="heThumbs" style="width:170px;flex-shrink:0;display:flex;flex-direction:column;gap:8px;max-height:60vh">${data.slides.map((_, k) => `<button class="slide-btn" data-a="heSlide" data-i="${k}">${thumb(data, k, edit)}</button>`).join('')}</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:10px">
        <div id="hePrev"></div>
        <div style="display:flex;gap:6px;align-items:center"><button class="btn sm" data-a="heFmt" data-v="italic" style="font-style:italic;font-family:Georgia,serif;width:38px" title="Corsivo (⌘I)">I</button>
          <button class="btn sm" data-a="heFmt" data-v="bold" style="font-weight:800;width:38px" title="Grassetto (⌘B)">B</button>
          <span style="font-size:12px;color:var(--faint)">Seleziona le parole e tocca un tasto. Va a capo con Invio.</span></div>
        <div class="field" id="heText" contenteditable="true" spellcheck="false" style="height:150px;overflow:auto;padding:12px;line-height:1.5;font-size:15px;font-weight:400;font-style:normal;background:#1c1e2a;color:#fff;text-align:center"></div>
        <label style="display:flex;align-items:center;gap:12px;font-weight:650;font-size:13px">Dimensione del testo<input type="range" id="heScale" min="50" max="160" value="${Math.round(he.scale * 100)}" style="flex:1"><span id="heScaleV" style="width:44px;text-align:right;color:var(--sub)">${Math.round(he.scale * 100)}%</span></label>
      </div></div>
    <div style="display:flex;gap:8px"><button class="btn" data-a="heReset">Ripristina l'originale</button>
      <button class="btn danger" data-a="heDel" id="heDelBtn"></button><span style="flex:1"></span><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" data-a="heSave">Salva</button></div>`, 940);
  heShow();
}
// i tasti I e B non tolgono la selezione dal testo
document.addEventListener('mousedown', (e) => { if (e.target.closest('[data-a="heFmt"]')) e.preventDefault(); });
document.addEventListener('input', (e) => {
  if (!S.he) return;
  const he = S.he, edit = { scale: he.scale, texts: he.texts };
  if (e.target.id === 'heText') he.texts[he.i] = heRead(e.target);
  else if (e.target.id === 'heScale') { he.scale = e.target.value / 100; $('#heScaleV').textContent = e.target.value + '%'; } else return;
  $('#hePrev').innerHTML = thumb(he.data, he.i, edit);
  const t = $(`#heThumbs [data-i="${he.i}"]`); if (t) t.innerHTML = thumb(he.data, he.i, edit);
});
/* diapositive vere dell'inno, disegnate dal PowerPoint */
S.slidesCache = {};
async function getSlides(p) {
  if (!p) return null;
  if (!(p in S.slidesCache)) {
    try { const r = await xfetch('/api/slides?p=' + encodeURIComponent(p)); S.slidesCache[p] = r.ok ? await r.json() : null; } catch (e) { S.slidesCache[p] = null; }
  }
  return S.slidesCache[p];
}
const hymnEdit = (p) => (S.settings.hymn_edits || {})[p] || null;
const thumb = (data, i, edit, extra = '') => `<div class="slide pp" style="aspect-ratio:${data.ratio}" ${extra}>${slideHTML(data.slides[i], i, edit)}</div>`;
async function getPdf(p) {
  S.pdfCache = S.pdfCache || {};
  if (!S.pdfCache[p]) S.pdfCache[p] = api.get('/api/pdf?p=' + encodeURIComponent(p)).then((r) => r.pages || []).catch(() => []);
  return S.pdfCache[p];
}
async function hydrateThumbs() {
  for (const el of $$('[data-thumbs]')) {
    const p = el.dataset.thumbs, data = await getSlides(p);
    if (!data) { el.innerHTML = '<div style="color:var(--faint)">Diapositive non leggibili: verrà proiettato il testo.</div>'; continue; }
    const live = +(el.dataset.live ?? -1), edit = hymnEdit(p);
    el.innerHTML = data.slides.map((_, i) => el.dataset.id
      ? `<button class="slide-btn ${i === live ? 'live' : ''}" data-a="${REMOTE ? 'viewSlides' : el.dataset.act || 'projHymn'}" data-p="${esc(p)}" data-proj="${el.dataset.act || 'projHymn'}" data-id="${el.dataset.id}" data-i="${i}">${thumb(data, i, edit)}</button>`
      : `<button class="slide-btn" data-a="viewSlides" data-p="${esc(p)}" data-i="${i}" title="Guarda più grande">${thumb(data, i, edit)}</button>`).join('');
  }
  for (const el of $$('[data-pdf]')) {
    const pages = await getPdf(el.dataset.pdf), live = +(el.dataset.live ?? -1);
    el.innerHTML = pages.length ? pages.map((pg, i) => `<button class="slide-btn ${i === live ? 'live' : ''}" data-a="projDeck" data-id="${el.dataset.id}" data-i="${i}"><img src="${media(pg)}" alt="Pagina ${i + 1}" style="width:100%;display:block;border-radius:inherit"></button>`).join('')
      : '<div style="color:var(--faint)">Questo PDF non si legge.</div>';
  }
}
function detVersetto(sl) {
  const v = sl.data.verse;
  if (!v) return `<button class="btn pri" data-a="changeIn" data-id="${sl.id}" data-v="bibbia" style="align-self:flex-start">Scegli il versetto</button>`;
  return `${Object.entries(v.texts || {}).map(([c, t]) => `<div class="card"><span class="label">${esc(c.toUpperCase())}</span><div style="font:20px/1.5 Georgia,serif;margin-top:6px">${esc(t)}</div></div>`).join('')}
    <div class="det-acts"><button class="btn pri" data-a="projSlotVerse" data-id="${sl.id}">Proietta versetto</button>
    <button class="btn" data-a="openVerse" data-b="${v.book}" data-c="${v.chapter}" data-v="${v.verse}">Apri nella Bibbia</button>
    <button class="btn" data-a="changeIn" data-id="${sl.id}" data-v="bibbia">Cambia versetto</button></div>`;
}
function lessonDays() {
  const les = S.lesson && S.lesson.lesson; if (!les) return [];
  const days = [];
  les.domande.forEach((d, i) => { if (!days.find((x) => x.name === d.day)) days.push({ name: d.day || 'Domande', first: i }); });
  return days;
}
function lessonPickHtml(L) {
  return `<label style="display:flex;align-items:center;gap:10px;font-size:13px;font-weight:650;color:var(--sub)">Lezione
    <select class="field" data-a2="lessonPick" style="max-width:420px;height:38px"><option value="-1" ${L.index < 0 ? 'selected' : ''}>Automatica (per data)</option>${L.titles.map((t, i) => `<option value="${i}" ${L.index === i ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
}
function detLezione() {
  const L = S.lesson;
  if (!L) return '<div style="color:var(--sub)">Caricamento…</div>';
  if (!L.ok) return `<div class="card" style="color:var(--sub)">Il file della lezione non si trova.<br><span style="font-size:12px;color:var(--faint)">${esc(L.file || '')}</span></div>
    ${REMOTE ? '<span style="color:var(--faint);font-size:12.5px">Si sceglie dal Mac, in Impostazioni.</span>' : '<button class="btn" data-a="nav" data-v="impostazioni" style="align-self:flex-start">Scegli il file in Impostazioni</button>'}`;
  const les = L.lesson;
  if (!les) return lessonPickHtml(L) + '<div class="card">Nessuna lezione per questa settimana: scegline una qui sopra.</div>';
  const doms = les.domande, q = doms[Math.min(S.qIdx, doms.length - 1)];
  const days = lessonDays();
  const pick = lessonPickHtml(L);
  const pills = pick + `<div class="seg" style="align-self:flex-start;flex-wrap:wrap"><button class="${S.intro ? 'on' : ''}" data-a="lezDay" data-v="intro">Sab · Intro</button>
    ${days.map((d) => `<button class="${!S.intro && q && q.day === d.name ? 'on' : ''}" data-a="lezDay" data-v="${d.first}">${esc((d.name || '').slice(0, 3))}</button>`).join('')}</div>`;
  if (S.intro) {
    const steps = [['Titolo', (les.number ? les.number + '. ' : '') + les.title], ['Versetto chiave', les.verse || '— da scrivere —'], ['Nota introduttiva', les.note || '— da scrivere —']];
    const liveStep = S.live.kind === 'intro' ? S.live.step : -1;
    return pills + `<div class="card" style="display:flex;flex-direction:column;gap:10px"><span class="label" style="color:#5aae5f">Sabato · introduzione</span>
      ${steps.map(([l, t], i) => `<div class="soft" style="display:flex;gap:12px;align-items:center;${i === liveStep ? 'background:rgba(52,199,89,.12);box-shadow:inset 0 0 0 1.5px rgba(52,199,89,.45)' : ''}">
        <span style="width:26px;height:26px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-weight:750;background:${i === liveStep ? 'var(--live);color:#fff' : 'var(--fill2)'}">${i + 1}</span>
        <div style="flex:1"><span class="label">${l}</span><div style="font-size:14.5px">${esc(t)}</div></div></div>`).join('')}
      <div style="display:flex;gap:8px"><button class="btn pri" data-a="projIntro">Proietta introduzione</button><button class="btn" data-a="editIntro">Modifica testi</button><button class="btn" data-a="cover">Copertina</button></div>
      <span style="font-size:12px;color:var(--faint)">Un passo alla volta: titolo, versetto chiave, nota. Avanti passa al successivo.</span></div>`;
  }
  if (!q) return pills;
  const isLive = S.live.kind === 'lesson' && S.live.qIdx === S.qIdx && S.live.part === 'domanda';
  return pills + `
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;gap:10px"><span class="label" style="color:#5aae5f;flex:1">${esc((q.day || '') + (q.day_title ? ' — ' + q.day_title : ''))} · Domanda ${q.day_index + 1}/${q.day_count}</span>
        ${isLive ? '<span style="display:flex;align-items:center;gap:6px;color:#2fb350;font-size:12px;font-weight:650"><span class="livedot"></span>In onda</span>' : ''}</div>
      <div style="font-size:22px;font-weight:620;line-height:1.35">${esc(q.question)}</div>
      <div style="display:flex;gap:8px;align-items:center"><button class="btn pri" data-a="projDomanda">Proietta domanda</button><span style="flex:1"></span>
        <button class="ibtn" data-a="qStep" data-d="-1" aria-label="Precedente">${svg('prev', 17, false, 2.2)}</button>
        <span style="color:var(--faint);font-size:12px">sfoglia senza proiettare</span>
        <button class="ibtn" data-a="qStep" data-d="1" aria-label="Successiva">${svg('next', 17, false, 2.2)}</button></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
      ${q.refs.map((r, i) => `<div class="soft" style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center"><b style="color:#de7949;flex:1;font-size:12.5px">${esc(r.resolved ? r.book_name + ' ' + r.chapter + ':' + r.verses.join(',') : r.raw)}</b>
        <button class="btn sm" data-a="projCit" data-i="${i}">Proietta</button></div><div style="color:var(--sub);font-size:13px">${esc(r.resolved ? r.texts.join(' ').slice(0, 260) : 'Riferimento non riconosciuto: verrà proiettato il testo scritto')}</div></div>`).join('')}
    </div>
    ${q.note ? `<div class="soft"><div style="display:flex;align-items:center"><b style="flex:1;color:var(--sub)">Nota</b><button class="btn sm" data-a="projNota">Proietta</button></div>
      <div style="color:var(--sub);font-style:italic;margin-top:6px">${esc(q.note.length > 420 ? q.note.slice(0, 420) + '…' : q.note)}</div></div>` : ''}`;
}
function detTimer() {
  const T = S.timer;
  return `<div style="display:flex;flex-direction:column;gap:18px;align-items:center">
    <div style="display:flex;align-items:center;gap:22px"><button class="ibtn" style="width:54px;height:54px;font-size:24px" data-a="tAdj" data-d="-60">−</button>
      <div id="timerBig" style="font-size:100px;font-weight:200;letter-spacing:-.04em;font-variant-numeric:tabular-nums">${fmt(T.remaining)}</div>
      <button class="ibtn" style="width:54px;height:54px;font-size:24px" data-a="tAdj" data-d="60">+</button></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">${[5, 10, 15, 20].map((m) => `<button class="btn sm" data-a="tSet" data-m="${m}">${m} min</button>`).join('')}</div>
    <div class="card" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:center;width:100%;max-width:560px;padding:18px">
      <span style="font-weight:700;font-size:17px">Oppure fino alle</span>
      <input type="time" id="tUntil" class="field" style="width:170px;height:58px;font-size:28px;font-weight:600;text-align:center;font-variant-numeric:tabular-nums" value="${esc(S.tUntilV || '')}">
      <button class="btn pri" data-a="tUntilGo" style="height:50px;border-radius:25px;padding:0 22px;font-size:15px">Avvia fino a quest'ora</button></div>
    <button class="btn pri" data-a="tToggle" style="width:100%;max-width:460px;height:50px;border-radius:25px;font-size:15px">${T.running ? 'Pausa' : 'Avvia timer e proietta'}</button>
    <div style="width:100%;max-width:520px">${playerHtml('pm', pmTitle(), 'pm')}</div>
    <span style="color:var(--faint);font-size:12px">La musica parte con il timer e sfuma 3 secondi prima dell'avviso.</span></div>`;
}
function detTesto(sl) {
  const sz = Math.round((sl.data.size || 1) * 100);
  setTimeout(textPreview, 0);
  return `<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
    <div style="flex:1;min-width:260px;display:flex;flex-direction:column;gap:10px">
      <textarea class="field" data-edit="slottext" data-id="${sl.id}" style="height:200px;padding:14px;resize:vertical;font-size:15px;line-height:1.5">${esc(sl.data.text || '')}</textarea>
      <label style="display:flex;align-items:center;gap:12px;font-weight:650;font-size:13px">Dimensione<input type="range" data-edit="slotsize" data-id="${sl.id}" min="40" max="250" step="5" value="${sz}" style="flex:1"><span id="tSize" style="width:46px;text-align:right;color:var(--sub)">${sz}%</span></label>
      <div class="det-acts"><button class="btn pri" data-a="projText" data-id="${sl.id}">Proietta</button></div></div>
    <div style="flex:1;min-width:260px;display:flex;flex-direction:column;gap:6px"><span class="label">Anteprima</span>
      <div id="tPrev" data-id="${sl.id}" style="position:relative;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:${esc(S.settings.text_bg_color || S.settings.verse_bg_color || '#0b132b')} ${(S.settings.text_bg_image || S.settings.verse_bg_image) && !window.NO_MEDIA ? `url('${media(S.settings.text_bg_image || S.settings.verse_bg_image)}') center/cover` : ''}"></div></div></div>`;
}
/* anteprima del testo come in proiezione: stesso riquadro, stessa ricerca della misura */
function fitIn(el, maxPx) {
  let lo = 4, hi = maxPx; el.style.fontSize = hi + 'px';
  if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) return;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; el.style.fontSize = mid + 'px'; if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) lo = mid; else hi = mid; }
  el.style.fontSize = lo + 'px';
}
function textPreview() {
  const box = $('#tPrev'); if (!box) return; const [, sl] = findSlot(box.dataset.id); if (!sl) return;
  const tb = S.settings.verse_text_box || [0.07, 0.1, 0.86, 0.8], H = box.clientHeight;
  box.innerHTML = `<div style="position:absolute;left:${tb[0] * 100}%;top:${tb[1] * 100}%;width:${tb[2] * 100}%;height:${Math.max(tb[3], 0.8) * 100}%;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;line-height:1.25;
    color:${esc(S.settings.verse_text_color || '#fff')};font-family:'${esc(S.settings.verse_font_family || 'Helvetica')}';font-weight:600;white-space:pre-line">${esc(sl.data.text || '')}</div>`;
  fitIn(box.firstChild, Math.round(H * 0.1 * (sl.data.size || 1)));
}
function detImmagine(sl) {
  const p = sl.data.path, live = S.live.kind === 'image' && S.live.image === p;
  // in onda: anteprima grande della proiezione; qui funzionano zoom (rotella), spostamento e puntatore
  return `${p ? (live ? `<div class="preview pvtools" id="bigPrev"><iframe class="pv" src="/output?preview=1" title="Anteprima grande" tabindex="-1"></iframe></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn sm" data-a="imgZoom" data-d="-1">−</button><button class="btn sm" data-a="imgZoom" data-d="0">${Math.round((S.live.iz || 1) * 100)}%</button><button class="btn sm" data-a="imgZoom" data-d="1">+</button>
        <button class="btn sm ${S.ptrOn ? 'on' : ''}" data-a="ptrToggle">${S.ptrOn ? 'Puntatore acceso' : 'Puntatore'}</button>
        <span style="color:var(--faint);font-size:12px">Rotella per lo zoom, trascina per spostarti, col puntatore acceso muovi il mouse sull'immagine.</span></div>`
    : `<img src="${media(p)}" alt="" style="max-width:100%;max-height:340px;border-radius:16px;object-fit:contain;align-self:flex-start">`) : ''}
    <div class="det-acts">${p ? `<button class="btn pri" data-a="projImage" data-p="${esc(p)}">Proietta</button>` : ''}<button class="btn" data-a="setPath" data-id="${sl.id}">${p ? 'Cambia file…' : 'Scegli file…'}</button></div>`;
}
function detQr() {
  const p = S.settings.offering_image;
  return p ? `<img src="${media(p)}" alt="Offerta" style="max-width:420px;border-radius:16px"><button class="btn pri" data-a="projImage" data-p="${esc(p)}" style="align-self:flex-start">Proietta offerta</button>`
    : '<div class="card">Nessuna immagine dell\'offerta impostata (Impostazioni).</div>';
}
function detPreghiera() {
  return `<div class="soft">${S.prayers.length} richieste</div><div style="display:flex;gap:8px"><button class="btn pri" data-a="projPrayers">Proietta elenco</button><button class="btn" data-a="nav" data-v="preghiere">Apri Preghiere</button></div>`;
}
const pickBtn = (sl, label) => `<button class="btn" data-a="setPath" data-id="${sl.id}">${label || (sl.data.path ? 'Cambia file…' : 'Scegli file…')}</button>`;
function detDeck(sl) {
  const p = sl.data.path;
  if (!p) return `<div style="display:flex;gap:8px">${pickBtn(sl, 'Scegli PowerPoint o PDF…')}</div>`;
  const live = S.live.kind === 'deck' && S.live.file === p ? S.live.i : -1;
  return `<div class="slides" ${/\.pdf$/i.test(p) ? 'data-pdf' : 'data-thumbs'}="${esc(p)}" data-id="${sl.id}" data-act="projDeck" data-live="${live}"></div>
    <div class="det-acts"><button class="btn pri" data-a="projDeck" data-id="${sl.id}" data-i="0">Proietta dall'inizio</button>${pickBtn(sl)}</div>`;
}
function detVideo(sl) {
  const p = sl.data.path;
  return `${p ? `<video src="${media(p)}#t=1" preload="metadata" muted playsinline style="max-width:100%;max-height:320px;border-radius:16px;background:#000;align-self:flex-start"></video>` : ''}
    <div class="det-acts">${p ? `<button class="btn pri" data-a="projVideo" data-id="${sl.id}">Proietta video</button>` : ''}${pickBtn(sl)}<button class="btn" data-a="ytAsk" data-id="${sl.id}">Da YouTube…</button></div>
    ${p ? '<span style="color:var(--faint);font-size:12px">Il video parte in pausa: avvialo dal pannello «In onda». L\'audio esce dal Mac.</span>' : ''}`;
}
function detAudio(sl) {
  const p = sl.data.path, base = $('#baseAudio');
  if (!p) return `<div style="display:flex;gap:8px">${pickBtn(sl)}</div>`;
  if (base.dataset.p !== p) { base.src = amedia(p); base.dataset.p = p; S.baseTitle = slotTitle(sl); }
  return playerHtml('base', S.baseTitle, 'base') + `<div style="display:flex">${pickBtn(sl)}</div>`;
}
function detGeneric(sl) {
  return `<div class="card" style="color:var(--sub)">${esc(sl.data.path || 'Questo tipo di elemento arriva nella prossima fase (PDF, video, documenti).')}</div>`;
}

/* ── Inni ───────────────────────────────────────────────────────────────── */
const snip = (t, q, n = 60) => { const i = t.toLowerCase().indexOf(q); if (i < 0) return esc(t.slice(0, 110)); const st = Math.max(0, i - 40);
  return (st ? '…' : '') + esc(t.slice(st, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length, i + q.length + n)) + '…'; };
const markQ = (t, q) => { const i = q ? t.toLowerCase().indexOf(q) : -1; return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); };
let textT = 0;
function hymnListHtml() {
  const q = S.hymnQ.toLowerCase().trim();
  let list = S.hymns.map((h, i) => [h, i]).filter(([h]) => (!S.baseOnly || h.audio) && (!q || h._k.includes(q) || (q.length > 2 && h._t.includes(q))));
  if (REMOTE && q.length > 2) {   // telefono: le parole del testo le cerca il Mac
    const hits = S.textHits && S.textHits.q === q + S.hymnsDb ? S.textHits.list : null;
    if (hits) { const seen = new Set(list.map(([h]) => h.path)); hits.forEach((x) => { const i = S.hymns.findIndex((h) => h.path === x.path); if (i >= 0 && !seen.has(x.path) && (!S.baseOnly || x.audio)) { S.hymns[i].slides = x.slides; list.push([S.hymns[i], i]); } }); }
    else { clearTimeout(textT); textT = setTimeout(async () => { const key = q + S.hymnsDb; const r = await api.get(`/api/search/hymns?limit=40&db=${encodeURIComponent(S.hymnsDb)}&q=${encodeURIComponent(q)}`);
      S.textHits = { q: key, list: r }; if (S.hymnQ.toLowerCase().trim() + S.hymnsDb === key && $('#hymnList')) $('#hymnList').innerHTML = hymnListHtml(); }, 300); }
  }
  if (!S.hymns.length) return `<div style="color:var(--sub);padding:20px">${S.hymnsDb ? 'Caricamento…' : 'Nessun innario: aggiungi una cartella in Impostazioni.'}</div>`;
  if (!list.length) return '<div style="color:var(--sub);padding:20px">Nessun inno trovato</div>';
  return list.slice(0, 600).map(([x, i]) => { const inText = q && !x._k.includes(q);
    return `<button class="list-row ${i === S.hymnSel ? 'sel' : ''}" data-a="pickHymn" data-i="${i}" style="${inText ? 'align-items:flex-start' : ''}">
    <span style="width:42px;font-weight:750;color:var(--faint);font-variant-numeric:tabular-nums">${markQ(x.number, q)}</span>
    <span style="flex:1;min-width:0"><span style="display:block;font-size:14.5px;font-weight:580">${markQ(x.title, q)}</span>${inText && x.slides ? `<span style="display:block;font-size:12.5px;color:var(--sub);margin-top:2px">${snip(x.slides.join(' · '), q)}</span>` : ''}</span>
    ${hymnEdit(x.path) ? `<span title="Modificato nell'app" style="color:var(--faint)">${svg('pen', 13)}</span>` : ''}${x.audio ? `<span style="color:#888dec">${svg('inno', 16, false, 2.2)}</span>` : ''}</button>`; }).join('');
}
// «Cambia inno / versetto»: si sceglie e si sostituisce l'elemento, senza aggiungerne un altro
const replaceBar = () => { const [, sl] = findSlot(S.replaceSlot); return sl ? `<div class="soft" style="display:flex;align-items:center;gap:10px;background:rgba(61,123,240,.14);box-shadow:inset 0 0 0 1.5px rgba(61,123,240,.5)">
  <span style="flex:1">Stai scegliendo per <b>«${esc(slotTitle(sl))}»</b> nella scaletta</span><button class="btn sm" data-a="cancelReplace">Annulla</button></div>` : ''; };
function hymnPrevHtml() {
  const h = S.hymns[S.hymnSel]; if (!h) return '';
  return `${SHEET_X}<div style="font-size:22px;font-weight:750">${esc(h.number)} · ${esc(h.title)}</div>
    <div class="slides scr" data-thumbs="${esc(h.path)}" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;flex:1;min-height:0;align-content:start"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${h.audio ? `<button class="btn sm" data-a="playBase">${svg('inno', 14, false, 2.2)}Base musicale</button>` : ''}
      <button class="btn sm" data-a="baseForHymn">${h.audio ? 'Cambia base…' : 'Aggiungi base…'}</button>
      <button class="btn sm" data-a="editHymn" data-p="${esc(h.path)}">Modifica testo e dimensione</button>
      <button class="btn sm danger" data-a="delHymn" data-p="${esc(h.path)}">${S.delHymn === h.path ? 'Sicuro? Tocca di nuovo' : 'Elimina inno'}</button></div>
    <div style="display:flex;gap:8px">${S.replaceSlot ? '<button class="btn" data-a="useHymn" style="height:48px;flex:1;background:var(--accent);color:#fff">Usa questo inno</button>' : '<button class="btn" data-a="addHymn" style="height:48px;flex:1">Aggiungi alla scaletta</button>'}
      <button class="btn pri" data-a="projHymnLib" style="height:48px;border-radius:24px;flex:1.4">Proietta adesso</button></div>`;
}
function viewInni() {
  const prev = `<div id="hymnPrev" class="sheet ${S.sheet ? 'open' : ''}" style="width:min(52%,760px);flex-shrink:0;display:flex;flex-direction:column;gap:12px;min-height:0">${hymnPrevHtml()}</div>`;
  const db = S.dbs.find((d) => d.path === S.hymnsDb) || { name: 'Nessun innario' };
  return `<section class="panel glass enter" style="flex:1;min-width:0;padding:22px;gap:14px">
    ${replaceBar()}<div style="display:flex;align-items:center;gap:12px"><h1 style="flex:1">Innario</h1><button class="btn pri" data-a="importHymn" style="height:36px">${svg('plus', 15)}Nuovo inno</button>
      <div data-pop style="position:relative"><button class="btn" data-a="dbMenu" style="height:36px">${svg('db', 15)}${esc(db.name)}<span style="color:var(--faint)">· ${S.hymns.length} inni</span>${svg('chev', 13, false, 2.4)}</button>
        ${S.dbMenu ? `<div class="popover solid pop" style="right:0;width:280px">${S.dbs.map((d) => `<button class="menu-row" data-a="pickDb" data-p="${esc(d.path)}" style="${d.path === S.hymnsDb ? 'background:var(--sel)' : ''}">${esc(d.name)}${d.exists ? '' : '<span style="color:var(--danger);font-size:11px">cartella non trovata</span>'}</button>`).join('')}
          <span style="display:block;height:1px;background:var(--line);margin:4px 6px"></span>
          <button class="menu-row" data-a="exportHymn" data-only="1">Esporta questo inno in PowerPoint…</button>
          <button class="menu-row" data-a="exportHymn">Esporta tutto l'innario in PowerPoint…</button>
          <button class="menu-row" data-a="addDb">Aggiungi un altro innario…</button></div>` : ''}</div></div>
    <label style="display:flex;align-items:center;gap:10px;height:46px;padding:0 8px 0 16px;border-radius:23px;background:var(--fill);box-shadow:inset 0 0 0 1px var(--line)">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="opacity:.5"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3"/></svg><input id="hymnQ" value="${esc(S.hymnQ)}" placeholder="Numero, titolo o una parola del testo" style="flex:1;background:none;border:0;outline:none;font-size:15px" aria-label="Cerca inno">
      <button class="btn sm ${S.baseOnly ? 'on' : ''}" data-a="baseOnly">${svg('inno', 14, false, 2.2)}Solo con base</button></label>
    <div style="display:flex;gap:18px;flex:1;min-height:0">
      <div class="scr" style="flex:1;min-width:300px;display:flex;flex-direction:column;gap:2px" id="hymnList">${hymnListHtml()}</div>
      ${REMOTE ? '' : prev}
    </div></section>${REMOTE ? prev : ''}`;   // sul telefono il foglio sta fuori dal pannello sfocato, sennò resta chiuso dentro
}

/* ── Bibbia ─────────────────────────────────────────────────────────────── */
/* ultimi versetti proiettati: un tocco e si rimandano */
function recentHtml() {
  const r = S.settings.bib_recent || [];
  return `<div class="bsec-r"><span class="label">Proiettati di recente</span><div class="recent">${r.length ? '' : '<span style="color:var(--faint);font-size:12.5px">Appariranno qui i versetti che proietti.</span>'}${r.map((x) => `<button class="btn sm" data-a="recentVerse" data-b="${x.b}" data-c="${x.c}" data-v="${x.v}">${esc(bookName(x.b))} ${x.c}:${x.v}</button>`).join('')}</div></div>`;
}
/* sul Mac i tasti si allargano per riempire l'altezza, senza scorrere (se non ci stanno, scorre) */
function fitBib() {
  if (REMOTE) return;
  $$('.bib .bgrid').forEach((g) => {
    const n = g.children.length; if (!n || !g.clientHeight) return;
    const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length, rows = Math.ceil(n / cols);
    const gap = parseFloat(getComputedStyle(g).rowGap) || 6, h = (g.clientHeight - gap * (rows - 1)) / rows;
    g.style.gridAutoRows = Math.max(40, Math.min(g.id === 'bookGrid' ? 80 : 72, h)) + 'px';
  });
}
window.addEventListener('resize', () => { if (S.view === 'bibbia') fitBib(); });
function viewBibbia() {
  const b = S.bib, nt = b.testament === 'NT';
  const books = b.books.filter((x, i) => (nt ? i >= 39 : i < 39));
  const vcount = b.verses.length;
  const liveV = S.live.kind === 'verse' && S.live.book === b.book && S.live.chapter === b.chapter ? S.live.verse : -1;
  return `<section class="panel glass enter" style="flex:1;min-width:0;padding:20px;gap:14px">
    ${replaceBar()}<div style="display:flex;align-items:center;gap:12px"><h1 style="flex:1">Bibbia</h1>
      <div class="seg">${S.langs.map((l) => `<button class="${l.code === lang() ? 'on' : ''}" data-a="bibLang" data-v="${l.code}">${l.code.toUpperCase()}</button>`).join('')}</div></div>
    <div class="bib" data-step="${S.bibStep || 0}" style="display:flex;gap:14px;flex:1;min-height:0">
      <div class="bib-books" style="flex:1.1;min-width:300px;display:flex;flex-direction:column;gap:10px;min-height:0">
        <div class="seg seg2" data-on="${nt ? 1 : 0}" style="display:grid;grid-template-columns:1fr 1fr"><button class="${!nt ? 'on' : ''}" data-a="testament" data-v="AT">Antico Testamento</button><button class="${nt ? 'on' : ''}" data-a="testament" data-v="NT">Nuovo Testamento</button></div>
        <div class="scr bgrid" id="bookGrid" style="--bc:${nt ? 3 : 4};display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px;align-content:start">
          ${books.map(([n, name]) => `<button class="book-btn ${n === b.book ? 'on' : ''}" data-a="book" data-v="${n}">${esc(name)}</button>`).join('')}</div>
        ${recentHtml()}
      </div>
      <div class="scr bib-nums" style="flex:.85;min-width:230px;display:flex;flex-direction:column;gap:8px">
        <button class="btn sm phone-only" data-a="bibStep" data-v="0" style="align-self:flex-start">${svg('prev', 14, false, 2.4)}${esc(bookName(b.book))}</button>
        <div class="bsec"><span class="label">Capitolo</span>
        <div class="bgrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:5px">${b.chapters.map((c) => `<button class="grid-btn ${c === b.chapter ? 'on' : ''}" data-a="chapter" data-v="${c}">${c}</button>`).join('')}</div>
        </div><div class="bsec"><span class="label">Versetto</span>
        <div class="bgrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:5px">${Array.from({ length: vcount }, (_, i) => `<button class="grid-btn ${i + 1 === b.verse ? 'on' : ''}" data-a="verseNum" data-v="${i + 1}">${i + 1}</button>`).join('')}</div></div>
      </div>
      <div class="scr bib-text" id="bibText" style="flex:1.7;min-width:0;display:flex;flex-direction:column;gap:6px">
        <button class="btn sm phone-only" data-a="bibStep" data-v="1" style="align-self:flex-start">${svg('prev', 14, false, 2.4)}Capitoli e versetti</button>
        <div style="display:flex;align-items:center;gap:10px;min-height:44px;position:sticky;top:0;z-index:2;background:var(--solid);border-radius:14px;padding:4px 4px 4px 10px"><span style="font-size:21px;font-weight:750;flex:1">${esc(bookName(b.book))} ${b.chapter}:${b.verse}</span>
          ${S.replaceSlot ? '<button class="btn sm pri" data-a="useVerse">Usa questo versetto</button>' : '<button class="btn sm" data-a="addVerse">+ Scaletta</button>'}<button class="btn sm pri" data-a="projVerse">Proietta</button></div>
        ${b.verses.map(([n, t]) => `<button class="list-row ${n === liveV ? '' : n === b.verse ? 'sel' : ''}" ${n === b.verse ? 'id="bibSel"' : ''} data-a="verseNum" data-v="${n}" style="align-items:flex-start;font-size:16px;${n === liveV ? 'background:rgba(52,199,89,.14);box-shadow:inset 0 0 0 1.5px rgba(52,199,89,.5)' : 'background:var(--fill)'}">
          <b style="width:28px;color:#de7949;flex-shrink:0">${n}</b><span style="flex:1;line-height:1.5">${esc(t)}</span>${n === liveV ? '<b style="color:#2fb350;font-size:11px">IN ONDA</b>' : ''}</button>`).join('')}
      </div>
    </div></section>`;
}

/* ── Media: video e audio scaricati da YouTube o caricati ─────────────── */
/* download in corso: barra di avanzamento in Media; a fine download l'elemento arriva dove serve */
let jobsT = 0;
async function pollJobs() {
  clearTimeout(jobsT);
  let jobs = []; try { jobs = await api.get('/api/youtube/jobs'); } catch (e) { /* riprova */ }
  S.jobs = jobs; S.jobDone = S.jobDone || new Set();
  for (const j of jobs) {
    if (j.status === 'run' || S.jobDone.has(j.id)) continue;
    S.jobDone.add(j.id); const to = (S.jobTo || {})[j.id];
    if (j.status === 'error') { toast('Download non riuscito: ' + j.error, false, 6000); continue; }
    toast((j.kind === 'audio' ? 'Audio scaricato: ' : 'Video scaricato: ') + j.name);
    if (to) { const [, sl] = findSlot(to.slot); if (sl) { sl.data.path = j.path; sl.display_name = j.name; saveSchedule(); renderMain(); } else if (to.add) { S.addTo = to.addTo; addFileSlot(j.path); } }
    S.media = null;
  }
  if (S.view === 'media') { const el = $('#mediaJobs'); if (el) el.innerHTML = jobsHtml(); if (!S.media) loadMedia(); }
  if (jobs.some((j) => j.status === 'run')) jobsT = setTimeout(pollJobs, 1000);
}
const jobsHtml = () => (S.jobs || []).filter((j) => j.status === 'run').map((j) => `<div class="soft" style="display:flex;flex-direction:column;gap:6px">
  <div style="display:flex;gap:8px;align-items:center"><span style="color:${COLORS[j.kind]}">${svg(j.kind, 15)}</span><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(j.name || 'Scarico…')}</b>
  <span style="font-variant-numeric:tabular-nums;color:var(--sub);font-size:12px">${j.pct >= 0.99 ? 'Preparo il file…' : Math.round(j.pct * 100) + '%'}</span></div>
  <div style="height:6px;border-radius:3px;background:var(--fill2);overflow:hidden"><div style="height:100%;width:${Math.round(j.pct * 100)}%;background:var(--accent);transition:width .8s ease"></div></div></div>`).join('');
async function loadMedia() { try { S.media = await api.get('/api/library'); } catch (e) { S.media = []; toast('Non riesco a leggere i media: riapri l\'app'); } if (S.view === 'media') $('#mediaList').innerHTML = mediaListHtml(); }
function mediaListHtml() {
  if (!S.media) { loadMedia(); return '<div style="color:var(--sub);padding:20px">Caricamento…</div>'; }
  const q = (S.mediaQ || '').toLowerCase().trim(), f = S.mediaF || 'tutti';
  const list = S.media.map((m, i) => [m, i]).filter(([m]) => (f === 'tutti' || m.kind === f) && (!q || m.name.toLowerCase().includes(q)));
  if (!list.length) return `<div style="color:var(--sub);padding:20px">${S.media.length ? 'Niente con questo nome' : 'Ancora vuota: scarica da YouTube, aggiungi un file o trascinalo qui.'}</div>`;
  return list.map(([m, i]) => `<div class="list-row mrow" style="cursor:default">
    <span class="ic" style="width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:${COLORS[m.kind]}2e;color:${COLORS[m.kind]}">${svg(m.kind, 16)}</span>
    <span class="mrow-t" style="flex:1;min-width:0"><span style="display:block;font-size:14.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${markQ(m.name, q)}</span>
      <span style="font-size:12px;color:var(--faint);white-space:nowrap">${m.kind === 'video' ? 'Video' : 'Audio'} · ${(m.size / 1048576).toFixed(1)} MB</span></span><span class="mrow-b">
    ${m.kind === 'audio' ? `<button class="btn sm" data-a="baseFromMedia" data-i="${i}" title="Diventa la base musicale di un inno">Usa come base…</button>` : ''}
    <button class="btn sm" data-a="mediaRename" data-i="${i}">Rinomina</button>
    <button class="btn sm" data-a="mediaAdd" data-i="${i}">+ Scaletta</button>
    <button class="btn sm pri" data-a="mediaPlay" data-i="${i}">${m.kind === 'video' ? 'Proietta' : 'Riproduci'}</button>
    <button class="ibtn" style="width:30px;height:30px" data-a="mediaDel" data-i="${i}" aria-label="Elimina">${svg('x', 11, false, 2.6)}</button></span></div>`).join('');
}
function viewMedia() {
  const f = S.mediaF || 'tutti';
  return `<section class="panel glass enter" style="flex:1;min-width:0;padding:22px;gap:14px" id="mediaView">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h1 style="flex:1">Media</h1>
      <button class="btn" data-a="ytAsk" data-kind="video">${svg('video', 15)}Video da YouTube</button><button class="btn" data-a="ytAsk" data-kind="audio">${svg('audio', 15)}Audio da YouTube</button>
      <button class="btn pri" data-a="mediaPick">Aggiungi file…</button></div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <label style="flex:1;min-width:220px;display:flex;align-items:center;gap:10px;height:44px;padding:0 16px;border-radius:22px;background:var(--fill);box-shadow:inset 0 0 0 1px var(--line)">
        <input id="mediaQ" value="${esc(S.mediaQ || '')}" placeholder="Cerca per nome" style="flex:1;background:none;border:0;outline:none;font-size:15px" aria-label="Cerca nei media"></label>
      <div class="seg">${[['tutti', 'Tutti'], ['video', 'Video'], ['audio', 'Audio']].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-a="mediaF" data-v="${k}">${l}</button>`).join('')}</div></div>
    <div id="mediaJobs" style="display:flex;flex-direction:column;gap:8px">${jobsHtml()}</div>
    <div class="scr" id="mediaList" style="flex:1;display:flex;flex-direction:column;gap:2px">${mediaListHtml()}</div></section>`;
}

/* ── Preghiere ──────────────────────────────────────────────────────────── */
function viewPreghiere() {
  return `<section class="panel glass enter scr" style="flex:1;min-width:0;padding:24px 26px;gap:16px">
    <div class="prayer-head" style="display:flex;align-items:center;gap:10px"><h1 style="flex:1">${S.prayers.length === 1 ? '1 richiesta' : S.prayers.length + ' richieste'} di preghiera</h1>
      <button class="btn" data-a="projPrayers" id="prBtn">${S.prSel && S.prSel.size ? 'Proietta le ' + S.prSel.size + ' scelte' : 'Proietta tutto l\'elenco'}</button><button class="btn pri" data-a="editPrayer" data-i="new">Nuova richiesta</button></div>
    <div class="prayer-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
      ${S.prayers.map((p, i) => { const c = p.color || PRAYER_COLORS[i % PRAYER_COLORS.length];
        return `<div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 16px">
        <input type="checkbox" data-a2="prSel" data-i="${i}" ${S.prSel && S.prSel.has(i) ? 'checked' : ''} aria-label="Scegli per l'elenco" style="width:20px;height:20px;accent-color:var(--accent)">
        <div style="width:44px;height:44px;border-radius:22px;background:${c}2e;color:${c};display:flex;align-items:center;justify-content:center;font-weight:750">${esc(p.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column"><b style="font-size:15px">${esc(p.name)}</b><span style="font-size:12.5px;font-weight:650;color:${c}">${esc(p.reason || '')}</span></div>
        <button class="ibtn" style="width:34px;height:34px" data-a="editPrayer" data-i="${i}" aria-label="Modifica">${svg('pen', 15)}</button>
        <button class="btn sm" data-a="projPrayer" data-i="${i}">Proietta</button></div>`; }).join('')}
    </div></section>`;
}

/* ── Impostazioni ───────────────────────────────────────────────────────── */
const UTI = { image: ['public.image'], audio: ['public.audio'], json: ['public.json'], pdf: ['com.adobe.pdf'], video: ['public.movie'],
  pptx: ['org.openxmlformats.presentationml.presentation', 'com.microsoft.powerpoint.ppt'], doc: ['org.openxmlformats.wordprocessingml.document', 'public.plain-text'],
  font: ['public.font', 'public.truetype-ttf-font', 'public.opentype-font'],
  deck: ['org.openxmlformats.presentationml.presentation', 'com.adobe.pdf'],
  hymnsrc: ['org.openxmlformats.presentationml.presentation', 'org.openxmlformats.wordprocessingml.document', 'public.plain-text'] };
async function pickInto(kind, library, prompt, types, multiple) {
  const r = await api.post('/api/pick', { kind, library, prompt, types: types ? UTI[types] : null, multiple });
  return r.paths || [];
}
const fileName = (p) => (p || '').split('/').filter(Boolean).pop() || '';
const CATS = [['versione', 'Versione e backup'], ['generale', 'Generale'], ['innari', 'Innari'], ['lezione', 'Lezione'], ['grafiche', 'Grafiche e sfondi'],
  ['versetti', 'Versetti e testi'], ['pausa', 'Pausa e timer'], ['campanello', 'Campanello'], ['offerta', 'Offerta e sfondo'], ['telefono', 'Telefono'], ['spazio', 'Spazio']];
const row = (label, inner, hint) => `<div style="display:flex;align-items:center;gap:14px;min-height:44px"><div style="width:210px;flex-shrink:0"><b style="font-weight:620">${label}</b>${hint ? `<div style="font-size:11.5px;color:var(--faint)">${hint}</div>` : ''}</div><div style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap">${inner}</div></div>`;
const fileRow = (label, key, lib, types, hint, folder) => row(label, `${S.settings[key] ? `<span class="soft" style="padding:8px 12px;font-size:12.5px">${esc(fileName(S.settings[key]))}</span>` : '<span style="color:var(--faint)">Nessuno</span>'}
  <button class="btn sm" data-a="pickSetting" data-k="${key}" data-lib="${lib}" data-t="${types || ''}" data-folder="${folder ? 1 : ''}">${S.settings[key] ? 'Cambia' : 'Scegli'}…</button>
  ${S.settings[key] ? `<button class="btn sm danger" data-a="clearSetting" data-k="${key}">Togli</button>` : ''}`, hint);
const colorIn = (key, def) => `<input type="color" data-setc="${key}" value="${esc(S.settings[key] || def)}" style="width:44px;height:32px;border:0;border-radius:10px;background:none;cursor:default">`;
const fontSel = (val, attr) => `<select class="field" ${attr} style="width:220px;height:36px">${FONTS.concat(FONTS.includes(val) || !val ? [] : [val]).map((f) => `<option ${f === val ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}</select>`;

async function loadSpace() { try { S.space = await api.get('/api/storage'); } catch (e) { return; } if (S.cat === 'spazio' && S.view === 'impostazioni') renderMain(); }
function viewSettings() {
  const st = S.settings;
  const card = (inner) => `<div class="card" style="display:flex;flex-direction:column;gap:6px">${inner}</div>`;
  let body = '';
  switch (S.cat) {
    case 'versione': body = card(`<span class="label">Versione installata</span><div style="font-size:30px;font-weight:750">${esc(S.version)}</div>
        <div style="color:var(--sub);font-size:12px">La 1 era l'app per computer; questa è la 2, il redesign. Le versioni successive arrivano da qui con un clic.</div>
        ${S.upd && S.upd.newer ? `<div class="soft" style="display:flex;flex-direction:column;gap:8px;margin-top:6px"><b style="font-size:15px">Disponibile la versione ${esc(S.upd.latest)}</b>
          ${S.upd.notes ? `<div style="color:var(--sub);white-space:pre-line;font-size:13px">${esc(S.upd.notes)}</div>` : ''}
          <button class="btn pri" data-a="doUpdate" style="align-self:flex-start">Aggiorna ora</button></div>` : `<div style="color:var(--faint);font-size:12px">${S.upd ? 'Hai l\'ultima versione.' : ''}</div>`}`)
      + card(`<span class="label">Dati dell'app</span><div style="font-size:12.5px;color:var(--sub)">${esc(S.data || '')}</div>
        <div style="display:flex;gap:8px;margin-top:4px"><button class="btn" data-a="backupExport">Esporta backup…</button><button class="btn" data-a="backupImport">Ripristina da backup…</button><button class="btn" data-a="migrateOld">Importa dall'app precedente…</button></div>`);
      break;
    case 'generale': body = card(row('Tema', `<div class="seg"><button class="${document.documentElement.dataset.theme === 'scuro' ? 'on' : ''}" data-a="theme" data-v="scuro">Scuro</button><button class="${document.documentElement.dataset.theme === 'chiaro' ? 'on' : ''}" data-a="theme" data-v="chiaro">Chiaro</button></div>`)
        + row('Località della chiesa', `<input class="field" data-set="church_place" value="${esc(st.church_place || 'Capolona (AR)')}" style="max-width:240px">`, 'Per il tramonto')
        + row('Coordinate', `<input class="field" data-set="church_lat" value="${esc(st.church_lat || 43.567)}" style="max-width:120px"><input class="field" data-set="church_lon" value="${esc(st.church_lon || 11.865)}" style="max-width:120px">`, 'Latitudine e longitudine, come su timeanddate.com')
        + row('Lingua principale della Bibbia', `<div class="seg">${S.langs.map((l) => `<button class="${l.code === lang() ? 'on' : ''}" data-a="bibLang" data-v="${l.code}">${l.label}</button>`).join('')}</div>`)
);
      break;
    case 'innari': setTimeout(fontBox, 0); body = card(`<span class="label">Innari</span>
        ${S.dbs.length ? S.dbs.map((d) => `<div class="soft" style="display:flex;gap:10px;align-items:center"><span style="color:#888dec">${svg('db', 16)}</span><b style="flex:1">${esc(d.name)}</b>
          ${d.exists ? '' : '<span style="color:var(--danger);font-size:12px">cartella mancante</span>'}<button class="btn sm" data-a="hymnalStyle" data-p="${esc(d.path)}">Stile dei nuovi inni</button><button class="btn sm danger" data-a="removeDb" data-p="${esc(d.path)}">Togli</button></div>`).join('') : '<div style="color:var(--faint)">Nessun innario. Aggiungi la cartella con i PowerPoint degli inni (e le basi musicali, se ci sono).</div>'}
        <button class="btn pri" data-a="addDb" style="align-self:flex-start;margin-top:6px">Aggiungi innario…</button>
        <span id="fontBox"></span>
        <span style="font-size:12px;color:var(--faint)">La cartella viene copiata dentro l'app. Le basi musicali vengono riconosciute dal numero dell'inno. Lo stile dei nuovi inni (sfondo, carattere, colore) viene letto dagli inni che ci sono già: puoi cambiarlo.</span>`);
      break;
    case 'lezione': {
      const L = S.lesson || {};
      body = card(row('File del lezionario', `${st.lesson_file ? `<span class="soft" style="padding:8px 12px;font-size:12.5px">${esc(fileName(st.lesson_file))}</span>` : '<span style="color:var(--faint)">Nessuno</span>'}
          <button class="btn sm" data-a="pickLesson">${st.lesson_file ? 'Cambia' : 'Scegli'}…</button>`, 'Il file JSON del trimestre')
        + (L.ok ? row('Lezione da usare', `<select class="field" data-a2="lessonPick" style="max-width:360px;height:38px"><option value="-1" ${L.index < 0 ? 'selected' : ''}>Automatica (per data)</option>${L.titles.map((t, i) => `<option value="${i}" ${L.index === i ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`) : '')
        + (st.lesson_file && !L.ok ? '<div style="color:var(--danger);font-size:12.5px">Il file non si legge.</div>' : '')
        + row('Numerazione delle domande', `<div class="seg"><button class="${st.lesson_question_numbering !== 'numbers' ? 'on' : ''}" data-a="setVal" data-k="lesson_question_numbering" data-v="letters">a, b, c</button><button class="${st.lesson_question_numbering === 'numbers' ? 'on' : ''}" data-a="setVal" data-k="lesson_question_numbering" data-v="numbers">1, 2, 3</button></div>`))
        + card('<span class="label">Grafiche della lezione</span><span style="color:var(--sub)">Modelli, posizione e colori dei testi sono in «Grafiche e sfondi».</span><button class="btn sm" data-a="cat" data-v="grafiche" style="align-self:flex-start">Apri Grafiche e sfondi</button>');
      break; }
    case 'grafiche': body = graphicsEditor(); break;
    case 'versetti': body = card(row('Sfondo', `${colorIn('verse_bg_color', '#0b132b')}`) + fileRow('Immagine di sfondo', 'verse_bg_image', 'immagini', 'image', 'Usata quando non c\'è un modello')
        + row('Colore del testo', colorIn('verse_text_color', '#ffffff')) + row('Colore del riferimento', colorIn('verse_ref_color', '#b9b2a2'))
        + row('Carattere del testo', fontSel(st.verse_font_family || 'Helvetica', 'data-set="verse_font_family"'))
        + row('Carattere del riferimento', fontSel(st.verse_ref_font_family || 'Helvetica', 'data-set="verse_ref_font_family"')))
;
      break;
    case 'pausa': body = card(fileRow('Musica di pausa', 'background_music_folder', 'musica', '', 'Una cartella di brani', true)
        + row('Minuti predefiniti', `<input class="field" type="number" min="1" max="120" data-set="timer_default_minutes" value="${esc(st.timer_default_minutes || 10)}" style="max-width:90px">`)
        + row('Testo sopra il conto alla rovescia', `<input class="field" data-set="timer_text" value="${esc(st.timer_text || 'Il programma riprenderà tra')}">`)
        + row('Colori', `Sfondo ${colorIn('timer_bg_color', '#0b132b')} Testo ${colorIn('timer_text_color', '#ffffff')}`)
        + fileRow('Immagine di sfondo', 'timer_bg_image', 'immagini', 'image')
        + row('Avviso prima della fine', `<input class="field" type="number" min="0" max="600" data-set="timer_warning_seconds" value="${esc(st.timer_warning_seconds ?? 60)}" style="max-width:90px"> secondi`)
        + fileRow('Suono dell\'avviso', 'timer_warning_sound', 'suoni', 'audio')
        + row('A fine tempo', `<div class="seg"><button class="${st.timer_auto_bell ? 'on' : ''}" data-a="setVal" data-k="timer_auto_bell" data-v="1">Suona il campanello</button><button class="${!st.timer_auto_bell ? 'on' : ''}" data-a="setVal" data-k="timer_auto_bell" data-v="">Niente</button></div>`));
      break;
    case 'campanello': body = card(fileRow('Suono del campanello', 'bell_sound', 'suoni', 'audio') + row('', '<button class="btn sm" data-a="testBell">Prova</button>'));
      break;
    case 'telefono': body = card(row('PIN del telefono', `<input class="field" data-set="phone_pin" inputmode="numeric" maxlength="8" value="${esc(st.phone_pin || '')}" placeholder="es. 4821" style="max-width:140px;letter-spacing:.2em">`, 'Solo per il collegamento senza internet (in fondo).')
        + `<div id="phoneBox" style="color:var(--sub)">…</div>`); setTimeout(phoneBox, 0);
      break;
    case 'spazio': { const sp = S.space; if (!sp) { loadSpace(); body = card('<span style="color:var(--sub)">Calcolo…</span>'); break; }
      const B = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB';
      const bar = (used, tot) => `<div style="height:8px;border-radius:4px;background:var(--fill);overflow:hidden"><div style="height:100%;width:${Math.max(1, Math.min(100, used / tot * 100))}%;background:var(--accent)"></div></div>`;
      const line = (l, n) => `<div style="display:flex;justify-content:space-between"><span>${esc(l)}</span><b>${B(n)}</b></div>`;
      const mine = sp.app.reduce((a, x) => a + x[1], 0) + sp.hymnals.reduce((a, x) => a + x[1], 0);
      body = card(`<span class="label">Su questo Mac</span><div style="font-size:22px;font-weight:750">${B(mine)} usati dall'app</div>
          ${sp.app.map((x) => line(x[0], x[1])).join('')}${sp.hymnals.map((x) => line('Innario «' + x[0] + '»', x[1])).join('')}
          ${bar(sp.disk.total - sp.disk.free, sp.disk.total)}<div style="color:var(--sub)">Rimangono <b>${B(sp.disk.free)}</b> liberi sul disco, su ${B(sp.disk.total)}.</div>`)
        + card(`<span class="label">Su Firebase (piano gratuito)</span>
          <div>Dati del telefono: <b>${sp.fb == null ? 'non leggibili ora (telefono non collegato)' : B(sp.fb)}</b> su 1 GB${sp.fb == null ? '' : ' · ne rimangono <b>' + B(1e9 - sp.fb) + '</b>'}</div>${sp.fb == null ? '' : bar(sp.fb, 1e9)}
          <div>Pagina del telefono pubblicata: circa <b>${B(sp.web)}</b> su 10 GB · ne rimangono <b>${B(1e10 - sp.web)}</b></div>${bar(sp.web, 1e10)}
          <div style="font-size:11.5px;color:var(--faint)">Sono stime: il consumo mensile di traffico lo mostra solo la console di Firebase (limite gratuito: 10 GB di traffico dati al mese).</div>`);
      break; }
    case 'offerta': body = card(fileRow('Immagine dell\'offerta', 'offering_image', 'immagini', 'image', 'Con il QR code')
        + row('Testo sotto l\'immagine', `<input class="field" data-set="offering_text" value="${esc(st.offering_text || '')}">`))
      + card(fileRow('Sfondo (comando «Sfondo»)', 'background_image', 'immagini', 'image', 'Se vuoto: il logo su blu'));
      break;
  }
  return `<nav class="panel glass enter scr" style="width:230px;flex-shrink:0;padding:16px 10px;gap:2px">
      ${CATS.map(([k, l]) => `<button class="menu-row" data-a="cat" data-v="${k}" style="${S.cat === k ? 'background:var(--accent);color:#fff' : 'color:var(--sub)'}">${l}</button>`).join('')}</nav>
    <section class="panel glass enter scr" style="flex:1;min-width:0;padding:24px 26px;gap:16px"><h1>${CATS.find((c) => c[0] === S.cat)[1]}</h1>${body}</section>`;
}

/* editor dei modelli grafici: immagine + riquadri trascinabili */
function graphicsEditor() {
  const name = S.gtab || 'domanda';
  const profs = S.settings.lesson_graphic_profiles || {};
  const prof = profs[name] || {};
  const boxes = boxesOf(prof, name);
  const defs = BOX_DEFS[name].filter(([k]) => k in boxes);
  const LESSON = ['introduzione', 'intro_versetto', 'intro_nota', 'domanda', 'nota', 'versetto_lezione', 'versetto_bibbia'];
  const tb = (ks) => ks.map((k) => `<button class="${k === name ? 'on' : ''}" data-a="gtab" data-v="${k}">${PROFILE_LABELS[k]}</button>`).join('');
  const tabs = `<div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="label" style="width:84px">Lezione e Bibbia</span><div class="seg" style="flex-wrap:wrap">${tb(LESSON)}</div></div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="label" style="width:84px">Altro</span><div class="seg" style="flex-wrap:wrap">${tb(Object.keys(BOX_DEFS).filter((k) => !LESSON.includes(k)))}</div></div></div>`;
  const custom = !LESSON.includes(name) || /^intro/.test(name);   // testi, preghiere, timer, attesa, introduzione: si dispongono anche senza immagine
  if (!prof.template && !custom) return tabs + `<div class="card" style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
    <div style="color:var(--sub)">Nessun modello per «${PROFILE_LABELS[name]}»: si usa la grafica semplice.</div>
    <button class="btn pri" data-a="pickTemplate">Carica il modello (immagine)…</button></div>`;
  const C = prof.colors || {}, M = prof.max_sizes || {};
  return tabs + `<div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap">
    <div id="gEditor" data-prof="${name}" style="position:relative;width:620px;max-width:100%;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px var(--line);user-select:none">
      ${prof.template ? `<img src="${media(prof.template)}" alt="" style="display:block;width:100%" draggable="false">` : `<div style="aspect-ratio:16/9;background:${/^intro/.test(name) ? introBg((curLesson() || {}).photo) : name === 'testo' ? (S.settings.verse_bg_color || '#0b132b') : name === 'timer' ? (S.settings.timer_bg_color || '#0b132b') : name === 'attesa' ? '#000' : 'radial-gradient(circle at 50% 40%, #2a1622, #0b0d18 75%)'}"></div>`}
      ${defs.map(([k, label, col]) => { const b = boxes[k]; return `<div data-box="${k}" style="position:absolute;left:${b[0] * 100}%;top:${b[1] * 100}%;width:${b[2] * 100}%;height:${b[3] * 100}%;border:2px solid ${col};border-radius:4px;background:${col}1a;cursor:move;box-sizing:border-box">
        <span style="position:absolute;left:4px;top:2px;font-size:10.5px;font-weight:700;color:${col};text-shadow:0 1px 2px #000">${label}</span>
        <span data-handle="${k}" style="position:absolute;right:-6px;bottom:-6px;width:13px;height:13px;border-radius:7px;background:${col};box-shadow:0 0 0 2px rgba(0,0,0,.5);cursor:nwse-resize"></span></div>`; }).join('')}
    </div>
    <div class="card" style="flex:1;min-width:280px;display:flex;flex-direction:column;gap:10px">
      <span class="label">Colori e dimensioni</span>
      ${defs.filter(([k]) => k !== 'photo').map(([k, label]) => `<div style="display:flex;align-items:center;gap:10px"><span style="flex:1;font-weight:600">${label}</span>
        <input type="color" data-gcolor="${k}" value="${esc(C[k] || (name === 'domanda' && k === 'riferimento' ? (prof.template ? '#5b3a1f' : '#e9c48f') : plainIntro(prof, name) && k !== 'header' && k !== 'testo' ? '#e9c48f' : /^intro/.test(name) ? '#ffffff' : k === 'header' ? '#5aae5f' : k === 'date' ? '#e38d3d' : k === 'riferimento' ? '#b9b2a2' : '#ffffff'))}" style="width:40px;height:30px;border:0;background:none">
        <input type="range" min="0" max="200" value="${M[k] || 0}" data-gsize="${k}" title="Dimensione massima (0 = automatica)" style="width:110px"></div>`).join('')}
      <span class="label" style="margin-top:6px">Carattere</span>${fontSel(prof.font_family || S.settings.verse_font_family || 'Helvetica', 'data-gfont="1"')}
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-a="pickTemplate">${prof.template ? 'Cambia immagine…' : 'Immagine di sfondo…'}</button>${prof.template ? '<button class="btn sm danger" data-a="removeTemplate">Togli l\'immagine</button>' : ''}
        ${custom && S.settings.lesson_graphic_profiles && S.settings.lesson_graphic_profiles[name] ? '<button class="btn sm" data-a="resetProfile">Torna alla grafica di base</button>' : ''}</div>
      ${name === 'attesa' ? `<span class="label" style="margin-top:8px">Quando non c'è niente in onda</span>
        ${fileRow('Animazione (video che si ripete)', 'idle_video', 'video', 'video', 'Al posto dell\'immagine')}
        ${row('Scritta', `<input class="field" data-set="idle_text" value="${esc(S.settings.idle_text || '')}" placeholder="es. Benvenuti">`)}` : ''}
      <span style="font-size:12px;color:var(--faint)">Trascina i riquadri per spostarli, il pallino in basso a destra per ridimensionarli. Si salvano da soli.</span>
    </div></div>`;
}
function saveProfile(name, patch) {
  const profs = Object.assign({}, S.settings.lesson_graphic_profiles || {});
  profs[name] = Object.assign({}, profs[name] || {}, patch);
  setSetting('lesson_graphic_profiles', profs);
}
function setupGraphicsEditor() {
  let drag = null;
  document.addEventListener('pointerdown', (e) => {
    const ed = e.target.closest && e.target.closest('#gEditor'); if (!ed) return;
    const handle = e.target.closest('[data-handle]'), box = e.target.closest('[data-box]'); if (!box) return;
    e.preventDefault();
    const r = ed.getBoundingClientRect();
    drag = { ed, box, key: box.dataset.box, resize: !!handle, x0: e.clientX, y0: e.clientY, W: r.width, H: r.height,
      b: ['left', 'top', 'width', 'height'].map((p) => parseFloat(box.style[p]) / 100) };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x0) / drag.W, dy = (e.clientY - drag.y0) / drag.H;
    let [x, y, w, h] = drag.b;
    if (drag.resize) { w = Math.max(0.03, Math.min(1 - x, w + dx)); h = Math.max(0.03, Math.min(1 - y, h + dy)); }
    else { x = Math.max(0, Math.min(1 - w, x + dx)); y = Math.max(0, Math.min(1 - h, y + dy)); }
    drag.cur = [x, y, w, h];
    Object.assign(drag.box.style, { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: h * 100 + '%' });
  });
  document.addEventListener('pointerup', () => {
    if (!drag || !drag.cur) { drag = null; return; }
    const name = drag.ed.dataset.prof, prof = (S.settings.lesson_graphic_profiles || {})[name] || {};
    saveProfile(name, { [plainIntro(prof, name) ? 'pboxes' : 'boxes']: Object.assign({}, boxesOf(prof, name), { [drag.key]: drag.cur.map((v) => +v.toFixed(4)) }) });
    drag = null;
  });
  document.addEventListener('change', (e) => {
    const el = e.target, name = S.gtab || 'domanda', prof = (S.settings.lesson_graphic_profiles || {})[name] || {};
    if (el.dataset.gcolor) saveProfile(name, { colors: Object.assign({}, prof.colors || {}, { [el.dataset.gcolor]: el.value }) });
    if (el.dataset.gsize) saveProfile(name, { max_sizes: Object.assign({}, prof.max_sizes || {}, { [el.dataset.gsize]: +el.value }) });
    if (el.dataset.gfont) saveProfile(name, { font_family: el.value });
    if (el.dataset.setc) setSetting(el.dataset.setc, el.value);
    if (el.dataset.a2 === 'prSel') { S.prSel = S.prSel || new Set(); el.checked ? S.prSel.add(+el.dataset.i) : S.prSel.delete(+el.dataset.i);
      $('#prBtn').textContent = S.prSel.size ? 'Proietta le ' + S.prSel.size + ' scelte' : 'Proietta tutto l\'elenco'; }
    if (el.dataset.a2 === 'lessonPick') { S.qIdx = 0; S.intro = false; setSetting('lesson_override_index', +el.value).then(loadLesson); }
  });
}

/* ── dock «In onda» ─────────────────────────────────────────────────────── */
function renderDock() {
  const L = S.live, base = $('#baseAudio'), pm = $('#pmAudio');
  const baseOn = !!base.src && (!base.paused || L.kind === 'hymn');
  const pmOn = S.pm.on;
  const open = L.kind !== 'none' || baseOn || pmOn;
  $('#moreBtn').classList.toggle('offdot', !REMOTE && S.outputs === 0);
  $('#dock').classList.toggle('open', open);
  const rb = $('.rbtn'); if (rb) rb.classList.toggle('live', L.kind !== 'none');
  document.body.classList.toggle('onair', L.kind !== 'none');
  $('#preview').classList.toggle('private', !!L.overlay);
  $('#roomWrap').style.display = L.overlay ? 'flex' : 'none';   // con Nero/Sfondo/Congela: cosa vede la sala, sotto il lavoro privato
  scalePreview();
  const words = (L.main || '').split(/\s+/).filter(Boolean);
  const hl = S.hl;
  const canWords = ['verse', 'lesson', 'intro', 'text'].includes(L.kind) && words.length > 1 && L.style !== 'timer';
  let ctx = '';
  if (L.kind === 'verse') ctx = `<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span class="label" style="margin-right:2px">Lingue</span>${S.langs.map((l) => `<button class="btn sm ${(L.langs || []).includes(l.code) ? 'on' : ''}" data-a="liveLang" data-v="${l.code}" style="height:28px;padding:0 9px">${l.code.toUpperCase()}</button>`).join('')}</div>`;
  if (L.kind === 'lesson' && L.part !== 'domanda') ctx = `<div style="display:flex;gap:6px"><button class="btn sm pri" data-a="projDomanda" style="flex:1;height:38px">Torna alla domanda</button>${L.part === 'citazione' ? '<button class="btn sm" data-a="projNota" style="height:38px">Nota</button>' : ''}</div>`;
  if (L.kind === 'video') { const dur = vdur(L.file), pos = vpos(L);
    ctx = `<div class="soft" style="display:flex;flex-direction:column;gap:8px"><input type="range" id="vseek" min="0" max="${Math.round(dur) || 1}" step="0.1" value="${pos}" style="width:100%">
      <div style="display:flex;align-items:center;gap:8px"><button class="ibtn" data-a="vRestart" aria-label="Torna all'inizio">${svg('restart', 15, false, 2.2)}</button>
      <button class="ibtn" data-a="vSkip" data-s="-10" aria-label="Indietro 10 secondi" style="font-size:11px;font-weight:750;width:40px">−10</button>
      <button class="btn sm pri" data-a="vToggle" style="flex:1;height:38px">${svg(L.playing ? 'pause' : 'play', 13, true)}${L.playing ? 'Pausa' : 'Riproduci'}</button>
      <button class="ibtn" data-a="vSkip" data-s="10" aria-label="Avanti 10 secondi" style="font-size:11px;font-weight:750;width:40px">+10</button>
      <span id="vtime" style="font-variant-numeric:tabular-nums;color:var(--sub);font-size:12px;width:92px;text-align:right">${fmt(Math.floor(pos))} / ${fmt(Math.floor(dur))}</span></div>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--sub)"><span style="flex:1">Velocità</span>
        <button class="ibtn" style="width:30px;height:30px" data-a="vRate" data-d="-0.05" aria-label="Più lento">−</button>
        <button class="btn sm" data-a="vRate" data-d="0" style="height:30px;min-width:62px">${Math.round((L.vrate || 1) * 100)}%</button>
        <button class="ibtn" style="width:30px;height:30px" data-a="vRate" data-d="0.05" aria-label="Più veloce">+</button></div></div>`; }
  if (L.style === 'image') ctx = `<div class="soft" style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:6px">
      <span class="label" style="flex:1">Zoom</span><button class="ibtn" style="width:32px;height:32px" data-a="imgZoom" data-d="-1" aria-label="Riduci">−</button>
      <button class="btn sm" data-a="imgZoom" data-d="0" style="height:32px;min-width:64px">${Math.round((L.iz || 1) * 100)}%</button>
      <button class="ibtn" style="width:32px;height:32px" data-a="imgZoom" data-d="1" aria-label="Ingrandisci">+</button></div>
      <span style="font-size:11.5px;color:var(--faint)">Sull'anteprima: rotella per lo zoom, trascina per spostarti.</span></div>`;
  if (L.kind === 'hymn' || L.kind === 'deck') ctx = `<div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px">${Array.from({ length: L.count || 0 }, (_, i) => `<button class="grid-btn ${i === L.i ? 'on' : ''}" style="${i === L.i ? 'background:var(--live)' : ''}" data-a="hymnSlide" data-i="${i}">${i + 1}</button>`).join('')}</div>`;
  const room = L.overlay ? `<div class="soft pop" style="display:flex;gap:10px;align-items:center;background:rgba(100,180,255,.12);box-shadow:inset 0 0 0 1.5px rgba(100,180,255,.45)">
      <b style="color:#64b4ff;font-size:11px;letter-spacing:.08em;white-space:nowrap">IN SALA: ${L.overlay.toUpperCase()}</b><span style="font-size:12px">Quello che fai ora lo vedi solo tu. Riclicca per mandarlo in sala.</span></div>` : '';
  const off = !REMOTE && S.outputs === 0 && L.kind !== 'none' ? `<div class="soft pop" style="display:flex;gap:10px;align-items:center;background:rgba(229,83,75,.12);box-shadow:inset 0 0 0 1.5px rgba(229,83,75,.45)">
      <span class="offpulse"></span><span style="flex:1;font-size:12.5px">I proiettori sono spenti: in sala non si vede niente.</span><button class="btn sm pri" data-a="openOutputs">Accendi</button></div>` : '';
  $('#dockBody').innerHTML = `${off}${room}
    ${L.kind !== 'none' ? `<div class="dtitle"><div style="font-weight:700;font-size:15px">${esc(L.label || '')}</div><div style="color:var(--faint);font-size:12px">${esc(L.sub || '')}</div></div>${ctx}
    ${canWords ? `<div class="soft" style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;align-items:center;gap:8px"><span class="label" style="flex:1">Trascina per evidenziare</span>
      <button class="btn sm ${S.zoom ? 'on' : ''}" data-a="zoom" style="height:24px;padding:0 10px;font-size:11px">Zoom</button><button data-a="clearHl" style="font-size:11px;font-weight:650;color:var(--sub)">Togli</button></div>
      <div class="words" id="words">${words.map((w, i) => (i ? `<span class="sp" data-s="${i - 1}"> </span>` : '') + `<span data-w="${i}">${esc(w)}</span>`).join('')}</div></div>` : ''}
    <div class="dnav" style="display:flex;gap:8px"><button class="btn" data-a="step" data-d="-1" style="flex:1;height:${REMOTE ? 92 : 46}px;border-radius:${REMOTE ? 34 : 23}px" aria-label="Indietro">${svg('prev', 20, false, 2.2)}</button>
      <button class="btn pri" data-a="step" data-d="1" style="flex:2;height:${REMOTE ? 92 : 46}px;border-radius:${REMOTE ? 34 : 23}px">Avanti ${svg('next', 18, false, 2.2)}</button>
      ${REMOTE ? '' : '<button class="ibtn" data-a="stop" style="width:46px;height:46px;border-radius:23px;background:rgba(255,69,58,.14);color:var(--danger)" aria-label="Togli proiezione"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg></button>'}</div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">${['nero', 'sfondo', 'congela'].map((k) => `<button class="btn sm ${L.overlay === k ? 'on' : ''}" data-a="overlay" data-v="${k}" style="height:40px;border-radius:20px">${svg(k, 16, false, 1.9)}${cap(k)}</button>`).join('')}</div>
    ${REMOTE ? '' : `<button class="btn sm ${S.ptrOn ? 'on' : ''}" data-a="ptrToggle" style="height:38px;border-radius:19px">${svg('pointer', 15, false, 2)}${S.ptrOn ? 'Puntatore acceso: muovi il mouse sull\'anteprima' : 'Puntatore'}</button>`}${REMOTE ? `<button class="btn sm" data-a="stop" style="height:40px;border-radius:20px;color:var(--danger);background:rgba(255,69,58,.14)">Smetti di proiettare</button>` : ''}` : ''}
    ${pmOn ? playerHtml('pm', pmTitle(), 'pm') : ''}
    ${baseOn ? playerHtml('base', S.baseTitle || 'Base musicale', 'base') : ''}`;
}
function scalePreview() {
  [['#preview', 308], ['#roomPrev', 190], ['#bigPrev', 700]].forEach(([id, dw]) => { const p = $(id); if (!p) return; $('iframe', p).style.transform = `scale(${(p.clientWidth || dw) / 1920})`; });
}

/* ── proiezione: costruzione degli stati ───────────────────────────────── */
function curLesson() { return S.lesson && S.lesson.lesson; }
function dateBadge(iso) { if (!iso) return ''; const d = new Date(iso + 'T12:00'); return cap(GIORNI[d.getDay()].slice(0, 3)) + ', ' + d.getDate() + ' ' + cap(MESI[d.getMonth()].slice(0, 3)); }
function lessonHeader(q) { return { top: q.day_title ? q.day_position + '. ' + q.day_title.toUpperCase() : '', date: dateBadge(q.date) }; }
function projDomanda() {
  const les = curLesson(); if (!les) return; const q = les.domande[S.qIdx]; if (!q) return;
  const marker = (S.settings.lesson_question_numbering === 'numbers') ? String(q.day_index + 1) : String.fromCharCode(97 + q.day_index);
  setLive(Object.assign(lessonHeader(q), { kind: 'lesson', part: 'domanda', profile: 'domanda', style: 'domanda', qIdx: S.qIdx, slotId: S.sel,
    marker: marker + '.', main: q.question, ref: q.verses.join('; '), photo: les.photo,
    label: 'Lezione ' + (les.number || '') + ' — Domanda ' + (q.day_index + 1), sub: (q.day || '') + ' · Avanti passa alla domanda dopo' }));
  if (S.view === 'scaletta') renderMain();
}
function projNota() {
  const les = curLesson(); const q = les && les.domande[S.qIdx]; if (!q || !q.note) return;
  setLive(Object.assign(lessonHeader(q), { kind: 'lesson', part: 'nota', profile: 'nota', style: 'plain', qIdx: S.qIdx, slotId: S.sel, main: q.note, italic: true,
    label: 'Lezione — Nota', sub: 'Domanda ' + (q.day_index + 1) }));
}
function projCit(i) {
  const les = curLesson(); const q = les && les.domande[S.qIdx]; if (!q) return; const r = q.refs[i];
  const pos = 0;
  const st = Object.assign(lessonHeader(q), { kind: 'lesson', part: 'citazione', profile: 'versetto_lezione', style: 'plain', qIdx: S.qIdx, slotId: S.sel, ref: '', cit: i, pos });
  if (r.resolved) { st.main = r.texts[pos]; st.ref = r.book_name + ' ' + r.chapter + ':' + r.verses[pos]; }
  else { st.main = r.raw; }
  st.serif = true; st.label = st.ref || r.raw; st.sub = 'Versetto citato nella domanda ' + (q.day_index + 1);
  setLive(st);
}
function projIntro(step = 0) {
  const les = curLesson(); if (!les) return;
  // ogni passo ha la sua grafica; senza modello: lo sfondo con la foto, testi disposti in Impostazioni › Grafiche
  const profile = ['introduzione', 'intro_versetto', 'intro_nota'][step];
  const ref = les.verse_ref || '';
  const texts = [les.title.toLocaleUpperCase('it'), les.verse || '', les.note || ''];
  setLive({ kind: 'intro', profile, ref: step === 1 ? ref : '', style: 'intro', step, slotId: S.sel, main: texts[step], kicker: ['Lezione ' + (les.number || ''), 'Versetto chiave', 'Introduzione'][step],
    date: dateBadge(les.sabato), photo: les.photo, label: 'Introduzione — ' + ['titolo', 'versetto chiave', 'nota introduttiva'][step], sub: 'Passo ' + (step + 1) + ' di 3' });
  if (S.view === 'scaletta') renderMain();
}
async function projVerseRef(book, chapter, verse, langs, slotId) {
  langs = langs && langs.length ? langs : [lang()];
  const texts = await api.get(`/api/bible/verse?book=${book}&ch=${chapter}&v=${verse}&langs=${langs.join(',')}`);
  const ref = bookName(book) + ' ' + chapter + ':' + verse;
  setLive({ kind: 'verse', profile: 'versetto_bibbia', style: 'plain', serif: true, book, chapter, verse, langs, slotId: slotId || null,
    main: texts[langs[0]] || '', extra: langs.slice(1).map((c) => texts[c]).filter(Boolean), ref, label: ref, sub: 'Versetto · ' + langs.map((c) => c.toUpperCase()).join(' + ') });
  const rec = [{ b: book, c: chapter, v: verse }].concat((S.settings.bib_recent || []).filter((x) => !(x.b === book && x.c === chapter && x.v === verse))).slice(0, 8);
  if (!REMOTE) setSetting('bib_recent', rec); else S.settings.bib_recent = rec;
  if (S.view === 'bibbia') renderMain();
}
async function projHymn(h, i, slotId) {
  const path = h.path, data = await getSlides(path);
  const texts = data ? data.text : (h.slides_text || h.slides || []).filter((x) => x.trim());
  const count = data ? data.slides.length : texts.length;
  i = Math.max(0, Math.min(count - 1, i));
  setLive({ kind: 'hymn', style: data ? 'pptx' : 'hymn', file: path, i, count, texts, edit: hymnEdit(path), slotId, number: h.number, title: h.title,
    main: texts[i] || '', label: 'Inno ' + h.number + ' — ' + h.title, sub: 'Diapositiva ' + (i + 1) + ' di ' + count });
  const ap = h.audio_path || h.audio;
  const base = $('#baseAudio');
  if (ap && base.dataset.p !== ap) { base.src = amedia(ap); base.dataset.p = ap; S.baseTitle = h.number + ' — ' + h.title; renderDock(); }
  $$('[data-thumbs] .slide-btn').forEach((b) => b.classList.toggle('live', +b.dataset.i === i && $('[data-thumbs]').dataset.thumbs === path));
}
async function projDeck(id, i) {
  const [, sl] = findSlot(id), p = sl.data.path, name = slotTitle(sl);
  const base = { kind: 'deck', file: p, slotId: id, label: name };
  if (/\.pdf$/i.test(p)) {
    const pages = await getPdf(p); if (!pages.length) return toast('Questo PDF non si legge');
    i = Math.max(0, Math.min(pages.length - 1, i));
    setLive(Object.assign(base, { style: 'image', pages, image: pages[i], i, count: pages.length, sub: 'Pagina ' + (i + 1) + ' di ' + pages.length }));
  } else {
    const data = await getSlides(p); if (!data) return toast('Questo file non si legge: aprilo in PowerPoint o Keynote e salvalo come .pptx');
    i = Math.max(0, Math.min(data.slides.length - 1, i));
    setLive(Object.assign(base, { style: 'pptx', texts: data.text, main: data.text[i] || '', i, count: data.slides.length, sub: 'Diapositiva ' + (i + 1) + ' di ' + data.slides.length }));
  }
  $$('[data-act="projDeck"] .slide-btn, [data-pdf] .slide-btn').forEach((b) => b.classList.toggle('live', +b.dataset.i === i));
}
/* video: l'uscita suona e mostra; il pannello manda solo play/pausa/posizione */
const vpos = (L) => Math.min(vdur(L.file) || 1e9, L.pos + (L.playing ? (Date.now() - L.at) / 1000 * (L.vrate || 1) : 0));
function vdur(p) {
  S.vdur = S.vdur || {};
  if (S.vdur[p] == null) { S.vdur[p] = 0; const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => { S.vdur[p] = v.duration; renderDock(); }; v.src = amedia(p); }
  return S.vdur[p];
}
function vset(o) { const L = S.live; setLive(Object.assign({}, L, { pos: vpos(L), at: Date.now() }, o), true); }
function hymnGo(i) {
  const L = S.live; i = Math.max(0, Math.min(L.count - 1, i));
  setLive(Object.assign({}, L, { i, main: (L.texts || [])[i] || '', image: L.pages ? L.pages[i] : L.image, sub: (L.pages ? 'Pagina ' : 'Diapositiva ') + (i + 1) + ' di ' + L.count }));
  $$('[data-thumbs] .slide-btn').forEach((b) => b.classList.toggle('live', +b.dataset.i === i));
}
function projPrayer(i) {
  const p = S.prayers[i]; if (!p) return;
  setLive({ kind: 'prayer', style: 'prayer', i, main: p.name, reason: p.reason, color: p.color || PRAYER_COLORS[i % PRAYER_COLORS.length],
    label: 'Preghiera — ' + p.name, sub: (i + 1) + ' di ' + S.prayers.length });
}
function projPrayers() {
  // se ne hai scelte alcune, solo quelle; altrimenti tutto l'elenco
  const sel = S.prSel && S.prSel.size ? S.prayers.map((p, i) => [p, i]).filter(([, i]) => S.prSel.has(i)) : S.prayers.map((p, i) => [p, i]);
  setLive({ kind: 'prayers', style: 'list', list: sel.map(([p, i]) => ({ name: p.name, reason: p.reason, color: p.color || PRAYER_COLORS[i % PRAYER_COLORS.length] })),
    label: 'Elenco preghiere', sub: sel.length + (sel.length === 1 ? ' richiesta' : ' richieste'), slotId: S.sel });
}
async function step(d) {
  const L = S.live;
  if (L.kind === 'hymn' || L.kind === 'deck') hymnGo(L.i + d);
  else if (L.kind === 'verse') {
    let { book, chapter, verse } = L; verse += d;
    const vs = await api.get(`/api/bible/verses?lang=${lang()}&book=${book}&ch=${chapter}`);
    if (verse < 1 || verse > vs.length) return;
    if (S.bib.book === book && S.bib.chapter === chapter) S.bib.verse = verse;
    projVerseRef(book, chapter, verse, L.langs, L.slotId);
  } else if (L.kind === 'lesson' && L.part === 'citazione') {
    const q = curLesson().domande[L.qIdx]; const r = q.refs[L.cit]; if (!r.resolved) return;
    const pos = L.pos + d; if (pos < 0 || pos >= r.verses.length) return;
    setLive(Object.assign({}, L, { pos, main: r.texts[pos], ref: r.book_name + ' ' + r.chapter + ':' + r.verses[pos], label: r.book_name + ' ' + r.chapter + ':' + r.verses[pos] }));
  } else if (L.kind === 'lesson') {
    const n = curLesson().domande.length; const i = L.qIdx + d;
    if (i < 0) { S.intro = true; return projIntro(2); }   // indietro dalla prima domanda: la nota introduttiva
    if (i >= n) return; S.qIdx = i; projDomanda();
  } else if (L.kind === 'intro') { const s = L.step + d; if (s >= 0 && s <= 2) projIntro(s); else if (s > 2) { S.intro = false; S.qIdx = 0; projDomanda(); } }   // dopo la nota: la prima domanda
  else if (L.kind === 'prayer') projPrayer(Math.max(0, Math.min(S.prayers.length - 1, L.i + d)));
}

/* ── timer, musica di pausa, base, campanello ──────────────────────────── */
function pmTitle() { const f = S.pm.files[S.pm.idx]; return f ? f.split('/').pop().replace(/\.[^.]+$/, '') : 'Nessun brano'; }
async function pmLoad() {
  if (!S.pm.files.length) {
    const folder = S.settings.background_music_folder;
    S.pm.files = folder ? (await api.get('/api/audiofiles?folder=' + encodeURIComponent(folder))).sort(() => Math.random() - .5) : [];
  }
  const a = $('#pmAudio'); const f = S.pm.files[S.pm.idx];
  if (f && a.dataset.p !== f) { a.src = amedia(f); a.dataset.p = f; }
  return !!f;
}
async function pmPlay() { if (!(await pmLoad())) { toast('Nessuna musica di pausa: scegli la cartella in Impostazioni'); return; } S.pm.on = true; const a = $('#pmAudio'); a.volume = (S.settings.pause_music_volume || 70) / 100; a.play(); renderDock(); }
function pmFade(ms) {
  const a = $('#pmAudio'); const v0 = a.volume, t0 = performance.now();
  const f = () => { const k = (performance.now() - t0) / ms; if (k >= 1) { a.pause(); a.volume = v0; return; } a.volume = v0 * (1 - k); requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function timerTick() {
  const T = S.timer;
  if (T.running) {
    T.remaining = Math.max(0, Math.round((T.endAt - Date.now()) / 1000));
    if (REMOTE) { const big = $('#timerBig'); if (big) big.textContent = fmt(T.remaining); return; }
    const warn = +S.settings.timer_warning_seconds || 60;
    if (!T.faded && T.remaining <= warn + 3 && S.pm.on) { T.faded = true; pmFade(3000); }
    if (!T.warned && T.remaining <= warn && S.settings.timer_warning_sound) { T.warned = true; playFx(S.settings.timer_warning_sound); }
    if (T.remaining === 0) { T.running = false; if (S.view === 'scaletta') renderMain(); }
  }
  const big = $('#timerBig'); if (big) big.textContent = fmt(T.remaining);
}
// il timer in sala segue il pannello: in pausa resta fermo, i ± si vedono subito
function timerLive() { if (REMOTE || S.live.kind !== 'timer') return; const T = S.timer;
  S.live = Object.assign({}, S.live, T.running ? { endAt: T.endAt, paused: null } : { paused: T.remaining }); pushLive(); }
function playFx(p) { const a = $('#fxAudio'); a.src = amedia(p); a.play().catch(() => {}); }
function setupBell() {
  const b = $('#bell'); let t = 0;
  const up = () => { clearTimeout(t); b.classList.remove('hold'); $('#bellLabel').textContent = 'Campanello'; };
  b.addEventListener('pointerdown', () => {
    b.classList.add('hold'); $('#bellLabel').textContent = 'Tieni premuto…';
    t = setTimeout(() => { up(); if (S.settings.bell_sound) { playFx(S.settings.bell_sound); toast('Campanello suonato'); } else toast('Nessun suono del campanello: sceglilo in Impostazioni'); }, 900);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => b.addEventListener(e, up));
}
let seeking = false, wireBase;
function setupAudio() {
  const upd = () => {
    if (seeking) return;
    $$('[data-player]').forEach((el) => {
      const a = el.dataset.player === 'pm' ? $('#pmAudio') : $('#baseAudio');
      const r = $('[data-seek]', el); r.max = Math.max(1, Math.floor(a.duration || 0)); r.value = Math.floor(a.currentTime || 0);
      $('[data-ppos]', el).textContent = fmt(a.currentTime); $('[data-pdur]', el).textContent = fmt(a.duration);
      const playing = !a.paused;
      $('[data-pstate]', el).textContent = playing ? 'In riproduzione' : 'Pronta';
      $('[data-pstate]', el).style.color = playing ? '#2fb350' : 'var(--faint)';
      $('[data-pbtn]', el).innerHTML = svg(playing ? 'pause' : 'play', 22, true);
      const pr = $('[data-prate]', el); if (pr && pr.textContent !== '…') pr.textContent = Math.round((REMOTE ? a.playbackRate : +(a.dataset.rate || 1)) * 100) + '%';
    });
  };
  // anche la base che prende il posto di quella vecchia quando cambia velocità
  wireBase = (a) => {
    ['timeupdate', 'play', 'pause', 'loadedmetadata'].forEach((e) => a.addEventListener(e, upd));
    if (REMOTE) return;
    // un'altra base: velocità di nuovo al 100%; la stessa base ricaricata la tiene
    a.addEventListener('loadstart', () => { if (a.dataset.p !== S.rateP) { S.rateP = a.dataset.p; a.dataset.rate = 1; } });
    ['play', 'pause', 'loadedmetadata', 'seeked', 'ended', 'volumechange', 'emptied', 'ratechange'].forEach((e) => a.addEventListener(e, sendStatus));
  };
  wireBase($('#baseAudio'));
  ['timeupdate', 'play', 'pause', 'loadedmetadata'].forEach((e) => $('#pmAudio').addEventListener(e, upd));
  if (!REMOTE) ['play', 'pause', 'loadedmetadata', 'seeked', 'ended', 'volumechange', 'emptied', 'ratechange'].forEach((e) => $('#pmAudio').addEventListener(e, sendStatus));
  $('#pmAudio').addEventListener('ended', () => { S.pm.idx = (S.pm.idx + 1) % S.pm.files.length; pmPlay(); const t = $('[data-player="pm"] [data-ptitle]'); if (t) t.textContent = pmTitle(); });
  document.addEventListener('pointerdown', (e) => { if (e.target.matches('[data-seek]')) seeking = true; });
  document.addEventListener('pointerup', () => { seeking = false; });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.seek) { const a = el.dataset.seek === 'pm' ? $('#pmAudio') : $('#baseAudio'); a.currentTime = +el.value; const p = el.closest('[data-player]'); $('[data-ppos]', p).textContent = fmt(+el.value); }
    if (el.dataset.vol) { const a = el.dataset.vol === 'pm' ? $('#pmAudio') : $('#baseAudio'); a.volume = el.value / 100; if (el.dataset.vol === 'pm') setSetting('pause_music_volume', +el.value); }
    if (el.id === 'baseQ') { S.baseQ = el.value; baseHymnModal(); }
    if (el.id === 'mediaQ') { S.mediaQ = el.value; $('#mediaList').innerHTML = mediaListHtml(); }
    if (el.id === 'hymnQ') { S.hymnQ = el.value; $('#hymnList').innerHTML = hymnListHtml(); $('#hymnList').scrollTop = 0; }
    if (el.id === 'searchInput') renderSearch(el.value);
    if (el.dataset.edit === 'slottext' || el.dataset.edit === 'slotsize') { const [, sl] = findSlot(el.dataset.id);
      if (el.dataset.edit === 'slottext') { sl.data.text = el.value; sl.display_name = el.value.split('\n')[0].slice(0, 40); }
      else { sl.data.size = el.value / 100; $('#tSize').textContent = el.value + '%'; }
      saveSchedule(); textPreview();
      if (S.live.kind === 'text' && S.live.slotId === sl.id) { clearTimeout(S.textT); S.textT = setTimeout(() => act.projText(null, { id: sl.id }), 250); } }   // in onda: si aggiorna mentre scrivi
  });
  document.addEventListener('change', (e) => { const el = e.target; if (el.dataset.set) { setSetting(el.dataset.set, el.type === 'number' ? +el.value : el.value); if (el.dataset.set.startsWith('church')) tick(); if (el.dataset.set === 'background_music_folder') S.pm.files = []; if (el.dataset.set === 'phone_pin') setTimeout(phoneBox, 300); } });
}

const clearSearch = () => { $('#searchInput').value = ''; $('#searchBox').classList.remove('open'); $('#searchInput').blur(); };
/* ── ricerca globale ───────────────────────────────────────────────────── */
let searchT = 0;
function renderSearch(qv) {
  clearTimeout(searchT);
  const pop = $('#searchPop');
  const q = qv.trim().toLowerCase();
  if (q.length < 2) { pop.classList.add('hidden'); return; }
  searchT = setTimeout(async () => {
    // inni di tutti gli innari, non solo quello scelto
    const [hy, vs] = await Promise.all([api.get('/api/search/hymns?q=' + encodeURIComponent(q)), api.get(`/api/bible/search?lang=${lang()}&limit=8&q=${encodeURIComponent(q)}`)]);
    S.searchHy = hy;
    const many = S.dbs.length > 1;
    const snip = (t) => { const i = t.toLowerCase().indexOf(q); if (i < 0) return esc(t.slice(0, 110)); const s = Math.max(0, i - 40);
      return (s ? '…' : '') + esc(t.slice(s, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length, i + q.length + 60)) + '…'; };
    pop.innerHTML = `<div class="label" style="padding:6px 10px 8px">Risultati in titoli e testi</div>
      ${hy.map((h, i) => { const inT = (h.number + ' ' + h.title).toLowerCase().includes(q);
        return `<div class="soft sres" style="display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:4px"><div style="flex:1;min-width:0"><span class="label" style="color:#888dec">Inno${many ? ' · ' + esc(h.dbname) : ''}</span><div style="font-weight:650">${markQ(h.number + ' — ' + h.title, q)}</div>
          ${inT ? '' : `<div style="font-size:12.5px;color:var(--sub)">${snip(h.slides.join(' · '))}</div>`}</div>
          <button class="btn sm" data-a="addFromSearch" data-k="h" data-i="${i}">+ Scaletta</button><button class="btn sm pri" data-a="projFromSearch" data-k="h" data-i="${i}">Proietta</button></div>`; }).join('')}
      ${vs.map((v) => `<div class="soft sres" style="display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:4px"><div style="flex:1;min-width:0"><span class="label" style="color:#de7949">Versetto</span><div style="font-weight:650">${esc(v.name + ' ' + v.ch + ':' + v.v)}</div>
          <div style="font-size:12.5px;color:var(--sub)">${snip(v.text)}</div></div>
          <button class="btn sm" data-a="addFromSearch" data-k="v" data-b="${v.book}" data-c="${v.ch}" data-v="${v.v}">+ Scaletta</button><button class="btn sm pri" data-a="projFromSearch" data-k="v" data-b="${v.book}" data-c="${v.ch}" data-v="${v.v}">Proietta</button></div>`).join('')}
      ${hy.length + vs.length ? '' : '<div style="padding:10px;color:var(--sub)">Nessun risultato</div>'}`;
    pop.classList.remove('hidden');
  }, 160);
}

/* ── aggiungere alla scaletta: «Dove lo aggiungo?» ─────────────────────── */
/* file (dal Finder o dal Mac) -> elemento della scaletta del tipo giusto */
const FILE_KIND = [[/\.(png|jpe?g|gif|heic|webp|bmp)$/i, 'immagine', 'immagini'], [/\.(mp4|mov|m4v|webm)$/i, 'video', 'video'],
  [/\.(mp3|m4a|wav|aac|ogg|flac)$/i, 'audio', 'audio'], [/\.(pptx|pdf)$/i, 'presentazione', 'presentazioni']];
function addFileSlot(path, si) {
  const k = FILE_KIND.find(([re]) => re.test(path));
  if (!k) return toast('Questo tipo di file non si può proiettare: immagini, video, audio, PowerPoint (.pptx) o PDF');
  if (si != null) S.addTo = si;
  askWhere({ id: uid(), slot_type: k[1], display_name: fileName(path).replace(/\.[^.]+$/, ''), data: { path } });
}
async function dropFiles(files, si) {
  for (const f of files) {
    const k = FILE_KIND.find(([re]) => re.test(f.name));
    if (!k) { toast('«' + f.name + '» non si può proiettare'); continue; }
    toast('Copio «' + f.name + '»…');
    const r = await fetch(`/api/upload?kind=${k[2]}&name=${encodeURIComponent(f.name)}`, { method: 'POST', body: f }).then((x) => x.json());
    if (r.ok) addFileSlot(r.path, si ?? 0);
  }
}
function baseHymnModal() {
  const q = (S.baseQ || '').toLowerCase().trim();
  const list = S.hymns.map((h, i) => [h, i]).filter(([h]) => !q || h._k.includes(q)).slice(0, 60);
  modal(`<div style="font-size:18px;font-weight:750">«${esc(S.baseSrc.name)}» come base di quale inno?</div>
    <div style="color:var(--sub);font-size:13px">Innario: ${esc((S.dbs.find((x) => x.path === S.hymnsDb) || {}).name || '')}. Se l'inno ha già una base, viene sostituita.</div>
    <input class="field" id="baseQ" value="${esc(S.baseQ || '')}" placeholder="Numero o titolo" autofocus>
    <div class="scr" id="baseList" style="display:flex;flex-direction:column;gap:2px;max-height:46vh">${list.map(([h, i]) => `<button class="list-row" data-a="baseHymnPick" data-i="${i}"><span style="width:42px;color:var(--faint);font-weight:750">${esc(h.number)}</span><span style="flex:1">${esc(h.title)}</span>${h.audio ? `<span style="color:#888dec">${svg('inno', 15, false, 2.2)}</span>` : ''}</button>`).join('')}</div>
    <button class="btn" data-a="closeModal" style="align-self:flex-end">Annulla</button>`, 520);
  const i = $('#baseQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
}
async function setBase(h, src) {
  closeModal(); if (!h) return;
  const r = await api.post('/api/hymn/setbase', { db: S.hymnsDb, number: h.number, title: h.title, src });
  if (!r.ok) return toast('Non sono riuscito a impostare la base');
  S.secs.forEach((sec) => sec.slots.forEach((sl) => { if (sl.data.hymn && sl.data.hymn.path === h.path) sl.data.hymn.audio_path = r.audio; }));
  saveSchedule(); await loadHymns(true); if (S.view === 'inni') { $('#hymnList').innerHTML = hymnListHtml(); $('#hymnPrev').innerHTML = hymnPrevHtml(); hydrateThumbs(); }
  toast('Base impostata per l\'inno ' + h.number);
}
async function mediaImport(p) {
  const k = FILE_KIND.find(([re]) => re.test(p));
  if (!k || !['video', 'audio'].includes(k[1])) return toast('«' + fileName(p) + '» non è un video o un audio');
  await api.post('/api/library/import', { path: p, kind: k[2] });
}
function askWhere(slot) {
  S.pending = slot;
  if (S.addTo != null && S.secs[S.addTo]) { const si = S.addTo; S.addTo = null; return act.insertAt(null, { s: si, k: S.secs[si].slots.length }); }
  modal(`<div><div style="font-size:18px;font-weight:750">Dove lo aggiungo?</div><div style="color:var(--sub)">${esc(slotTitle(slot))}</div></div>
    <div class="scr" style="display:flex;flex-direction:column;gap:12px;max-height:56vh">${S.secs.map((sec, si) => `<div style="display:flex;flex-direction:column;gap:4px"><span class="label" style="padding:0 6px">${esc(sec.name)}</span>
      ${[{ l: "All'inizio" }].concat(sec.slots.map((x) => ({ l: 'Dopo «' + slotTitle(x) + '»' }))).map((p, k) => `<button class="menu-row soft" data-a="insertAt" data-s="${si}" data-k="${k}" style="min-height:38px;font-size:13px">${svg('plus', 14, false, 2.4)}${esc(p.l)}</button>`).join('')}</div>`).join('')}</div>
    <button class="btn" data-a="closeModal" style="align-self:flex-end">Annulla</button>`, 480);
}
const hymnSlot = (h) => ({ id: uid(), slot_type: 'inno', display_name: 'Inno ' + h.number + ' — ' + h.title,
  data: { hymn: { number: h.number, title: h.title, path: h.path, audio_path: h.audio, slides_text: h.slides } } });
async function verseSlot(book, chapter, verse) {
  const langs = [lang()].concat(S.settings.bible_extra_langs || []);
  const texts = await api.get(`/api/bible/verse?book=${book}&ch=${chapter}&v=${verse}&langs=${langs.join(',')}`);
  const ref = bookName(book) + ' ' + chapter + ':' + verse;
  return { id: uid(), slot_type: 'versetto', display_name: ref, data: { verse: { book, book_name: bookName(book), chapter, verse, ref, langs, texts } } };
}

/* ── trascinamento nella scaletta ──────────────────────────────────────── */
function setupDrag() {
  const list = () => $('#schedList');
  document.addEventListener('dragstart', (e) => {
    const row = e.target.closest && e.target.closest('[data-row]'); const sec = e.target.closest && e.target.closest('.sec');
    if (!list() || !list().contains(e.target)) return;
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'x');
    if (row) { const [s, j] = row.dataset.row.split(':').map(Number); S.drag = { s, j }; setTimeout(() => row.classList.add('dragging'), 0); }
    else if (sec) { S.drag = { s: +sec.dataset.sec }; setTimeout(() => sec.classList.add('dragging'), 0); }
  });
  // file dal Finder: si lasciano su una sezione
  const isFiles = (e) => !S.drag && e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  document.addEventListener('dragover', (e) => {
    if (isFiles(e) && $('#mediaView') && $('#mediaView').contains(e.target)) { e.preventDefault(); return; }
    if (!isFiles(e) || !list() || !list().contains(e.target)) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    const sec = e.target.closest('.sec'); $$('.sec.filedrop').forEach((x) => x !== sec && x.classList.remove('filedrop')); if (sec) sec.classList.add('filedrop');
  });
  document.addEventListener('drop', (e) => {
    if (!isFiles(e)) return; e.preventDefault();
    const sec = e.target.closest && e.target.closest('.sec'); $$('.sec.filedrop').forEach((x) => x.classList.remove('filedrop'));
    if (list() && list().contains(e.target)) dropFiles([...e.dataTransfer.files], sec ? +sec.dataset.sec : 0);
    else if ($('#mediaView') && $('#mediaView').contains(e.target)) (async () => { for (const f of e.dataTransfer.files) { const k = FILE_KIND.find(([re]) => re.test(f.name));
      if (!k || !['video', 'audio'].includes(k[1])) { toast('«' + f.name + '» non è un video o un audio'); continue; }
      toast('Copio «' + f.name + '»…'); await fetch(`/api/upload?kind=${k[2]}&name=${encodeURIComponent(f.name)}`, { method: 'POST', body: f }); } loadMedia(); })();
  });
  document.addEventListener('dragover', (e) => {
    if (!S.drag || !list() || !list().contains(e.target)) return;
    e.preventDefault();
    let key = null;
    const row = e.target.closest('[data-row]'), sec = e.target.closest('.sec');
    if (S.drag.j === undefined) { if (sec) key = sec.dataset.sec + ':sec'; }
    else if (row) { const [s, j] = row.dataset.row.split(':'); key = s + ':' + j; }
    else if (sec) key = sec.dataset.sec + ':end';
    if (key === S.over) return;
    S.over = key;
    $$('.gap.on').forEach((g) => g.classList.remove('on'));
    const g = key && $(`[data-gap="${key}"]`);
    if (g && !(S.drag.j !== undefined && (key === S.drag.s + ':' + S.drag.j || key === S.drag.s + ':' + (S.drag.j + 1))) && !(S.drag.j === undefined && key === S.drag.s + ':sec')) g.classList.add('on');
  });
  document.addEventListener('drop', (e) => {
    if (!S.drag || !S.over) return; e.preventDefault();
    const d = S.drag, [ts, tj] = S.over.split(':');
    const s = +ts;
    if (d.j === undefined) { const [m] = S.secs.splice(d.s, 1); S.secs.splice(s > d.s ? s - 1 : s, 0, m); }
    else { const [m] = S.secs[d.s].slots.splice(d.j, 1); let at = tj === 'end' ? S.secs[s].slots.length : +tj; if (d.s === s && tj !== 'end' && d.j < at) at -= 1; S.secs[s].slots.splice(at, 0, m); }
    S.drag = S.over = null; saveSchedule(); renderMain();
  });
  document.addEventListener('dragend', () => { if (S.drag) { S.drag = S.over = null; renderMain(); } });
}

/* anteprima nel pannello: zoom con la rotella, trascinare per spostarsi,
   puntatore che segue il mouse (solo per le immagini proiettate) */
/* puntatore e zoom: messaggi leggeri, al massimo ~40 al secondo, senza ridisegnare la proiezione */
let viewT = 0, viewPending = false;
function pushView() {
  if (viewT) { viewPending = true; return; }
  const send = () => { const L = S.live; api.post('/api/cmd', { view: { ptr: L.ptr || null, iz: L.iz || 1, icx: L.icx ?? 0.5, icy: L.icy ?? 0.5 } }); };
  send();
  viewT = setTimeout(() => { viewT = 0; if (viewPending) { viewPending = false; pushView(); } }, 25);
}
function setupPreviewTools() {
  // vale per l'anteprima a destra e per quella grande al centro (classe pvtools)
  let drag = null;
  const box = (e) => e.target.closest && e.target.closest('.pvtools');
  const frac = (pv, e) => { const r = pv.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  const isImg = () => S.live.style === 'image';
  document.addEventListener('wheel', (e) => { const pv = box(e); if (!pv || !isImg()) return; e.preventDefault(); const [x, y] = frac(pv, e);
    const z = Math.min(6, Math.max(1, (S.live.iz || 1) * (e.deltaY < 0 ? 1.12 : 0.89)));
    if ((S.live.iz || 1) === 1) { S.live.icx = x; S.live.icy = y; } S.live.iz = z; pushView(); renderDock(); }, { passive: false });
  document.addEventListener('pointerdown', (e) => { const pv = box(e); if (pv && isImg() && (S.live.iz || 1) > 1 && !S.ptrOn) { drag = { pv, f: frac(pv, e), cx: S.live.icx ?? 0.5, cy: S.live.icy ?? 0.5 }; pv.setPointerCapture(e.pointerId); } });
  document.addEventListener('pointermove', (e) => {
    if (drag) { const [x, y] = frac(drag.pv, e), z = S.live.iz || 1; S.live.icx = Math.min(1, Math.max(0, drag.cx - (x - drag.f[0]) / (z - 1 || 1))); S.live.icy = Math.min(1, Math.max(0, drag.cy - (y - drag.f[1]) / (z - 1 || 1))); pushView(); return; }
    const pv = box(e);
    if (pv && S.ptrOn && S.live.kind !== 'none') { S.live.ptr = frac(pv, e); pushView(); }
    else if (!pv && S.ptrOn && S.live.ptr) { S.live.ptr = null; pushView(); }      // uscito dall'anteprima: il puntatore sparisce
  });
  document.addEventListener('pointerup', () => { drag = null; });
}

/* ── evidenziazione trascinando sulle parole ───────────────────────────── */
function setupWords() {
  // puntatore (mouse e dito): si trascina sulle parole, anche sul telefono
  const at = (e) => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest && el.closest('#words [data-w], #words [data-s]'); };
  const idx = (el) => (el.dataset.w != null ? +el.dataset.w : +el.dataset.s);
  document.addEventListener('pointerdown', (e) => { const w = e.target.closest && e.target.closest('#words [data-w], #words [data-s]'); if (!w) return; e.preventDefault();
    S.dragFrom = idx(w); S.hl = [S.dragFrom, S.dragFrom]; paintWords(); pushHl(); });
  document.addEventListener('pointermove', (e) => { if (S.dragFrom === null) return; const w = at(e); if (!w) return; const n = idx(w);
    if (S.hl && S.hl[1] === n) return; S.hl = [S.dragFrom, n]; paintWords(); pushHl(); });
  ['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => { S.dragFrom = null; }));
}
function paintWords() { const [a, b] = S.hl ? [Math.min(...S.hl), Math.max(...S.hl)] : [-1, -2]; $$('#words [data-w]').forEach((w) => w.classList.toggle('hl', +w.dataset.w >= a && +w.dataset.w <= b)); $$('#words [data-s]').forEach((x) => x.classList.toggle('hl', +x.dataset.s >= a && +x.dataset.s < b)); }
let hlT = 0;
function pushHl() { clearTimeout(hlT); hlT = setTimeout(() => api.post('/api/live', Object.assign({}, S.live, { hl: S.hl, zoom: S.zoom, from: CLIENT })), 16); }

/* ── tastiera ──────────────────────────────────────────────────────────── */
function setupKeys() {
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (e.key === 'Escape') { if ($('#modal').innerHTML) return closeModal(); if (typing) return document.activeElement.blur(); closePops(); return stopLive(); }
    if (typing) { if (e.key === 'Enter' && document.activeElement.dataset.edit && document.activeElement.dataset.edit.startsWith('sec')) document.activeElement.blur(); return; }
    if (['ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); step(1); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
    if (e.ctrlKey && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); act.overlay(null, { v: ['nero', 'sfondo', 'congela'][+e.key - 1] }); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); act.openSearch(); }
  });
  document.addEventListener('focusout', (e) => {
    const el = e.target;
    if (el.dataset.edit === 'secname') { const s = S.secs.find((x) => x.id === el.dataset.id); if (s && el.value.trim()) s.name = el.value.trim(); S.editSec = null; saveSchedule(); renderMain(); }
    if (el.dataset.edit === 'sectime') { const s = S.secs.find((x) => x.id === el.dataset.id); if (s && el.value) s.time = el.value.replace(/^0(?=\d:)/, ''); S.editTime = null; saveSchedule(); renderMain(); }
    if (el.id === 'searchInput' && !el.value) $('#searchBox').classList.remove('open');
  });
}
function closePops() { ['#sunPop', '#morePop', '#searchPop'].forEach((p) => $(p).classList.add('hidden')); if (S.dbMenu) { S.dbMenu = false; renderMain(); } }

/* ── uscite sui proiettori ─────────────────────────────────────────────── */
/* uscite: una finestra a tutto schermo per ogni proiettore, aperte da sole
   alla prima proiezione (o da «…» › Apri le uscite) */
let outputsAt = 0;
async function openOutputs() {
  outputsAt = Date.now();
  // il motore apre Chrome a tutto schermo su ogni schermo che non è quello del pannello
  const r = await api.post('/api/outputs/open', {});
  if (r.ok) return toast(r.screens ? (r.screens === 1 ? 'Proiettore acceso a tutto schermo' : r.screens + ' proiettori accesi a tutto schermo') : 'Nessun proiettore collegato: uscita aperta in una finestra');
  window.open('/output', 'sdarm-out-0', 'popup,width=960,height=540'); toast(r.error || 'Uscita aperta in una finestra');
}
const autoOutputs = () => { if (!REMOTE && !S.outputs && S.live.kind !== 'none' && Date.now() - outputsAt > 8000) openOutputs(); };

/* ── azioni ────────────────────────────────────────────────────────────── */
const act = {
  changeIn: (el, d) => { S.replaceSlot = d.id; S.view = d.v; S.sheet = false; renderMain(); },
  cancelReplace: () => { S.view = 'scaletta'; S.replaceSlot = null; renderMain(); },
  useHymn: () => { const [, sl] = findSlot(S.replaceSlot), n = hymnSlot(S.hymns[S.hymnSel]); if (sl) { sl.data = n.data; sl.display_name = n.display_name; S.sel = sl.id; saveSchedule(); }
    S.replaceSlot = null; S.view = 'scaletta'; renderMain(); toast('Inno cambiato'); },
  useVerse: async () => { const [, sl] = findSlot(S.replaceSlot), n = await verseSlot(S.bib.book, S.bib.chapter, S.bib.verse); if (sl) { sl.data = n.data; sl.display_name = n.display_name; S.sel = sl.id; saveSchedule(); }
    S.replaceSlot = null; S.view = 'scaletta'; renderMain(); toast('Versetto cambiato'); },
  nav: (el, d) => { if (REMOTE && d.v === 'impostazioni') return toast('Le impostazioni si cambiano dal Mac'); if (d.v === 'scaletta') S.replaceSlot = null; S.view = d.v; S.sheet = false; closePops(); renderMain(); },
  closeSheet: () => { S.sheet = false; $$('.sheet').forEach((x) => x.classList.remove('open')); },
  dockBig: () => (REMOTE ? $('#dock').classList.remove('ropen') : $('#dock').classList.toggle('big')),
  remoteOpen: () => { $('#dock').classList.add('ropen'); renderDock(); requestAnimationFrame(scalePreview); },
  toTop: () => { const m = $('#main'); if (m) m.scrollTo({ top: 0, behavior: 'smooth' }); $$('.sheet.open, .scr').forEach((x) => x.scrollTo({ top: 0, behavior: 'smooth' })); },
  toggleSun: () => { const p = $('#sunPop'); const was = p.classList.contains('hidden'); closePops(); if (was) { renderSunPop(); p.classList.remove('hidden'); } },
  toggleMore: () => { const p = $('#morePop'); const was = p.classList.contains('hidden'); closePops(); if (was) { renderMore(); p.classList.remove('hidden'); } },
  theme: (el, d) => { document.documentElement.dataset.theme = d.v; setThemeColor(d.v); localStorage.setItem('theme', d.v); renderMore(); },
  openSearch: () => { $('#searchBox').classList.add('open'); $('#searchInput').focus(); },
  openOutputs,
  closeOutputs: () => { closePops(); outputsAt = Date.now(); api.post('/api/outputs/close', {}); },
  closeModal: (el, d, e) => { if (d.self && e.target !== el) return; closeModal(); },
  undo: () => { if (S.undo) { S.secs = S.undo; S.undo = null; saveSchedule(); renderMain(); $('#toast').innerHTML = ''; } },
  pick: (el, d, e) => { if (e.target.closest('.xbtn')) return; S.sel = d.id; S.intro = false; $$('.row').forEach((r) => r.classList.toggle('sel', r.dataset.a === 'pick' && r.dataset.id === d.id));
    $('#detail').innerHTML = detailHtml(); hydrateThumbs(); if ($('#bigPrev')) requestAnimationFrame(scalePreview); if (REMOTE) { S.sheet = true; $('#detail').classList.add('open'); } const [, sl] = findSlot(d.id);
    if (sl && sl.slot_type === 'inno' && sl.data.hymn && sl.data.hymn.audio_path) { const b = $('#baseAudio'); if (b.paused && b.dataset.p !== sl.data.hymn.audio_path) { b.src = amedia(sl.data.hymn.audio_path); b.dataset.p = sl.data.hymn.audio_path; S.baseTitle = sl.data.hymn.number + ' — ' + sl.data.hymn.title; } } },
  renameSec: (el, d) => { S.editSec = d.id; renderMain(); },
  editTime: (el, d) => { S.editTime = d.id; renderMain(); },
  delSec: (el, d) => { S.undo = JSON.parse(JSON.stringify(S.secs)); const s = S.secs.find((x) => x.id === d.id); S.secs = S.secs.filter((x) => x.id !== d.id); saveSchedule(); renderMain(); toast('Sezione «' + s.name + '» eliminata', true); },
  delSlot: (el, d) => { S.undo = JSON.parse(JSON.stringify(S.secs)); const [sec, sl] = findSlot(d.id); sec.slots = sec.slots.filter((x) => x.id !== d.id); saveSchedule(); renderMain(); toast('«' + slotTitle(sl) + '» tolto', true); },
  addSec: () => { S.secs.push({ id: uid(), name: 'Nuova sezione', time: '', slots: [] }); S.editSec = S.secs[S.secs.length - 1].id; saveSchedule(); renderMain(); },
  askClear: () => modal(`<div style="font-size:18px;font-weight:750">Svuotare la scaletta?</div><div style="color:var(--sub)">Vengono tolti tutti gli elementi. Le sezioni (${esc(S.secs.map((s) => s.name).join(', '))}) restano.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" style="background:var(--danger)" data-a="doClear">Svuota</button></div>`, 420),
  doClear: () => { S.undo = JSON.parse(JSON.stringify(S.secs)); S.secs.forEach((s) => { s.slots = []; }); S.sel = null; closeModal(); saveSchedule(); renderMain(); toast('Scaletta svuotata · le sezioni restano', true); },
  addItem: (el, d) => { S.addTo = d && d.s != null ? +d.s : null;
    const b = (a, t, label, ic, col) => `<button class="btn" data-a="${a}" data-t="${t}" style="height:70px;flex-direction:column;gap:5px;border-radius:18px"><span style="color:${col}">${svg(ic, 21)}</span>${label}</button>`;
    modal(`<div style="font-size:18px;font-weight:750">Che cosa aggiungo${S.addTo != null ? ' in «' + esc(S.secs[S.addTo].name) + '»' : ''}?</div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${ADDABLE.filter((t) => !REMOTE || !FILE_TYPES.includes(t)).map((t) => b('newSlot', t, LABELS[t], t, COLORS[t])).join('')}
        ${b('newSlot', 'ytvideo', 'Video da YouTube', 'video', '#ff4e45')}${b('newSlot', 'ytaudio', 'Audio da YouTube', 'audio', '#ff4e45')}${REMOTE ? '' : b('newSlot', 'file', 'File dal Mac…', 'presentazione', 'var(--sub)')}</div>
      <span style="font-size:12px;color:var(--faint)">${REMOTE ? 'Immagini, video, audio e presentazioni si aggiungono dal Mac.' : 'Puoi anche trascinare file (immagini, video, audio, PowerPoint, PDF) dal Finder sulla scaletta.'}</span>`, 620); },
  newSlot: async (el, d) => { closeModal();
    if (d.t === 'inno' || d.t === 'versetto') { S.view = d.t === 'inno' ? 'inni' : 'bibbia'; renderMain(); return toast(d.t === 'inno' ? 'Scegli l\'inno e premi «Aggiungi alla scaletta»' : 'Scegli il versetto e premi «+ Scaletta»'); }
    if (d.t === 'file') { const ps = await pickInto('file', 'documenti', 'Scegli il file da aggiungere', null); if (ps.length) addFileSlot(ps[0]); return; }
    const t = { ytvideo: 'video', ytaudio: 'audio' }[d.t] || d.t;
    if (d.t === 'ytvideo' || d.t === 'ytaudio') return act.ytAsk(null, { id: null, kind: t });   // l'elemento nasce a download finito
    const pk = { immagine: ['immagini', 'image', 'l\'immagine'], video: ['video', 'video', 'il video'], audio: ['audio', 'audio', 'l\'audio'], presentazione: ['presentazioni', 'deck', 'il PowerPoint o il PDF'] }[t];
    if (pk) { const ps = await pickInto('file', pk[0], 'Scegli ' + pk[2], pk[1]); if (!ps.length) { S.addTo = null; return; } return addFileSlot(ps[0]); }
    askWhere({ id: uid(), slot_type: t, display_name: LABELS[t], data: t === 'timer' ? { minutes: 10 } : {} }); },
  insertAt: (el, d) => { const sec = S.secs[+d.s]; sec.slots.splice(+d.k, 0, S.pending); S.sel = S.pending.id; closeModal(); saveSchedule(); S.view = 'scaletta'; renderMain(); toast('Aggiunto in «' + sec.name + '»'); },
  templates: () => { const T = S.settings.schedule_templates || [];
    modal(`<div style="font-size:18px;font-weight:750">Modelli di scaletta</div>
      ${T.length ? T.map((t, i) => `<div class="soft" style="display:flex;align-items:center;gap:8px"><b style="flex:1">${esc(t.name)}</b><span style="color:var(--faint);font-size:12px">${t.secs.reduce((a, x) => a + x.slots.length, 0)} elementi</span>
        <button class="btn sm pri" data-a="tplLoad" data-i="${i}">Usa</button><button class="btn sm danger" data-a="tplDel" data-i="${i}">Elimina</button></div>`).join('') : '<div style="color:var(--faint)">Nessun modello. Prepara una scaletta tipo e salvala qui.</div>'}
      <div style="display:flex;gap:8px"><input class="field" id="tplName" placeholder="Nome del modello (es. Sabato mattina)" style="flex:1;height:38px"><button class="btn" data-a="tplSave">Salva la scaletta attuale</button></div>`, 520); },
  tplSave: () => { const name = $('#tplName').value.trim(); if (!name) return $('#tplName').focus();
    const T = (S.settings.schedule_templates || []).filter((t) => t.name !== name).concat([{ name, secs: JSON.parse(JSON.stringify(S.secs)) }]);
    setSetting('schedule_templates', T); act.templates(); toast('Modello salvato'); },
  tplLoad: (el, d) => { const t = S.settings.schedule_templates[+d.i]; S.undo = JSON.parse(JSON.stringify(S.secs));
    S.secs = JSON.parse(JSON.stringify(t.secs)).map((sec) => Object.assign(sec, { id: uid(), slots: sec.slots.map((x) => Object.assign(x, { id: uid() })) }));
    S.sel = null; closeModal(); saveSchedule(); renderMain(); toast('Scaletta «' + t.name + '» caricata', true); },
  tplDel: (el, d) => { const T = (S.settings.schedule_templates || []).slice(); T.splice(+d.i, 1); setSetting('schedule_templates', T); act.templates(); },
  // lezione
  lezDay: (el, d) => { if (d.v === 'intro') S.intro = true; else { S.intro = false; S.qIdx = +d.v; } $('#detail').innerHTML = detailHtml(); },
  qStep: (el, d) => { const n = curLesson().domande.length; S.qIdx = Math.max(0, Math.min(n - 1, S.qIdx + +d.d)); $('#detail').innerHTML = detailHtml(); },
  projDomanda, projNota: () => projNota(), projCit: (el, d) => projCit(+d.i), projIntro: () => projIntro(0),
  editIntro: () => { const les = curLesson();
    modal(`<div style="font-size:18px;font-weight:750">Introduzione della lezione</div>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:650;color:var(--sub)">Versetto chiave<textarea class="field" id="inVerse" style="height:90px;padding:10px;resize:vertical;font-size:14px;line-height:1.45">${esc(les.verse)}</textarea></label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:650;color:var(--sub)">Riferimento del versetto<input class="field" id="inRef" value="${esc(les.verse_ref || '')}" placeholder="es. Giovanni 3:16"></label>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:650;color:var(--sub)">Nota introduttiva<textarea class="field" id="inNote" style="height:160px;padding:10px;resize:vertical;font-size:14px;line-height:1.45">${esc(les.note)}</textarea></label>
      <div style="display:flex;gap:8px;align-items:center"><span style="flex:1"></span>
        <button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" data-a="saveIntro">Salva</button></div>`, 560); },
  saveIntro: async () => { const key = curLesson().key, all = Object.assign({}, S.settings.lesson_intro || {});
    all[key] = { verse: $('#inVerse').value.trim(), ref: $('#inRef').value.trim(), note: $('#inNote').value.trim() };
    await setSetting('lesson_intro', all); closeModal(); await loadLesson(); renderMain(); toast('Introduzione salvata'); },
  lessonPhoto: async (el, d) => { const key = curLesson().key, all = Object.assign({}, S.settings.lesson_photos || {});
    if (d.clear) delete all[key]; else { const ps = await pickInto('file', 'immagini', 'Scegli la foto della lezione', 'image'); if (!ps.length) return; all[key] = ps[0]; }
    await setSetting('lesson_photos', all); closeModal(); await loadLesson(); renderMain(); act.cover(); },
  // copertina della lezione: l'immagine per lo spazio 1920×340 della grafica e i prompt per crearla
  cover: () => { const les = curLesson();
    const verse = (les.verse || '').replace(/\s+/g, ' ').trim();
    const base = 'Ultra-wide cinematic banner illustration, exactly 1920x340 pixels (aspect ratio about 5.6:1), for a Seventh-day Adventist Sabbath School Bible study';
    const tail = 'Reverent and symbolic, biblical-era setting, soft natural light, rich but calm colors, painterly realism, subject spread horizontally across the frame. No text, no letters, no logos, no modern objects.';
    const pw = les.prompt || `${base} lesson titled "${les.title}" (Italian title)${verse ? `, key verse: "${verse}"` : ''}. ${tail}`;
    const box = (id, label, text, own) => `<div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:13px">${label}</b>
        ${own ? '' : '<span style="font-size:11px;color:var(--faint)">preparato dall\'app</span>'}<button class="btn sm" data-a="copyPrompt" data-t="${id}">Copia</button></div>
      <textarea class="field" id="${id}" readonly style="height:84px;padding:10px;resize:none;font-size:12.5px;line-height:1.45">${esc(text)}</textarea></div>`;
    modal(`<div style="font-size:18px;font-weight:750">Copertina della lezione</div>
      <div style="aspect-ratio:1920/340;border-radius:10px;background:${les.photo ? `url('${media(les.photo)}') center/cover` : 'var(--fill)'};display:flex;align-items:center;justify-content:center;color:var(--faint);font-size:12.5px">${les.photo ? '' : 'Nessuna immagine · spazio 1920 × 340'}</div>
      <div style="display:flex;gap:8px"><button class="btn sm pri" data-a="lessonPhoto">${les.photo ? 'Cambia immagine…' : 'Carica immagine…'}</button>${les.photo ? '<button class="btn sm danger" data-a="lessonPhoto" data-clear="1">Togli</button>' : ''}</div>
      ${box('pWeek', 'Prompt per l\'immagine', pw, les.prompt)}
      <div style="display:flex;justify-content:flex-end"><button class="btn" data-a="closeModal">Chiudi</button></div>`, 640); },
  copyPrompt: (el, d) => { const t = $('#' + d.t); t.select(); document.execCommand('copy'); t.setSelectionRange(0, 0); toast('Prompt copiato'); },
  // inni
  pickHymn: (el, d) => { S.hymnSel = +d.i; S.sheet = REMOTE;   // solo elenco e anteprima, senza ridisegnare la pagina
    $$('#hymnList .list-row').forEach((r) => r.classList.toggle('sel', r.dataset.i === d.i));
    const pv = $('#hymnPrev'); pv.innerHTML = hymnPrevHtml(); pv.classList.toggle('open', S.sheet); hydrateThumbs(); },
  baseOnly: (el) => { S.baseOnly = !S.baseOnly; el.classList.toggle('on', S.baseOnly); $('#hymnList').innerHTML = hymnListHtml(); },
  dbMenu: () => { S.dbMenu = !S.dbMenu; renderMain(); },
  pickDb: (el, d) => { S.hymnsDb = d.p; S.dbMenu = false; S.hymns = []; S.hymnSel = 0; setSetting('last_database', d.p); renderMain(); loadHymns(); },
  projHymnLib: () => { const h = S.hymns[S.hymnSel]; projHymn({ number: h.number, title: h.title, path: h.path, slides_text: h.slides, audio_path: h.audio }, 0, null); },
  addHymn: () => askWhere(hymnSlot(S.hymns[S.hymnSel])),
  projHymn: (el, d) => { const [, sl] = findSlot(d.id); projHymn(sl.data.hymn, +d.i, d.id); },
  hymnSlide: (el, d) => hymnGo(+d.i),
  // inni: modifica, importa, esporta
  hymnalStyle: async (el, d) => {
    const t = await api.get('/api/hymnal/template?db=' + encodeURIComponent(d.p));
    S.hs = { db: d.p, bg: t.bg || '' };
    modal(`<div style="font-size:18px;font-weight:750">Stile dei nuovi inni</div>
      <div style="color:var(--sub);font-size:13px">Usato quando trasformi un PowerPoint o un testo in un inno di questo innario.</div>
      <div id="hsBg" style="aspect-ratio:16/9;border-radius:12px;background:#000 center/cover;${t.bg ? `background-image:url('/media?p=${encodeURIComponent(t.bg)}')` : ''}"></div>
      <div style="display:flex;gap:8px"><button class="btn sm" data-a="hsPickBg">Cambia sfondo…</button><button class="btn sm" data-a="hsNoBg">Senza sfondo</button></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${fontSel(t.font, 'id="hsFont"')}
        <input type="color" id="hsColor" value="${esc(t.color || '#ffffff')}" style="width:44px;height:36px;border:0;background:none">
        <label style="display:flex;gap:6px;align-items:center;font-size:13px">Dimensione<input class="field" id="hsSize" type="number" min="20" max="140" value="${t.size || 60}" style="width:80px"> pt</label></div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" data-a="hsSave">Salva</button></div>`, 520); },
  hsPickBg: async () => { const ps = await pickInto('file', 'immagini', 'Scegli l\'immagine di sfondo', 'image'); if (!ps.length) return;
    S.hs.bg = ps[0]; $('#hsBg').style.backgroundImage = `url('/media?p=${encodeURIComponent(ps[0])}')`; },
  hsNoBg: () => { S.hs.bg = ''; $('#hsBg').style.backgroundImage = 'none'; },
  hsSave: async () => { const all = Object.assign({}, S.settings.hymnal_templates || {});
    all[S.hs.db] = { bg: S.hs.bg, font: $('#hsFont').value, color: $('#hsColor').value, size: +$('#hsSize').value || 60, fill: '#000000' };
    await setSetting('hymnal_templates', all); closeModal(); toast('Stile salvato'); },
  editHymn: async (el, d) => {
    const data = await getSlides(d.p); if (!data) return toast('Questo PowerPoint non si legge');
    const ed = hymnEdit(d.p) || {};
    S.he = { path: d.p, data, i: Math.min(1, data.slides.length - 1), texts: Object.assign({}, ed.texts || {}), scale: ed.scale || 1 };
    renderHymnEditor();
  },
  heSlide: (el, d) => { S.he.i = +d.i; S.he.confirm = -1; heShow(); },
  heFmt: (el, d) => { const t = $('#heText'); t.focus(); document.execCommand(d.v); S.he.texts[S.he.i] = heRead(t); $('#hePrev').innerHTML = thumb(S.he.data, S.he.i, { scale: S.he.scale, texts: S.he.texts }); },
  heDel: async () => { const he = S.he, i = he.i;
    if (he.data.slides.length < 2) return toast('Un inno deve avere almeno una diapositiva');
    if (he.confirm !== i) { he.confirm = i; return heShow(); }
    const r = await api.post('/api/hymn/slide-delete', { path: he.path, index: i }); if (!r.ok) return toast('Non sono riuscito a eliminarla');
    delete S.slidesCache[he.path]; const data = await getSlides(he.path); if (!data) return closeModal();
    const t = {}; Object.entries(he.texts).forEach(([k, v]) => { k = +k; if (k !== i) t[k - (k > i)] = v; });
    const eds = Object.assign({}, S.settings.hymn_edits || {}); if (r.edit) eds[he.path] = r.edit; S.settings.hymn_edits = eds;
    Object.assign(he, { data, texts: t, i: Math.min(i, data.slides.length - 1), confirm: -1 }); renderHymnEditor(); renderMain(); toast('Diapositiva eliminata'); },
  delHymn: async (el, d) => {
    if (S.delHymn !== d.p) { S.delHymn = d.p; $('#hymnPrev').innerHTML = hymnPrevHtml(); return; }
    const r = await api.post('/api/hymn/delete', { path: d.p }); S.delHymn = null; if (!r.ok) return toast('Non sono riuscito a eliminarlo');
    await loadHymns(true); S.hymnSel = Math.min(S.hymnSel, S.hymns.length - 1); renderMain(); toast('Inno spostato nel Cestino'); },
  heSave: async () => { const ed = Object.assign({}, S.settings.hymn_edits || {}); const he = S.he;
    const texts = {}; Object.entries(he.texts).forEach(([k, v]) => { if (Array.isArray(v) || v !== he.data.text[k]) texts[k] = v; });
    if (!Object.keys(texts).length && he.scale === 1) delete ed[he.path]; else ed[he.path] = { scale: he.scale, texts };
    await setSetting('hymn_edits', ed); closeModal(); toast('Inno salvato · il file originale resta com\'era');
    if (S.live.kind === 'hymn' && S.live.file === he.path) setLive(Object.assign({}, S.live, { edit: ed[he.path] || null }), true);
    renderMain(); },
  heReset: () => { S.he.texts = {}; S.he.scale = 1; renderHymnEditor(); },
  importHymn: () => { S.dbMenu = false; S.importSrc = '';
    const nextNum = String(Math.max(0, ...S.hymns.map((h) => parseInt(h.number, 10) || 0)) + 1).padStart(3, '0');
    const lab = 'display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:650;color:var(--sub)';
    modal(`<div style="font-size:18px;font-weight:750">Nuovo inno nello stile dell'innario</div>
      <div style="display:flex;gap:8px"><label style="${lab};width:100px">Numero<input class="field" id="impNum" value="${nextNum}"></label>
      <label style="${lab};flex:1">Titolo<input class="field" id="impTitle" placeholder="se lo lasci vuoto uso la prima riga"></label></div>
      <label style="${lab}">Incolla qui il testo · una riga vuota tra una strofa e l'altra · il ritornello scrivilo una volta sola, iniziando con «Rit:»
      <textarea class="field" id="impText" placeholder="Prima strofa…&#10;&#10;Rit: Ritornello…&#10;&#10;Seconda strofa…" style="height:300px;padding:12px;resize:vertical;line-height:1.5;font-size:14px"></textarea></label>
      <div style="font-size:12px;color:var(--faint)">Il ritornello viene messo in corsivo dopo ogni strofa e alla fine compare «Amen!» in rosso, come negli altri inni.</div>
      <div style="display:flex;gap:8px;justify-content:space-between"><button class="btn" data-a="importFile">Carica da file (PowerPoint, Word, testo)…</button>
      <span style="display:flex;gap:8px"><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" data-a="doImport">Crea l'inno</button></span></div>`, 620); },
  importFile: async () => {
    const ps = await pickInto('file', '', 'Scegli il PowerPoint, il Word o il testo da trasformare', 'hymnsrc'); if (!ps.length) return;
    const r = await api.post('/api/hymn/blocks', { src: ps[0] }); let blocks = r.blocks || [];
    S.importSrc = ps[0];
    const head = (blocks[0] || '').split('\n').map((x) => x.trim()).filter(Boolean);
    if (blocks.length > 1 && head.length <= 2 && head.every((x) => x.length < 70 && !/^rit/i.test(x))) {   // prima diapositiva = titolo (e numero)
      $('#impTitle').value = head.filter((x) => !/^\d+$/.test(x)).join(' '); blocks = blocks.slice(1); }
    $('#impText').value = blocks.join('\n\n'); },
  doImport: async () => {
    let stanzas = $('#impText').value.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean); let title = $('#impTitle').value.trim();
    if (!stanzas.length) return toast('Incolla prima il testo dell\'inno');
    if (!title) { const l = stanzas[0].split('\n'); title = l[0].trim(); if (l.length > 1) stanzas[0] = l.slice(1).join('\n'); else stanzas = stanzas.slice(1); }
    const r = await api.post('/api/hymn/import', { db: S.hymnsDb, src: S.importSrc, number: $('#impNum').value.trim(), title, stanzas });
    closeModal(); if (!r.ok) return toast('Non sono riuscito a creare l\'inno');
    await loadHymns(true); S.hymnSel = Math.max(0, S.hymns.findIndex((h) => h.path === r.path)); renderMain(); toast('Inno creato nell\'innario'); },
  exportHymn: async (el, d) => { S.dbMenu = false; renderMain(); const h = S.hymns[S.hymnSel];
    const r = await api.post('/api/hymn/export', { db: S.hymnsDb, only: d.only ? h.path : '' });
    if (r.ok) toast(r.count + (r.count === 1 ? ' inno esportato' : ' inni esportati') + (r.fonts ? ' · con il carattere dentro il file' : ' · carattere non incluso: caricalo in Impostazioni › Innari')); },
  // bibbia
  bibLang: (el, d) => { setSetting('bible_primary_lang', d.v); renderMain(); loadBooks(); toast('Lingua della Bibbia: ' + el.textContent); },
  // la selezione scorre come nella barra in alto; cambia solo l'elenco dei libri
  testament: (el, d) => { if (S.bib.testament === d.v) return; S.bib.testament = d.v; const seg = el.closest('.seg2');
    seg.dataset.on = d.v === 'NT' ? 1 : 0; $$('button', seg).forEach((b) => b.classList.toggle('on', b === el));
    const g = $('#bookGrid'), tmp = document.createElement('div'); tmp.innerHTML = viewBibbia(); g.innerHTML = $('#bookGrid', tmp).innerHTML;
    g.classList.remove('swap'); void g.offsetWidth; g.classList.add('swap'); },
  bibStep: (el, d) => { S.bibStep = +d.v; renderMain(); },
  book: async (el, d) => { if (REMOTE) S.bibStep = 1; S.bib.book = +d.v; S.bib.chapter = 1; S.bib.verse = 1; await loadChapter(); },
  chapter: async (el, d) => { S.bib.chapter = +d.v; S.bib.verse = 1; await loadChapter(); },
  verseNum: (el, d) => { S.bib.verse = +d.v; if (REMOTE) S.bibStep = 2; renderMain(); },
  projVerse: () => projVerseRef(S.bib.book, S.bib.chapter, S.bib.verse, [lang()].concat(S.settings.bible_extra_langs || [])),
  addVerse: async () => askWhere(await verseSlot(S.bib.book, S.bib.chapter, S.bib.verse)),
  recentVerse: async (el, d) => { Object.assign(S.bib, { book: +d.b, chapter: +d.c, verse: +d.v, testament: +d.b > 39 ? 'NT' : 'AT' }); await loadChapter(); projVerseRef(+d.b, +d.c, +d.v, [lang()].concat(S.settings.bible_extra_langs || [])); },
  openVerse: async (el, d) => { Object.assign(S.bib, { book: +d.b, chapter: +d.c, verse: +d.v, testament: +d.b > 39 ? 'NT' : 'AT' }); S.view = 'bibbia'; await loadChapter(); renderMain(); },
  projSlotVerse: (el, d) => { const [, sl] = findSlot(d.id); const v = sl.data.verse; projVerseRef(v.book, v.chapter, v.verse, v.langs, d.id); },
  liveLang: (el, d) => { const L = S.live; let ls = (L.langs || [lang()]).slice(); ls = ls.includes(d.v) ? (ls.length > 1 ? ls.filter((x) => x !== d.v) : ls) : ls.concat([d.v]); projVerseRef(L.book, L.chapter, L.verse, ls, L.slotId); },
  // ricerca
  projFromSearch: (el, d) => { closePops(); clearSearch(); if (d.k === 'h') { const h = S.searchHy[+d.i]; projHymn({ number: h.number, title: h.title, path: h.path, slides_text: h.slides, audio_path: h.audio }, 0, null); } else projVerseRef(+d.b, +d.c, +d.v); },
  addFromSearch: async (el, d) => { closePops(); clearSearch(); askWhere(d.k === 'h' ? hymnSlot(S.searchHy[+d.i]) : await verseSlot(+d.b, +d.c, +d.v)); },
  // preghiere
  projPrayer: (el, d) => projPrayer(+d.i), projPrayers,
  editPrayer: (el, d) => { const p = d.i === 'new' ? { name: '', reason: '', color: PRAYER_COLORS[S.prayers.length % 6] } : S.prayers[+d.i]; S.editIdx = d.i; S.draftColor = p.color || PRAYER_COLORS[(+d.i || 0) % 6];
    modal(`<div style="font-size:18px;font-weight:750">${d.i === 'new' ? 'Nuova richiesta' : 'Modifica richiesta'}</div>
      <label style="display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:650;color:var(--sub)">Nome<input class="field" id="pName" value="${esc(p.name)}" autofocus></label>
      <label style="display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:650;color:var(--sub)">Motivo<input class="field" id="pReason" value="${esc(p.reason || '')}"></label>
      <div style="display:flex;gap:8px;align-items:center" id="pColors"><span style="font-size:12px;font-weight:650;color:var(--sub);margin-right:4px">Colore</span>${PRAYER_COLORS.map((c) => `<button data-a="pColor" data-c="${c}" aria-label="Colore" style="width:28px;height:28px;border-radius:14px;background:${c};${c === S.draftColor ? `box-shadow:0 0 0 2px var(--solid),0 0 0 4px ${c}` : ''}"></button>`).join('')}</div>
      <div style="display:flex;gap:8px">${d.i !== 'new' ? '<button class="btn danger" data-a="delPrayer">Elimina</button>' : ''}<span style="flex:1"></span><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" data-a="savePrayer">Salva</button></div>`); },
  pColor: (el, d) => { S.draftColor = d.c; $$('#pColors [data-c]').forEach((b) => { b.style.boxShadow = b.dataset.c === d.c ? `0 0 0 2px var(--solid),0 0 0 4px ${d.c}` : ''; }); },
  savePrayer: () => { const name = $('#pName').value.trim(); if (!name) return; const p = { id: uid(), name, reason: $('#pReason').value.trim(), color: S.draftColor };
    if (S.editIdx === 'new') S.prayers.push(p); else S.prayers[+S.editIdx] = Object.assign(S.prayers[+S.editIdx], p, { id: S.prayers[+S.editIdx].id || p.id });
    savePrayers(); closeModal(); renderMain(); toast('Richiesta salvata'); },
  delPrayer: () => { S.prayers.splice(+S.editIdx, 1); savePrayers(); closeModal(); renderMain(); toast('Richiesta eliminata'); },
  // altri elementi
  projText: (el, d) => { const [, sl] = findSlot(d.id); setLive({ kind: 'text', style: 'plain', main: sl.data.text || '', size: sl.data.size || 1, slotId: d.id, label: 'Testo', sub: '' }); },
  projImage: (el, d) => { setLive({ kind: 'image', style: 'image', image: d.p, slotId: S.sel, label: 'Immagine', sub: d.p.split('/').pop() }); if (S.view === 'scaletta') { $('#detail').innerHTML = detailHtml(); requestAnimationFrame(scalePreview); } },
  setPath: async (el, d) => { const [, sl] = findSlot(d.id);
    const [lib, types, what] = { immagine: ['immagini', 'image', 'l\'immagine'], video: ['video', 'video', 'il video'], audio: ['audio', 'audio', 'l\'audio'], presentazione: ['presentazioni', 'deck', 'il PowerPoint o il PDF'] }[sl.slot_type] || ['documenti', null, 'il file'];
    const ps = await pickInto('file', lib, 'Scegli ' + what, types); if (!ps.length) return;
    sl.data.path = ps[0]; sl.display_name = fileName(ps[0]).replace(/\.[^.]+$/, ''); saveSchedule(); renderMain(); },
  projDeck: (el, d) => projDeck(d.id, +d.i),
  projVideo: (el, d) => { const [, sl] = findSlot(d.id); vdur(sl.data.path); setLive({ kind: 'video', style: 'video', file: sl.data.path, playing: false, pos: 0, at: Date.now(), slotId: d.id, label: slotTitle(sl), sub: 'Video' }); },
  vToggle: () => vset({ playing: !S.live.playing }),
  vSkip: (el, d) => vset({ pos: Math.max(0, Math.min((vdur(S.live.file) || 1e9) - 0.5, vpos(S.live) + +d.s)) }),
  vRate: (el, d) => { const r = +d.d ? Math.min(2, Math.max(0.5, Math.round(((S.live.vrate || 1) + +d.d) * 100) / 100)) : 1; vset({ vrate: r }); renderDock(); },
  vRestart: () => vset({ pos: 0, playing: false }),
  ytAsk: (el, d) => { S.ytSlot = d.id; S.ytKind = d.kind || (findSlot(d.id)[1] || {}).slot_type || 'video'; modal(`<div style="font-size:18px;font-weight:750">${S.ytKind === 'audio' ? 'Audio' : 'Video'} da YouTube</div><div style="color:var(--sub);font-size:13px">Incolla l'indirizzo del video: viene scaricato nell'app, così in chiesa parte anche senza internet.</div>
    <input class="field" id="ytUrl" placeholder="https://www.youtube.com/watch?v=…" style="height:42px">
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" data-a="ytGo">Scarica</button></div>`, 480); setTimeout(() => $('#ytUrl').focus(), 50); },
  ytGo: async () => { const url = $('#ytUrl').value.trim(); if (!url) return; closeModal();
    const r = await api.post('/api/youtube', { url, kind: S.ytKind, slot: S.ytSlot || '' }); if (!r.ok) return toast(r.error || 'Download non riuscito');
    S.jobTo = S.jobTo || {}; S.jobTo[r.job] = { slot: S.ytSlot || '', add: S.view !== 'media', addTo: S.addTo };
    toast(S.ytKind === 'audio' ? 'Scarico l\'audio: lo vedi avanzare in Media' : 'Scarico il video: lo vedi avanzare in Media'); pollJobs(); },
  // timer
  tAdj: (el, d) => { const T = S.timer; if (T.running) T.endAt += +d.d * 1000; else { T.total = T.remaining = Math.max(60, T.remaining + +d.d); } timerTick(); timerLive(); },
  tSet: (el, d) => { const T = S.timer; T.total = T.remaining = +d.m * 60; T.running = false; timerLive(); renderMain(); },
  tUntilGo: () => { const v = $('#tUntil').value; if (!v) return toast('Scegli un\'ora'); S.tUntilV = v; act.tUntil(null, { v }); },
  tUntil: (el, d) => { const T = S.timer, [h, m] = String(d.v).split(':').map(Number), t = new Date(); t.setHours(h, m, 0, 0);
    const secs = Math.round((t - Date.now()) / 1000); if (secs <= 0) return toast('Quell\'ora è già passata');
    T.running = false; T.total = T.remaining = secs; act.tToggle(); },
  tToggle: () => { const T = S.timer;
    if (T.running) { T.remaining = Math.max(0, Math.round((T.endAt - Date.now()) / 1000)); T.running = false; timerLive(); } else { if (!T.remaining) T.remaining = T.total; T.running = true; T.warned = T.faded = false; T.endAt = Date.now() + T.remaining * 1000; pmPlay();
      setLive({ kind: 'timer', style: 'timer', endAt: T.endAt, text: S.settings.timer_text || 'Il programma riprenderà tra', slotId: S.sel, label: 'Timer pausa', sub: 'In corso' }); }
    renderMain(); },
  // audio
  audioToggle: (el, d) => { if (d.k === 'pm') { const a = $('#pmAudio'); if (a.paused) pmPlay(); else a.pause(); } else { const a = $('#baseAudio'); if (a.paused) a.play(); else a.pause(); renderDock(); } },
  // a passi del 5%, tra 50% e 150%; l'intonazione resta uguale
  // velocità della base: il motore prepara la versione rallentata/accelerata
  // (suona naturale) e si riparte dallo stesso punto del brano
  audioRate: async (el, d) => { const a = $('#baseAudio'); if (!a.dataset.p) return;
    const cur = +(a.dataset.rate || 1), r = +d.d ? Math.min(1.5, Math.max(0.5, Math.round((cur + +d.d) * 100) / 100)) : 1;
    if (r === cur) return;
    $$('[data-prate]').forEach((b) => { b.textContent = '…'; });
    let src = amedia(a.dataset.p);
    if (r !== 1) { const t = await api.get(`/api/tempo?p=${encodeURIComponent(a.dataset.p)}&r=${r}`); if (!t.ok) { toast('Non riesco a cambiare la velocità'); $$('[data-prate]').forEach((b) => { b.textContent = Math.round(cur * 100) + '%'; }); return; } src = amedia(t.path); }
    // la nuova versione si prepara a parte e prende il posto della vecchia
    // nello stesso punto: la musica non si ferma
    const b = document.createElement('audio'), p = a.dataset.p; b.preload = 'auto'; b.src = src;
    await new Promise((ok) => { b.addEventListener('canplaythrough', ok, { once: true }); b.addEventListener('error', ok, { once: true }); });
    if ($('#baseAudio') !== a || a.dataset.p !== p) return;   // nel frattempo è cambiata base
    b.id = 'baseAudio'; b.dataset.p = p; b.dataset.rate = r; b.volume = a.volume; S.rateP = p;
    b.currentTime = a.currentTime * cur / r;
    wireBase(b);
    if (!a.paused) { await b.play().catch(() => {}); b.currentTime = a.currentTime * cur / r; }
    a.pause(); a.replaceWith(b);
    $$('[data-prate]').forEach((x) => { x.textContent = Math.round(r * 100) + '%'; }); sendStatus(); },
  audioSkip: (el, d) => { const a = d.k === 'pm' ? $('#pmAudio') : $('#baseAudio'); a.currentTime = Math.max(0, Math.min((a.duration || 1e9) - 0.5, a.currentTime + +d.s)); },
  playBase: () => { const h = S.hymns[S.hymnSel], b = $('#baseAudio'); if (!h || !h.audio) return;
    if (b.dataset.p !== h.audio) { b.src = amedia(h.audio); b.dataset.p = h.audio; S.baseTitle = h.number + ' — ' + h.title; }
    b.play(); renderDock(); if (REMOTE) toast('Base avviata sul Mac · controlla da «In onda»'); },
  imgZoom: (el, d) => { setTimeout(() => { if ($('#bigPrev')) $$('#detail [data-a="imgZoom"][data-d="0"]').forEach((b) => { b.textContent = Math.round((S.live.iz || 1) * 100) + '%'; }); }); const z = +d.d ? Math.min(6, Math.max(1, (S.live.iz || 1) * (+d.d > 0 ? 1.25 : 0.8))) : 1; S.live.iz = z; if (z === 1) { S.live.icx = 0.5; S.live.icy = 0.5; } pushView(); renderDock(); },
  ptrToggle: () => { S.ptrOn = !S.ptrOn; setTimeout(() => $$('#detail [data-a="ptrToggle"]').forEach((b) => { b.classList.toggle('on', S.ptrOn); b.textContent = S.ptrOn ? 'Puntatore acceso' : 'Puntatore'; })); if (!S.ptrOn) { S.live.ptr = null; pushView(); } renderDock(); },
  mediaRename: (el, d) => { const m = S.media[+d.i]; S.renIdx = +d.i;
    modal(`<div style="font-size:18px;font-weight:750">Rinomina</div><input class="field" id="renName" value="${esc(m.name)}" autofocus>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" data-a="mediaRenameGo">Salva</button></div>`, 440); },
  mediaRenameGo: async () => { const name = $('#renName').value.trim(); if (!name) return; closeModal(); await api.post('/api/library/rename', { path: S.media[S.renIdx].path, name }); loadMedia(); },
  // audio -> base musicale di un inno (anche per sostituire quella che c'è)
  baseFromMedia: (el, d) => { S.baseSrc = S.media[+d.i]; S.baseQ = ''; baseHymnModal(); },
  baseHymnPick: async (el, d) => setBase(S.hymns[+d.i], S.baseSrc.path),
  baseForHymn: async () => { if (!S.media) S.media = await api.get('/api/library'); S.baseHymn = S.hymns[S.hymnSel]; const au = S.media.map((m, i) => [m, i]).filter(([m]) => m.kind === 'audio');
    modal(`<div style="font-size:18px;font-weight:750">Base per «${esc(S.baseHymn.number + ' — ' + S.baseHymn.title)}»</div>
      <div class="scr" style="display:flex;flex-direction:column;gap:4px;max-height:50vh">${au.length ? au.map(([m, i]) => `<button class="menu-row soft" data-a="baseMediaPick" data-i="${i}">${svg('audio', 15)}${esc(m.name)}</button>`).join('') : '<div style="color:var(--sub)">Nessun audio in Media.</div>'}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" data-a="baseFromMac">Scegli dal Mac…</button></div>`, 480); },
  baseMediaPick: (el, d) => setBase(S.baseHymn, S.media[+d.i].path),
  baseFromMac: async () => { closeModal(); const ps = await pickInto('file', 'audio', 'Scegli la base musicale', 'audio'); if (ps.length) setBase(S.baseHymn, ps[0]); },
  // guardare le diapositive in grande, senza proiettare
  viewSlides: async (el, d) => { const data = await getSlides(d.p), edit = hymnEdit(d.p);
    modal(`<div style="display:flex;align-items:center"><b style="flex:1;font-size:17px">Anteprima</b><button class="btn sm" data-a="closeModal">Chiudi</button></div>
      <div class="scr" id="bigSlides" style="display:flex;flex-direction:column;gap:14px;max-height:78vh">${data.slides.map((_, i) => `<div id="bs${i}" style="display:flex;flex-direction:column;gap:6px">${thumb(data, i, edit)}
        ${d.id ? `<button class="btn sm pri" data-a="${d.proj || 'projHymn'}" data-id="${d.id}" data-i="${i}" style="align-self:flex-end">Proietta questa</button>` : ''}</div>`).join('')}</div>`, Math.min(1100, innerWidth - 20));
    const t = $('#bs' + d.i); if (t) t.scrollIntoView({ block: 'start' }); },
  mediaF: (el, d) => { S.mediaF = d.v; $$('#mediaView .seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === d.v)); $('#mediaList').innerHTML = mediaListHtml(); },
  mediaPick: async () => { const ps = await pickInto('file', null, 'Scegli video o audio', null, true); for (const p of ps) await mediaImport(p); loadMedia(); },
  mediaAdd: (el, d) => { const m = S.media[+d.i]; askWhere({ id: uid(), slot_type: m.kind, display_name: m.name, data: { path: m.path } }); },
  mediaPlay: (el, d) => { const m = S.media[+d.i];
    if (m.kind === 'video') { vdur(m.path); setLive({ kind: 'video', style: 'video', file: m.path, playing: false, pos: 0, at: Date.now(), slotId: null, label: m.name, sub: 'Video · avvialo da qui' }); return; }
    const b = $('#baseAudio'); b.src = amedia(m.path); b.dataset.p = m.path; S.baseTitle = m.name; b.play(); renderDock(); },
  mediaDel: (el, d) => { const m = S.media[+d.i]; modal(`<div style="font-size:18px;font-weight:750">Eliminare «${esc(m.name)}»?</div><div style="color:var(--sub)">Il file viene tolto dall'app.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" style="background:var(--danger)" data-a="mediaDelGo" data-i="${d.i}">Elimina</button></div>`, 420); },
  mediaDelGo: async (el, d) => { closeModal(); await api.post('/api/library/remove', { path: S.media[+d.i].path }); loadMedia(); },
  audioRestart: (el, d) => { const a = d.k === 'pm' ? $('#pmAudio') : $('#baseAudio'); a.currentTime = 0; },
  audioOff: (el, d) => { if (d.k === 'pm') { $('#pmAudio').pause(); S.pm.on = false; } else { const a = $('#baseAudio'); a.pause(); a.removeAttribute('src'); a.dataset.p = ''; a.load(); } renderDock(); },
  pmPrev: () => { S.pm.idx = (S.pm.idx - 1 + S.pm.files.length) % S.pm.files.length; pmPlay(); },
  pmNext: () => { S.pm.idx = (S.pm.idx + 1) % S.pm.files.length; pmPlay(); },
  // dock
  step: (el, d) => step(+d.d), stop: () => { stopLive(); if (REMOTE) $('#dock').classList.remove('ropen'); },
  overlay: (el, d) => { S.live.overlay = S.live.overlay === d.v ? null : d.v; pushLive(); },
  zoom: () => { S.zoom = !S.zoom; pushLive(); }, clearHl: () => { S.hl = null; pushLive(); },
  // impostazioni
  cat: (el, d) => { S.cat = d.v; S.space = null; renderMain(); },
  addDb: async () => { toast('Dopo la scelta copio l\'innario nell\'app: con molti inni ci vuole qualche minuto, aspetta il messaggio «Innario aggiunto»', false, 600000);
    const ps = await pickInto('folder', 'innari', 'Scegli la cartella dell\'innario (PowerPoint e basi musicali)'); if (!ps.length) { $('#toast').innerHTML = ''; return; }
    toast('Innario aggiunto'); const dbs = (S.settings.databases || []).concat(ps); await setSetting('databases', dbs); if (!S.hymnsDb) { S.hymnsDb = ps[0]; setSetting('last_database', ps[0]); loadHymns(); } await refreshBoot(); },
  removeDb: (el, d) => modal(`<div style="font-size:18px;font-weight:750">Togliere l'innario?</div><div style="color:var(--sub)">La copia dentro l'app viene cancellata. Il file originale sul Mac non viene toccato.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" style="background:var(--danger)" data-a="doRemoveDb" data-p="${esc(d.p)}">Togli</button></div>`, 420),
  doRemoveDb: async (el, d) => { closeModal(); await setSetting('databases', (S.settings.databases || []).filter((x) => x !== d.p)); api.post('/api/library/remove', { path: d.p });
    if (S.hymnsDb === d.p) { S.hymnsDb = (S.settings.databases || [])[0] || ''; S.hymns = []; setSetting('last_database', S.hymnsDb); loadHymns(); } await refreshBoot(); },
  pickSetting: async (el, d) => { const ps = await pickInto(d.folder ? 'folder' : 'file', d.lib, 'Scegli', d.t || null); if (!ps.length) return;
    await setSetting(d.k, ps[0]); if (d.k === 'background_music_folder') S.pm.files = []; renderMain(); },
  clearSetting: async (el, d) => { await setSetting(d.k, ''); renderMain(); },
  setVal: async (el, d) => { await setSetting(d.k, d.v === '' ? false : (d.v === '1' ? true : d.v)); renderMain(); },
  testBell: () => { if (S.settings.bell_sound) playFx(S.settings.bell_sound); },
  pickLesson: async () => { const ps = await pickInto('file', 'lezioni', 'Scegli il file del lezionario (JSON)', 'json'); if (!ps.length) return;
    await setSetting('lesson_file', ps[0]); await setSetting('lesson_override_index', -1); await loadLesson(); renderMain(); },
  gtab: (el, d) => { S.gtab = d.v; renderMain(); },
  resetProfile: () => { const profs = Object.assign({}, S.settings.lesson_graphic_profiles || {}); delete profs[S.gtab]; setSetting('lesson_graphic_profiles', profs).then(renderMain); },
  pickTemplate: async () => { const ps = await pickInto('file', 'modelli', 'Scegli l\'immagine del modello', 'image'); if (!ps.length) return; saveProfile(S.gtab || 'domanda', { template: ps[0] }); renderMain(); },
  removeTemplate: () => { saveProfile(S.gtab || 'domanda', { template: '' }); renderMain(); },
  goUpdate: () => { S.view = 'impostazioni'; S.cat = 'versione'; closePops(); renderMain(); },
  doUpdate: async () => { toast('Scarico l\'aggiornamento… l\'app si chiude e si riapre da sola');
    const r = await api.post('/api/update/install', {}); if (!r.ok) return toast(r.error || 'Aggiornamento non riuscito'); },
  newRoom: async () => { await setSetting('phone_room', ''); await setSetting('phone_code', ''); location.reload(); },
  addFont: async () => { const ps = await pickInto('file', 'fonts', 'Scegli i file dei caratteri (.ttf, .otf)', 'font', true); if (!ps.length) return;
    document.querySelectorAll('link[href^="/fonts.css"]').forEach((l) => { l.href = '/fonts.css?' + Date.now(); });
    api.post('/api/cmd', { sync: 'fonts' }); setTimeout(fontBox, 600); toast(ps.length === 1 ? 'Carattere caricato' : ps.length + ' caratteri caricati'); },
  backupExport: async () => { const r = await api.post('/api/backup/export', {}); if (r.ok) toast('Backup salvato: ' + fileName(r.path)); },
  backupImport: () => modal(`<div style="font-size:18px;font-weight:750">Ripristinare un backup?</div>
    <div style="color:var(--sub)">Scaletta, innari, modelli e impostazioni vengono sostituiti da quelli del backup. I dati di adesso restano da parte, in una cartella accanto, finché non ripristini di nuovo.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" data-a="doRestore">Scegli il backup…</button></div>`, 460),
  doRestore: async () => { closeModal(); const r = await api.post('/api/backup/import', {}); if (r.error) return toast(r.error); if (r.ok) location.reload(); },
  migrateOld: () => modal(`<div style="font-size:18px;font-weight:750">Importa dalla vecchia app</div>
    <div style="color:var(--sub)">Scegli la cartella <b>config</b> della versione 1 (dentro c'è settings.json). Su Windows si trova in <b>%APPDATA%\\Gestione programma SDARM</b>: copiala su una chiavetta.</div>
    <div style="color:var(--sub)">Arrivano impostazioni, colori, scaletta, modelli di scaletta e preghiere. Innari, modelli grafici e suoni vengono copiati se si trovano su questo Mac; gli altri li ricarichi tu.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-a="closeModal">Annulla</button><button class="btn pri" data-a="doMigrate">Scegli la cartella…</button></div>`, 500),
  doMigrate: async () => { closeModal(); toast('Importo… può volerci un minuto se ci sono innari');
    const r = await api.post('/api/migrate', {}); if (r.error) return toast(r.error); if (!r.ok) return;
    await resync(); S.hymnsDb = S.settings.last_database || S.hymnsDb; await loadHymns(true);
    modal(`<div style="font-size:18px;font-weight:750">Importazione fatta</div><div>${r.dbs} innari copiati.</div>
      ${r.missing.length ? `<div style="color:var(--sub)">Questi file non sono su questo Mac, ricaricali da Impostazioni:</div><div class="soft scr" style="max-height:200px;font-size:12.5px">${r.missing.map(esc).join('<br>')}</div>` : ''}
      <div style="display:flex;justify-content:flex-end"><button class="btn pri" data-a="closeModal">Ok</button></div>`, 460); },
};
if (REMOTE) FWD.forEach((k) => { act[k] = (el, d) => api.post('/api/cmd', { cmd: k, d: Object.assign({}, d) }); });
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!e.target.closest('[data-pop]')) { ['#sunPop', '#morePop', '#searchPop'].forEach((p) => $(p).classList.add('hidden')); if (S.dbMenu && !el) { S.dbMenu = false; renderMain(); } }
  if (!el || !act[el.dataset.a]) return;
  act[el.dataset.a](el, el.dataset, e);
});
window.addEventListener('resize', () => { placePill(); scalePreview(); });
setupDrag(); setupWords(); setupPreviewTools(); setupSwipe();
/* telefono: i fogli si chiudono anche trascinandoli in giù */
function setupSwipe() {
  if (!REMOTE) return;
  let g = null;
  document.addEventListener('touchstart', (e) => {
    const sh = e.target.closest('.sheet.open, .dock.ropen'); if (!sh || e.target.closest('#words, input, textarea, [data-seek], .preview')) return;
    const sc = sh.classList.contains('dock') ? $('.glass', sh) : sh; if (sc.scrollTop > 0) return;
    g = { sh, y: e.touches[0].clientY, dy: 0 };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => { if (!g) return; g.dy = Math.max(0, e.touches[0].clientY - g.y); g.sh.style.transition = 'none'; g.sh.style.transform = `translateY(${g.dy}px)`; }, { passive: true });
  document.addEventListener('touchend', () => { if (!g) return; const { sh, dy } = g; g = null; sh.style.transition = ''; sh.style.transform = '';
    if (dy > 90) { if (sh.classList.contains('dock')) sh.classList.remove('ropen'); else act.closeSheet(); } });
} setupGraphicsEditor();
boot();
document.addEventListener('change', (e) => { if (e.target.id === 'vseek') { vset({ pos: +e.target.value }); e.target.blur(); } });
