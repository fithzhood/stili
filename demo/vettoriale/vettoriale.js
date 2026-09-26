// Flat design — un piccolo pianeta alla Kurzgesagt che gira fra il giorno e la notte.
// Canvas 2D, solo forme vettoriali: il pianeta e tutto ciò che ci sta sopra si disegnano su una tela
// a parte, poi il lato in ombra si scurisce a mezzi toni piatti (tre fasce, niente sfumatura
// fotografica) solo dove c'è pianeta. Le luci (finestre, faro, sole) si aggiungono dopo, sopra il buio.
'use strict';

const cv = document.createElement('canvas');
document.body.prepend(cv);
const ctx = cv.getContext('2d');
const pc = document.createElement('canvas');          // tela del pianeta
const pctx = pc.getContext('2d');
let W = 0, H = 0, DPR = 1, U = 1, VW = 1280;
let C = { x: 640, y: 372 };
const R = 244;
const SO = 1.3;           // scala degli oggetti sulla superficie

function ridimensiona() {
  DPR = Demo.shot ? 1 : Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = pc.width = Math.round(W * DPR); cv.height = pc.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  U = H / 720; VW = W / U;
  C = { x: VW / 2, y: 384 };
  preparaStelle();
}
addEventListener('resize', ridimensiona);

function hash(a, b = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x3c6ef372, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// ── Il sole e la sua direzione ──
const SOLE = () => ({ x: VW * 0.11, y: 112 });
function dirLuce() { const s = SOLE(), dx = s.x - C.x, dy = s.y - C.y, l = Math.hypot(dx, dy); return { x: dx / l, y: dy / l }; }
/** Quanto è notte in un punto: 0 in piena luce, 1 nel buio (distanza con segno dalla linea d'ombra). */
function notte(x, y) { const L = dirLuce(); const s = -((x - C.x) * L.x + (y - C.y) * L.y); return smooth(-0.08 * R, 0.16 * R, s); }

// ── Geografia del pianeta (angoli locali; il mondo aggiunge la rotazione) ──
const CONT = { c: -1.2, hw: 0.95 };
const ISOLA = { c: 1.75, hw: 0.085 };
function quota(phi) {
  const dc = angDiff(phi, CONT.c) / CONT.hw;
  if (Math.abs(dc) < 1) {
    const k = 1 - dc * dc;
    return 13 * Math.sqrt(k) + (5 * Math.sin(phi * 7 + 1) + 2.5 * Math.sin(phi * 17)) * k;
  }
  const di = angDiff(phi, ISOLA.c) / ISOLA.hw;
  if (Math.abs(di) < 1) return 7 * Math.sqrt(1 - di * di);
  return -1;
}
const terra = phi => quota(phi) > 0.5;

// ── Oggetti sulla superficie ──
const OGG = [];
const albero = (a, tipo = 'tondo', s = 1) => OGG.push({ k: 'albero', a, tipo, s, cresci: 99, col: Math.floor(hash(a * 1000 | 0) * 3) });
albero(-2.02); albero(-1.9, 'abete'); albero(-1.52); albero(-1.43, 'tondo', 0.8); albero(-0.8, 'abete');
albero(-0.5); albero(-0.37, 'abete', 0.9); albero(-2.08, 'tondo', 0.7); albero(-1.02, 'abete', 0.8);
for (const a of [-1.72, -1.3, -1.16, -0.64]) OGG.push({ k: 'casa', a, luce: 0, vl: 0, col: Math.floor(hash(a * 977 | 0) * 4), rit: hash(a * 31 | 0) * 0.6 });
OGG.push({ k: 'monte', a: -0.94 });
OGG.push({ k: 'faro', a: ISOLA.c });
OGG.push({ k: 'scoglio', a: ISOLA.c + 0.07 });
OGG.sort((p, q) => (p.k === 'monte' ? -1 : 0) - (q.k === 'monte' ? -1 : 0));

const VERDI = [['#3fb35c', '#2f9150'], ['#6fcf4f', '#4ea83d'], ['#2fa38a', '#218070']];
const CASE = [['#ffe9c7', '#f25f5c'], ['#f7f1e3', '#5b6cf0'], ['#ffd7a8', '#e8505b'], ['#e9f2ff', '#ff8a3d']];

// ── Stato ──
let rot = 0, vrot = 0, tempo = 0;
const onde = [];         // cerchi sull'acqua dopo un clic sul mare
const nuvole = [];
for (let i = 0; i < 6; i++) nuvole.push({ a: i / 6 * Math.PI * 2 + hash(i, 3), r: R + 50 + hash(i, 4) * 26, v: 0.05 + hash(i, 5) * 0.04, s: 1.1 + hash(i, 6) * 0.6 });
let stelle = [];
function preparaStelle() {
  stelle = [];
  for (let i = 0; i < 190; i++) {
    const x = hash(i, 1) * VW, y = hash(i, 2) * 720;
    if (Math.hypot(x - C.x, y - C.y) < R * 1.35) continue;
    stelle.push({ x, y, r: 0.5 + Math.pow(hash(i, 3), 3) * 1.8, f: hash(i, 4) * 6.28, croce: hash(i, 5) < 0.07, col: ['#ffffff', '#ffe7a8', '#bcd7ff', '#ffc2e0'][Math.floor(hash(i, 6) * 4)] });
  }
}

// ── Punti in coordinate di mondo ──
function superficie(phi, sopra = 0) {
  const r = R + Math.max(0, quota(phi)) + sopra, a = phi + rot;
  return { x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r, a };
}

// ── Ombre lunghe: inviluppo convesso della sagoma e della sua copia spinta lontano dal sole ──
function inviluppo(P) {
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function ombraLunga(g, locali, m, lunghezza) {
  const L = dirLuce();
  const P = locali.map(([x, y]) => { const p = m.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; });
  const Q = P.map(([x, y]) => [x - L.x * lunghezza, y - L.y * lunghezza]);
  const h = inviluppo(P.concat(Q));
  g.beginPath(); h.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
  g.fill();
}
const cerchioPts = (cx, cy, r, n = 14) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * 6.283) * r, cy + Math.sin(i / n * 6.283) * r]);

