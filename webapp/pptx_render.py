"""Legge un PowerPoint e lo descrive come forme da disegnare nell'app:
immagini, riquadri colorati e testi (posizione, carattere, dimensione,
colore, allineamento). Niente PowerPoint, Keynote o WPS: l'uscita disegna
le diapositive da sola, identiche nell'impaginazione e istantanee.

Posizioni e dimensioni sono frazioni della diapositiva; le dimensioni dei
caratteri sono frazioni dell'altezza della diapositiva.
"""
import hashlib
import json
import os
import re

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R_EMBED = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"
CACHE_VERSION = 3


def _color(el):
    """First srgbClr under el (#rrggbb) or None. Scheme colours: ponytail —
    hymn files use explicit colours; theme lookup if a file ever needs it."""
    if el is None:
        return None
    c = el.find(f".//{A}srgbClr")
    return "#" + c.get("val") if c is not None else None


def _theme_fonts(prs):
    """(titoli, testo) del tema: i testi senza carattere scritto lo ereditano da qui."""
    import re
    try:
        from pptx.opc.constants import RELATIONSHIP_TYPE as RT
        xml = prs.slide_master.part.part_related_by(RT.THEME).blob.decode("utf-8", "ignore")
        f = lambda k: (re.search(rf"<a:{k}>\s*<a:latin typeface=\"([^\"]*)\"", xml) or [None, ""])[1]
        return f("majorFont"), f("minorFont")
    except Exception:
        return "", ""


def _font(face, theme, sh):
    if face == "+mj-lt" or (not face and sh.is_placeholder and "TITLE" in str(sh.placeholder_format.type)):
        return theme[0]
    if not face or face.startswith("+"):
        return theme[1]
    return face


def _save_blob(part, rid, out_dir):
    img = part.related_part(rid)
    ext = os.path.splitext(img.partname)[1] or ".png"
    name = hashlib.md5(img.blob).hexdigest()[:16] + ext
    path = os.path.join(out_dir, name)
    if not os.path.exists(path):
        with open(path, "wb") as f:
            f.write(img.blob)
    return name


def _text(sh, H, theme):
    tf = sh.text_frame
    body = tf._txBody.find(f"{A}bodyPr")
    get = (lambda k, d: int(body.get(k)) if body is not None and body.get(k) else d)
    anchor = (body.get("anchor") if body is not None else None) or "t"
    nowrap = body is not None and body.get("wrap") == "none"
    scale = 1.0
    na = body.find(f"{A}normAutofit") if body is not None else None
    if na is not None and na.get("fontScale"):
        scale = int(na.get("fontScale")) / 100000
    paras = []
    for p in tf.paragraphs:
        ppr = p._p.find(f"{A}pPr")
        algn = (ppr.get("algn") if ppr is not None else None) or "l"
        runs = []
        for r in p.runs:
            rpr = r._r.find(f"{A}rPr")
            sz = int(rpr.get("sz")) if rpr is not None and rpr.get("sz") else 1800
            latin = rpr.find(f"{A}latin") if rpr is not None else None
            runs.append({"t": r.text, "s": round(sz * 127 * scale / H, 5),
                         "f": _font(latin.get("typeface") if latin is not None else "", theme, sh),
                         "b": rpr is not None and rpr.get("b") == "1",
                         "i": rpr is not None and rpr.get("i") == "1",
                         "c": _color(rpr) or ""})
        sz0 = runs[0]["s"] if runs else round(1800 * 127 * scale / H, 5)
        paras.append({"a": {"l": "left", "ctr": "center", "r": "right", "just": "justify"}.get(algn, "left"),
                      "runs": runs, "s": sz0})
    return {"anchor": {"t": "flex-start", "ctr": "center", "b": "flex-end"}.get(anchor, "flex-start"),
            "pad": [get("lIns", 91440), get("tIns", 45720), get("rIns", 91440), get("bIns", 45720)],
            "nowrap": nowrap, "paras": paras}


