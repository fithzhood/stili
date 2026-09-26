// La strada a segmenti: ogni segmento è un trapezio proiettato; curve e colline sono finte
// (la curva sposta di lato i segmenti successivi, la collina li alza). Qui anche il cielo,
// il sole a strisce e le montagne a fil di ferro.

export const SEG = 200;            // lunghezza di un segmento
export const LARGH = 1200;         // mezza larghezza della strada
export const CAM_H = 900;         // altezza della telecamera
export const CAM_D = 1 / Math.tan((100 / 2) * Math.PI / 180);
export const VISTA = 220;          // segmenti disegnati
const RUMBLE = 3;

let s = 424242; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

export const segmenti = [];
export let lunghezza = 0;

function ultimaY() { return segmenti.length ? segmenti[segmenti.length - 1].p2.w.y : 0; }
function aggiungiSegmento(curva, y) {
  const n = segmenti.length;
  segmenti.push({ i: n, curva, sprite: [], auto: [],
    p1: { w: { x: 0, y: ultimaY(), z: n * SEG }, c: {}, s: {} },
    p2: { w: { x: 0, y, z: (n + 1) * SEG }, c: {}, s: {} },
    chiaro: Math.floor(n / RUMBLE) % 2 === 0 });
}
const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
function tratto(entra, tiene, esce, curva, collina) {
  const y0 = ultimaY(), y1 = y0 + collina * SEG, tot = entra + tiene + esce;
  for (let n = 0; n < entra; n++) aggiungiSegmento(easeIn(0, curva, n / entra), easeInOut(y0, y1, n / tot));
  for (let n = 0; n < tiene; n++) aggiungiSegmento(curva, easeInOut(y0, y1, (entra + n) / tot));
  for (let n = 0; n < esce; n++) aggiungiSegmento(easeInOut(curva, 0, n / esce), easeInOut(y0, y1, (entra + tiene + n) / tot));
}
function sprite(n, nome, off) { if (segmenti[n]) segmenti[n].sprite.push({ nome, off }); }

export function costruisciPista() {
  segmenti.length = 0;
  tratto(20, 40, 40, 0, 0);
  tratto(40, 60, 40, -2.4, 20);
  tratto(30, 50, 30, 0, -10);
  tratto(40, 80, 40, 3.2, 30);
  tratto(30, 40, 30, 0, 0);
  tratto(40, 40, 40, -4, -30);
  tratto(40, 40, 40, 3, 15);
  tratto(20, 60, 20, 0, 40);
  tratto(40, 70, 40, -3, -20);
  tratto(30, 30, 30, 2, -25);
  tratto(40, 100, 40, -1.6, 10);
  tratto(40, 60, 40, 4, 0);
  tratto(30, 40, 30, 0, -40);
  tratto(50, 50, 50, -2.5, 20);
  // ritorno dolce all'altezza di partenza per chiudere l'anello
  const y = ultimaY();
  tratto(60, 60, 60, 0, -y / SEG);
  lunghezza = segmenti.length * SEG;

  // arredo: palme fitte, lampioni al neon, cartelloni, frecce prima delle curve
  for (let n = 10; n < segmenti.length - 10; n++) {
    const seg = segmenti[n];
    if (n % 7 === 0) sprite(n, 'palma' + Math.floor(r() * 4), -(1.45 + r() * 1.6));
    if (n % 7 === 3) sprite(n, 'palma' + Math.floor(r() * 4), 1.45 + r() * 1.6);
    if (n % 11 === 5 && r() < 0.6) sprite(n, 'palma' + Math.floor(r() * 4), (r() < 0.5 ? -1 : 1) * (3.3 + r() * 2.5));
    if (n % 24 === 0) { const rosa = (n / 24) % 2; sprite(n, rosa ? 'lampRosaSx' : 'lampSx', -1.2); sprite(n, rosa ? 'lampRosaDx' : 'lampDx', 1.2); }
    if (n % 150 === 60) sprite(n, 'cartello' + Math.floor(r() * 4), (r() < 0.5 ? -1 : 1) * 1.9);
    const avanti = segmenti[n + 12];
    if (avanti && Math.abs(avanti.curva) > 1.5 && Math.abs(seg.curva) < 0.5 && n % 4 === 0)
      sprite(n, avanti.curva > 0 ? 'frecciaDx' : 'frecciaSx', avanti.curva > 0 ? -1.35 : 1.35);
  }
}
export const trova = z => segmenti[Math.floor(z / SEG) % segmenti.length];

