"""Crops the two real screenshots used in Figure 2 (impact graph and recovered graph) from presentation/assets."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
assets = root.parent / "presentation" / "assets"
out = root / "figs"
out.mkdir(exist_ok=True)

# cascade.jpg is 2304x1450; graph canvas content spans roughly x 70-1485, y 320-805 in original pixels
c = Image.open(assets / "cascade.jpg").convert("RGB").crop((60, 300, 1295, 820))
c.save(out / "fig2a_impact.png")
r = Image.open(assets / "rec_graph.jpg").convert("RGB").crop((0, 0, 1250, 500))
r.save(out / "fig2b_recovered.png")
Image.open(assets / "fut.jpg").convert("RGB").crop((0, 0, 2400, 690)).save(out / "fig4_futures.png")
print(c.size, r.size)
