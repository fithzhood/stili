// I personaggi di carta, disegnati a mano nel codice: un piccolo esploratore (l'eroe), una coniglietta,
// un gufo postino e uno scarabeo dispettoso. Tratto scuro caldo, colori pieni, un'ombra a campitura.
import { ritaglio } from './carta.js?v=7';

const TRATTO = '#3a2418';
function forma(g, path, fill, lw = 5) { g.beginPath(); path(g); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.lineJoin = 'round'; g.strokeStyle = TRATTO; g.stroke(); }
const ell = (x, y, rx, ry, rot = 0) => g => g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
const rr = (x, y, w, h, r) => g => g.roundRect(x, y, w, h, r);
function ombraDentro(g, path, col = 'rgba(60,30,20,0.18)') { g.save(); g.beginPath(); path(g); g.clip(); g.fillStyle = col; g.fill(); g.restore(); }

/** L'esploratore di profilo verso destra. f = 0 piedi uniti, 1 passo lungo. */
export function esploratore(f) {
  return ritaglio(256, 256, g => {
    const p = f ? 16 : 3;
    // gamba dietro, zaino, gamba avanti
    forma(g, rr(112 - p, 186, 22, 42, 9), '#6b4a36'); forma(g, ell(118 - p, 232, 20, 10), '#4a2f22');
    forma(g, rr(64, 118, 54, 74, 16), '#d9503f');
    forma(g, rr(58, 112, 60, 26, 12), '#b83a2e');
    forma(g, ell(88, 176, 10, 10), '#f2c14e', 4);
    forma(g, rr(126 + p, 186, 22, 42, 9), '#7d5840'); forma(g, ell(140 + p, 232, 21, 10), '#553726');
    // pantaloncini e camicia
    forma(g, rr(106, 170, 58, 30, 10), '#8e6a4a');
    forma(g, rr(102, 120, 64, 62, 20), '#4fb2a6');
    ombraDentro(g, rr(102, 150, 64, 32, 0));
    forma(g, rr(118, 118, 12, 60, 5), '#7a5238', 3);            // bretella dello zaino
    // braccio che oscilla
    g.save(); g.translate(142, 132); g.rotate(f ? -0.5 : 0.25);
    forma(g, rr(-10, 0, 20, 44, 9), '#4fb2a6'); forma(g, ell(0, 50, 11, 11), '#f3c6a0'); g.restore();
    // sciarpa
    forma(g, g => { g.moveTo(104, 112); g.quadraticCurveTo(70, 104, 52, 124); g.lineTo(62, 134); g.quadraticCurveTo(80, 120, 106, 126); g.closePath(); }, '#f0a93a');
    forma(g, rr(100, 106, 70, 18, 9), '#f0a93a');
    // testa
    forma(g, ell(140, 76, 50, 46), '#f5caa2');
    forma(g, g => { g.moveTo(94, 70); g.quadraticCurveTo(96, 106, 124, 110); g.quadraticCurveTo(104, 86, 112, 64); g.closePath(); }, '#7a4a2c', 4);
    forma(g, ell(186, 84, 9, 8), '#f5caa2', 4);                    // naso a patata
    g.fillStyle = 'rgba(240,120,110,0.45)'; g.beginPath(); g.ellipse(160, 98, 11, 7, 0, 0, 7); g.fill();
    forma(g, ell(160, 74, 7, 12), '#2a1a14', 2); g.fillStyle = '#fff'; g.beginPath(); g.arc(162, 69, 3, 0, 7); g.fill();
    g.lineWidth = 4; g.strokeStyle = TRATTO; g.lineCap = 'round';
    g.beginPath(); g.moveTo(150, 54); g.quadraticCurveTo(160, 48, 170, 54); g.stroke();
    g.beginPath(); g.moveTo(164, 108); g.quadraticCurveTo(172, 114, 180, 106); g.stroke();
    // cappello da esploratore: calotta, fascia, tesa larga
    forma(g, g => { g.moveTo(96, 50); g.bezierCurveTo(98, 8, 176, 2, 184, 46); g.closePath(); }, '#e0b567');
    forma(g, rr(98, 38, 86, 14, 4), '#7a4d2e', 4);
    forma(g, ell(142, 52, 70, 11, -0.04), '#d3a654');
    ombraDentro(g, g => { g.moveTo(96, 50); g.bezierCurveTo(98, 8, 110, 4, 120, 30); g.lineTo(120, 50); g.closePath(); }, 'rgba(90,50,20,0.15)');
  });
}

