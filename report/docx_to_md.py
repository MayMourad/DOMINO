"""Converts the technical report .docx into Markdown (headings, paragraphs, bullets, tables, figure captions) so it can be pasted as text."""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
src = Path(sys.argv[1])
root = ET.fromstring(zipfile.ZipFile(src).read("word/document.xml"))
body = root.find(W + "body")


def runs_md(p):
    out = []
    for node in p.iter():
        if node.tag == W + "r":
            t = "".join(x.text or "" for x in node.findall(W + "t"))
            if not t:
                continue
            rpr = node.find(W + "rPr")
            bold = rpr is not None and rpr.find(W + "b") is not None
            ital = rpr is not None and rpr.find(W + "i") is not None
            mono = rpr is not None and rpr.find(W + "rFonts") is not None and (rpr.find(W + "rFonts").get(W + "ascii") or "").startswith("Consolas")
            if mono:
                t = f"`{t}`"
            elif bold and t.strip():
                t = f"**{t.strip()}** "
            elif ital and t.strip():
                t = f"*{t.strip()}* "
            out.append(t)
    s = "".join(out)
    s = re.sub(r"\*\* \*\*", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def para_md(p):
    ppr = p.find(W + "pPr")
    style = None
    num = False
    if ppr is not None:
        st = ppr.find(W + "pStyle")
        style = st.get(W + "val") if st is not None else None
        num = ppr.find(W + "numPr") is not None
    text = runs_md(p)
    has_img = p.find(".//" + "{http://schemas.openxmlformats.org/drawingml/2006/main}blip") is not None
    if has_img and not text:
        return "*[figure image]*"
    if not text:
        return ""
    if style == "Heading1":
        return "\n## " + text
    if style == "Heading2":
        return "\n### " + text
    if num:
        return "- " + text
    return text


lines = []
for el in body:
    if el.tag == W + "p":
        lines.append(para_md(el))
    elif el.tag == W + "tbl":
        rows = []
        for tr in el.findall(W + "tr"):
            cells = []
            for tc in tr.findall(W + "tc"):
                cells.append(" ".join(para_md(p) for p in tc.findall(W + "p")).replace("|", "/").strip())
            rows.append(cells)
        if not rows:
            continue
        n = max(len(r) for r in rows)
        lines.append("")
        if n == 1:  # abstract box
            lines.append("> " + rows[0][0])
        else:
            lines.append("| " + " | ".join(rows[0]) + " |")
            lines.append("|" + "---|" * n)
            for r in rows[1:]:
                lines.append("| " + " | ".join(r + [""] * (n - len(r))) + " |")
        lines.append("")
md = "\n".join(lines)
md = re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"
out = Path(sys.argv[2])
out.write_text(md, encoding="utf-8")
print(len(md.split()), "words")
