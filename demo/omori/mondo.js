// Il mondo di sogno: dove stanno le cose, cosa dicono, e i loro disegni prerenderizzati.
import { rng, tratto, prerendi } from './matita.js?v=7';
import { albero, lampadina, lucePavimento, porta, gatto, fiori, buio } from './oggetti.js?v=7';
import { coperta, amici, protagonista } from './amici.js?v=7';

const FRASE_FIORI = 'Fiori di pastello. Profumano di temperino.';
// x, y = punto d'appoggio nel mondo; box = riquadro del disegno; urti = cerchi {dx, dy, r}; parla = punto a cui avvicinarsi
export const OGGETTI = [
  { id: 'buio', x: 1700, y: 1130, box: [-470, -390, 470, 390], f: buio, fondo: true, urti: [], parla: [-230, -110],
    frase: 'Nel buio qualcuno ti guarda. Non sembra cattivo. Solo... sveglio.' },
  { id: 'luce', x: 1260, y: 850, box: [-130, -40, 130, 40], f: lucePavimento, fondo: true, urti: [] },
  { id: 'coperta', x: 880, y: 975, box: [-165, -140, 165, 75], f: coperta, fondo: true, urti: [{ dx: 80, dy: -40, r: 38 }], parla: [0, 0],
    frase: 'Il cestino è pieno di panini. Nessuno ha fame, ma è bello saperlo.' },
  { id: 'amici', x: 880, y: 975, box: [-150, -80, 110, 60], f: amici, fondo: true, urti: [{ dx: -70, dy: -12, r: 44 }, { dx: 20, dy: 24, r: 44 }], parla: [-30, 10],
    frase: 'Dormono tutti. Meglio non svegliarli: stanno facendo un bel sogno.' },
  { id: 'albero', x: 680, y: 760, box: [-200, -390, 210, 40], f: albero, urti: [{ dx: 0, dy: -4, r: 30 }, { dx: 98, dy: -2, r: 26 }], parla: [40, 0],
    frase: 'Un albero che si è scordato le foglie. Aspetta lo stesso la primavera.' },
  { id: 'porta', x: 1490, y: 770, box: [-60, -200, 110, 24], f: porta, urti: [{ dx: -22, dy: -6, r: 26 }, { dx: 28, dy: -6, r: 26 }], parla: [0, 10],
    frase: 'Una porta rossa. Dietro c\'è solo altro bianco... credo.' },
  { id: 'gatto', x: 1300, y: 1075, box: [-44, -104, 62, 16], f: gatto, urti: [{ dx: 4, dy: -6, r: 26 }], parla: [0, 0],
    frase: 'Il gatto ti guarda. Sembra sapere qualcosa che tu hai dimenticato.' },
  { id: 'lampadina', x: 1260, y: 850, box: [-80, -20, 80, 120], f: lampadina, appesa: 175, urti: [], parla: [0, 0],
    frase: 'La lampadina è accesa. Non c\'è nessun soffitto a cui appenderla.' },
];
for (const [x, y, s] of [[1030, 1110, 1], [1660, 690, 2], [640, 1020, 3], [1110, 640, 4], [420, 860, 5], [1900, 700, 6], [1130, 1250, 7], [1380, 640, 8]])
  OGGETTI.push({ id: 'fiori' + s, x, y, box: [-64, -86, 64, 24], f: fiori(s * 17), urti: [], parla: [0, 0], frase: FRASE_FIORI });

// occhi nel buio (relativi al centro del buio)
export const OCCHI = [[-200, -110, 0], [-60, -200, 1.7], [-310, -20, 3.1], [30, -60, 4.4], [170, -190, 5.9], [-150, 70, 2.2], [120, 120, 3.7]];

// segni leggeri sul pavimento, in una tessera ripetuta: danno il senso del movimento nel bianco
const TP = 640;
function pavimento(D) {
  const S = rng(77);
  for (let k = 0; k < 16; k++) {
    const x = S() * TP, y = S() * TP, tipo = Math.floor(S() * 4), o = { w: 1.4, col: '#b9b1a8', a: 0.75 };
    if (tipo === 0) tratto(D, [[x, y], [x + 4, y + 6], [x + 9, y - 3]], o);
    else if (tipo === 1) tratto(D, [[x, y], [x + 6, y - 3], [x + 12, y], [x + 18, y - 3]], o);
    else if (tipo === 2) for (let i = 0; i < 3; i++) tratto(D, [[x + i * 5, y + (i % 2) * 3], [x + i * 5 + 1, y + (i % 2) * 3 + 1]], { ...o, w: 2 });
    else tratto(D, [[x - 5, y], [x + 5, y]], o);
  }
}

export const SPR = { ogg: {}, pav: null, eroe: [] };
export function prerendiTutto(Z) {
  for (const [i, o] of OGGETTI.entries()) SPR.ogg[o.id] = prerendi(o.f, o.box, Z, i + 1);
  SPR.pav = prerendi(pavimento, [0, 0, TP, TP], Z, 50);
  SPR.eroe = [0, 1, 2].map(dir => [0, 1, 2].map(p => prerendi(protagonista(dir, p), [-42, -112, 42, 14], Z, 60 + dir * 3 + p)));
}
export { TP };
