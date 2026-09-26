// Silhouette (Limbo): un bosco in bianco e nero fatto solo di sagome.
// Tutto procedurale su canvas 2D. I piani lontani sono dipinti una volta su strisce sfocate
// (più lontano = più chiaro e più sfocato), il piano di gioco si disegna ogni fotogramma,
// sopra passano raggi di luce, grana di pellicola, sfarfallio e vignettatura.

const V = 720;                         // altezza virtuale: tutte le misure sono in questa scala
const SUOLO = 560;
const FINE = 3900;

const cv = document.createElement('canvas');
cv.style.cssText = 'position:fixed;left:0;top:0';
document.body.prepend(cv);
const ctx = cv.getContext('2d');
let k = 1, VW = 1280;                  // scala virtuale→pixel, larghezza visibile in unità virtuali
function ridimensiona() {
  const q = Math.min(devicePixelRatio || 1, 1.5);
  cv.width = Math.round(innerWidth * q); cv.height = Math.round(innerHeight * q);
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  k = cv.height / V; VW = cv.width / k;
  preparaSchermo();
}

// ── Numeri casuali ripetibili ──
let seme = 1;
const rnd = () => { seme = (seme * 16807) % 2147483647; return (seme - 1) / 2147483646; };
const tra = (a, b) => a + (b - a) * rnd();

// ── Disegno di un albero in sagoma ──
// tronco affusolato con una curva leggera che esce dall'alto, radici allargate, rami sottili e storti
function albero(g, x, base, largo, colore, opz = {}) {
  g.fillStyle = colore; g.strokeStyle = colore;
  const curva = tra(-30, 30), cima = -40;
  const pts = 24;
  const bordo = (lato) => {
    const out = [];
    for (let i = 0; i <= pts; i++) {
      const u = i / pts;
      const y = base + (cima - base) * u;
      const w = largo * (1 - u * 0.45) * (1 + Math.max(0, 0.18 - u) * 6 * (opz.radici ?? 1));
      const cx = x + curva * u * u + Math.sin(u * 7 + x) * largo * 0.06;
      out.push([cx + lato * w / 2 + Math.sin(u * 23 + x * 0.3) * 1.2, y]);
    }
    return out;
  };
  const sx = bordo(-1), dx = bordo(1);
  g.beginPath();
  sx.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b));
  for (let i = dx.length - 1; i >= 0; i--) g.lineTo(dx[i][0], dx[i][1]);
  g.closePath(); g.fill();
  // rami
  const nr = opz.rami ?? Math.floor(tra(2, 5));
  for (let i = 0; i < nr; i++) {
    const u = tra(0.25, 0.85);
    const y = base + (cima - base) * u;
    const cx = x + curva * u * u;
    const lato = rnd() < 0.5 ? -1 : 1;
    ramo(g, cx, y, lato * tra(0.2, 1.2) - Math.PI / 2 + lato * 0.9, tra(largo * 1.5, largo * 4.5), largo * 0.22, 3);
  }
}
function ramo(g, x, y, ang, lung, spess, livello) {
  if (livello <= 0 || lung < 6) return;
  const passi = 8;
  let px = x, py = y, a = ang;
  const punti = [];
  for (let i = 0; i <= passi; i++) {
    punti.push([px, py, spess * (1 - i / passi * 0.85)]);
    a += tra(-0.18, 0.18);
    px += Math.cos(a) * lung / passi; py += Math.sin(a) * lung / passi;
  }
  // tratto affusolato fatto di quadrilateri
  g.beginPath();
  for (let i = 0; i < punti.length - 1; i++) {
    const [x1, y1, w1] = punti[i], [x2, y2, w2] = punti[i + 1];
    const d = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
    const c = Math.cos(d), s = Math.sin(d);
    g.moveTo(x1 + c * w1 / 2, y1 + s * w1 / 2); g.lineTo(x2 + c * w2 / 2, y2 + s * w2 / 2);
    g.lineTo(x2 - c * w2 / 2, y2 - s * w2 / 2); g.lineTo(x1 - c * w1 / 2, y1 - s * w1 / 2); g.closePath();
  }
  g.fill();
  const n = livello > 1 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const j = Math.floor(tra(3, passi));
    const [bx, by] = punti[j];
    ramo(g, bx, by, a + tra(-0.9, 0.9), lung * tra(0.35, 0.6), spess * 0.5, livello - 1);
  }
}
function ciuffi(g, x0, x1, base, alto, colore, densita = 0.35) {
  g.fillStyle = colore;
  g.beginPath();
  for (let x = x0; x < x1; x += 1 / densita) {
    const h = alto * tra(0.4, 1.1), l = tra(-0.35, 0.35), w = tra(1.5, 3.5);
    g.moveTo(x - w, base + 2); g.quadraticCurveTo(x + l * h * 0.3, base - h * 0.6, x + l * h, base - h); g.quadraticCurveTo(x + l * h * 0.3 + 1, base - h * 0.5, x + w, base + 2);
  }
  g.fill();
}

