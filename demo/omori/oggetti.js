// Gli oggetti del sogno, disegnati a matita in coordinate locali (0,0 = dove toccano terra).
// La forma viene da un generatore con seme fisso (uguale nelle tre varianti); il tremolio da D.R.
import { rng, curva, ellisse, tratto, pastello, ombra } from './matita.js?v=7';

export function albero(D) {
  const S = rng(5);
  ombra(D, 30, 6, 120, 18);
  const sx = curva([[-22, 4], [-12, -40], [-14, -110], [-6, -165]]), dx = curva([[22, 4], [12, -40], [14, -110], [8, -165]]);
  pastello(D, [...sx, ...dx.slice().reverse()], '#bba89c', { forza: 0.5, ang: -1.4 });
  tratto(D, sx, { w: 3 }); tratto(D, dx, { w: 3 });
  tratto(D, curva([[-22, 4], [-40, 10], [-52, 6]]), { w: 2.2 }); tratto(D, curva([[22, 4], [44, 12], [58, 8]]), { w: 2.2 });
  tratto(D, curva([[-4, -60], [2, -72], [0, -86]]), { w: 1.3, a: 0.6 });      // una venatura
  function ramo(x, y, a, l, p) {
    const bx = x + Math.cos(a) * l * 0.5 + (S() - 0.5) * l * 0.25, by = y + Math.sin(a) * l * 0.5;
    const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
    tratto(D, curva([[x, y], [bx, by], [ex, ey]]), { w: Math.max(1.1, p * 0.75) });
    if (p <= 1) return;
    const n = 2 + (S() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) ramo(ex, ey, a + (k - (n - 1) / 2) * (0.5 + S() * 0.35) + (S() - 0.5) * 0.3, l * (0.62 + S() * 0.15), p - 1);
  }
  ramo(-6, -160, -2.1, 90, 4); ramo(8, -160, -1.05, 95, 4); ramo(0, -150, -1.6, 70, 3);
  ramo(-10, -110, -2.7, 60, 3); ramo(12, -120, -0.45, 70, 3);
  // altalena appesa al ramo di destra
  tratto(D, [[78, -198], [80, -60]], { w: 1.5 }); tratto(D, [[118, -196], [116, -58]], { w: 1.5 });
  const asse = [[70, -62], [126, -60], [127, -52], [71, -54]];
  pastello(D, asse, '#e9c79a', { forza: 0.7 });
  tratto(D, [...asse, [70, -61]], { w: 2 });
  ombra(D, 100, 4, 34, 7, { a: 0.25 });
}

export function lampadina(D) {              // pivot (0,0) = attacco del filo
  const g = D.colore, R = D.R;
  g.strokeStyle = '#ffcf4a'; g.lineCap = 'round';
  for (let k = 0; k < 26; k++) {           // raggi di luce a pastello
    const a = k / 26 * 6.28 + R() * 0.1, r0 = 40 + R() * 6, r1 = 58 + R() * 22;
    g.globalAlpha = 0.55; g.lineWidth = 2 + R() * 1.5;
    g.beginPath(); g.moveTo(Math.cos(a) * r0, 42 + Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, 42 + Math.sin(a) * r1); g.stroke();
  }
  g.globalAlpha = 1;
  const bulbo = curva([[-8, 14], [-12, 22], [-24, 36], [-24, 52], [-12, 66], [0, 69], [12, 66], [24, 52], [24, 36], [12, 22], [8, 14]]);
  pastello(D, bulbo, '#ffe27a', { forza: 0.85, base: 0.6 });
  pastello(D, [[-9, 0], [9, 0], [9, 15], [-9, 15]], '#9a97a3', { forza: 0.7, ang: 0 });
  tratto(D, bulbo, { w: 2.4 });
  tratto(D, [[-9, 0], [9, 0], [9, 14], [-9, 14], [-9, -1]], { w: 2.2 });
  tratto(D, [[-9, 5], [9, 5]], { w: 1.2 }); tratto(D, [[-9, 10], [9, 10]], { w: 1.2 });
  tratto(D, curva([[-5, 16], [-6, 30], [-4, 42], [0, 38], [4, 42], [6, 30], [5, 16]]), { w: 1.3, col: '#b8862a' });
  tratto(D, curva([[-15, 38], [-16, 50], [-10, 58]]), { w: 3, col: '#ffffff', a: 0.9 });      // riflesso
}
export function lucePavimento(D) {
  ombra(D, 0, 0, 120, 30, { col: '#f7cf5a', a: 0.4, passo: 3.2 });
}

export function porta(D) {
  ombra(D, 60, 2, 70, 12, { a: 0.35 });
  pastello(D, [[-44, 6], [74, 6], [96, -8], [-22, -8]], '#c9b08e', { forza: 0.55, ang: 0.3 });    // zerbino
  tratto(D, [[-44, 6], [74, 6], [96, -8], [-22, -8], [-43, 5]], { w: 1.6 });
  const anta = [[-40, -4], [40, -4], [42, -178], [-38, -176]];
  pastello(D, anta, '#e24a52', { forza: 0.8, base: 0.55 });
  pastello(D, [[40, -4], [50, -12], [52, -184], [42, -178]], '#a8303a', { forza: 0.8 });
  tratto(D, [...anta, [-40, -2]], { w: 2.8 });
  tratto(D, [[40, -4], [50, -12], [52, -184], [42, -178]], { w: 2.2 }); tratto(D, [[-38, -176], [-28, -184], [52, -184]], { w: 2.2 });
  for (const [y0, y1] of [[-164, -104], [-86, -20]]) tratto(D, [[-26, y0], [26, y0], [27, y1], [-26, y1], [-26, y0 + 2]], { w: 1.4, a: 0.8 });
  pastello(D, ellisse(rng(3), 28, -92, 5, 5), '#f4c542', { forza: 0.9, base: 0.8 });
  tratto(D, ellisse(D.R, 28, -92, 5, 5), { w: 1.6 });
}

