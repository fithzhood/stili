// La coperta del picnic con il cestino, gli amici che dormono e il protagonista (tutti inventati:
// testoni tondi, occhi a puntino, pastelli tenui).
import { rng, curva, ellisse, tratto, pastello, ombra, copri } from './matita.js?v=7';

// punto dentro un quadrilatero (interpolazione bilineare), per disegnare i quadretti in prospettiva
const quad = (Q, u, v) => [0, 1].map(i => (Q[0][i] * (1 - u) + Q[1][i] * u) * (1 - v) + (Q[3][i] * (1 - u) + Q[2][i] * u) * v);

export function coperta(D) {
  const Q = [[-150, -70], [120, -80], [150, 40], [-135, 52]];
  ombra(D, 10, 50, 150, 12, { a: 0.22 });
  pastello(D, Q, '#fbd3d8', { forza: 0.5, base: 0.4 });
  const N = 6, M = 4;
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) if ((i + j) % 2 === 0)
    pastello(D, [quad(Q, i / N, j / M), quad(Q, (i + 1) / N, j / M), quad(Q, (i + 1) / N, (j + 1) / M), quad(Q, i / N, (j + 1) / M)], '#ec8d9d', { forza: 0.75, base: 0.45, fughe: 1 });
  tratto(D, curva([Q[0], [-10, -78], Q[1], [138, -20], Q[2], [0, 50], Q[3], [-146, -10], [Q[0][0] + 6, Q[0][1] - 2]]), { w: 2.4 });
  // cestino
  const cx = 80, cy = -40;
  ombra(D, cx + 10, cy + 26, 44, 9, { a: 0.3 });
  const cesto = [[cx - 38, cy - 18], [cx + 38, cy - 18], [cx + 30, cy + 24], [cx - 30, cy + 24]];
  pastello(D, cesto, '#dca867', { forza: 0.8, base: 0.5, ang: -0.3 });
  tratto(D, [...cesto, [cx - 37, cy - 16]], { w: 2.4 });
  for (let k = 1; k < 4; k++) tratto(D, [[cx - 38 + k * 2, cy - 18 + k * 10.5], [cx + 38 - k * 2, cy - 18 + k * 10.5]], { w: 1.1, a: 0.6 });
  tratto(D, curva([[cx - 30, cy - 18], [cx - 24, cy - 56], [cx, cy - 66], [cx + 24, cy - 56], [cx + 30, cy - 18]]), { w: 2.6 });
  const mela = ellisse(rng(12), cx - 70, cy + 30, 11, 10, 0.1);
  pastello(D, mela, '#e4575c', { forza: 0.9, base: 0.6 }); tratto(D, mela, { w: 2 });
  tratto(D, [[cx - 70, cy + 20], [cx - 67, cy + 13]], { w: 1.6 });
  pastello(D, [[cx - 66, cy + 16], [cx - 58, cy + 12], [cx - 62, cy + 19]], '#7fb56e', { forza: 0.9 });
}

// Un amico sdraiato su un fianco, occhi chiusi. dir = 1 testa a sinistra, -1 a destra
function dormiente(D, x, y, dir, maglia, capelli) {
  const tx = x - dir * 42;
  const corpo = curva([[x - 30, y - 22], [x + 20, y - 26], [x + 44, y - 12], [x + 38, y + 4], [x - 30, y + 4], [x - 30, y - 22]]).map(([a, b]) => [x + (a - x) * dir, b]);
  pastello(D, corpo, maglia, { forza: 0.85, base: 0.5 });
  tratto(D, corpo, { w: 2.4 });
  const testa = ellisse(rng(31 + dir), tx, y - 16, 25, 23, 0.25);
  copri(D, ellisse(rng(31 + dir), tx, y - 16, 24, 22, 0));
  pastello(D, testa, '#fbe8da', { forza: 0.5, base: 0.5 });
  const ciuffo = curva([[tx + dir * 18, y - 32], [tx, y - 42], [tx - dir * 22, y - 30], [tx - dir * 26, y - 10], [tx - dir * 14, y - 22], [tx + dir * 4, y - 30]]);
  pastello(D, ciuffo, capelli, { forza: 0.9, base: 0.6 });
  tratto(D, testa, { w: 2.5 }); tratto(D, ciuffo, { w: 1.8 });
  for (const s of [-8, 8]) tratto(D, curva([[tx + s - 4, y - 14], [tx + s, y - 11], [tx + s + 4, y - 14]]), { w: 1.8 });
  pastello(D, ellisse(rng(40), tx - 13, y - 5, 5, 3), '#f4a7b0', { forza: 0.6, fughe: 0 });
  pastello(D, ellisse(rng(41), tx + 13, y - 5, 5, 3), '#f4a7b0', { forza: 0.6, fughe: 0 });
}
export function amici(D) {
  dormiente(D, -70, -10, 1, '#a9cdee', '#8a6a55');
  dormiente(D, 20, 28, -1, '#b9dcae', '#f0d58a');
}

