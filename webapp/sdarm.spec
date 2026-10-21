# -*- mode: python ; coding: utf-8 -*-
"""App per Mac della versione 2 (webapp).  Build:  bash webapp/build_mac.sh
Dentro: il motore, il pannello, assets e Bibbie. Nessun dato personale:
innari, modelli, lezioni e musica si caricano dall'app."""
import os
import re

from PyInstaller.utils.hooks import collect_all

ROOT = os.path.dirname(SPECPATH)
VERSION = re.search(r'VERSION = "([^"]+)"', open(os.path.join(SPECPATH, "server.py"), encoding="utf-8").read()).group(1)

datas = [(os.path.join(ROOT, "assets"), "assets"), (os.path.join(SPECPATH, "static"), "webapp/static")]
for f in sorted(os.listdir(os.path.join(ROOT, "bibles"))):
    if f.lower().endswith(".db"):
        datas.append((os.path.join(ROOT, "bibles", f), "bibles"))
binaries, hidden = [], ["server", "pptx_render", "cloud_bridge"]
hidden += ["webview.platforms.cocoa", "AppKit", "Foundation", "WebKit", "objc", "PyObjCTools.AppHelper", "Quartz", "Security", "UniformTypeIdentifiers"]
for pkg in ("pptx", "docx", "imageio_ffmpeg", "yt_dlp", "fitz", "pymupdf", "qrcode", "certifi", "webview"):
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hidden += h
    except Exception:
        pass

a = Analysis([os.path.join(SPECPATH, "app_main.py")], pathex=[ROOT, SPECPATH], binaries=binaries, datas=datas,
             hiddenimports=hidden, excludes=["tkinter", "customtkinter", "pygame", "matplotlib", "ffpyplayer"])
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="Programma SDARM", console=False)
coll = COLLECT(exe, a.binaries, a.datas, name="Programma SDARM")
app = BUNDLE(coll, name="Programma SDARM.app", icon=os.path.join(ROOT, "assets", "app_icon.icns"),
             bundle_identifier="it.sdarm.programma",
             info_plist={"CFBundleShortVersionString": VERSION, "CFBundleVersion": VERSION, "NSHighResolutionCapable": True,
                         "LSMinimumSystemVersion": "12.0"})
