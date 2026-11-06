"""Controlli rapidi (python3 webapp/test_fixes.py): sfondi dal tema, più schemi,
stile dei nuovi inni, dimensione per diapositiva, riferimenti in altra lingua."""
import io
import os
import re
import shutil
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [ROOT, os.path.join(ROOT, "webapp")]
from pptx import Presentation  # noqa: E402
from pptx.util import Pt  # noqa: E402

import pptx_render as PR  # noqa: E402
from core import bible_ref  # noqa: E402

PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000" "1f15c4890000000d49444154789c6360f8cfc0000003010100c9fe92ef0000000049454e44ae426082")
tmp = tempfile.mkdtemp()


def rewrite(path, fn):
    """Riscrive le parti del file: fn(nome, byte) -> byte; fn.extra = parti da aggiungere."""
    out = io.BytesIO()
    with zipfile.ZipFile(path) as z, zipfile.ZipFile(out, "w") as o:
        for n in z.namelist():
            o.writestr(n, fn(n, z.read(n)))
        for n, b in getattr(fn, "extra", {}).items():
            o.writestr(n, b)
    with open(path, "wb") as f:
        f.write(out.getvalue())


def theme_picture_background():
    """Sfondo dello schema che rimanda a un'immagine dentro il tema."""
    path = os.path.join(tmp, "theme.pptx")
    prs = Presentation()
    prs.slides.add_slide(prs.slide_layouts[6])
    prs.save(path)

    def fn(n, b):
        if n == "[Content_Types].xml" and b'Extension="png"' not in b:
            return b.replace(b"<Default ", b'<Default Extension="png" ContentType="image/png"/><Default ', 1)
        if n == "ppt/theme/theme1.xml":
            return re.sub(rb"(<a:bgFillStyleLst>)", rb'\1<a:blipFill><a:blip r:embed="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>', b, 1)
        if n == "ppt/slideMasters/slideMaster1.xml":
            return re.sub(rb"<p:bg>.*?</p:bg>", b'<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>', b, 1, re.S)
        return b
    fn.extra = {"ppt/media/sfondo.png": PNG, "ppt/theme/_rels/theme1.xml.rels":
                b'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/sfondo.png"/></Relationships>'}
    rewrite(path, fn)
    first = PR.describe(path, os.path.join(tmp, "c"))["slides"][0][0]
    assert "img" in first and first["w"] == 1, first


def hymnal_style_ignores_hidden_master_white():
    """Inno d'esempio: schema bianco nascosto da un rettangolo nero (com'è nei veri innari)."""
    folder = os.path.join(tmp, "innario")
    os.makedirs(folder)
    prs = Presentation()
    for text in ("Titolo", "Strofa"):
        s = prs.slides.add_slide(prs.slide_layouts[6])
        r = s.shapes.add_shape(1, 0, 0, prs.slide_width, prs.slide_height)
        r.fill.solid()
        from pptx.dml.color import RGBColor
        r.fill.fore_color.rgb = RGBColor(0, 0, 0)
        tb = s.shapes.add_textbox(0, 0, prs.slide_width, prs.slide_height)
        run = tb.text_frame.paragraphs[0].add_run()
        run.text, run.font.size = text, Pt(40)
        run.font.color.rgb = RGBColor(255, 255, 255)
    prs.save(os.path.join(folder, "001 - Prova.pptx"))
    tpl = PR.derive_template(folder, os.path.join(tmp, "c"))
    assert tpl["fill"] == "#000000" and tpl["color"] == "#FFFFFF", tpl
    dest = os.path.join(tmp, "nuovo.pptx")
    PR.build_pptx(dest, "Nuovo", ["Prima strofa", "Seconda strofa"], tpl)
    for sl in PR.describe(dest, os.path.join(tmp, "c"))["slides"][1:]:
        cover = [x for x in sl if not x.get("m") and x.get("fill") and x["w"] > .9]
        assert cover and cover[-1]["fill"] == "#000000", sl


def size_per_slide():
    src, out = os.path.join(tmp, "s.pptx"), os.path.join(tmp, "s2.pptx")
    prs = Presentation()
    for _ in range(2):
        tb = prs.slides.add_slide(prs.slide_layouts[6]).shapes.add_textbox(0, 0, 9000000, 3000000)
        run = tb.text_frame.paragraphs[0].add_run()
        run.text, run.font.size = "Testo", Pt(40)
    prs.save(src)
    PR.apply_edits(src, out, {"scale": 1, "scales": {"1": 1.5}, "texts": {}})
    sizes = [sl.shapes[0].text_frame.paragraphs[0].runs[0].font.size.pt for sl in Presentation(out).slides]
    assert sizes == [40, 60], sizes


def refs_in_another_language():
    books = [(51, "Colossesi")]
    all_langs = [(51, "Coloseni"), (51, "Colosenses")] + books
    assert not bible_ref.parse_references(["Colossesi 1:1-6"], [(51, "Coloseni")])[0]["resolved"]
    r = bible_ref.parse_references(["Colossesi 1:1-6"], all_langs)[0]
    assert r["resolved"] and r["book"] == 51 and r["verses"] == [1, 2, 3, 4, 5, 6], r


if __name__ == "__main__":
    try:
        for t in (theme_picture_background, hymnal_style_ignores_hidden_master_white, size_per_slide, refs_in_another_language):
            t()
            print("ok", t.__name__)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
