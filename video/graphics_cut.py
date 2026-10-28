"""Cuts the rendered graphic clips to exactly 5.000 s MP4 (1080p, 60 fps) and writes a QA sheet."""
import subprocess
import sys
from pathlib import Path
import imageio_ffmpeg
from PIL import Image

FF = imageio_ffmpeg.get_ffmpeg_exe()
g = Path(__file__).resolve().parent / "footage" / "graphics"
five = Path(__file__).resolve().parent / "footage" / "graphics_clips_5s"
five.mkdir(exist_ok=True)
names = sys.argv[1:] or ["c05_planner", "c11_solver", "c20_steps", "c22_credits", "c23_tagline", "c24_endcard"]
frames = []
for n in names:
    out = five / f"{n}_5s.mp4"
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(g / f"{n}.webm"), "-ss", "0.1", "-t", "5.0", "-r", "60", "-c:v", "libx264", "-crf", "15", "-preset", "medium",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(out)], check=True)
    for t in (0.9, 2.4, 4.2):
        p = g / f"{n}_{t}.png"
        subprocess.run([FF, "-y", "-loglevel", "error", "-ss", str(t), "-i", str(out), "-frames:v", "1", "-vf", "scale=640:-1", str(p)], check=True)
        frames.append(Image.open(p))
w, h = frames[0].size
sheet = Image.new("RGB", (w * 3, h * (len(frames) // 3)))
for i, im in enumerate(frames):
    sheet.paste(im, ((i % 3) * w, (i // 3) * h))
sheet.save(Path(__file__).resolve().parent / "footage" / "qa" / "graphics_new_sheet.png")
print(sheet.size)
