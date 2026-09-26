// Scarabocchi — un gioco a salti verticali disegnato a biro su un quaderno a quadretti.
// Tutto è canvas 2D. Ogni tratto di penna è una spezzata ricampionata e fatta tremare con un
// rumore che cambia solo 9 volte al secondo (line boil): il disegno "vibra" come un cartone
// fatto a mano, mentre la carta, i quadretti e la macchia di caffè restano fermi.
'use strict';

const cv = document.createElement('canvas');
document.body.prepend(cv);
const ctx = cv.getContext('2d');

// ── Misure. Si disegna in "unità": lo schermo è sempre alto 720 unità. ──
const PAGEW = 505;               // larghezza di una pagina del quaderno aperto
const MARG = 58;                 // distanza del margine rosso dalla rilegatura
const AW = PAGEW - MARG - 10;    // larghezza dell'area di gioco (pagina destra)
const QUAD = 20;                 // lato di un quadretto
let W = 0, H = 0, DPR = 1, U = 1, VW = 1280, GX = 640, AX0 = 0;

function ridimensiona() {
  DPR = Demo.shot ? 1 : Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  U = H / 720; VW = W / U;
  GX = Math.min(VW / 2, VW - PAGEW - 14);        // la pagina destra (quella del gioco) sta sempre tutta dentro
  AX0 = GX + MARG + 4;
}
addEventListener('resize', ridimensiona);

// ── Caso: hash intero (per il tremolio, dipende dal fotogramma di boil) e generatore con seme ──
function hash(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x3c6ef372, 0x165667b1) ^ Math.imul((c | 0) + 0x5bd1e995, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── La penna ──
const BLU = '#1c3591', ROSSO = '#c4212b', MATITA = '#5a5a60';
const GIALLO = 'rgba(255, 232, 40, 0.50)', VERDE = 'rgba(150, 235, 70, 0.55)', ROSA = 'rgba(255, 120, 190, 0.40)';
let BOIL = 0;          // fotogramma di boil: cambia ~9 volte al secondo
let SEME = 1, CNT = 0; // seme dell'oggetto e contatore dei tratti al suo interno
function seme(s) { SEME = s | 0; CNT = 0; }

/** Un tratto di biro lungo una spezzata [[x,y],...]: ricampionato, tremolante, ripassato. */
function tratto(pts, o = {}) {
  const col = o.col || BLU, lw = o.lw || 1.55, amp = o.amp ?? 1.0, passate = o.passate ?? 2;
  const chiuso = !!o.chiuso, passo = o.passo || 13;
  const k = CNT++;
  const P = chiuso ? pts.concat([pts[0]]) : pts;
  const R = [];
  for (let i = 0; i < P.length - 1; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / passo));
    for (let s = 0; s < n; s++) R.push([x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n]);
  }
  R.push(P[P.length - 1]);
  if (chiuso && R.length > 2) {             // la penna ripassa un pezzetto dell'inizio
    const f = 0.3 + hash(SEME, k, BOIL + 7) * 0.9;
    R.push([R[1][0] * f + R[0][0] * (1 - f), R[1][1] * f + R[0][1] * (1 - f)]);
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let p = 0; p < passate; p++) {
    const b = k * 31 + p * 7;
    const ox = (hash(SEME, b, BOIL) - 0.5) * amp * 1.4, oy = (hash(SEME, b + 1, BOIL) - 0.5) * amp * 1.4;
    const Q = R.map(([x, y], i) => [
      x + ox + (hash(SEME + b * 3, i * 2, BOIL) - 0.5) * 2 * amp,
      y + oy + (hash(SEME + b * 3, i * 2 + 1, BOIL) - 0.5) * 2 * amp]);
    if (!chiuso && Q.length > 1) {          // i capi sforano un poco, come un tratto veloce
      const e0 = hash(SEME, b + 2, BOIL) * 2.4, e1 = hash(SEME, b + 3, BOIL) * 3.2;
      const [a, c] = [Q[0], Q[1]], L0 = Math.hypot(a[0] - c[0], a[1] - c[1]) || 1;
      Q[0] = [a[0] + (a[0] - c[0]) / L0 * e0, a[1] + (a[1] - c[1]) / L0 * e0];
      const n = Q.length, [z, y] = [Q[n - 1], Q[n - 2]], L1 = Math.hypot(z[0] - y[0], z[1] - y[1]) || 1;
      Q[n - 1] = [z[0] + (z[0] - y[0]) / L1 * e1, z[1] + (z[1] - y[1]) / L1 * e1];
    }
    ctx.beginPath();
    ctx.moveTo(Q[0][0], Q[0][1]);
    if (Q.length < 3) ctx.lineTo(Q[Q.length - 1][0], Q[Q.length - 1][1]);
    else {
      for (let i = 1; i < Q.length - 1; i++) {
        const mx = (Q[i][0] + Q[i + 1][0]) / 2, my = (Q[i][1] + Q[i + 1][1]) / 2;
        ctx.quadraticCurveTo(Q[i][0], Q[i][1], mx, my);
      }
      ctx.lineTo(Q[Q.length - 1][0], Q[Q.length - 1][1]);
    }
    ctx.strokeStyle = col;
    ctx.globalAlpha = (o.alpha ?? 0.9) * (p ? 0.55 : 1);
    ctx.lineWidth = lw * (p ? 0.7 : 1) * (0.85 + 0.3 * hash(SEME, b + 4, BOIL));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
const linea = (x0, y0, x1, y1, o) => tratto([[x0, y0], [x1, y1]], o);

/** Ellisse a mano: parte da un angolo a caso e si chiude sormontando l'inizio. */
function ellisse(cx, cy, rx, ry, o = {}) {
  const k = CNT;
  const a0 = hash(SEME, k, 99) * Math.PI * 2 + (o.fisso ? 0 : hash(SEME, k, BOIL) * 0.5);
  const giro = Math.PI * 2 + 0.25 + hash(SEME, k + 1, BOIL) * 0.45;
  const n = Math.max(10, Math.ceil((rx + ry) * 0.55));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + giro * i / n;
    const rr = 1 + 0.04 * Math.sin(a * 2 + k) + (i / n) * 0.05 * (hash(SEME, k + 2, BOIL) - 0.5);
    pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]);
  }
  tratto(pts, { passo: 8, ...o });
}
function puntino(x, y, r = 1.7, col = BLU) {
  const k = CNT++;
  ctx.fillStyle = col; ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.arc(x + (hash(SEME, k, BOIL) - 0.5) * 0.9, y + (hash(SEME, k + 1, BOIL) - 0.5) * 0.9, r, 0, Math.PI * 2);
  ctx.fill(); ctx.globalAlpha = 1;
}

