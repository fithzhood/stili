// Fondali di carta: alberi, cespugli, nuvole, fiori ritagliati; il foglio del prato col sentiero e il fiume;
// il cielo; il cartoncino delle colline con le pieghe e il bordo consumato.
import { tela, ritaglio, fibre, piega, rnd, texDa } from './carta.js?v=5';

const TRATTO = '#3a2418';
/** Unione di cerchi con un solo contorno: prima tutti i contorni spessi, poi tutti i riempimenti. */
function bolle(g, cerchi, fill, lw = 6, tratto = TRATTO) {
  g.fillStyle = tratto; for (const [x, y, r] of cerchi) { g.beginPath(); g.arc(x, y, r + lw / 2, 0, 7); g.fill(); }
  g.fillStyle = fill; for (const [x, y, r] of cerchi) { g.beginPath(); g.arc(x, y, r - lw / 2, 0, 7); g.fill(); }
}
function chioma(g, cerchi, chiaro, medio, scuro, seme) {
  bolle(g, cerchi, medio);
  const r = rnd(seme);
  g.save(); g.beginPath(); for (const [x, y, rr] of cerchi) { g.moveTo(x + rr - 3, y); g.arc(x, y, rr - 3, 0, 7); } g.clip();
  g.fillStyle = scuro; for (const [x, y, rr] of cerchi) { g.beginPath(); g.arc(x + rr * 0.25, y + rr * 0.35, rr * 0.9, 0, 7); g.fill(); }
  g.fillStyle = medio; for (const [x, y, rr] of cerchi) { g.beginPath(); g.arc(x - rr * 0.08, y - rr * 0.1, rr * 0.8, 0, 7); g.fill(); }
  g.fillStyle = chiaro; for (const [x, y, rr] of cerchi) { g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.35, rr * 0.38, 0, 7); g.fill(); }
  g.strokeStyle = scuro; g.lineWidth = 3; g.lineCap = 'round';        // foglioline a virgola
  for (let i = 0; i < 26; i++) { const x = 30 + r() * 200, y = 20 + r() * 170; g.beginPath(); g.arc(x, y, 7, 0.3, 1.9); g.stroke(); }
  g.restore();
}

export function albero(seme, tinte = ['#b6e38a', '#7cc46a', '#4f9a57']) {
  const r = rnd(seme);
  return ritaglio(256, 320, g => {
    g.lineJoin = 'round';
    g.beginPath(); g.moveTo(112, 318); g.lineTo(118, 170); g.lineTo(140, 170); g.lineTo(148, 318); g.closePath();
    g.fillStyle = '#a86f45'; g.fill(); g.lineWidth = 6; g.strokeStyle = TRATTO; g.stroke();
    g.strokeStyle = 'rgba(80,40,20,0.5)'; g.lineWidth = 3; for (const y of [220, 262, 296]) { g.beginPath(); g.moveTo(122, y); g.quadraticCurveTo(130, y + 6, 140, y); g.stroke(); }
    const c = [[128, 110, 70]];
    for (let i = 0; i < 7; i++) { const a = Math.PI + i / 6 * Math.PI; c.push([128 + Math.cos(a) * 72 + (r() - 0.5) * 10, 118 + Math.sin(a) * 66 * 0.9 + 20, 36 + r() * 12]); }
    c.push([88, 160, 36], [168, 160, 36], [128, 170, 40]);
    chioma(g, c, ...tinte, seme);
  });
}
export function cespuglio(seme, tinte = ['#c2e892', '#86c96c', '#579c58']) {
  return ritaglio(256, 160, g => {
    const c = [[60, 110, 44], [110, 84, 54], [168, 90, 50], [206, 116, 38], [128, 120, 44]];
    chioma(g, c, ...tinte, seme);
  });
}
export function nuvola(seme) {
  const r = rnd(seme);
  return ritaglio(320, 180, g => {
    const c = []; for (let i = 0; i < 6; i++) c.push([60 + i * 40, 110 - Math.sin(i / 5 * Math.PI) * 34 + r() * 8, 34 + Math.sin(i / 5 * Math.PI) * 20]);
    bolle(g, c, '#ffffff', 5, '#8e9bb8');
    g.save(); g.beginPath(); for (const [x, y, rr] of c) { g.moveTo(x + rr, y); g.arc(x, y, rr - 2, 0, 7); } g.clip();
    g.fillStyle = '#dfe6f4'; g.fillRect(0, 128, 320, 60); g.restore();
  });
}
export function fiore(col, seme) {
  return ritaglio(128, 192, g => {
    g.strokeStyle = '#3e8a4a'; g.lineWidth = 7; g.beginPath(); g.moveTo(64, 190); g.quadraticCurveTo(58, 120, 64, 70); g.stroke();
    bolle(g, [[44, 140, 14]], '#6cbf6a', 5); bolle(g, [[84, 120, 13]], '#6cbf6a', 5);
    const p = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + seme; p.push([64 + Math.cos(a) * 24, 60 + Math.sin(a) * 24, 20]); }
    bolle(g, p, col, 5); bolle(g, [[64, 60, 14]], '#ffd84a', 5);
  });
}
export function sole() {
  return ritaglio(256, 256, g => {
    g.fillStyle = '#ffc94a'; g.strokeStyle = TRATTO; g.lineWidth = 5;
    g.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, R = i % 2 ? 78 : 112; g.lineTo(128 + Math.cos(a) * R, 128 + Math.sin(a) * R); } g.closePath(); g.fill(); g.stroke();
    bolle(g, [[128, 128, 66]], '#ffe27a', 5);
    g.fillStyle = TRATTO; g.beginPath(); g.ellipse(108, 122, 6, 10, 0, 0, 7); g.ellipse(148, 122, 6, 10, 0, 0, 7); g.fill();
    g.lineWidth = 5; g.beginPath(); g.arc(128, 136, 26, 0.3, Math.PI - 0.3); g.stroke();
  });
}

/** Il cielo: carta azzurra che schiarisce verso l'orizzonte. */
export function cielo() {
  const [c, g] = tela(1024, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#8fcdf0'); gr.addColorStop(0.65, '#c9eaf5'); gr.addColorStop(1, '#fff3d6');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512); fibre(g, 1024, 512, 1, 11);
  piega(g, 340, 0, 340, 512, 0.7); piega(g, 700, 0, 700, 512, 0.7); piega(g, 0, 250, 1024, 250, 0.5);
  return texDa(c);
}

/** Cartoncino di una collina: colore pieno, ombra verso il basso, pieghe, bordo consumato lungo il ritaglio. */
export function cartoncino(tracciato, W, H, col, scuro, seme) {
  const S = 48, [c, g] = tela(Math.ceil(W * S), Math.ceil(H * S));
  g.setTransform(S, 0, 0, -S, 0, H * S);            // coordinate della forma (y in su) → pixel
  g.beginPath(); tracciato(g);
  g.fillStyle = col; g.fill();
  g.save(); g.clip();
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, scuro); gr.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.lineWidth = 0.16; g.strokeStyle = 'rgba(255,255,240,0.55)'; g.beginPath(); tracciato(g); g.stroke();  // bordo consumato
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const r = rnd(seme);
  for (let i = 0; i < 3; i++) { const x = (0.2 + r() * 0.6) * c.width; piega(g, x, 0, x + (r() - 0.5) * 60, c.height, 1.2); }
  g.globalCompositeOperation = 'source-atop'; fibre(g, c.width, c.height, 1.2, seme);
  const t = texDa(c); t.repeat.set(1 / W, 1 / H); return t;
}
