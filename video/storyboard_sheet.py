"""One storyboard image of all 24 clips: real frames where footage exists, labelled cards for the AI scenes still to generate."""
import glob
import re
import subprocess
import sys
from pathlib import Path
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

FF = imageio_ffmpeg.get_ffmpeg_exe()
root = Path(__file__).resolve().parent
ed = root / "footage" / "for_editor"
sys.path.insert(0, str(root))
titles = {1: "Villa, afternoon", 2: "Kitchen: four routines", 3: "Amina's phone buzzes", 4: "Dominoes fall", 5: "One cancelled slot", 6: "Launch screen", 7: "Family Network", 8: "Disruption Studio",
          9: "Cascade Laboratory", 10: "Yusuf at risk", 11: "56 candidates", 12: "Recovery Studio", 13: "School-gate pickup", 14: "Independent verifier", 15: "Human approval", 16: "What if...?",
          17: "Honest partial plan", 18: "Family decides", 19: "51 cases, 46 pass", 20: "Four steps", 21: "Family dinner", 22: "Team credits", 23: "Tagline", 24: "End card + QR"}
ai = {1, 2, 3, 4, 13, 18, 21}
TW, TH, CAP, GAP = 480, 270, 54, 16
font = ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", 22)
small = ImageFont.truetype("C:/Windows/Fonts/calibri.ttf", 19)
cols, rows = 4, 6
W = cols * TW + (cols + 1) * GAP
H = rows * (TH + CAP) + (rows + 1) * GAP
sheet = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(sheet)
tmp = root / "footage" / "qa" / "storyboard"
tmp.mkdir(parents=True, exist_ok=True)
for n in range(1, 25):
    x = GAP + ((n - 1) % cols) * (TW + GAP)
    y = GAP + ((n - 1) // cols) * (TH + CAP + GAP)
    files = sorted(glob.glob(str(ed / f"clip{n:02d}_*with-text.mp4"))) or sorted(glob.glob(str(ed / f"clip{n:02d}_*.mp4")))
    if n == 10:
        kind = "AI scene 3 s + real 2 s"
    elif n in ai:
        kind = "AI scene (to generate)"
    elif "with-text" in (files[0] if files else ""):
        kind = "real footage"
    else:
        kind = "motion graphic (done)"
    if files and n not in ai:
        out = tmp / f"{n}.png"
        subprocess.run([FF, "-y", "-loglevel", "error", "-ss", "2.2" if n != 10 else "1.2", "-i", files[0], "-frames:v", "1", "-vf", f"scale={TW}:{TH}", str(out)], check=True)
        sheet.paste(Image.open(out), (x, y))
    else:
        d.rectangle([x, y, x + TW, y + TH], fill=(16, 43, 78))
        d.rectangle([x + 10, y + 10, x + TW - 10, y + TH - 10], outline=(130, 178, 214), width=2)
        d.text((x + TW // 2, y + TH // 2 - 14), "AI scene", font=ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", 40), fill=(234, 243, 250), anchor="mm")
        d.text((x + TW // 2, y + TH // 2 + 28), "generate from prompt" if n != 10 else "first 3 s, then real node", font=small, fill=(130, 178, 214), anchor="mm")
    t0 = (n - 1) * 5
    d.text((x, y + TH + 6), f"{n:02d}  {t0 // 60}:{t0 % 60:02d}  {titles[n]}", font=font, fill=(16, 43, 78))
    d.text((x, y + TH + 30), kind, font=small, fill=(74, 89, 104))
sheet.save(root / "storyboard_all_24_clips.png")
print(sheet.size)
