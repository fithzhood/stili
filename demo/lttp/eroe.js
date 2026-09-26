// L'eroe: camminata nelle quattro direzioni, fendente ad arco che taglia erba e cespugli,
// ciuffi e foglie che volano, cuori e monete che saltano fuori e si raccolgono.
import { T, C, R, solido, taglio } from './mappa.js?v=7';
import { IMG, cam } from './disegno.js?v=7';

export const G = { x: 0, y: 0, dir: 0, passo: 0, muove: false, colpo: -1, cuori: 7, maxCuori: 6, monete: 42, lampo: 0 };
export const PARTI = [];     // ciuffi e foglie in volo
export const PREMI = [];     // cuori e monete a terra
let seme = 7;
export const caso = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
const DUR = 0.26;
const BASE = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];     // giù, su, sinistra, destra
const MANO = [[0, -4], [1, -11], [-5, -6], [5, -6]];

export function libero(x, y, w = 10, h = 6) {
  for (const [px, py] of [[x - w / 2, y - h], [x + w / 2 - 0.01, y - h], [x - w / 2, y - 0.01], [x + w / 2 - 0.01, y - 0.01]]) {
    const c = Math.floor(px / T), r = Math.floor(py / T);
    if (c < 0 || r < 0 || c >= C || r >= R || solido[r][c]) return false;
    const k = taglio[r][c];
    if (k && k.vivo && k.tipo === 'cesp') return false;
  }
  return true;
}

export function colpisci() { if (G.colpo < 0) G.colpo = 0; }

export function aggiornaEroe(dt, ax, ay) {
  if (G.colpo >= 0) {
    const k = G.colpo / DUR;
    // la punta e il centro della lama tagliano quello che attraversano
    const a = BASE[G.dir] - 1.7 + 3.0 * Math.sin(Math.min(1, k) * Math.PI / 2);
    const [mx, my] = MANO[G.dir];
    for (const s of [7, 13, 18]) taglia(G.x + mx + Math.cos(a) * s, G.y + my + Math.sin(a) * s);
    G.colpo += dt;
    if (G.colpo > DUR + 0.05) G.colpo = -1;
    return;
  }
  const dx = ax, dy = ay;
  G.muove = !!(dx || dy);
  if (dy && !(dx && Math.abs(dx) > Math.abs(dy))) G.dir = dy > 0 ? 0 : 1; else if (dx) G.dir = dx < 0 ? 2 : 3;
  const v = 84 * dt / (dx && dy ? 1.41 : 1);
  if (dx && libero(G.x + dx * v, G.y)) G.x += dx * v;
  if (dy && libero(G.x, G.y + dy * v)) G.y += dy * v;
  G.passo = G.muove ? G.passo + dt * 9 : 0;
  // raccolta dei premi
  for (let i = PREMI.length - 1; i >= 0; i--) {
    const p = PREMI[i];
    if (p.z < 5 && Math.abs(p.x - G.x) < 9 && Math.abs(p.y - G.y + 3) < 9) {
      if (p.tipo === 'cuore') G.cuori = Math.min(G.maxCuori * 2, G.cuori + 2); else G.monete = Math.min(999, G.monete + 1);
      scintille(p.x, p.y - 4); PREMI.splice(i, 1); G.lampo = 0.3;
    }
  }
}

function taglia(x, y) {
  const c = Math.floor(x / T), r = Math.floor(y / T);
  if (c < 0 || r < 0 || c >= C || r >= R) return;
  const k = taglio[r][c];
  if (!k || !k.vivo) return;
  k.vivo = false; k.ricresce = 40;
  const cx = c * T + 8, cy = r * T + 10;
  const n = k.tipo === 'cesp' ? 8 : 6;
  for (let i = 0; i < n; i++) {
    const an = i / n * Math.PI * 2 + caso() * 0.6, vel = 28 + caso() * 30;
    PARTI.push({ img: k.tipo === 'cesp' ? 'foglie' : 'ciuffi', fr: Math.floor(caso() * 6), x: cx, y: cy, z: 4 + caso() * 4,
      vx: Math.cos(an) * vel, vy: Math.sin(an) * vel * 0.7, vz: 70 + caso() * 60, vita: 0, flip: caso() < 0.5 });
  }
  const d = caso();
  if (d < 0.22) PREMI.push({ tipo: 'cuore', x: cx, y: cy, z: 2, vz: 90, t: 0 });
  else if (d < 0.5) PREMI.push({ tipo: 'moneta', x: cx, y: cy, z: 2, vz: 110, t: 0 });
}

function scintille(x, y) {
  for (let i = 0; i < 6; i++) { const an = i / 6 * Math.PI * 2; PARTI.push({ img: 'stella', x, y, z: 6, vx: Math.cos(an) * 40, vy: Math.sin(an) * 40, vz: 0, vita: 0 }); }
}

