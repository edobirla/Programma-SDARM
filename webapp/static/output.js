/* Uscita sui proiettori (e anteprima nel pannello con ?preview=1).
   Riceve lo stato "in onda" via SSE e lo disegna: modelli grafici della
   lezione, versetti, inni, preghiere, timer, immagini, Nero/Sfondo/Congela,
   evidenziazione con zoom. */
'use strict';
const PREVIEW = new URLSearchParams(location.search).has('preview');
// anteprima «In sala» nel pannello: come i proiettori (Nero/Sfondo/Congela compresi) ma muta
const ROOMVIEW = new URLSearchParams(location.search).get('preview') === 'room';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const media = (p) => (window.NO_MEDIA ? '' : '/media?p=' + encodeURIComponent(p));
// anteprima sul telefono con i dati: tutto passa da Firebase
const xf = (u, o) => (window.CLOUD ? window.cloudFetch(u, o) : fetch(u, o));
let ST = {}, cur = { kind: 'none' }, shownKey = '', imgDims = {}, timerT = 0;
const slidesCache = {};

if (PREVIEW) document.body.classList.add('preview');
$('#hint').style.display = PREVIEW || new URLSearchParams(location.search).has('native') ? 'none' : '';
setTimeout(() => { $('#hint').style.opacity = 0; }, 6000);
document.addEventListener('click', () => { if (!PREVIEW && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); });
document.addEventListener('keydown', (e) => {
  if (PREVIEW) return;
  const send = (body) => fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (e.key === 'Escape') send({ kind: 'none', from: 'output' });
  // la finestra del proiettore prende il fuoco: le frecce comandano comunque il pannello
  const cmd = (c, d) => fetch('/api/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd: c, d }) });
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); cmd('step', { d: '1' }); }
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); cmd('step', { d: '-1' }); }
});

// impostazioni che cambiano l'aspetto della proiezione (le altre non la ridisegnano)
const LOOK = ['lesson_graphic', 'verse_', 'timer_', 'lesson_header', 'lesson_date', 'lesson_letter', 'lesson_question', 'lesson_font', 'background_image', 'offering', 'idle_', 'text_', 'prayer_', 'hymn_edits'];
const looks = (st) => JSON.stringify(Object.keys(st || {}).sort().filter((k) => LOOK.some((p) => k.startsWith(p))).map((k) => [k, st[k]]));
function H() { return $('#stage').clientHeight || 1080; }
function px(f) { return Math.round(H() * f) + 'px'; }

/* testo che riempie il suo riquadro: ricerca binaria sulla dimensione */
function fit(el, maxPx) {
  let lo = 8, hi = maxPx || Math.round(H() * 0.2);
  el.style.fontSize = hi + 'px';
  if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) return;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1; el.style.fontSize = mid + 'px';
    if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) lo = mid; else hi = mid;
  }
  el.style.fontSize = lo + 'px';
}
// testo libero: gli a capo restano, la numerazione delle parole continua
const linesWords = (t) => { let n = 0; return String(t || '').split('\n').map((line) => { const ws = line.split(/\s+/).filter(Boolean);
  const h = ws.map((w, i) => (i ? `<span class="sp" data-s="${n + i - 1}"> </span>` : '') + `<span class="w" data-w="${n + i}">${esc(w)}</span>`).join(''); n += ws.length; return h; }).join('<br>'); };
// parole e spazi separati: l'evidenziazione copre anche gli spazi, come un'unica striscia
const words = (t) => String(t || '').split(/\s+/).filter(Boolean).map((w, i) => (i ? `<span class="sp" data-s="${i - 1}"> </span>` : '') + `<span class="w" data-w="${i}">${esc(w)}</span>`).join('');
// riferimenti della domanda: sotto il testo, più piccoli e di un altro colore
const refLine = (ref, color) => (ref ? `<div style="font-size:.68em;margin-top:.4em;font-weight:700;text-align:center;white-space:nowrap;color:${color}">${esc(ref)}</div>` : '');
const boxStyle = (b) => `left:${b[0] * 100}%;top:${b[1] * 100}%;width:${b[2] * 100}%;height:${b[3] * 100}%`;

function profile(name) { return ((ST.lesson_graphic_profiles || {})[name]) || {}; }

