// Attrezzi da disegno: tratto a matita, riempimento a pastello, tratteggio, grana del foglio.
// Ogni disegno si prerende in tre varianti con un seme diverso: alternarle fa "bollire" la linea.

export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// Grana del foglio: puntini sparsi, usata per "mangiare" il colore e la grafite
let GRANA = null;
export function grana() {
  if (GRANA) return GRANA;
  GRANA = document.createElement('canvas'); GRANA.width = GRANA.height = 256;
  const g = GRANA.getContext('2d'), im = g.createImageData(256, 256), R = rng(99);
  for (let i = 0; i < 256 * 256; i++) {
    const v = R();
    im.data[i * 4 + 3] = v < 0.42 ? 40 + R() * 215 : v < 0.6 ? R() * 60 : 0;
  }
  g.putImageData(im, 0, 0);
  return GRANA;
}

// Curva morbida (Catmull-Rom) che passa per i punti di controllo, campionata fitta
export function curva(ctrl, passo = 4) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / passo));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

// Ellisse che non si chiude mai bene: parte da un angolo a caso e sfora (o non arriva) di un po'
export function ellisse(R, cx, cy, rx, ry, sfora = 0.35) {
  const a0 = R() * 6.28, a1 = a0 + 6.28 + (R() - 0.3) * sfora, pts = [];
  const n = Math.max(12, Math.ceil((rx + ry) * 0.9));
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const w = 1 + (R() - 0.5) * 0.03; pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]); }
  return pts;
}

// Tratto a matita: punti spostati a caso, pressione che cala alle estremità, un secondo passaggio leggero
export function tratto(D, pts, o = {}) {
  const g = D.linee, R = D.R;
  const w = (o.w ?? 2.4) * 1.15, jit = o.jit ?? 1.3;
  const off = [(R() - 0.5) * jit, (R() - 0.5) * jit];
  const p = pts.map(([x, y], i) => [x + off[0] + (R() - 0.5) * jit * 0.9, y + off[1] + (R() - 0.5) * jit * 0.9]);
  g.strokeStyle = o.col ?? '#231f22'; g.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.globalAlpha = (o.a ?? 1) * (pass ? 0.3 : 0.95);
    const ox = pass ? (R() - 0.5) * 2 : 0, oy = pass ? (R() - 0.5) * 2 : 0;
    for (let i = 1; i < p.length; i++) {
      const u = i / p.length;
      g.lineWidth = w * (0.55 + 0.45 * Math.min(1, Math.sin(u * Math.PI) * 2.2)) * (0.85 + R() * 0.3) * (pass ? 0.7 : 1);
      g.beginPath(); g.moveTo(p[i - 1][0] + ox, p[i - 1][1] + oy); g.lineTo(p[i][0] + ox, p[i][1] + oy); g.stroke();
    }
  }
  g.globalAlpha = 1;
}

function percorso(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }

// Pastello: base tenue + tratti paralleli fitti, spostato rispetto al contorno (il colore "esce")
export function pastello(D, pts, col, o = {}) {
  const g = D.colore, R = D.R;
  const dx = (o.dx ?? 1.5) + (R() - 0.5) * 3, dy = (o.dy ?? 1.5) + (R() - 0.5) * 3;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sc = o.sc ?? 1.02;
  const sp = pts.map(([x, y]) => [cx + (x - cx) * sc + dx, cy + (y - cy) * sc + dy]);
  g.save(); percorso(g, sp); g.clip();
  g.fillStyle = col; g.globalAlpha = o.base ?? 0.3; g.fill();
  g.strokeStyle = col; g.lineCap = 'round';
  const ang = o.ang ?? -1.05, passo = o.passo ?? 2.4, ca = Math.cos(ang), sa = Math.sin(ang);
  const L = Math.hypot(x1 - x0, y1 - y0) / 2 + 10;
  for (let s = -L; s < L; s += passo * (0.7 + R() * 0.6)) {
    g.globalAlpha = (o.forza ?? 0.55) * (0.5 + R() * 0.5);
    g.lineWidth = 1.4 + R() * 1.3;
    const a = -L * (0.8 + R() * 0.2), b = L * (0.8 + R() * 0.2);
    g.beginPath();
    g.moveTo(cx - sa * s + ca * a, cy + ca * s + sa * a);
    g.lineTo(cx - sa * s + ca * b + (R() - 0.5) * 3, cy + ca * s + sa * b + (R() - 0.5) * 3);
    g.stroke();
  }
  g.restore();
  // qualche tratto che scappa oltre il bordo
  const nf = o.fughe ?? 2;
  for (let k = 0; k < nf; k++) {
    const q = sp[Math.floor(R() * sp.length)];
    g.globalAlpha = 0.35; g.strokeStyle = col; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(q[0] - ca * 5, q[1] - sa * 5); g.lineTo(q[0] + ca * (4 + R() * 6), q[1] + sa * (4 + R() * 6)); g.stroke();
  }
  g.globalAlpha = 1;
}

// Copre quello che c'è sotto (colore e linee) dentro una forma: per le cose che stanno davanti
export function copri(D, pts) {
  for (const g of [D.colore, D.linee]) {
    g.save(); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 1;
    percorso(g, pts); g.fill(); g.restore();
  }
}

// Tratteggio d'ombra: tratti grigi leggeri dentro un'ellisse, sfrangiati ai bordi
export function ombra(D, cx, cy, rx, ry, o = {}) {
  const g = D.colore, R = D.R;
  g.strokeStyle = o.col ?? '#5d5763'; g.lineCap = 'round';
  const passo = o.passo ?? 4.2;
  for (let x = cx - rx; x < cx + rx; x += passo * (0.8 + R() * 0.4)) {
    const u = (x - cx) / rx, h = Math.sqrt(Math.max(0, 1 - u * u)) * ry * (0.75 + R() * 0.3);
    g.globalAlpha = (o.a ?? 0.32) * (0.6 + R() * 0.4); g.lineWidth = 1.3 + R() * 0.8;
    g.beginPath(); g.moveTo(x - h * 0.5, cy - h); g.lineTo(x + h * 0.5 + (R() - 0.5) * 2, cy + h); g.stroke();
  }
  g.globalAlpha = 1;
}

// Prerende un disegno in tre varianti. box = [x0, y0, x1, y1] in unità locali (0,0 = punto d'appoggio)
export function prerendi(disegno, box, Z, seme, sotto = null) {
  const [x0, y0, x1, y1] = box, W = Math.ceil((x1 - x0) * Z), H = Math.ceil((y1 - y0) * Z);
  const nuovo = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  return [0, 1, 2].map(v => {
    const out = nuovo(), col = nuovo(), lin = nuovo();
    const D = { colore: col.getContext('2d'), linee: lin.getContext('2d'), R: rng(seme * 7 + v * 131 + 3), v };
    for (const g of [D.colore, D.linee]) g.setTransform(Z, 0, 0, Z, -x0 * Z, -y0 * Z);
    disegno(D);
    for (const [c, a] of [[col, 0.62], [lin, 0.4]]) {
      const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-out'; g.globalAlpha = a;
      const pat = g.createPattern(grana(), 'repeat'); pat.setTransform(new DOMMatrix().translate(v * 71, v * 37));
      g.fillStyle = pat; g.fillRect(0, 0, W, H);
    }
    const o = out.getContext('2d');
    if (sotto) { o.setTransform(Z, 0, 0, Z, -x0 * Z, -y0 * Z); sotto(o, rng(seme + v)); o.setTransform(1, 0, 0, 1, 0, 0); }
    o.drawImage(col, 0, 0); o.drawImage(lin, 0, 0);
    return out;
  });
}
