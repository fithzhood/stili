// Carta ritagliata — un paesaggio di cartoncini sovrapposti, alla maniera di Tearaway e dei libri pop-up.
// Canvas 2D. Ogni strato è una sagoma tagliata (a forbice: spezzata a faccette; strappata: orlo
// irregolare con l'anima bianca della carta che si vede), riempita a tinta unita, con sopra la fibra
// della carta in moltiplicazione e sotto un'ombra portata la cui distanza dice quanto è staccato il foglio.
'use strict';

const cv = document.createElement('canvas');
document.body.prepend(cv);
const ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, U = 1, VW = 1280;

function ridimensiona() {
  DPR = Demo.shot ? 1 : Math.min(devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  U = H / 720; VW = W / U;
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

// ── Fibra della carta ──
let fibra = null;
function preparaFibra() {
  const N = 512, g = document.createElement('canvas'); g.width = g.height = N;
  const c = g.getContext('2d');
  const id = c.createImageData(N, N);
  let s = 11;
  const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N * N; i++) {
    const v = 255 - R() * 16;
    id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v - 1; id.data[i * 4 + 3] = 255;
  }
  c.putImageData(id, 0, 0);
  // macchioline morbide (la pasta della carta non è uniforme)
  for (let i = 0; i < 60; i++) {
    const x = R() * N, y = R() * N, r = 10 + R() * 40;
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(120,110,90,0.05)'); gr.addColorStop(1, 'rgba(120,110,90,0)');
    c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // fibre: tanti capelli corti e curvi
  for (let i = 0; i < 900; i++) {
    const x = R() * N, y = R() * N, a = R() * 6.28, l = 3 + R() * 14;
    c.strokeStyle = `rgba(110,95,70,${0.05 + R() * 0.12})`; c.lineWidth = 0.4 + R() * 0.6;
    c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + Math.cos(a + 0.8) * l * 0.5, y + Math.sin(a + 0.8) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  fibra = ctx.createPattern(g, 'repeat');
}

// ── Taglio e riempimento di un foglio ──
const OMBRA = 'rgba(45, 30, 15, 0.42)';
/** Riempie il percorso corrente come un cartoncino: colore, ombra portata (distanza d dal foglio sotto), fibra. */
function foglio(col, d, ox = 0, oy = 0, alfaOmbra = 1) {
  ctx.save();
  if (d > 0) {
    ctx.shadowColor = alfaOmbra === 1 ? OMBRA : `rgba(45, 30, 15, ${0.42 * alfaOmbra})`;
    ctx.shadowBlur = (4 + d * 1.6) * U * DPR;
    ctx.shadowOffsetX = d * 0.55 * U * DPR; ctx.shadowOffsetY = d * 0.8 * U * DPR;
  }
  ctx.fillStyle = col; ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.75;
  ctx.translate(ox, oy);
  ctx.fillStyle = fibra;
  ctx.setTransform(ctx.getTransform().scale(0.7, 0.7));
  ctx.fill();
  ctx.restore();
}
/** Contorno a forbice di un cerchio: poche faccette, raggio che sbanda appena. */
function cerchioForbice(cx, cy, r, seme, faccette = 0) {
  const n = faccette || Math.max(14, Math.round(r * 0.9));
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, rr = r * (1 + (hash(seme, i % n) - 0.5) * 0.035);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}
function poliForbice(pts, seme, j = 0.8) {
  pts.forEach(([x, y], i) => {
    const X = x + (hash(seme, i * 2) - 0.5) * j, Y = y + (hash(seme, i * 2 + 1) - 0.5) * j;
    i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
  });
  ctx.closePath();
}

// ── Colline a strati: profilo continuo + orlo strappato ──
function profilo(x, s) {
  if (s.monti) return -(1 - Math.abs(Math.sin(x * 0.0052 + 0.7))) * 95 - (1 - Math.abs(Math.sin(x * 0.0119 + 2))) * 38;
  return Math.sin(x * s.f1 + s.p1) * s.a1 + Math.sin(x * s.f2 + s.p2) * s.a2 + Math.sin(x * s.f3 + s.p3) * s.a3;
}
const STRATI = [
  { par: 0.1, base: 370, col: '#b4d3d6', anima: '#f4f1e6', d: 4, monti: true, seme: 5, deco: '' },
  { par: 0.18, base: 430, col: '#9cc7c0', anima: '#f4f1e6', d: 5, f1: 0.0042, a1: 46, p1: 1, f2: 0.011, a2: 16, p2: 2, f3: 0.03, a3: 3, p3: 0, seme: 11, deco: 'abeti', colDeco: '#7aa9a3' },
  { par: 0.36, base: 480, col: '#a9d17a', anima: '#f6f3e4', d: 7, f1: 0.0034, a1: 38, p1: 3, f2: 0.009, a2: 18, p2: 0.5, f3: 0.025, a3: 4, p3: 1, seme: 23, deco: 'tondi', colDeco: '#7fb357' },
  { par: 0.62, base: 540, col: '#79bb58', anima: '#f3f1e2', d: 9, f1: 0.0027, a1: 30, p1: 5, f2: 0.0075, a2: 14, p2: 4, f3: 0.021, a3: 4, p3: 2, seme: 37, deco: 'siepe', colDeco: '#5d9e44' },
];
function strato(s, cam, t) {
  const off = cam * s.par;
  const x0 = Math.floor((off - 40) / 7) * 7, x1 = off + VW + 40;
  // l'anima bianca: un orlo appena più alto e più frastagliato del colore
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 7) {
    const y = s.base + profilo(x, s) - 2.2 + (hash(s.seme + 1, Math.round(x / 7)) - 0.5) * 3.4;
    x === x0 ? ctx.moveTo(x - off, y) : ctx.lineTo(x - off, y);
  }
  ctx.lineTo(x1 - off, 760); ctx.lineTo(x0 - off, 760); ctx.closePath();
  foglio(s.anima, s.d, -off, 0);
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 7) {
    const y = s.base + profilo(x, s) + (hash(s.seme, Math.round(x / 7)) - 0.5) * 1.6;
    x === x0 ? ctx.moveTo(x - off, y) : ctx.lineTo(x - off, y);
  }
  ctx.lineTo(x1 - off, 760); ctx.lineTo(x0 - off, 760); ctx.closePath();
  foglio(s.col, 0, -off, 0);
  // decorazioni incollate sullo strato (piccoli ritagli con la loro ombrina)
  if (!s.deco) return;
  const passo = s.deco === 'siepe' ? 150 : 95;
  for (let c = Math.floor((off - 60) / passo); c * passo < off + VW + 60; c++) {
    const h = hash(s.seme + 5, c);
    if (h < 0.35) continue;
    const wx = c * passo + hash(s.seme + 6, c) * passo * 0.6;
    const y = s.base + profilo(wx, s) + 4, x = wx - off;
    const k = 0.7 + hash(s.seme + 7, c) * 0.6;
    ctx.beginPath();
    if (s.deco === 'abeti') poliForbice([[x - 9 * k, y], [x, y - 34 * k], [x + 9 * k, y]], c);
    else if (s.deco === 'tondi') { cerchioForbice(x, y - 22 * k, 12 * k, c, 13); ctx.rect(x - 1.6, y - 14 * k, 3.2, 14 * k); }
    else { cerchioForbice(x, y - 6, 16 * k, c, 12); cerchioForbice(x + 18 * k, y - 4, 12 * k, c + 1, 11); }
    foglio(s.colDeco, 2.2, -off, 0);
  }
}

// ── Terreno principale, dove cammina il burattino ──
const SUOLO = { f1: 0.0021, a1: 10, p1: 0.3, f2: 0.0063, a2: 6, p2: 1.2, f3: 0.02, a3: 1.5, p3: 0 };
const suoloY = x => 600 + profilo(x, SUOLO);
function terreno(cam) {
  const x0 = Math.floor((cam - 40) / 6) * 6, x1 = cam + VW + 40;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 6) {
    const y = suoloY(x) - 1.5 + (hash(71, Math.round(x / 6)) - 0.5) * 2.8;
    x === x0 ? ctx.moveTo(x - cam, y) : ctx.lineTo(x - cam, y);
  }
  ctx.lineTo(x1 - cam, 760); ctx.lineTo(x0 - cam, 760); ctx.closePath();
  foglio('#f4f2e4', 11, -cam, 0);
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 6) {
    const y = suoloY(x) + (hash(70, Math.round(x / 6)) - 0.5) * 1.2;
    x === x0 ? ctx.moveTo(x - cam, y) : ctx.lineTo(x - cam, y);
  }
  ctx.lineTo(x1 - cam, 760); ctx.lineTo(x0 - cam, 760); ctx.closePath();
  foglio('#5aa447', 0, -cam, 0);
  // una striscia di terra più in basso, incollata sopra
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 10) {
    const y = suoloY(x) + 62 + Math.sin(x * 0.013) * 5 + (hash(72, Math.round(x / 10)) - 0.5) * 2;
    x === x0 ? ctx.moveTo(x - cam, y) : ctx.lineTo(x - cam, y);
  }
  ctx.lineTo(x1 - cam, 760); ctx.lineTo(x0 - cam, 760); ctx.closePath();
  foglio('#b88b5a', 5, -cam, 0);
  // sassolini di cartoncino nella terra
  for (let c = Math.floor(cam / 70); c * 70 < cam + VW; c++) {
    if (hash(73, c) < 0.5) continue;
    const x = c * 70 + hash(74, c) * 50 - cam, y = suoloY(c * 70) + 88 + hash(75, c) * 40;
    ctx.beginPath(); ctx.ellipse(x, y, 7 + hash(76, c) * 6, 4 + hash(77, c) * 3, 0, 0, 7);
    foglio('#9c7147', 2, -cam, 0);
  }
}

