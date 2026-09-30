// 16 bit dall'alto: un villaggio ai margini del bosco su uno schermo logico fisso di 320×180,
// ingrandito a scala intera senza filtro. Mappa a tessere su tre strati (pavimento, oggetti,
// chiome sopra il personaggio), tessere animate, ombre a mezza tinta. Grafica: Ninja Adventure (CC0).
import { T, C, R, costruisci, taglio } from './mappa.js?v=8';
import { IMG, cam, preparaOmbre, pavimento, oggetti, chiome } from './disegno.js?v=8';
import { G, colpisci, aggiornaEroe, aggiornaParti, disegnaEroe, disegnaParti, disegnaPremi } from './eroe.js?v=8';
import { popola, ABITANTI, aggiornaVita, abitanteDavanti, attoriVita, disegnaFarfalle, disegnaFoglie } from './vita.js?v=8';
import { preparaTessere } from './tessere.js?v=8';
import { preparaHud, disegnaHud, disegnaDialogo, aCapo } from './hud.js?v=8';

const LW = 320, LH = 180;
const cv = document.createElement('canvas');
cv.className = 'snes'; cv.width = LW; cv.height = LH;
document.body.prepend(cv);
const g = cv.getContext('2d');
function ridimensiona() {
  const S = Math.max(1, Math.floor(Math.min(innerWidth / LW, innerHeight / LH)));
  cv.style.width = LW * S + 'px'; cv.style.height = LH * S + 'px';
  cv.style.left = Math.round((innerWidth - LW * S) / 2) + 'px'; cv.style.top = Math.round((innerHeight - LH * S) / 2) + 'px';
}
addEventListener('resize', ridimensiona);

const NOMI = ['floor', 'nature', 'house', 'water', 'element', 'detail', 'eroe', 'eroe-colpo', 'donna', 'vecchio',
  'ragazzo', 'ragazza', 'gallina', 'gatto', 'fendente', 'ciuffi', 'foglie', 'moneta', 'font', 'raggi'];
const carica = n => new Promise((ok, ko) => { const i = new Image(); i.onload = () => { IMG[n] = i; ok(); }; i.onerror = () => ko(new Error('Manca ' + n)); i.src = 'assets/' + n + '.png?v=8'; });

let dialogo = null, fotogramma = 0;
// In modalità foto senza tasti tenuti, un piccolo copione mette in posa la scena dell'anteprima.
const pilota = Demo.shot && !Demo.query.has('tieni');
function copione() {
  const f = fotogramma;
  return { x: 0, y: 0, colpo: f === 34 || f === 80 };
}

function aggiorna(dt, t) {
  let ax = 0, ay = 0, colpo = false;
  if (pilota) ({ x: ax, y: ay, colpo } = copione());
  else { const a = Demo.asse(); ax = Math.abs(a.x) > 0.3 ? Math.sign(a.x) : 0; ay = Math.abs(a.y) > 0.3 ? -Math.sign(a.y) : 0; colpo = Demo.premuto(' '); }
  if (dialogo) {
    dialogo.car += dt * 40;
    if (colpo) { if (dialogo.car < dialogo.tot) dialogo.car = dialogo.tot; else dialogo = null; }
    ax = ay = 0; colpo = false;
  } else if (colpo && G.colpo < 0) {
    const ab = abitanteDavanti();
    if (ab) { const righe = aCapo(ab.frase); dialogo = { chi: ab, righe, car: 0, tot: righe.join('').length }; ab.dir = [1, 0, 3, 2][G.dir]; }
    else colpisci();
  }
  aggiornaEroe(dt, ax, ay);
  aggiornaParti(dt);
  aggiornaVita(dt, t, dialogo);
  // l'erba tagliata ricresce, ma non sotto i piedi dell'eroe
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const k = taglio[r][c];
    if (k && !k.vivo && (k.ricresce -= dt) <= 0 && (Math.floor(G.x / T) !== c || Math.floor(G.y / T) !== r)) k.vivo = true;
  }
}

function inquadra() {
  cam.x = Math.round(Math.max(0, Math.min(C * T - LW, G.x - LW / 2)));
  cam.y = Math.round(Math.max(0, Math.min(R * T - LH, G.y - 108)));
}

// raggi di luce che filtrano fra le chiome del bosco, sommati al colore (come la color math additiva)
const RAGGI = [[27, 3], [34, 2], [6, 25], [30, 24], [14, 8]];
function raggi(t) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [c, r] of RAGGI) {
    const x = c * T - cam.x, y = r * T - cam.y;
    if (x > LW || y > LH || x < -220 || y < -110) continue;
    g.globalAlpha = 0.16 + 0.07 * Math.sin(t * 0.7 + c);
    g.drawImage(IMG.raggi, Math.round(x), Math.round(y));
  }
  g.restore();
}

function disegna(t) {
  g.imageSmoothingEnabled = false;
  inquadra();
  pavimento(g, t, LW, LH);
  oggetti(g, [{ y: G.y, f: () => disegnaEroe(g) }, ...attoriVita(g, t), ...disegnaPremi(g, t)], LW, LH, t);
  // l'erba alta copre i piedi dell'eroe
  const k = taglio[Math.floor((G.y - 2) / T)]?.[Math.floor(G.x / T)];
  if (k && k.vivo && k.tipo === 'erba') g.drawImage(IMG.erbaAlta[Math.floor(t * 1.5) % 2], 0, 11, T, 8, Math.round(G.x - 8 - cam.x), Math.round(G.y - 6 - cam.y), T, 8);
  disegnaParti(g);
  disegnaFarfalle(g, t);
  chiome(g, LW, LH);
  disegnaFoglie(g);
  raggi(t);
  disegnaHud(g, LW, t);
  if (dialogo) disegnaDialogo(g, dialogo, LW, LH, t, G.y - cam.y > LH * 0.6);
}

async function avvia() {
  let n = 0;
  await Promise.all(NOMI.map(k => carica(k).then(() => Demo.carica('Carico le tessere', ++n / NOMI.length))));
  preparaTessere();
  costruisci();
  preparaOmbre();
  preparaHud();
  popola();
  G.x = 19 * T + 8; G.y = 16 * T + 10; G.dir = 0;
  if (Demo.query.has('pos')) { const [c, r] = Demo.query.get('pos').split(',').map(Number); G.x = c * T + 8; G.y = r * T + 12; }
  ridimensiona();
  if (Demo.query.has('parla')) { const ab = ABITANTI[2], righe = aCapo(ab.frase); dialogo = { chi: ab, righe, car: 0, tot: righe.join('').length }; }
  Demo.extra('<p>Parla con gli abitanti premendo spazio quando li hai davanti. L\'erba tagliata ricresce dopo un po\'.</p>');
  Demo.loop((dt, t) => {
    if (dt > 0) { aggiorna(dt, t); fotogramma++; }
    disegna(t);
  });
  Demo.pronto();
}
avvia().catch(e => Demo.errore(e));
