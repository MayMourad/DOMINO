import sys
from pathlib import Path
import pymupdf
root = Path(__file__).resolve().parent / "render"
doc = pymupdf.open(root / "DOMINO_Video_Production_Pack.pdf")
print("pages", len(doc))
for i, page in enumerate(doc, 1):
    page.get_pixmap(dpi=int(sys.argv[1]) if len(sys.argv) > 1 else 80).save(root / f"p{i}.png")