/** Tratteggio dentro un poligono: linee parallele (a zig-zag se convesso), mai perfette. */
function tratteggio(poly, o = {}) {
  const ang = o.ang ?? -0.85, sp = o.sp || 4.5, zig = o.zig ?? true;
  const k = CNT++;
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const rp = poly.map(([x, y]) => [x * c - y * s, x * s + y * c]);
  let y0 = Infinity, y1 = -Infinity;
  for (const p of rp) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const segs = [];
  const off = hash(SEME, k, BOIL) * sp;
  for (let y = y0 + off; y < y1; y += sp) {
    const xs = [];
    for (let i = 0; i < rp.length; i++) {
      const a = rp[i], b = rp[(i + 1) % rp.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) segs.push([xs[i], xs[i + 1], y]);
  }
  const C = Math.cos(ang), S = Math.sin(ang);
  const giro = ([x, y]) => [x * C - y * S, x * S + y * C];
  ctx.beginPath();
  let dir = 0, primo = true;
  segs.forEach(([xa, xb, y], i) => {
    const L = xb - xa;
    xa += (hash(SEME + k, i * 2, BOIL) * 0.9 - 0.25) * Math.min(4, L * 0.3);
    xb -= (hash(SEME + k, i * 2 + 1, BOIL) * 0.9 - 0.25) * Math.min(4, L * 0.3);
    if (xb <= xa) return;
    const dy = (hash(SEME + k, i + 500, BOIL) - 0.5) * sp * 0.35;
    let A = giro([xa, y + dy]), B = giro([xb, y - dy]);
    if (dir) [A, B] = [B, A];
    if (zig && !primo) ctx.lineTo(A[0], A[1]); else ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    if (zig) dir ^= 1;
    primo = false;
  });
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = o.col || BLU; ctx.lineWidth = o.lw || 1.05; ctx.globalAlpha = o.alpha ?? 0.6;
  ctx.stroke(); ctx.globalAlpha = 1;
}

/** Passata di evidenziatore: punta a scalpello, colore in moltiplicazione. */
function evidenzia(pts, larg, col = GIALLO) {
  const k = CNT++;
  ctx.save();
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  ctx.strokeStyle = col; ctx.lineWidth = larg;
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = (hash(SEME, k * 9 + i, BOIL) - 0.5) * 1.2, jy = (hash(SEME, k * 9 + i + 50, BOIL) - 0.5) * 1.2;
    if (i) ctx.lineTo(x + jx, y + jy); else ctx.moveTo(x + jx, y + jy);
  });
  ctx.stroke();
  ctx.restore();
}

/** Scritta a mano con il font Gloria Hallelujah, che trema anche lei. */
function scrivi(txt, x, y, size, col = BLU, rot = 0, allinea = 'left') {
  const k = CNT++;
  ctx.save();
  ctx.translate(x + (hash(SEME, k, BOIL) - 0.5) * 1.1, y + (hash(SEME, k + 1, BOIL) - 0.5) * 1.1);
  ctx.rotate(rot + (hash(SEME, k + 2, BOIL) - 0.5) * 0.018);
  ctx.font = `${size}px Gloria, cursive`;
  ctx.textAlign = allinea; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = col; ctx.globalAlpha = 0.9;
  ctx.fillText(txt, 0, 0);
  ctx.globalAlpha = 0.35;
  ctx.fillText(txt, 0.6, 0.4);        // la biro ripassa e carica d'inchiostro
  ctx.restore();
}

function rettangolo(x, y, w, h, r) {
  const P = [];
  const c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= 3; i++) {
    const a = a0 + i / 3 * Math.PI / 2;
    P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return P;
}
function cerchioPoly(cx, cy, rx, ry, n = 18) {
  const P = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; P.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return P;
}

