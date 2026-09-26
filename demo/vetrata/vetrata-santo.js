// Il santo di ogni lancetta (Pietro con le chiavi, Paolo con la spada) e il baldacchino sopra.
// g = tela delle regioni, p = tela della grisaglia, R = registra una regione, id = colore dell'id.
import { C } from './vetrata-disegno.js?v=3';

function forma(g, n, id, f) { g.fillStyle = id(n); g.beginPath(); f(g); g.fill(); }
function linea(p, pts, w = 1.3, a = 0.9) {
  p.globalAlpha = a; p.lineWidth = w; p.beginPath(); p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 4) p.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
  p.stroke(); p.globalAlpha = 1;
}
function velo(p, f, blur, a) { p.save(); p.filter = `blur(${blur}px)`; p.globalAlpha = a; p.beginPath(); f(p); p.fill(); p.restore(); }

export function disegnaBaldacchino(g, p, R, id, cx, L) {
  const bianco = R('baldacchino', C.bianco, 34), oro = R('pinnacoli', C.giallo, 30);
  // due pinnacoli ai lati e il timpano al centro
  for (const s of [-1, 1]) forma(g, oro, id, q => { const x = cx + s * 104; q.moveTo(x - 9, 452); q.lineTo(x - 9, 372); q.lineTo(x, 340); q.lineTo(x + 9, 372); q.lineTo(x + 9, 452); });
  forma(g, bianco, id, q => { q.moveTo(cx - 92, 450); q.lineTo(cx, 352); q.lineTo(cx + 92, 450); });
  forma(g, bianco, id, q => q.rect(cx - 114, 446, 228, 12));
  const rosetta = R('rosetta', C.rubino, 30);
  forma(g, rosetta, id, q => q.arc(cx, 412, 12, 0, 7));
  // colonnine che incorniciano la nicchia
  for (const s of [-1, 1]) forma(g, bianco, id, q => q.rect(cx + s * 110 - 5, 458, 10, 480));
  // grisaglia: uncini lungo il timpano, trafori, finestrelle dei pinnacoli
  p.lineWidth = 1.2;
  for (let i = 1; i < 6; i++) for (const s of [-1, 1]) {
    const x = cx + s * (92 - i * 16), y = 450 - i * 17;
    linea(p, [x, y, x + s * 4, y - 9, x - s * 3, y - 8], 1.4);
  }
  p.beginPath(); p.moveTo(cx - 70, 446); p.lineTo(cx, 372); p.lineTo(cx + 70, 446); p.globalAlpha = 0.8; p.stroke();
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; linea(p, [cx, 412, cx, 412, cx + Math.cos(a) * 10, 412 + Math.sin(a) * 10], 1); }
  for (const s of [-1, 1]) {
    const x = cx + s * 104;
    for (const y of [385, 420]) { p.globalAlpha = 0.85; p.fillRect(x - 3, y, 6, 14); }
    linea(p, [x - 9, 372, x, 372, x + 9, 372], 1);
  }
  p.globalAlpha = 0.5; p.fillRect(cx - 114, 452, 228, 2); p.globalAlpha = 1;
}