def describe(path, cache_root):
    """{ratio, slides: [[shape,…]], text: [str]} — cached per file content."""
    st = os.stat(path)
    key = hashlib.md5(f"{os.path.abspath(path)}|{st.st_mtime}|{st.st_size}|{CACHE_VERSION}".encode()).hexdigest()[:20]
    out_dir = os.path.join(cache_root, key)
    jpath = os.path.join(out_dir, "slides.json")
    if os.path.isfile(jpath):
        with open(jpath, encoding="utf-8") as f:
            return json.load(f)
    os.makedirs(out_dir, exist_ok=True)
    prs = Presentation(path)
    W, H = prs.slide_width, prs.slide_height
    theme = _theme_fonts(prs)
    slides, texts = [], []
    for slide in prs.slides:
        shapes = []
        for sh in slide.shapes:
            if sh.left is None or sh.width is None:
                continue
            d = {"x": sh.left / W, "y": sh.top / H, "w": sh.width / W, "h": sh.height / H, "rot": sh.rotation or 0}
            if sh.shape_type == MSO_SHAPE_TYPE.PICTURE:
                blip = sh._element.find(f".//{A}blip")
                if blip is None or not blip.get(R_EMBED):
                    continue
                d["img"] = key + "/" + _save_blob(slide.part, blip.get(R_EMBED), out_dir)
            else:
                sppr = sh._element.find("{http://schemas.openxmlformats.org/presentationml/2006/main}spPr")
                if sppr is not None:
                    solid = sppr.find(f"{A}solidFill")
                    if solid is not None:
                        d["fill"] = _color(solid)
                    blip = sppr.find(f"{A}blipFill/{A}blip")
                    if blip is not None and blip.get(R_EMBED):
                        d["img"] = key + "/" + _save_blob(slide.part, blip.get(R_EMBED), out_dir)
                if sh.has_text_frame and sh.text_frame.text.strip():
                    d["text"] = _text(sh, H, theme)
            if any(k in d for k in ("img", "fill", "text")):
                d["pad"] = [v / W if i % 2 == 0 else v / H for i, v in enumerate(d["text"]["pad"])] if "text" in d else None
                shapes.append(d)
        slides.append(shapes)
        texts.append("\n".join(s["text"]["paras"] and "\n".join("".join(r["t"] for r in p["runs"]) for p in s["text"]["paras"])
                               for s in shapes if "text" in s).strip())
    data = {"ratio": W / H, "slides": slides, "text": texts}
    with open(jpath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return data


if __name__ == "__main__":   # self-check su un inno di prova
    import sys
    import tempfile
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(__file__)),
                                                             "file test", "pptx nuovi", "003 - Confiderò Sempre.pptx")
    d = describe(src, tempfile.mkdtemp())
    assert d["slides"] and abs(d["ratio"] - 16 / 9) < 0.01
    assert "Confiderò" in d["text"][0]
    first = d["slides"][1][-1]["text"]["paras"][0]["runs"][0]
    assert first["f"] == "Berlin Sans FB" and first["c"].upper() == "#FFFFFF" and 0.05 < first["s"] < 0.2, first
    print("ok", len(d["slides"]), "diapositive")


# ── template dell'innario e creazione di nuovi PowerPoint ─────────────────
def derive_template(folder, cache_root):
    """Style of an existing hymnal, read from its first hymn: background
    picture of the title slide, font/colour/size of the lyric slides."""
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith(".pptx") and not f.startswith("~"))
    for f in files[:5]:
        try:
            d = describe(os.path.join(folder, f), cache_root)
        except Exception:
            continue
        bg = next((s["img"] for sl in d["slides"][:1] for s in sl if "img" in s and s["w"] > 0.9), "")
        for sl in d["slides"][1:]:
            for s in sl:
                if "text" in s and s["text"]["paras"] and s["text"]["paras"][0]["runs"]:
                    r = s["text"]["paras"][0]["runs"][0]
                    return {"bg": bg, "font": r["f"] or "Helvetica", "color": r["c"] or "#FFFFFF",
                            "size": round(r["s"] * 7.5 * 72), "fill": next((x.get("fill") for x in sl if x.get("fill")), "#000000")}
    return {"bg": "", "font": "Helvetica", "color": "#FFFFFF", "size": 60, "fill": "#000000"}