// ── Piani lontani, pre-dipinti ──
// [parallasse, colore, sfocatura, densità, larghezza tronchi, qualità]
const PIANI = [
  { p: 0.12, col: '#a9a9a5', blur: 7, n: 1 / 150, largo: [8, 18], suolo: 520, q: 0.45 },
  { p: 0.25, col: '#8c8c89', blur: 4.5, n: 1 / 190, largo: [12, 26], suolo: 535, q: 0.5 },
  { p: 0.45, col: '#5d5d5b', blur: 2.2, n: 1 / 260, largo: [18, 38], suolo: 548, q: 0.6 },
];
let STRISCE = [], PRIMO = null, RAGGI = null, GRANA = [], VIGNETTA = null;
function dipingiPiani() {
  STRISCE = PIANI.map((P, i) => {
    seme = 101 + i * 977;
    const w = Math.ceil(FINE * P.p + 2400), q = P.q;
    const c = document.createElement('canvas'); c.width = Math.ceil(w * q); c.height = Math.ceil(V * q);
    const g = c.getContext('2d');
    g.scale(q, q);
    g.filter = `blur(${P.blur}px)`;
    // terreno del piano, ondulato
    g.fillStyle = P.col;
    g.beginPath(); g.moveTo(0, V);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, P.suolo + Math.sin(x * 0.004 + i) * 10 + Math.sin(x * 0.013) * 4);
    g.lineTo(w, V); g.fill();
    for (let x = tra(0, 100); x < w; x += tra(0.5, 1.6) / P.n) albero(g, x, P.suolo + 6, tra(...P.largo), P.col, { rami: Math.floor(tra(1, 4)) });
    ciuffi(g, 0, w, P.suolo + 4, 22 - i * 4, P.col, 0.12);
    // piccole liane appese
    g.strokeStyle = P.col; g.lineWidth = 1.5;
    for (let j = 0; j < w / 400; j++) { const x = tra(0, w), l = tra(60, 220); g.beginPath(); g.moveTo(x, -10); g.quadraticCurveTo(x + tra(-20, 20), l / 2, x + tra(-8, 8), l); g.stroke(); }
    return { c, P };
  });
  // primo piano scuro e molto sfocato: ciuffi in basso e rami in alto, passa davanti a tutto
  seme = 4242;
  const w = Math.ceil(FINE * 1.35 + 2400), q = 0.5;
  PRIMO = document.createElement('canvas'); PRIMO.width = Math.ceil(w * q); PRIMO.height = Math.ceil(V * q);
  const g = PRIMO.getContext('2d'); g.scale(q, q); g.filter = 'blur(6px)';
  g.fillStyle = '#050505';
  for (let x = 300; x < w; x += tra(500, 1100)) {
    ciuffi(g, x, x + tra(120, 260), V + 10, tra(90, 160), '#050505', 0.25);
    g.beginPath(); g.ellipse(x + 100, V + 30, 150, 60, 0, 0, Math.PI * 2); g.fill();
  }
  for (let x = 800; x < w; x += tra(900, 1600)) { g.fillStyle = '#060606'; ramo(g, x, -20, Math.PI / 2 - tra(0.4, 1.1), tra(150, 260), 16, 3); }
}

// raggi di luce: fasci diagonali sfocati, aggiunti con 'screen'
function dipingiRaggi() {
  RAGGI = document.createElement('canvas'); RAGGI.width = 900; RAGGI.height = 360;
  const g = RAGGI.getContext('2d');
  g.filter = 'blur(14px)';
  seme = 77;
  for (let i = 0; i < 7; i++) {
    const x = 120 + i * 95 + tra(-30, 30), w = tra(18, 55);
    const gr = g.createLinearGradient(0, 0, 0, 360);
    const a = tra(0.5, 0.95);
    gr.addColorStop(0, `rgba(255,255,250,${a})`); gr.addColorStop(0.55, `rgba(255,255,250,${a * 0.35})`); gr.addColorStop(1, 'rgba(255,255,250,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x, -20); g.lineTo(x + w, -20); g.lineTo(x + w * 2.2 - 200, 380); g.lineTo(x - 200 - w * 0.4, 380); g.closePath(); g.fill();
  }
}

function preparaSchermo() {
  // grana: pochi fogli di rumore, ridisegnati con uno scarto casuale ogni fotogramma
  if (!GRANA.length) {
    for (let n = 0; n < 4; n++) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d'), im = g.createImageData(256, 256);
      seme = 900 + n;
      for (let i = 0; i < im.data.length; i += 4) {
        const v = rnd() < 0.5 ? 0 : 255;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = rnd() * 70;
      }
      g.putImageData(im, 0, 0); GRANA.push(c);
    }
  }
  VIGNETTA = document.createElement('canvas'); VIGNETTA.width = cv.width; VIGNETTA.height = cv.height;
  const g = VIGNETTA.getContext('2d');
  const r = Math.hypot(cv.width, cv.height) / 2;
  const gr = g.createRadialGradient(cv.width / 2, cv.height * 0.45, r * 0.25, cv.width / 2, cv.height * 0.45, r * 1.02);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.28)'); gr.addColorStop(0.85, 'rgba(0,0,0,0.78)'); gr.addColorStop(1, 'rgba(0,0,0,0.95)');
  g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
}