/* ── costruzione del contenuto ─────────────────────────────────────────── */
function build(s) {
  const verseBg = ST.verse_bg_image ? `url("${media(ST.verse_bg_image)}") center/cover, ` : '';
  const plainBg = verseBg + (ST.verse_bg_color || '#0b132b');
  // sfondi propri per i testi e per le preghiere (se scelti in Impostazioni)
  const textBg = ST.text_bg_image || ST.text_bg_color ? (ST.text_bg_image ? `url("${media(ST.text_bg_image)}") center/cover, ` : '') + (ST.text_bg_color || ST.verse_bg_color || '#0b132b') : plainBg;
  const prayerBg = (g) => (ST.prayer_bg_image ? `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)), url("${media(ST.prayer_bg_image)}") center/cover` : ST.prayer_bg_color || g);
  const font = ST.verse_font_family || 'Helvetica';
  // grafica personalizzata (Impostazioni › Grafiche) per testi, preghiere e timer
  const PK = { text: 'testo', prayer: 'preghiera', prayers: 'elenco_preghiere', timer: 'timer' }[s.kind];
  if (PK && (ST.lesson_graphic_profiles || {})[PK]) return buildCustom(s, PK, profile(PK));
  const prof = s.profile ? profile(s.profile) : {};
  // modello mancante (file spostato o cancellato): si usa la grafica semplice
  if (prof.template && imgDims[media(prof.template)] !== 'missing' && ['lesson', 'verse', 'intro'].includes(s.kind)) return buildTemplate(s, prof);
  if (s.style === 'pptx') {
    const u = s.src || '/api/slides?p=' + encodeURIComponent(s.file), data = slidesCache[u];
    if (data === undefined) { xf(u).then((r) => (r.ok ? r.json() : null)).then((d) => { slidesCache[u] = d; shownKey = ''; show(cur); }); return { bg: '#000', html: '' }; }
    if (data && data.slides[s.i]) return { bg: '#000', html: `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);aspect-ratio:${data.ratio};width:min(100%,calc(100cqh*${data.ratio}));container-type:size;overflow:hidden">${slideHTML(data.slides[s.i], s.i, s.edit)}</div>` };
    s = Object.assign({}, s, { style: 'hymn' });          // PowerPoint illeggibile: solo testo
  }
  switch (s.style) {
    case 'domanda': return {
      bg: plainBg, html: `
      <div class="box" style="${boxStyle([0.03, 0.03, 0.6, 0.09])};justify-content:flex-start;color:${ST.lesson_header_color || '#5aae5f'};font:800 ${px(0.045)} -apple-system,system-ui,sans-serif;letter-spacing:.04em">${esc(s.top)}</div>
      <div class="box" style="${boxStyle([0.68, 0.03, 0.29, 0.09])};align-items:flex-end;color:${ST.lesson_date_color || '#e38d3d'};font:700 ${px(0.038)} -apple-system,system-ui,sans-serif">${esc(s.date)}</div>
      ${s.photo ? `<div class="box" style="${boxStyle([0, 0.15, 1, 0.32])};background:url('${media(s.photo)}') center/cover"></div>` : ''}
      <div class="box fit" data-max="${Math.round(H() * 0.09)}" style="${boxStyle(s.photo ? [0.05, 0.52, 0.9, 0.42] : [0.06, 0.2, 0.88, 0.66])};font-family:${font};font-weight:600;color:${ST.lesson_question_color || '#fff'}">
        <div><span style="color:${ST.lesson_letter_color || ST.lesson_header_color || '#5aae5f'};font-weight:700">${esc(s.marker || '')}</span> ${words(s.main)}${refLine(s.ref, profile('domanda').colors?.riferimento || '#e9c48f')}</div></div>` };
    case 'intro': { // senza modello: foto della settimana come sfondo, riquadri da Impostazioni › Grafiche
      const ip = profile(s.profile || 'introduzione'), B = boxesOf(ip, s.profile || 'introduzione'), C = ip.colors || {}, M = ip.max_sizes || {};
      const key = s.step === 0 ? 'header' : 'testo';
      return { bg: introBg(window.NO_MEDIA ? '' : s.photo),
        html: `<div class="box center" style="${boxStyle(B.date)};color:${C.date || '#e9c48f'};font:700 ${px(0.03)} -apple-system,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase">${esc(s.kicker)}${s.date ? ' · ' + esc(s.date) : ''}</div>
        <div class="box center fit" data-max="${M[key] || Math.round(H() * (s.step === 0 ? 0.13 : 0.075))}" style="${boxStyle(B[key])};color:${C[key] || '#fff'};font-family:${ip.font_family ? `'${ip.font_family}'` : 'Georgia,serif'};font-weight:${s.step === 0 ? 700 : 500}"><div>${words(s.main)}</div></div>
        ${s.ref && B.riferimento ? `<div class="box center fit" data-max="${M.riferimento || Math.round(H() * 0.05)}" style="${boxStyle(B.riferimento)};color:${C.riferimento || '#e9c48f'};font-family:${ip.font_family ? `'${ip.font_family}'` : 'Georgia,serif'};font-weight:600"><div>${esc(s.ref)}</div></div>` : ''}` }; }
    case 'hymn': return { bg: plainBg, html: `<div class="box center fit" data-max="${Math.round(H() * 0.085)}" style="${boxStyle([0.06, 0.08, 0.88, 0.84])};font-family:${font};font-weight:600;white-space:pre-line"><div>${esc(s.main)}</div></div>` };
    case 'timer': return { bg: (ST.timer_bg_image ? `url("${media(ST.timer_bg_image)}") center/cover, ` : '') + (ST.timer_bg_color || '#0b132b'), timer: true,
      html: `<div class="box center" style="${boxStyle([0.1, 0.18, 0.8, 0.12])};color:${ST.timer_text_color || '#fff'};font:500 ${px(0.055)} -apple-system,system-ui,sans-serif;opacity:.85">${esc(s.text)}</div>
        <div class="box center" id="tval" style="${boxStyle([0.05, 0.3, 0.9, 0.45])};color:${ST.timer_text_color || '#fff'};font:200 ${px(0.32)} -apple-system,system-ui,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-.04em"></div>` };
    case 'video': return { bg: '#000', html: `<video src="${media(s.file)}" playsinline preload="auto" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain"></video>` };
    case 'image': return { bg: '#000', html: `<img class="zimg" src="${media(s.image)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">` };
    case 'prayer': return { bg: prayerBg('radial-gradient(1100px 700px at 50% 40%, #2a1622, #0b0d18 75%)'), html: `
      <div class="box center" style="${boxStyle([0.1, 0.22, 0.8, 0.08])};color:#ee7c90;font:800 ${px(0.03)} -apple-system,system-ui,sans-serif;letter-spacing:.24em">PREGHIAMO PER</div>
      <div class="box center fit" data-max="${Math.round(H() * 0.2)}" style="${boxStyle([0.06, 0.28, 0.88, 0.3])};font:700 1px -apple-system,system-ui,sans-serif"><div>${esc(s.main)}</div></div>
      ${s.reason ? `<div class="box center" style="${boxStyle([0.06, 0.6, 0.88, 0.22])}"><span style="font:700 ${px(0.1)} -apple-system,system-ui,sans-serif;color:${s.color};padding:.2em .9em;border-radius:1em;background:${s.color}33">${esc(s.reason)}</span></div>` : ''}` };
    case 'list': {
      const n = (s.list || []).length, rowH = Math.min(0.15, 0.76 / Math.max(1, n));
      return { bg: prayerBg('radial-gradient(1100px 700px at 50% 30%, #2a1622, #0b0d18 75%)'), html: `
        <div class="box center" style="${boxStyle([0.1, 0.06, 0.8, 0.08])};color:#ee7c90;font:800 ${px(0.03)} -apple-system,system-ui,sans-serif;letter-spacing:.24em">PREGHIAMO PER</div>
        ${(s.list || []).map((p, i) => `<div class="box" style="${boxStyle([0.14, 0.17 + i * rowH, 0.72, rowH])};flex-direction:row;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,.14);font-family:-apple-system,system-ui,sans-serif">
          <span style="font-size:${px(rowH * 0.5)};font-weight:650">${esc(p.name)}</span>${p.reason ? `<span style="font-size:${px(rowH * 0.45)};font-weight:700;color:${p.color};padding:.25em .9em;border-radius:1em;background:${p.color}33">${esc(p.reason)}</span>` : ''}</div>`).join('')}` };
    }
    default: { // plain: versetti, nota, testo
      const tb = ST.verse_text_box || [0.07, 0.1, 0.86, 0.55], rb = ST.verse_ref_box || [0.25, 0.78, 0.5, 0.08];
      const extra = (s.extra || []).map((t) => `<div style="font-size:.8em;opacity:.85;font-style:italic;margin-top:.6em">${esc(t)}</div>`).join('');
      const head = s.top ? `<div class="box" style="${boxStyle([0.03, 0.03, 0.6, 0.08])};justify-content:flex-start;color:#5aae5f;font:800 ${px(0.04)} -apple-system,system-ui,sans-serif">${esc(s.top)}</div>
        <div class="box" style="${boxStyle([0.68, 0.03, 0.29, 0.08])};align-items:flex-end;color:#e38d3d;font:700 ${px(0.034)} -apple-system,system-ui,sans-serif">${esc(s.date || '')}</div>` : '';
      return { bg: s.kind === 'text' ? textBg : plainBg, html: head + `
        <div class="box center fit" data-max="${Math.round(H() * 0.1 * (s.size || 1))}" style="${boxStyle(s.kind === 'text' ? [tb[0], tb[1], tb[2], Math.max(tb[3], 0.8)] : tb)};color:${ST.verse_text_color || '#fff'};font-family:${s.serif ? 'Georgia,serif' : font};font-weight:${s.serif ? 500 : 600};${s.italic ? 'font-style:italic' : ''}"><div>${s.kind === 'text' ? linesWords(s.main) : words(s.main)}${extra}</div></div>
        ${s.ref ? `<div class="box center fit" data-max="${ST.verse_ref_max_size || Math.round(H() * 0.045)}" style="${boxStyle(rb)};color:${ST.verse_ref_color || '#b9b2a2'};font-family:${ST.verse_ref_font_family || font};font-weight:600">${esc(s.ref)}</div>` : ''}` };
    }
  }
}