function proietta(p, camX, camY, camZ, LW, LH) {
  p.c.x = (p.w.x || 0) - camX; p.c.y = (p.w.y || 0) - camY; p.c.z = (p.w.z || 0) - camZ;
  p.s.k = CAM_D / p.c.z;
  p.s.x = Math.round(LW / 2 + p.s.k * p.c.x * LW / 2);
  p.s.y = Math.round(LH / 2 - p.s.k * p.c.y * LH / 2);
  p.s.w = Math.round(p.s.k * LARGH * LW / 2);
}

function quad(x, x1, y1, w1, x2, y2, w2, col) {
  x.fillStyle = col;
  x.beginPath(); x.moveTo(x1 - w1, y1); x.lineTo(x2 - w2, y2); x.lineTo(x2 + w2, y2); x.lineTo(x1 + w1, y1); x.closePath(); x.fill();
}
function mescola(a, b, f) { // colori [r,g,b]
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}
const C = {
  nebbia: [70, 18, 82],
  terraC: [26, 8, 44], terraS: [20, 6, 36],
  griglia: [255, 50, 200], grigliaL: [120, 60, 255],
  stradaC: [44, 36, 62], stradaS: [36, 29, 52],
  cordC: [255, 60, 170], cordS: [245, 238, 255],
  linea: [240, 235, 255],
};

