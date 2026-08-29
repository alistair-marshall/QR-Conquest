#!/usr/bin/env python3
"""Draw static/icons/icon.svg - the QR Conquest logo.

The logo is a castle keep whose walls enclose a real QR code: the module
pattern below is the genuine version-2 QR for "QRCONQUEST" at the highest
error-correction level - finder patterns, timing lines, alignment pattern and
all - so the blocks carry the irregular clustering of a real code rather than
a hand-drawn grid. The gate is cut out of it the way a logo is punched out of
a QR code, on module boundaries.

The colours are the game's own purple, a shade either side of the
bg-purple-600 header so the keep still reads against it, with the gold used
for flags elsewhere in the app. Nothing in the drawing relies on
the page behind it, so the logo sits on a light or a dark background equally
well: the keep is mid-purple rather than near-black or near-white, and the
parts that stand clear of it - the pole and the pennant - are purple and
gold rather than white.

    pip install segno && python3 tools/generate-icon.py

The two PNGs beside it are rendered from this SVG rather than drawn again:
put the SVG in a page with `background:#F5F3FF` and `img{height:76vh}` - the
76% keeps the keep inside a maskable icon's safe zone - screenshot it square
at twice the size in any headless browser, and downsample to 512 and 192.
"""

import segno

OUT = "static/icons/icon.svg"

# --- palette -----------------------------------------------------------
KEEP_TOP = "#7E22CE"     # purple-700
KEEP_BOTTOM = "#581C87"  # purple-900
RIM = "#C084FC"          # purple-400
MODULE = "#FAF5FF"       # purple-50, the QR's "dark" modules
GOLD = "#F59E0B"         # amber-500
GOLD_LIGHT = "#FBBF24"   # amber-400
GATE = "#3B0764"         # purple-950

# --- geometry ----------------------------------------------------------
W, H = 448, 600
WALL = 12                      # wall thickness, stroked on the outline
BODY = (24, 176, 424, 576)     # keep: left, top, right, bottom
TURRET_TOP = 96
TURRET_W, TURRET_GAP = 108, 38  # 3 * 108 + 2 * 38 = 400, the keep's width

M = 14                          # QR module size
QR_N = 25                       # version 2 is 25 modules square
QR_X = BODY[0] + WALL / 2 + 19  # 19 leaves the code a quiet zone off the wall
QR_Y = BODY[1] + WALL / 2 + 19

# The gate is five modules wide and runs from row 17 down to the floor.
GATE_COL, GATE_COLS, GATE_ROW = 10, 5, 17
GATE_X = QR_X + GATE_COL * M
GATE_W = GATE_COLS * M
GATE_Y = QR_Y + GATE_ROW * M
GATE_BOTTOM = BODY[3] - WALL / 2


def num(v):
    """Trim trailing zeros so the file reads as coordinates, not floats."""
    return f"{v:g}"


def rect(x, y, w, h, fill, extra=""):
    return (f'<rect x="{num(x)}" y="{num(y)}" width="{num(w)}" '
            f'height="{num(h)}" fill="{fill}"{extra}/>')


def keep_outline():
    """The keep: three square turrets over a square body, one closed path."""
    left, top, right, bottom = BODY
    t1 = left + TURRET_W
    t2 = t1 + TURRET_GAP
    t3 = t2 + TURRET_W
    t4 = t3 + TURRET_GAP
    return (f"M {num(left)},{num(TURRET_TOP)} H {num(t1)} V {num(top)} "
            f"H {num(t2)} V {num(TURRET_TOP)} H {num(t3)} V {num(top)} "
            f"H {num(t4)} V {num(TURRET_TOP)} H {num(right)} "
            f"V {num(bottom)} H {num(left)} Z")


def finder(row, col):
    """A QR finder pattern: a one-module ring with a solid core."""
    x, y = QR_X + col * M, QR_Y + row * M
    ring = (f'<rect x="{num(x + M / 2)}" y="{num(y + M / 2)}" '
            f'width="{num(6 * M)}" height="{num(6 * M)}" fill="none" '
            f'stroke="{MODULE}" stroke-width="{num(M)}"/>')
    core = rect(x + 2 * M, y + 2 * M, 3 * M, 3 * M, GOLD_LIGHT)
    return ring + "\n    " + core


ALIGN = 18  # version 2 puts its alignment pattern's centre at (18, 18)


def in_align(row, col):
    return abs(row - ALIGN) <= 2 and abs(col - ALIGN) <= 2


def alignment():
    """The 5x5 alignment pattern, with its centre picked out like the finders."""
    x, y = QR_X + (ALIGN - 2) * M, QR_Y + (ALIGN - 2) * M
    ring = (f'<rect x="{num(x + M / 2)}" y="{num(y + M / 2)}" '
            f'width="{num(4 * M)}" height="{num(4 * M)}" fill="none" '
            f'stroke="{MODULE}" stroke-width="{num(M)}"/>')
    return ring + "\n    " + rect(x + 2 * M, y + 2 * M, M, M, GOLD_LIGHT)