/* modello grafico: immagine di sfondo + riquadri in frazioni dell'immagine */
function buildTemplate(s, prof) {
  const src = media(prof.template);
  const dim = imgDims[src];
  if (!dim) { const im = new Image(); im.onload = () => { imgDims[src] = [im.naturalWidth, im.naturalHeight]; shownKey = ''; show(cur); };
    im.onerror = () => { imgDims[src] = 'missing'; shownKey = ''; show(cur); }; im.src = src; return { bg: '#000', html: '' }; }
  const B = boxesOf(prof, s.profile), C = prof.colors || {}, M = prof.max_sizes || {};
  const font = prof.font_family || ST.lesson_font_family || ST.verse_font_family || 'Helvetica';
  const head = C.header || ST.lesson_header_color || '#5aae5f';
  const cell = (key, inner, opts = {}) => B[key] ? `<div class="box ${opts.center ? 'center' : ''} ${opts.fit ? 'fit' : ''}" data-max="${M[key] || opts.max || 200}" style="${boxStyle(opts.box || B[key])};color:${opts.color};font-family:${font};font-weight:${opts.w || 600}${opts.nowrap ? ';white-space:nowrap' : ''}">${inner}</div>` : '';
  let inner = cell('header', `<div>${esc(s.top || '')}</div>`, { fit: true, color: head, w: 800, max: 70 }) + cell('date', `<div>${esc(s.date || '')}</div>`, { fit: true, color: C.date || ST.lesson_date_color || head, w: 700, max: 60 });
  if (B.photo && s.photo) inner += `<div class="box" style="${boxStyle(B.photo)};background:url('${media(s.photo)}') center/cover"></div>`;
  if (s.kind === 'intro') {
    const key = s.profile === 'introduzione' ? 'header' : 'testo';
    inner = cell('date', `<div>${esc(s.date || '')}</div>`, { fit: true, color: C.date || '#fff', w: 700, max: 60 }) + (B.photo && s.photo ? `<div class="box" style="${boxStyle(B.photo)};background:url('${media(s.photo)}') center/cover"></div>` : '')
      + cell(key, `<div>${words(s.main)}</div>`, { fit: true, center: true, color: C[key] || '#fff', max: 160 })
      + (s.ref ? cell('riferimento', `<div>${esc(s.ref)}</div>`, { fit: true, center: true, color: C.riferimento || '#fff', w: 700, max: 60 }) : '');
  } else if (s.part === 'domanda' && B.question) {
    inner += cell('question', `<div><span style="color:${ST.lesson_letter_color || head};font-weight:700">${esc(s.marker || '')}</span> ${words(s.main)}</div>`, { fit: true, color: C.question || ST.lesson_question_color || '#fff', max: 160 });
    // riferimenti in un riquadro loro: si spostano e ridimensionano in Impostazioni › Grafiche
    // riferimenti: centrati, tutti sulla stessa riga; la grandezza segue il riquadro (e il cursore in Grafiche)
    // la riga può allargarsi ai lati restando centrata sul riquadro: conta la sua altezza
    const rb = B.riferimento, rc = rb && rb[0] + rb[2] / 2, rw = rb && Math.max(rb[2], 2 * Math.min(rc, 1 - rc) - 0.04);
    if (s.ref) inner += cell('riferimento', `<div>${esc(s.ref)}</div>`, { fit: true, center: true, nowrap: true, color: C.riferimento || '#5b3a1f', w: 700, max: 400, box: rb && [rc - rw / 2, rb[1], rw, rb[3]] });
  } else {
    const extra = (s.extra || []).map((t) => `<div style="font-size:.8em;opacity:.85;font-style:italic;margin-top:.6em">${esc(t)}</div>`).join('');
    inner += cell('testo', `<div>${words(s.main)}${extra}</div>`, { fit: true, center: true, color: C.testo || '#fff', max: 160 });
    if (s.ref) inner += cell('riferimento', `<div>${esc(s.ref)}</div>`, { fit: true, center: true, color: C.riferimento || head, max: 60 });
  }
  // il modello riempie tutto lo schermo (niente bande nere sopra e sotto)
  return { bg: '#000', html: `<div style="position:absolute;inset:0;background:url('${src}') center/100% 100% no-repeat">${inner}</div>` };
}

