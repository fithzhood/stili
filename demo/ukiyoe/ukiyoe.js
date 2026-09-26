// Ukiyo-e: una barca da carico fra le onde, stampata come una xilografia di Hokusai.
// Tutto è disegnato in Canvas 2D a ogni fotogramma, lastra per lastra: prima le campiture
// (spostate di un soffio, come un registro imperfetto), poi i contorni della matrice "chiave"
// con lo spessore che varia come un segno inciso, e sopra venatura del legno e fibre di gelso.

const Q = Demo.query;
const cv = document.getElementById('stampa');
const g = cv.getContext('2d');
const LH = 900;                           // altezza logica: tutto è disegnato in unità da 900
let W = 2, H = 2, S = 1, LW = 1600;
const barca = { x: 0, y: 0, vx: 0, vy: 0, aria: false, ang: 0, rov: 0, stato: 'va', timer: 0, alfa: 1, voga: 3 };

// ─────────────────────────── inchiostri ───────────────────────────
const CARTA = '#efe3c6', SUMI = '#2a2421', PRUSSIA = '#1d335f', INDACO = '#2c4a7c',
  BLU = '#4f79a6', CELESTE = '#93b3c9', SCHIUMA = '#f5eedb', LEGNO = '#d9c29a', OCRA = '#c9a86a',
  GRIGIO = '#6f6c6a', ROSSO = '#b3302a', PELLE = '#ecd9b8';
// registro: ogni lastra di colore è spostata di poco rispetto ai contorni
const reg = { blu: [3, -2], grigio: [-2.5, 1.6], legno: [2, 2.6] };

