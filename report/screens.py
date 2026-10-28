"""Builds Figure 4 (the prototype's screens) from the real screenshots in presentation/shots (cropped, not altered)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
shots = root.parent / "presentation" / "shots"
TW, TH, LAB, GAP = 640, 440, 54, 22
items = [
    ("1  Launch", "01_launch_viewport"),
    ("2  Family Network", "02_network_overview"),
    ("3  Disruption Studio", "03_studio_confirmed"),
    ("4  Cascade Laboratory", "04_cascade_top"),
    ("5  Recovery Studio", "05_recovery_main"),
    ("6  Futures Laboratory", "07_futures_compare"),
    ("7  Evaluation Lab", "10_eval_overview"),
    ("Approval (simulation only)", "09_approval"),
]
font = ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", 30)
cols, rows = 4, 2
W = cols * TW + (cols + 1) * GAP
H = rows * (TH + LAB) + (rows + 1) * GAP
sheet = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(sheet)
for i, (label, name) in enumerate(items):
    im = Image.open(shots / f"{name}.png").convert("RGB")
    # crop the top part with the target aspect ratio, then scale
    h = int(im.width * TH / TW)
    im = im.crop((0, 0, im.width, min(h, im.height))).resize((TW, int(min(h, im.height) * TW / im.width)), Image.LANCZOS)
    x = GAP + (i % cols) * (TW + GAP)
    y = GAP + (i // cols) * (TH + LAB + GAP)
    d.rectangle([x - 2, y - 2, x + TW + 1, y + im.height + 1], outline=(185, 203, 219), width=2)
    sheet.paste(im, (x, y))
    d.text((x, y + TH + 10), label, font=font, fill=(16, 43, 78))
sheet.save(root / "figs" / "fig_screens.png")
print(sheet.size)
