"""Renders the exported report PDF to PNG pages for visual QA (not committed)."""
import sys
from pathlib import Path
import fitz

root = Path(__file__).resolve().parent / "render"
pdf = root / "DOMINO_Technical_Report.pdf"
doc = fitz.open(pdf)
print("pages", len(doc))
for i, page in enumerate(doc, 1):
    page.get_pixmap(dpi=int(sys.argv[1]) if len(sys.argv) > 1 else 90).save(root / f"p{i}.png")
