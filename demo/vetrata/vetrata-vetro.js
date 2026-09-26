// Dal cartone alle tessere: diagramma di Voronoi dentro ogni regione, piombature dove la
// tessera cambia, poi le due texture (colore trasmesso e dati del vetro).
import { TW, TH, LANC } from './vetrata-disegno.js?v=5';
import { rifinisci } from './vetrata-rifinitura.js?v=5';

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function tagliaVetro({ reg, cR, cP, cD }) {
  const N = TW * TH, rnd = mulberry(77);
  const dR = cR.getContext('2d').getImageData(0, 0, TW, TH).data;
  const dP = cP.getContext('2d').getImageData(0, 0, TW, TH).data;
  const dD = cD.getContext('2d').getImageData(0, 0, TW, TH).data;
  // 1. mappa delle regioni; i pixel sfumati dei bordi prendono la regione del vicino
  const mappa = new Int16Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const r = dR[i * 4];
    if (r % 4 === 0 && dR[i * 4 + 1] === 0 && r / 4 < reg.length) mappa[i] = r / 4;
  }
  for (let i = 0; i < N; i++) if (mappa[i] < 0) mappa[i] = i > 0 ? mappa[i - 1] : 0;
  // 2. semi: griglia sfalsata dentro ogni regione di vetro
  const semi = [];                 // [x, y, regione]
  const bb = reg.map(() => [1e9, 1e9, -1, -1]);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const b = bb[mappa[y * TW + x]];
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
  }
  reg.forEach((r, k) => {
    if (r.tipo !== 'vetro' || bb[k][2] < 0) return;
    const [x0, y0, x1, y1] = bb[k], c = r.cella, cy = c * r.aniso;
    let n = 0;
    for (let y = y0 + rnd() * cy; y <= y1; y += cy) for (let x = x0 + rnd() * c; x <= x1; x += c) {
      const sx = Math.round(x + (rnd() - 0.5) * c * 0.8), sy = Math.round(y + (rnd() - 0.5) * cy * 0.8);
      if (sx >= 0 && sy >= 0 && sx < TW && sy < TH && mappa[sy * TW + sx] === k) { semi.push([sx, sy, k]); n++; }
    }
    if (!n) for (let y = y0; y <= y1 && !n; y++) for (let x = x0; x <= x1; x++) if (mappa[y * TW + x] === k) { semi.push([x, y, k]); n++; break; }
  });
  // 3. Voronoi per regione (griglia di secchi per trovare i semi vicini)
  const B = 16, BW = Math.ceil(TW / B), BH = Math.ceil(TH / B);
  const secchi = Array.from({ length: BW * BH }, () => []);
  semi.forEach((s, i) => secchi[(s[1] / B | 0) * BW + (s[0] / B | 0)].push(i));
  const cella = new Int32Array(N).fill(-1);
  const primo = new Int32Array(reg.length).fill(-1);
  semi.forEach((s, i) => { if (primo[s[2]] < 0) primo[s[2]] = i; });
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const i = y * TW + x, k = mappa[i], r = reg[k];
    if (r.tipo !== 'vetro') continue;
    const rag = Math.ceil(r.cella * 1.3 / B), ia = 1 / (r.aniso * r.aniso);
    const bx = x / B | 0, by = y / B | 0;
    let best = -1, bd = 1e12;
    for (let yy = Math.max(0, by - rag); yy <= Math.min(BH - 1, by + rag); yy++)
      for (let xx = Math.max(0, bx - rag); xx <= Math.min(BW - 1, bx + rag); xx++)
        for (const j of secchi[yy * BW + xx]) {
          const s = semi[j]; if (s[2] !== k) continue;
          const d = (s[0] - x) ** 2 + (s[1] - y) ** 2 * ia;
          if (d < bd) { bd = d; best = j; }
        }
    cella[i] = best >= 0 ? best : primo[k];
  }
  // 4. distanza dal bordo più vicino fra tessere diverse (smusso in due passate)
  const dist = new Float32Array(N).fill(99);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const i = y * TW + x, c = cella[i];
    if ((x + 1 < TW && cella[i + 1] !== c) || (y + 1 < TH && cella[i + TW] !== c) ||
        (x > 0 && cella[i - 1] !== c) || (y > 0 && cella[i - TW] !== c)) dist[i] = 0.5;
  }
  const a = 1, b = 1.414;
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const i = y * TW + x; let d = dist[i];
    if (x > 0) d = Math.min(d, dist[i - 1] + a);
    if (y > 0) { d = Math.min(d, dist[i - TW] + a); if (x > 0) d = Math.min(d, dist[i - TW - 1] + b); if (x < TW - 1) d = Math.min(d, dist[i - TW + 1] + b); }
    dist[i] = d;
  }
  for (let y = TH - 1; y >= 0; y--) for (let x = TW - 1; x >= 0; x--) {
    const i = y * TW + x; let d = dist[i];
    if (x < TW - 1) d = Math.min(d, dist[i + 1] + a);
    if (y < TH - 1) { d = Math.min(d, dist[i + TW] + a); if (x < TW - 1) d = Math.min(d, dist[i + TW + 1] + b); if (x > 0) d = Math.min(d, dist[i + TW - 1] + b); }
    dist[i] = d;
  }
  // 5. barre di ferro orizzontali nelle lancette
  const barre = [620, 720, 820, 900];
  const ferro = new Uint8Array(N);
  for (const yb of barre) for (let y = yb - 2; y <= yb + 2; y++) for (let x = 0; x < TW; x++) {
    const i = y * TW + x; if (reg[mappa[i]].tipo === 'vetro' && y > LANC.yS - 60) ferro[i] = 1;
  }
  // il diaspro dipinto vale solo sul fondo delle lancette
  for (let i = 0; i < N; i++) if (reg[mappa[i]].nome === 'campo') dP[i * 4 + 3] = Math.max(dP[i * 4 + 3], dD[i * 4 + 3]);
  return rifinisci({ reg, mappa, semi, cella, dist, ferro, dP, rnd });
}