// ── Carta: grana pre-calcolata e macchia di caffè (fisiche: non tremano) ──
let grana = null, caffe = null;
function preparaCarta() {
  const g = document.createElement('canvas'); g.width = g.height = 256;
  const c = g.getContext('2d');
  const id = c.createImageData(256, 256), R = rng(7);
  for (let i = 0; i < 256 * 256; i++) {
    const v = 255 - R() * R() * 26;
    id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v - 2; id.data[i * 4 + 3] = 255;
  }
  c.putImageData(id, 0, 0);
  c.strokeStyle = 'rgba(150,140,120,0.10)'; c.lineWidth = 0.7;
  for (let i = 0; i < 70; i++) {        // fibre
    const x = R() * 256, y = R() * 256, a = R() * 6.28, l = 4 + R() * 12;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
  grana = ctx.createPattern(g, 'repeat');

  // la macchia: un alone chiaro irregolare con l'orlo scuro dove il caffè si è asciugato
  const m = document.createElement('canvas'); m.width = m.height = 320;
  const d = m.getContext('2d'), Rm = rng(21);
  const bordo = [];
  for (let i = 0; i < 90; i++) {
    const a = i / 90 * Math.PI * 2;
    bordo.push(112 + 7 * Math.sin(a * 3 + 1) + 4 * Math.sin(a * 7) + Rm() * 3);
  }
  const giro = (f) => { d.beginPath(); bordo.forEach((r, i) => { const a = i / 90 * Math.PI * 2; const x = 160 + Math.cos(a) * r * f, y = 160 + Math.sin(a) * r * f; i ? d.lineTo(x, y) : d.moveTo(x, y); }); d.closePath(); };
  giro(1); d.fillStyle = 'rgba(176, 120, 60, 0.08)'; d.fill();
  giro(0.94); d.fillStyle = 'rgba(176, 120, 60, 0.04)'; d.fill();
  d.lineJoin = 'round';
  giro(0.985); d.strokeStyle = 'rgba(130, 78, 30, 0.34)'; d.lineWidth = 4.5; d.filter = 'blur(1.2px)'; d.stroke();
  giro(1.0); d.strokeStyle = 'rgba(110, 62, 20, 0.40)'; d.lineWidth = 1.6; d.filter = 'none'; d.stroke();
  // un secondo anello spostato (la tazza appoggiata due volte) e qualche goccia
  d.beginPath(); d.arc(206, 196, 104, 3.6, 5.6); d.strokeStyle = 'rgba(130, 78, 30, 0.22)'; d.lineWidth = 3; d.stroke();
  for (let i = 0; i < 7; i++) {
    const a = Rm() * 6.28, r = 128 + Rm() * 26, s = 2 + Rm() * 5;
    d.beginPath(); d.arc(160 + Math.cos(a) * r, 160 + Math.sin(a) * r, s, 0, 6.28);
    d.fillStyle = 'rgba(150, 95, 40, 0.28)'; d.fill();
  }
  caffe = m;
}

// ── Il gioco ──
const G = 1850, SALTO = 905, MOLLA = 1450, VXMAX = 520;
const PW = 74, PH = 14;
let mondo;          // stato della partita
let record = 0, tentativi = 0;

function nuovaPartita() {
  const R = rng(1234 + tentativi * 7919);
  const w = AW;
  const piatte = [], mostri = [];
  let id = 1;
  const add = (fx, y, tipo = 'n') => { const p = { id: id++, x: fx * w, y, tipo, vx: tipo === 'm' ? 85 : 0, rotta: false }; piatte.push(p); return p; };
  // la prima schermata è composta a mano: così l'anteprima mostra tutto il repertorio
  add(0.50, 632); add(0.16, 548); add(0.80, 508, 's'); add(0.44, 436, 'm');
  add(0.88, 352, 'r'); add(0.22, 336); add(0.58, 248); add(0.12, 158); add(0.66, 88, 'm'); add(0.34, 8);
  mostri.push({ id: 900, x: 0.80 * w, y: 186, fase: 0, morto: false, vy: 0, rot: 0 });
  mondo = {
    R, piatte, mostri, id, alto: 8, prossimoMostro: -1300,
    p: { x: 0.5 * w, y: 632, vx: 0, vy: 0, dir: 1, sq: 1, morto: false, rot: 0, tAria: 0 },
    cam: 0, punti: 0, ops: 0, pezzi: [], segni: [],
  };
}

function genera() {
  const m = mondo, R = m.R;
  while (m.alto > m.cam - 900) {
    const salito = 632 - m.alto;
    const gap = 58 + R() * (40 + Math.min(92, salito / 45));
    m.alto -= gap;
    const r = R();
    const tipo = salito < 400 ? 'n' : r < 0.15 ? 'm' : r < 0.22 ? 's' : 'n';
    m.piatte.push({ id: m.id++, x: 10 + R() * (AW - 20), y: m.alto, tipo, vx: tipo === 'm' ? (R() < 0.5 ? -1 : 1) * (70 + R() * 60) : 0, rotta: false });
    if (R() < 0.2) {                       // qualche piattaforma rossa in più: si spezza
      m.piatte.push({ id: m.id++, x: 10 + R() * (AW - 20), y: m.alto + gap * (0.35 + R() * 0.3), tipo: 'r', vx: 0, rotta: false });
    }
    if (m.alto < m.prossimoMostro) {
      m.prossimoMostro -= 1100 + R() * 900;
      const ultima = m.piatte[m.piatte.length - 1].x;
      let x = (ultima + AW * (0.35 + R() * 0.3)) % AW;
      m.mostri.push({ id: m.id++, x, y: m.alto - gap * 0.5, fase: R() * 6, morto: false, vy: 0, rot: 0 });
    }
  }
  m.piatte = m.piatte.filter(p => p.y < m.cam + 820);
  m.mostri = m.mostri.filter(p => p.y < m.cam + 900);
}

function aggiorna(dt) {
  const m = mondo, p = m.p;
  if (dt <= 0) return;
  // piattaforme che si muovono
  for (const q of m.piatte) if (q.tipo === 'm') {
    q.x += q.vx * dt;
    if (q.x < PW / 2) { q.x = PW / 2; q.vx = Math.abs(q.vx); }
    if (q.x > AW - PW / 2) { q.x = AW - PW / 2; q.vx = -Math.abs(q.vx); }
  }
  for (const mo of m.mostri) {
    mo.fase += dt;
    if (mo.morto) { mo.vy += G * dt; mo.y += mo.vy * dt; mo.rot += dt * 6; }
  }
  for (const pz of m.pezzi) { pz.vy += G * 0.8 * dt; pz.y += pz.vy * dt; pz.x += pz.vx * dt; pz.rot += pz.vr * dt; }
  m.pezzi = m.pezzi.filter(pz => pz.y < m.cam + 900);
  for (const s of m.segni) s.t += dt;
  m.segni = m.segni.filter(s => s.t < s.durata);

  if (m.ops > 0) {                     // caduta: si aspetta, poi si ricomincia
    m.ops += dt;
    p.vy += G * dt; p.y += p.vy * dt; p.rot += dt * 7 * p.dir;
    if (m.ops > 2.1) { tentativi++; nuovaPartita(); }
    return;
  }

  const ax = Demo.asse().x;
  if (ax) { p.vx += ax * 2600 * dt; p.dir = ax > 0 ? 1 : -1; }
  else p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), 1900 * dt);
  p.vx = Math.max(-VXMAX, Math.min(VXMAX, p.vx));
  const yPrima = p.y;
  p.vy += G * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.x < -12) p.x += AW + 24;              // si esce da un lato e si rientra dall'altro
  if (p.x > AW + 12) p.x -= AW + 24;
  p.sq += (1 - p.sq) * Math.min(1, dt * 12);
  p.tAria += dt;

  if (p.vy > 0) {
    for (const q of m.piatte) {
      if (q.rotta) continue;
      if (yPrima <= q.y + 2 && p.y >= q.y && Math.abs(p.x - q.x) < PW / 2 + 11) {
        if (q.tipo === 'r') {             // la piattaforma rossa si spezza e non ti regge
          q.rotta = true;
          for (const s of [-1, 1]) m.pezzi.push({ id: q.id * 2 + (s > 0 ? 1 : 0), x: q.x + s * PW / 4, y: q.y, vx: s * 40, vy: 60, rot: 0, vr: s * 2.4, lato: s });
          continue;
        }
        p.y = q.y;
        const molla = q.tipo === 's' && Math.abs(p.x - (q.x + 16)) < 16;
        p.vy = molla ? -MOLLA : -SALTO;
        if (molla) q.scatto = 0.25;
        p.sq = 0.72; p.tAria = 0;
        m.segni.push({ tipo: 'tonf', x: p.x, y: q.y, t: 0, durata: 0.22, id: m.id++ });
        break;
      }
    }
  }
  for (const q of m.piatte) if (q.scatto) q.scatto = Math.max(0, q.scatto - dt);

  // il mostriciattolo: dall'alto lo schiacci, di lato ti prende
  for (const mo of m.mostri) {
    if (mo.morto) continue;
    const mx = mo.x + Math.sin(mo.fase * 1.7) * 14, my = mo.y + Math.sin(mo.fase * 3.1) * 4;
    const dx = p.x - mx, dy = (p.y - 24) - my;
    if (Math.hypot(dx, dy) < 42) {
      if (p.vy > 0 && p.y < my + 4) {
        mo.morto = true; mo.vy = -200; p.vy = -SALTO * 1.1; p.sq = 0.7;
        m.segni.push({ tipo: 'sbam', x: mx, y: my, t: 0, durata: 0.7, id: m.id++ });
      } else {
        m.ops = 0.001; p.vy = Math.max(p.vy, 150); p.vx = 0;
      }
    }
  }

  // telecamera: sale e basta
  const bersaglio = Math.min(m.cam, p.y - 300);
  m.cam += (bersaglio - m.cam) * Math.min(1, dt * 9);
  m.punti = Math.max(m.punti, Math.round((632 - p.y) / 6));
  record = Math.max(record, m.punti);
  if (p.y > m.cam + 760) m.ops = 0.001;     // caduto giù dal foglio
  genera();
}

