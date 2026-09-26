// Vetro soffiato: ogni tessera ha tinta, spessore e inclinazione suoi; dentro la tessera
// ci sono venature, bolle e graffi. Le due texture escono in radice quadrata (più precisione ai blu scuri).
import { TW, TH } from './vetrata-disegno.js?v=7';

export function rifinisci({ reg, mappa, semi, cella, dist, ferro, dP, rnd }) {
  const N = TW * TH, LW = 2.7;
  // attributi per tessera
  const T = semi.map(s => {
    const r = reg[s[2]], a = rnd() * Math.PI;
    const v = 0.78 + rnd() * 0.4, tinta = (rnd() - 0.5) * 0.16;
    return {
      col: r.col.map((c, i) => Math.min(1, Math.max(0.005, c * v * (1 + (i === 0 ? tinta : i === 2 ? -tinta : 0))))),
      sp: 0.8 + rnd() * 0.55, tx: rnd() - 0.5, ty: rnd() - 0.5,
      ca: Math.cos(a), sa: Math.sin(a), fr: 0.35 + rnd() * 0.6, fa: rnd() * 6.3,
      gx: (rnd() - 0.5) * 0.5 / r.cella, gy: (rnd() - 0.5) * 0.5 / r.cella,
    };
  });
  // spessore per pixel: pendenza dentro la tessera + venature
  const sp = new Float32Array(N);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const i = y * TW + x, c = cella[i];
    if (c < 0) continue;
    const t = T[c], s = semi[c];
    const u = x * t.ca + y * t.sa;
    sp[i] = t.sp + (x - s[0]) * t.gx + (y - s[1]) * t.gy + Math.sin(u * t.fr + t.fa + Math.sin(u * 0.07 + t.fa) * 3) * 0.05;
  }
  // bolle (centro sottile e chiaro, orlo scuro) e graffi
  for (let k = 0; k < 2600; k++) {
    const bx = rnd() * TW, by = rnd() * TH, r = 0.7 + rnd() * rnd() * 2.2;
    for (let y = Math.floor(by - r - 1); y <= by + r + 1; y++) for (let x = Math.floor(bx - r - 1); x <= bx + r + 1; x++) {
      if (x < 0 || y < 0 || x >= TW || y >= TH) continue;
      const d = Math.hypot(x - bx, y - by) / r;
      if (d < 1) sp[y * TW + x] -= 0.35 * (1 - d); else if (d < 1.4) sp[y * TW + x] += 0.12;
    }
  }
  for (let k = 0; k < 90; k++) {
    let x = rnd() * TW, y = rnd() * TH; const a = rnd() * 6.3, L = 8 + rnd() * 30;
    for (let s = 0; s < L; s++) { x += Math.cos(a); y += Math.sin(a); const i = (y | 0) * TW + (x | 0); if (i >= 0 && i < N) sp[i] -= 0.18; }
  }
  // uscita
  const col = new Uint8Array(N * 4), aux = new Uint8Array(N * 4);
  const piccola = new Float32Array(78 * 128 * 3), conta = new Float32Array(78 * 128);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const i = y * TW + x, o = i * 4, k = mappa[i], vetro = reg[k].tipo === 'vetro';
    const piombo = vetro && (dist[i] < LW || ferro[i]);
    if (vetro && !piombo) {
      const t = T[cella[i]], pa = dP[o + 3] / 255, th = Math.max(0.35, sp[i]);
      const bordo = Math.min(1, (dist[i] - LW) / 1.2);          // antialias verso il piombo
      for (let j = 0; j < 3; j++) {
        const v = Math.pow(t.col[j], th) * (1 - 0.94 * pa) * bordo;
        col[o + j] = Math.round(Math.sqrt(v) * 255);
      }
      col[o + 3] = Math.round(255 * bordo);
      aux[o] = Math.round(Math.min(1, th / 1.8) * 255);
      aux[o + 1] = Math.round((t.tx * 0.8 + 0.5) * 255); aux[o + 2] = Math.round((t.ty * 0.8 + 0.5) * 255);
      aux[o + 3] = 0;
    } else if (!vetro) {
      aux[o] = Math.round(Math.min(1, dist[i] / 10) * 255);    // smusso della pietra
      aux[o + 1] = aux[o + 2] = 128; aux[o + 3] = 255;
    } else {
      aux[o] = 0; aux[o + 1] = aux[o + 2] = 128; aux[o + 3] = 0;   // piombo
    }
    const q = (y / 8 | 0) * 78 + Math.min(77, x / 8 | 0);
    for (let j = 0; j < 3; j++) { const s = col[o + j] / 255; piccola[q * 3 + j] += s * s; }
    conta[q]++;
  }
  for (let q = 0; q < conta.length; q++) for (let j = 0; j < 3; j++) piccola[q * 3 + j] /= Math.max(1, conta[q]);
  return { col, aux, piccola };
}
