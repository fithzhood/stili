// Il mondo a blocchi della demo "voxel": la griglia, i materiali, la generazione dell'isola
// e il costruttore di mesh per blocchi (chunk) con occlusione ambientale per vertice.
import * as THREE from 'three';

export const SX = 96, SY = 80, SZ = 96, CH = 16;
export const ARIA = 0, ERBA = 1, TERRA = 2, PIETRA = 3, SABBIA = 4, ACQUA = 5, TRONCO = 6, FOGLIE = 7,
  ASSI = 8, TEGOLE = 9, CIOTTOLI = 10, ORO = 11, BETULLA = 12, FOGLIE2 = 13, SENTIERO = 14, MATTONI = 15;

// Colori sRGB dei materiali: [sopra, fianchi, sotto]
export const MAT = {
  [ERBA]: { nome: 'Erba', c: ['#74b83f', '#8f6a45', '#7e5a3a'] },
  [TERRA]: { nome: 'Terra', c: ['#8a6242', '#7e5a3a', '#6f4f33'] },
  [PIETRA]: { nome: 'Pietra', c: ['#8d9096', '#83868c', '#74777d'] },
  [SABBIA]: { nome: 'Sabbia', c: ['#e8d49a', '#dcc68c', '#cdb77e'] },
  [ACQUA]: { nome: 'Acqua', c: ['#3d8fd8', '#3d8fd8', '#3d8fd8'] },
  [TRONCO]: { nome: 'Tronco', c: ['#a07a4c', '#6a4a2c', '#a07a4c'] },
  [FOGLIE]: { nome: 'Foglie', c: ['#4f9a36', '#468c30', '#3c7a2a'] },
  [ASSI]: { nome: 'Assi', c: ['#c3915a', '#b5844f', '#a67746'] },
  [TEGOLE]: { nome: 'Tegole', c: ['#b8513a', '#a54733', '#8e3c2b'] },
  [CIOTTOLI]: { nome: 'Ciottoli', c: ['#7b7e84', '#72757b', '#65686e'] },
  [ORO]: { nome: 'Oro', c: ['#e2b845', '#d8ad3a', '#c89d30'] },
  [BETULLA]: { nome: 'Betulla', c: ['#d9d2c0', '#e6e0cf', '#d9d2c0'] },
  [FOGLIE2]: { nome: 'Foglie', c: ['#7fb33d', '#74a638', '#669432'] },
  [SENTIERO]: { nome: 'Sentiero', c: ['#b89a68', '#8f6a45', '#7e5a3a'] },
  [MATTONI]: { nome: 'Mattoni', c: ['#b06a4e', '#a45f45', '#944f3a'] },
};
// colori lineari precalcolati
const LIN = {};
for (const [k, v] of Object.entries(MAT)) LIN[k] = v.c.map(h => new THREE.Color(h));

export const V = new Uint8Array(SX * SY * SZ);
export const idx = (x, y, z) => x + SX * (z + SZ * y);
export const dentro = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < SX && y < SY && z < SZ;
export const get = (x, y, z) => dentro(x, y, z) ? V[idx(x, y, z)] : ARIA;
export const set = (x, y, z, b) => { if (dentro(x, y, z)) V[idx(x, y, z)] = b; };
const solido = b => b !== ARIA && b !== ACQUA;

// ── rumore ──
function hash(x, y, z = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function rumore2(x, z, seme = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi, seme), b = hash(xi + 1, zi, seme), c = hash(xi, zi + 1, seme), d = hash(xi + 1, zi + 1, seme);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z, s = 0) => 0.5 * rumore2(x, z, s) + 0.25 * rumore2(x * 2.1, z * 2.1, s + 7) + 0.125 * rumore2(x * 4.3, z * 4.3, s + 13);
export { hash };