function buildCustom(s, name, prof) {
  const B = boxesOf(prof, name), C = prof.colors || {}, M = prof.max_sizes || {};
  const font = prof.font_family || ST.verse_font_family || 'Helvetica';
  const def = Object.fromEntries((BOX_DEFS[name] || []).map(([k, , col]) => [k, col]));
  const cell = (k, inner, o = {}) => `<div class="box center ${o.fit === false ? '' : 'fit'}" ${o.id ? `id="${o.id}"` : ''} data-max="${M[k] || o.max || 120}" style="${boxStyle(B[k])};color:${C[k] || def[k] || '#fff'};font-family:'${font}';font-weight:${o.w || 650};${o.css || ''}">${inner}</div>`;
  const bgs = { testo: ST.text_bg_color || ST.verse_bg_color || '#0b132b', preghiera: 'radial-gradient(1100px 700px at 50% 40%, #2a1622, #0b0d18 75%)',
    elenco_preghiere: 'radial-gradient(1100px 700px at 50% 30%, #2a1622, #0b0d18 75%)', timer: ST.timer_bg_color || '#0b132b' };
  const bg = prof.template ? `url("${media(prof.template)}") center/100% 100% no-repeat, #000` : bgs[name];
  let html = '';
  if (name === 'testo') html = cell('testo', `<div>${linesWords(s.main)}</div>`, { max: Math.round(H() * 0.1 * (s.size || 1)) });
  if (name === 'preghiera') html = cell('titolo', '<div style="letter-spacing:.24em">PREGHIAMO PER</div>', { max: 50, w: 800 }) + cell('nome', `<div>${esc(s.main)}</div>`, { max: 230, w: 700 })
    + (s.reason ? cell('motivo', `<div>${esc(s.reason)}</div>`, { max: 170, w: 700, css: C.motivo ? '' : `color:${s.color}` }) : '');
  if (name === 'elenco_preghiere') {
    const n = Math.max(1, (s.list || []).length), rh = Math.min(H() * 0.15, (B.elenco[3] * H()) / n);
    html = cell('titolo', '<div style="letter-spacing:.24em">PREGHIAMO PER</div>', { max: 50, w: 800 })
      + `<div class="box" style="${boxStyle(B.elenco)};justify-content:flex-start;color:${C.elenco || '#fff'};font-family:'${font}'">${(s.list || []).map((p) => `<div style="height:${rh}px;display:flex;align-items:center;justify-content:space-between;gap:1em;border-top:1px solid rgba(255,255,255,.12)">
        <span style="font-size:${rh * 0.5}px;font-weight:650">${esc(p.name)}</span>${p.reason ? `<span style="font-size:${rh * 0.45}px;font-weight:700;color:${p.color}">${esc(p.reason)}</span>` : ''}</div>`).join('')}</div>`;
  }
  if (name === 'timer') html = cell('testo', `<div>${esc(s.text)}</div>`, { max: 80, w: 500 })
    + `<div class="box center" id="tval" style="${boxStyle(B.tempo)};color:${C.tempo || '#fff'};font:200 ${Math.round(B.tempo[3] * H() * 0.8)}px '${font}';font-variant-numeric:tabular-nums;letter-spacing:-.04em"></div>`;
  return { bg, html, timer: name === 'timer' };
}

