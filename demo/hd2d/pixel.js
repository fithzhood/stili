// Pixel art disegnata nel codice: chiome, cespugli, fiori. Tutto a bassa risoluzione, filtro nearest,
// ombreggiatura a gradini con luce dall'alto a sinistra e contorno scuro colorato (mai nero puro).
import * as THREE from 'three';

export function rnd(seme) { let r = seme >>> 0 || 1; return () => ((r = (r * 16807) % 2147483647) / 2147483647); }

function texDa(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Un ciuffo di fogliame: unione di cerchi, luce a gradini, grappoli di foglie, contorno. */
export function ciuffo(seme, W = 48, H = 48, rampa = ['#14281f', '#1f4130', '#2f6139', '#4d8a41', '#86b44f', '#c3d670'], nc = 7) {
  const r = rnd(seme);
  const cerchi = [];
  for (let i = 0; i < nc; i++) {
    const a = r() * Math.PI * 2, d = r() * 0.22;
    cerchi.push([0.5 + Math.cos(a) * d * 1.1, 0.52 + Math.sin(a) * d * 0.8, 0.17 + r() * 0.12]);
  }
  cerchi.push([0.5, 0.5, 0.28]);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); const img = g.createImageData(W, H);
  const R = rampa.map(hex);
  const dentro = new Uint8Array(W * H), liv = new Float32Array(W * H);
  // grappoli di foglie: un rumore a celle che fa "bitorzoli" di 3-4 pixel
  const semi = []; for (let i = 0; i < 70; i++) semi.push([r(), r(), r()]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W, v = (y + 0.5) / H;
    let best = -1, bc = null;
    for (const c of cerchi) { const d = 1 - Math.hypot(u - c[0], v - c[1]) / c[2]; if (d > best) { best = d; bc = c; } }
    if (best <= 0) continue;
    dentro[y * W + x] = 1;
    // normale finta della sfera del cerchio più vicino → luce dall'alto a sinistra
    const nx = (u - bc[0]) / bc[2], ny = (v - bc[1]) / bc[2];
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    let l = (-nx * 0.55 - ny * 0.7 + nz * 0.5) * 0.5 + 0.45;
    // bitorzoli: distanza dal seme più vicino
    let dm = 9, sm = null;
    for (const s of semi) { const dd = Math.hypot(u - s[0], v - s[1]); if (dd < dm) { dm = dd; sm = s; } }
    l += (0.07 - dm) * 2.2 + (sm[2] - 0.5) * 0.12;
    l -= (v - 0.4) * 0.35;     // la parte bassa della chioma è più in ombra
    liv[y * W + x] = l;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!dentro[i]) continue;
    const bordo = !dentro[i - 1] || !dentro[i + 1] || !dentro[i - W] || !dentro[i + W] || x === 0 || y === 0 || x === W - 1 || y === H - 1;
    let k;
    if (bordo) k = 0;
    else {
      // dithering ordinato 2x2 solo al confine fra due gradini: il banding resta leggibile
      const q = liv[i] * (R.length - 1) + ((x + y) & 1 ? 0.12 : -0.12);
      k = Math.max(1, Math.min(R.length - 1, Math.round(q)));
    }
    const c = R[k]; img.data.set([c[0], c[1], c[2], 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  return texDa(cv);
}

/** Fiori in cassetta o in aiuola: ciuffo verde basso punteggiato di fiori a due toni. */
export function fiori(seme, colori = [['#ff7a8a', '#b8325a'], ['#ffd76a', '#c8862a'], ['#f4f1ff', '#9a8fc8']]) {
  const W = 32, H = 16, r = rnd(seme);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const verdi = ['#1d3b26', '#2f5d33', '#4f8a3c'];
  for (let x = 0; x < W; x++) {
    const h = 6 + Math.floor(r() * 5 + Math.sin(x * 0.7) * 2);
    for (let y = H - h; y < H; y++) { g.fillStyle = verdi[y === H - h ? 0 : (y < H - h + 3 ? 2 : 1)]; g.fillRect(x, y, 1, 1); }
  }
  for (let i = 0; i < 11; i++) {
    const [c1, c2] = colori[Math.floor(r() * colori.length)];
    const x = 1 + Math.floor(r() * (W - 3)), y = 2 + Math.floor(r() * 7);
    g.fillStyle = c2; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
    g.fillStyle = c1; g.fillRect(x, y, 1, 1); g.fillRect(x - 1, y - 1, 1, 1);
  }
  return texDa(cv);
}

/** Ombra morbida tonda (liscia: è l'ombra, non un pixel). */
export function ombraTonda() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); return t;
}

/** Alone morbido per bagliori e lucciole. */
export function alone() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