// ── generazione ──
export const LAGO = { x: 60, z: 56, rx: 8.5, rz: 6.5, y: 46 };
export let cascata = null;           // {x, z0, z1, yTop, yBot}
export const ciuffi = [];            // fiori e fili d'erba: {x, y, z}

function isola(cx, cz, R, top, prof, seme, conLago) {
  const quote = new Map();
  for (let x = Math.max(0, cx - R - 5); x < Math.min(SX, cx + R + 5); x++)
    for (let z = Math.max(0, cz - R - 5); z < Math.min(SZ, cz + R + 5); z++) {
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      const ang = Math.atan2(dz, dx);
      const Rl = R * (0.86 + 0.22 * rumore2(Math.cos(ang) * 1.6 + 5, Math.sin(ang) * 1.6 + 5, seme));
      if (d > Rl) continue;
      const e = d / Rl;
      let h = top + Math.round(3.2 * fbm(x * 0.07, z * 0.07, seme) - 1.4 - 2.0 * Math.pow(e, 5));
      // collina alle spalle della casa
      if (conLago) h += Math.round(6 * Math.exp(-((x - 30) ** 2 + (z - 30) ** 2) / 90));
      let b = top - 3 - Math.round(Math.pow(Math.max(0, 1 - Math.pow(e, 1.5)), 0.75) * prof + 4 * rumore2(x * 0.16, z * 0.16, seme + 3) * (1 - e));
      if (conLago) {
        const el = Math.hypot((x - LAGO.x) / LAGO.rx, (z - LAGO.z) / LAGO.rz);
        if (el < 1) h = LAGO.y - 1 - Math.round(2.5 * (1 - el));
        else if (el < 1.7) h = Math.max(h, LAGO.y + 1);
      }
      quote.set(x + ',' + z, [h, b]);
      for (let y = Math.max(0, b); y <= h; y++) {
        let m = PIETRA;
        if (y === h) m = ERBA; else if (y >= h - 3) m = TERRA;
        else if (hash(x, y, z) < 0.018) m = ORO;
        else if (hash(x, y, z + 99) < 0.12) m = CIOTTOLI;
        else if (y > b + 2 && rumore2(x * 0.2 + y * 0.3, z * 0.2, 5) > 0.7) m = TERRA;
        set(x, y, z, m);
      }
    }
  return quote;
}