/** Riempie mezzo cerchio in ombra piatta: la metà opposta al sole (in coordinate locali ruotate). */
function mezzaOmbra(g, cx, cy, r, angLoc, col) {
  g.save();
  g.beginPath(); g.arc(cx, cy, r, angLoc - Math.PI / 2, angLoc + Math.PI / 2); g.closePath();
  g.fillStyle = col; g.fill();
  g.restore();
}

// ── Disegno del pianeta sulla tela a parte ──
function disegnaPianeta(t) {
  const g = pctx;
  g.setTransform(DPR * U, 0, 0, DPR * U, 0, 0);
  g.clearRect(0, 0, VW, 720);
  const L = dirLuce(), angL = Math.atan2(L.y, L.x);

  // oceano: disco, fascia più scura lontano dal sole, orlo illuminato
  g.fillStyle = '#1f7fdc'; g.beginPath(); g.arc(C.x, C.y, R, 0, 7); g.fill();
  g.save(); g.beginPath(); g.arc(C.x, C.y, R, 0, 7); g.clip();
  g.fillStyle = '#1a6ec6'; g.beginPath(); g.arc(C.x - L.x * R * 0.16, C.y - L.y * R * 0.16, R * 0.93, 0, 7); g.fill();
  g.fillStyle = '#165fb0'; g.beginPath(); g.arc(C.x - L.x * R * 0.3, C.y - L.y * R * 0.3, R * 0.78, 0, 7); g.fill();
  g.restore();

  // trattini d'onda sulla faccia del mare, che girano col pianeta
  g.strokeStyle = 'rgba(120, 190, 255, 0.35)'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const phi = hash(i, 40) * 6.283, rr = R * (0.25 + 0.68 * Math.sqrt(hash(i, 41)));
    const a = phi + rot, x = C.x + Math.cos(a) * rr, y = C.y + Math.sin(a) * rr;
    const l = 5 + hash(i, 42) * 9;
    g.beginPath(); g.moveTo(x - l, y); g.lineTo(x + l, y); g.stroke();
  }
  // continente (con la spiaggia che spunta ai bordi) e isola
  const massa = (c, hw, prof, colSabbia, colErba, colFondo) => {
    const tratto = (extra, profK, sopra) => {
      g.beginPath();
      const n = 90;
      for (let i = 0; i <= n; i++) {
        const phi = c - hw - extra + (hw + extra) * 2 * i / n;
        const r = R + Math.max(-2, quota(phi) + sopra);
        const a = phi + rot;
        g.lineTo(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r);
      }
      for (let i = n; i >= 0; i--) {
        const phi = c - hw - extra + (hw + extra) * 2 * i / n;
        const u = (phi - c) / (hw + extra);
        const r = R - R * prof * profK * Math.pow(Math.max(0, 1 - u * u), 0.55) - 3 + (hw > 0.5 ? Math.sin(phi * 6) * 6 * profK : 0);
        const a = phi + rot;
        g.lineTo(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r);
      }
      g.closePath();
    };
    g.fillStyle = colSabbia; tratto(0.035, 1.02, 0); g.fill();
    g.fillStyle = colErba; tratto(0, 1, 0); g.fill();
    g.fillStyle = colFondo; tratto(-0.02, 0.8, -9); g.fill();
  };
  massa(CONT.c, CONT.hw, 0.55, '#ffd98a', '#58c95a', '#43ad52');
  massa(ISOLA.c, ISOLA.hw, 0.035, '#ffd98a', '#58c95a', '#43ad52');

  // onde sull'orlo del mare
  g.save();
  g.beginPath(); g.arc(C.x, C.y, R + 5, 0, 7); g.arc(C.x, C.y, R - 7, 0, 7, true); g.clip('evenodd');
  g.fillStyle = '#58b3f5';
  g.beginPath();
  for (let i = 0; i <= 240; i++) {
    const a = i / 240 * Math.PI * 2, phi = a - rot;
    const r = R + 1.5 + Math.sin(phi * 46 + t * 2.2) * 1.6;
    g.lineTo(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r);
  }
  g.arc(C.x, C.y, R - 5, Math.PI * 2, 0, true);
  g.fill();
  g.restore();
  // i cerchi dei clic sul mare
  for (const o of onde) {
    const p = superficie(o.a, 0), k = o.t / 1.2;
    g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; g.lineWidth = 2;
    for (const q of [0, 0.25]) if (k > q) { g.beginPath(); g.ellipse(p.x, p.y, (k - q) * 34, (k - q) * 34, 0, 0, 7); g.stroke(); }
  }

  // ombre lunghe degli oggetti (solo dove c'è luce), ritagliate sul pianeta
  g.save();
  g.beginPath(); g.arc(C.x, C.y, R + 1, 0, 7); g.clip();
  for (const o of OGG) {
    const p = superficie(o.a);
    const luce = 1 - notte(p.x, p.y);
    if (luce < 0.05) continue;
    const m = new DOMMatrix().translate(p.x, p.y).rotate((p.a + Math.PI / 2) * 180 / Math.PI).scale(SO, SO);
    g.fillStyle = `rgba(12, 30, 90, ${0.26 * luce})`;
    ombraLunga(g, sagoma(o), m, o.k === 'monte' ? 90 : 70);
  }
  g.restore();

  // oggetti
  const emissivi = [];
  for (const o of OGG) {
    const p = superficie(o.a);
    g.save();
    g.translate(p.x, p.y); g.rotate(p.a + Math.PI / 2); g.scale(SO, SO);
    const angLoc = angL - (p.a + Math.PI / 2);         // direzione del sole nel riferimento dell'oggetto
    disegnaOggetto(g, o, angLoc, t);
    if (o.k === 'casa' || o.k === 'faro') emissivi.push({ o, m: g.getTransform() });
    g.restore();
  }

  // nuvole e uccellini (anche loro vanno al buio)
  for (const n of nuvole) disegnaNuvola(g, n, angL);
  disegnaStormo(g, t);

  // il lato notte: tre fasce piatte di blu notte, solo dove c'è già qualcosa
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.translate(C.x, C.y); g.rotate(angL);
  const fasce = [[-0.06, 'rgba(10, 14, 58, 0.46)'], [0.22, 'rgba(10, 14, 58, 0.36)'], [0.52, 'rgba(8, 10, 45, 0.30)']];
  for (const [s, col] of fasce) { g.fillStyle = col; g.fillRect(-2000, -2000, 2000 - s * R, 4000); }
  // orlo illuminato dal sole
  g.restore();
  g.save();
  g.strokeStyle = 'rgba(190, 240, 255, 0.55)'; g.lineWidth = 3.5;
  g.beginPath(); g.arc(C.x, C.y, R - 1, angL - 1.15, angL + 1.15); g.stroke();
  g.restore();
  return emissivi;
}

