// Disegni che cambiano ogni fotogramma: il filo della lampadina, gli occhi nel buio, le zeta di chi
// dorme, il riquadro del testo scritto a mano. Tremano anche loro: il seme dipende dalla variante.
import { rng, ellisse, prerendi, tratto } from './matita.js?v=8';

// linea a matita disegnata al volo sul contesto del mondo (stesso gesto del prerender, più leggero)
export function linea(g, pts, v, o = {}) {
  const R = rng(o.seme ?? 1 + v * 17);
  g.strokeStyle = o.col ?? '#231f22'; g.lineCap = 'round'; g.lineJoin = 'round';
  g.globalAlpha = o.a ?? 0.92; g.lineWidth = o.w ?? 2.2;
  g.beginPath();
  pts.forEach(([x, y], i) => { const j = o.jit ?? 1.3; const px = x + (R() - 0.5) * j * 2, py = y + (R() - 0.5) * j * 2; i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.stroke(); g.globalAlpha = 1;
}

export function filo(g, x0, y0, x1, y1, v) {
  const pts = [];
  for (let i = 0; i <= 24; i++) pts.push([x0 + (x1 - x0) * i / 24, y0 + (y1 - y0) * i / 24]);
  linea(g, pts, v, { w: 1.8, jit: 0.9, seme: 5 + v });
}

// Un paio d'occhi che segue il protagonista; ogni tanto sbatte le palpebre
export function occhi(g, x, y, fase, v, t, px, py) {
  const chiuso = Math.sin(t * 0.8 + fase * 3) > 0.965;
  const d = Math.hypot(px - x, py - y) || 1, ox = (px - x) / d * 4.5, oy = (py - y) / d * 3;
  for (const s of [-17, 17]) {
    const cx = x + s, R = rng(fase * 100 + s + v * 7);
    if (chiuso) { linea(g, [[cx - 11, y], [cx, y + 3], [cx + 11, y]], v, { col: '#f1ede4', w: 2.4, seme: fase + v }); continue; }
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.ellipse(cx + (R() - 0.5), y, 11, 6.5, 0, 0, 6.3); g.fill();
    g.fillStyle = '#16131a'; g.beginPath(); g.arc(cx + ox + (R() - 0.5) * 0.8, y + oy, 3.4, 0, 6.3); g.fill();
    linea(g, ellisse(R, cx, y, 11.5, 7, 0.4), v, { col: '#0d0b10', w: 1.6, jit: 0.7, seme: fase * 10 + s });
  }
}

export function zeta(g, lista, t) {
  g.fillStyle = '#6f6878';
  for (const z of lista) {
    const u = z.t / 3;
    g.globalAlpha = Math.min(1, u * 4) * (1 - u) * 0.9;
    g.font = `${Math.round(18 + u * 16)}px Matita`;
    g.fillText(z.k ? 'Z' : 'z', z.x + Math.sin(t * 2 + z.f) * 8 + u * 30, z.y - u * 80);
  }
  g.globalAlpha = 1;
}

// Riquadro del testo: carta bianca opaca, bordo doppio a matita con gli angoli che sforano
export const BOX = [0, 0, 700, 140];
export function riquadro(D) {
  const R = D.R;
  for (const m of [10, 17]) {
    const o = { w: m === 10 ? 2.6 : 1.3, a: m === 10 ? 1 : 0.7 };
    tratto(D, [[m - 6, m], [700 - m + 5, m + (R() - 0.5) * 2]], o);
    tratto(D, [[700 - m, m - 5], [700 - m + (R() - 0.5) * 2, 140 - m + 6]], o);
    tratto(D, [[700 - m + 4, 140 - m], [m - 5, 140 - m + (R() - 0.5) * 2]], o);
    tratto(D, [[m, 140 - m + 5], [m + (R() - 0.5) * 2, m - 6]], o);
  }
}
function carta(g, R) {
  g.fillStyle = '#fdfcf8';
  g.beginPath(); g.moveTo(8 + R() * 3, 10); g.lineTo(692, 8 + R() * 3); g.lineTo(690 + R() * 3, 130); g.lineTo(10, 132 + R() * 2); g.closePath(); g.fill();
}
export function preparaRiquadro(Z) { return prerendi(riquadro, BOX, Z, 90, carta); }

export function testo(g, righe, car, v, x, y) {
  g.fillStyle = '#231f22'; g.font = '30px Matita'; g.textBaseline = 'alphabetic';
  let resta = Math.floor(car);
  righe.forEach((riga, k) => {
    let cx = x;
    const R = rng(k * 31 + v * 5 + 2);
    for (const ch of riga.slice(0, Math.max(0, resta))) {
      g.fillText(ch, cx + (R() - 0.5) * 1.2, y + k * 40 + (R() - 0.5) * 1.4);
      cx += g.measureText(ch).width;
    }
    resta -= riga.length;
  });
}