export function gatto(D) {
  ombra(D, 6, 2, 40, 9);
  const corpo = curva([[-22, 0], [-26, -24], [-16, -48], [0, -54], [16, -48], [24, -22], [20, 0], [-22, 0]]);
  const testa = ellisse(rng(4), 0, -66, 19, 16, 0.1);
  const orecchie = [[[-16, -74], [-15, -94], [-4, -80]], [[4, -80], [15, -94], [16, -74]]];
  const coda = curva([[18, -4], [40, -2], [48, -16], [42, -30]]);
  for (const f of [corpo, testa, ...orecchie]) pastello(D, f, '#2e2a33', { forza: 0.95, base: 0.8, passo: 1.8 });
  tratto(D, corpo, { w: 2.6 }); tratto(D, testa, { w: 2.6 }); orecchie.forEach(o => tratto(D, o, { w: 2.4 }));
  tratto(D, coda, { w: 5, col: '#2e2a33' }); tratto(D, coda, { w: 2 });
  for (const s of [-1, 1]) {
    const occhio = ellisse(rng(8), s * 7, -67, 4.5, 3.2, 0.05);
    pastello(D, occhio, '#fbf6d8', { forza: 1, base: 1, dx: 0, dy: 0, fughe: 0 });
    tratto(D, [[s * 7, -69.5], [s * 7, -64.5]], { w: 1.8 });
    tratto(D, [[s * 4, -58], [s * 22, -60]], { w: 1, col: '#d9d4dc', a: 0.8 });    // baffi
  }
}

const COL_FIORI = ['#f7a9c0', '#c7b1e6', '#f9df7b', '#a9d3f0', '#f6b48c'];
export function fiori(seme) {
  return D0 => {
    const K = 1.3, sc = p => p.map(([x, y]) => [x * K, y * K]);
    const tr = (p, o) => tratto(D0, sc(p), o), pa = (p, c, o) => pastello(D0, sc(p), c, o);
    const S = rng(seme);
    const n = 3 + Math.floor(S() * 3);
    for (let k = 0; k < n; k++) {
      const x = (S() - 0.5) * 60, y = (S() - 0.5) * 16, h = 22 + S() * 18, col = COL_FIORI[Math.floor(S() * 5)];
      tr(curva([[x, y], [x + (S() - 0.5) * 8, y - h * 0.5], [x + (S() - 0.5) * 6, y - h]]), { w: 1.6, col: '#5f8f5a' });
      tr(curva([[x, y - 6], [x + 8, y - 12], [x + 11, y - 9]]), { w: 1.3, col: '#5f8f5a' });
      const testa = S() < 0.5 ? [[x - 7, y - h], [x - 7, y - h - 11], [x - 3, y - h - 7], [x, y - h - 13], [x + 3, y - h - 7], [x + 7, y - h - 11], [x + 7, y - h]]
        : ellisse(rng(seme + k), x, y - h - 5, 7, 6, 0.2);
      pa(testa, col, { forza: 0.85, base: 0.5 });
      tr(testa, { w: 1.7 });
    }
  };
}

// Il buio nell'angolo: grafite passata e ripassata a riccioli, fitta al centro e sfrangiata ai bordi
export function buio(D) {
  const S = rng(21), g = D.colore;
  const raggio = a => 330 * (1 + 0.1 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 7));
  const fondo = g.createRadialGradient(0, 0, 40, 0, 0, 340);
  fondo.addColorStop(0, 'rgba(28,24,34,0.8)'); fondo.addColorStop(0.6, 'rgba(28,24,34,0.45)'); fondo.addColorStop(1, 'rgba(28,24,34,0)');
  g.fillStyle = fondo; g.beginPath(); g.ellipse(0, 0, 360, 300, 0, 0, 6.3); g.fill();
  g.strokeStyle = '#1d1a22'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let k = 0; k < 850; k++) {
    const a = S() * 6.28, d = Math.pow(S(), 0.7) * raggio(a);
    let x = Math.cos(a) * d, y = Math.sin(a) * d * 0.82;
    const dir = S() * 6.28, r = 6 + S() * 10, om = 0.9 + S() * 0.5, n = 30 + S() * 30;
    g.globalAlpha = 0.2 + (1 - d / 360) * 0.5; g.lineWidth = 1.2 + S() * 1.6;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const px = x + Math.cos(dir) * i * 2.2 + Math.cos(i * om) * r + (D.R() - 0.5) * 2;
      const py = y + Math.sin(dir) * i * 2.2 + Math.sin(i * om) * r * 0.8 + (D.R() - 0.5) * 2;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}