function sagoma(o) {
  if (o.k === 'albero') {
    const s = o.s * crescita(o);
    if (o.tipo === 'abete') return [[-10 * s, 0], [0, -40 * s], [10 * s, 0]];
    return cerchioPts(0, -26 * s, 12 * s).concat([[-2, 0], [2, 0]]);
  }
  if (o.k === 'casa') return [[-10, 0], [-10, -14], [0, -24], [10, -14], [10, 0]];
  if (o.k === 'monte') return [[-34, 4], [0, -62], [34, 4]];
  if (o.k === 'faro') return [[-7, 0], [-5, -44], [0, -52], [5, -44], [7, 0]];
  return [[-6, 0], [0, -6], [6, 0]];
}
/** Crescita a molla di un albero appena piantato: supera la misura e torna indietro. */
function crescita(o) {
  const t = o.cresci;
  if (t > 3) return 1;
  if (t <= 0) return 0;
  return Math.max(0, 1 - Math.exp(-5.5 * t) * Math.cos(13 * t));
}

function disegnaOggetto(g, o, angLoc, t) {
  const lato = Math.cos(angLoc) > 0 ? 1 : -1;          // il sole sta a destra (+1) o a sinistra (-1) dell'oggetto
  if (o.k === 'albero') {
    const s = o.s * crescita(o);
    if (s <= 0.01) return;
    const [c1, c2] = VERDI[o.col];
    const osc = Math.sin(t * 1.6 + o.a * 5) * 0.03;
    g.rotate(osc);
    if (o.tipo === 'abete') {
      g.fillStyle = '#7a4a3a'; g.fillRect(-1.8 * s, -6 * s, 3.6 * s, 6 * s);
      g.fillStyle = c1; g.beginPath(); g.moveTo(-10 * s, -4 * s); g.lineTo(0, -42 * s); g.lineTo(10 * s, -4 * s); g.closePath(); g.fill();
      g.fillStyle = c2; g.beginPath(); g.moveTo(0, -42 * s); g.lineTo(-lato * 10 * s, -4 * s); g.lineTo(0, -4 * s); g.closePath(); g.fill();
    } else {
      g.fillStyle = '#8a5a44'; g.beginPath(); g.roundRect(-2 * s, -18 * s, 4 * s, 18 * s, 2 * s); g.fill();
      g.fillStyle = c1; g.beginPath(); g.arc(0, -27 * s, 12 * s, 0, 7); g.fill();
      mezzaOmbra(g, 0, -27 * s, 12 * s, angLoc + Math.PI, c2);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(Math.cos(angLoc) * 6 * s, -27 * s + Math.sin(angLoc) * 6 * s, 3 * s, 0, 7); g.fill();
    }
    return;
  }
  if (o.k === 'casa') {
    const [muro, tetto] = CASE[o.col];
    g.fillStyle = muro; g.fillRect(-10, -14, 20, 14);
    g.fillStyle = 'rgba(40, 50, 120, 0.18)'; g.fillRect(lato > 0 ? -10 : 2, -14, 8, 14);
    g.fillStyle = tetto; g.beginPath(); g.moveTo(-13, -13); g.lineTo(0, -25); g.lineTo(13, -13); g.closePath(); g.fill();
    g.fillStyle = '#6d4b5e'; g.fillRect(4, -26, 4, 8);
    g.fillStyle = '#4a3a5c'; g.fillRect(-3, -7, 5, 7);
    g.fillStyle = '#bcd6ef'; g.fillRect(4, -10, 4, 4); g.fillRect(-8, -11, 3.5, 4);
    // fumo dal comignolo: sbuffi tondi che salgono e svaniscono
    for (let i = 0; i < 3; i++) {
      const k = (((t * 0.45 + i / 3 + o.a) % 1) + 1) % 1;
      g.fillStyle = `rgba(235, 240, 255, ${0.8 * (1 - k)})`;
      g.beginPath(); g.arc(6 + k * 8, -30 - k * 22, 2 + k * 3.5, 0, 7); g.fill();
    }
    return;
  }
  if (o.k === 'monte') {
    g.fillStyle = '#7d8fc4'; g.beginPath(); g.moveTo(-34, 4); g.lineTo(0, -62); g.lineTo(34, 4); g.closePath(); g.fill();
    g.fillStyle = '#5f70a8'; g.beginPath(); g.moveTo(0, -62); g.lineTo(-lato * 34, 4); g.lineTo(0, 4); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-11, -41); g.lineTo(0, -62); g.lineTo(11, -41); g.lineTo(5, -45); g.lineTo(0, -39); g.lineTo(-5, -45); g.closePath(); g.fill();
    g.fillStyle = '#dce6ff'; g.beginPath(); g.moveTo(0, -62); g.lineTo(-lato * 11, -41); g.lineTo(-lato * 5, -45); g.lineTo(0, -39); g.closePath(); g.fill();
    return;
  }
  if (o.k === 'faro') {
    g.fillStyle = '#f4f4f8'; g.beginPath(); g.moveTo(-7, 0); g.lineTo(-5, -40); g.lineTo(5, -40); g.lineTo(7, 0); g.closePath(); g.fill();
    g.fillStyle = '#ef4d5a';
    for (const [y0, y1] of [[-8, -16], [-24, -32]]) { const w0 = 7 - (-y0) / 40 * 2, w1 = 7 - (-y1) / 40 * 2; g.beginPath(); g.moveTo(-w0, y0); g.lineTo(-w1, y1); g.lineTo(w1, y1); g.lineTo(w0, y0); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(40, 50, 120, 0.2)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-lato * 7, 0); g.lineTo(-lato * 5, -40); g.lineTo(0, -40); g.closePath(); g.fill();
    g.fillStyle = '#3d4a7a'; g.fillRect(-7, -42, 14, 3);
    g.fillStyle = '#fff4c8'; g.fillRect(-4, -48, 8, 6);
    g.fillStyle = '#ef4d5a'; g.beginPath(); g.moveTo(-6, -48); g.lineTo(0, -55); g.lineTo(6, -48); g.closePath(); g.fill();
    return;
  }
  // scoglio
  g.fillStyle = '#8a93b8'; g.beginPath(); g.moveTo(-7, 2); g.lineTo(-2, -7); g.lineTo(4, -4); g.lineTo(7, 2); g.closePath(); g.fill();
}