// ── Pop-up: si alzano piegandosi lungo la base quando il burattino si avvicina ──
const POP = [];
function aggiungiPop(tipo, x) { POP.push({ tipo, x, th: 0, v: 0, seme: POP.length * 13 + 5, ritardo: 0 }); }
aggiungiPop('fiori', -140); aggiungiPop('albero', 120); aggiungiPop('casa', 420);
aggiungiPop('abete', 700); aggiungiPop('fungo', 900); aggiungiPop('albero', 1120);
aggiungiPop('cartello', 1330); aggiungiPop('abete', 1560); aggiungiPop('fiori', 1700);
aggiungiPop('casa', 1980); aggiungiPop('albero', 2250); aggiungiPop('fungo', 2420);
const TIPI = ['albero', 'abete', 'fiori', 'fungo', 'casa', 'albero', 'abete'];
for (let i = 0; i < 40; i++) {                       // oltre, e prima, il mondo continua
  aggiungiPop(TIPI[Math.floor(hash(300, i) * TIPI.length)], 2700 + i * 290 + hash(301, i) * 120);
  aggiungiPop(TIPI[Math.floor(hash(302, i) * TIPI.length)], -420 - i * 300 - hash(303, i) * 120);
}

/** Disegna il pop-up con alzata th (0 = steso sul foglio, 1 = in piedi). Coordinate locali: base al suolo. */
function disegnaPop(p, cam) {
  const bx = p.x - cam;
  if (bx < -200 || bx > VW + 200) return;
  const by = suoloY(p.x) + 2;
  const th = p.th;
  const sy = Math.max(0.04, th);                      // altezza proiettata
  // la linguetta di piega: un trapezio chiaro alla base, come nei libri animati
  ctx.save();
  ctx.translate(bx, by);
  ctx.beginPath();
  const lw = p.tipo === 'casa' ? 70 : 26;
  ctx.moveTo(-lw, 0); ctx.lineTo(lw, 0); ctx.lineTo(lw - 6, 7 + 6 * (1 - Math.min(1, th))); ctx.lineTo(-lw + 6, 7 + 6 * (1 - Math.min(1, th))); ctx.closePath();
  foglio('#efe8d2', 2, -bx, -by);
  ctx.restore();

  ctx.save();
  ctx.translate(bx, by);
  ctx.transform(1, 0, -0.12 * (1 - Math.min(1, th)), sy, 0, 0);   // si alza piegandosi
  const d = 2 + 12 * Math.min(1, th);                               // più è alzato, più l'ombra si allontana
  const S = p.seme;
  const pezzo = (col, dd = d) => foglio(col, dd, -bx, -by);
  if (p.tipo === 'albero') {
    ctx.beginPath(); poliForbice([[-7, 0], [-5, -70], [5, -70], [7, 0]], S); pezzo('#8a5a36');
    ctx.beginPath(); cerchioForbice(-4, -98, 44, S + 1, 20); pezzo('#3f8f3a');
    ctx.beginPath(); cerchioForbice(10, -110, 30, S + 2, 16); pezzo('#58a948', 3);
    ctx.beginPath(); cerchioForbice(-18, -86, 18, S + 3, 12); pezzo('#6cbb55', 2);
    for (let i = 0; i < 4; i++) { ctx.beginPath(); cerchioForbice(-20 + i * 13, -100 + (i % 2) * 18, 4, S + 10 + i, 8); pezzo('#e2463a', 1.5); }
  } else if (p.tipo === 'abete') {
    ctx.beginPath(); poliForbice([[-6, 0], [-6, -24], [6, -24], [6, 0]], S); pezzo('#7b4f2f');
    const col = ['#2f7a4a', '#3a8c55', '#4b9f62'];
    for (let i = 0; i < 3; i++) {
      const y0 = -18 - i * 36, w = 46 - i * 11;
      ctx.beginPath(); poliForbice([[-w, y0], [0, y0 - 62 + i * 4], [w, y0], [w * 0.4, y0 - 6], [0, y0 + 2], [-w * 0.4, y0 - 6]], S + i, 1.2);
      pezzo(col[i], i ? 4 : d);
    }
  } else if (p.tipo === 'fiori') {
    for (let i = 0; i < 3; i++) {
      const x = -26 + i * 26, h = 36 + (i % 2) * 18;
      ctx.beginPath(); poliForbice([[x - 2, 0], [x - 2, -h], [x + 2, -h], [x + 2, 0]], S + i); pezzo('#3d8a3a', 3);
      ctx.beginPath(); poliForbice([[x, -12], [x + 14, -24], [x + 3, -16]], S + i + 5); pezzo('#4ea247', 2);
      const colP = ['#f07aa0', '#f4c542', '#9b7fe0'][i];
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2 + i;
        ctx.beginPath(); cerchioForbice(x + Math.cos(a) * 8, -h + Math.sin(a) * 8, 7, S + 20 + k + i * 5, 9); pezzo(colP, 3);
      }
      ctx.beginPath(); cerchioForbice(x, -h, 5, S + 40 + i, 8); pezzo('#fff3c4', 1.5);
    }
  } else if (p.tipo === 'fungo') {
    ctx.beginPath(); poliForbice([[-11, 0], [-9, -34], [9, -34], [11, 0]], S); pezzo('#f3ead2');
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) { const a = Math.PI + i / 14 * Math.PI; ctx.lineTo(Math.cos(a) * 40, -30 + Math.sin(a) * 36); }
    ctx.closePath(); pezzo('#d94a3a');
    for (const [x, y, r] of [[-18, -46, 6], [4, -56, 7], [22, -40, 5]]) { ctx.beginPath(); cerchioForbice(x, y, r, S + x, 9); pezzo('#fbf5e6', 1.5); }
  } else if (p.tipo === 'cartello') {
    ctx.beginPath(); poliForbice([[-4, 0], [-4, -58], [4, -58], [4, 0]], S); pezzo('#8a5a36');
    ctx.beginPath(); poliForbice([[-34, -80], [26, -80], [42, -66], [26, -52], [-34, -52]], S + 1); pezzo('#d9b27c');
    ctx.beginPath(); poliForbice([[-24, -68], [18, -68], [18, -63], [-24, -63]], S + 2, 0.5); pezzo('#9c7147', 1);
  } else if (p.tipo === 'casa') {
    // tre fogli che si alzano uno sull'altro: muro, tetto, dettagli
    ctx.beginPath(); poliForbice([[-58, 0], [-58, -78], [58, -78], [58, 0]], S); pezzo('#f2d8a6');
    ctx.beginPath(); poliForbice([[34, -96], [34, -140], [50, -140], [50, -96]], S + 7); pezzo('#b2553d', 4);
    ctx.beginPath(); poliForbice([[-74, -72], [0, -136], [74, -72]], S + 1, 1.2); pezzo('#c9573f', 5);
    ctx.beginPath(); poliForbice([[-60, -74], [0, -126], [60, -74], [52, -74], [0, -118], [-52, -74]], S + 8, 0.6); pezzo('#e07052', 1.5);
    ctx.beginPath(); poliForbice([[-14, 0], [-14, -46], [14, -46], [14, 0]], S + 2); pezzo('#6b86c9', 3);
    ctx.beginPath(); cerchioForbice(8, -22, 2.4, S + 3, 6); pezzo('#f4c542', 1);
    for (const x of [-38, 38]) {
      ctx.beginPath(); poliForbice([[x - 12, -58], [x + 12, -58], [x + 12, -36], [x - 12, -36]], S + x); pezzo('#fbe7a2', 2);
      ctx.beginPath(); poliForbice([[x - 1.2, -58], [x + 1.2, -58], [x + 1.2, -36], [x - 1.2, -36]], S + x + 1, 0.3); pezzo('#c9573f', 1);
      ctx.beginPath(); poliForbice([[x - 12, -48], [x + 12, -48], [x + 12, -46], [x - 12, -46]], S + x + 2, 0.3); pezzo('#c9573f', 1);
    }
    // fumo di carta dal comignolo
    for (let i = 0; i < 3; i++) {
      const k = ((tempo * 0.35 + i / 3) % 1);
      ctx.beginPath(); cerchioForbice(42 + k * 18, -150 - k * 60, 6 + k * 10, S + 50 + i, 10);
      ctx.save(); ctx.globalAlpha = Math.min(1, th) * (1 - k); foglio('#ffffff', 3, -bx, -by); ctx.restore();
    }
  }
  ctx.restore();
  // la piega: una riga di luce lungo la cerniera
  if (th > 0.05) {
    ctx.save(); ctx.translate(bx, by);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-lw + 4, 0.5); ctx.lineTo(lw - 4, 0.5); ctx.stroke();
    ctx.restore();
  }
}