// ── Disegno degli oggetti ──
function disegnaPiatta(q) {
  seme(q.id * 13 + 5);
  const x = AX0 + q.x - PW / 2, y = q.y - mondo.cam;
  if (y < -40 || y > 760) return;
  const col = q.tipo === 'r' ? ROSSO : BLU;
  const poly = rettangolo(x, y, PW, PH, 6);
  if (q.tipo === 'm') evidenzia([[x - 3, y + PH * 0.55], [x + PW + 3, y + PH * 0.45]], PH + 7, GIALLO);
  // ombra a tratteggio incrociato sotto e a destra: il foglio diventa un gradino
  const om = [[x + 6, y + PH + 1], [x + PW - 2, y + PH + 1], [x + PW + 4, y + PH + 7], [x + 11, y + PH + 7]];
  tratteggio(om, { ang: 0.9, sp: 2.8, col, alpha: 0.45, lw: 0.9 });
  tratteggio(poly, { ang: -0.95, sp: q.tipo === 'm' ? 7 : 4.6, col, alpha: q.tipo === 'm' ? 0.45 : 0.55 });
  tratto(poly, { chiuso: true, col });
  if (q.tipo === 'r') {                    // la crepa
    const cx = x + PW / 2;
    tratto([[cx - 2, y - 1], [cx + 3, y + 4], [cx - 3, y + 8], [cx + 2, y + PH + 1]], { col: ROSSO, lw: 1.3, passate: 1 });
  }
  if (q.tipo === 'm') {                    // frecce ai lati
    for (const s of [-1, 1]) {
      const ax = s < 0 ? x - 8 : x + PW + 8, cy = y + PH / 2;
      tratto([[ax - s * 6, cy], [ax + s * 6, cy]], { lw: 1.2, passate: 1 });
      tratto([[ax + s * 1, cy - 4], [ax + s * 6, cy], [ax + s * 1, cy + 4]], { lw: 1.2, passate: 1 });
    }
  }
  if (q.tipo === 's') {                    // la molla
    const sx = x + PW / 2 + 16, h = q.scatto ? 26 : 13, n = 5;
    const pts = [];
    for (let i = 0; i <= n * 2; i++) pts.push([sx + (i % 2 ? 7 : -7) * (i && i < n * 2 ? 1 : 0.4), y - i / (n * 2) * h]);
    tratto(pts, { lw: 1.4, passo: 6 });
    linea(sx - 10, y - h - 1, sx + 10, y - h - 1, { lw: 2.1 });
  }
}

function disegnaPezzo(pz) {
  seme(pz.id * 7 + 3);
  const y = pz.y - mondo.cam;
  ctx.save();
  ctx.translate(AX0 + pz.x, y + PH / 2); ctx.rotate(pz.rot);
  const w = PW / 2;
  const poly = pz.lato < 0
    ? [[-w / 2, -PH / 2], [w / 2 - 2, -PH / 2], [w / 2 + 3, -PH / 2 + 5], [w / 2 - 3, PH / 2 - 5], [w / 2 + 2, PH / 2], [-w / 2, PH / 2]]
    : [[-w / 2 + 2, -PH / 2], [w / 2, -PH / 2], [w / 2, PH / 2], [-w / 2 + 2, PH / 2], [-w / 2 - 3, PH / 2 - 5], [-w / 2 + 3, -PH / 2 + 5]];
  tratteggio(poly, { ang: -0.95, sp: 4.6, col: ROSSO, alpha: 0.5 });
  tratto(poly, { chiuso: true, col: ROSSO });
  ctx.restore();
}

