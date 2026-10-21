/* Condiviso fra pannello e uscita: i riquadri di ogni modello grafico
   (x, y, larghezza, altezza in frazioni dell'immagine del modello). */
window.BOX_DEFS = {
  // le posizioni di partenza combaciano con le grafiche in «grafiche lezione/»
  introduzione: [
    ['header', 'Titolo', '#4ade80', [0.08, 0.55, 0.84, 0.36]],
    ['date', 'Data', '#fb923c', [0.8044, 0.0211, 0.193, 0.0956]],
    ['photo', 'Foto della settimana', '#60a5fa', [0, 0.1474, 1, 0.3305]],
  ],
  // versetto chiave e nota introduttiva con una grafica tutta loro (se caricata)
  intro_versetto: [
    ['photo', 'Foto della settimana', '#60a5fa', [0, 0.1474, 1, 0.3305]],
    ['date', 'Data', '#fb923c', [0.8044, 0.0211, 0.193, 0.0956]],
    ['testo', 'Versetto chiave', '#3b82f6', [0.1, 0.52, 0.8, 0.29]],
    ['riferimento', 'Riferimento', '#ec4899', [0.25, 0.855, 0.5, 0.07]],
  ],
  intro_nota: [
    ['photo', 'Foto della settimana', '#60a5fa', [0, 0.1474, 1, 0.3305]],
    ['date', 'Data', '#fb923c', [0.8044, 0.0211, 0.193, 0.0956]],
    ['testo', 'Nota introduttiva', '#3b82f6', [0.07, 0.52, 0.86, 0.4]],
  ],
  domanda: [
    ['header', 'Titolo del giorno', '#4ade80', [0.03, 0.02, 0.55, 0.10]],
    ['date', 'Data', '#fb923c', [0.75, 0.02, 0.22, 0.10]],
    ['photo', 'Foto', '#60a5fa', [0.0, 0.16, 1.0, 0.35]],
    ['question', 'Domanda', '#c084fc', [0.05, 0.55, 0.90, 0.34]],
    ['riferimento', 'Riferimento', '#ec4899', [0.05, 0.9, 0.90, 0.07]],
  ],
  nota: [
    ['header', 'Titolo del giorno', '#4ade80', [0.03, 0.02, 0.55, 0.10]],
    ['date', 'Data', '#fb923c', [0.75, 0.02, 0.22, 0.10]],
    ['testo', 'Nota', '#3b82f6', [0.07, 0.15, 0.86, 0.70]],
  ],
  versetto_lezione: [
    ['header', 'Titolo del giorno', '#4ade80', [0.03, 0.02, 0.55, 0.10]],
    ['date', 'Data', '#fb923c', [0.75, 0.02, 0.22, 0.10]],
    ['testo', 'Versetto', '#3b82f6', [0.07, 0.15, 0.86, 0.58]],
    ['riferimento', 'Riferimento', '#ec4899', [0.25, 0.78, 0.50, 0.08]],
  ],
  versetto_bibbia: [
    ['testo', 'Versetto', '#3b82f6', [0.07, 0.10, 0.86, 0.60]],
    ['riferimento', 'Riferimento', '#ec4899', [0.25, 0.78, 0.50, 0.08]],
  ],
  // grafiche degli altri contenuti (sfondo, posizione e colore dei testi)
  testo: [['testo', 'Testo', '#cb86db', [0.07, 0.1, 0.86, 0.8]]],
  preghiera: [
    ['titolo', '«Preghiamo per»', '#ee7c90', [0.1, 0.22, 0.8, 0.08]],
    ['nome', 'Nome', '#ffffff', [0.06, 0.28, 0.88, 0.3]],
    ['motivo', 'Motivo', '#f2a3b3', [0.06, 0.6, 0.88, 0.22]],
  ],
  elenco_preghiere: [
    ['titolo', '«Preghiamo per»', '#ee7c90', [0.1, 0.06, 0.8, 0.08]],
    ['elenco', 'Elenco', '#ffffff', [0.14, 0.17, 0.72, 0.76]],
  ],
  timer: [
    ['testo', 'Testo', '#ffffff', [0.1, 0.24, 0.8, 0.1]],
    ['tempo', 'Tempo', '#ffffff', [0.15, 0.36, 0.7, 0.36]],
  ],
  attesa: [['testo', 'Scritta (facoltativa)', '#ffffff', [0.1, 0.4, 0.8, 0.2]]],
};
window.PROFILE_LABELS = { introduzione: 'Intro · titolo', intro_versetto: 'Intro · versetto chiave', intro_nota: 'Intro · nota', domanda: 'Domanda', nota: 'Nota', versetto_lezione: 'Versetto citato', versetto_bibbia: 'Versetto Bibbia',
  testo: 'Testi', preghiera: 'Una preghiera', elenco_preghiere: 'Elenco preghiere', timer: 'Timer', attesa: 'Schermata di attesa' };