// ── Piano di gioco ──
const SOLIDI = [
  { x0: -400, x1: 2100, y: SUOLO },           // primo tratto di bosco
  { x0: 1020, x1: 1500, y: 412, roccia: true }, // sporgenza di roccia
  { x0: 2600, x1: FINE + 400, y: SUOLO },     // dopo il fosso
];
const CASSA = { x: 640, y: SUOLO, w: 74, h: 70, vx: 0, vy: 0 };
const TAGLIOLA = { x: 1830, chiusa: 0, scatta: -1 };
const TRONCO = { px: 2390, py: 240, l: 330, A: 0.6, w: 190, x: 0, y: 0, dx: 0, dy: 0 };
const TAPPE = [150, 1580, 2700];
const ERBA = [];
const VICINI = [];      // alberi del piano di gioco
const SASSI = [];
function preparaPiano() {
  seme = 31337;
  const zone = [[-200, 600], [760, 1010], [1510, 2090], [2620, FINE + 300]];
  for (const [a, b] of zone) for (let x = a; x < b; x += tra(2.5, 5)) {
    if (Math.abs(x - TAGLIOLA.x) < 50) continue;
    ERBA.push({ x, h: tra(14, 44) * (rnd() < 0.08 ? 1.6 : 1), l: tra(-0.3, 0.3), w: tra(1.6, 3.4), f: tra(0, 6) });
  }
  for (let x = 1025; x < 1495; x += tra(5, 9)) ERBA.push({ x, h: tra(8, 20), l: tra(-0.3, 0.3), w: tra(1.4, 2.6), f: tra(0, 6), y: 412 });
  for (const [x, largo] of [[40, 46], [420, 30], [880, 62], [1700, 38], [2150, 0], [2760, 70], [3200, 40], [3520, 56], [3800, 34]]) if (largo) VICINI.push({ x, largo, seme: x * 7 + 3 });
  for (let i = 0; i < 40; i++) SASSI.push({ x: tra(-200, FINE), r: tra(3, 9) });
  // i tronchi vicini, dipinti una volta
  for (const v of VICINI) {
    const c = document.createElement('canvas'); c.width = 900; c.height = V;
    const g = c.getContext('2d');
    seme = v.seme;
    albero(g, 450, SUOLO + 10, v.largo, '#000', { rami: v.largo > 50 ? 5 : 3, radici: 1.5 });
    v.c = c;
  }
  // il grande ramo che regge il tronco sospeso
  const c = document.createElement('canvas'); c.width = 900; c.height = 300;
  const g = c.getContext('2d'); g.fillStyle = '#000';
  seme = 5;
  g.beginPath(); g.moveTo(900, 150); g.bezierCurveTo(700, 130, 450, 200, 60, 180); g.lineTo(40, 196); g.bezierCurveTo(450, 225, 700, 170, 900, 186); g.fill();
  ramo(g, 300, 196, 1.3, 70, 6, 2); ramo(g, 520, 190, -1.9, 90, 7, 2); ramo(g, 160, 186, -2.2, 60, 5, 2);
  TRONCO.ramo = c;
}

// ── Il ragazzino ──
const R = { x: TAPPE[0], y: SUOLO, vx: 0, vy: 0, terra: true, dir: 1, fase: 0, spinge: 0, morto: 0, buio: 0, sopra: null, atterra: 0 };
const LARGO = 18, ALTO = 60;

function sovrapposto(ax0, ax1, ay0, ay1, bx0, bx1, by0, by1) { return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0; }
function blocchi() {
  const b = SOLIDI.map(s => ({ x0: s.x0, x1: s.x1, y0: s.y, y1: s.roccia ? SUOLO + 1 : 2000 }));
  b.push({ x0: CASSA.x, x1: CASSA.x + CASSA.w, y0: CASSA.y - CASSA.h, y1: CASSA.y, cassa: true });
  return b;
}

const pilota = Demo.shot && !Demo.query.has('tieni') && !Demo.query.has('fermo');
let fotogramma = 0;
function input() {
  if (pilota) return { x: fotogramma > 10 && fotogramma < 75 ? 1 : 0, salto: fotogramma >= 60 && fotogramma < 74, premuto: fotogramma === 60 };
  const a = Demo.asse();
  return { x: Math.abs(a.x) > 0.25 ? Math.sign(a.x) * Math.min(1, Math.abs(a.x) * 1.3) : 0,
    salto: Demo.giu(' ') || Demo.giu('ArrowUp') || Demo.giu('w'), premuto: Demo.premuto(' ') || Demo.premuto('ArrowUp') || Demo.premuto('w') };
}

function muori() { if (R.morto <= 0) { R.morto = 1.5; } }