/* schermata di attesa: quando non c'è niente in onda, sfondo o animazione scelti dall'utente */
function buildIdle() {
  const prof = profile('attesa'), B = boxesOf(prof, 'attesa'), C = prof.colors || {};
  if (!prof.template && !ST.idle_video && !ST.idle_text) return null;
  const vid = ST.idle_video ? `<video src="${media(ST.idle_video)}" autoplay loop muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>` : '';
  const txt = ST.idle_text ? `<div class="box center fit" data-max="${(prof.max_sizes || {}).testo || 120}" style="${boxStyle(B.testo)};color:${C.testo || '#fff'};font-family:'${prof.font_family || 'Helvetica'}';font-weight:650"><div>${esc(ST.idle_text)}</div></div>` : '';
  return { bg: prof.template ? `url("${media(prof.template)}") center/cover no-repeat, #000` : '#000', html: vid + txt };
}

/* transizioni delle diapositive come in PowerPoint (dir = verso del movimento) */
function slideTrans(t, prev, c) {
  const D = Math.max(1, t.d || 500), V = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1], lu: [-1, -1], ru: [1, -1], ld: [-1, 1], rd: [1, 1] }[t.dir || 'l'] || [-1, 0];
  const mv = (k) => `translate(${V[0] * k}%, ${V[1] * k}%)`;
  const inNew = (kf, o) => c.animate(kf, Object.assign({ duration: D, easing: 'ease-in-out', fill: 'backwards' }, o));
  const outOld = (kf, o) => prev && prev.animate(kf, Object.assign({ duration: D, easing: 'ease-in-out', fill: 'forwards' }, o));
  const wipe = { l: 'inset(0 0 0 100%)', r: 'inset(0 100% 0 0)', u: 'inset(100% 0 0 0)', d: 'inset(0 0 100% 0)' }[t.dir || 'l'] || 'inset(0 0 0 100%)';
  switch (t.t) {
    case 'cut': break;
    case 'push': outOld([{ transform: 'none' }, { transform: mv(100) }]); inNew([{ transform: mv(-100) }, { transform: 'none' }]); break;
    case 'cover': inNew([{ transform: mv(-100) }, { transform: 'none' }]); break;
    case 'pull': outOld([{ transform: 'none' }, { transform: mv(100) }]); break;
    case 'wipe': inNew([{ clipPath: wipe }, { clipPath: 'inset(0 0 0 0)' }]); break;
    case 'split': { const mid = t.orient === 'horz' ? 'inset(50% 0 50% 0)' : 'inset(0 50% 0 50%)';
      if (t.dir === 'in') { inNew([{ opacity: 1 }, { opacity: 1 }]); outOld([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: mid }]); }
      else inNew([{ clipPath: mid }, { clipPath: 'inset(0 0 0 0)' }]); break; }
    case 'circle': inNew([{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }]); break;
    case 'zoom': inNew(t.dir === 'in' ? [{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'none', opacity: 1 }] : [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'none', opacity: 1 }]); break;
    case 'fade': if (t.blk) { outOld([{ opacity: 1 }, { opacity: 0 }], { duration: D / 2 }); inNew([{ opacity: 0 }, { opacity: 1 }], { duration: D / 2, delay: D / 2 }); break; }
    // falls through
    default: inNew([{ opacity: 0 }, { opacity: 1 }]);          // dissolvenza e transizioni speciali
  }
  if (prev) setTimeout(() => prev.remove(), t.t === 'cut' ? 0 : D + 60);
}