window.FONTS = ['Helvetica', 'Helvetica Neue', 'Avenir Next', 'Futura', 'Gill Sans', 'Optima', 'Georgia', 'Palatino', 'Baskerville',
  'Times New Roman', 'Hoefler Text', 'Didot', 'Cochin', 'Arial', 'Verdana', 'Trebuchet MS', 'Montserrat', 'Lato', 'Open Sans', 'Raleway',
  'Playfair Display', 'Merriweather', 'Lora', 'Source Sans Pro', 'Roboto'];
/* introduzione senza modello: sfondo con la foto della settimana e riquadri
   propri (salvati a parte, così non si mescolano con quelli del modello) */
window.introBg = (photo) => (photo ? `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.65)), url("/media?p=${encodeURIComponent(photo)}") center/cover` : 'linear-gradient(160deg,#3a2a1c,#6b4a2a 45%,#1d2433)');
window.plainIntro = (prof, name) => /^intro/.test(name) && !(prof && prof.template);
const INTRO_PLAIN = { date: [0.1, 0.08, 0.8, 0.1], header: [0.08, 0.26, 0.84, 0.6], testo: [0.08, 0.24, 0.84, 0.58], riferimento: [0.25, 0.85, 0.5, 0.08] };
window.boxesOf = (prof, name) => {
  const plain = window.plainIntro(prof, name);
  const saved = (prof && (plain ? prof.pboxes : prof.boxes)) || {};
  const out = {};
  (window.BOX_DEFS[name] || []).forEach(([k, , , d]) => { if (!(plain && k === 'photo')) out[k] = saved[k] || (plain ? INTRO_PLAIN[k] : d); });
  return out;
};

/* Disegna una diapositiva PowerPoint descritta dal motore (pptx_render).
   Il contenitore deve avere container-type: size: le dimensioni dei testi
   sono in cqh (frazioni dell'altezza), le posizioni in %. `edit` applica le
   modifiche fatte nell'app: {scale, texts: {indice: "testo"}}. */
/* il riquadro col testo dell'inno: quello con più pezzi di testo */
window.mainBox = (slide) => { let best = -1, main = -1; slide.forEach((s, i) => { const n = s.text ? s.text.paras.reduce((a, p) => a + p.runs.length, 0) : 0; if (n > best) { best = n; main = i; } }); return main; };
window.slideHTML = (slide, idx, edit) => {
  const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const scale = (edit && edit.scale) || 1;
  const override = edit && edit.texts && edit.texts[idx] != null ? edit.texts[idx] : null;
  const main = override != null ? window.mainBox(slide) : -1;
  return slide.map((s, i) => {
    const box = `position:absolute;left:${s.x * 100}%;top:${s.y * 100}%;width:${s.w * 100}%;height:${s.h * 100}%;${s.rot ? `transform:rotate(${s.rot}deg);` : ''}`;
    let html = '';
    if (s.fill) html += `<div style="${box}background:${s.fill}"></div>`;
    if (s.img && !window.NO_MEDIA) html += `<img src="/media?p=${encodeURIComponent('@/cache/slides/' + s.img)}" alt="" style="${box}object-fit:fill">`;
    if (s.text) {
      const t = s.text, pad = s.pad || [0, 0, 0, 0];
      let paras = t.paras;
      // testo modificato: righe semplici (vecchie modifiche) o righe con corsivo/grassetto/colore
      if (i === main) { const r0 = (t.paras[0] && t.paras[0].runs[0]) || { s: 0.08, f: '', c: '#fff' };
        const lines = Array.isArray(override) ? override : override.split('\n').map((line) => [{ t: line }]);
        paras = lines.map((runs) => ({ a: (t.paras[0] || {}).a || 'center', s: r0.s, runs: runs.map((r) => Object.assign({}, r0, r.i == null ? {} : { i: r.i, b: r.b }, { t: r.t, c: r.c || r0.c })) })); }
      html += `<div class="sl-text" style="${box}display:flex;flex-direction:column;justify-content:${t.anchor};padding:${pad[1] * 100}cqh ${pad[2] * 100}cqw ${pad[3] * 100}cqh ${pad[0] * 100}cqw;box-sizing:border-box;${t.nowrap ? 'white-space:nowrap;' : ''}line-height:1.12">`
        + paras.map((p) => `<div style="text-align:${p.a};font-size:${p.s * scale * 100}cqh;min-height:1em">${p.runs.map((r) => `<span style="font-size:${(r.s / (p.s || r.s || 1)) * 100}%;font-family:'${e(r.f)}','Helvetica Neue',Helvetica,sans-serif;${r.b ? 'font-weight:700;' : ''}${r.i ? 'font-style:italic;' : ''}${r.c ? 'color:' + r.c : ''}">${e(r.t)}</span>`).join('')}</div>`).join('')
        + '</div>';
    }
    return html;
  }).join('');
};
