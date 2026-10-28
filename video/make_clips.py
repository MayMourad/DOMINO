"""Turns the recorded takes into (1) full-length MP4s and (2) exact 5.000-second clips for the edit.
Cuts are computed from the event markers written by record.mjs (footage/<kind>/marks.json)."""
import json
import subprocess
import sys
from pathlib import Path
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
root = Path(__file__).resolve().parent / "footage"
kind = sys.argv[1] if len(sys.argv) > 1 else "raw"
src = root / kind
m = json.loads((src / "marks.json").read_text())
full = root / f"{kind}_mp4_full"
five = root / f"{kind}_clips_5s"
full.mkdir(exist_ok=True)
five.mkdir(exist_ok=True)
TARGET = 5.0


def dur(path):
    out = subprocess.run([FF, "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    import re
    d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out)
    return int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3))


# recipe: list of (start, end, speed) in take time; the LAST segment's end is adjusted so the clip is exactly 5.000 s
R = {
    "c06_launch": [(1.0, 6.0, 1)],
    "c07_network": [(m["c07.click"] - 2.3, m["c07.click"] + 2.7, 1)],
    "c08_studio": [(m["c08.typeStart"] - 0.3, m["c08.typeEnd"] + 0.1, 2.0), (m["c08.typeEnd"] + 0.1, m["c08.interpretClick"] + 0.1, 1.6),
                   (m["c08.interpretClick"] + 0.1, m["c08.reviewVisible"], max(5.0, (m["c08.reviewVisible"] - m["c08.interpretClick"] - 0.1) / 0.6)), (m["c08.reviewVisible"], m["c08.confirmClick"] + 2.0, 2.0)],
    "c09_cascade": [(m["c09.replayClick"] - 0.6, m["c09.replayClick"] + 4.4, 1)],
    "c10_yusuf": [(m["c10.click"] - 0.9, m["c10.click"] + 1.1, 1)],
    "c12_recovery": [(m["c12.verified"] - 1.2, m["c12.verified"] + 3.8, 1)],
    "c14_verify": [(0.3, 5.3, 1)],
    "c15_approval": [(m["c15.dialogOpen"] - 0.2, m["c15.ticksDone"] + 0.4, 1.0)],  # window is sped up to fit 5 s
    "c16_futures": [(0.2, m["c16.resultVisible"] + 1.4, 1)],  # starts on the question, ends just after the recalculated result appears
    "c17_partial": [(0.9, 5.9, 1)],
    "c19_eval": [(m["c19.runClick"] - 0.9, m["c19.runClick"] + 0.5, 1.0), (m["c19.runClick"] + 0.5, m["c19.resultVisible"] - 0.3, max(5.0, (m["c19.resultVisible"] - m["c19.runClick"] - 0.8) / 0.9)),
                 (m["c19.resultVisible"] - 0.3, m["c19.resultVisible"] + 4.0, 1.0)],
}


def fit(segs, total):
    """Scale the last segment's end so the output length is exactly `total` seconds."""
    if len(segs) == 1:  # one window: play it at whatever speed makes it exactly `total` seconds long
        s, e, _ = segs[0]
        return [(s, e, (e - s) / total)]
    done = sum((e - s) / sp for s, e, sp in segs[:-1])
    s, e, sp = segs[-1]
    return segs[:-1] + [(s, s + (total - done) * sp, sp)]


for f in sorted(src.glob("*.webm")):
    name = f.stem
    mp4 = full / f"{name}.mp4"
    subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", str(f), "-r", "60", "-c:v", "libx264", "-crf", "15", "-preset", "medium",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(mp4)], check=True)
    T = 2.0 if name == "c10_yusuf" else TARGET  # clip 10 uses only 2 s of real footage (the first 3 s are an AI scene)
    segs = fit(R[name], T)
    length = dur(f)
    if max(e for _, e, _ in segs) > length - 0.05:
        shift = max(e for _, e, _ in segs) - (length - 0.05)
        segs = [(max(0, s - shift), e - shift, sp) for s, e, sp in segs]  # keep inside the take
        print(f"  note: {name} cut shifted {shift:.2f}s earlier to stay inside the take ({length:.1f}s)")
    parts, labels = [], []
    for i, (s, e, sp) in enumerate(segs):
        parts.append(f"[0:v]trim=start={s:.3f}:end={e:.3f},setpts=(PTS-STARTPTS)/{sp},fps=60[v{i}]")
        labels.append(f"[v{i}]")
    graph = ";".join(parts) + f";{''.join(labels)}concat=n={len(segs)}:v=1:a=0[out]"
    out = five / f"{name}_{int(T)}s.mp4"
    subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", str(f), "-filter_complex", graph, "-map", "[out]", "-t", f"{T:.3f}",
                    "-c:v", "libx264", "-crf", "15", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(out)], check=True)
    print(f"{name:14s} take {length:5.1f}s -> {out.name} ({dur(out):.3f}s)  segments: " + ", ".join(f"{s:.1f}-{e:.1f}@x{sp:g}" for s, e, sp in segs))
