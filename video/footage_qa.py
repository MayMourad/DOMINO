"""Probes every take (duration, fps, size) and writes a contact sheet (1 frame per second) to footage/qa/."""
import re
import subprocess
import sys
from pathlib import Path
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
root = Path(__file__).resolve().parent / "footage"
kind = sys.argv[1] if len(sys.argv) > 1 else "raw"
qa = root / "qa" / kind
qa.mkdir(parents=True, exist_ok=True)
for f in sorted((root / kind).glob("*.webm")):
    info = subprocess.run([FF, "-hide_banner", "-i", str(f)], capture_output=True, text=True).stderr
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
    secs = int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3)) if dur else 0
    fps = re.search(r"([\d.]+) fps", info)
    size = re.search(r"(\d{3,4}x\d{3,4})", info)
    # count frames actually stored
    n = subprocess.run([FF, "-hide_banner", "-i", str(f), "-map", "0:v:0", "-c", "copy", "-f", "null", "-"], capture_output=True, text=True).stderr
    fr = re.findall(r"frame=\s*(\d+)", n)
    print(f"{f.stem:16s} {secs:5.1f}s  {size.group(1) if size else '?'}  nominal {fps.group(1) if fps else '?'} fps  frames={fr[-1] if fr else '?'}")
    cols = 5
    rows = max(1, -(-int(secs) // cols))
    subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", str(f), "-vf", f"fps=1,scale=384:-1,tile={cols}x{rows}", "-frames:v", "1", str(qa / (f.stem + ".jpg"))])
