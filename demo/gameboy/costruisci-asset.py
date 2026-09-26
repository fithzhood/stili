# Riduce i fogli di Ninja Adventure (CC0) a quattro livelli di grigio per la demo gameboy.
# Livello 0 = più scuro ... 3 = più chiaro; salvato come grigio 0/85/170/255 con alfa.
# Alcuni colori vanno a "retino": scacchiera fra due livelli (come le mezze tinte del Game Boy).
from PIL import Image
import sys, os
SRC = "C:/Users/lfili/OneDrive/Documenti/app/assets/19-topdown-rpg-ninja/ninja-adventure/"
OUT = "C:/Users/lfili/OneDrive/Documenti/app/Stili/demo/gameboy/assets/"
PREV = len(sys.argv) > 1
def lum(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
FORZA = {  # colore -> livello, oppure (a, b) = retino fra a e b
  'adbc3a': 3, 'a8a129': 2, '74a334': 2, '56864c': 1, '345a52': 0, '5f7160': 1,
  'd3865f': (3, 2), 'bd7959': 2, 'd78b4a': 2, 'ffad5d': 3, 'c8966b': 2, 'a3754e': 1,
  '71ddee': 2, '79b8ce': (2, 1), '8feff1': 3, 'b8dce5': 3, '548789': 1, '2d697b': 1,
  'e46d3a': 1, 'd14b34': 1, '965340': 0, 'e0394c': 1, 'ef914f': 2, 'ff9554': 2,
  'd2b37d': 3, 'eecf9b': 3, 'ffcb8d': 3, '9c6546': 1, 'bd7959': 2, '8d977f': 2, 'abc2bc': 3,
  'ffcba9': 3, 'f2ad7d': 3,
}
PERFOGLIO = {
  'nature': {'adbc3a': ('s', 2, 1), '74a334': 1, '56864c': 0, 'a8a129': 1, 'd3865f': 2, 'bd7959': 1},
  'floor': {'d3865f': ('t', 3, 1), 'bd7959': 2, 'd78b4a': ('t', 3, 1)},
  'water': {'71ddee': 1, '79b8ce': (1, 0), '8feff1': 2, 'ffffff': 3},
  'house': {'e46d3a': 1, 'd14b34': (1, 0), 'bd7959': 2},
}
FOGLIO = ''
def livello(c, x, y):
    h = '%02x%02x%02x' % c[:3]
    v = PERFOGLIO.get(FOGLIO, {}).get(h, FORZA.get(h))
    if v is None:
        L = lum(c)
        v = 0 if L < 72 else 1 if L < 125 else 2 if L < 178 else 3
    if isinstance(v, tuple):
        if v[0] == 't': v = v[2] if (x % 4 == 1 and y % 4 == 1) else v[1]
        elif v[0] == 's': v = v[2] if (x % 4 == 0 and y % 4 == 0) or (x % 4 == 2 and y % 4 == 2) else v[1]
        else: v = v[0] if (x + y) % 2 else v[1]
    return v
def converti(rel, nome):
    global FOGLIO
    FOGLIO = nome
    im = Image.open(SRC + rel).convert('RGBA')
    out = Image.new('RGBA', im.size)
    px, po = im.load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y]
            if c[3] < 128: continue
            g = livello(c, x, y) * 85
            po[x, y] = (g, g, g, 255)
    out.save(OUT + nome + '.png')
    if PREV:
        pal = [(15, 56, 15), (48, 98, 48), (139, 172, 15), (155, 188, 15)]
        pv = Image.new('RGBA', im.size, (155, 188, 15, 255)); pp = pv.load()
        for y in range(im.height):
            for x in range(im.width):
                if po[x, y][3]: pp[x, y] = pal[po[x, y][0] // 85] + (255,)
        pv.resize((im.width * 2, im.height * 2), 0).save(OUT + '../_prev_' + nome + '.png')
    print(nome, im.size)
os.makedirs(OUT, exist_ok=True)
for rel, nome in [('Backgrounds/Tilesets/TilesetFloor.png', 'floor'), ('Backgrounds/Tilesets/TilesetNature.png', 'nature'),
                  ('Backgrounds/Tilesets/TilesetHouse.png', 'house'), ('Backgrounds/Tilesets/TilesetWater.png', 'water'),
                  ('Backgrounds/Tilesets/TilesetFloorDetail.png', 'floordet'),
                  ('Actor/Character/Boy/SpriteSheet.png', 'boy'), ('Actor/Character/OldMan/SpriteSheet.png', 'oldman'),
                  ('Actor/Character/Villager/SpriteSheet.png', 'villager'), ('Actor/Character/Woman/SpriteSheet.png', 'woman'),
                  ('Actor/Animal/Chicken/SpriteSheetWhite.png', 'chicken'), ('Actor/Animal/Cat/SpriteSheet.png', 'cat'),
                  ('Backgrounds/Animated/Flower/SpriteSheet16x16.png', 'flower'),
                  ('Backgrounds/Animated/Water Ripples/SpriteSheet16x16.png', 'ripples'),
                  ('Ui/Font/font8x8.png', 'font')]:
    converti(rel, nome)