// ─────────────────────────── utilità ───────────────────────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const liscio = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rnd(s) { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function percorso(pts, chiudi) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (chiudi) g.closePath();
}
// campitura con il registro della sua lastra
function campisci(pts, stile, lastra = 'blu') {
  g.save(); g.translate(reg[lastra][0], reg[lastra][1]);
  percorso(pts, true); g.fillStyle = stile; g.fill();
  g.restore();
}
// segno della matrice chiave: un nastro il cui spessore cambia come un intaglio a sgorbia
function segno(pts, w, col = PRUSSIA, seme = 0, assott = true) {
  const n = pts.length; if (n < 2) return;
  const Ls = [], Rs = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    let ww = w * (0.62 + 0.75 * (0.5 + 0.5 * Math.sin(i * 0.41 + seme) * Math.sin(i * 0.13 + seme * 1.7)));
    if (assott) ww *= Math.max(0.15, Math.min(1, i / 4, (n - 1 - i) / 4));
    Ls.push([pts[i][0] - ty * ww / 2, pts[i][1] + tx * ww / 2]);
    Rs.push([pts[i][0] + ty * ww / 2, pts[i][1] - tx * ww / 2]);
  }
  g.beginPath(); g.moveTo(Ls[0][0], Ls[0][1]);
  for (let i = 1; i < n; i++) g.lineTo(Ls[i][0], Ls[i][1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(Rs[i][0], Rs[i][1]);
  g.closePath(); g.fillStyle = col; g.fill();
}

// Artiglio di schiuma: una lingua che sporge dal bordo e in cima si apre in dita a uncino.
function dito(x, y, a, l, w0, k, pts2) {
  const Lp = [], Rp = [], N = 9;
  for (let i = 0; i <= N; i++) {
    const t = i / N, w = w0 * Math.pow(1 - t, 0.8);
    Lp.push([x - Math.sin(a) * w / 2, y + Math.cos(a) * w / 2]);
    Rp.push([x + Math.sin(a) * w / 2, y - Math.cos(a) * w / 2]);
    const passo = l / N;
    x += Math.cos(a) * passo; y += Math.sin(a) * passo;
    a += k * passo * (0.3 + t * 2.0);                          // l'uncino si stringe in punta
  }
  return Lp.concat(Rp.reverse());
}
function artiglio(x, y, ang, lung, dita, seme, piega = 1, apertura = 1.25) {
  // un gambo corto che esce dal bordo, poi le dita: sottili, lunghe, piegate a uncino
  const gl = lung * 0.12;
  const ex = x + Math.cos(ang) * gl, ey = y + Math.sin(ang) * gl;
  const forme = [];
  for (let f = 0; f < dita; f++) {
    const fr = dita === 1 ? 0 : f / (dita - 1) - 0.5;
    const a0 = ang + fr * apertura + (rnd(seme + f) - 0.5) * 0.2 - 0.15 * piega;
    const l = lung * (0.6 + 0.4 * rnd(seme + f * 3.1)) * (1 - Math.abs(fr) * 0.35);
    const k = (3.2 + rnd(seme + f * 7) * 2.0) * piega / l;
    forme.push(dito(ex - Math.sin(ang) * fr * lung * 0.22, ey + Math.cos(ang) * fr * lung * 0.22, a0, l, l * 0.2, k));
  }
  g.lineWidth = 1.4; g.strokeStyle = PRUSSIA; g.lineJoin = 'round'; g.fillStyle = SCHIUMA;
  for (const p of forme) { percorso(p, true); g.fill(); g.stroke(); }
}
function goccia(x, y, r) {
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = SCHIUMA; g.fill(); g.lineWidth = 1.3; g.strokeStyle = PRUSSIA; g.stroke();
}

// ─────────────────────────── texture di carta e legno ───────────────────────────
function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// fibre di gelso: filamenti lunghi e sottili, scuri e chiari
const fibre = tela(512, 512);
{
  const x = fibre.getContext('2d');
  for (let i = 0; i < 700; i++) {
    const sx = Math.random() * 512, sy = Math.random() * 512, a = Math.random() * Math.PI * 2, l = 5 + Math.random() * 28;
    x.strokeStyle = Math.random() < 0.6 ? `rgba(120,92,52,${0.03 + Math.random() * 0.05})` : `rgba(255,252,240,${0.12 + Math.random() * 0.2})`;
    x.lineWidth = 0.5 + Math.random() * 0.9;
    x.beginPath(); x.moveTo(sx, sy);
    x.quadraticCurveTo(sx + Math.cos(a + 0.6) * l * 0.5, sy + Math.sin(a + 0.6) * l * 0.5, sx + Math.cos(a) * l, sy + Math.sin(a) * l);
    x.stroke();
  }
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(110,85,50,${Math.random() * 0.10})`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random(), 1 + Math.random());
  }
}
// venatura della tavola: linee lunghe e ondulate, più fitte in certi punti (i nodi)
const venatura = tela(1024, 512);
{
  const x = venatura.getContext('2d');
  for (let i = 0; i < 150; i++) {
    const y0 = Math.random() * 512, amp = 1 + Math.random() * 3, fr = (1 + Math.floor(Math.random() * 3)) * Math.PI * 2 / 1024, ph = Math.random() * 6;
    x.strokeStyle = `rgba(40,30,20,${0.05 + Math.random() * 0.12})`;
    x.lineWidth = 0.6 + Math.random() * 1.8;
    x.beginPath();
    for (let X = 0; X <= 1024; X += 8) {
      const nodo = Math.exp(-((X - 520) ** 2) / 9000) * Math.exp(-((y0 - 250) ** 2) / 6000) * 30;
      x.lineTo(X, y0 + Math.sin(X * fr + ph) * amp + Math.sin(X * fr * 4 + ph) * amp * 0.3 + nodo * Math.sin(y0) * 0.3);
    }
    x.stroke();
  }
}
let patFibre, patVena;

// ─────────────────────────── immagini (cartiglio e sigillo) ───────────────────────────
function img(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; }); }

// ─────────────────────────── mare ───────────────────────────
// Tre piani di mare: lontano, di mezzo (dove sta la barca) e in primo piano.
const piani = [
  { base: 606, onde: [[7, 0.011, 1.1, 0], [4, 0.027, 1.7, 2]], alto: '#6d8fb0', basso: PRUSSIA, linee: 1, artigli: 0.55, spess: 1.8 },
  { base: 668, onde: [[15, 0.0068, 0.9, 1], [8, 0.017, 1.5, 4], [3, 0.041, 2.2, 0.5]], alto: '#5c86b0', basso: PRUSSIA, linee: 3, artigli: 0.9, spess: 2.6 },
  { base: 815, onde: [[38, 0.0046, 0.7, 2.2], [12, 0.012, 1.2, 0.7], [5, 0.03, 1.9, 3]], alto: '#40689a', basso: '#16284c', linee: 4, artigli: 2.8, spess: 3.4 },
];
function quota(p, x, t) {
  let y = p.base;
  for (const [a, k, w, f] of p.onde) { const v = 0.5 + 0.5 * Math.sin(k * x - w * t + f); y -= a * (2 * Math.pow(v, 2.2) - 0.7); }
  return y;
}

function disegnaPiano(p, t, idx) {
  const pts = [];
  for (let x = -40; x <= LW + 40; x += 6) pts.push([x, quota(p, x, t)]);
  const corpo = pts.concat([[LW + 40, LH + 20], [-40, LH + 20]]);
  // bokashi: il colore sfuma dalla cresta verso il fondo, come passato a mano sulla matrice
  const gr = g.createLinearGradient(0, p.base - 40, 0, p.base + 120 + idx * 30);
  gr.addColorStop(0, p.alto); gr.addColorStop(0.55, INDACO); gr.addColorStop(1, p.basso);
  campisci(corpo, gr, 'blu');
  // righe chiare dentro l'acqua, parallele alla superficie e interrotte
  for (let j = 1; j <= p.linee; j++) {
    const off = j * (10 + idx * 5) + j * j * 3;
    let tratto = [];
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0];
      const on = Math.sin(x * 0.011 + j * 2.1 + idx) + Math.sin(x * 0.027 + j) * 0.5 > -0.2;
      if (on) tratto.push([x, pts[i][1] + off + Math.sin(x * 0.03 + j) * 2]);
      if ((!on || i === pts.length - 1) && tratto.length > 3) { segno(tratto, 1.6 + idx * 0.4, 'rgba(214,228,236,0.75)', j * 5 + idx); tratto = []; }
      else if (!on) tratto = [];
    }
  }
  // bordo di schiuma sotto il contorno, e il contorno inciso
  segno(pts.map(q => [q[0], q[1] + 3.5]), 4 + idx * 1.5, SCHIUMA, idx * 3, false);
  segno(pts, p.spess, PRUSSIA, idx * 7, false);
  // creste: dove la superficie fa una punta, un ciuffo di schiuma ad artigli rivolto avanti
  for (let i = 4; i < pts.length - 4; i++) {
    const y = pts[i][1];
    if (y < pts[i - 1][1] && y <= pts[i + 1][1] && y < pts[i - 3][1] - 1 && y < p.base - 4) {
      const alt = (p.base - y) / 30;
      const lu = (10 + alt * 10) * p.artigli;
      segno([[pts[i - 4][0], pts[i - 4][1] + 3], [pts[i - 2][0], pts[i - 2][1] + 1], pts[i], [pts[i + 1][0] + 4, pts[i + 1][1] + 2]], 5 * p.artigli, SCHIUMA, i);
      artiglio(pts[i][0] + 3, pts[i][1] + 1, 0.45, lu, 3 + (alt > 0.7 ? 1 : 0), Math.round(pts[i][0] / 40) + idx * 50, 1, 1.1);
    }
  }
}

// ─────────────────────────── la grande onda ───────────────────────────
const VITA = 11;                                   // secondi dalla nascita al frangersi
const onda = { eta: 0, Hmax: 370, pausa: 0, attiva: true, superata: false, pts: null, cresta: 0, spruzzi: [] };
function statoOnda() {
  const p = onda.eta / VITA;
  const cresce = liscio(0.0, 0.52, p);
  const crollo = 1 - liscio(0.80, 0.97, p);
  onda.p = p;
  onda.H = onda.Hmax * cresce * crollo;
  onda.cu = liscio(0.28, 0.72, p);
  onda.caduta = liscio(0.78, 0.95, p);               // il labbro si abbassa mentre frange
  onda.x = LW * (-0.18 + 0.99 * p);
  onda.base = piani[1].base + 6;
}
// profilo in coordinate locali (y verso l'alto), poi portato sullo schermo
// Profilo disegnato a punti di controllo sulla Grande onda (unità = altezza dell'onda):
// dorso, labbro che sporge in avanti, sottolabbro con la cavità, parete che scende al piede.
const MATURA = {
  dorso: [[-2.0, 0], [-1.35, 0.2], [-0.9, 0.5], [-0.55, 0.8], [-0.22, 0.97], [0.05, 1.0]],
  labbro: [[0.3, 0.97], [0.52, 0.88], [0.68, 0.73], [0.76, 0.57], [0.74, 0.43]],
  sotto: [[0.64, 0.45], [0.52, 0.55], [0.36, 0.6], [0.22, 0.56], [0.13, 0.45]],
  fronte: [[0.1, 0.3], [0.16, 0.14], [0.34, 0.04], [0.62, 0]],
};
const GIOVANE = {
  dorso: [[-2.0, 0], [-1.35, 0.14], [-0.9, 0.36], [-0.55, 0.6], [-0.22, 0.8], [0.05, 0.86]],
  labbro: [[0.22, 0.84], [0.36, 0.76], [0.48, 0.64], [0.56, 0.52], [0.6, 0.42]],
  sotto: [[0.62, 0.38], [0.64, 0.34], [0.66, 0.3], [0.68, 0.26], [0.7, 0.22]],
  fronte: [[0.74, 0.16], [0.8, 0.1], [0.9, 0.05], [1.0, 0]],
};
function catmull(ctrl, per) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}
function formaOnda(t) {
  const Hh = Math.max(1, onda.H), cu = onda.cu;
  const parti = ['dorso', 'labbro', 'sotto', 'fronte'];
  const ctrl = [], limiti = {};
  for (const k of parti) {
    limiti[k] = [ctrl.length, 0];
    MATURA[k].forEach((m, i) => {
      const y = GIOVANE[k][i];
      let px = lerp(y[0], m[0], cu), py = lerp(y[1], m[1], cu);
      // il labbro respira un poco e, quando frange, cade in avanti
      if (k !== 'dorso' && k !== 'fronte') {
        px += Math.sin(t * 1.7 + i) * 0.008;
        py -= onda.caduta * Math.max(0, px) * 0.9; px += onda.caduta * Math.max(0, px) * 0.3;
      }
      ctrl.push([px, py]);
    });
    limiti[k][1] = ctrl.length;
  }
  // campiono tutta la curva e poi la ritaglio nelle sue parti
  const PER = 7;
  const tutti = catmull(ctrl, PER);
  const taglia = k => tutti.slice(Math.max(0, limiti[k][0] - 1) * PER, Math.min(tutti.length, (limiti[k][1] - 1) * PER + 1));
  const sc = q => [onda.x + q[0] * Hh, onda.base - q[1] * Hh];
  const f = {};
  for (const k of parti) f[k] = taglia(k).map(sc);
  f.L = Hh; f.tutti = tutti.map(sc);
  return f;
}

function disegnaOnda(t) {
  if (!onda.attiva || onda.H < 4) { onda.pts = null; return; }
  const f = formaOnda(t);
  const aperto = f.tutti;
  const chiuso = aperto.concat([[aperto[aperto.length - 1][0], onda.base + 60], [aperto[0][0], onda.base + 60]]);
  onda.pts = chiuso; onda.aperto = aperto;
  onda.cresta = f.dorso[f.dorso.length - 1][0];

  // corpo: indaco profondo con fasce chiare lungo il bordo, a ritroso dall'esterno
  g.save();
  g.translate(reg.blu[0], reg.blu[1]);
  percorso(chiuso, true);
  const gr = g.createLinearGradient(0, onda.base - onda.H, 0, onda.base);
  gr.addColorStop(0, INDACO); gr.addColorStop(0.5, PRUSSIA); gr.addColorStop(1, '#152a52');
  g.fillStyle = gr; g.fill();
  g.clip();
  g.lineJoin = 'round'; g.lineCap = 'round';
  percorso(aperto, false);
  for (const [w, c] of [[46, 'rgba(79,121,166,0.7)'], [30, BLU], [18, '#86a9c4']]) { g.lineWidth = w; g.strokeStyle = c; g.stroke(); }
  // filamenti chiari dentro il corpo, paralleli al dorso: il "flusso" dell'acqua
  const ancora = [onda.x - f.L * 0.5, onda.base + 10];
  for (let k = 1; k <= 7; k++) {
    const s = 1 - k * 0.1;
    const pts = f.dorso.concat(f.labbro.slice(0, 12)).map(q => [ancora[0] + (q[0] - ancora[0]) * s + k * 6, ancora[1] + (q[1] - ancora[1]) * s]);
    g.restore(); g.save(); g.translate(reg.blu[0], reg.blu[1]); percorso(chiuso, true); g.clip();
    segno(pts, 2.2 - k * 0.12, k % 2 ? 'rgba(170,196,214,0.55)' : 'rgba(233,236,228,0.5)', k * 11);
  }
  g.restore();

  // schiuma bianca sulla cresta e sul labbro, con due filetti blu dentro (bande concentriche)
  const bordoSchiuma = f.dorso.slice(-14).concat(f.labbro);
  const sc = clamp(onda.H / 330, 0.3, 1.2);
  g.save(); percorso(chiuso, true); g.clip();
  g.lineJoin = 'round'; g.lineCap = 'round'; percorso(bordoSchiuma, false);
  for (const [w, c] of [[64, SCHIUMA], [48, '#7fa4c2'], [43, SCHIUMA], [26, '#9bb8cc'], [22, SCHIUMA]]) { g.lineWidth = w * sc; g.strokeStyle = c; g.stroke(); }
  g.restore();
  // contorni della matrice chiave
  segno(aperto, 3.4, PRUSSIA, 1, false);
  segno(bordoSchiuma.map(q => [q[0], q[1] + 32 * sc]).slice(4, -6), 1.6, PRUSSIA, 5);

  // artigli lungo il labbro: sempre più grandi verso la punta, e piegati verso il basso
  const lab = f.labbro, n = lab.length;
  for (let i = 3; i < n; i += 2) {
    const a = lab[i - 1], b = lab[Math.min(n - 1, i + 1)];
    const tang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const fuori = tang - Math.PI / 2;                    // normale esterna al labbro
    const k = i / n;
    const ang = fuori + (Math.PI / 2 - fuori) * (0.1 + k * 0.3);
    const lu = (30 + k * 40) * sc * (0.7 + onda.cu * 0.5);
    artiglio(lab[i][0] - Math.cos(ang) * 6, lab[i][1] - Math.sin(ang) * 6, ang, lu, 4 + Math.round(k * 2), 100 + i, 1.2, 1.3);
  }
  // le dita che pendono dal sottolabbro e dalla punta, come una mano che afferra
  const sot = f.sotto;
  for (let i = 0; i < Math.min(sot.length, 12); i += 3) {
    const q = sot[i];
    artiglio(q[0] - 2, q[1] - 4, Math.PI * 0.62, (46 - i * 2.5) * sc * onda.cu, 5, 700 + i, 1.4, 1.2);
  }
  const T = lab[n - 1];
  artiglio(T[0], T[1], Math.PI * 0.45 + (1 - onda.cu) * 0.6, 64 * sc, 7, 999, 1.4, 1.8);
  // ricci minori sul dorso: l'onda fatta di onde
  for (let j = 0; j < 3; j++) {
    const q = f.dorso[Math.round(f.dorso.length * (0.55 + j * 0.13))];
    if (!q) continue;
    artiglio(q[0] + 4, q[1] + 2, -0.2 + j * 0.15, 12 + j * 5, 3, 300 + j, 1, 1.0);
  }
  // spruzzi: gocce di schiuma sospese sopra il labbro, come neve
  for (let i = 0; i < 26; i++) {
    const s = rnd(i + 40), s2 = rnd(i + 77);
    const idx = Math.floor(n * (0.25 + s * 0.75));
    const q = lab[Math.min(n - 1, idx)];
    const d = 12 + s2 * 50 * clamp(onda.H / 250, 0, 1.2);
    const x = q[0] + 10 + s2 * 50 + Math.sin(t * 1.3 + i) * 3, y = q[1] - d * 0.4 + Math.cos(t * 1.1 + i) * 3 + s * 20;
    goccia(x, y, 1.8 + rnd(i + 5) * 3.2);
  }
}

// La quota più alta del profilo della grande onda sopra l'ascissa x (o null)
function cimaOnda(x) {
  const p = onda.aperto; if (!p) return null;
  let m = null;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) {
      const y = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      if (m === null || y < m) m = y;
    }
  }
  return m;
}
function dentroOnda(x, y) {
  const p = onda.pts; if (!p) return false;
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  }
  return c;
}

// ─────────────────────────── barche ───────────────────────────
// oshiokuri-bune: scafo lungo e sottile, prua a sinistra, otto rematori curvi sui remi
function disegnaBarca(x, y, ang, sc, t, voga, alfa = 1, rovescio = 0) {
  g.save();
  g.globalAlpha = alfa;
  g.translate(x, y); g.rotate(ang + rovescio * Math.PI); g.scale(sc, sc);
  // remi, dietro lo scafo
  for (let i = 0; i < 8; i++) {
    const rx = -62 + i * 17;
    const a = 0.9 + Math.sin(t * voga + i * 0.35) * 0.35;
    segno([[rx, -14], [rx + Math.cos(a) * 44, -14 + Math.sin(a) * 44]], 2.2, SUMI, i, false);
  }
  // scafo
  const scafo = [[-112, -18], [-96, -10], [-60, -7], [0, -6], [70, -8], [104, -14], [100, -2], [80, 8], [0, 11], [-70, 8], [-100, 0]];
  campisci(scafo, LEGNO, 'legno');
  campisci([[-96, -10], [-60, -7], [0, -6], [70, -8], [100, -12], [98, -6], [0, 0], [-70, -1], [-100, -4]], OCRA, 'legno');
  segno(scafo.concat([scafo[0]]), 2.4, SUMI, 3, false);
  segno([[-98, -4], [-40, -1], [30, -1], [98, -6]], 1.3, SUMI, 9);
  // rematori: schiena curva indaco, la testa chinata davanti alla schiena
  for (let i = 0; i < 8; i++) {
    const rx = -62 + i * 17, ch = Math.sin(t * voga + i * 0.35) * 2.5;
    g.save(); g.translate(rx + ch, -8); g.rotate(-0.25 + Math.sin(t * voga + i * 0.35) * 0.12);
    const schiena = [];
    for (let k = 0; k <= 12; k++) { const a = Math.PI + k / 12 * Math.PI; schiena.push([Math.cos(a) * 9 + 1, Math.sin(a) * 13 * (1 - 0.25 * (k / 12))]); }
    campisci(schiena, i % 3 === 1 ? '#46699a' : INDACO, 'blu');
    segno(schiena, 1.7, SUMI, i + 20, false);
    g.beginPath(); g.ellipse(-8, -8, 3.6, 3.2, 0, 0, Math.PI * 2);
    g.fillStyle = PELLE; g.fill(); g.lineWidth = 1.2; g.strokeStyle = SUMI; g.stroke();
    g.beginPath(); g.moveTo(-11, -10); g.quadraticCurveTo(-8, -13, -4.5, -10); g.fillStyle = SUMI; g.fill();   // capelli raccolti
    g.restore();
  }
  // il timoniere in piedi a poppa
  g.save(); g.translate(88, -14);
  campisci([[-4, 0], [4, 0], [3, -18], [-3, -18]], INDACO, 'blu'); segno([[-4, 0], [-3, -18], [3, -18], [4, 0]], 1.4, SUMI, 44, false);
  g.beginPath(); g.arc(0, -22, 3.6, 0, 7); g.fillStyle = PELLE; g.fill(); g.lineWidth = 1.2; g.strokeStyle = SUMI; g.stroke();
  g.restore();
  g.restore();
}

let superate = 0;

// ─────────────────────────── cielo, Fuji, cartiglio ───────────────────────────
function cielo(t) {
  // bokashi grigio in alto, velo giallino sull'orizzonte: il pigmento sfuma sulla tavola bagnata
  const g1 = g.createLinearGradient(0, 0, 0, 330);
  g1.addColorStop(0, 'rgba(62,58,60,0.88)'); g1.addColorStop(0.45, 'rgba(92,88,86,0.45)'); g1.addColorStop(1, 'rgba(120,115,108,0)');
  g.save(); g.translate(reg.grigio[0], reg.grigio[1]); g.fillStyle = g1; g.fillRect(-10, -10, LW + 20, 350);
  const g2 = g.createLinearGradient(0, 380, 0, 612);
  g2.addColorStop(0, 'rgba(226,204,150,0)'); g2.addColorStop(1, 'rgba(214,186,128,0.55)');
  g.fillStyle = g2; g.fillRect(-10, 380, LW + 20, 240);
  g.restore();
  // due nuvole a nastro, piatte, che scorrono piano
  for (let i = 0; i < 2; i++) {
    const cx = ((i * 0.55 + 0.15) * LW + t * 6) % (LW + 600) - 300, cy = 200 + i * 110;
    const pts = [];
    for (let k = 0; k <= 24; k++) { const u = k / 24; pts.push([cx + u * 420, cy - Math.sin(u * Math.PI) * (14 + 8 * Math.sin(u * 9 + i))]); }
    for (let k = 24; k >= 0; k--) { const u = k / 24; pts.push([cx + u * 420, cy + Math.sin(u * Math.PI) * 6]); }
    campisci(pts, 'rgba(118,112,108,0.35)', 'grigio');
  }
}

function fuji() {
  const cx = LW * 0.64, by = 612, top = 548;
  const pts = [];
  for (let k = 0; k <= 30; k++) {
    const u = k / 30, s = u * 2 - 1;
    const pend = Math.pow(Math.abs(s), 0.62);
    pts.push([cx + s * 170, top + (by - top) * pend + (Math.abs(s) < 0.1 ? 2 : 0)]);
  }
  pts.push([cx + 170, by + 4], [cx - 170, by + 4]);
  const gr = g.createLinearGradient(0, top, 0, by);
  gr.addColorStop(0, '#465a7a'); gr.addColorStop(1, '#8aa0b5');
  campisci(pts, gr, 'blu');
  // neve con il bordo frastagliato
  const neve = [];
  for (let k = 0; k <= 30; k++) {
    const u = k / 30, s = u * 2 - 1;
    if (Math.abs(s) > 0.52) continue;
    neve.push([cx + s * 170, top + (by - top) * Math.pow(Math.abs(s), 0.62)]);
  }
  for (let k = 12; k >= 0; k--) {
    const s = -0.52 + k / 12 * 1.04;
    const y = top + (by - top) * Math.pow(0.52, 0.62) - 6 + (k % 2 ? 9 : -3) + rnd(k) * 5;
    neve.push([cx + s * 170, y]);
  }
  percorso(neve, true); g.fillStyle = SCHIUMA; g.fill();
  segno(pts.slice(0, 31), 2.4, PRUSSIA, 2);
  segno(neve.slice(-13).reverse(), 1.2, PRUSSIA, 8);
}

let cartiglio, sigillo;
function etichette() {
  // cartiglio in alto a sinistra: rettangolo giallino, titolo in verticale
  const x = 58, y = 62, w = 118, h = 256;
  g.save(); g.translate(reg.legno[0], reg.legno[1]);
  g.fillStyle = '#e9d6a0'; g.fillRect(x, y, w, h);
  g.restore();
  g.lineWidth = 2.2; g.strokeStyle = SUMI; g.strokeRect(x, y, w, h);
  g.lineWidth = 0.8; g.strokeRect(x + 5, y + 5, w - 10, h - 10);
  g.drawImage(cartiglio, x + 10, y + 12, w - 20, (w - 20) * cartiglio.height / cartiglio.width);
  // conteggio delle onde superate, in cifre giapponesi, accanto al sigillo
  g.drawImage(sigillo, x + w + 16, y + 6, 48, 48);
  if (superate > 0) {
    const cifre = '〇一二三四五六七八九';
    const txt = superate <= 10 ? (superate === 10 ? '十' : cifre[superate]) : String(superate);
    g.save(); g.fillStyle = SUMI; g.font = '24px "Yu Mincho", "MS Mincho", SimSun, serif'; g.textAlign = 'center';
    g.fillText('越', x + w + 40, y + 88); g.fillText(txt, x + w + 40, y + 116);
    g.restore();
  }
}

// ─────────────────────────── ridimensionamento ───────────────────────────
function ridimensiona() {
  W = innerWidth; H = innerHeight;
  cv.width = W; cv.height = H;
  const vecchio = LW;
  S = H / LH; LW = W / S;
  barca.x *= LW / vecchio;     // la barca resta nello stesso punto della stampa
  patFibre = g.createPattern(fibre, 'repeat');
  patVena = g.createPattern(venatura, 'repeat');
}
addEventListener('resize', ridimensiona);
ridimensiona();

// ─────────────────────────── gioco ───────────────────────────
function riparti() {
  barca.x = LW * 0.74; barca.y = piani[1].base; barca.vx = 0; barca.vy = 0; barca.aria = false; barca.stato = 'va'; barca.rov = 0; barca.alfa = 0; barca.timer = 0;
}
function nuovaOnda() {
  onda.eta = 0; onda.Hmax = 330 + Math.random() * 60; onda.superata = false;
}

function aggiornaBarca(dt, t) {
  const pm = piani[1];
  if (barca.stato === 'rovescio') {
    barca.timer += dt;
    barca.rov = Math.min(1, barca.timer / 0.7);
    barca.y = quota(pm, barca.x, t) + Math.min(60, barca.timer * 40);
    barca.alfa = Math.max(0, 1 - barca.timer / 1.6);
    if (barca.timer > 1.8 && (onda.p > 0.93 || onda.x > barca.x + 400)) riparti();
    return;
  }
  barca.alfa = Math.min(1, barca.alfa + dt * 2);
  const ax = Demo.asse().x;
  barca.vx = lerp(barca.vx, ax * 240, Math.min(1, dt * 3));
  barca.voga = 3 + Math.abs(barca.vx) / 40;
  const sopraOnda = onda.pts && barca.x > onda.x - onda.H * 2.2 && barca.x < onda.x + onda.H * 0.8;
  barca.x += (barca.vx - (barca.aria && sopraOnda ? 150 : 0)) * dt;
  barca.x = clamp(barca.x, LW * 0.1, LW * 0.95);
  const mare = quota(pm, barca.x, t);
  const cima = cimaOnda(barca.x);
  const altezza = cima === null ? 0 : onda.base - cima;
  const suDorso = cima !== null && barca.x <= onda.cresta;
  const pavimento = cima !== null && (suDorso || altezza < 60) ? Math.min(mare, cima) : mare;

  if (!barca.aria) {
    if (Demo.premuto(' ')) { barca.aria = true; barca.vy = -960; }
    else {
      // travolta: la parete dell'onda è sopra di lei e non si è saltato
      if (cima !== null && !suDorso && altezza >= 60 && cima < mare - 20) return capovolgi();
      barca.y = lerp(barca.y || pavimento, pavimento, Math.min(1, dt * 12));
    }
  }
  if (barca.aria) {
    barca.vy += (sopraOnda ? 1050 : 1450) * dt;             // sopra l'onda l'acqua la sostiene un poco
    barca.y += barca.vy * dt;
    if (dentroOnda(barca.x, barca.y - 6) && !suDorso && altezza >= 60) return capovolgi();
    if (barca.y >= pavimento && barca.vy > 0) { barca.y = pavimento; barca.aria = false; barca.vy = 0; }
  }
  // inclinazione: segue il pendio sotto la chiglia, in aria si impenna
  const dx = 6;
  const pend = (Math.min(quota(pm, barca.x + dx, t), cimaOnda(barca.x + dx) ?? 1e9) - Math.min(quota(pm, barca.x - dx, t), cimaOnda(barca.x - dx) ?? 1e9)) / (2 * dx);
  const angT = barca.aria ? clamp(barca.vy * 0.00035, -0.35, 0.35) : Math.atan(clamp(pend, -1.2, 1.2)) * 0.8;
  barca.ang = lerp(barca.ang, angT, Math.min(1, dt * 6));
  // un'onda è superata quando la sua cresta è passata oltre la barca
  if (onda.pts && !onda.superata && onda.H > 150 && onda.cresta > barca.x + 60) { onda.superata = true; superate++; }
}
function capovolgi() { barca.stato = 'rovescio'; barca.timer = 0; barca.aria = false; }

// ─────────────────────────── ciclo ───────────────────────────
Demo.carica('Incido le matrici', 0.3);
[cartiglio, sigillo] = await Promise.all([img('assets/cartiglio.png'), img('assets/sigillo.png')]);

// inizio: in modalità foto l'onda è già in posa, sopra la barca, come nella stampa di Hokusai
const ora = parseFloat(Q.get('ora') || '0.69');
onda.eta = Demo.shot ? ora * VITA - 1.5 : 1.5;
riparti(); barca.alfa = 1;
if (Q.get('bx')) barca.x = LW * parseFloat(Q.get('bx'));

Demo.loop((dt, t) => {
  // stato
  if (onda.attiva) { onda.eta += dt; if (onda.eta > VITA) { onda.attiva = false; onda.pausa = 1.2; } }
  else { onda.pausa -= dt; if (onda.pausa <= 0) { nuovaOnda(); onda.attiva = true; } }
  statoOnda();

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = CARTA; g.fillRect(0, 0, W, H);
  g.setTransform(S, 0, 0, S, 0, 0);

  cielo(t);
  fuji();
  disegnaPiano(piani[0], t, 0);
  // una seconda barca, lontana, che rema per conto suo
  const xb = LW * 0.86 + Math.sin(t * 0.2) * 30, yb = quota(piani[0], xb, t) + 2;
  disegnaBarca(xb, yb, Math.atan((quota(piani[0], xb + 6, t) - quota(piani[0], xb - 6, t)) / 12), 0.7, t, 3.2);
  disegnaPiano({ ...piani[0], base: piani[0].base + 2, linee: 0, artigli: 0 }, t, 0);   // copre la chiglia lontana

  if (onda.attiva) disegnaOnda(t); else onda.pts = null;
  aggiornaBarca(dt, t);
  disegnaBarca(barca.x, barca.y - 4, barca.ang, 1.8, t, barca.voga, barca.alfa, barca.rov);
  disegnaPiano(piani[1], t, 1);
  disegnaPiano(piani[2], t, 2);

  // carta: venatura del legno, fibre di gelso, bordi ingialliti
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.28; g.fillStyle = patVena; g.fillRect(0, 0, W, H);
  g.globalAlpha = 1; g.fillStyle = patFibre; g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(196,160,100,0.45)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  g.setTransform(S, 0, 0, S, 0, 0);
  etichette();
});
Demo.extra('<p>Lastre: indaco e blu di Prussia per il mare, grigio per il cielo, legno e ocra per la barca, rosso per il sigillo. Il titolo nel cartiglio: «Monte Fuji; la barca fra le onde».</p>');
Demo.pronto();