function aggiorna(dt, t) {
  // tronco sospeso: pendolo a due corde, resta orizzontale
  const om = Math.sqrt(1600 / TRONCO.l) * 0.62;
  const th = TRONCO.A * Math.sin(t * om);
  const nx = TRONCO.px + Math.sin(th) * TRONCO.l, ny = TRONCO.py + Math.cos(th) * TRONCO.l;
  TRONCO.dx = nx - TRONCO.x; TRONCO.dy = ny - TRONCO.y; TRONCO.x = nx; TRONCO.y = ny; TRONCO.th = th;
  if (TAGLIOLA.chiusa > 0 && TAGLIOLA.scatta >= 0) TAGLIOLA.chiusa = Math.min(1, TAGLIOLA.chiusa + dt * 14);

  // morte e ritorno all'ultima tappa: lo schermo va al nero e torna
  if (R.morto > 0) {
    R.morto -= dt;
    R.buio = Math.min(1, R.buio + dt * 1.6);
    if (R.morto <= 0) {
      const tappa = TAPPE.filter(x => x <= R.x + 40).pop() ?? TAPPE[0];
      Object.assign(R, { x: tappa, y: SUOLO, vx: 0, vy: 0, sopra: null });
      TAGLIOLA.chiusa = 0; TAGLIOLA.scatta = -1;
      if (CASSA.x > 1000 - CASSA.w && tappa < 1000) { CASSA.x = 640; CASSA.y = SUOLO; }
    }
    return;
  }
  R.buio = Math.max(0, R.buio - dt * 1.2);
  const inp = input();

  // inerzia: accelera e frena con calma, in aria si governa poco
  const vmax = R.spinge > 0 ? 95 : 235;
  const acc = R.terra ? 900 : 420;
  if (inp.x) { R.vx += inp.x * acc * dt; R.dir = inp.x > 0 ? 1 : -1; if (Math.abs(R.vx) > vmax) R.vx = Math.sign(R.vx) * Math.max(vmax, Math.abs(R.vx) - 1200 * dt); }
  else { const f = (R.terra ? 900 : 120) * dt; R.vx = Math.abs(R.vx) <= f ? 0 : R.vx - Math.sign(R.vx) * f; }
  if (inp.premuto && R.terra) { R.vy = -575; R.terra = false; R.sopra = null; }
  if (!inp.salto && R.vy < -200) R.vy += 2600 * dt;
  R.vy = Math.min(R.vy + 1600 * dt, 1100);

  // cavalca il tronco
  if (R.sopra === 'tronco') { R.x += TRONCO.dx; R.y += TRONCO.dy; }

  // orizzontale con la cassa da spingere
  R.spinge = Math.max(0, R.spinge - dt * 4);
  R.x += R.vx * dt;
  for (const b of blocchi()) {
    if (!sovrapposto(R.x - LARGO / 2, R.x + LARGO / 2, R.y - ALTO, R.y - 1, b.x0, b.x1, b.y0, b.y1)) continue;
    if (b.cassa && R.terra && Math.abs(R.vx) > 1) {
      // spinge: la cassa scivola se non trova ostacoli
      const d = R.vx > 0 ? (R.x + LARGO / 2) - b.x0 : (R.x - LARGO / 2) - b.x1;
      const prova = CASSA.x + d;
      const libera = !SOLIDI.some(s => s.roccia && sovrapposto(prova, prova + CASSA.w, CASSA.y - CASSA.h, CASSA.y - 1, s.x0, s.x1, s.y, SUOLO + 1));
      if (libera) { CASSA.x = prova; R.spinge = 1; continue; }
    }
    if (R.vx > 0) R.x = b.x0 - LARGO / 2; else if (R.vx < 0) R.x = b.x1 + LARGO / 2;
    R.vx = 0;
  }
  // verticale
  const prima = R.y;
  R.y += R.vy * dt;
  const eraTerra = R.terra;
  R.terra = false;
  if (R.sopra !== 'tronco') R.sopra = null;
  for (const b of blocchi()) {
    if (!sovrapposto(R.x - LARGO / 2, R.x + LARGO / 2, R.y - ALTO, R.y, b.x0, b.x1, b.y0, b.y1)) continue;
    if (R.vy >= 0 && prima <= b.y0 + 2) { R.y = b.y0; R.vy = 0; R.terra = true; R.sopra = b.cassa ? 'cassa' : null; }
    else if (R.vy < 0) { R.y = b.y1 + ALTO; R.vy = 0; }
  }
  // tronco: piattaforma da sopra
  const tt = TRONCO.y - 14;
  if (R.vy >= 0 && Math.abs(R.x - TRONCO.x) < TRONCO.w / 2 && prima <= tt + 6 + Math.max(0, TRONCO.dy) && R.y >= tt - 2) {
    R.y = tt; R.vy = 0; R.terra = true; R.sopra = 'tronco';
  } else if (R.sopra === 'tronco' && (Math.abs(R.x - TRONCO.x) > TRONCO.w / 2 || R.y < tt - 4)) R.sopra = null;
  if (R.terra && !eraTerra) R.atterra = 0.18;
  R.atterra -= dt;
  R.x = Math.max(20, Math.min(FINE, R.x));
  // tagliola
  if (R.terra && !R.sopra && Math.abs(R.x - TAGLIOLA.x) < 20 && TAGLIOLA.scatta < 0) { TAGLIOLA.scatta = t; TAGLIOLA.chiusa = 0.01; muori(); }
  if (R.y > V + 60) muori();
  R.fase += Math.abs(R.vx) * dt / 38;
}