export function coniglia() {
  return ritaglio(256, 256, g => {
    forma(g, rr(100, 6, 26, 86, 13), '#f4eefc'); forma(g, rr(106, 18, 14, 60, 7), '#f7b8c8', 0);
    forma(g, rr(132, 14, 26, 80, 13), '#ece4f6'); forma(g, rr(138, 26, 14, 56, 7), '#f7b8c8', 0);
    forma(g, g => { g.moveTo(96, 150); g.lineTo(80, 226); g.lineTo(176, 226); g.lineTo(160, 150); g.closePath(); }, '#e8778c');
    forma(g, rr(90, 212, 76, 14, 7), '#fbe6a2');
    forma(g, ell(128, 118, 50, 44), '#f6f0fc');
    forma(g, ell(110, 114, 6, 10), '#2a1a14', 2); forma(g, ell(146, 114, 6, 10), '#2a1a14', 2);
    g.fillStyle = 'rgba(245,130,150,0.5)'; g.beginPath(); g.ellipse(100, 132, 9, 6, 0, 0, 7); g.ellipse(156, 132, 9, 6, 0, 0, 7); g.fill();
    forma(g, ell(128, 130, 6, 4), '#e87a90', 3);
    forma(g, ell(104, 236, 18, 9), '#f6f0fc'); forma(g, ell(152, 236, 18, 9), '#f6f0fc');
    // cestino di fiori
    forma(g, rr(160, 170, 44, 30, 8), '#c98b4a'); forma(g, g => g.arc(182, 172, 22, Math.PI, 0), 'rgba(0,0,0,0)', 4);
    for (const [x, c] of [[168, '#ff6f7d'], [182, '#ffd34d'], [196, '#8fd0ff']]) forma(g, ell(x, 166, 8, 8), c, 3);
  });
}

export function gufo() {
  return ritaglio(256, 256, g => {
    forma(g, rr(112, 176, 32, 76, 6), '#9a6a44');                   // palo
    forma(g, ell(128, 118, 62, 68), '#b0794c');
    forma(g, ell(128, 136, 40, 48), '#f1d9ae');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.strokeStyle = 'rgba(150,100,60,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(110 + j * 18, 124 + i * 18, 6, 0.2, Math.PI - 0.2); g.stroke(); }
    forma(g, g => { g.moveTo(74, 62); g.lineTo(84, 36); g.lineTo(104, 60); g.closePath(); }, '#b0794c');
    forma(g, g => { g.moveTo(182, 62); g.lineTo(172, 36); g.lineTo(152, 60); g.closePath(); }, '#b0794c');
    forma(g, ell(104, 90, 22, 22), '#fffaf0'); forma(g, ell(152, 90, 22, 22), '#fffaf0');
    forma(g, ell(108, 92, 9, 10), '#2a1a14', 2); forma(g, ell(148, 92, 9, 10), '#2a1a14', 2);
    g.lineWidth = 4; g.strokeStyle = '#6a4a2a'; g.beginPath(); g.arc(104, 90, 25, 0, 7); g.moveTo(177, 90); g.arc(152, 90, 25, 0, 7); g.moveTo(127, 88); g.lineTo(129, 88); g.stroke();
    forma(g, g => { g.moveTo(120, 106); g.lineTo(136, 106); g.lineTo(128, 122); g.closePath(); }, '#f2a53a', 3);
    forma(g, rr(150, 150, 50, 34, 4), '#fdf6e4', 3);                 // la busta del postino
    g.strokeStyle = TRATTO; g.lineWidth = 3; g.beginPath(); g.moveTo(150, 150); g.lineTo(175, 170); g.lineTo(200, 150); g.stroke();
    forma(g, ell(175, 172, 6, 6), '#d9503f', 2);
  });
}

export function scarabeo() {
  return ritaglio(256, 192, g => {
    for (const x of [78, 112, 150, 184]) forma(g, rr(x - 5, 140, 10, 34, 5), '#3a2a4a', 3);
    forma(g, g => { g.moveTo(40, 150); g.bezierCurveTo(40, 40, 210, 40, 214, 150); g.closePath(); }, '#6a5bd6');
    ombraDentro(g, g => { g.moveTo(40, 150); g.bezierCurveTo(40, 110, 214, 110, 214, 150); g.closePath(); }, 'rgba(30,10,60,0.25)');
    g.strokeStyle = TRATTO; g.lineWidth = 4; g.beginPath(); g.moveTo(128, 64); g.lineTo(128, 150); g.stroke();
    for (const [x, y, r] of [[92, 96, 12], [162, 92, 10], [100, 128, 8], [156, 126, 9]]) forma(g, ell(x, y, r, r), '#f5d44a', 3);
    forma(g, ell(212, 128, 30, 26), '#4a3a6a');
    forma(g, ell(220, 122, 9, 11), '#fff', 3); forma(g, ell(223, 124, 4, 6), '#1a0a14', 0);
    g.lineWidth = 5; g.beginPath(); g.moveTo(206, 106); g.lineTo(230, 114); g.stroke();   // sopracciglio arrabbiato
    g.lineWidth = 4; g.beginPath(); g.moveTo(222, 104); g.quadraticCurveTo(230, 80, 244, 78); g.stroke();
    forma(g, ell(244, 78, 5, 5), '#f5d44a', 3);
  });
}
