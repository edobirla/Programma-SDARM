/* Firebase della chiesa: il telefono raggiunge il Mac anche con i dati
   cellulare. Il telefono scrive le richieste in rooms/<codice>/req, il
   pannello del Mac le esegue sul motore locale e scrive la risposta in
   res; gli aggiornamenti dal vivo passano da ev. Il codice della stanza
   (lungo e casuale, dal QR del Mac) è la chiave: senza non si entra. */
'use strict';
window.FB_CONFIG = {
  apiKey: 'AIzaSyAIiUFCt7He8Q2ZeOOITZnZaONUXaQYbQI',
  authDomain: 'gestionale-programmi.firebaseapp.com',
  databaseURL: 'https://gestionale-programmi-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'gestionale-programmi',
  appId: '1:826101806121:web:3559c37d23665efb869838',
};
window.CLOUD = location.protocol === 'https:';          // pagina pubblicata su Firebase
window.NO_MEDIA = window.CLOUD;                           // ponytail: niente immagini con i dati, solo testo
// il codice resta nell'indirizzo: l'icona sulla schermata Home lo ricorda
// (le app dalla Home non vedono i dati salvati da Safari)
window.ROOM = (() => {
  if (!window.CLOUD) return '';
  const r = new URLSearchParams(location.search).get('r') || new URLSearchParams(location.hash.slice(1)).get('r');
  try { if (r) localStorage.setItem('sdarm_room', r); return r || localStorage.getItem('sdarm_room') || ''; } catch (e) { return r || ''; }
})();
const goRoom = (room) => { try { localStorage.setItem('sdarm_room', room); } catch (e) { /* niente */ } location.replace('/m?r=' + room); };
// codice breve scritto a mano (Impostazioni › Telefono sul Mac)
window.pairWith = async (code) => {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 8) throw new Error('Il codice ha 8 caratteri');
  const room = (await (await window.loadFirebase()).ref('pair/' + code).once('value')).val();
  if (!room) throw new Error('Codice non trovato: controllalo sul Mac (il programma deve essere aperto)');
  goRoom(room);
};
// codice QR inquadrato dall'app
window.scanQR = async (video) => {
  await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = stream; video.setAttribute('playsinline', ''); await video.play();
  const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
  return new Promise((ok) => {
    const tick = () => {
      if (video.videoWidth) {
        c.width = video.videoWidth; c.height = video.videoHeight; x.drawImage(video, 0, 0);
        const qr = window.jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        const m = qr && qr.data.match(/[?#&]r=([0-9a-f]{32})/);
        if (m) { stream.getTracks().forEach((t) => t.stop()); ok(m[1]); goRoom(m[1]); return; }
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
};

let fbReady = null;
window.loadFirebase = () => {
  if (!fbReady) {
    const add = (f) => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'https://www.gstatic.com/firebasejs/10.14.1/' + f; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
    fbReady = add('firebase-app-compat.js')
      .then(() => Promise.all([add('firebase-auth-compat.js'), add('firebase-database-compat.js')]))
      .then(() => { firebase.initializeApp(window.FB_CONFIG); return firebase.auth().signInAnonymously(); })
      .then(() => firebase.database());
    fbReady.catch(() => { fbReady = null; });
  }
  return fbReady;
};

/* telefono: fetch e eventi attraverso Firebase */
window.cloudFetch = async (url, opts = {}) => {
  const room = (await window.loadFirebase()).ref('rooms/' + window.ROOM);
  const req = room.child('req').push(), res = room.child('res/' + req.key);
  const answer = new Promise((ok, ko) => {
    const t = setTimeout(() => { res.off(); ko(new Error('Il Mac non risponde: è acceso con il programma aperto?')); }, 25000);
    res.on('value', (s) => { const v = s.val(); if (!v) return; clearTimeout(t); res.off(); res.remove(); ok(v); });
  });
  await req.set({ m: opts.method || 'GET', u: url, b: opts.body || null, c: (opts.headers || {})['X-Client'] || '', at: firebase.database.ServerValue.TIMESTAMP });
  const v = await answer;
  return { ok: v.s < 400, status: v.s, json: async () => JSON.parse(v.t), text: async () => v.t };
};
window.cloudEvents = (onmessage) => {
  window.loadFirebase().then((db) => {
    const room = db.ref('rooms/' + window.ROOM), ev = room.child('ev');
    ev.orderByKey().startAt(ev.push().key).on('child_added', (s) => onmessage({ data: s.val().d }));
    const seen = () => room.child('seen').set(firebase.database.ServerValue.TIMESTAMP);
    seen(); setInterval(seen, 30000);               // il Mac manda gli aggiornamenti solo se c'è un telefono
  });
};

/* Mac: esegue le richieste del telefono sul motore locale */
window.cloudBridge = async (room, client, code) => {
  const db = await window.loadFirebase(), R = db.ref('rooms/' + room);
  if (code) db.ref('pair/' + code).set(room).catch(() => {});   // codice breve -> stanza
  let phoneAt = 0, offset = 0;
  db.ref('.info/serverTimeOffset').on('value', (s) => { offset = s.val() || 0; });
  R.child('seen').on('value', (s) => { phoneAt = s.val() || 0; });
  R.child('req').on('child_added', async (s) => {
    const r = s.val();
    // un solo pannello risponde, anche se sul Mac ce ne sono due aperti
    const claim = await s.ref.child('by').transaction((v) => (v ? undefined : client));
    if (!claim.committed) return;
    if (Date.now() + offset - (r.at || 0) > 30000) return s.ref.remove();   // richiesta vecchia
    let out;
    try {
      const resp = await fetch(r.u, { method: r.m, body: r.b || undefined, headers: { 'Content-Type': 'application/json', 'X-Via-Cloud': '1', 'X-Client': r.c || '' } });
      out = { s: resp.status, t: await resp.text() };
    } catch (e) { out = { s: 502, t: JSON.stringify({ ok: false, error: String(e) }) }; }
    await R.child('res/' + s.key).set(out);
    s.ref.remove();
  });
  const sent = [];
  return (data) => {                                  // inoltra un messaggio dal vivo
    if (Date.now() + offset - phoneAt > 120000) return;
    const k = R.child('ev').push({ d: data }).key;
    sent.push(k);
    while (sent.length > 30) R.child('ev/' + sent.shift()).remove();
  };
};