function disegnaMostro(mo) {
  seme(mo.id * 17 + 1);
  const mx = AX0 + mo.x + (mo.morto ? 0 : Math.sin(mo.fase * 1.7) * 14);
  const my = mo.y - mondo.cam + (mo.morto ? 0 : Math.sin(mo.fase * 3.1) * 4);
  if (my < -80 || my > 800) return;
  ctx.save();
  ctx.translate(mx, my); ctx.rotate(mo.rot); ctx.scale(1.15, 1.15);
  // ali a zig-zag che sbattono
  const ala = Math.sin(mo.fase * 14) * 0.5;
  for (const s of [-1, 1]) {
    const pts = [[s * 22, -4]];
    for (let i = 1; i <= 4; i++) {
      const a = -0.5 - ala * s * 0 + (i / 4) * 1.1 - ala;
      pts.push([s * (22 + i * 8), -6 - Math.sin(a) * 18 + (i % 2 ? -6 : 4)]);
    }
    pts.push([s * 24, 8]);
    tratteggio(pts, { ang: s * 0.6, sp: 3.5, alpha: 0.4 });
    tratto(pts, { lw: 1.3 });
  }
  // corpo a groviglio: la penna gira in tondo finché il mostro è nero
  const k = 40, pts = [];
  for (let i = 0; i < k; i++) {
    const a = i * 2.39 + hash(SEME, i, BOIL) * 0.8;
    const r = 0.35 + 0.65 * Math.sqrt(hash(SEME, i + 100, BOIL));
    pts.push([Math.cos(a) * 24 * r, Math.sin(a) * 21 * r + 2]);
  }
  tratto(pts, { lw: 1.25, passate: 1, amp: 0.6, alpha: 0.8 });
  ellisse(0, 2, 25, 22, { lw: 1.7 });
  // corna
  for (const s of [-1, 1]) tratto([[s * 9, -17], [s * 14, -31], [s * 17, -15]], { lw: 1.5 });
  // occhi (bianchi: la carta risparmiata), bocca rossa con i denti
  ctx.fillStyle = '#f7f4ec';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 9, -4, 7.5, 8.5, 0, 0, 7); ctx.fill(); }
  for (const s of [-1, 1]) {
    ellisse(s * 9, -4, 7.5, 8.5, { lw: 1.4 });
    if (mo.morto) { linea(s * 9 - 4, -8, s * 9 + 4, 0, { col: ROSSO }); linea(s * 9 + 4, -8, s * 9 - 4, 0, { col: ROSSO }); }
    else puntino(s * 9 + Math.sin(mo.fase * 2) * 2.5, -2, 2.4);
  }
  ctx.fillStyle = '#f7f4ec';
  ctx.beginPath(); ctx.ellipse(0, 12, 12, 5, 0, 0, 7); ctx.fill();
  tratto([[-12, 11], [-8, 16], [-4, 10], [0, 16], [4, 10], [8, 16], [12, 11]], { col: ROSSO, lw: 1.3, passo: 5 });
  ellisse(0, 12, 13, 5.5, { col: ROSSO, lw: 1.3 });
  // gambette
  for (const s of [-1, 1]) tratto([[s * 8, 22], [s * 10, 31], [s * 15, 31]], { lw: 1.4 });
  ctx.restore();
}

function corpoOmino() {
  const P = [], rx = 17.5, ry = 21, cy = -21;
  for (let i = 0; i < 28; i++) {
    const a = -Math.PI / 2 + i / 28 * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    if (s > 0) P.push([rx * Math.sign(c) * Math.pow(Math.abs(c), 0.55), cy + ry * Math.pow(s, 0.55)]);
    else P.push([rx * c, cy + ry * s]);
  }
  return P;
}
const CORPO = corpoOmino();

function disegnaOmino() {
  const p = mondo.p;
  seme(77);
  const x = AX0 + p.x, y = p.y - mondo.cam;
  const salendo = p.vy < -250;
  const gamba = p.sq < 0.9 ? 3 : salendo ? 5 : 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.rot);
  ctx.scale(1.25, 1.25);
  const stira = p.vy < -700 ? 1.08 : 1;
  ctx.scale(p.dir * (1 + (1 - p.sq) * 0.55) / stira, p.sq * stira);
  // gambe
  for (const gx of [-11, -4, 3, 10]) {
    const k = gx * 0.08;
    tratto([[gx, -gamba - 2], [gx + k, 0], [gx + 4.5, 0]], { lw: 1.5, passo: 5 });
  }
  ctx.translate(0, -gamba);
  // evidenziatore verde dentro il corpo (sborda un po', come a scuola)
  evidenzia([[-15, -36], [14, -38]], 8, VERDE);
  evidenzia([[-18, -28], [17, -29]], 9, VERDE);
  evidenzia([[-18, -19], [18, -20]], 9, VERDE);
  evidenzia([[-17, -10], [17, -11]], 9, VERDE);
  evidenzia([[-16, -3], [15, -2]], 6, VERDE);
  tratto(CORPO, { chiuso: true, lw: 1.8, passo: 7 });
  // le righe dei pantaloni
  for (const ry of [-4, -9, -14]) linea(-16.5, ry, 16.5, ry - 0.5, { lw: 1.35, passate: 1 });
  // il muso a proboscide
  tratto([[11, -34], [26, -36]], { lw: 1.5 });
  tratto([[12, -27], [26, -29]], { lw: 1.5 });
  ellisse(27, -32.5, 2.6, 4.2, { lw: 1.4 });
  // occhi
  if (p.rot) { for (const ex of [2, 9]) { linea(ex - 2.5, -37, ex + 2.5, -32, { lw: 1.2, passate: 1 }); linea(ex + 2.5, -37, ex - 2.5, -32, { lw: 1.2, passate: 1 }); } }
  else { puntino(2, -34, 2.0); puntino(9, -35, 2.0); }
  // la schiena in ombra, a tratteggio
  tratteggio([[-17, -30], [-9, -40], [-12, -24], [-12, -18], [-17, -16]], { ang: 0.7, sp: 3, alpha: 0.5, zig: false });
  ctx.restore();

  // stelline sulla testa quando è finito male
  if (mondo.ops > 0 && p.rot) {
    for (let i = 0; i < 3; i++) {
      const a = mondo.ops * 5 + i * 2.1;
      const sx = x + Math.cos(a) * 26, sy = y - 58 + Math.sin(a) * 7;
      stellina(sx, sy, 5, ROSSO);
    }
  }
}