// ── Disegno del ragazzino: arti sottili, testa tonda, due puntini bianchi ──
function ragazzino(g, t) {
  const x = R.x - cam, y = R.y;
  g.save(); g.translate(x, y); g.scale(R.dir * 1.12, 1.12);
  const corsa = Math.min(1, Math.abs(R.vx) / 200);
  const f = R.fase * Math.PI;
  let anca = Math.sin(f) * 0.75 * corsa, ginocchio;
  const aria = !R.terra;
  const sp = R.spinge;
  g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineCap = 'round'; g.lineJoin = 'round';
  const busto = aria ? 0.05 : 0.12 * corsa + sp * 0.35;
  const respiro = R.terra && corsa < 0.1 ? Math.sin(t * 2.2) * 0.8 : 0;
  const bob = R.terra ? Math.abs(Math.sin(f)) * 3 * corsa - (R.atterra > 0 ? 3 : 0) : 0;
  const hy = -30 + bob;   // anca
  const gamba = (a, avanti) => {
    let a1, a2;
    if (aria) { a1 = avanti ? -0.9 : 0.35; a2 = avanti ? 1.3 : 0.9; }
    else { a1 = a; a2 = Math.max(0, -Math.sin(f + (avanti ? 0 : Math.PI) - 0.9)) * 1.3 * corsa + 0.08; }
    const kx = Math.sin(a1) * 15, ky = hy + Math.cos(a1) * 15;
    const px = kx + Math.sin(a1 - a2) * 15, py = ky + Math.cos(a1 - a2) * 15;
    g.lineWidth = 5.2; g.beginPath(); g.moveTo(0, hy); g.lineTo(kx, ky); g.lineTo(px, py); g.stroke();
    g.beginPath(); g.ellipse(px + 2.5, py, 4.5, 2.4, 0, 0, Math.PI * 2); g.fill();
  };
  gamba(-anca, false);
  // busto
  g.save(); g.translate(0, hy); g.rotate(busto);
  g.beginPath(); g.moveTo(-6, 2); g.lineTo(6, 2); g.lineTo(5.5, -22); g.quadraticCurveTo(0, -25, -5.5, -22); g.closePath(); g.fill();
  const braccio = (a, avanti) => {
    let a1 = a, a2 = 0.5;
    if (aria) { a1 = avanti ? -2.3 : -1.6; a2 = 0.4; }
    if (sp > 0.3) { a1 = -1.45; a2 = 0.05; }
    const ex = Math.sin(-a1) * -11, ey = -19 + Math.cos(a1) * 11;
    const hx = ex + Math.sin(-(a1 - a2)) * -10, hy2 = ey + Math.cos(a1 - a2) * 10;
    g.lineWidth = 4; g.beginPath(); g.moveTo(0, -19); g.lineTo(ex, ey); g.lineTo(hx, hy2); g.stroke();
  };
  braccio(Math.sin(f) * 0.8 * corsa, true);
  // testa con ciuffi di capelli
  g.translate(1, -31 + respiro * 0.3);
  g.beginPath(); g.arc(0, 0, 10.5, 0, Math.PI * 2); g.fill();
  g.beginPath();
  for (const [a, l] of [[-2.4, 5], [-1.9, 6], [-1.4, 5], [-0.9, 4], [2.7, 4]]) {
    g.moveTo(Math.cos(a - 0.25) * 9, Math.sin(a - 0.25) * 9); g.lineTo(Math.cos(a) * (10 + l), Math.sin(a) * (10 + l)); g.lineTo(Math.cos(a + 0.25) * 9, Math.sin(a + 0.25) * 9);
  }
  g.fill();
  // occhi: due puntini bianchi, sbattono ogni tanto
  const blink = (t % 4.1) < 0.12;
  if (!blink) {
    g.fillStyle = '#fff';
    g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = 4 * k;
    g.beginPath(); g.arc(4.5, -1, 1.7, 0, Math.PI * 2); g.arc(9, -1.2, 1.4, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#000';
  }
  g.restore();
  // braccio e gamba davanti
  g.save(); g.translate(0, hy); g.rotate(busto);
  braccio(-Math.sin(f) * 0.8 * corsa, false);
  g.restore();
  gamba(anca, true);
  g.restore();
}

function disegnaPiano(t, cam) {
  const g = ctx;
  g.fillStyle = '#000';
  // alberi vicini (dietro al terreno)
  for (const v of VICINI) {
    const X = v.x - cam - 450;
    if (X > VW || X + 900 < 0) continue;
    g.drawImage(v.c, X, 0);
  }
  // grande ramo e corde del tronco sospeso
  g.drawImage(TRONCO.ramo, TRONCO.px - 380 - cam, TRONCO.py - 190);
  g.strokeStyle = '#000'; g.lineWidth = 3;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(TRONCO.px + s * 60 - cam, TRONCO.py - 2); g.lineTo(TRONCO.x + s * 60 - cam, TRONCO.y - 10); g.stroke();
  }
  // tronco: cilindro storto con monconi di rami
  g.save(); g.translate(TRONCO.x - cam, TRONCO.y);
  g.beginPath(); g.moveTo(-TRONCO.w / 2, -14); g.quadraticCurveTo(0, -18, TRONCO.w / 2, -13);
  g.lineTo(TRONCO.w / 2 + 4, 0); g.lineTo(TRONCO.w / 2 - 2, 13); g.quadraticCurveTo(0, 17, -TRONCO.w / 2, 13); g.lineTo(-TRONCO.w / 2 - 5, 0); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(40, -12); g.lineTo(56, -34); g.lineTo(60, -32); g.lineTo(48, -12); g.fill();
  g.beginPath(); g.moveTo(-50, 10); g.lineTo(-64, 30); g.lineTo(-60, 32); g.lineTo(-44, 12); g.fill();
  g.restore();

  // terreno: bordo irregolare, fosso con pali appuntiti sul fondo
  g.fillStyle = '#000';
  for (const s of SOLIDI) {
    const x0 = Math.max(s.x0, cam - 20), x1 = Math.min(s.x1, cam + VW + 20);
    if (x1 <= x0) continue;
    if (s.roccia) { roccia(s, cam); continue; }
    g.beginPath();
    g.moveTo(x0 - cam, s.y + 18);
    for (let x = x0; x <= x1; x += 8) {
      let y = s.y + Math.sin(x * 0.05) * 1.5 + Math.sin(x * 0.31) * 1;
      // bordi del fosso che franano
      if (s.x1 < FINE && s.x1 - x < 40) y += (40 - (s.x1 - x)) * 0.4;
      else if (s.x0 > 0 && x - s.x0 < 40) y += (40 - (x - s.x0)) * 0.4;
      g.lineTo(x - cam, y);
    }
    if (s.x1 < FINE) for (let y = s.y + 18; y < V + 10; y += 12) g.lineTo(x1 - cam - 6 + Math.sin(y * 0.5) * 5 - (y - s.y) * 0.08, y);
    g.lineTo(x1 - cam, V + 10);
    g.lineTo(x0 - cam, V + 10);
    if (s.x0 > 0) for (let y = V + 10; y > s.y + 18; y -= 12) g.lineTo(x0 - cam + 6 + Math.sin(y * 0.43) * 5 + (y - s.y) * 0.08, y);
    g.closePath(); g.fill();
  }
  // pali nel fosso
  g.beginPath();
  for (let x = 2130; x < 2590; x += 26) {
    const h = 60 + Math.sin(x) * 25, X = x - cam, l = Math.sin(x * 1.7) * 0.15;
    g.moveTo(X - 5, V + 10); g.lineTo(X + h * l, V - h + 30); g.lineTo(X + 5, V + 10);
  }
  g.fill();
  // sassi
  for (const s of SASSI) {
    if (s.x < cam - 20 || s.x > cam + VW + 20 || (s.x > 2090 && s.x < 2610)) continue;
    g.beginPath(); g.ellipse(s.x - cam, SUOLO + 1, s.r * 1.4, s.r, 0, Math.PI, 0); g.fill();
  }

  // cassa: assi e chiodi appena accennati (tutto nero, si leggono solo dal profilo)
  const cx = CASSA.x - cam, cy = CASSA.y - CASSA.h;
  g.fillRect(cx, cy, CASSA.w, CASSA.h);
  g.fillRect(cx - 2, cy - 2, CASSA.w + 4, 6); g.fillRect(cx - 2, cy + CASSA.h - 5, CASSA.w + 4, 6);
  g.save(); g.globalAlpha = 0.18; g.strokeStyle = '#777'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(cx + 5, cy + 8); g.lineTo(cx + CASSA.w - 5, cy + CASSA.h - 8); g.stroke();
  g.restore();

  // tagliola: due ganasce dentate
  {
    const X = TAGLIOLA.x - cam, Y = SUOLO - 2, c = TAGLIOLA.chiusa;
    g.fillRect(X - 28, Y - 3, 56, 5);
    // aperta la si vede di taglio (una fila di denti), chiusa diventa un arco dritto
    for (const lato of [-1, 1]) {
      g.save(); g.translate(X, Y);
      const alz = 0.2 + 0.8 * c;
      g.scale(1, alz);
      g.beginPath(); g.arc(0, 0, 25, Math.PI, Math.PI * 2); g.arc(0, 0, 20, Math.PI * 2, Math.PI, true); g.closePath(); g.fill();
      g.beginPath();
      for (let i = 1; i < 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI, w = 0.11;
        g.moveTo(Math.cos(a - w) * 20.5, Math.sin(a - w) * 20.5);
        g.lineTo(Math.cos(a) * (c > 0.5 ? 13 : 11), Math.sin(a) * (c > 0.5 ? 13 : 11) - (1 - c) * 18 * lato * 0.5 - (1 - c) * 9);
        g.lineTo(Math.cos(a + w) * 20.5, Math.sin(a + w) * 20.5);
      }
      g.fill();
      g.restore();
    }
    // catena
    g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(X + 26, Y); g.quadraticCurveTo(X + 50, Y + 4, X + 70, Y); g.stroke();
  }

  // erba alta dietro al ragazzino
  erba(t, cam, 0);
  if (R.morto <= 0 || R.morto > 1.2) ragazzino(g, t);
  // un po' d'erba davanti, per nasconderlo nel folto
  erba(t, cam, 1);
}
// sporgenza di roccia: massa irregolare, fianchi che strapiombano, radici che pendono
function roccia(s, cam) {
  const g = ctx;
  g.beginPath();
  g.moveTo(s.x0 - 30 - cam, SUOLO + 6);
  for (let y = SUOLO; y >= s.y + 6; y -= 10) {
    const u = (SUOLO - y) / (SUOLO - s.y);
    g.lineTo(s.x0 - cam - 18 * Math.sin(u * Math.PI) + Math.sin(y * 0.41) * 4 + (1 - u) * -12, y);
  }
  for (let x = s.x0; x <= s.x1; x += 9) {
    const y = s.y + Math.sin(x * 0.07) * 3 + Math.sin(x * 0.29) * 2 + (Math.min(x - s.x0, s.x1 - x) < 20 ? 6 : 0);
    g.lineTo(x - cam, y);
  }
  for (let y = s.y + 6; y <= SUOLO; y += 10) {
    const u = (SUOLO - y) / (SUOLO - s.y);
    g.lineTo(s.x1 - cam + 22 * Math.sin(u * Math.PI) - Math.sin(y * 0.37) * 4 + (1 - u) * 16, y);
  }
  g.lineTo(s.x1 + 30 - cam, SUOLO + 6);
  g.closePath(); g.fill();
  // radici penzolanti dal bordo destro
  g.strokeStyle = '#000'; g.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) {
    const x = s.x1 - cam + 10 + i * 4, y = s.y + 30 + i * 9;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y + 20 + i * 3, x + 4 + i, y + 40 + i * 6); g.stroke();
  }
}
function erba(t, cam, davanti) {
  const g = ctx;
  g.fillStyle = '#000';
  g.beginPath();
  for (let i = davanti; i < ERBA.length; i += 2) {
    const e = ERBA[i];
    if (e.x < cam - 40 || e.x > cam + VW + 40) continue;
    const base = e.y ?? SUOLO;
    // vento + la spinta del passaggio del ragazzino
    const d = e.x - R.x;
    const vicino = Math.abs(d) < 26 && Math.abs(R.y - base) < 30 ? (1 - Math.abs(d) / 26) * Math.sign(d || 1) * 0.9 : 0;
    const l = e.l + Math.sin(t * 1.3 + e.f + e.x * 0.01) * 0.12 + vicino;
    const h = e.h * (davanti ? 0.7 : 1);
    const X = e.x - cam;
    g.moveTo(X - e.w, base + 2); g.quadraticCurveTo(X + l * h * 0.3, base - h * 0.6, X + l * h, base - h); g.quadraticCurveTo(X + l * h * 0.3 + 0.8, base - h * 0.5, X + e.w, base + 2);
  }
  g.fill();
}