export function disegnaSanto(g, p, R, id, cx, L) {
  const d = L.dir, pietro = L.santo === 'pietro';
  const hx = cx + d * 3;
  const aureola = R('aureola', C.oro, 60), volto = R('volto', C.carne, 80);
  const capelli = R('capelli', pietro ? C.bianco : C.bruno, 40);
  const tunica = R('tunica', pietro ? C.verde : C.porpora, 40, 0.55), manto = R('manto', pietro ? C.giallo : C.verde, 40, 0.6);
  const carne = R('mani', C.carne, 40), terra = R('terra', C.smeraldo, 26), scritta = R('scritta', C.bianco, 44);
  forma(g, aureola, id, q => q.arc(cx, 490, 41, 0, 7));
  forma(g, capelli, id, q => { q.ellipse(hx, 495, 24, 30, 0, 0, 7); });
  forma(g, capelli, id, q => { q.moveTo(hx - 20, 506); q.quadraticCurveTo(hx, pietro ? 552 : 575, hx + 20, 506); });
  forma(g, volto, id, q => { q.ellipse(hx + d * 1, 500, 17, 22, 0, 0, 7); });
  // tunica: dalle spalle all'orlo
  forma(g, tunica, id, q => {
    q.moveTo(cx - 20, 530); q.quadraticCurveTo(cx - 48, 534, cx - 50, 566); q.lineTo(cx - 64, 928); q.lineTo(cx + 64, 928);
    q.lineTo(cx + 50, 566); q.quadraticCurveTo(cx + 48, 534, cx + 20, 530);
  });
  // manto: cade da una spalla e avvolge i fianchi in diagonale
  forma(g, manto, id, q => {
    q.moveTo(cx - d * 50, 560); q.quadraticCurveTo(cx - d * 40, 532, cx - d * 8, 534); q.quadraticCurveTo(cx + d * 22, 600, cx + d * 56, 690);
    q.lineTo(cx + d * 62, 860); q.quadraticCurveTo(cx + d * 10, 895, cx - d * 60, 870); q.lineTo(cx - d * 58, 700);
  });
  forma(g, carne, id, q => { q.ellipse(cx + d * 24, 628, 10, 12, 0, 0, 7); q.ellipse(cx - d * 26, 716, 10, 11, 0, 0, 7); });
  forma(g, carne, id, q => { q.ellipse(cx - 17, 934, 11, 6, 0, 0, 7); q.ellipse(cx + 17, 934, 11, 6, 0, 0, 7); });
  if (pietro) {
    const chiavi = R('chiavi', C.giallo, 50);
    forma(g, chiavi, id, q => { q.arc(cx + d * 30, 576, 13, 0, 7); });
    forma(g, chiavi, id, q => { q.moveTo(cx + d * 27, 588); q.lineTo(cx + d * 35, 588); q.lineTo(cx + d * 44, 690); q.lineTo(cx + d * 36, 690); });
    forma(g, chiavi, id, q => q.rect(cx + d * 36 - 4, 672, d * 18, 12));
  } else {
    const lama = R('lama', C.bianco, 70, 0.4), elsa = R('elsa', C.giallo, 40), libro = R('libro', C.rubino, 40);
    forma(g, lama, id, q => { q.moveTo(cx - d * 30, 740); q.lineTo(cx - d * 22, 740); q.lineTo(cx - d * 24, 918); q.lineTo(cx - d * 28, 918); });
    forma(g, elsa, id, q => { q.rect(cx - d * 26 - 18, 728, 36, 9); q.rect(cx - d * 26 - 4, 700, 8, 30); });
    forma(g, libro, id, q => { q.moveTo(cx + d * 8, 606); q.lineTo(cx + d * 42, 598); q.lineTo(cx + d * 46, 642); q.lineTo(cx + d * 12, 650); });
  }
  forma(g, terra, id, q => { q.moveTo(cx - 112, 950); q.quadraticCurveTo(cx, 918, cx + 112, 950); q.lineTo(cx + 112, 958); q.lineTo(cx - 112, 958); });
  forma(g, scritta, id, q => q.rect(cx - 112, 958, 224, 26));

  // ── grisaglia ──
  // volto: sopracciglia, occhi a mandorla, naso, bocca; ombre ai bordi del viso
  velo(p, q => { q.ellipse(hx + d * 1, 500, 17, 22, 0, 0, 7); q.ellipse(hx + d * 1 + d * 3, 498, 13, 18, 0, 0, 7, true); }, 3, 0.45);
  for (const s of [-1, 1]) {
    const ex = hx + d * 1 + s * 7 + d * 1.5;
    linea(p, [ex - 5, 490, ex, 486, ex + 5, 490], 1.5);
    linea(p, [ex - 4, 496, ex, 493, ex + 4, 496], 1.1); linea(p, [ex - 4, 496, ex, 499, ex + 4, 496], 1.1);
    p.beginPath(); p.arc(ex + d * 1, 496, 1.6, 0, 7); p.fill();
  }
  linea(p, [hx + d * 2, 492, hx + d * 5, 505, hx + d * 1, 510], 1.3);
  linea(p, [hx - 5 + d * 2, 516, hx + d * 2, 518, hx + 5 + d * 2, 516], 1.3);
  // capelli e barba a riccioli
  for (let i = 0; i < 9; i++) { const a = Math.PI * (1.05 + i * 0.1); const x = hx + Math.cos(a) * 21, y = 495 + Math.sin(a) * 27; linea(p, [x, y, x + 4, y - 3, x + 2, y + 5], 1.2, 0.8); }
  for (let i = 0; i < 7; i++) { const x = hx - 12 + i * 4; linea(p, [x, 522, x + 2, 534, x - 1 + d * 2, 544 - Math.abs(i - 3) * 3], 1, 0.7); }
  // aureola: doppio cerchio e perline dipinte
  p.lineWidth = 1.4; p.globalAlpha = 0.85; p.beginPath(); p.arc(cx, 490, 36, 0, 7); p.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; p.beginPath(); p.arc(cx + Math.cos(a) * 38.5, 490 + Math.sin(a) * 38.5, 1.2, 0, 7); p.fill(); }
  p.globalAlpha = 1;
  // pieghe: tunica verticali, manto in diagonale, con velature d'ombra
  for (let i = 0; i < 6; i++) {
    const x = cx - 44 + i * 18;
    velo(p, q => { q.moveTo(x - 2, 700); q.lineTo(x + 3, 700); q.lineTo(x + 6 + (i - 3) * 2, 928); q.lineTo(x - 3 + (i - 3) * 2, 928); }, 4, 0.35);
    linea(p, [x, 600 + (i % 2) * 40, x + 2, 760, x + (i - 3) * 2.5, 926], 1.3, 0.75);
  }
  for (let i = 0; i < 3; i++) {
    const y = 640 + i * 80;
    velo(p, q => { q.moveTo(cx - d * 56, y + 70); q.quadraticCurveTo(cx - d * 10, y + 70, cx + d * 52, y + 4); q.lineTo(cx + d * 52, y + 14); q.quadraticCurveTo(cx - d * 10, y + 84, cx - d * 56, y + 84); }, 5, 0.3);
    linea(p, [cx - d * 50, y + 76, cx - d * 6, y + 72, cx + d * 48, y + 8], 1.4, 0.8);
  }
  // dita, piedi
  for (const [x, y] of [[cx + d * 24, 628], [cx - d * 26, 716]]) for (let k = -1; k <= 1; k++) linea(p, [x - 6, y + k * 4, x, y + k * 4 - 1, x + 6, y + k * 4], 0.9, 0.7);
  for (const s of [-1, 1]) linea(p, [cx + s * 17 - 8, 934, cx + s * 17, 931, cx + s * 17 + 8, 934], 1, 0.8);
  // erba e scritta in capitali gotiche
  for (let i = 0; i < 16; i++) { const x = cx - 100 + i * 13; linea(p, [x, 956, x + 2, 946, x + 5, 940], 1, 0.6); }
  p.font = '700 19px "Times New Roman", Georgia, serif'; p.textAlign = 'center'; p.textBaseline = 'middle';
  p.globalAlpha = 0.95; p.fillText(pietro ? 'S·PETRVS' : 'S·PAVLVS', cx, 972); p.globalAlpha = 1;
  p.fillRect(cx - 108, 960, 216, 1.5); p.fillRect(cx - 108, 981, 216, 1.5);
}