// ── Nuvole e sole appesi a un filo ──
function filo(x0, y0, x1, y1) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.1;
  ctx.shadowColor = 'rgba(40,30,20,0.3)'; ctx.shadowBlur = 3 * U * DPR; ctx.shadowOffsetX = 4 * U * DPR; ctx.shadowOffsetY = 5 * U * DPR;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.restore();
}
function nuvole(cam, t) {
  const par = 0.26, off = cam * par, passo = 430;
  for (let c = Math.floor((off - 300) / passo); c * passo < off + VW + 300; c++) {
    const wx = c * passo + hash(90, c) * 150, x = wx - off;
    const y = 120 + hash(91, c) * 110, k = 0.75 + hash(92, c) * 0.5;
    const ang = Math.sin(t * 0.8 + c * 1.7) * 0.05;
    filo(x, -10, x + Math.sin(ang) * (y + 10), y - 26 * k);
    ctx.save();
    ctx.translate(x, -10); ctx.rotate(-ang); ctx.translate(0, y + 10);
    // foglio di dietro, grigio-azzurro e spostato: la nuvola ha due spessori
    ctx.beginPath();
    cerchioForbice(-20 * k, -14 * k, 26 * k, c * 5 + 7, 14);
    cerchioForbice(24 * k, -18 * k, 30 * k, c * 5 + 8, 16);
    cerchioForbice(58 * k, 2 * k, 20 * k, c * 5 + 9, 12);
    foglio('#dce8ec', 6, -x, -y);
    ctx.beginPath();
    cerchioForbice(-44 * k, 8 * k, 22 * k, c * 5, 14);
    cerchioForbice(-10 * k, -8 * k, 32 * k, c * 5 + 1, 18);
    cerchioForbice(28 * k, 0, 26 * k, c * 5 + 2, 14);
    poliForbice([[-60 * k, 10 * k], [50 * k, 4 * k], [50 * k, 30 * k], [-60 * k, 30 * k]], c * 5 + 3);
    foglio('#fdfcf6', 14, -x, -y);
    ctx.restore();
  }
}
function sole(cam, t) {
  const x = VW * 0.8 - cam * 0.05, y = 150;
  const ang = Math.sin(t * 0.6) * 0.035;
  filo(x, -10, x + Math.sin(ang) * 100, y - 70);
  ctx.save();
  ctx.translate(x, -10); ctx.rotate(-ang); ctx.translate(0, y + 10);
  ctx.rotate(t * 0.08);
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n * 2; i++) {
    const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 62 : 84 + (hash(95, i) - 0.5) * 6;
    i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  foglio('#f3a93b', 14, -x, -y);
  ctx.beginPath(); cerchioForbice(0, 0, 60, 96, 24); foglio('#f7cd45', 5, -x, -y);
  ctx.beginPath(); cerchioForbice(-6, -6, 42, 97, 20); foglio('#fbe27a', 3, -x, -y);
  ctx.restore();
}