// ── Pulviscolo che galleggia nella luce ──
const POLVERE = [];
for (let i = 0; i < 70; i++) { seme = 555 + i * 13; POLVERE.push({ x: tra(0, 1), y: tra(0.05, 0.75), v: tra(0.004, 0.015), f: tra(0, 6), r: tra(0.6, 1.6) }); }

let cam = 0, camAnt = 0;
function disegna(t) {
  const g = ctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.filter = 'none';
  // cielo: grigio chiaro, più luminoso in alto verso la luce
  const cielo = g.createLinearGradient(0, 0, 0, cv.height);
  cielo.addColorStop(0, '#9d9d99'); cielo.addColorStop(0.4, '#b3b3ae'); cielo.addColorStop(0.72, '#aaaaa6'); cielo.addColorStop(1, '#8e8e8b');
  g.fillStyle = cielo; g.fillRect(0, 0, cv.width, cv.height);
  const luce = g.createRadialGradient(cv.width * 0.55, -cv.height * 0.1, 0, cv.width * 0.55, -cv.height * 0.1, cv.height * 0.9);
  luce.addColorStop(0, 'rgba(255,255,250,0.55)'); luce.addColorStop(1, 'rgba(255,255,250,0)');
  g.fillStyle = luce; g.fillRect(0, 0, cv.width, cv.height);

  g.setTransform(k, 0, 0, k, 0, 0);
  // piani lontani, dal più chiaro al più scuro, con veli di nebbia fra uno e l'altro
  STRISCE.forEach(({ c, P }, i) => {
    const q = P.q;
    const sx = cam * P.p;
    g.drawImage(c, sx * q, 0, VW * q, V * q, 0, 0, VW, V);
    const nb = g.createLinearGradient(0, 330, 0, V);
    const a = [0.32, 0.26, 0.2][i];
    nb.addColorStop(0, 'rgba(200,200,196,0)'); nb.addColorStop(0.55, `rgba(200,200,196,${a})`); nb.addColorStop(1, `rgba(190,190,186,${a * 0.6})`);
    g.fillStyle = nb; g.fillRect(0, 300, VW, V - 300);
    // banco di nebbia che scorre lento
    if (i === 1) {
      g.globalAlpha = 0.22;
      for (let j = 0; j < 4; j++) {
        const x = ((j * 700 - cam * 0.35 - t * 12) % 2800 + 2800) % 2800 - 700;
        const nebbia = g.createRadialGradient(x + 350, 520, 10, x + 350, 520, 420);
        nebbia.addColorStop(0, 'rgba(225,225,220,1)'); nebbia.addColorStop(1, 'rgba(225,225,220,0)');
        g.fillStyle = nebbia; g.fillRect(x - 100, 300, 900, 420);
      }
      g.globalAlpha = 1;
    }
  });
  // raggi di luce dall'alto
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [x0, p, s] of [[380, 0.4, 1], [1500, 0.4, 0.8], [2500, 0.4, 1.1], [3300, 0.4, 0.9]]) {
    const X = x0 - cam * p;
    if (X > VW + 400 || X + 900 * s < -400) continue;
    g.globalAlpha = 0.55 + Math.sin(t * 0.7 + x0) * 0.1;
    g.setTransform(k * s, 0, Math.sin(t * 0.3 + x0) * 0.04 * k, k * 1.7, X * k, -30 * k);
    g.drawImage(RAGGI, 0, 0);
  }
  g.restore();
  g.setTransform(k, 0, 0, k, 0, 0);
  // pulviscolo nei raggi
  g.fillStyle = '#fff';
  for (const p of POLVERE) {
    const x = ((p.x * VW * 1.3 - cam * 0.6 + Math.sin(t * 0.4 + p.f) * 20) % (VW * 1.3) + VW * 1.3) % (VW * 1.3);
    const y = ((p.y * V - t * p.v * V * 0.3) % V + V) % V;
    g.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.3 + p.f);
    g.fillRect(x, y, p.r, p.r);
  }
  g.globalAlpha = 1;

  disegnaPiano(t, cam);

  // primo piano sfocato
  g.drawImage(PRIMO, cam * 1.35 * 0.5, 0, VW * 0.5, V * 0.5, 0, 0, VW, V);

  // ── pellicola ──
  g.setTransform(1, 0, 0, 1, 0, 0);
  // sfarfallio del proiettore: la luce respira a scatti
  const fl = Math.sin(t * 37) * Math.sin(t * 23.3) * 0.5 + 0.5;
  g.fillStyle = `rgba(0,0,0,${0.03 + fl * 0.05})`; g.fillRect(0, 0, cv.width, cv.height);
  // grana
  const fot = Math.floor(t * 24);
  g.globalCompositeOperation = 'overlay';
  const gi = GRANA[fot % 4];
  const ox = (fot * 97) % 256, oy = (fot * 61) % 256;
  const s = Math.max(1, Math.round(cv.height / 720 * 1.5));
  g.save(); g.scale(s, s);
  for (let y = -oy; y < cv.height / s; y += 256) for (let x = -ox; x < cv.width / s; x += 256) g.drawImage(gi, x, y);
  g.restore();
  g.globalCompositeOperation = 'source-over';
  // graffi verticali, rari
  if ((fot * 7919) % 23 === 0) {
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(((fot * 131) % 1000) / 1000 * cv.width, 0, Math.max(1, cv.width / 1400), cv.height);
  }
  if ((fot * 104729) % 31 === 0) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(((fot * 733) % 1000) / 1000 * cv.width, 0, Math.max(1, cv.width / 1000), cv.height);
  }
  g.drawImage(VIGNETTA, 0, 0);
  // al buio quando si muore
  if (R.buio > 0) { g.fillStyle = `rgba(0,0,0,${R.buio})`; g.fillRect(0, 0, cv.width, cv.height); }
}