/* ── mostrare uno stato ────────────────────────────────────────────────── */
function show(s) {
  cur = s;
  const ov = PREVIEW && !ROOMVIEW ? null : s.overlay;
  $('#nero').classList.toggle('on', ov === 'nero');
  $('#sfondo').classList.toggle('on', ov === 'sfondo');
  if (ST.background_image) $('#sfondo').style.background = `url("${media(ST.background_image)}") center/contain no-repeat #000`;
  if (ov === 'congela') return;                       // la sala resta ferma
  const key = JSON.stringify(Object.assign({}, s, { hl: null, zoom: null, overlay: null, from: null, playing: null, pos: null, at: null, vrate: null, iz: null, icx: null, icy: null, ptr: null, draw: null, b: null, sub: null }));
  if (key !== shownKey) {
    // PowerPoint: la transizione scelta nel file; il resto sfuma (niente tagli netti)
    const sd = s.style === 'pptx' && slidesCache[s.src || '/api/slides?p=' + encodeURIComponent(s.file)];
    const tr = !PREVIEW && sd ? (sd.trans || [])[s.i] : null;
    let prev = null;
    if (shownKey && !PREVIEW) {
      prev = document.createElement('div'); prev.className = 'layer' + (tr ? '' : ' fadeout'); prev.style.background = $('#bg').style.background;
      if (!$('#content video')) prev.innerHTML = $('#content').innerHTML;
      // la nuova entra sopra la vecchia, tranne quando è la vecchia a scivolare via
      $('#stage').insertBefore(prev, tr && tr.t !== 'pull' ? $('#content') : $('#zoom'));
      if (!tr) { const p = prev; setTimeout(() => p.remove(), 600); }
    }
    shownKey = key;
    clearInterval(timerT);
    if (s.kind === 'none') { const idle = buildIdle(); $('#bg').style.background = idle ? idle.bg : '#000'; const c = $('#content'); c.innerHTML = idle ? idle.html : '';
      if (idle) { c.classList.remove('fadein'); void c.offsetWidth; c.classList.add('fadein'); document.querySelectorAll('#content .fit').forEach((el) => fit(el, +el.dataset.max)); } }
    else {
      const out = build(s);
      $('#bg').style.background = out.bg;
      const c = $('#content'); c.innerHTML = out.html; c.classList.remove('fadein'); void c.offsetWidth;
      if (tr) slideTrans(tr, prev, c); else c.classList.add('fadein');
      document.querySelectorAll('#content .fit').forEach((el) => fit(el, +el.dataset.max));
      if (out.timer) { const upd = () => { const r = s.paused != null ? s.paused : Math.max(0, Math.round((s.endAt - Date.now()) / 1000)); const el = $('#tval'); if (el) el.textContent = Math.floor(r / 60).toString().padStart(2, '0') + ':' + String(r % 60).padStart(2, '0'); }; upd(); if (s.paused == null) timerT = setInterval(upd, 250); }
    }
  }
  syncVideo(s);
  syncImage(s);
  highlight(s);
  applyBuild(s);
}

/* ── animazioni dei PowerPoint: un passo per ogni «Avanti» ─────────────── */
let built = { key: '', b: -1 };
function applyBuild(s) {
  const d = s.style === 'pptx' && slidesCache[s.src || '/api/slides?p=' + encodeURIComponent(s.file)], A = d && d.anim && d.anim[s.i];
  const key = shownKey + '|' + s.file + '|' + s.i;
  if (d && d.native) return nativeStage(d, s, key);
  if (!A) { built = { key, b: -1 }; return; }
  const b = s.b || 0, done = (A.a ? 1 : 0) + b, fresh = built.key !== key;
  // si anima solo il passo appena chiesto (o quello che parte da solo all'arrivo); il resto si imposta subito
  const play = fresh ? (A.a && b === 0 ? 0 : -1) : (b === built.b + 1 ? done - 1 : -1);
  if (!fresh && b === built.b) return;
  built = { key, b };
  buildState(A.st, play >= 0 ? play : Math.min(done, A.st.length));
  if (play >= 0 && A.st[play]) A.st[play].forEach(runEffect);
}
// diapositive di Keynote: un'immagine per passo; si passa dall'una all'altra in dissolvenza
function nativeStage(d, s, key) {
  const n = d.slides[s.i].length, auto = d.auto && d.auto[s.i] ? 1 : 0, b = s.b || 0, fresh = built.key !== key;
  if (!fresh && b === built.b) return;
  const els = [...document.querySelectorAll('#content [data-stg]')];
  const show = (k, fade) => els.forEach((el) => { el.style.transition = fade ? 'opacity .5s ease' : 'none'; el.style.opacity = +el.dataset.stg === Math.min(k, n - 1) ? 1 : 0; });
  if (fresh && auto && b === 0) { show(0, false); setTimeout(() => { if (built.key === key) show(1, true); }, 400); }
  else show(auto + b, !fresh);
  built = { key, b };
}
const animEls = (e) => { const w = [...document.querySelectorAll(`#content [data-sp~="${e.s}"]`)];
  return e.p ? w.flatMap((x) => [...x.querySelectorAll('[data-pi]')].filter((p) => +p.dataset.pi >= e.p[0] && +p.dataset.pi <= e.p[1])) : w; };