// ── Cielo, sole, montagne ──
let cieloCache = null;
function creaSole(R) {
  const c = document.createElement('canvas'); c.width = c.height = R * 2 + 2;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, R * 2);
  g.addColorStop(0, '#fff27a'); g.addColorStop(0.35, '#ffc23a'); g.addColorStop(0.62, '#ff6a4a'); g.addColorStop(1, '#ff2d95');
  x.fillStyle = g; x.beginPath(); x.arc(R + 1, R + 1, R, 0, Math.PI * 2); x.fill();
  // strisce: fessure orizzontali che si allargano verso il basso
  x.globalCompositeOperation = 'destination-out';
  let y = R * 0.95, h = 1;
  while (y < R * 2 + 2) { x.fillRect(0, Math.round(y), R * 2 + 2, Math.round(h)); y += 4 + h * 1.6; h += 0.9; }
  return c;
}
function montagne(larg, alt, n, seme) {
  let q = seme; const rr = () => { q = (q * 48271) % 2147483647; return q / 2147483647; };
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n * larg;
    const v = Math.abs(Math.sin(i * 0.9 + seme)) * 0.5 + rr() * 0.5;
    pts.push([x, alt * (0.25 + v * 0.75) * (0.6 + 0.4 * Math.sin(i / n * Math.PI * 4 + seme))]);
  }
  pts[n][1] = pts[0][1];
  return pts;
}
export function preparaCielo(LW, LH) {
  cieloCache = {
    LW, LH, sole: creaSole(Math.round(LH * 0.24)),
    lontane: montagne(LW * 2, LH * 0.13, 28, 3.1), vicine: montagne(LW * 2, LH * 0.085, 18, 7.7),
    stelle: Array.from({ length: 90 }, () => [r() * LW, r() * LH * 0.36, r()]),
  };
}
function disegnaMontagne(x, pts, ox, base, fill, lineCol, LW) {
  const larg = pts[pts.length - 1][0];
  let o = ((ox % larg) + larg) % larg;
  for (const rip of [-larg, 0, larg]) {
    const X = p => Math.round(p[0] - o + rip);
    if (X(pts[pts.length - 1]) < 0 || X(pts[0]) > LW) continue;
    x.fillStyle = fill;
    x.beginPath(); x.moveTo(X(pts[0]), base);
    for (const p of pts) x.lineTo(X(p), base - p[1]);
    x.lineTo(X(pts[pts.length - 1]), base); x.closePath(); x.fill();
    // fil di ferro: cresta e triangoli fino alla base
    x.strokeStyle = lineCol; x.lineWidth = 1;
    x.beginPath();
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; i ? x.lineTo(X(p) + 0.5, base - p[1] + 0.5) : x.moveTo(X(p) + 0.5, base - p[1] + 0.5); }
    x.stroke();
    x.globalAlpha = 0.45; x.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], mx = (X(a) + X(b)) / 2;
      x.moveTo(X(a) + 0.5, base - a[1]); x.lineTo(mx + 0.5, base);
      x.moveTo(X(b) + 0.5, base - b[1]); x.lineTo(mx + 0.5, base);
      x.moveTo(X(a) + 0.5, base - a[1] * 0.5); x.lineTo(X(b) + 0.5, base - b[1] * 0.5);
    }
    x.stroke(); x.globalAlpha = 1;
  }
}
export function disegnaCielo(x, LW, LH, sfondoX, t) {
  const cc = cieloCache, oriz = Math.round(LH * 0.5);
  const g = x.createLinearGradient(0, 0, 0, oriz);
  g.addColorStop(0, '#07041a'); g.addColorStop(0.35, '#25094a'); g.addColorStop(0.62, '#6b1470');
  g.addColorStop(0.84, '#d23a78'); g.addColorStop(1, '#ff9a52');
  x.fillStyle = g; x.fillRect(0, 0, LW, oriz);
  for (const [sx, sy, b] of cc.stelle) {
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + b * 3) + b * 40);
    x.globalAlpha = (1 - sy / (LH * 0.36)) * (0.3 + 0.7 * tw) * b;
    x.fillStyle = '#ffffff'; x.fillRect(Math.round((sx - sfondoX * 0.05 + LW * 10) % LW), Math.round(sy), 1, 1);
  }
  x.globalAlpha = 1;
  // alone del sole
  const sx = Math.round(LW / 2 - sfondoX * 0.12), sR = cc.sole.width / 2, sy = oriz - Math.round(sR * 0.42);
  const al = x.createRadialGradient(sx, sy, sR * 0.6, sx, sy, sR * 2.6);
  al.addColorStop(0, 'rgba(255,120,110,0.55)'); al.addColorStop(0.4, 'rgba(255,60,150,0.18)'); al.addColorStop(1, 'rgba(255,60,150,0)');
  x.fillStyle = al; x.fillRect(0, 0, LW, oriz);
  x.drawImage(cc.sole, Math.round(sx - sR), Math.round(sy - sR));
  disegnaMontagne(x, cc.lontane, sfondoX * 0.25, oriz, '#2a0b45', 'rgba(255,90,210,0.8)', LW);
  disegnaMontagne(x, cc.vicine, sfondoX * 0.45, oriz, '#16062a', '#ff3fd0', LW);
  // foschia sull'orizzonte
  const f = x.createLinearGradient(0, oriz - 14, 0, oriz + 2);
  f.addColorStop(0, 'rgba(255,110,150,0)'); f.addColorStop(1, 'rgba(255,110,150,0.35)');
  x.fillStyle = f; x.fillRect(0, oriz - 14, LW, 16);
  // terra sotto l'orizzonte (dove la strada non arriva)
  const tg = x.createLinearGradient(0, oriz, 0, LH);
  tg.addColorStop(0, 'rgb(70,18,82)'); tg.addColorStop(0.2, 'rgb(26,8,44)'); tg.addColorStop(1, 'rgb(20,6,36)');
  x.fillStyle = tg; x.fillRect(0, oriz, LW, LH - oriz);
  return oriz;
}