function disegnaNuvola(g, n, angL) {
  const a = n.a + rot + tempo * n.v;
  const x = C.x + Math.cos(a) * n.r, y = C.y + Math.sin(a) * n.r;
  g.save();
  g.translate(x, y); g.rotate(a + Math.PI / 2); g.scale(n.s, n.s);
  const angLoc = angL - (a + Math.PI / 2);
  // ombra lunga della nuvola nello spazio, tenue
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(-14, 0, 9, 0, 7); g.arc(0, -5, 13, 0, 7); g.arc(15, 0, 9, 0, 7);
  g.roundRect(-23, -2, 46, 11, 5.5);
  g.fill();
  g.fillStyle = '#d9e6ff';
  g.beginPath(); g.roundRect(-23, 3, 46, 6, 3); g.fill();
  g.restore();
}

function disegnaStormo(g, t) {
  for (let i = 0; i < 5; i++) {
    const a = -t * 0.16 + i * 0.07 + (i % 2) * 0.02 + rot * 0.3 + 2.4;
    const r = R + 95 + (i % 3) * 9 + Math.sin(t * 1.3 + i) * 4;
    const x = C.x + Math.cos(a) * r, y = C.y + Math.sin(a) * r;
    const ali = Math.sin(t * 9 + i * 1.3);
    g.save();
    g.translate(x, y); g.rotate(a + Math.PI);          // vola in senso antiorario
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(0, 0, 5, 2.4, 0, 0, 7); g.fill();
    g.fillStyle = '#ffd35a'; g.beginPath(); g.moveTo(-5, -0.5); g.lineTo(-8, 0.5); g.lineTo(-5, 1.2); g.fill();
    g.fillStyle = '#e3ecff';
    g.beginPath(); g.moveTo(-1, 0); g.lineTo(2 + ali * 1.5, -8 * ali); g.lineTo(4, 0); g.closePath(); g.fill();
    g.restore();
  }
}