const effKey = (e) => e.s + (e.p ? ':' + e.p.join('-') : '');
// come si vede ogni oggetto dopo i primi n passi (nascosto se deve ancora entrare, sparito se è uscito)
function buildState(steps, n) {
  const all = steps.flat(), first = {}, end = {};
  all.forEach((e) => { const k = effKey(e); if (!(k in first)) first[k] = e; });
  Object.values(first).forEach((e) => { end[effKey(e)] = { vis: e.c !== 'entr', tf: '' }; });
  steps.slice(0, n).flat().forEach((e) => { const st = end[effKey(e)];
    if (e.c === 'entr') st.vis = true; else if (e.c === 'exit') st.vis = false; else { const t = finalTf(e); if (t) st.tf = t; } });
  Object.values(first).forEach((e) => animEls(e).forEach((el) => { el.getAnimations().forEach((a) => a.cancel());
    const st = end[effKey(e)]; el.style.visibility = st.vis ? '' : 'hidden'; el.style.transform = st.tf; }));
}
const finalTf = (e) => (e.k === 'path' ? `translate(${e.to[0] * 100}%, ${e.to[1] * 100}%)` : e.k === 'scale' && e.by ? `scale(${e.by[0]}, ${e.by[1]})` : e.k === 'spin' ? `rotate(${e.by}deg)` : '');
function insets(el) {   // il riquadro della forma, dentro il contenitore grande quanto la diapositiva (in %)
  const b = el.dataset.bb ? el.dataset.bb.split(' ').map(Number) : [0, 0, 1, 1];
  return { t: b[1] * 100, r: (1 - b[0] - b[2]) * 100, b: (1 - b[1] - b[3]) * 100, l: b[0] * 100, cx: (b[0] + b[2] / 2) * 100, cy: (b[1] + b[3] / 2) * 100 };
}
function effFrames(e, el) {
  const I = insets(el), box = `inset(${I.t}% ${I.r}% ${I.b}% ${I.l}%)`, ins = (t, r, b, l) => `inset(${t}% ${r}% ${b}% ${l}%)`;
  if (e.k === 'fly') { const dx = e.dir.includes('l') ? -100 : e.dir.includes('r') ? 100 : 0, dy = e.dir.includes('t') ? -100 : e.dir.includes('b') ? 100 : 0;
    return [{ transform: `translate(${dx}%, ${dy}%)` }, { transform: 'none' }]; }
  if (e.k === 'scale' && e.c === 'entr') return [{ transform: 'scale(0)', opacity: 0 }, { transform: 'none', opacity: 1 }];
  if (e.k === 'appear') return [{ opacity: 0 }, { opacity: 1 }];
  if (e.k === 'filter') {
    const f = e.f || '', m = /\((\w+)\)/.exec(f), dir = m ? m[1] : '';
    if (f.startsWith('wipe')) return [{ clipPath: { down: ins(I.t, I.r, 100 - I.t, I.l), up: ins(100 - I.b, I.r, I.b, I.l), right: ins(I.t, 100 - I.l, I.b, I.l), left: ins(I.t, I.r, I.b, 100 - I.r) }[dir] || ins(I.t, I.r, 100 - I.t, I.l) }, { clipPath: box }];
    if (f.startsWith('barn')) { const v = /Vertical/.test(dir); return [{ clipPath: v ? ins(I.t, 100 - I.cx, I.b, I.cx) : ins(I.cy, I.r, 100 - I.cy, I.l) }, { clipPath: box }]; }
    if (/^(circle|wheel|plus|diamond|box)/.test(f)) return [{ clipPath: `circle(0% at ${I.cx}% ${I.cy}%)` }, { clipPath: `circle(150% at ${I.cx}% ${I.cy}%)` }];
    if (f.startsWith('slide')) { const dy = /Bottom/.test(dir) ? 100 : /Top/.test(dir) ? -100 : 0, dx = /Left/.test(dir) ? -100 : /Right/.test(dir) ? 100 : 0;
      return [{ transform: `translate(${dx}%, ${dy}%)` }, { transform: 'none' }]; }
    return [{ opacity: 0 }, { opacity: 1 }];       // dissolvenza e simili
  }
  return null;
}
function runEffect(e) {
  animEls(e).forEach((el) => {
    const o = { duration: Math.max(1, e.d), delay: e.t || 0, easing: 'ease-in-out' };
    if (e.c === 'entr') { el.style.visibility = ''; el.animate(effFrames(e, el) || [{ opacity: 0 }, { opacity: 1 }], Object.assign(o, { fill: 'backwards' })); }
    else if (e.c === 'exit') { const a = el.animate((effFrames(e, el) || [{ opacity: 0 }, { opacity: 1 }]).slice().reverse(), Object.assign(o, { fill: 'forwards' }));
      a.onfinish = () => { el.style.visibility = 'hidden'; a.cancel(); }; }
    else { const t = finalTf(e);
      if (t) { const a = el.animate([{ transform: el.style.transform || 'none' }, { transform: t }], Object.assign(o, { fill: 'forwards' })); a.onfinish = () => { el.style.transform = t; a.cancel(); }; }
      else el.animate([{ transform: 'none' }, { transform: 'scale(1.08)' }, { transform: 'none' }], o); }   // risalto: un battito
  });
}

/* immagini: zoom verso un punto e puntatore luminoso per indicare in sala */
function syncImage(s) {
  const im = $('#content .zimg');
  if (im) { im.style.transformOrigin = `${(s.icx ?? 0.5) * 100}% ${(s.icy ?? 0.5) * 100}%`; im.style.transform = `scale(${s.iz || 1})`; }
  const p = $('#ptr');
  p.classList.toggle('on', !!s.ptr);
  if (s.ptr) { p.style.left = s.ptr[0] * 100 + '%'; p.style.top = s.ptr[1] * 100 + '%'; }
  // scia: si allunga mentre il tasto è premuto; lasciandolo svanisce dolcemente
  const tEl = $('#trail');
  if (!(s.draw && s.ptr)) {
    if (trail.length) { trail = []; void tEl.getBoundingClientRect(); tEl.style.transition = 'opacity .7s ease-out'; tEl.style.opacity = 0;
      clearTimeout(trailT); trailT = setTimeout(() => { if (!trail.length) tEl.innerHTML = ''; }, 750); }
    return;
  }
  if (!trail.length) { clearTimeout(trailT); tEl.style.transition = 'none'; tEl.style.opacity = 1; void tEl.getBoundingClientRect(); }   // nuova scia mentre la vecchia svanisce
  trail.push(s.ptr);
  tEl.innerHTML = trail.length > 1 ? `<path d="M${trail.map((q) => (q[0] * 1000).toFixed(1) + ' ' + (q[1] * 1000).toFixed(1)).join('L')}" fill="none" stroke="rgba(240,40,40,.9)"
    stroke-width="${Math.max(3, H() * 0.012)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` : '';
}
let trail = [], trailT = 0;

