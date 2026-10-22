"""Legge un PowerPoint e lo descrive come forme da disegnare nell'app:
sfondi, forme (anche a mano libera), sfumature, foto ritagliate, linee e
testi, compresi quelli ereditati da schema e layout, con i colori del tema.
Niente PowerPoint, Keynote o WPS: l'uscita disegna le diapositive da sola.

Posizioni e dimensioni sono frazioni della diapositiva; le dimensioni dei
caratteri sono frazioni dell'altezza della diapositiva. Ogni forma porta il
suo disegno già pronto in "svg" (coordinate in EMU della forma); i testi
restano descritti a parte, perché l'app li sa modificare.
"""
import colorsys
import hashlib
import json
import math
import os
import re

from pptx import Presentation

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
MC = "{http://schemas.openxmlformats.org/markup-compatibility/2006}"
R_EMBED = R + "embed"
CACHE_VERSION = 7

COLOR_TAGS = {A + t for t in ("srgbClr", "schemeClr", "sysClr", "prstClr", "scrgbClr", "hslClr")}
PRESET = {"black": "000000", "white": "FFFFFF", "red": "FF0000", "green": "008000", "blue": "0000FF", "yellow": "FFFF00",
          "gray": "808080", "grey": "808080", "darkGray": "A9A9A9", "lightGray": "D3D3D3", "orange": "FFA500"}
# simboli dei punti elenco scritti con i caratteri Wingdings/Symbol
WINGDINGS = {"§": "■", "Ø": "➢", "ü": "✓", "q": "❑", "v": "❖", "n": "■", "l": "●", "Ÿ": "•", "o": "○", "ð": "➔", "à": "➔"}
BODY_TYPES = {"body", "subTitle", "obj", None}
TRANS_SPEED = {"slow": 1000, "med": 750, "fast": 500}


def _local(el):
    return el.tag.split("}")[-1] if isinstance(el.tag, str) else ""


def _int(el, k, d=0):
    v = el.get(k) if el is not None else None
    try:
        return int(v) if v is not None else d
    except ValueError:
        return d


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _srgb(c):
    c = min(1.0, max(0.0, c))
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def css(c):
    """(r, g, b, a) 0..1 → colore CSS ("#RRGGBB" se opaco)."""
    if c is None:
        return ""
    r, g, b, a = c
    if a >= 0.999:
        return "#%02X%02X%02X" % tuple(round(min(1, max(0, v)) * 255) for v in (r, g, b))
    return "rgba(%d,%d,%d,%.3f)" % (round(r * 255), round(g * 255), round(b * 255), max(0, a))


def _seg(el, i):
    """i-esimo figlio non di controllo (salta extLst ecc.)."""
    kids = [k for k in el if isinstance(k.tag, str)]
    return kids[i] if i < len(kids) else None