def in_finder(row, col):
    return ((row < 7 and col < 7)
            or (row < 7 and col >= QR_N - 7)
            or (row >= QR_N - 7 and col < 7))


def over_gate(row, col):
    """Modules the gate displaces, plus the ring of them around it."""
    return (GATE_COL - 1 <= col <= GATE_COL + GATE_COLS
            and row >= GATE_ROW - 1)


def modules():
    qr = segno.make("QRCONQUEST", error="h", micro=False, version=2)
    matrix = [[int(c) for c in row] for row in qr.matrix]
    assert len(matrix) == QR_N, len(matrix)
    out = []
    for row, cells in enumerate(matrix):
        for col, on in enumerate(cells):
            if (not on or in_finder(row, col) or in_align(row, col)
                    or over_gate(row, col)):
                continue
            out.append(rect(QR_X + col * M, QR_Y + row * M, M, M, MODULE))
    return out


def gate():
    """An arched doorway, punched out of the code and standing on the floor."""
    r = GATE_W / 2
    cx = GATE_X + r
    arch = (f"M {num(GATE_X)},{num(GATE_BOTTOM)} V {num(GATE_Y + r)} "
            f"A {num(r)},{num(r)} 0 0 1 {num(GATE_X + GATE_W)},{num(GATE_Y + r)} "
            f"V {num(GATE_BOTTOM)} Z")
    bars = []
    for i in (1, 2, 3):
        x = GATE_X + i * GATE_W / 4
        top = GATE_Y + r - (r ** 2 - (x - cx) ** 2) ** 0.5
        bars.append(f'<line x1="{num(x)}" y1="{num(top + 6)}" x2="{num(x)}" '
                    f'y2="{num(GATE_BOTTOM)}" stroke="{GOLD}" '
                    f'stroke-width="3.5" opacity="0.7"/>')
    return (f'<path d="{arch}" fill="{GATE}" stroke="{MODULE}" '
            f'stroke-width="5" stroke-linejoin="round"/>\n    '
            + "\n    ".join(bars))


def windows():
    """A lit slit in each of the outer turrets."""
    out = []
    for i in (0, 2):
        cx = BODY[0] + i * (TURRET_W + TURRET_GAP) + TURRET_W / 2
        out.append(f'<path d="M {num(cx - 8)},{num(BODY[1] - 14)} '
                   f'V {num(TURRET_TOP + 36)} '
                   f'A 8,8 0 0 1 {num(cx + 8)},{num(TURRET_TOP + 36)} '
                   f'V {num(BODY[1] - 14)} Z" fill="{GOLD_LIGHT}"/>')
    return out


def flag():
    """Pole and pennant, drawn behind the keep so the pole rises out of it."""
    cx = (BODY[0] + BODY[2]) / 2
    return "\n    ".join([
        f'<rect x="{num(cx - 6)}" y="30" width="12" height="{num(BODY[1] - 30)}"'
        f' rx="6" fill="{RIM}"/>',
        f'<path d="M {num(cx + 4)},34 L {num(cx + 104)},62 '
        f'L {num(cx + 4)},90 Z" fill="{GOLD}"/>',
        f'<circle cx="{num(cx + 40)}" cy="62" r="11" fill="{KEEP_BOTTOM}"/>',
    ])


def build():
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"
     width="100%" height="100%" role="img"
     aria-label="QR Conquest: a castle keep built from a QR code">
  <defs>
    <linearGradient id="keep" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{KEEP_TOP}"/>
      <stop offset="1" stop-color="{KEEP_BOTTOM}"/>
    </linearGradient>
  </defs>

  <!-- Flag, behind the keep so the pole appears to rise from the turret -->
  <g id="flag">
    {flag()}
  </g>

  <!-- The keep itself -->
  <path d="{keep_outline()}" fill="url(#keep)" stroke="{RIM}"
        stroke-width="{WALL}" stroke-linejoin="miter"/>

  <!-- Turret windows -->
  <g id="windows">
    {chr(10).join('    ' + w for w in windows()).strip()}
  </g>

  <!-- The genuine version-2 QR code for "QRCONQUEST", error correction H -->
  <g id="qr">
    {finder(0, 0)}
    {finder(0, QR_N - 7)}
    {finder(QR_N - 7, 0)}
    {alignment()}
{chr(10).join('    ' + m for m in modules())}
  </g>

  <!-- Gatehouse, cut out of the code on module boundaries -->
  <g id="gate">
    {gate()}
  </g>
</svg>
"""


if __name__ == "__main__":
    with open(OUT, "w") as fh:
        fh.write(build())
    print(f"wrote {OUT}")