/* video: segue play/pausa/posizione del pannello; l'anteprima resta muta */
function syncVideo(s) {
  const v = $('#content video'); if (!v) return;
  v.muted = PREVIEW;
  v.playbackRate = s.vrate || 1;
  const target = s.pos + (s.playing ? (Date.now() - s.at) / 1000 * (s.vrate || 1) : 0);
  if (Math.abs(v.currentTime - target) > 0.5) v.currentTime = target;
  if (s.playing) v.play().catch(() => {}); else v.pause();
}

/* evidenziazione: segna le parole, poi la frase vola al centro e si ingrandisce */
let zoomOn = false;
function highlight(s) {
  const ws = [...document.querySelectorAll('#content .w')];
  const hl = s.hl ? [Math.min(...s.hl), Math.max(...s.hl)] : null;
  const want = !!(hl && s.zoom && ws.length);
  const inR = (n) => !!hl && n >= hl[0] && n <= hl[1];
  // con lo zoom l'evidenziazione sotto non si vede: resta solo la frase ingrandita
  ws.forEach((w) => { const n = +w.dataset.w, on = !want && inR(n); w.classList.toggle('hl', on); w.classList.toggle('hl-s', on && n === hl[0]); w.classList.toggle('hl-e', on && n === hl[1]); });
  document.querySelectorAll('#content .sp').forEach((x) => x.classList.toggle('hl', !want && !!hl && +x.dataset.s >= hl[0] && +x.dataset.s < hl[1]));
  const z = $('#zoom'), zt = $('#zoomText'), c = $('#content');
  if (want) {
    const sel = ws.filter((w) => inR(+w.dataset.w));
    zt.innerHTML = `<span>${esc(sel.map((w) => w.textContent).join(' '))}</span>`;
    zt.style.fontFamily = getComputedStyle(sel[0]).fontFamily;
    fit(zt, Math.round(H() * 0.14));
    if (!zoomOn) {   // FLIP: parte da dove sono le parole evidenziate
      const a = sel[0].getBoundingClientRect(), b = sel[sel.length - 1].getBoundingClientRect();
      const from = { x: (a.left + b.right) / 2, y: (a.top + b.bottom) / 2, h: Math.max(10, b.bottom - a.top) };
      const to = zt.firstChild.getBoundingClientRect();
      const k = Math.min(1, from.h / Math.max(1, to.height));
      zt.style.transition = 'none';
      zt.style.transform = `translate(${from.x - (to.left + to.width / 2)}px, ${from.y - (to.top + to.height / 2)}px) scale(${k})`;
      void zt.offsetWidth;
      zt.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1)';
      zt.style.transform = 'none';
    }
    z.classList.add('on'); c.classList.add('dim'); zoomOn = true;
  } else { z.classList.remove('on'); c.classList.remove('dim'); zoomOn = false; }
}

window.addEventListener('resize', () => { shownKey = ''; show(cur); });
(async function start() {
  const b = await (await xf('/api/bootstrap')).json();
  ST = b.settings || {};
  // anteprime dentro il pannello: gli aggiornamenti li passa il pannello (un solo collegamento
  // al motore per finestra: Chrome ne permette 6 e oltre si blocca tutto)
  const EMBED = PREVIEW && window.parent !== window;
  const es = window.CLOUD || EMBED ? {} : new EventSource(PREVIEW ? '/api/events' : '/api/events?role=output');
  if (EMBED) window.addEventListener('message', (e) => { if (e.source === window.parent && typeof e.data === 'string') es.onmessage({ data: e.data }); });
  else if (window.CLOUD) window.cloudEvents((e) => es.onmessage(e));
  if (EMBED || window.CLOUD) xf('/api/live').then((r) => r.json()).then((l) => show(l.state || { kind: 'none' }));
  es.onmessage = async (e) => {
    const m = JSON.parse(e.data);
    if (m.view) { Object.assign(cur, m.view); syncImage(cur); return; }   // puntatore e zoom: veloce, senza ridisegnare
    if ('state' in m) show(m.state || { kind: 'none' });
    if (m.sync === 'slides') { Object.keys(slidesCache).forEach((u) => { if (slidesCache[u] && slidesCache[u].pending) delete slidesCache[u]; }); shownKey = ''; show(cur); }
    if (m.sync === 'fonts') { document.querySelectorAll('link[href^="/fonts.css"]').forEach((l) => { l.href = '/fonts.css?' + Date.now(); }); setTimeout(() => { shownKey = ''; show(cur); }, 500); }
    if (m.sync === 'settings') { const before = looks(ST); ST = (await (await xf('/api/bootstrap')).json()).settings || {};
      if (looks(ST) !== before) { shownKey = ''; show(cur); } }   // es. cambiare la lingua nel pannello non ridisegna la sala
  };
})();