LABEL = re.compile(r"^\s*(?:coro|ritornello|rit|ref|refrain)\s*(?:[:.\-)]|$)\s*", re.I)
NUM = re.compile(r"^\s*(?:(?:strofa|str|verso|v)\.?\s*)?\d+\s*[.):\-]?\s*$", re.I)
NUMPFX = re.compile(r"^\s*(?:(?:strofa|str)\.?\s*)?\d+\s*[.):]\s*", re.I)
AMEN = re.compile(r"^[\s\W]*amen[\s\W]*$", re.I)


def layout(stanzas):
    """[(text, italic)] from pasted blocks. Verse numbers are dropped; a block
    labelled «Coro» / «Ritornello» / «Rit:» is the chorus (the label only marks
    it): italic, repeated after every verse. «Amen!» is added by build_pptx."""
    verses, chorus, want_chorus = [], "", False
    for st in stanzas:
        lines = [x.rstrip() for x in st.strip().split("\n")]
        is_chorus = want_chorus
        want_chorus = False
        while lines:                                   # numero e/o etichetta, in qualunque ordine
            m = LABEL.match(lines[0])
            if m:
                is_chorus = True
                lines[0] = lines[0][m.end():]
            elif NUM.match(lines[0]):
                lines.pop(0)
            elif NUMPFX.match(lines[0]):
                lines[0] = lines[0][NUMPFX.match(lines[0]).end():]
                break
            else:
                break
            lines = [l for i, l in enumerate(lines) if i or l.strip()]   # etichetta da sola sulla riga
        text = "\n".join(l for l in lines if l.strip()).strip()
        if not text:
            want_chorus = want_chorus or is_chorus      # «Coro» da solo: il testo è nel blocco dopo
        elif is_chorus:
            chorus = chorus or text
        elif not AMEN.match(text):
            verses.append(text)
    out = []
    for v in verses:
        out.append((v, False))
        if chorus:
            out.append((chorus, True))
    if chorus and not verses:
        out.append((chorus, True))
    return out


def apply_edits(src, dest, edit):
    """Copia dell'inno con le modifiche fatte nell'app scritte dentro il file:
    tutto il resto (sfondi, immagini, «Amen!», caratteri) resta com'era.
    edit = {scale, texts: {indice: "testo" | [[{t, i, b, c}, …], …]}} — lo
    stesso riquadro che modifica l'app (quello con più pezzi di testo)."""
    from copy import deepcopy
    from lxml import etree
    prs = Presentation(src)
    scale, texts = edit.get("scale") or 1, edit.get("texts") or {}
    for k, slide in enumerate(prs.slides):
        boxes = [sh for sh in slide.shapes if sh.left is not None and sh.width is not None
                 and sh.has_text_frame and sh.text_frame.text.strip()]
        lines = texts.get(str(k))
        if boxes and lines is not None:
            sh = max(boxes, key=lambda b: (sum(len(p.runs) for p in b.text_frame.paragraphs), -boxes.index(b)))
            body = sh.text_frame._txBody
            ps = body.findall(f"{A}p")
            ppr = ps[0].find(f"{A}pPr")
            r0 = next((r for p in ps for r in p.findall(f"{A}r")), None)
            tpl = r0.find(f"{A}rPr") if r0 is not None else None
            for p in ps:
                body.remove(p)
            if isinstance(lines, str):
                lines = [[{"t": t}] if t else [] for t in lines.split("\n")]
            for line in lines:
                p = etree.SubElement(body, f"{A}p")
                if ppr is not None:
                    p.append(deepcopy(ppr))
                for run in line:
                    r = etree.SubElement(p, f"{A}r")
                    rpr = deepcopy(tpl) if tpl is not None else etree.Element(f"{A}rPr", lang="it-IT")
                    r.append(rpr)
                    if run.get("i") is not None:
                        rpr.set("i", "1" if run["i"] else "0")
                        rpr.set("b", "1" if run.get("b") else "0")
                    if run.get("c"):
                        for old in rpr.findall(f"{A}solidFill"):
                            rpr.remove(old)
                        fill = etree.Element(f"{A}solidFill")
                        etree.SubElement(fill, f"{A}srgbClr", val=run["c"].lstrip("#").upper())
                        ln = rpr.find(f"{A}ln")
                        rpr.insert(list(rpr).index(ln) + 1 if ln is not None else 0, fill)
                    etree.SubElement(r, f"{A}t").text = run["t"]
        if scale != 1:   # «Dimensione del testo»: vale per tutti i testi, come nell'app
            for sh in boxes:
                for r in sh._element.iter(f"{A}rPr"):
                    r.set("sz", str(round(int(r.get("sz") or 1800) * scale)))
    prs.save(dest)
    return dest