// ── Cielo, sole, atmosfera ──
function disegnaSpazio(t) {
  const g = ctx.createLinearGradient(0, 0, 0, 720);
  g.addColorStop(0, '#101542'); g.addColorStop(1, '#1c1e58');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, 720);
  // nebulose: macchie tonde e morbide
  for (const [x, y, r, col] of [[VW * 0.82, 150, 260, 'rgba(160, 80, 220, 0.16)'], [VW * 0.9, 560, 300, 'rgba(40, 170, 200, 0.10)'], [VW * 0.2, 620, 280, 'rgba(230, 80, 160, 0.09)']]) {
    const n = ctx.createRadialGradient(x, y, 0, x, y, r);
    n.addColorStop(0, col); n.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = n; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (const s of stelle) {
    const k = 0.55 + 0.45 * Math.sin(t * 1.7 + s.f);
    ctx.fillStyle = s.col; ctx.globalAlpha = 0.5 + 0.5 * k;
    if (s.croce) {
      const l = 5 * k + 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - l); ctx.quadraticCurveTo(s.x, s.y, s.x + l, s.y); ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + l);
      ctx.quadraticCurveTo(s.x, s.y, s.x - l, s.y); ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - l); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // sole: aloni piatti concentrici, poi il disco
  const S = SOLE();
  for (let i = 6; i >= 1; i--) {
    ctx.fillStyle = `rgba(255, 200, 90, ${0.045 + (6 - i) * 0.008})`;
    ctx.beginPath(); ctx.arc(S.x, S.y, 46 + i * 26 + Math.sin(t * 1.2 + i) * 2, 0, 7); ctx.fill();
  }
  const sg = ctx.createRadialGradient(S.x - 10, S.y - 10, 4, S.x, S.y, 48);
  sg.addColorStop(0, '#fff8d8'); sg.addColorStop(0.55, '#ffe07a'); sg.addColorStop(1, '#ffb347');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(S.x, S.y, 48, 0, 7); ctx.fill();
}
function disegnaAtmosfera() {
  const L = dirLuce();
  const a = ctx.createRadialGradient(C.x, C.y, R * 0.98, C.x, C.y, R * 1.34);
  a.addColorStop(0, 'rgba(110, 200, 255, 0.42)'); a.addColorStop(0.4, 'rgba(90, 160, 255, 0.14)'); a.addColorStop(1, 'rgba(80, 120, 255, 0)');
  ctx.fillStyle = a; ctx.beginPath(); ctx.arc(C.x, C.y, R * 1.34, 0, 7); ctx.fill();
  const b = ctx.createRadialGradient(C.x + L.x * R * 0.55, C.y + L.y * R * 0.55, R * 0.3, C.x + L.x * R * 0.55, C.y + L.y * R * 0.55, R * 1.05);
  b.addColorStop(0, 'rgba(150, 230, 255, 0.28)'); b.addColorStop(1, 'rgba(150, 230, 255, 0)');
  ctx.fillStyle = b; ctx.beginPath(); ctx.arc(C.x, C.y, R * 1.3, 0, 7); ctx.fill();
}

