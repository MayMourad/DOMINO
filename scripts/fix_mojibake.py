"""Repairs UTF-8 text that was mis-decoded as Windows-1252 (for example 'â€”' that should be an em dash).
Usage: python scripts/fix_mojibake.py README.md [more files]   (rewrites in place, prints what changed)"""
import re
import sys
from pathlib import Path

RUN = re.compile(r"[ÂÃâ][\u0080-ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]+")


def to_bytes(chunk: str) -> bytes:
    out = bytearray()
    for ch in chunk:
        out += ch.encode("latin-1") if ord(ch) < 256 else ch.encode("cp1252")
    return bytes(out)


def repair(m: re.Match) -> str:
    s = m.group(0)
    # the run may swallow trailing normal characters; try the longest decodable prefix
    for end in range(len(s), 1, -1):
        try:
            return to_bytes(s[:end]).decode("utf-8") + s[end:]
        except (UnicodeDecodeError, UnicodeEncodeError):
            continue
    return s


for name in sys.argv[1:]:
    p = Path(name)
    text = p.read_text(encoding="utf-8")
    fixed = RUN.sub(repair, text)
    changes = sum(1 for a, b in zip(RUN.findall(text), RUN.findall(text)) if a)
    p.write_text(fixed, encoding="utf-8", newline="\n")
    print(f"{name}: {changes} sequences repaired; remaining suspicious runs: {len(RUN.findall(fixed))}")
