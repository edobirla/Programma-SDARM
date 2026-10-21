"""Avvio dell'app per Mac: accende il motore e apre il pannello.
Se il programma è già acceso, apre solo un'altra finestra del pannello."""
import os
import socket
import subprocess
import sys
import threading
import webbrowser

PORT = int(os.environ.get("SDARM_PORT") or 8765)


def build_id():
    """Cambia ogni volta che l'app viene sostituita (o server.py modificato)."""
    f = sys.executable if getattr(sys, "frozen", False) else os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
    return str(int(os.path.getmtime(f)))


def who(port):
    """('noi', build) se sulla porta c'è il programma, ('altro', '') se un altro, (None, '') se libera."""
    import urllib.request
    try:
        socket.create_connection(("127.0.0.1", port), 0.5).close()
    except OSError:
        return None, ""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/phone", timeout=2) as r:
            if r.headers.get("Server", "").startswith("SDARM/"):
                return "noi", r.headers.get("X-SDARM-Build", "")
    except Exception:
        pass
    return "altro", ""


def stop_old(port):
    """Un motore di una versione precedente (app sostituita): si spegne."""
    import signal
    import time
    pids = subprocess.run(["lsof", "-ti", f"tcp:{port}", "-sTCP:LISTEN"], capture_output=True, text=True).stdout.split()
    for pid in pids:
        try:
            os.kill(int(pid), signal.SIGTERM)
        except (OSError, ValueError):
            pass
    for _ in range(30):
        if who(port)[0] is None:
            return
        time.sleep(0.2)


def open_panel(port):
    url = f"http://127.0.0.1:{port}"
    # Chrome: finestra senza barre, uscite sui proiettori, video con audio
    if os.path.isdir("/Applications/Google Chrome.app"):
        subprocess.Popen(["open", "-na", "Google Chrome", "--args", "--autoplay-policy=no-user-gesture-required", f"--app={url}"])
    else:
        webbrowser.open(url)


def native_window(port):
    """La finestra dell'app: niente barra del titolo, solo i tre pulsanti del
    Mac sopra la barra dell'app (si trascina dalla barra in alto)."""
    try:
        import webview
    except ImportError:
        return False
    import time
    for _ in range(50):                          # il motore è pronto?
        if who(port)[0]:
            break
        time.sleep(0.1)
    webview.settings["DRAG_REGION_DIRECT_TARGET_ONLY"] = True   # pulsanti e ricerca dentro la barra restano cliccabili
    w = webview.create_window("Gestione programma SDARM", f"http://127.0.0.1:{port}/?native=1", width=1440, height=900,
                              min_size=(900, 600), frameless=True, easy_drag=False, background_color="#06080e", maximized=True)

    def lights():
        """I tre pulsanti del Mac in una striscia sottile sopra la barra dell'app
        (alta 34: lì si trascina la finestra; sotto tutto resta cliccabile)."""
        import AppKit
        nw, H = w.native, 34
        btns = [nw.standardWindowButton_(b) for b in (AppKit.NSWindowCloseButton, AppKit.NSWindowMiniaturizeButton, AppKit.NSWindowZoomButton)]
        if not btns[0]:
            return
        cont = btns[0].superview().superview()
        fr = nw.frame()
        if nw.styleMask() & AppKit.NSWindowStyleMaskFullScreen:
            return                                   # a tutto schermo il Mac li gestisce da solo
        cont.setFrame_(((0, fr.size.height - H), (86, H)))     # solo i tre pulsanti: il resto della striscia trascina
        for i, b in enumerate(btns):
            b.setHidden_(False)
            b.setFrameOrigin_((16 + i * 20, (H - b.frame().size.height) / 2))

    def keep_lights():
        import time
        from PyObjCTools import AppHelper
        while True:                                  # il Mac a volte li rimette in alto: si ricollocano
            AppHelper.callAfter(lights)
            time.sleep(1.5)
    w.events.shown += lambda: threading.Thread(target=keep_lights, daemon=True).start()
    w.events.closed += lambda: (close_native_outputs(), os._exit(0))   # chiuso il pannello si chiude tutto
    server.NATIVE = {"open": lambda: native_outputs(port), "close": close_native_outputs, "count": lambda: len(OUTS)}
    webview.start()
    return True


OUTS = []


def native_outputs(port):
    """Proiettori: una finestra dell'app per ogni schermo che non è quello del
    pannello, a tutto schermo e sempre in primo piano (non sparisce quando si
    passa a un altro programma). Con un solo schermo: una finestra normale."""
    import webview
    import AppKit
    from PyObjCTools import AppHelper
    close_native_outputs()
    url = f"http://127.0.0.1:{port}/output?native=1"
    others = list(enumerate(webview.screens))[1:]
    if not others:
        OUTS.append(webview.create_window("Uscita", url, width=960, height=540, background_color="#000000"))
        return 0
    for i, sc in others:
        w = webview.create_window("Uscita", url, screen=sc, x=0, y=0, width=sc.width, height=sc.height, frameless=True,
                                  on_top=True, resizable=False, background_color="#000000")

        def fit(w=w, i=i):                       # tutto lo schermo, sopra la barra dei menu e il Dock
            def go():
                nw = w.native
                nw.setStyleMask_(AppKit.NSWindowStyleMaskBorderless)
                nw.setLevel_(AppKit.NSScreenSaverWindowLevel)
                nw.setCollectionBehavior_(AppKit.NSWindowCollectionBehaviorCanJoinAllSpaces | AppKit.NSWindowCollectionBehaviorStationary
                                          | AppKit.NSWindowCollectionBehaviorFullScreenAuxiliary)
                nw.setFrame_display_(AppKit.NSScreen.screens()[i].frame(), True)
            AppHelper.callAfter(go)
        w.events.shown += fit
        OUTS.append(w)
    return len(others)


def close_native_outputs():
    while OUTS:
        try:
            OUTS.pop().destroy()
        except Exception:
            pass


if __name__ == "__main__":
    mine = build_id()
    ports = range(PORT, PORT + 20)
    for port in ports:                     # motori vecchi lasciati accesi: via
        state, build = who(port)
        if state == "noi" and build != mine:
            stop_old(port)
    for port in ports:                     # già acceso (questa versione): apre solo il pannello
        if who(port) == ("noi", mine):
            open_panel(port)
            sys.exit(0)
    port = next(p for p in ports if who(p)[0] is None)
    os.environ["SDARM_PORT"] = str(port)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import server
    if os.environ.get("SDARM_NO_WINDOW"):        # prove automatiche: solo il motore
        server.main()
    threading.Thread(target=server.main, daemon=True).start()
    if not native_window(port):                  # senza pywebview (sviluppo): Chrome
        threading.Timer(0.8, open_panel, [port]).start()
        threading.Event().wait()
    server.close_outputs()                        # finestra chiusa: si spegne tutto
    os._exit(0)
