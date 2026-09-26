"""Pubblica il sito: python pubblica.py "messaggio"

1. incrementa la versione (file VERSIONE) e riscrive ogni ?v=N in HTML e JS del progetto (vendor escluso);
2. copia nel repo C:\\Users\\lfili\\WebApps\\stili solo ciò che serve: dei moduli three/addons
   copia soltanto quelli davvero importati (seguendo gli import a cascata);
3. commit e push (GitHub Pages si aggiorna in ~1 minuto, la CDN tiene l'HTML 10 minuti).
"""
import os, re, sys, shutil, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = r'C:\Users\lfili\WebApps\stili'
ESCLUSI_DIR = {'.claude', '_prove', '__pycache__', 'strumenti', 'vendor', '_modello', '.git'}
ESCLUSI_FILE = {'BRIEF-AGENTI.md', 'pubblica.py', 'servi.py', 'VERSIONE'}

def sorgenti():
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in ESCLUSI_DIR]
        for f in files:
            yield os.path.join(d, f)

# ── 1. versione ──
pv = os.path.join(ROOT, 'VERSIONE')
n = int(open(pv).read().strip()) + 1 if os.path.exists(pv) else 1
open(pv, 'w').write(str(n))
for p in sorgenti():
    if p.endswith(('.html', '.js')):
        s = open(p, encoding='utf-8').read()
        s2 = re.sub(r'\?v=\d+', f'?v={n}', s)
        if s2 != s:
            open(p, 'w', encoding='utf-8', newline='').write(s2)

# ── 2. copia ──
if not os.path.isdir(REPO):
    sys.exit('Manca il repo ' + REPO)
for x in os.listdir(REPO):
    if x in ('.git', '.github', '.nojekyll', '.gitignore'):
        continue
    q = os.path.join(REPO, x)
    shutil.rmtree(q) if os.path.isdir(q) else os.remove(q)
# Si pubblicano solo le demo finite, cioe' quelle che hanno l'anteprima in anteprime/<id>.jpg:
# le altre restano fuori dal repo e spariscono dal registro pubblicato.
PRONTE = {f[:-4] for f in os.listdir(os.path.join(ROOT, 'anteprime')) if f.endswith('.jpg')}
def pubblicabile(p):
    r = os.path.relpath(p, ROOT).replace(os.sep, '/').split('/')
    return not (r[0] == 'demo' and len(r) > 2 and r[1] not in PRONTE)
for p in sorgenti():
    if not pubblicabile(p):
        continue
    q = os.path.join(REPO, os.path.relpath(p, ROOT))
    os.makedirs(os.path.dirname(q), exist_ok=True)
    shutil.copy2(p, q)
# registro filtrato: ogni voce comincia con "  { id: '" e finisce prima della successiva o di un commento
reg = open(os.path.join(ROOT, 'stili-data.js'), encoding='utf-8').read()
righe, fuori, tenute = [], False, 0
for r in reg.split('\n'):
    m = re.match(r"\s*\{ id: '([^']+)'", r)
    if m:
        fuori = m.group(1) not in PRONTE
        tenute += not fuori
    elif r.strip().startswith('//') or r.strip() == '];':
        fuori = False
    if not fuori:
        righe.append(r)
open(os.path.join(REPO, 'stili-data.js'), 'w', encoding='utf-8', newline='').write('\n'.join(righe))
print(f'demo pubblicate: {tenute}')

# vendor: three.module.js + three.core.js + LICENSE + addons raggiunti dagli import
VEND = os.path.join(ROOT, 'vendor', 'three')
IMP = re.compile(r'''(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]''')
da_fare, visti = [], set()
for p in sorgenti():
    if p.endswith('.js'):
        da_fare.append(p)
for base in ('three.module.js', 'three.core.js', 'LICENSE'):
    visti.add(os.path.join(VEND, base))
while da_fare:
    p = da_fare.pop()
    try:
        s = open(p, encoding='utf-8').read()
    except UnicodeDecodeError:
        continue
    for m in IMP.finditer(s):
        spec = (m.group(1) or m.group(2) or m.group(3)).split('?')[0]
        if spec.startswith('three/addons/'):
            t = os.path.join(VEND, 'addons', spec[len('three/addons/'):])
        elif spec.startswith('.') and p.startswith(VEND):
            t = os.path.normpath(os.path.join(os.path.dirname(p), spec))
        else:
            continue
        if t not in visti and os.path.exists(t):
            visti.add(t)
            if t.endswith('.js'):
                da_fare.append(t)
for p in visti:
    q = os.path.join(REPO, os.path.relpath(p, ROOT))
    os.makedirs(os.path.dirname(q), exist_ok=True)
    shutil.copy2(p, q)
print(f'versione {n}: copiati {len(visti)} file di three')

# ── 3. push ──
msg = sys.argv[1] if len(sys.argv) > 1 else f'Versione {n}'
subprocess.run(['git', 'add', '-A'], cwd=REPO, check=True)
subprocess.run(['git', 'commit', '-q', '-m', msg + '\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'], cwd=REPO)
subprocess.run(['git', 'push', '-q'], cwd=REPO, check=True)
print('pubblicata la versione', n)