// ── Strada ──
// Restituisce l'elenco dei segmenti visibili (dal più vicino) con il loro limite di ritaglio.
export function disegnaStrada(x, LW, LH, pos, giocX, camYextra) {
  const base = trova(pos), perc = (pos % SEG) / SEG;
  const camY = CAM_H + (base.p1.w.y + (base.p2.w.y - base.p1.w.y) * perc) + camYextra;
  let dx = -(base.curva * perc), cx = 0, maxy = LH;
  const vis = [];
  for (let n = 0; n < VISTA; n++) {
    const seg = segmenti[(base.i + n) % segmenti.length];
    const giro = seg.i < base.i ? lunghezza : 0;
    proietta(seg.p1, giocX * LARGH - cx, camY, pos - giro, LW, LH);
    proietta(seg.p2, giocX * LARGH - cx - dx, camY, pos - giro, LW, LH);
    cx += dx; dx += seg.curva;
    seg.clip = maxy; seg.n = n;
    if (seg.p1.c.z <= CAM_D || seg.p2.s.y >= seg.p1.s.y || seg.p2.s.y >= maxy) continue;
    vis.push(seg);
    maxy = seg.p2.s.y;
  }
  // dal più lontano al più vicino: il vicino copre il lontano anche sui dossi
  for (let k = vis.length - 1; k >= 0; k--) {
    const seg = vis[k], p1 = seg.p1.s, p2 = seg.p2.s;
    const nebbia = Math.pow(seg.n / VISTA, 1.4);
    const y1 = p1.y, y2 = p2.y;
    x.fillStyle = mescola(seg.chiaro ? C.terraC : C.terraS, C.nebbia, nebbia);
    x.fillRect(0, y2, LW, y1 - y2 + 1);
    // griglia al neon nel terreno: righe trasversali e linee che corrono lungo la strada
    const gcol = mescola(C.griglia, C.nebbia, nebbia * 0.8);
    if (seg.i % 4 === 0) { x.fillStyle = gcol; x.fillRect(0, y1 - Math.max(1, Math.round((y1 - y2) * 0.12)), LW, Math.max(1, Math.round((y1 - y2) * 0.12))); }
    x.fillStyle = mescola(C.grigliaL, C.nebbia, nebbia * 0.8);
    for (let g = 1; g <= 9; g++) for (const lato of [-1, 1]) {
      const off = lato * (1.6 + g * 0.9);
      const a = p1.x + p1.w * off, b = p2.x + p2.w * off;
      if ((a < -40 && b < -40) || (a > LW + 40 && b > LW + 40)) continue;
      const w1 = Math.max(0.5, p1.w * 0.012), w2 = Math.max(0.5, p2.w * 0.012);
      quad(x, a, y1, w1, b, y2, w2, x.fillStyle);
    }
    const r1 = p1.w * 1.14, r2 = p2.w * 1.14;
    quad(x, p1.x, y1, r1, p2.x, y2, r2, mescola(seg.chiaro ? C.cordC : C.cordS, C.nebbia, nebbia));
    quad(x, p1.x, y1, p1.w, p2.x, y2, p2.w, mescola(seg.chiaro ? C.stradaC : C.stradaS, C.nebbia, nebbia));
    if (seg.chiaro) {
      const lc = mescola(C.linea, C.nebbia, nebbia), l1 = p1.w * 0.025, l2 = p2.w * 0.025;
      for (const f of [-1 / 3, 1 / 3]) quad(x, p1.x + p1.w * f * 2, y1, l1, p2.x + p2.w * f * 2, y2, l2, lc);
      // linea bianca continua sul bordo
      quad(x, p1.x - p1.w * 0.96, y1, l1, p2.x - p2.w * 0.96, y2, l2, lc);
      quad(x, p1.x + p1.w * 0.96, y1, l1, p2.x + p2.w * 0.96, y2, l2, lc);
    }
  }
  return vis;
}

// Sprite di un segmento, ritagliati sotto il dosso che li nasconde.
export function disegnaSprite(x, LW, LH, img, seg, off, scalaMondo, nebbia) {
  const p = seg.p1.s;
  const ppu = p.k * LW / 2;                     // pixel per unità di mondo a quella distanza
  const w = img.width * scalaMondo * ppu, h = img.height * scalaMondo * ppu;
  if (w < 1) return;
  const sx = p.x + p.w * off - w / 2, sy = p.y - h;
  const clipH = Math.max(0, sy + h - seg.clip);
  if (clipH >= h) return;
  const frac = 1 - clipH / h;
  x.globalAlpha = 1 - nebbia * 0.6;
  x.drawImage(img, 0, 0, img.width, img.height * frac, Math.round(sx), Math.round(sy), Math.round(w), Math.round(h * frac));
  x.globalAlpha = 1;
}
