"""One contact sheet with 5 frames (one per second) of every 5-second clip, for QA."""
import subprocess, sys
from pathlib import Path
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
root = Path(__file__).resolve().parent / "footage"
kind = sys.argv[1] if len(sys.argv) > 1 else "raw"
files = sorted((root / f"{kind}_clips_5s").glob("*.mp4"))
tmp = root / "qa" / kind
tmp.mkdir(parents=True, exist_ok=True)
rows = []
for f in files:
    out = tmp / f"{f.stem}_strip.png"
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(f), "-vf", "fps=1,scale=320:-1,tile=5x1", "-frames:v", "1", str(out)], check=True)
    rows.append(out)
from PIL import Image, ImageDraw
ims = [Image.open(r) for r in rows]
W = max(i.width for i in ims); Hh = sum(i.height + 16 for i in ims)
sheet = Image.new("RGB", (W, Hh), "white"); y = 0; d = ImageDraw.Draw(sheet)
for f, im in zip(files, ims):
    d.text((4, y + 2), f.stem, fill=(16, 43, 78)); sheet.paste(im, (0, y + 14)); y += im.height + 16
sheet.save(tmp / "all_clips_sheet.png"); print(sheet.size)