function stellina(x, y, r, col = BLU, lw = 1.3) {
  const pts = [];
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  tratto(pts, { col, lw, passo: 6 });
}

function disegnaSegni() {
  for (const s of mondo.segni) {
    seme(s.id * 5 + 2);
    const y = s.y - mondo.cam, x = AX0 + s.x;
    if (s.tipo === 'tonf') {             // lineette d'impatto sotto i piedi
      const k = s.t / s.durata;
      for (const d of [-1, 1]) {
        linea(x + d * (18 + k * 8), y - 2, x + d * (26 + k * 10), y - 6 - k * 2, { lw: 1.2, passate: 1, alpha: 0.8 * (1 - k) });
        linea(x + d * (16 + k * 6), y + 4, x + d * (25 + k * 8), y + 7, { lw: 1.2, passate: 1, alpha: 0.8 * (1 - k) });
      }
    } else if (s.tipo === 'sbam') {
      const k = s.t / s.durata;
      scrivi('sbam!', x + 20, y - 30 - k * 20, 24, ROSSO, -0.2);
    }
  }
}

// ── La pagina sinistra: appunti e scarabocchi (a blocchi di 720 unità, generati dal seme) ──
function disegnaPaginaSinistra() {
  const cam = mondo.cam, L = GX - PAGEW;
  const x0 = L + MARG + 14, larg = PAGEW - MARG - 40;
  const b0 = Math.floor(cam / 720) - 1, b1 = Math.floor((cam + 720) / 720) + 1;
  for (let b = b0; b <= b1; b++) {
    const oy = b * 720 - cam;
    if (b === 0) {
      seme(5000);
      scrivi('Lunedì 26', x0 + 6, oy + 150, 26, BLU, -0.02);
      linea(x0 + 4, oy + 160, x0 + 150, oy + 158, { lw: 1.3 });
      scrivi('compiti:', x0 + 6, oy + 200, 22, BLU, -0.01);
      scrivi('- pag. 42 es. 3, 4, 5', x0 + 20, oy + 232, 20, BLU, -0.01);
      scrivi('- ripassare i verbi', x0 + 20, oy + 262, 20, BLU, -0.015);
      linea(x0 + 18, oy + 256, x0 + 190, oy + 253, { col: ROSSO, lw: 1.5 });
      scrivi('- portare la merenda!!', x0 + 20, oy + 292, 20, BLU, -0.02);
      evidenzia([[x0 + 16, oy + 286], [x0 + 216, oy + 284]], 17, ROSA);
      // tris
      const tx = x0 + 250, ty = oy + 360, c = 30;
      linea(tx + c, ty, tx + c + 2, ty + c * 3, { lw: 1.5 }); linea(tx + c * 2, ty - 2, tx + c * 2 - 1, ty + c * 3, { lw: 1.5 });
      linea(tx - 2, ty + c, tx + c * 3, ty + c + 2, { lw: 1.5 }); linea(tx, ty + c * 2, tx + c * 3 + 2, ty + c * 2 - 1, { lw: 1.5 });
      const segni = [[0, 0, 'x'], [1, 1, 'o'], [2, 0, 'x'], [1, 0, 'o'], [2, 2, 'x'], [1, 2, 'o']];
      for (const [i, j, t] of segni) {
        const cx = tx + c * i + c / 2, cy = ty + c * j + c / 2;
        if (t === 'x') { linea(cx - 8, cy - 8, cx + 8, cy + 8, { col: ROSSO }); linea(cx + 8, cy - 8, cx - 8, cy + 8, { col: ROSSO }); }
        else ellisse(cx, cy, 9, 9);
      }
      linea(tx + c / 2, ty - 6, tx + c / 2 + 3, ty + c * 3 + 4, { col: BLU, lw: 2.2 });
      // sole sorridente
      disegnaSole(x0 + 70, oy + 420, 30);
      scrivi('SALTA!', x0 + 230, oy + 520, 30, ROSSO, -0.12);
      tratto([[x0 + 250, oy + 535], [x0 + 320, oy + 560], [x0 + 385, oy + 545]], { col: ROSSO, lw: 1.6 });
      tratto([[x0 + 373, oy + 536], [x0 + 387, oy + 545], [x0 + 377, oy + 557]], { col: ROSSO, lw: 1.6 });
      stellina(x0 + 40, oy + 600, 14, BLU, 1.5);
      scarabocchio(6, x0 + 330, oy + 90, rng(1));
      stellina(x0 + 380, oy + 60, 8);
      stellina(x0 + 80, oy + 640, 9, BLU, 1.3);
      disegnaSpirale(x0 + 170, oy + 610, 30);
      continue;
    }
    // blocchi successivi: 3 scarabocchi scelti dal seme
    const R = rng(b * 7717 + 3);
    for (let i = 0; i < 3; i++) {
      seme(b * 100 + i * 11 + 6000);
      const tipo = Math.floor(R() * 8), dx = x0 + 40 + R() * (larg - 110), dy = oy + 90 + i * 220 + R() * 90;
      scarabocchio(tipo, dx, dy, R);
    }
  }
}
function disegnaSole(x, y, r) {
  ellisse(x, y, r, r, { lw: 1.6 });
  evidenzia([[x - r * 0.7, y - r * 0.2], [x + r * 0.7, y - r * 0.25]], r * 0.9, GIALLO);
  evidenzia([[x - r * 0.5, y + r * 0.45], [x + r * 0.5, y + r * 0.4]], r * 0.55, GIALLO);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, l = i % 2 ? 12 : 20;
    linea(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5), x + Math.cos(a) * (r + 5 + l), y + Math.sin(a) * (r + 5 + l), { lw: 1.4 });
  }
  puntino(x - 9, y - 6, 2.4); puntino(x + 9, y - 6, 2.4);
  tratto([[x - 13, y + 7], [x, y + 15], [x + 13, y + 7]], { lw: 1.5 });
}
function disegnaSpirale(x, y, r) {
  const pts = [];
  for (let i = 0; i < 60; i++) { const a = i * 0.32, rr = r * i / 60; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  tratto(pts, { lw: 1.4, passo: 6 });
}
function scarabocchio(tipo, x, y, R) {
  switch (tipo) {
    case 0: disegnaSpirale(x, y, 28 + R() * 12); break;
    case 1: stellina(x, y, 22, BLU, 1.6); evidenzia([[x - 12, y + 2], [x + 12, y + 1]], 12, GIALLO); stellina(x + 40, y - 20, 9); break;
    case 2: { // cubo in prospettiva
      const s = 44, d = 18;
      tratto([[x, y], [x + s, y], [x + s, y + s], [x, y + s]], { chiuso: true });
      tratto([[x, y], [x + d, y - d], [x + s + d, y - d], [x + s, y]], {});
      tratto([[x + s + d, y - d], [x + s + d, y + s - d], [x + s, y + s]], {});
      tratteggio([[x + s, y], [x + s + d, y - d], [x + s + d, y + s - d], [x + s, y + s]], { ang: 1.2, sp: 3.2, alpha: 0.6 });
      break;
    }
    case 3: disegnaSole(x, y, 22); break;
    case 4: { // cuore trafitto
      const pts = [];
      for (let i = 0; i <= 30; i++) { const t = i / 30 * Math.PI * 2; pts.push([x + 16 * Math.pow(Math.sin(t), 3) * 1.4, y - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 1.4]); }
      tratteggio(pts, { col: ROSSO, sp: 3.5, alpha: 0.5 });
      tratto(pts, { col: ROSSO, lw: 1.7, passo: 6 });
      linea(x - 40, y + 22, x + 40, y - 20, { lw: 1.4 });
      tratto([[x + 30, y - 22], [x + 40, y - 20], [x + 36, y - 10]], { lw: 1.4 });
      break;
    }
    case 5: { // casetta
      tratto([[x - 25, y], [x + 25, y], [x + 25, y + 36], [x - 25, y + 36]], { chiuso: true });
      tratto([[x - 32, y + 3], [x, y - 26], [x + 32, y + 3]], { col: ROSSO });
      tratto([[x - 6, y + 36], [x - 6, y + 18], [x + 6, y + 18], [x + 6, y + 36]], {});
      tratto([[x + 12, y + 8], [x + 20, y + 8], [x + 20, y + 16], [x + 12, y + 16]], { chiuso: true, lw: 1.2 });
      disegnaSpirale(x + 20, y - 30, 7);
      break;
    }
    case 6: { // razzo
      const pts = [[x, y - 40], [x + 12, y - 18], [x + 12, y + 14], [x - 12, y + 14], [x - 12, y - 18]];
      tratto(pts, { chiuso: true });
      ellisse(x, y - 10, 5, 5, { lw: 1.2 });
      tratto([[x - 12, y + 2], [x - 22, y + 18], [x - 12, y + 14]], {});
      tratto([[x + 12, y + 2], [x + 22, y + 18], [x + 12, y + 14]], {});
      tratto([[x - 7, y + 16], [x - 3, y + 34], [x, y + 22], [x + 3, y + 36], [x + 7, y + 16]], { col: ROSSO });
      break;
    }
    default: { // fiore
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ellisse(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 8, 8, { lw: 1.2 }); }
      ellisse(x, y, 6, 6, { col: ROSSO });
      tratto([[x, y + 18], [x + 3, y + 45], [x - 2, y + 70]], {});
      tratto([[x + 2, y + 45], [x + 16, y + 36], [x + 4, y + 50]], {});
    }
  }
}

