# Copia nella demo i fogli di Ninja Adventure (CC0) che servono, con nomi corti.
import shutil, os
SRC = "C:/Users/lfili/OneDrive/Documenti/app/assets/19-topdown-rpg-ninja/ninja-adventure/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets') + '/'
COPIE = {
  'Backgrounds/Tilesets/TilesetFloor.png': 'floor',
  'Backgrounds/Tilesets/TilesetNature.png': 'nature',
  'Backgrounds/Tilesets/TilesetHouse.png': 'house',
  'Backgrounds/Tilesets/TilesetWater.png': 'water',
  'Backgrounds/Tilesets/TilesetElement.png': 'element',
  'Backgrounds/Tilesets/TilesetFloorDetail.png': 'detail',
  'Actor/Character/NinjaGreen/SpriteSheet.png': 'eroe',
  'Actor/Character/NinjaGreen/SeparateAnim/Attack.png': 'eroe-colpo',
  'Actor/Character/Woman/SpriteSheet.png': 'donna',
  'Actor/Character/OldMan/SpriteSheet.png': 'vecchio',
  'Actor/Character/Villager4/SpriteSheet.png': 'ragazzo',
  'Actor/Character/Princess/SpriteSheet.png': 'ragazza',
  'Actor/Animal/Chicken/SpriteSheetWhite.png': 'gallina',
  'Actor/Animal/Cat/SpriteSheet.png': 'gatto',
  'FX/Attack/SlashCurved/SpriteSheet.png': 'fendente',
  'FX/Particle/Grass.png': 'ciuffi',
  'FX/Particle/Leaf.png': 'foglie',
  'Items/Treasure/Coin2.png': 'moneta',
  'Ui/Font/font8x8.png': 'font',
  'FX/Environment/Raylight.png': 'raggi',
}
os.makedirs(OUT, exist_ok=True)
for a, b in COPIE.items():
    shutil.copy(SRC + a, OUT + b + '.png')
print(len(COPIE), 'file copiati')
