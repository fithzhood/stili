// Mappa del villaggio: pavimento (prato, sentiero, acqua) a tessere con i bordi calcolati,
// oggetti ordinati per quota, chiome che stanno sopra il personaggio, ombre, erba da tagliare.
export const T = 16, C = 44, R = 32;
const griglia = v => Array.from({ length: R }, () => new Array(C).fill(v));
export const suolo = griglia(0);        // 0 prato, 1 sentiero, 2 acqua
export const solido = griglia(false);
export const base = griglia(null);      // [foglio, colonna, riga] della tessera di pavimento
export const acquaPiena = griglia(false);
export const taglio = griglia(null);    // { tipo: 'cesp' | 'erba', vivo, ricresce }
export const OGG = [];      // { img, sx, sy, w, h, x, y, base, flip }  (px)
export const SOPRA = [];    // chiome: stesso formato, disegnate sopra i personaggi
export const OMBRE = [];    // { x, y, rx, ry } ellissi, oppure { x, y, w, h, r } rettangoli
export const FIORI = [];    // { x, y, k }
export const DECOR = [];    // ciuffi e sassolini sul prato { x, y, sx, sy }
export const NINFEE = [];   // { x, y, r }

export const hash = (c, r) => { let h = c * 374761393 + r * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const dentro = (c, r) => c >= 0 && r >= 0 && c < C && r < R;

function rett(tipo, c0, r0, c1, r1) { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) suolo[r][c] = tipo; }
function blocca(c0, r0, c1, r1) { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (dentro(c, r)) solido[r][c] = true; }
function spr(lista, img, sx, sy, w, h, c, r, flip = false) {
  const o = { img, sx: sx * T, sy: sy * T, w: w * T, h: h * T, x: c * T, y: r * T, base: (r + h) * T, flip };
  lista.push(o); return o;
}
const ogg = (...a) => spr(OGG, ...a);

// ── pezzi del mondo ──
const ALBERI = { verde: [3, 18], rosa: [0, 18], autunno: [9, 18] };
function albero(c, r, v = 'verde', muro = false) {        // 3×3: chioma sopra, tronco fra gli oggetti
  const [sx, sy] = ALBERI[v];
  spr(SOPRA, 'nature', sx, sy, 3, 2, c, r);
  ogg('nature', sx, sy + 2, 3, 1, c, r + 2);
  blocca(c + 1, r + 2, c + 1, r + 2);
  if (muro) blocca(c, r, c + 2, r + 2);
  OMBRE.push({ x: c * T + 30, y: r * T + 34, rx: 24, ry: 12 });
}
function gemelli(c, r) {                                  // 4×3 del bosco fitto (muro)
  spr(SOPRA, 'nature', 16 + (c % 8 ? 4 : 0), 2, 4, 2, c, r);
  ogg('nature', 16 + (c % 8 ? 4 : 0), 4, 4, 1, c, r + 2);
  blocca(c, r, c + 3, r + 2);
  OMBRE.push({ x: c * T + 36, y: r * T + 38, rx: 34, ry: 12 });
}
function pino(c, r) {
  spr(SOPRA, 'nature', 2, 0, 2, 1, c, r);
  ogg('nature', 2, 1, 2, 1, c, r + 1);
  blocca(c, r, c + 1, r + 1);
  OMBRE.push({ x: c * T + 22, y: r * T + 26, rx: 16, ry: 8 });
}
function casa(c, r, sx) {
  ogg('house', sx, 0, 4, 3, c, r);
  blocca(c, r, c + 3, r + 2);
  OMBRE.push({ x: c * T + 8, y: r * T + 8, w: 4 * T, h: 3 * T - 2, r: 6 });
}
function recinto(c0, c1, r) {
  for (let c = c0; c <= c1; c++) ogg('house', c === c0 || c === c1 ? 10 : 11, 5, 1, 1, c, r, c === c1);
  blocca(c0, r, c1, r);
  OMBRE.push({ x: c0 * T + 3, y: r * T + 6, w: (c1 - c0 + 1) * T, h: 11, r: 2 });
}
const cesp = (c, r) => { taglio[r][c] = { tipo: 'cesp', vivo: true, ricresce: 0 }; };
function erba(c0, r0, c1, r1, buchi = 0.12) {
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (hash(c + 7, r * 3) > buchi && !taglio[r][c]) taglio[r][c] = { tipo: 'erba', vivo: true, ricresce: 0 };
}
const fiore = (c, r, k) => FIORI.push({ x: c * T, y: r * T, k });
function sasso(c, r, sx = 8, sy = 12) { ogg('nature', sx, sy, 1, 1, c, r); blocca(c, r, c, r); OMBRE.push({ x: c * T + 10, y: r * T + 13, rx: 7, ry: 3 }); }

// ── bordi automatici: 3×3 esterno + angoli interni ──
const ESTERNO = { 1: ['floor', 0, 7], 2: ['water', 0, 6] };
const INTERNO = { 1: ['floor', 5, 8], 2: ['water', 5, 7] };
function calcolaBase() {
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const v = suolo[r][c];
    const h = hash(c, r);
    if (v === 0) { base[r][c] = ['floor', h < 0.55 ? 0 : 1 + Math.floor((h - 0.55) / 0.45 * 4), 12]; continue; }
    const s = (dc, dr) => !dentro(c + dc, r + dr) || suolo[r + dr][c + dc] === v;
    const n = s(0, -1), sd = s(0, 1), o = s(-1, 0), e = s(1, 0);
    const [img, ox, oy] = ESTERNO[v];
    if (n && sd && o && e) {
      const [ii, ix, iy] = INTERNO[v];
      if (!s(1, 1)) base[r][c] = [ii, ix, iy];
      else if (!s(-1, 1)) base[r][c] = [ii, ix + 1, iy];
      else if (!s(1, -1)) base[r][c] = [ii, ix, iy + 1];
      else if (!s(-1, -1)) base[r][c] = [ii, ix + 1, iy + 1];
      else { base[r][c] = [img, ox + 1, oy + 1]; if (v === 2) acquaPiena[r][c] = true; }
    } else base[r][c] = [img, ox + (!o ? 0 : !e ? 2 : 1), oy + (!n ? 0 : !sd ? 2 : 1)];
    if (v === 2) solido[r][c] = true;
  }
}

import { costruisciLuoghi } from './luoghi.js?v=8';
export function costruisci() {
  costruisciLuoghi({ rett, blocca, albero, gemelli, pino, casa, recinto, cesp, erba, fiore, sasso, ogg });
  calcolaBase();
  // decorazioni sparse sul prato libero, e ninfee sull'acqua aperta
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const h = hash(c * 3 + 1, r * 5 + 2);
    if (suolo[r][c] === 0 && !solido[r][c] && !taglio[r][c] && h < 0.13) {
      const k = [[0, 2], [1, 2], [2, 2], [3, 2], [5, 2], [2, 0]][Math.floor(h / 0.13 * 6)];
      DECOR.push({ x: c * T, y: r * T, sx: k[0] * T, sy: k[1] * T });
    }
    if (acquaPiena[r][c] && h > 0.86) NINFEE.push({ x: c * T + 3 + h * 9, y: r * T + 4 + (h * 37 % 1) * 8, r: 3 + (h > 0.95 ? 1 : 0) });
  }
  OGG.sort((a, b) => a.base - b.base);
  SOPRA.sort((a, b) => a.base - b.base);
}