// ── Fondo: scrivania, due pagine, quadretti, margini, buchi ──
function disegnaFogli() {
  const cam = mondo.cam;
  // scrivania
  const g = ctx.createRadialGradient(VW * 0.62, 180, 50, VW * 0.5, 360, VW * 0.8);
  g.addColorStop(0, '#5b4838'); g.addColorStop(1, '#241b15');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, 720);
  const L = GX - PAGEW, Rr = GX + PAGEW;
  // i fogli sotto (bordo a gradini) e l'ombra del quaderno
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 22; ctx.shadowOffsetX = 6;
  ctx.fillStyle = '#e9e4d8'; ctx.fillRect(L - 3, -20, PAGEW * 2 + 8, 760);
  ctx.restore();
  ctx.fillStyle = '#ddd7ca'; ctx.fillRect(Rr, -20, 3, 760); ctx.fillRect(L - 3, -20, 3, 760);
  // carta
  ctx.fillStyle = '#f7f4ec'; ctx.fillRect(L, -20, PAGEW * 2, 760);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.translate(0, -(cam % 256) - 256);
  ctx.fillStyle = grana; ctx.fillRect(L, 0, PAGEW * 2, 720 + 520);
  ctx.restore();
  // quadretti
  ctx.save();
  ctx.beginPath(); ctx.rect(L, 0, PAGEW * 2, 720); ctx.clip();
  ctx.strokeStyle = 'rgba(90, 130, 185, 0.34)'; ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let x = GX + QUAD; x < Rr; x += QUAD) { ctx.moveTo(x, 0); ctx.lineTo(x, 720); }
  for (let x = GX - QUAD; x > L; x -= QUAD) { ctx.moveTo(x, 0); ctx.lineTo(x, 720); }
  const oy = -(((cam % QUAD) + QUAD) % QUAD);
  for (let y = oy; y < 720; y += QUAD) { ctx.moveTo(L, y); ctx.lineTo(Rr, y); }
  ctx.stroke();
  // margini rossi (doppia riga come sui quaderni di scuola)
  ctx.strokeStyle = 'rgba(214, 60, 70, 0.62)'; ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(GX + MARG, 0); ctx.lineTo(GX + MARG, 720);
  ctx.moveTo(L + MARG, 0); ctx.lineTo(L + MARG, 720);
  ctx.stroke();
  // la macchia di caffè (a cavallo della rilegatura, e poi ogni tanto)
  for (const [wy, wx, s] of [[560, GX - 60, 0.72], [-1900, GX - 300, 0.7], [-4300, GX + 120, 0.8]]) {
    const yy = wy - cam;
    if (yy > -200 && yy < 920) ctx.drawImage(caffe, wx - 160 * s, yy - 160 * s, 320 * s, 320 * s);
  }
  // ombra della rilegatura (la carta si curva)
  for (const s of [-1, 1]) {
    const gg = ctx.createLinearGradient(GX, 0, GX + s * 46, 0);
    gg.addColorStop(0, 'rgba(60, 45, 30, 0.30)'); gg.addColorStop(0.35, 'rgba(60, 45, 30, 0.08)'); gg.addColorStop(1, 'rgba(60, 45, 30, 0)');
    ctx.fillStyle = gg; ctx.fillRect(s < 0 ? GX - 46 : GX, 0, 46, 720);
  }
  ctx.fillStyle = 'rgba(40, 30, 20, 0.35)'; ctx.fillRect(GX - 0.6, 0, 1.2, 720);
  // buchi degli anelli
  const passoB = 96, oyB = -(((cam % passoB) + passoB) % passoB);
  for (let y = oyB + 40; y < 760; y += passoB) for (const s of [-1, 1]) {
    const hx = GX + s * 21;
    ctx.fillStyle = '#2a211b';
    ctx.beginPath(); ctx.arc(hx, y, 6.5, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(120, 100, 80, 0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(hx, y, 7.2, 0.4, 2.8); ctx.stroke();
  }
  ctx.restore();
}

function disegnaPunti() {
  const L = GX - PAGEW;
  seme(3000);
  const x = L + MARG + 22;
  ctx.save();
  evidenzia([[x - 6, 78], [x + 150, 74]], 34, GIALLO);
  scrivi(String(mondo.punti), x, 88, 46, BLU, -0.03);
  scrivi('punti', x + 8 + String(mondo.punti).length * 25, 86, 22, BLU, -0.03);
  scrivi('record: ' + record, x + 2, 122, 20, ROSSO, -0.02);
  ctx.restore();
}

function disegnaOps() {
  const k = Math.min(1, mondo.ops / 0.25);
  if (k <= 0) return;
  seme(4000);
  const cx = GX + PAGEW / 2 + 20, cy = 330;
  ctx.save();
  ctx.translate(cx, cy);
  const s = 0.6 + 0.4 * k + (k < 1 ? 0 : Math.sin(mondo.ops * 10) * 0.01);
  ctx.scale(s, s);
  ctx.globalAlpha = k;
  ellisse(0, -22, 150, 78, { col: ROSSO, lw: 2.4, fisso: true });
  scrivi('ops!', 0, 12, 110, ROSSO, -0.1, 'center');
  tratto([[-92, 36], [80, 28]], { col: ROSSO, lw: 2.2 });
  tratto([[-70, 48], [68, 42]], { col: ROSSO, lw: 1.8 });
  scrivi('ricomincio…', 10, 96, 24, BLU, -0.05, 'center');
  ctx.restore();
}

function vignetta() {
  const g = ctx.createRadialGradient(VW / 2, 360, 250, VW / 2, 360, VW * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,0,0.38)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, 720);
}

