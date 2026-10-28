import fitz, sys, os
d = fitz.open("DOMINO_Presentation.pdf")
os.makedirs("render", exist_ok=True)
print("pages", len(d))
for i, p in enumerate(d, 1):
    p.get_pixmap(dpi=100).save(f"render/s{i:02d}.png")