def build_pptx(dest, title, stanzas, tpl, bg_path=""):
    """New 16:9 hymn in the hymnal's style: a title slide on the background
    picture, then one slide per verse (chorus in italic after each verse),
    «Amen!» in red italic bottom-right on the last slide."""
    from pptx.util import Emu, Pt
    from pptx.dml.color import RGBColor
    from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
    prs = Presentation()
    prs.slide_width, prs.slide_height = Emu(12193200), Emu(6858000)
    blank = prs.slide_layouts[6]
    hexrgb = lambda h: RGBColor.from_string((h or "#FFFFFF").lstrip("#").upper())
    W, H = prs.slide_width, prs.slide_height
    font, size = tpl.get("font") or "Helvetica", tpl.get("size") or 60

    def slide(text, size, picture, italic=False, amen=False):
        s = prs.slides.add_slide(blank)
        bgsh = s.shapes.add_shape(1, 0, 0, W, H)
        bgsh.fill.solid(); bgsh.fill.fore_color.rgb = hexrgb(tpl.get("fill") or "#000000"); bgsh.line.fill.background()
        if picture and os.path.isfile(picture):
            s.shapes.add_picture(picture, 0, 0, W, H)
        tb = s.shapes.add_textbox(Emu(180000), 0, W - Emu(360000), H)
        tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        for i, line in enumerate(text.split("\n")):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = PP_ALIGN.CENTER
            r = p.add_run(); r.text = line
            r.font.size = Pt(size); r.font.name = font; r.font.italic = italic; r.font.color.rgb = hexrgb(tpl.get("color"))
        if amen:   # come negli inni dell'innario: in basso a destra, rosso, corsivo
            ah = min(0.3, size * 0.96 * 1.84 / 540)       # altezza del riquadro come negli inni dell'innario
            ab = s.shapes.add_textbox(int(W * 0.65), int(H * min(0.8, 1 - ah - 0.005)), int(W * 0.28), int(H * ah))
            p = ab.text_frame.paragraphs[0]; p.alignment = PP_ALIGN.RIGHT
            r = p.add_run(); r.text = "Amen!"
            r.font.size = Pt(round(size * 0.96)); r.font.name = font; r.font.italic = True; r.font.color.rgb = RGBColor(0xFF, 0, 0)

    slide(title, round(size * 1.33), bg_path)
    body = layout(stanzas)
    for i, (text, italic) in enumerate(body):
        slide(text, size, "", italic, amen=i == len(body) - 1)
    slide(title, round(size * 1.33), bg_path)   # diapositiva finale = quella del titolo
    prs.save(dest)
    return dest


def read_blocks(path):
    """Stanzas of a pptx / docx / txt to import. In a pptx the slides in
    italic are the chorus: written once as «Rit: …» (build_pptx repeats it)."""
    if path.lower().endswith(".pptx"):
        d = describe(path, os.path.join(os.path.dirname(path), ".tmp-import"))
        out, chorus = [], ""
        for sl, t in zip(d["slides"], d["text"]):
            if not t.strip() or AMEN.match(t):
                continue
            runs = [r for sh in sl if "text" in sh for p in sh["text"]["paras"] for r in p["runs"] if r["t"].strip()]
            if runs and all(r["i"] for r in runs):
                if not chorus:
                    chorus = t; out.append("Rit: " + t)
                continue
            if out and t == out[0]:   # diapositiva finale col titolo, uguale alla prima
                continue
            out.append(t)
        return out
    import sys as _s
    _s.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from core.documents import read_text_blocks
    return read_text_blocks(path)