// ── Il burattino con i fermacampioni ──
const B = { x: 230, y: 0, vx: 0, vy: 0, aTerra: true, dir: 1, fase: 0, idle: 0 };
function fermacampione(x, y) {
  ctx.save();
  ctx.shadowColor = 'rgba(40,25,10,0.45)'; ctx.shadowBlur = 2 * U * DPR; ctx.shadowOffsetX = 1 * U * DPR; ctx.shadowOffsetY = 1.4 * U * DPR;
  const g = ctx.createRadialGradient(x - 1, y - 1, 0.3, x, y, 3.4);
  g.addColorStop(0, '#fff6c8'); g.addColorStop(0.45, '#d9aa3f'); g.addColorStop(1, '#8a6118');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 3.3, 0, 7); ctx.fill();
  ctx.restore();
}
/** Un segmento d'arto: rettangolo arrotondato tagliato, che ruota sul perno in (0,0). */
function segmento(len, larg, col, seme, d = 4) {
  ctx.beginPath();
  const r = larg / 2, pts = [];
  for (let i = 0; i <= 5; i++) { const a = Math.PI + i / 5 * Math.PI; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 0; i <= 5; i++) { const a = i / 5 * Math.PI; pts.push([Math.cos(a) * r, len + Math.sin(a) * r]); }
  poliForbice(pts.map(([x, y]) => [x, y]), seme, 0.5);
  foglio(col, d, 0, 0);
}
function disegnaBurattino(cam, t) {
  const x = B.x - cam, y = B.y;
  const cammina = Math.min(1, Math.abs(B.vx) / 160);
  const f = B.fase;
  const salto = !B.aTerra;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(B.dir * 1.3, 1.3);
  const bob = cammina * Math.abs(Math.sin(f)) * -3 + (1 - cammina) * Math.sin(t * 2) * 0.8;
  ctx.translate(0, bob);
  const anca = (lato) => salto ? (lato ? -0.9 : 0.5) : Math.sin(f + lato * Math.PI) * 0.55 * cammina;
  const ginocchio = (lato) => salto ? (lato ? 1.3 : 0.4) : Math.max(0, Math.sin(f + lato * Math.PI + 1.3)) * 0.9 * cammina;
  const saluta = !Demo.shot ? (B.idle > 1.5 && (B.idle % 7) < 2.2) : B.idle > 0.3;
  const spalla = (lato) => {
    if (salto) return lato ? -2.5 : 2.4;
    if (!lato && saluta && cammina < 0.1) return -1.65 + Math.sin(t * 9) * 0.08;
    return -Math.sin(f + lato * Math.PI) * 0.6 * cammina + (lato ? -0.08 : 0.08);
  };
  const gomito = (lato) => (!lato && saluta && cammina < 0.1) ? -1.25 + Math.sin(t * 9) * 0.45 : -0.35 - cammina * 0.3 * (1 + Math.sin(f + lato * Math.PI));
  const HIP = -58, SH = -104;
  const gamba = (lato, scura) => {
    ctx.save(); ctx.translate(lato ? 4 : -4, HIP); ctx.rotate(anca(lato));
    segmento(28, 13, scura ? '#2e3e6b' : '#3d5190', 40 + lato);
    ctx.save(); ctx.translate(0, 27); ctx.rotate(ginocchio(lato));
    segmento(26, 11, scura ? '#2e3e6b' : '#3d5190', 42 + lato);
    ctx.beginPath(); poliForbice([[-6, 23], [14, 23], [15, 31], [-6, 31]], 44 + lato, 0.5); foglio(scura ? '#6e3b25' : '#8a4b2e', 3);
    fermacampione(0, 0);
    ctx.restore();
    fermacampione(0, 0);
    ctx.restore();
  };
  const braccio = (lato, scuro) => {
    ctx.save(); ctx.translate(0, SH); ctx.rotate(spalla(lato));
    segmento(24, 11, scuro ? '#b8452c' : '#d9573a', 50 + lato);
    ctx.save(); ctx.translate(0, 23); ctx.rotate(gomito(lato));
    segmento(22, 10, scuro ? '#b8452c' : '#d9573a', 52 + lato);
    ctx.beginPath(); cerchioForbice(0, 25, 6.5, 54 + lato, 9); foglio(scuro ? '#d9bf95' : '#f1dcb4', 3);
    fermacampione(0, 0);
    ctx.restore();
    fermacampione(0, 0);
    ctx.restore();
  };
  gamba(1, true); braccio(1, true);
  // busto
  ctx.beginPath(); poliForbice([[-17, -110], [17, -110], [20, -76], [16, -54], [-16, -54], [-20, -76]], 60); foglio('#e4a93c', 6);
  ctx.beginPath(); poliForbice([[-16, -66], [16, -66], [16, -58], [-16, -58]], 61, 0.4); foglio('#8a4b2e', 2);
  ctx.beginPath(); poliForbice([[-5, -104], [5, -104], [3, -86], [-3, -86]], 62, 0.4); foglio('#f4d86a', 1.5);
  // testa
  ctx.save(); ctx.translate(0, -114); ctx.rotate(Math.sin(t * 1.3) * 0.04 + (salto ? -0.1 : 0));
  ctx.beginPath(); cerchioForbice(2, -24, 23, 63, 18); foglio('#f1dcb4', 6);
  ctx.beginPath(); poliForbice([[-20, -36], [-14, -58], [-6, -44], [2, -62], [10, -44], [18, -58], [24, -36]], 64, 0.8); foglio('#f4c542', 4);
  ctx.beginPath(); cerchioForbice(10, -26, 3.2, 65, 8); foglio('#2a2320', 1);
  ctx.beginPath(); cerchioForbice(-3, -26, 3.2, 66, 8); foglio('#2a2320', 1);
  ctx.beginPath(); cerchioForbice(16, -16, 4.2, 67, 8); foglio('#f09a8a', 1);
  ctx.beginPath(); poliForbice([[3, -15], [12, -15], [8, -11]], 68, 0.3); foglio('#9b3a2a', 1);
  ctx.restore();
  fermacampione(0, -110);
  braccio(0, false); gamba(0, false);
  ctx.restore();
}