// ── Luci della notte, sopra al buio ──
function disegnaLuci(emissivi, t) {
  ctx.save();
  for (const { o, m } of emissivi) {
    const p = superficie(o.a);
    const n = notte(p.x, p.y);
    ctx.setTransform(m);
    if (o.k === 'casa') {
      const l = Math.max(0, o.luce);
      if (l < 0.02) continue;
      const s = 0.6 + 0.4 * Math.min(1.3, l);
      ctx.globalCompositeOperation = 'lighter';
      for (const [wx, wy] of [[6, -8], [-6.25, -9]]) {
        const gl = ctx.createRadialGradient(wx, wy, 0, wx, wy, 14 * s);
        gl.addColorStop(0, `rgba(255, 190, 80, ${0.5 * Math.min(1, l)})`); gl.addColorStop(1, 'rgba(255, 150, 60, 0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(wx, wy, 14 * s, 0, 7); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255, 214, 102, ${Math.min(1, l)})`;
      ctx.fillRect(6 - 2 * s, -8 - 2 * s, 4 * s, 4 * s); ctx.fillRect(-6.25 - 1.75 * s, -9 - 2 * s, 3.5 * s, 4 * s);
    } else if (o.k === 'faro' && n > 0.1) {
      ctx.globalCompositeOperation = 'lighter';
      const sw = Math.sin(t * 1.4) * 1.3;
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.translate(0, -45); ctx.rotate(sw + (dir > 0 ? 0 : Math.PI));
        const lg = ctx.createLinearGradient(0, 0, 150, 0);
        lg.addColorStop(0, `rgba(255, 240, 170, ${0.55 * n})`); lg.addColorStop(1, 'rgba(255, 240, 170, 0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(150, -22); ctx.lineTo(150, 22); ctx.lineTo(0, 2); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      const gl = ctx.createRadialGradient(0, -45, 0, 0, -45, 18);
      gl.addColorStop(0, `rgba(255, 245, 190, ${0.9 * n})`); gl.addColorStop(1, 'rgba(255, 220, 120, 0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, -45, 18, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
}

// ── Scintille del clic (anelli che si allargano) ──
const scintille = [];

// ── Ingresso: trascinamento con inerzia, clic per piantare ──
let trascina = null;
function angoloDi(e) { return Math.atan2(e.clientY / U - C.y, e.clientX / U - C.x); }
cv.addEventListener('pointerdown', e => {
  trascina = { a: angoloDi(e), x: e.clientX, y: e.clientY, mosso: 0, ultimo: angoloDi(e), v: 0 };
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (!trascina) { cv.style.cursor = Math.hypot(e.clientX / U - C.x, e.clientY / U - C.y) < R * 1.4 ? 'grab' : 'default'; return; }
  const a = angoloDi(e), d = angDiff(a, trascina.ultimo);
  trascina.mosso += Math.hypot(e.clientX - trascina.x, e.clientY - trascina.y); trascina.x = e.clientX; trascina.y = e.clientY;
  if (trascina.mosso > 6) { rot += d; trascina.v = trascina.v * 0.6 + d * 60 * 0.4; cv.style.cursor = 'grabbing'; }
  trascina.ultimo = a;
});
cv.addEventListener('pointerup', e => {
  if (!trascina) return;
  if (trascina.mosso <= 6) pianta(e.clientX / U, e.clientY / U);
  else vrot = Math.max(-4, Math.min(4, trascina.v));
  trascina = null; cv.style.cursor = 'grab';
});
function pianta(x, y) {
  const d = Math.hypot(x - C.x, y - C.y);
  if (d < R * 0.55 || d > R * 1.45) return;
  const phi = Math.atan2(y - C.y, x - C.x) - rot;
  if (terra(phi)) {
    const vicino = OGG.some(o => o.k !== 'albero' && Math.abs(angDiff(o.a, phi)) < 0.05);
    const ph = vicino ? phi + 0.06 : phi;
    OGG.push({ k: 'albero', a: ph, tipo: Math.random() < 0.35 ? 'abete' : 'tondo', s: 0.75 + Math.random() * 0.4, cresci: 0, col: Math.floor(Math.random() * 3) });
    OGG.sort((p, q) => (p.k === 'monte' ? -1 : 0) - (q.k === 'monte' ? -1 : 0));
    scintille.push({ a: ph, t: 0 });
  } else onde.push({ a: phi, t: 0 });
}

function aggiorna(dt, t) {
  tempo = t;
  if (dt <= 0) return;
  const ax = Demo.asse().x + Demo.guarda().x;
  if (!trascina) {
    vrot += ax * 3 * dt;
    vrot *= Math.exp(-1.4 * dt);
    rot += (0.07 + vrot) * dt;
  }
  for (const o of OGG) {
    if (o.k === 'albero' && o.cresci < 99) o.cresci += dt;
    if (o.k === 'casa') {                // le finestre si accendono a molla, ognuna col suo ritardo
      const p = superficie(o.a);
      const n = notte(p.x, p.y);
      const obj = n > 0.35 + o.rit * 0.3 ? 1 : 0;
      o.vl += ((obj - o.luce) * 140 - o.vl * 9) * dt;
      o.luce += o.vl * dt;
    }
  }
  for (const w of onde) w.t += dt;
  while (onde.length && onde[0].t > 1.2) onde.shift();
  for (const s of scintille) s.t += dt;
  while (scintille.length && scintille[0].t > 0.6) scintille.shift();
}

function disegna(t) {
  const emissivi = disegnaPianeta(t);
  ctx.setTransform(DPR * U, 0, 0, DPR * U, 0, 0);
  disegnaSpazio(t);
  disegnaAtmosfera();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(pc, 0, 0);
  disegnaLuci(emissivi.map(e => ({ o: e.o, m: e.m })), t);
  ctx.setTransform(DPR * U, 0, 0, DPR * U, 0, 0);
  for (const s of scintille) {
    const p = superficie(s.a, 10), k = s.t / 0.6;
    ctx.strokeStyle = `rgba(255, 255, 255, ${1 - k})`; ctx.lineWidth = 2.5 * (1 - k);
    ctx.beginPath(); ctx.arc(p.x, p.y, 8 + k * 30, 0, 7); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * 6.283 + p.a, r0 = 10 + k * 26, r1 = 14 + k * 36;
      ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0); ctx.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1); ctx.stroke();
    }
  }
}

try {
  Demo.carica('Arrotondo gli angoli');
  ridimensiona();
  cv.style.cursor = 'grab';
  // in foto, un albero appena piantato a metà del suo rimbalzo
  if (Demo.shot) OGG.push({ k: 'albero', a: -1.62, tipo: 'tondo', s: 1.05, cresci: -1.2, col: 1 });
  Demo.loop((dt, t) => { aggiorna(Math.min(dt, 1 / 30), t); disegna(t); });
  Demo.pronto();
} catch (e) { Demo.errore(e); }