# ── caratteri dentro il file PowerPoint ────────────────────────────────────
def _ttf_eot(data):
    """TrueType -> EOT non compresso (il formato dei .fntdata di PowerPoint)."""
    import struct
    n = struct.unpack(">H", data[4:6])[0]
    tabs = {data[12 + 16 * i:16 + 16 * i]: struct.unpack(">II", data[20 + 16 * i:28 + 16 * i]) for i in range(n)}
    os2 = tabs[b"OS/2"][0]
    ver, weight, fstype = (struct.unpack(">H", data[os2 + o:os2 + o + 2])[0] for o in (0, 4, 8))
    panose = data[os2 + 32:os2 + 42]
    ur = data[os2 + 42:os2 + 58]
    ur = struct.pack("<4L", *struct.unpack(">4L", ur))
    sel = struct.unpack(">H", data[os2 + 62:os2 + 64])[0]
    cp = struct.pack("<2L", *struct.unpack(">2L", data[os2 + 78:os2 + 86])) if ver >= 1 else b"\0" * 8
    adj = struct.unpack(">L", data[tabs[b"head"][0] + 8:tabs[b"head"][0] + 12])[0]
    nm, names = tabs[b"name"][0], {}
    count, strs = struct.unpack(">HH", data[nm + 2:nm + 6])
    for j in range(count):
        pid, _, lang, nid, ln, o = struct.unpack(">6H", data[nm + 6 + 12 * j:nm + 18 + 12 * j])
        raw = data[nm + strs + o:nm + strs + o + ln]
        if nid in (1, 2, 4, 5) and (nid not in names or (pid == 3 and lang == 0x409)):
            names[nid] = raw.decode("utf-16-be" if pid in (0, 3) else "latin-1", "ignore")

    def s(nid):
        b = names.get(nid, "").encode("utf-16-le")
        return struct.pack("<H", len(b)) + b
    body = (panose + struct.pack("<BBLHH", 1, sel & 1, weight, fstype, 0x504C) + ur + cp + struct.pack("<L4L", adj, 0, 0, 0, 0)
            + b"\0\0" + s(1) + b"\0\0" + s(2) + b"\0\0" + s(5) + b"\0\0" + s(4) + b"\0\0" + b"\0\0")
    head = struct.pack("<LLLL", 0, len(data), 0x00020001, 0)
    blob = head + body + data
    return struct.pack("<L", len(blob)) + blob[4:]


def embed_fonts(path, fonts):
    """fonts = {famiglia: {"regular"|"bold"|"italic"|"boldItalic": percorso .ttf}} -> scritti dentro il .pptx."""
    from pptx.opc.package import Part
    from pptx.opc.packuri import PackURI
    from lxml import etree
    P = "http://schemas.openxmlformats.org/presentationml/2006/main"
    RT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"
    prs = Presentation(path)
    root = prs.part._element
    if root.find(f"{{{P}}}embeddedFontLst") is not None or not fonts:
        return False
    lst = etree.Element(f"{{{P}}}embeddedFontLst")
    k = 0
    for fam, styles in fonts.items():
        ef = etree.SubElement(lst, f"{{{P}}}embeddedFont")
        etree.SubElement(ef, f"{{{P}}}font").set("typeface", fam)
        for slot in ("regular", "bold", "italic", "boldItalic"):
            if slot in styles:
                with open(styles[slot], "rb") as f:
                    k += 1
                    part = Part(PackURI(f"/ppt/fonts/font{k}.fntdata"), "application/x-fontdata", prs.part.package, _ttf_eot(f.read()))
                rid = prs.part.relate_to(part, RT)
                etree.SubElement(ef, f"{{{P}}}{slot}").set("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id", rid)
    after = root.find(f"{{{P}}}smartTags")
    if after is None:
        after = root.find(f"{{{P}}}notesSz")
    after.addnext(lst)
    root.set("embedTrueTypeFonts", "1")
    prs.save(path)
    return True
