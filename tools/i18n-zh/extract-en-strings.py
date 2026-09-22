"""Extract candidate user-facing string literals from the web/ modules.

Writes _strings.txt at the repo root so the translation sweep can be reviewed
for leftovers (comments and CSS class names show up too; ignore those).
"""
import re
import sys
import os

WEB = os.path.abspath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "web"))
FILES = ["app.js", "orient.js", "planes.js", "inside.js", "prop.js", "draw.js",
         "overhangs.js", "fins.js", "stl.js", "threemf.js", "zip.js", "finworker.js"]

PAT = re.compile(r"""(?<![A-Za-z0-9_$])(['"])((?:[^'"\\]|\\.)*?)\1""")
WORD = re.compile(r"[A-Za-z]{3,}")

out = []
for f in FILES:
    path = os.path.join(WEB, f)
    if not os.path.exists(path):
        continue
    s = open(path, encoding="utf-8").read()
    hits = []
    for m in PAT.finditer(s):
        t = m.group(2)
        if not WORD.search(t):
            continue
        line = s.count("\n", 0, m.start()) + 1
        hits.append((line, t))
    out.append("=" * 12 + f" {f} {len(hits)}")
    for line, t in hits:
        out.append(f"{line} | {t}")

text = "\n".join(out)
open(os.path.join(WEB, "..", "_strings.txt"), "w", encoding="utf-8").write(text)
print(text.count("\n") + 1, "lines written")