class Deck:
    """Tema, schema colori e stili di una presentazione."""

    def __init__(self, prs, out_dir, key):
        self.prs, self.out_dir, self.key = prs, out_dir, key
        self.W, self.H = prs.slide_width, prs.slide_height
        self.n = 0
        master = prs.slide_master
        theme = None
        for rel in master.part.rels.values():
            if rel.reltype.endswith("/theme"):
                from lxml import etree
                theme = etree.fromstring(rel.target_part.blob)
        self.scheme, self.fonts, self.fills, self.lines, self.bgfills = {}, ("", ""), [], [], []
        if theme is not None:
            cs = theme.find(f".//{A}clrScheme")
            for k in (cs if cs is not None else []):
                c = next((x for x in k if x.tag in COLOR_TAGS), None)
                if c is not None:
                    self.scheme[_local(k)] = c
            maj, mnr = theme.find(f".//{A}majorFont/{A}latin"), theme.find(f".//{A}minorFont/{A}latin")
            self.fonts = (maj.get("typeface") if maj is not None else "", mnr.get("typeface") if mnr is not None else "")
            for name, attr in (("fillStyleLst", "fills"), ("lnStyleLst", "lines"), ("bgFillStyleLst", "bgfills")):
                lst = theme.find(f".//{A}{name}")
                setattr(self, attr, [k for k in lst if isinstance(k.tag, str)] if lst is not None else [])
        cm = master.element.find(f"{P}clrMap")
        self.master_map = dict(cm.attrib) if cm is not None else {}
        dts = prs.part._element.find(f"{P}defaultTextStyle") if hasattr(prs.part, "_element") else None
        self.default_style = dts if dts is not None else prs.element.find(f"{P}defaultTextStyle")

    def uid(self):
        self.n += 1
        return f"k{self.key[:6]}{self.n}"

    # ── colori ──
    def color(self, el, cmap, ph=None):
        """Elemento colore (con le sue modifiche) → (r, g, b, a)."""
        if el is None:
            return None
        tag = _local(el)
        if tag == "srgbClr":
            v = el.get("val", "000000")
            rgb = [int(v[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        elif tag == "sysClr":
            v = el.get("lastClr") or ("FFFFFF" if el.get("val") == "window" else "000000")
            rgb = [int(v[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        elif tag == "prstClr":
            v = PRESET.get(el.get("val"), "000000")
            rgb = [int(v[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        elif tag == "scrgbClr":
            rgb = [_srgb(_int(el, k) / 100000) for k in ("r", "g", "b")]
        elif tag == "hslClr":
            rgb = list(colorsys.hls_to_rgb(_int(el, "hue") / 21600000, _int(el, "lum") / 100000, _int(el, "sat") / 100000))
        elif tag == "schemeClr":
            v = el.get("val")
            if v == "phClr":
                if ph is None:
                    return None
                base = list(ph)
                return self._mods(el, base[:3], base[3])
            v = cmap.get(v, v)
            base = self.color(self.scheme.get(v), cmap)
            if base is None:
                return None
            return self._mods(el, list(base[:3]), base[3])
        else:
            return None
        return self._mods(el, rgb, 1.0)

    @staticmethod
    def _mods(el, rgb, a):
        for m in el:
            t, v = _local(m), _int(m, "val") / 100000
            if t == "alpha":
                a = v
            elif t == "alphaMod":
                a *= v
            elif t == "alphaOff":
                a += v
            elif t in ("lumMod", "lumOff", "satMod", "satOff", "hueMod", "hueOff"):
                h, l, s = colorsys.rgb_to_hls(*rgb)
                if t == "lumMod":
                    l *= v
                elif t == "lumOff":
                    l += v
                elif t == "satMod":
                    s *= v
                elif t == "satOff":
                    s += v
                elif t == "hueMod":
                    h = (h * v) % 1
                else:
                    h = (h + _int(m, "val") / 21600000) % 1
                rgb = list(colorsys.hls_to_rgb(h, min(1, max(0, l)), min(1, max(0, s))))
            elif t == "shade":
                rgb = [_srgb(_lin(c) * v) for c in rgb]
            elif t == "tint":
                rgb = [_srgb(1 - (1 - _lin(c)) * v) for c in rgb]
            elif t == "comp":
                h, l, s = colorsys.rgb_to_hls(*rgb)
                rgb = list(colorsys.hls_to_rgb((h + 0.5) % 1, l, s))
            elif t == "inv":
                rgb = [1 - c for c in rgb]
            elif t == "gray":
                g = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]
                rgb = [g, g, g]
        return (rgb[0], rgb[1], rgb[2], min(1, max(0, a)))

    def first_color(self, parent, cmap, ph=None):
        if parent is None:
            return None
        c = next((x for x in parent if x.tag in COLOR_TAGS), None)
        return self.color(c, cmap, ph)

    # ── riempimenti ──
    def paint(self, el, cmap, part, ph=None):
        """Elemento di riempimento → {"k": solid|grad|img} oppure None (niente)."""
        if el is None:
            return None
        t = _local(el)
        if t == "solidFill":
            c = self.first_color(el, cmap, ph)
            return {"k": "solid", "c": c} if c else None
        if t == "gradFill":
            stops = []
            for gs in el.iter(f"{A}gs"):
                c = self.first_color(gs, cmap, ph)
                if c:
                    stops.append((_int(gs, "pos") / 100000, c))
            stops.sort(key=lambda s: s[0])
            if not stops:
                return None
            lin, path = el.find(f"{A}lin"), el.find(f"{A}path")
            g = {"k": "grad", "stops": stops, "ang": _int(lin, "ang", 5400000) / 60000 if lin is not None else 90}
            if path is not None:
                ftr = path.find(f"{A}fillToRect")
                g["radial"] = [_int(ftr, k) / 100000 for k in ("l", "t", "r", "b")] if ftr is not None else [.5, .5, .5, .5]
            return g
        if t == "blipFill":
            blip = el.find(f"{A}blip")
            if blip is None or not blip.get(R_EMBED) or part is None:
                return None
            try:
                name = self.save_blob(part, blip.get(R_EMBED))
            except Exception:
                return None
            sr = el.find(f"{A}srcRect")
            crop = [_int(sr, k) / 100000 for k in ("l", "t", "r", "b")] if sr is not None else [0, 0, 0, 0]
            amf = blip.find(f"{A}alphaModFix")
            return {"k": "img", "img": name, "crop": crop, "alpha": _int(amf, "amt", 100000) / 100000 if amf is not None else 1,
                    "gray": blip.find(f"{A}grayscl") is not None}
        if t == "pattFill":
            c = self.first_color(el.find(f"{A}fgClr"), cmap, ph)
            return {"k": "solid", "c": c} if c else None
        return None

    def save_blob(self, part, rid):
        img = part.related_part(rid)
        ext = os.path.splitext(img.partname)[1] or ".png"
        name = hashlib.md5(img.blob).hexdigest()[:16] + ext
        path = os.path.join(self.out_dir, name)
        if not os.path.exists(path):
            with open(path, "wb") as f:
                f.write(img.blob)
        return self.key + "/" + name

    def style_fill(self, ref, cmap, lst):
        """fillRef/lnRef/bgRef: stile del tema col colore del riferimento."""
        if ref is None:
            return None
        idx = _int(ref, "idx")
        lst = self.bgfills if idx >= 1001 else lst
        i = idx - 1001 if idx >= 1001 else idx - 1
        if idx == 0 or not (0 <= i < len(lst)):
            return None
        return lst[i], self.first_color(ref, cmap)


def fill_of(deck, sppr, style, cmap, part, group_fill=None):
    """Riempimento di una forma: proprio, del gruppo, o dallo stile."""
    if sppr is not None:
        for k in sppr:
            t = _local(k)
            if t == "noFill":
                return None
            if t == "grpFill":
                return group_fill
            if t in ("solidFill", "gradFill", "blipFill", "pattFill"):
                return deck.paint(k, cmap, part)
    if style is not None:
        r = deck.style_fill(style.find(f"{A}fillRef"), cmap, deck.fills)
        if r:
            return deck.paint(r[0], cmap, part, r[1])
    return None


DASH = {"dash": "4 3", "sysDash": "3 1", "dot": "1 1", "sysDot": "1 1", "lgDash": "8 3", "dashDot": "4 3 1 3",
        "sysDashDot": "3 1 1 1", "lgDashDot": "8 3 1 3", "lgDashDotDot": "8 3 1 3 1 3", "sysDashDotDot": "3 1 1 1 1 1"}


def line_of(deck, sppr, style, cmap):
    """{"c": colore, "w": spessore EMU, "dash"} oppure None."""
    ln = sppr.find(f"{A}ln") if sppr is not None else None
    sref = deck.style_fill(style.find(f"{A}lnRef"), cmap, deck.lines) if style is not None else None
    base = sref[0] if sref else None
    w = _int(ln, "w") if ln is not None and ln.get("w") else _int(base, "w", 9525) if base is not None else 9525
    paint, src = None, None
    for cand, ph in ((ln, None), (base, sref[1] if sref else None)):
        if cand is None:
            continue
        for k in cand:
            t = _local(k)
            if t == "noFill":
                return None
            if t in ("solidFill", "gradFill"):
                paint = deck.paint(k, cmap, None, ph)
                src = cand
                break
        if paint is not None:
            break
    if paint is None:
        return None
    c = paint["c"] if paint["k"] == "solid" else paint["stops"][0][1]
    dash = None
    for cand in (ln, base):
        d = cand.find(f"{A}prstDash") if cand is not None else None
        if d is not None:
            dash = DASH.get(d.get("val"))
            break
    return {"c": c, "w": max(w, 1), "dash": dash}


# ── geometria ──
def _adj(prst_el, name, default):
    for gd in prst_el.iter(f"{A}gd"):
        if gd.get("name") == name:
            m = re.match(r"val\s+(-?\d+)", gd.get("fmla", ""))
            if m:
                return int(m.group(1))
    return default


def _arc(cx, cy, rx, ry, a0, a1):
    """Arco dell'ellisse da a0 ad a1 (gradi) come comando SVG."""
    x1, y1 = cx + rx * math.cos(math.radians(a1)), cy + ry * math.sin(math.radians(a1))
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 1 if a1 > a0 else 0
    return f"A{rx:.0f} {ry:.0f} 0 {large} {sweep} {x1:.0f} {y1:.0f}"


def geometry(sppr, w, h):
    """Percorsi SVG [(d, riempito, contornato)] nello spazio della forma."""
    rect = [(f"M0 0H{w}V{h}H0Z", True, True)]
    if sppr is None:
        return rect
    pg = sppr.find(f"{A}prstGeom")
    if pg is not None:
        p, ss = pg.get("prst", "rect"), min(w, h)
        if p in ("ellipse", "flowChartConnector"):
            return [(f"M0 {h / 2}A{w / 2} {h / 2} 0 1 1 {w} {h / 2}A{w / 2} {h / 2} 0 1 1 0 {h / 2}Z", True, True)]
        if p in ("roundRect", "flowChartAlternateProcess"):
            r = ss * _adj(pg, "adj", 16667) / 100000
            return [(f"M{r} 0H{w - r}A{r} {r} 0 0 1 {w} {r}V{h - r}A{r} {r} 0 0 1 {w - r} {h}H{r}A{r} {r} 0 0 1 0 {h - r}V{r}A{r} {r} 0 0 1 {r} 0Z", True, True)]
        if p == "round2SameRect":
            r = ss * _adj(pg, "adj1", 16667) / 100000
            return [(f"M{r} 0H{w - r}A{r} {r} 0 0 1 {w} {r}V{h}H0V{r}A{r} {r} 0 0 1 {r} 0Z", True, True)]
        if p in ("triangle", "flowChartExtract"):
            x = w * _adj(pg, "adj", 50000) / 100000
            return [(f"M{x} 0L{w} {h}H0Z", True, True)]
        if p == "rtTriangle":
            return [(f"M0 0L{w} {h}H0Z", True, True)]
        if p == "diamond":
            return [(f"M{w / 2} 0L{w} {h / 2}L{w / 2} {h}L0 {h / 2}Z", True, True)]
        if p == "parallelogram":
            x = ss * _adj(pg, "adj", 25000) / 100000
            return [(f"M{x} 0H{w}L{w - x} {h}H0Z", True, True)]
        if p == "trapezoid":
            x = ss * _adj(pg, "adj", 25000) / 100000
            return [(f"M{x} 0H{w - x}L{w} {h}H0Z", True, True)]
        if p in ("homePlate", "pentagon"):
            x = w - ss * _adj(pg, "adj", 50000) / 100000
            return [(f"M0 0H{x}L{w} {h / 2}L{x} {h}H0Z", True, True)]
        if p == "chevron":
            x = ss * _adj(pg, "adj", 50000) / 100000
            return [(f"M0 0H{w - x}L{w} {h / 2}L{w - x} {h}H0L{x} {h / 2}Z", True, True)]
        if p == "hexagon":
            x = ss * _adj(pg, "adj", 25000) / 100000
            return [(f"M{x} 0H{w - x}L{w} {h / 2}L{w - x} {h}H{x}L0 {h / 2}Z", True, True)]
        if p == "snip1Rect":
            x = ss * _adj(pg, "adj", 16667) / 100000
            return [(f"M0 0H{w - x}L{w} {x}V{h}H0Z", True, True)]
        if p in ("line", "straightConnector1", "bentConnector1"):
            return [(f"M0 0L{w} {h}", False, True)]
        return rect
    cg = sppr.find(f"{A}custGeom")
    if cg is None:
        return rect
    guides = {}
    for gd in cg.iter(f"{A}gd"):
        m = re.match(r"val\s+(-?\d+)", gd.get("fmla", ""))
        if m:
            guides[gd.get("name")] = int(m.group(1))
    num = lambda v: int(v) if re.match(r"^-?\d+$", v or "") else guides.get(v, 0)
    out = []
    pl = cg.find(f"{A}pathLst")
    for path in (pl if pl is not None else []):
        if _local(path) != "path":
            continue
        pw, ph = _int(path, "w") or w, _int(path, "h") or h
        sx, sy = w / pw if pw else 1, h / ph if ph else 1
        d, cx, cy = [], 0, 0
        pt = lambda e: (num(e.get("x")) * sx, num(e.get("y")) * sy)
        for cmd in path:
            t = _local(cmd)
            pts = [pt(e) for e in cmd.findall(f"{A}pt")]
            if t == "moveTo" and pts:
                cx, cy = pts[0]
                d.append(f"M{cx:.0f} {cy:.0f}")
            elif t == "lnTo" and pts:
                cx, cy = pts[0]
                d.append(f"L{cx:.0f} {cy:.0f}")
            elif t == "cubicBezTo" and len(pts) == 3:
                d.append("C" + " ".join(f"{x:.0f} {y:.0f}" for x, y in pts))
                cx, cy = pts[2]
            elif t == "quadBezTo" and len(pts) == 2:
                d.append("Q" + " ".join(f"{x:.0f} {y:.0f}" for x, y in pts))
                cx, cy = pts[1]
            elif t == "arcTo":
                rx, ry = num(cmd.get("wR")) * sx, num(cmd.get("hR")) * sy
                a0, sw = num(cmd.get("stAng")) / 60000, num(cmd.get("swAng")) / 60000
                ox, oy = cx - rx * math.cos(math.radians(a0)), cy - ry * math.sin(math.radians(a0))
                if abs(sw) >= 360:
                    d.append(_arc(ox, oy, rx, ry, a0, a0 + sw / 2))
                    a0 += sw / 2
                    sw /= 2
                d.append(_arc(ox, oy, rx, ry, a0, a0 + sw))
                cx, cy = ox + rx * math.cos(math.radians(a0 + sw)), oy + ry * math.sin(math.radians(a0 + sw))
            elif t == "close":
                d.append("Z")
        if d:
            out.append(("".join(d), path.get("fill") != "none", path.get("stroke") not in ("0", "false")))
    return out or rect


def svg_of(deck, geo, paint, line, w, h):
    """Disegno della forma: riempimento (colore, sfumatura o immagine) e contorno."""
    defs, body = [], []
    fill = "none"
    if paint and paint["k"] == "solid":
        fill = css(paint["c"])
    elif paint and paint["k"] == "grad":
        gid = deck.uid()
        stops = "".join(f'<stop offset="{p:.4f}" stop-color="{css(c[:3] + (1,))}" stop-opacity="{c[3]:.3f}"/>' for p, c in paint["stops"])
        if "radial" in paint:
            l, t, r, b = paint["radial"]
            cx, cy = w * (l + 1 - r) / 2, h * (t + 1 - b) / 2
            rad = max(math.hypot(x - cx, y - cy) for x in (0, w) for y in (0, h))
            defs.append(f'<radialGradient id="{gid}" gradientUnits="userSpaceOnUse" cx="{cx:.0f}" cy="{cy:.0f}" r="{rad:.0f}">{stops}</radialGradient>')
        else:
            a = math.radians(paint["ang"])
            L = abs(w * math.cos(a)) + abs(h * math.sin(a))
            dx, dy = math.cos(a) * L / 2, math.sin(a) * L / 2
            defs.append(f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{w / 2 - dx:.0f}" y1="{h / 2 - dy:.0f}" x2="{w / 2 + dx:.0f}" y2="{h / 2 + dy:.0f}">{stops}</linearGradient>')
        fill = f"url(#{gid})"
    for d, filled, _ in geo:
        if paint and paint["k"] == "img" and filled:
            cid = deck.uid()
            l, t, r, b = paint["crop"]
            iw, ih = w / max(1e-6, 1 - l - r), h / max(1e-6, 1 - t - b)
            defs.append(f'<clipPath id="{cid}"><path d="{d}"/></clipPath>')
            extra = (f' opacity="{paint["alpha"]:.3f}"' if paint["alpha"] < 1 else "") + (' style="filter:grayscale(1)"' if paint["gray"] else "")
            body.append(f'<image href="{{IMG}}{paint["img"]}" x="{-l * iw:.0f}" y="{-t * ih:.0f}" width="{iw:.0f}" height="{ih:.0f}" preserveAspectRatio="none" clip-path="url(#{cid})"{extra}/>')
        elif filled and fill != "none":
            body.append(f'<path d="{d}" fill="{fill}"/>')
    if line:
        dash = f' stroke-dasharray="{" ".join(str(float(x) * line["w"]) for x in line["dash"].split())}"' if line["dash"] else ""
        for d, _, stroked in geo:
            if stroked:
                body.append(f'<path d="{d}" fill="none" stroke="{css(line["c"])}" stroke-width="{line["w"]}"{dash}/>')
    if not body:
        return ""
    return (f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="none" overflow="visible" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">'
            + (f"<defs>{''.join(defs)}</defs>" if defs else "") + "".join(body) + "</svg>")


# ── testi ──
def _ph(el):
    ph = el.find(f"{P}nvSpPr/{P}nvPr/{P}ph")
    if ph is None:
        ph = el.find(f"{P}nvPicPr/{P}nvPr/{P}ph")
    return ph


def _ph_key(ph):
    t = ph.get("type") or "obj"
    return t, ph.get("idx")


def _find_ph(tree, t, idx):
    """Segnaposto corrispondente in layout/schema: stesso indice, o stesso tipo."""
    if tree is None:
        return None
    by_type = None
    norm = {"ctrTitle": "title", "subTitle": "body", "obj": "body"}
    for sp in tree.iter(f"{P}sp", f"{P}pic"):
        ph = _ph(sp)
        if ph is None:
            continue
        pt, pidx = _ph_key(ph)
        if idx is not None and pidx == idx and t not in ("title", "ctrTitle"):
            return sp
        if pt == t or norm.get(pt, pt) == norm.get(t, t):
            by_type = by_type if by_type is not None else sp
    return by_type


def _lvl(lst, n):
    return lst.find(f"{A}lvl{n}pPr") if lst is not None else None


def _first(chain, fn):
    for el in chain:
        if el is not None:
            v = fn(el)
            if v is not None:
                return v
    return None


def _run_color(deck, rpr, cmap):
    if rpr is None:
        return None
    for k in rpr:
        t = _local(k)
        if t == "solidFill":
            return deck.first_color(k, cmap) or (0, 0, 0, 0)
        if t == "gradFill":
            g = deck.paint(k, cmap, None)
            return g["stops"][0][1] if g else None
        if t == "noFill":
            return (0, 0, 0, 0)
    return None


def _spacing(el, size):
    """spcBef/spcAft/lnSpc → frazione dell'altezza della diapositiva (o moltiplicatore)."""
    if el is None:
        return None
    pct, pts = el.find(f"{A}spcPct"), el.find(f"{A}spcPts")
    if pct is not None:
        return ("pct", _int(pct, "val") / 100000)
    if pts is not None:
        return ("pts", _int(pts, "val"))
    return None


def text_of(deck, sp, cmap, chains, font_ref):
    """Testo di una forma con tutto quello che eredita (riquadro, livelli, colori)."""
    tx = sp.find(f"{P}txBody")
    if tx is None:
        return None
    H, W = deck.H, deck.W
    bodies = [tx.find(f"{A}bodyPr")] + [c[0] for c in chains["body"]]
    battr = lambda k: _first(bodies, lambda b: b.get(k))
    anchor = battr("anchor") or "t"
    pad = [int(battr(k) or d) for k, d in (("lIns", 91440), ("tIns", 45720), ("rIns", 91440), ("bIns", 45720))]
    nowrap = battr("wrap") == "none"
    scale, lred = 1.0, 0.0
    na = _first(bodies, lambda b: b.find(f"{A}normAutofit"))
    if na is not None:
        scale = _int(na, "fontScale", 100000) / 100000
        lred = _int(na, "lnSpcReduction", 0) / 100000
    lsts = [tx.find(f"{A}lstStyle")] + chains["lst"]
    paras, any_text = [], False
    auto_n = {}
    for p in tx.findall(f"{A}p"):
        ppr = p.find(f"{A}pPr")
        lvl = _int(ppr, "lvl", 0) + 1
        pchain = [ppr] + [_lvl(l, lvl) for l in lsts]
        rchain = [x.find(f"{A}defRPr") if x is not None else None for x in pchain[1:]]
        algn = _first(pchain, lambda e: e.get("algn")) or "l"
        mar = _first(pchain, lambda e: int(e.get("marL")) if e.get("marL") else None) or 0
        ind = _first(pchain, lambda e: int(e.get("indent")) if e.get("indent") else None) or 0

        def rprop(rpr, fn):
            return _first([rpr] + rchain, fn)

        runs = []
        items = [k for k in p if _local(k) in ("r", "fld", "br")]
        for k in items:
            rpr = k.find(f"{A}rPr")
            t = "\n" if _local(k) == "br" else "".join(x.text or "" for x in k.findall(f"{A}t"))
            sz = rprop(rpr, lambda e: int(e.get("sz")) if e.get("sz") else None) or 1800
            face = rprop(rpr, lambda e: (e.find(f"{A}latin").get("typeface") if e.find(f"{A}latin") is not None else None)) or ""
            if not face or face.startswith("+"):
                face = deck.fonts[0] if face.startswith("+mj") or (not face and font_ref == "major") else deck.fonts[1]
            col = _run_color(deck, rpr, cmap)
            if col is None:
                col = _first(rchain[:1], lambda e: _run_color(deck, e, cmap))
            if col is None and chains.get("font_color") is not None:
                col = chains["font_color"]
            if col is None:
                col = _first(rchain[1:], lambda e: _run_color(deck, e, cmap)) or deck.color(deck.scheme.get(cmap.get("tx1", "dk1")), cmap) or (0, 0, 0, 1)
            run = {"t": t, "s": round(sz * 127 * scale / H, 5), "f": face,
                   "b": rprop(rpr, lambda e: e.get("b")) in ("1", "true"),
                   "i": rprop(rpr, lambda e: e.get("i")) in ("1", "true"),
                   "c": css(col)}
            if rprop(rpr, lambda e: e.get("cap")) == "all":
                run["cap"] = 1
            if rprop(rpr, lambda e: e.get("u")) not in (None, "none"):
                run["u"] = 1
            bl = rprop(rpr, lambda e: int(e.get("baseline")) if e.get("baseline") else None)
            if bl:
                run["bl"] = bl / 100000
            runs.append(run)
            any_text = any_text or bool(t.strip())
        end = p.find(f"{A}endParaRPr")
        esz = (_int(end, "sz") if end is not None and end.get("sz") else None) or rprop(None, lambda e: int(e.get("sz")) if e.get("sz") else None) or 1800
        s0 = runs[0]["s"] if runs else round(esz * 127 * scale / H, 5)
        para = {"a": {"l": "left", "ctr": "center", "r": "right", "just": "justify", "dist": "justify"}.get(algn, "left"),
                "runs": runs, "s": s0}
        if mar or ind:
            para["ml"], para["ind"] = round(mar / W, 5), round(ind / W, 5)
        ls = _first(pchain, lambda e: _spacing(e.find(f"{A}lnSpc"), s0))
        if ls and ls[0] == "pts":
            para["lha"] = round(ls[1] * 127 / H, 5)
        elif ls and abs(ls[1] - lred - 1) > 0.001:
            para["lh"] = round(max(0.5, ls[1] - lred) * 1.2, 4)     # interlinea singola di PowerPoint ≈ 1,2
        elif lred:
            para["lh"] = round((1 - lred) * 1.2, 4)
        for key, tag in (("sb", "spcBef"), ("sa", "spcAft")):
            sv = _first(pchain, lambda e: _spacing(e.find(f"{A}{tag}"), s0))
            if sv:
                para[key] = round(sv[1] * s0 if sv[0] == "pct" else sv[1] * 127 / H, 5)
        if runs and any(r["t"].strip() for r in runs):
            bu = _first(pchain, lambda e: next((k for k in e if _local(k) in ("buNone", "buChar", "buAutoNum", "buBlip")), None))
            if bu is not None and _local(bu) != "buNone":
                bfont = _first(pchain, lambda e: e.find(f"{A}buFont").get("typeface") if e.find(f"{A}buFont") is not None else None) or ""
                if _local(bu) == "buChar":
                    ch = bu.get("char", "•")
                    if "wingdings" in bfont.lower() or "symbol" in bfont.lower():
                        ch = WINGDINGS.get(ch, "•")
                elif _local(bu) == "buAutoNum":
                    n = auto_n[lvl] = auto_n.get(lvl, _int(bu, "startAt", 1) - 1) + 1
                    kind = bu.get("type", "arabicPeriod")
                    lab = str(n) if "arabic" in kind else (chr(96 + n) if "alphaLc" in kind else chr(64 + n) if "alphaUc" in kind else str(n))
                    ch = lab + (")" if kind.endswith("ParenR") else "." if kind.endswith("Period") else "")
                else:
                    ch = "•"
                bc = _first(pchain, lambda e: deck.first_color(e.find(f"{A}buClr"), cmap) if e.find(f"{A}buClr") is not None else None)
                bs = _first(pchain, lambda e: _int(e.find(f"{A}buSzPct"), "val") / 100000 if e.find(f"{A}buSzPct") is not None else None)
                para["bu"] = {"t": ch, "c": css(bc) if bc else runs[0]["c"], "s": bs or 1}
        paras.append(para)
    if not any_text:
        return None
    out = {"anchor": {"t": "flex-start", "ctr": "center", "b": "flex-end"}.get(anchor, "flex-start"),
           "pad": pad, "nowrap": nowrap, "paras": paras}
    if na is not None:
        out["fit"] = 1          # «adatta il testo alla forma»: se non ci sta, si rimpicciolisce come in PowerPoint
    return out


# ── forme, gruppi, diapositive ──
def _xfrm(el):
    for path in (f"{P}spPr/{A}xfrm", f"{P}grpSpPr/{A}xfrm", f"{P}xfrm"):
        x = el.find(path)
        if x is not None:
            return x
    return None


def _box(x):
    off, ext = x.find(f"{A}off"), x.find(f"{A}ext")
    if off is None or ext is None:
        return None
    return [_int(off, "x"), _int(off, "y"), _int(ext, "cx"), _int(ext, "cy"), _int(x, "rot") / 60000,
            x.get("flipH") == "1", x.get("flipV") == "1"]


def _shadow(deck, sppr, cmap):
    sh = sppr.find(f"{A}effectLst/{A}outerShdw") if sppr is not None else None
    if sh is None:
        return ""
    c = deck.first_color(sh, cmap)
    if not c:
        return ""
    dist, d = _int(sh, "dist") / deck.H * 100, math.radians(_int(sh, "dir") / 60000)
    blur = _int(sh, "blurRad") / deck.H * 100
    return f"drop-shadow({dist * math.cos(d):.3f}cqh {dist * math.sin(d):.3f}cqh {blur / 2:.3f}cqh {css(c)})"


class Walker:
    def __init__(self, deck, part, cmap, layout_tree, master_tree, master_part, layout_part, layer):
        self.deck, self.part, self.cmap = deck, part, cmap
        self.lt, self.mt, self.mpart, self.lpart = layout_tree, master_tree, master_part, layout_part
        self.layer, self.out, self.bg_paint = layer, [], None

    def chains(self, sp):
        """Da dove eredita una forma: riquadro, stili di testo, posizione."""
        d = self.deck
        ph = _ph(sp)
        res = {"body": [], "lst": [], "xfrm": None, "font_color": None}
        if ph is None:
            style = sp.find(f"{P}style")
            fr = style.find(f"{A}fontRef") if style is not None else None
            if fr is not None:
                res["font_color"] = d.first_color(fr, self.cmap)
            res["lst"] = [d.default_style]
            return res
        t, idx = _ph_key(ph)
        trees = [x for x in ((self.lt if self.layer == "slide" else None), (self.mt if self.layer != "master" else None)) if x is not None]
        for tree in trees:
            src = _find_ph(tree, t, idx)
            if src is None:
                continue
            tb = src.find(f"{P}txBody")
            if tb is not None:
                res["body"].append((tb.find(f"{A}bodyPr"),))
                res["lst"].append(tb.find(f"{A}lstStyle"))
            if res["xfrm"] is None and _xfrm(src) is not None:
                res["xfrm"] = _box(_xfrm(src))
        styles = self.mt.find(f"{P}txStyles") if self.mt is not None else None
        if styles is not None:
            res["lst"].append(styles.find(f"{P}titleStyle") if t in ("title", "ctrTitle") else
                              styles.find(f"{P}bodyStyle") if t in BODY_TYPES else styles.find(f"{P}otherStyle"))
        res["lst"].append(d.default_style)
        res["is_title"] = t in ("title", "ctrTitle")
        return res

    def walk(self, tree, tf, group_fill=None, gids=()):
        for el in tree:
            t = _local(el)
            if t == "AlternateContent":
                pick = el.find(f"{MC}Fallback")
                pick = pick if pick is not None else el.find(f"{MC}Choice")
                if pick is not None:
                    self.walk(pick, tf, group_fill, gids)
            elif t == "grpSp":
                x = _xfrm(el)
                b = _box(x) if x is not None else None
                if b is None:
                    self.walk(el, tf, group_fill, gids)
                    continue
                cho, che = x.find(f"{A}chOff"), x.find(f"{A}chExt")
                chx, chy = _int(cho, "x"), _int(cho, "y")
                chw, chh = _int(che, "cx") or b[2], _int(che, "cy") or b[3]
                gx, gy, gw, gh, grot, gfh, gfv = tf(b)
                sx, sy = (gw / chw if chw else 1), (gh / chh if chh else 1)

                def child(bb, gx=gx, gy=gy, gw=gw, gh=gh, grot=grot, gfh=gfh, gfv=gfv, sx=sx, sy=sy, chx=chx, chy=chy):
                    x0, y0, w0, h0, rot, fh, fv = bb
                    nx, ny, nw, nh = gx + (x0 - chx) * sx, gy + (y0 - chy) * sy, w0 * sx, h0 * sy
                    cx, cy = nx + nw / 2, ny + nh / 2
                    gcx, gcy = gx + gw / 2, gy + gh / 2
                    if gfh:
                        cx, rot, fh = 2 * gcx - cx, -rot, not fh
                    if gfv:
                        cy, rot, fv = 2 * gcy - cy, -rot, not fv
                    if grot:
                        a = math.radians(grot)
                        dx, dy = cx - gcx, cy - gcy
                        cx, cy = gcx + dx * math.cos(a) - dy * math.sin(a), gcy + dx * math.sin(a) + dy * math.cos(a)
                        rot += grot
                    return [cx - nw / 2, cy - nh / 2, nw, nh, rot, fh, fv]

                gsp = el.find(f"{P}grpSpPr")
                gf = fill_of(self.deck, gsp, None, self.cmap, self.part, group_fill) if gsp is not None else group_fill
                gid = el.find(f"{P}nvGrpSpPr/{P}cNvPr")
                self.walk(el, child, gf, gids + ((gid.get("id"),) if gid is not None else ()))
            elif t in ("sp", "pic", "cxnSp"):
                self.shape(el, tf, group_fill, gids)

    def shape(self, el, tf, group_fill, gids=()):
        d = self.deck
        nv = next((k for k in el if _local(k).startswith("nv")), None)
        cnv = nv.find(f"{P}cNvPr") if nv is not None else None
        if cnv is not None and cnv.get("hidden") in ("1", "true"):
            return
        ph = _ph(el)
        if ph is not None and self.layer != "slide":
            return                                   # segnaposto vuoti di layout/schema: non si vedono in proiezione
        ch = self.chains(el)
        x = _xfrm(el)
        b = _box(x) if x is not None else None
        b = b or ch["xfrm"]
        if b is None:
            return
        X, Y, Wd, Hd, rot, fh, fv = tf(b)
        sppr = el.find(f"{P}spPr")
        style = el.find(f"{P}style")
        w, h = max(1, round(Wd)), max(1, round(Hd))
        if _local(el) == "pic":
            paint = d.paint(el.find(f"{P}blipFill"), self.cmap, self.part)
        elif el.get("useBgFill") == "1":
            paint = self.bg_paint
        else:
            paint = fill_of(d, sppr, style, self.cmap, self.part, group_fill)
        line = line_of(d, sppr, style, self.cmap)
        geo = geometry(sppr, w, h)
        svg = svg_of(d, geo, paint, line, w, h)
        text = text_of(d, el, self.cmap, ch, "major" if ch.get("is_title") else "minor") if _local(el) == "sp" else None
        if not svg and not text:
            return
        out = {"x": X / d.W, "y": Y / d.H, "w": Wd / d.W, "h": Hd / d.H, "rot": rot}
        if fh or fv:
            out["flip"] = [fh, fv]
        if svg:
            out["svg"] = svg
        sh = _shadow(d, sppr, self.cmap)
        if sh:
            out["fx"] = sh
        if paint and paint["k"] == "img":
            out["img"] = paint["img"]                # vecchio formato: lo usano ancora import e modelli d'innario
        elif paint and paint["k"] == "solid" and paint["c"][3] >= 0.999:
            out["fill"] = css(paint["c"])
        if self.layer != "slide":
            out["m"] = 1
        elif cnv is not None and cnv.get("id"):
            out["id"] = " ".join((cnv.get("id"),) + gids)      # per le animazioni (anche quelle del gruppo)
        if text:
            out["text"] = text
            out["pad"] = [v / d.W if i % 2 == 0 else v / d.H for i, v in enumerate(text["pad"])]
        self.out.append(out)


def _bg(deck, cs, cmap, part):
    bg = cs.find(f"{P}bg") if cs is not None else None
    if bg is None:
        return False, None
    pr, ref = bg.find(f"{P}bgPr"), bg.find(f"{P}bgRef")
    if pr is not None:
        k = next((x for x in pr if _local(x) in ("solidFill", "gradFill", "blipFill", "pattFill", "noFill")), None)
        return True, deck.paint(k, cmap, part) if k is not None else None
    if ref is not None:
        r = deck.style_fill(ref, cmap, deck.fills)
        return True, deck.paint(r[0], cmap, part, r[1]) if r else None
    return False, None


def _transition(sld):
    """Transizione d'ingresso della diapositiva: {t, d (ms), dir}."""
    tr = None
    for el in sld:
        if _local(el) == "transition":
            tr = el
        elif _local(el) == "AlternateContent":
            for alt in el:
                cand = next((k for k in alt if _local(k) == "transition"), None)
                if cand is not None:
                    tr = cand
                    break
    if tr is None:
        return None
    kind = next((k for k in tr if isinstance(k.tag, str) and _local(k) not in ("sndAc", "extLst")), None)
    dur = next((v for k, v in tr.attrib.items() if k.endswith("dur")), None)
    ms = int(dur) if dur and dur.isdigit() else TRANS_SPEED.get(tr.get("spd", "fast"), 500)
    if kind is None:
        return {"t": "cut", "d": 0}
    t = _local(kind)
    out = {"t": t, "d": ms}
    for k in ("dir", "orient"):
        if kind.get(k):
            out[k] = kind.get(k)
    if kind.get("thruBlk") in ("1", "true"):
        out["blk"] = 1
    return out


# ── animazioni (p:timing) ──
def _ctn_delay(ctn):
    c = ctn.find(f"{P}stCondLst/{P}cond") if ctn is not None else None
    d = c.get("delay") if c is not None else None
    return int(d) if d and d.lstrip("-").isdigit() else 0


def _effect(ectn):
    """Un effetto: bersaglio, tipo e parametri, letti dai comportamenti che contiene."""
    beh = [k for k in ectn.find(f"{P}childTnLst") if isinstance(k.tag, str)] if ectn.find(f"{P}childTnLst") is not None else []
    tgt = next((b.find(f".//{P}spTgt") for b in beh if b.find(f".//{P}spTgt") is not None), None)
    if tgt is None:
        return None
    e = {"s": tgt.get("spid"), "c": {"entr": "entr", "exit": "exit", "emph": "emph", "path": "path"}.get(ectn.get("presetClass"), "emph")}
    rg = tgt.find(f"{P}txEl/{P}pRg")
    if rg is not None:
        e["p"] = [_int(rg, "st"), _int(rg, "end")]
    durs = [int(d) for b in beh for c in b.iter(f"{P}cTn") for d in [c.get("dur")] if d and d.isdigit()]
    e["d"] = max(durs) if durs else 500
    tag = lambda n: [b for b in beh if _local(b) == n]
    if tag("animMotion"):
        m = re.findall(r"-?\d*\.?\d+(?:[eE]-?\d+)?", tag("animMotion")[0].get("path", ""))
        e.update(k="path", to=[float(m[-2]), float(m[-1])] if len(m) >= 2 else [0, 0])
        e["c"] = "path"
    elif tag("animEffect"):
        e.update(k="filter", f=tag("animEffect")[0].get("filter", "fade"))
    elif any(b.find(f"{P}cBhvr/{P}attrNameLst/{P}attrName") is not None and b.find(f"{P}cBhvr/{P}attrNameLst/{P}attrName").text in ("ppt_x", "ppt_y") for b in tag("anim")):
        d = ""
        for b in tag("anim"):
            name = b.find(f"{P}cBhvr/{P}attrNameLst/{P}attrName").text
            vals = [v.get("val", "") for v in b.iter(f"{P}strVal")]
            v = (vals[0] if e["c"] == "entr" else vals[-1]) if vals else ""
            if name == "ppt_x" and v.startswith("0-"):
                d += "l"
            elif name == "ppt_x" and v.startswith("1+"):
                d += "r"
            elif name == "ppt_y" and v.startswith("0-"):
                d += "t"
            elif name == "ppt_y" and v.startswith("1+"):
                d += "b"
        e.update(k="fly", dir=d or "b")
    elif tag("animScale"):
        by = tag("animScale")[0].find(f"{P}by")
        e.update(k="scale", by=[_int(by, "x", 100000) / 100000, _int(by, "y", 100000) / 100000] if by is not None else None)
    elif tag("animRot"):
        e.update(k="spin", by=_int(tag("animRot")[0], "by", 21600000) / 60000)
    elif tag("set"):
        e["k"] = "appear"
        e["d"] = 1
    else:
        e["k"] = "pulse"
    return e


def _animations(sld):
    """Sequenza principale: un elenco di passi (uno per clic); "a" = il primo passo
    parte da solo quando arriva la diapositiva. Ogni effetto ha t (ms dall'inizio del passo)."""
    main = next((c for c in sld.iter(f"{P}cTn") if c.get("nodeType") == "mainSeq"), None)
    if main is None or main.find(f"{P}childTnLst") is None:
        return None
    steps, auto = [], False
    for g in main.find(f"{P}childTnLst"):
        gctn = g.find(f"{P}cTn")
        effs = []
        for sub in (gctn.find(f"{P}childTnLst") if gctn is not None and gctn.find(f"{P}childTnLst") is not None else []):
            sctn = sub.find(f"{P}cTn")
            for ep in (sctn.find(f"{P}childTnLst") if sctn is not None and sctn.find(f"{P}childTnLst") is not None else []):
                ectn = ep.find(f"{P}cTn")
                if ectn is None:
                    continue
                e = _effect(ectn)
                if e:
                    e["t"] = _ctn_delay(sctn) + _ctn_delay(ectn)
                    e["n"] = ectn.get("nodeType", "")
                    effs.append(e)
        if not effs:
            continue
        if effs[0]["n"] != "clickEffect":
            if not steps:
                auto = True
            else:                                   # parte da solo dopo il passo prima
                end = max(x["t"] + x["d"] for x in steps[-1])
                for e in effs:
                    e["t"] += end
                steps[-1] += effs
                continue
        steps.append(effs)
    for st in steps:
        for e in st:
            e.pop("n", None)
    return {"a": auto, "st": steps} if steps else None


def describe(path, cache_root):
    """{ratio, slides: [[shape,…]], text: [str], trans: [..]} — cached per file content."""
    st = os.stat(path)
    key = hashlib.md5(f"{os.path.abspath(path)}|{st.st_mtime}|{st.st_size}|{CACHE_VERSION}".encode()).hexdigest()[:20]
    out_dir = os.path.join(cache_root, key)
    jpath = os.path.join(out_dir, "slides.json")
    if os.path.isfile(jpath):
        with open(jpath, encoding="utf-8") as f:
            return json.load(f)
    os.makedirs(out_dir, exist_ok=True)
    if path.lower().endswith(".pdf"):
        data = describe_pdf(path, out_dir, key)
        with open(jpath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        return data
    prs = Presentation(path)
    deck = Deck(prs, out_dir, key)
    slides, texts, trans, anims = [], [], [], []
    ident = lambda b: b
    for slide in prs.slides:
        layout = slide.slide_layout
        master = layout.slide_master
        cmap = dict(deck.master_map)
        for el in (layout.element, slide.element):
            ov = el.find(f"{P}clrMapOvr/{A}overrideClrMapping")
            if ov is not None:
                cmap = dict(ov.attrib)
        # sfondo: della diapositiva, se no del layout, se no dello schema
        bg = None
        for el, part in ((slide.element, slide.part), (layout.element, layout.part), (master.element, master.part)):
            found, bg = _bg(deck, el.find(f"{P}cSld"), cmap, part)
            if found:
                break
        shapes = []
        bsvg = svg_of(deck, [(f"M0 0H{deck.W}V{deck.H}H0Z", True, False)], bg, None, deck.W, deck.H) if bg else ""
        if bsvg:
            b = {"x": 0, "y": 0, "w": 1, "h": 1, "rot": 0, "svg": bsvg, "m": 1}
            if bg["k"] == "img":
                b["img"] = bg["img"]
            elif bg["k"] == "solid":
                b["fill"] = css(bg["c"])
            shapes.append(b)
        show_master = lambda el: el.get("showMasterSp") not in ("0", "false")
        trees = []
        if show_master(slide.element) and show_master(layout.element):
            trees.append(("master", master.element, master.part))
        if show_master(slide.element):
            trees.append(("layout", layout.element, layout.part))
        trees.append(("slide", slide.element, slide.part))
        for layer, el, part in trees:
            w = Walker(deck, part, cmap, layout.element, master.element, master.part, layout.part, layer)
            w.bg_paint = bg
            w.walk(el.find(f"{P}cSld/{P}spTree"), ident)
            shapes += w.out
        slides.append(shapes)
        texts.append("\n".join("\n".join("".join(r["t"] for r in p["runs"]) for p in s["text"]["paras"])
                               for s in shapes if "text" in s and not s.get("m")).strip())
        trans.append(_transition(slide.element))
        anims.append(_animations(slide.element))
    data = {"ratio": deck.W / deck.H, "slides": slides, "text": texts}
    if any(trans):
        data["trans"] = trans
    if any(anims):
        data["anim"] = anims
    with open(jpath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return data


def _pdf_font(name, flags):
    """«ABCDEF+Georgia-BoldItalic» → ("Georgia", grassetto, corsivo)."""
    name = name.split("+")[-1]
    fam, _, style = name.partition("-")
    fam = re.sub(r"(MT|PS|PSMT|Std|Pro)$", "", fam)
    fam = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", fam).replace(",", " ").strip() or "Helvetica"
    low = (style + name).lower()
    return fam, bool(flags & 16) or "bold" in low or "black" in low, bool(flags & 2) or "italic" in low or "oblique" in low


def describe_pdf(path, out_dir, key):
    """Un PDF come diapositive: l'immagine della pagina com'è, più i suoi testi
    (posizione, carattere, dimensione, colore) da poter modificare. I testi non
    toccati restano quelli dell'immagine; per quelli modificati la pagina si
    ridisegna senza quelle scritte (pdf_cut) e sopra va il testo nuovo."""
    import fitz
    slides, texts = [], []
    ratio = 16 / 9
    with fitz.open(path) as doc:
        for n, page in enumerate(doc):
            W, Hp = page.rect.width or 1, page.rect.height or 1
            if n == 0:
                ratio = W / Hp
            z = 1920 / W
            orig = f"p{n:04d}.png"
            page.get_pixmap(matrix=fitz.Matrix(z, z)).save(os.path.join(out_dir, orig))
            shapes = [{"x": 0, "y": 0, "w": 1, "h": 1, "rot": 0, "m": 1, "bgo": 1, "n": n, "img": key + "/" + orig,
                       "svg": f'<svg viewBox="0 0 {W} {Hp}" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><image href="{{IMG}}{key}/{orig}" width="{W}" height="{Hp}" preserveAspectRatio="none"/></svg>'}]
            all_text = []
            for b in page.get_text("dict")["blocks"]:
                if b.get("type") != 0:
                    continue
                paras, base = [], []
                for ln in b["lines"]:
                    runs = []
                    for sp in ln["spans"]:
                        if not sp["text"]:
                            continue
                        fam, bold, ital = _pdf_font(sp["font"], sp["flags"])
                        runs.append({"t": sp["text"], "s": round(sp["size"] / Hp, 5), "f": fam, "b": bold, "i": ital,
                                     "c": "#%06X" % (sp["color"] & 0xFFFFFF)})
                    if runs and "".join(r["t"] for r in runs).strip():
                        paras.append({"a": "left", "runs": runs, "s": max(r["s"] for r in runs)})
                        base.append(ln["bbox"][1])
                if not paras:
                    continue
                x0, y0, x1, y1 = b["bbox"]
                gaps = sorted(b2 - b1 for b1, b2 in zip(base, base[1:]) if b2 > b1)
                if gaps:
                    lh = gaps[len(gaps) // 2] / Hp            # interlinea come nel PDF
                    for p in paras:
                        p["lha"] = round(lh, 5)
                pad = 0.002
                shapes.append({"x": x0 / W - pad, "y": y0 / Hp - pad, "w": (x1 - x0) / W + 2 * pad + 0.01, "h": (y1 - y0) / Hp + 2 * pad, "rot": 0,
                               "pt": 1, "bb": [round(v, 2) for v in b["bbox"]], "pad": [pad, pad, pad, pad],
                               "text": {"anchor": "flex-start", "pad": [0, 0, 0, 0], "nowrap": True, "paras": paras}})
                all_text.append("\n".join("".join(r["t"] for r in p["runs"]) for p in paras))
            slides.append(shapes)
            texts.append("\n".join(all_text).strip())
    return {"ratio": ratio, "slides": slides, "text": texts, "pdf": True}


def pdf_cut(path, n, rects, out_png):
    """La pagina n senza le scritte dei riquadri modificati (foto e disegni restano)."""
    import fitz
    with fitz.open(path) as doc:
        pg = doc[n]
        for r in rects:
            pg.add_redact_annot(fitz.Rect(r), fill=False)
        try:
            pg.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
        except TypeError:
            pg.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
        z = 1920 / (pg.rect.width or 1)
        pg.get_pixmap(matrix=fitz.Matrix(z, z)).save(out_png)


if __name__ == "__main__":   # self-check su un inno di prova
    import sys
    import tempfile
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(__file__)),
                                                             "file test", "pptx nuovi", "003 - Confiderò Sempre.pptx")
    d = describe(src, tempfile.mkdtemp())
    assert d["slides"] and abs(d["ratio"] - 16 / 9) < 0.01
    assert "Confiderò" in d["text"][0]
    first = [s for s in d["slides"][1] if "text" in s][-1]["text"]["paras"][0]["runs"][0]
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
                    if re.match(r"^#[0-9A-Fa-f]{6}$", run.get("c") or ""):
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