export function genera() {
  V.fill(0);
  const q = isola(48, 48, 29, 47, 32, 1, true);
  isola(13, 17, 7, 36, 9, 4, false);
  isola(84, 82, 6, 58, 8, 9, false);
  isola(86, 16, 4, 28, 6, 12, false);

  // lago: acqua fino a LAGO.y, fondo di sabbia
  for (let x = 0; x < SX; x++) for (let z = 0; z < SZ; z++) {
    const el = Math.hypot((x - LAGO.x) / LAGO.rx, (z - LAGO.z) / LAGO.rz);
    if (el >= 1) continue;
    for (let y = LAGO.y; y > 0; y--) {
      const b = get(x, y, z);
      if (b === ARIA) set(x, y, z, ACQUA);
      else { set(x, y, z, SABBIA); set(x, y - 1, z, SABBIA); break; }
    }
  }
  // canale verso sud (verso chi guarda) fino al bordo, poi la cascata nel vuoto
  const xc0 = LAGO.x - 1, xc1 = LAGO.x;
  let zb = Math.floor(LAGO.z + LAGO.rz - 1);
  for (; zb < SZ; zb++) {
    let pieno = false;
    for (let x = xc0; x <= xc1; x++) if (get(x, LAGO.y - 1, zb) !== ARIA || get(x, LAGO.y - 3, zb) !== ARIA) pieno = true;
    if (!pieno) break;
    for (let x = xc0 - 1; x <= xc1 + 1; x++) {
      const bordo = x < xc0 || x > xc1;
      for (let y = LAGO.y + 4; y >= LAGO.y; y--) {
        if (bordo) { if (y > LAGO.y + 1) set(x, y, zb, ARIA); else if (get(x, y, zb) === ARIA) set(x, y, zb, y === LAGO.y + 1 ? ERBA : TERRA); }
        else set(x, y, zb, y === LAGO.y ? ACQUA : ARIA);
      }
      if (!bordo) { set(x, LAGO.y - 1, zb, SABBIA); set(x, LAGO.y - 2, zb, PIETRA); }
    }
  }
  const yFondo = 4;
  for (let x = xc0; x <= xc1; x++) for (let y = LAGO.y; y >= yFondo; y--) set(x, y, zb, ACQUA);
  cascata = { z: zb, x0: xc0, x1: xc1, yTop: LAGO.y, yBot: yFondo };

  // spiaggia: erba vicino all'acqua diventa sabbia
  const vicinoAcqua = (x, y, z) => {
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 1; dy++)
      if (get(x + dx, y + dy, z + dz) === ACQUA) return true;
    return false;
  };
  for (let x = 0; x < SX; x++) for (let z = 0; z < SZ; z++) for (let y = LAGO.y - 1; y <= LAGO.y + 2; y++)
    if (get(x, y, z) === ERBA && get(x, y + 1, z) === ARIA && vicinoAcqua(x, y, z) && !(z >= zb - 1)) {
      set(x, y, z, SABBIA); if (get(x, y - 1, z) === TERRA) set(x, y - 1, z, SABBIA);
    }

  const cima = (x, z) => { for (let y = SY - 1; y >= 0; y--) { const b = get(x, y, z); if (b !== ARIA) return [y, b]; } return [-1, ARIA]; };

  // casa
  casa(33, 37, cima);

  // sentiero dalla porta al lago
  let px = 37, pz = 45;
  for (let i = 0; i < 40; i++) {
    const [y, b] = cima(px, pz);
    if (b === ERBA) set(px, y, pz, SENTIERO);
    if (Math.hypot((px - LAGO.x) / LAGO.rx, (pz - LAGO.z) / LAGO.rz) < 1.5) break;
    if (hash(px, pz, 3) < 0.55) px++; else pz++;
  }

  // alberi
  const alberi = [[22, 48], [26, 58], [44, 66], [55, 34], [66, 40], [36, 62], [28, 38], [70, 66], [50, 24], [18, 36], [13, 17], [84, 82]];
  alberi.forEach(([x, z], i) => {
    const [y, b] = cima(x, z);
    if (b !== ERBA) return;
    albero(x, y + 1, z, i % 4 === 3);
  });

  // ciuffi: fiori e fili d'erba sui prati
  ciuffi.length = 0;
  for (let x = 0; x < SX; x++) for (let z = 0; z < SZ; z++) {
    const r = hash(x, z, 77);
    if (r > 0.16) continue;
    const [y, b] = cima(x, z);
    if (b !== ERBA) continue;
    ciuffi.push({ x, y: y + 1, z, t: r < 0.035 ? 1 + ((hash(x, z, 5) * 3) | 0) : 0 });
  }
}

