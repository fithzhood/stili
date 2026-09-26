// HUD in alto come nel 1991: barra della magia, riquadro dell'oggetto, monete, "- VITA -" e cuori.
// Riquadro dei dialoghi con il testo che scorre lettera per lettera.
import { IMG } from './disegno.js?v=7';
import { G } from './eroe.js?v=7';

let BIANCO, SCURO;
function tinta(col) {
  const c = document.createElement('canvas'); c.width = IMG.font.width; c.height = IMG.font.height;
  const g = c.getContext('2d'); g.drawImage(IMG.font, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  return c;
}
const CUORE = ['.11.11.', '1322221', '1322241', '1222241', '.12241.', '..141..', '...1...'];
const COL = { 1: '#28080e', 2: '#e8303c', 3: '#fff0f0', 4: '#a01828', 5: '#4a3040' };
function cuore(vuoto, meta = false) {
  const c = document.createElement('canvas'); c.width = 7; c.height = 7;
  const g = c.getContext('2d');
  CUORE.forEach((riga, y) => [...riga].forEach((k, x) => {
    if (k === '.') return;
    let v = +k;
    if (v > 1 && (vuoto || (meta && x > 3))) v = 5;
    g.fillStyle = COL[v]; g.fillRect(x, y, 1, 1);
  }));
  return c;
}
let CUORI;
export function preparaHud() {
  BIANCO = tinta('#f8f8f0'); SCURO = tinta('#10101c');
  CUORI = [cuore(true), cuore(false, true), cuore(false)];
  IMG.cuore = CUORI[2];
}

const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûù';
export function scrivi(g, s, x, y, bordo = true) {
  for (const ch of s) {
    let i = ch.charCodeAt(0) - 32;
    const k = CP437.indexOf(ch);
    if (k >= 0) i = 96 + k; else if (i < 0 || i > 94) i = 31;
    const sx = (i % 15) * 8, sy = Math.floor(i / 15) * 8;
    if (bordo) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) g.drawImage(SCURO, sx, sy, 8, 8, x + dx, y + dy, 8, 8);
    g.drawImage(BIANCO, sx, sy, 8, 8, x, y, 8, 8);
    x += ch === ' ' ? 5 : 7;
  }
}
const larghezza = s => [...s].reduce((a, ch) => a + (ch === ' ' ? 5 : 7), 0);

function cornice(g, x, y, w, h, fondo) {
  g.fillStyle = '#10101c'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = '#f8f8f0'; g.fillRect(x, y, w, h);
  g.fillStyle = '#10101c'; g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = fondo; g.fillRect(x + 2, y + 2, w - 4, h - 4);
}

export function disegnaHud(g, LW, t) {
  // barra della magia
  cornice(g, 10, 6, 10, 30, '#182018');
  g.fillStyle = '#3ec048'; g.fillRect(12, 16, 6, 18);
  g.fillStyle = '#9af07a'; g.fillRect(12, 16, 2, 18);
  // riquadro dell'oggetto: la spada
  cornice(g, 26, 8, 22, 22, '#202848');
  g.fillStyle = '#50607e'; for (let i = 0; i < 11; i++) g.fillRect(31 + i, 23 - i, 2, 2);
  g.fillStyle = '#e8f2ff'; for (let i = 0; i < 10; i++) g.fillRect(32 + i, 23 - i, 1, 1);
  g.fillStyle = '#e8b830'; g.fillRect(30, 21, 5, 2); g.fillRect(32, 19, 2, 5);
  g.fillStyle = '#6a3a20'; g.fillRect(29, 24, 2, 2);
  // monete
  g.drawImage(IMG.moneta, 0, 0, 10, 10, 64, 6, 10, 10);
  scrivi(g, String(G.monete).padStart(3, '0'), 58, 18);
  // vita
  const cx = LW - 76;
  g.fillStyle = '#e8303c';
  scrivi(g, '- VITA -', cx + 28 - larghezza('- VITA -') / 2, 5);
  for (let i = 0; i < G.maxCuori; i++) {
    const v = G.cuori - i * 2;
    const k = v >= 2 ? 2 : v === 1 ? 1 : 0;
    const salto = G.lampo > 0 && k > 0 && i === Math.ceil(G.cuori / 2) - 1 ? -1 : 0;
    g.drawImage(CUORI[k], cx + i * 9, 18 + salto);
  }
}

// ── dialoghi ──
export function aCapo(testo, max = 34) {
  const righe = []; let r = '';
  for (const p of testo.split(' ')) { if ((r + ' ' + p).trim().length > max) { righe.push(r); r = p; } else r = (r + ' ' + p).trim(); }
  if (r) righe.push(r);
  return righe;
}
export function disegnaDialogo(g, d, LW, LH, t, inAlto) {
  const w = 272, h = 48, x = (LW - w) >> 1, y = inAlto ? 40 : LH - h - 8;
  cornice(g, x, y, w, h, '#0c1030');
  let resta = Math.floor(d.car);
  d.righe.forEach((riga, k) => { const pezzo = riga.slice(0, Math.max(0, resta)); resta -= riga.length; scrivi(g, pezzo, x + 10, y + 8 + k * 12, false); });
  if (d.car >= d.tot && Math.floor(t * 3) % 2 === 0) {
    g.fillStyle = '#f8f8f0';
    for (let i = 0; i < 4; i++) g.fillRect(x + w - 16 + i, y + h - 11 + i, 7 - i * 2, 1);
  }
}