function camera(dt) {
  const ant = R.dir * VW * 0.08 + R.vx * 0.3;
  camAnt += (ant - camAnt) * Math.min(1, dt * 1.5);
  const target = R.x - VW * 0.42 + camAnt;
  cam += (target - cam) * Math.min(1, dt * 3.2);
  cam = Math.max(-100, Math.min(FINE + 100 - VW, cam));
}

function avvia() {
  Demo.carica('Dipingo il bosco', 0.3);
  ridimensiona();
  addEventListener('resize', ridimensiona);
  dipingiPiani(); dipingiRaggi(); preparaPiano();
  if (Demo.query.has('x')) R.x = +Demo.query.get('x');
  if (pilota) R.x = 330;
  cam = R.x - VW * 0.42 + R.dir * VW * 0.08;
  Demo.loop((dt, t) => {
    if (dt > 0) {
      const n = Math.ceil(dt / (1 / 120));
      for (let i = 0; i < n; i++) aggiorna(dt / n, t - dt + (i + 1) * dt / n);
      camera(dt);
      fotogramma++;
    }
    disegna(t);
    if (Demo.query.has('debug') && window.__shotReady) document.title = 'DBG ' + [R.x, R.y, R.morto, cam, VW, R.sopra].join(',');
  });
  Demo.pronto();
}
try { avvia(); } catch (e) { Demo.errore(e); }