// ── il protagonista: dir 0 giù, 1 su, 2 lato (destra; la sinistra si specchia); passo 0..2 ──
export function protagonista(dir, passo) {
  return D => {
    const b = passo ? -3 : 0, L = passo === 1 ? -5 : passo === 2 ? 5 : 0;
    ombra(D, 0, 0, 22, 6, { a: 0.35 });
    // gambe
    for (const [s, k] of [[-1, L], [1, -L]]) {
      const lx = dir === 2 ? s * 4 + k : s * 7, ly = dir === 2 ? 0 : k * 0.5;
      tratto(D, [[lx, -16 + b], [lx, -2 + ly]], { w: 2.2 });
      pastello(D, ellisse(rng(5 + s), lx + (dir === 2 ? 3 : 0), -2 + ly, 6, 3.5, 0.1), '#5a5360', { forza: 0.9, fughe: 0 });
    }
    // corpo: maglione color senape
    const corpo = curva([[-15, -16 + b], [-17, -32 + b], [-10, -42 + b], [10, -42 + b], [17, -32 + b], [15, -16 + b], [-15, -16 + b]]);
    pastello(D, corpo, '#f2c46b', { forza: 0.8, base: 0.5 });
    tratto(D, corpo, { w: 2.3 });
    if (dir !== 1) tratto(D, [[dir === 2 ? 6 : -6, -24 + b], [dir === 2 ? 14 : 6, -25 + b]], { w: 1.2, a: 0.7 });
    // testa e berretto
    const hy = -64 + b;
    const testa = ellisse(rng(9), 0, hy, 25, 23, 0.25);
    pastello(D, testa, dir === 1 ? '#8a6a55' : '#fbe8da', { forza: 0.55, base: 0.5 });
    tratto(D, testa, { w: 2.6 });
    const berretto = curva([[-26, hy - 2], [-22, hy - 18], [0, hy - 27], [22, hy - 18], [26, hy - 2], [0, hy - 6], [-26, hy - 2]]);
    pastello(D, berretto, '#9cc8ec', { forza: 0.85, base: 0.55 });
    tratto(D, berretto, { w: 2.2 });
    const pon = ellisse(rng(10), 0, hy - 30, 7, 6, 0.2);
    pastello(D, pon, '#f7f3fa', { forza: 0.4, fughe: 0 }); tratto(D, pon, { w: 1.8 });
    if (dir === 0) {
      for (const s of [-9, 9]) { pastello(D, ellisse(rng(11), s, hy + 5, 2.6, 3.4, 0), '#231f22', { forza: 1, base: 1, dx: 0, dy: 0, fughe: 0 }); }
      for (const s of [-15, 15]) pastello(D, ellisse(rng(12), s, hy + 12, 5, 3), '#f4a7b0', { forza: 0.6, fughe: 0 });
      tratto(D, curva([[-3, hy + 13], [0, hy + 15], [3, hy + 13]]), { w: 1.4 });
    } else if (dir === 2) {
      pastello(D, ellisse(rng(11), 14, hy + 5, 2.6, 3.4, 0), '#231f22', { forza: 1, base: 1, dx: 0, dy: 0, fughe: 0 });
      pastello(D, ellisse(rng(12), 10, hy + 12, 5, 3), '#f4a7b0', { forza: 0.6, fughe: 0 });
    }
  };
}