export function aggiornaParti(dt) {
  for (let i = PARTI.length - 1; i >= 0; i--) {
    const p = PARTI[i];
    p.vita += dt;
    if (p.img === 'stella') { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; if (p.vita > 0.35) PARTI.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 240 * dt;
    if (p.z < 0) { p.z = 0; p.vx *= 0.5; p.vy *= 0.5; p.vz = 0; }
    if (p.vita > 0.9) PARTI.splice(i, 1);
  }
  for (let i = PREMI.length - 1; i >= 0; i--) {
    const p = PREMI[i];
    p.t += dt; p.z += p.vz * dt; p.vz -= 320 * dt;
    if (p.z < 0) { p.z = 0; p.vz = Math.abs(p.vz) > 40 ? -p.vz * 0.4 : 0; }
    if (p.t > 14) PREMI.splice(i, 1);
  }
  if (G.lampo > 0) G.lampo -= dt;
}

// Disegno dell'eroe e della spada (la spada sta dietro quando guarda in su)
export function disegnaEroe(g) {
  const x = Math.round(G.x - cam.x), y = Math.round(G.y - cam.y);
  g.drawImage(IMG.ombra, x - 6, y - 3);
  const corpo = () => {
    if (G.colpo >= 0) g.drawImage(IMG['eroe-colpo'], G.dir * 16, 0, 16, 16, x - 8, y - 15, 16, 16);
    else g.drawImage(IMG.eroe, G.dir * 16, (G.muove ? Math.floor(G.passo) % 4 : 0) * 16, 16, 16, x - 8, y - 15, 16, 16);
  };
  if (G.colpo < 0) return corpo();
  if (G.dir === 1) { spada(g, x, y); corpo(); } else { corpo(); spada(g, x, y); }
}

function spada(g, x, y) {
  const k = Math.min(1, G.colpo / DUR);
  const a = BASE[G.dir] - 1.7 + 3.0 * Math.sin(k * Math.PI / 2);
  const [mx, my] = MANO[G.dir];
  const hx = x + mx, hy = y + my;
  // scia del fendente, ruotata a multipli di 90° (resta a pixel pieni)
  if (k < 0.95) {
    g.save(); g.translate(hx, hy); g.rotate(BASE[G.dir]);
    g.drawImage(IMG.fendente, Math.min(3, Math.floor(k * 4)) * 32, 0, 32, 32, -6, -16, 32, 32);
    g.restore();
  }
  const cs = Math.cos(a), sn = Math.sin(a);
  for (let s = 2; s <= 16; s++) {
    const px = Math.round(hx + cs * s), py = Math.round(hy + sn * s);
    if (s <= 3) { g.fillStyle = s === 3 ? '#e8b830' : '#6a3a20'; g.fillRect(px - 1, py - 1, 3, 3); continue; }
    g.fillStyle = '#28304a'; g.fillRect(px - 1, py - 1, 3, 3);
  }
  for (let s = 4; s <= 16; s++) {
    const px = Math.round(hx + cs * s), py = Math.round(hy + sn * s);
    g.fillStyle = '#8898b8'; g.fillRect(px, py, 2, 1);
    g.fillStyle = s > 13 ? '#ffffff' : '#e4eefa'; g.fillRect(px, py, 1, 1);
  }
  const gx = Math.round(hx + cs * 4), gy = Math.round(hy + sn * 4);
  g.fillStyle = '#e8b830'; g.fillRect(gx - Math.round(sn * 3) - 1, gy + Math.round(cs * 3) - 1, 2, 2); g.fillRect(gx + Math.round(sn * 3) - 1, gy - Math.round(cs * 3) - 1, 2, 2);
}

export function disegnaParti(g) {
  for (const p of PARTI) {
    const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y - p.z);
    if (p.img === 'stella') { g.fillStyle = p.vita < 0.2 ? '#fff' : '#fff4a0'; g.fillRect(x, y, 1, 1); g.fillRect(x - 1, y + 1, 1, 1); continue; }
    if (p.vita > 0.7 && Math.floor(p.vita * 30) % 2) continue;
    const fr = (p.fr + Math.floor(p.vita * 12)) % 6, h = p.img === 'foglie' ? 7 : 13;
    g.drawImage(IMG[p.img], fr * 12, 0, 12, h, x - 6, y - h + 3, 12, h);
  }
}

export function disegnaPremi(g, t) {
  return PREMI.map(p => ({ y: p.y, f: () => {
    if (p.t > 11 && Math.floor(p.t * 12) % 2) return;
    const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
    g.fillStyle = 'rgba(30,26,70,0.4)'; g.fillRect(x - 3, y, 6, 1);
    if (p.tipo === 'cuore') g.drawImage(IMG.cuore, x - 4, y - 7 - Math.round(p.z));
    else g.drawImage(IMG.moneta, (Math.floor(t * 8) % 4) * 10, 0, 10, 10, x - 5, y - 10 - Math.round(p.z), 10, 10);
  } }));
}