// ── Stato e ciclo ──
let camX = 0, tempo = 0;
function aggiorna(dt, t) {
  tempo = t;
  if (dt <= 0) return;
  const ax = Demo.asse().x;
  B.vx += (ax * 190 - B.vx) * Math.min(1, dt * (ax ? 6 : 9));
  if (ax) B.dir = ax > 0 ? 1 : -1;
  B.x += B.vx * dt;
  B.fase += Math.abs(B.vx) * dt * 0.055;
  B.idle = Math.abs(B.vx) < 5 && B.aTerra ? B.idle + dt : 0;
  const g = suoloY(B.x);
  if (B.aTerra && (Demo.premuto(' ') || Demo.premuto('ArrowUp') || Demo.premuto('w'))) { B.vy = -620; B.aTerra = false; }
  if (!B.aTerra) {
    B.vy += 1700 * dt; B.y += B.vy * dt;
    if (B.y >= g) { B.y = g; B.vy = 0; B.aTerra = true; }
  } else B.y = g;
  const bersaglio = B.x - VW * 0.36 + B.dir * 60;
  camX += (bersaglio - camX) * Math.min(1, dt * 2.5);
  // i pop-up: molla verso "alzato" se il burattino è vicino
  for (const p of POP) {
    const d = Math.abs(p.x - B.x);
    const obj = d < 340 ? 1 : d > 520 ? 0 : (p.th > 0.5 ? 1 : 0);
    p.v += ((obj - p.th) * 55 - p.v * 6.5) * dt;
    p.th = Math.max(0, p.th + p.v * dt);
  }
}

