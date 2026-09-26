# Impacchetta gli sprite di Treasure Hunters (Pixel Frog) in strisce orizzontali per la demo pixel16
from PIL import Image
import glob, os, json, re
SRC = "C:/Users/lfili/OneDrive/Documenti/app/assets/18-pixel-cartoon/treasure-hunters/"
OUT = "C:/Users/lfili/OneDrive/Documenti/app/Stili/demo/pixel16/assets/"
CAP = 'Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/'
CC = 'The Crusty Crew/Sprites/'
PT = 'Palm Tree Island/Sprites/'
def num(f):
    m = re.findall(r'(\d+)', os.path.basename(f)); return int(m[-1]) if m else 0
strips = {
  'cap_idle': CAP+'01-Idle/*.png', 'cap_run': CAP+'02-Run/*.png', 'cap_jump': CAP+'03-Jump/*.png',
  'cap_fall': CAP+'04-Fall/*.png', 'cap_ground': CAP+'05-Ground/*.png', 'cap_hit': CAP+'06-Hit/*.png',
  'dust_jump': 'Captain Clown Nose/Sprites/Dust Particles/Jump*.png',
  'dust_fall': 'Captain Clown Nose/Sprites/Dust Particles/Fall*.png',
  'dust_run': 'Captain Clown Nose/Sprites/Dust Particles/Run*.png',
  'crab_run': CC+'Crabby/02-Run/*.png', 'crab_dead': CC+'Crabby/09-Dead Hit/*.png',
  'star_run': CC+'Pink Star/02-Run/*.png', 'star_dead': CC+'Pink Star/09-Dead Hit/*.png',
  'tooth_run': CC+'Fierce Tooth/02-Run/*.png', 'tooth_dead': CC+'Fierce Tooth/09-Dead Hit/*.png',
  'coin': 'Pirate Treasure/Sprites/Gold Coin/*.png', 'coin_fx': 'Pirate Treasure/Sprites/Coin Effect/*.png',
  'dia_blue': 'Pirate Treasure/Sprites/Blue Diamond/*.png', 'dia_red': 'Pirate Treasure/Sprites/Red Diamond/*.png',
  'dia_green': 'Pirate Treasure/Sprites/Green Diamond/*.png', 'dia_fx': 'Pirate Treasure/Sprites/Diamond Effect/*.png',
  'water_top': 'Merchant Ship/Sprites/Water/Water/Top/*.png', 'water_bot': 'Merchant Ship/Sprites/Water/Water/Bottom/*.png',
  'splash': 'Merchant Ship/Sprites/Water/Water Splash 1/*.png',
  'candle': 'Pirate Ship/Sprites/Decorations/Candle/Candle/*.png',
  'chest_open': PT+'Objects/Chest/Chest Open*.png', 'chest_close': PT+'Objects/Chest/Chest Close*.png',
  'flag': PT+'Objects/Flag/Flag 0*.png',
  'palm_top': PT+'Front Palm Trees/Front Palm Tree Top*.png',
  'bpalm': PT+'Back Palm Trees/Back Palm Tree Regular*.png',
  'bpalm_l': PT+'Back Palm Trees/Back Palm Tree Left*.png', 'bpalm_r': PT+'Back Palm Trees/Back Palm Tree Right*.png',
  'refl_big': PT+'Background/Water Reflect Big*.png', 'refl_med': PT+'Background/Water Reflect Medium*.png',
  'refl_small': PT+'Background/Water Reflect Small*.png',
  'barrels': 'Pirate Ship/Sprites/Decorations/Barrels and Bottles/*.png',
}
meta = {}
for k, pat in strips.items():
    fs = sorted(glob.glob(SRC + pat), key=num)
    assert fs, k
    ims = [Image.open(f).convert('RGBA') for f in fs]
    w, h = ims[0].size
    if k == 'barrels':  # oggetti diversi: striscia a celle della dimensione massima
        w = max(i.width for i in ims); h = max(i.height for i in ims)
    s = Image.new('RGBA', (w * len(ims), h))
    for i, im in enumerate(ims): s.paste(im, (i * w, h - im.height))
    s.save(OUT + k + '.png'); meta[k] = [w, h, len(ims)]
singles = {'terrain': PT+'Terrain/Terrain (32x32).png', 'palm_base': PT+'Front Palm Trees/Front Palm Bottom and Grass (32x32).png',
  'clouds_big': PT+'Background/Big Clouds.png', 'cloud1': PT+'Background/Small Cloud 1.png', 'cloud2': PT+'Background/Small Cloud 2.png',
  'cloud3': PT+'Background/Small Cloud 3.png', 'spikes': PT+'Objects/Spikes/Spikes.png', 'flag_base': PT+'Objects/Flag/Platform.png'}
for k, f in singles.items():
    im = Image.open(SRC + f).convert('RGBA'); im.save(OUT + k + '.png'); meta[k] = [im.width, im.height, 1]
print(json.dumps(meta))