function disegna() {
  ctx.setTransform(DPR * U, 0, 0, DPR * U, 0, 0);
  disegnaFogli();
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';       // l'inchiostro si somma alla carta
  disegnaPaginaSinistra();
  // area di gioco: ritagliata sulla pagina destra
  ctx.save();
  ctx.beginPath(); ctx.rect(GX + MARG - 30, -10, PAGEW - MARG + 40, 740); ctx.clip();
  for (const q of mondo.piatte) if (!q.rotta) disegnaPiatta(q);
  for (const pz of mondo.pezzi) disegnaPezzo(pz);
  for (const mo of mondo.mostri) disegnaMostro(mo);
  disegnaSegni();
  disegnaOmino();
  // l'omino che esce da un lato riappare dall'altro: si disegna anche la copia
  const p = mondo.p;
  if (p.x < 30 || p.x > AW - 30) { const x0 = p.x; p.x += p.x < 30 ? AW + 24 : -(AW + 24); disegnaOmino(); p.x = x0; }
  ctx.restore();
  disegnaPunti();
  disegnaOps();
  ctx.restore();
  vignetta();
}

// ── Avvio ──
try {
  Demo.carica('Tempero la matita');
  const f = new FontFace('Gloria', 'url(assets/GloriaHallelujah.ttf)');
  await f.load();
  document.fonts.add(f);
  ridimensiona();
  preparaCarta();
  nuovaPartita();
  genera();
  Demo.extra(`<h4>Legenda</h4><p>Blu: piattaforma normale · evidenziata in giallo: si muove ·
    rossa: si spezza sotto i piedi · con la molla: super salto. Il mostriciattolo si schiaccia
    saltandogli sopra; di lato ti prende.</p>`);
  Demo.loop((dt, t) => {
    BOIL = Math.floor(t * 9);
    aggiorna(Math.min(dt, 1 / 30));
    disegna();
  });
  Demo.pronto();
} catch (e) { Demo.errore(e); }