function disegna(t) {
  ctx.setTransform(DPR * U, 0, 0, DPR * U, 0, 0);
  // cielo: due fogli azzurri
  ctx.beginPath(); ctx.rect(-10, -10, VW + 20, 760); foglio('#a8d7df', 0, -camX * 0.03, 0);
  ctx.beginPath();
  for (let x = -10; x <= VW + 10; x += 9) {
    const wx = x + camX * 0.08;
    const y = 300 + Math.sin(wx * 0.003) * 20 + (hash(80, Math.round(wx / 9)) - 0.5) * 3;
    x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.lineTo(VW + 10, 760); ctx.lineTo(-10, 760); ctx.closePath();
  foglio('#c9e8e4', 5, -camX * 0.08, 0);
  sole(camX, t);
  nuvole(camX, t);
  for (const s of STRATI) strato(s, camX, t);
  terreno(camX);
  for (const p of POP) disegnaPop(p, camX);
  disegnaBurattino(camX, t);
  // primo piano: ciuffi d'erba scuri che scorrono più veloci
  const par = 1.35, off = camX * par;
  for (let c = Math.floor((off - 100) / 120); c * 120 < off + VW + 100; c++) {
    if (hash(110, c) < 0.45) continue;
    const x = c * 120 + hash(111, c) * 60 - off, y = 735, k = 0.8 + hash(112, c) * 0.7;
    ctx.beginPath();
    poliForbice([[x - 30 * k, y], [x - 22 * k, y - 50 * k], [x - 12 * k, y - 12 * k], [x - 2 * k, y - 70 * k], [x + 8 * k, y - 14 * k], [x + 20 * k, y - 46 * k], [x + 30 * k, y]], c, 1);
    foglio(hash(113, c) < 0.5 ? '#2f6f33' : '#3b7f3a', 14, -off, 0);
  }
  // luce da diorama: angoli più scuri, un caldo alone in alto a destra
  const g = ctx.createRadialGradient(VW * 0.62, 200, 100, VW * 0.5, 380, VW * 0.78);
  g.addColorStop(0, 'rgba(255, 244, 214, 0.10)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40, 25, 10, 0.34)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, 720);
}

try {
  Demo.carica('Ritaglio i cartoncini');
  ridimensiona();
  preparaFibra();
  B.y = suoloY(B.x);
  camX = B.x - VW * 0.36 + 60;
  Demo.loop((dt, t) => { aggiorna(Math.min(dt, 1 / 30), t); disegna(t); });
  Demo.pronto();
} catch (e) { Demo.errore(e); }