function casa(x0, z0, cima) {
  const W = 9, D = 7;
  let base = 0;
  for (let x = x0; x < x0 + W; x++) for (let z = z0; z < z0 + D; z++) base = Math.max(base, cima(x, z)[0]);
  base += 1;
  // fondazione fino al terreno
  for (let x = x0 - 1; x <= x0 + W; x++) for (let z = z0 - 1; z <= z0 + D; z++) {
    for (let y = base - 1; y >= base - 6; y--) { if (get(x, y, z) !== ARIA && y < base - 1) break; set(x, y, z, CIOTTOLI); }
    for (let y = base; y < base + 12; y++) set(x, y, z, ARIA);
  }
  const H = 4;
  for (let x = x0; x < x0 + W; x++) for (let z = z0; z < z0 + D; z++) {
    const bordo = x === x0 || x === x0 + W - 1 || z === z0 || z === z0 + D - 1;
    const angolo = (x === x0 || x === x0 + W - 1) && (z === z0 || z === z0 + D - 1);
    set(x, base - 1, z, ASSI);
    if (!bordo) continue;
    for (let y = base; y < base + H; y++) set(x, y, z, angolo ? TRONCO : (y === base ? CIOTTOLI : ASSI));
  }
  // porta verso sud (z massimo), finestre
  const zp = z0 + D - 1, xp = x0 + 4;
  set(xp, base, zp, ARIA); set(xp, base + 1, zp, ARIA);
  for (const xf of [x0 + 2, x0 + 6]) set(xf, base + 2, zp, ARIA);
  set(x0 + 2, base + 2, z0, ARIA); set(x0 + 6, base + 2, z0, ARIA);
  set(x0, base + 2, z0 + 3, ARIA); set(x0 + W - 1, base + 2, z0 + 3, ARIA);
  // tetto a capanna lungo x, con timpani in assi
  for (let k = 0; k <= 4; k++) {
    const y = base + H + k;
    const za = z0 - 1 + k, zb = z0 + D - k;
    if (za > zb) break;
    for (let x = x0 - 1; x <= x0 + W; x++) {
      set(x, y, za, TEGOLE); set(x, y, zb, TEGOLE);
      if (x >= x0 && x < x0 + W && (x === x0 || x === x0 + W - 1)) for (let z = za + 1; z < zb; z++) set(x, y, z, ASSI);
    }
    if (za === zb || za + 1 === zb) for (let x = x0 - 1; x <= x0 + W; x++) for (let z = za; z <= zb; z++) set(x, y, z, TEGOLE);
  }
  // comignolo
  for (let y = base + H; y < base + H + 6; y++) set(x0 + 7, y, z0 + 1, MATTONI);
}

function albero(x, y, z, betulla) {
  const h = 4 + ((hash(x, z, 1) * 3) | 0);
  const legno = betulla ? BETULLA : TRONCO, fo = betulla ? FOGLIE2 : FOGLIE;
  const r = betulla ? 2.2 : 2.9;
  const cy = y + h - 1;
  for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
    const d = Math.hypot(dx, dy * (dy > 0 ? 1.25 : 1.6), dz);
    if (d > r + hash(x + dx, cy + dy, z + dz) * 0.8 - 0.3) continue;
    if (get(x + dx, cy + dy, z + dz) === ARIA) set(x + dx, cy + dy, z + dz, fo);
  }
  for (let i = 0; i < h; i++) set(x, y + i, z, legno);
}

// ── costruzione delle mesh per blocco ──
// Per ogni faccia visibile un quadrilatero; ogni vertice prende l'occlusione dai tre vicini
// davanti alla faccia (due lati e l'angolo), come nei giochi a blocchi moderni.
const FACCE = [
  { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], lato: 1 },
  { n: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], lato: 1 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], lato: 0 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], lato: 2 },
  { n: [0, 0, 1], v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], lato: 1 },
  { n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], lato: 1 },
];
const AO = [0.42, 0.62, 0.8, 1.0];
const tmp = new THREE.Color();

