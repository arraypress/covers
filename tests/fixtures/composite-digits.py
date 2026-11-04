# Builds tests/fixtures/composite-digits.woff2: digits and "/" are composite
# glyphs placed after 120 dense filler glyphs, so the glyf table WOFF2
# decoders rebuild passes the 128 KB a short loca can address.
# Run with fontTools and brotli: python3 composite-digits.py out.woff2
import math, sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent

def poly(n, r, cx=300, cy=350, wobble=0):
    pen = TTGlyphPen(None)
    for k in range(n):
        a = 2 * math.pi * k / n
        rr = r + (wobble * ((k * 7919) % 13 - 6))
        pt = (round(cx + rr * math.cos(a)), round(cy + rr * math.sin(a)))
        (pen.moveTo if k == 0 else pen.lineTo)(pt)
    pen.closePath()
    return pen.glyph()

def bar(x0, y0, x1, y1):
    pen = TTGlyphPen(None)
    pen.moveTo((x0, y0)); pen.lineTo((x1, y0)); pen.lineTo((x1, y1)); pen.lineTo((x0, y1)); pen.closePath()
    return pen.glyph()

def comp(*parts):
    g = Glyph(); g.numberOfContours = -1; g.components = []
    for name, dx, dy in parts:
        c = GlyphComponent(); c.glyphName = name; c.x = dx; c.y = dy; c.flags = 0x0004
        g.components.append(c)
    return g

fillers = [f'f{i:03d}' for i in range(120)]
digits = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
order = ['.notdef', 'A', 'ring', 'bar'] + fillers + digits + ['slash']
glyphs = {'.notdef': bar(50, 0, 550, 700), 'A': bar(100, 0, 500, 700), 'ring': poly(48, 250), 'bar': bar(275, 0, 325, 700)}
for i, f in enumerate(fillers): glyphs[f] = poly(400, 200 + i, wobble=3)
glyphs['zero'] = comp(('ring', 0, 0))
glyphs['one'] = comp(('bar', 0, 0))
for d, name in enumerate(digits[2:], 2): glyphs[name] = comp(('ring', 0, 0), ('bar', 40 * d - 200, 0))
glyphs['slash'] = comp(('bar', 0, 0))
fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder(order)
cmap = {ord('A'): 'A', ord('/'): 'slash'}
cmap.update({ord(str(d)): n for d, n in enumerate(digits)})
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics({n: (600, 0) for n in order})
fb.setupHorizontalHeader(ascent=800, descent=-200)
fb.setupNameTable({'familyName': 'Composite Digits', 'styleName': 'Regular'})
fb.setupOS2(sTypoAscender=800, usWinAscent=800, usWinDescent=200)
fb.setupPost()
fb.font['head'].indexToLocFormat = 0
fb.font.flavor = 'woff2'
fb.save(sys.argv[1])
