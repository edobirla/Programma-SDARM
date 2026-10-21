"""Ponte verso il telefono con i dati cellulare, dentro il motore.

Il telefono scrive le richieste in Firebase (rooms/<stanza>/req); qui le
riceviamo in diretta (REST in streaming), le eseguiamo sul motore locale come
richieste «da telefono» (X-Via-Cloud: stessi limiti) e scriviamo la risposta in
res. Gli aggiornamenti dal vivo vanno in ev, solo se c'è un telefono collegato.
Accesso anonimo; il codice lungo della stanza è la chiave (regole del database).
"""
import json
import queue
import ssl
import threading
import time
import urllib.parse
import urllib.request

KEY = "AIzaSyAIiUFCt7He8Q2ZeOOITZnZaONUXaQYbQI"
DB = "https://gestionale-programmi-default-rtdb.europe-west1.firebasedatabase.app"


def _ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


class Bridge:
    def __init__(self, room, code, port):
        self.room, self.code, self.port = room, code, port
        self.ctx = _ctx()
        self.token, self.refresh, self.exp = "", "", 0
        self.phone_at = 0
        self.out = queue.Queue()
        self.sent = []
        self.lock = threading.Lock()

    # ── accesso anonimo (il gettone dura un'ora, si rinnova) ───────────────
    def auth(self):
        with self.lock:
            if self.token and time.time() < self.exp - 300:
                return self.token
            if self.refresh:
                body = urllib.parse.urlencode({"grant_type": "refresh_token", "refresh_token": self.refresh}).encode()
                r = self._req("POST", f"https://securetoken.googleapis.com/v1/token?key={KEY}", body,
                              {"Content-Type": "application/x-www-form-urlencoded"})
                self.token, self.refresh = r["id_token"], r["refresh_token"]
                self.exp = time.time() + int(r["expires_in"])
            else:
                r = self._req("POST", f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={KEY}",
                              b'{"returnSecureToken":true}', {"Content-Type": "application/json"})
                self.token, self.refresh = r["idToken"], r["refreshToken"]
                self.exp = time.time() + int(r["expiresIn"])
            return self.token

    def _req(self, method, url, body=None, headers=None, timeout=20):
        req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
        with urllib.request.urlopen(req, timeout=timeout, context=self.ctx) as r:
            data = r.read()
        return json.loads(data or b"null")

    def db(self, method, path, value=None):
        url = f"{DB}/rooms/{self.room}/{path}.json?auth={self.auth()}"
        body = None if value is None else json.dumps(value).encode()
        return self._req(method, url, body, {"Content-Type": "application/json"})

    # ── richieste del telefono ─────────────────────────────────────────────
    def handle(self, rid, r):
        if not isinstance(r, dict) or not r.get("u"):
            return
        try:
            if time.time() * 1000 - (r.get("at") or 0) > 30000:     # vecchia: il telefono ha già rinunciato
                self.db("DELETE", f"req/{rid}")
                return
            req = urllib.request.Request(f"http://127.0.0.1:{self.port}{r['u']}", method=r.get("m", "GET"),
                                         data=(r.get("b") or "").encode() or None,
                                         headers={"Content-Type": "application/json", "X-Via-Cloud": "1", "X-Client": r.get("c") or ""})
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    out = {"s": resp.status, "t": resp.read().decode("utf-8", "replace")}
            except urllib.error.HTTPError as e:
                out = {"s": e.code, "t": e.read().decode("utf-8", "replace") or "{}"}
            self.db("PUT", f"res/{rid}", out)
            self.db("DELETE", f"req/{rid}")
        except Exception:
            pass

    def listen(self):
        """Ascolto in diretta di rooms/<stanza>/req (si riconnette da solo)."""
        while True:
            try:
                url = f"{DB}/rooms/{self.room}/req.json?auth={self.auth()}"
                req = urllib.request.Request(url, headers={"Accept": "text/event-stream"})
                started = time.time()
                with urllib.request.urlopen(req, timeout=90, context=self.ctx) as s:
                    ev = ""
                    for raw in s:
                        line = raw.decode("utf-8", "replace").rstrip("\n")
                        if line.startswith("event:"):
                            ev = line[6:].strip()
                        elif line.startswith("data:") and ev in ("put", "patch"):
                            d = json.loads(line[5:].strip() or "null") or {}
                            path, data = d.get("path", "/"), d.get("data")
                            items = data.items() if path == "/" and isinstance(data, dict) else \
                                [(path.strip("/").split("/")[0], data)] if path.count("/") == 1 else []
                            for rid, r in items:
                                threading.Thread(target=self.handle, args=(rid, r), daemon=True).start()
                        elif ev in ("cancel", "auth_revoked"):
                            self.exp = 0
                            break
                        if time.time() - started > 3000:                  # gettone nuovo prima che scada
                            break
            except Exception:
                time.sleep(3)

    # ── aggiornamenti dal vivo verso il telefono ───────────────────────────
    def watch_phone(self):
        while True:
            try:
                self.phone_at = (self.db("GET", "seen") or 0) / 1000
            except Exception:
                pass
            time.sleep(15)

    def push(self, msg):
        if time.time() - self.phone_at < 120:
            self.out.put(msg)

    def sender(self):
        while True:
            msg = self.out.get()
            try:
                k = self.db("POST", "ev", {"d": msg})["name"]
                self.sent.append(k)
                while len(self.sent) > 30:
                    self.db("DELETE", f"ev/{self.sent.pop(0)}")
            except Exception:
                pass

    def start(self):
        try:                                    # codice breve -> stanza (per collegare un telefono a mano)
            if self.code:
                self._req("PUT", f"{DB}/pair/{self.code}.json?auth={self.auth()}", json.dumps(self.room).encode(),
                          {"Content-Type": "application/json"})
        except Exception:
            pass
        for f in (self.listen, self.watch_phone, self.sender):
            threading.Thread(target=f, daemon=True).start()
        return self


if __name__ == "__main__":     # prova: risponde una stanza finta per 20 secondi
    import sys
    b = Bridge(sys.argv[1], "", int(sys.argv[2])).start()
    time.sleep(20)