export function costruisciChunk(cx, cy, cz) {
  const pos = [], nor = [], col = [], ind = [];
  const wpos = [], wnor = [], wind = [], wcol = [];
  const x0 = cx * CH, y0 = cy * CH, z0 = cz * CH;
  for (let y = y0; y < y0 + CH; y++) for (let z = z0; z < z0 + CH; z++) for (let x = x0; x < x0 + CH; x++) {
    const b = V[idx(x, y, z)];
    if (b === ARIA) continue;
    const acqua = b === ACQUA;
    for (const f of FACCE) {
      const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
      const vb = get(nx, ny, nz);
      if (acqua ? vb !== ARIA : solido(vb)) continue;
      if (acqua) {
        const base = wpos.length / 3;
        const abbassa = get(x, y + 1, z) !== ACQUA ? 0.14 : 0;
        for (const c of f.v) {
          wpos.push(x + c[0], y + c[1] - (c[1] === 1 ? abbassa : 0), z + c[2]);
          wnor.push(...f.n);
          // le facce verticali della cascata sono più chiare (schiuma), le altre più scure verso il fondo
          const k = f.n[1] === 0 ? 1.0 : 0.9;
          wcol.push(k, k, k);
        }
        wind.push(base, base + 1, base + 2, base, base + 2, base + 3);
        continue;
      }
      const base = pos.length / 3;
      const aoV = [];
      // due assi tangenti della faccia
      const ax = f.n[0] !== 0 ? [0, 1, 2] : f.n[1] !== 0 ? [1, 0, 2] : [2, 0, 1];
      const t1 = ax[1], t2 = ax[2];
      const variaz = 0.92 + 0.14 * hash(x, y, z);
      const tinta = (hash(z, x, y) - 0.5) * 0.04;
      for (const c of f.v) {
        const o = [nx, ny, nz];
        const d1 = c[t1] ? 1 : -1, d2 = c[t2] ? 1 : -1;
        const s1 = [...o]; s1[t1] += d1;
        const s2 = [...o]; s2[t2] += d2;
        const cc = [...o]; cc[t1] += d1; cc[t2] += d2;
        const a = solido(get(...s1)) ? 1 : 0, bb = solido(get(...s2)) ? 1 : 0, k = solido(get(...cc)) ? 1 : 0;
        const ao = a && bb ? 0 : 3 - (a + bb + k);
        aoV.push(ao);
        pos.push(x + c[0], y + c[1], z + c[2]);
        nor.push(...f.n);
        let li = f.lato;
        // fianco del blocco d'erba: sopra verde, sotto terra
        let colore = LIN[b][li];
        if ((b === ERBA || b === SENTIERO) && li === 1 && c[1] === 1) colore = LIN[b][0];
        tmp.copy(colore).multiplyScalar(variaz * AO[ao]);
        tmp.r *= 1 + tinta; tmp.b *= 1 - tinta;
        col.push(tmp.r, tmp.g, tmp.b);
      }
      // si gira la diagonale per non avere anisotropia nell'occlusione
      if (aoV[0] + aoV[2] < aoV[1] + aoV[3]) ind.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      else ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = pos.length ? new THREE.BufferGeometry() : null;
  if (g) {
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(ind);
    g.computeBoundingSphere();
  }
  const gw = wpos.length ? new THREE.BufferGeometry() : null;
  if (gw) {
    gw.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
    gw.setAttribute('normal', new THREE.Float32BufferAttribute(wnor, 3));
    gw.setAttribute('color', new THREE.Float32BufferAttribute(wcol, 3));
    gw.setIndex(wind);
    gw.computeBoundingSphere();
  }
  return { g, gw };
}

// Attraversamento della griglia lungo un raggio (Amanatides & Woo): primo blocco colpito
// e la cella vuota da cui si è entrati (dove si costruisce).
export function raggio(o, d, maxD = 400) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
  let tx = d.x !== 0 ? ((sx > 0 ? x + 1 - o.x : o.x - x) * tdx) : Infinity;
  let ty = d.y !== 0 ? ((sy > 0 ? y + 1 - o.y : o.y - y) * tdy) : Infinity;
  let tz = d.z !== 0 ? ((sz > 0 ? z + 1 - o.z : o.z - z) * tdz) : Infinity;
  let px = x, py = y, pz = z, t = 0;
  for (let i = 0; i < 1200 && t < maxD; i++) {
    const b = dentro(x, y, z) ? V[idx(x, y, z)] : ARIA;
    if (b !== ARIA && b !== ACQUA) return { x, y, z, px, py, pz };
    px = x; py = y; pz = z;
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; }
    else { z += sz; t = tz; tz += tdz; }
  }
  return null;
}
