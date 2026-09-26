// Arredo del borgo: selciato, canale, ponticello ad arco, fontana, lampioni, alberi a sprite, oggetti.
import * as THREE from 'three';
import { tex, mat, quad, trave } from './mondo.js?v=7';
import { ciuffo, fiori } from './pixel.js?v=7';

export const CANALE = { x0: 8, x1: 11.6, acqua: -0.78 };
export const PONTE = { x0: 7.0, x1: 12.6, mezzaL: 1.25, alto: 0.75 };

/** Altezza del terreno calpestabile (il ponte è l'unico dislivello). */
export function altezza(x, z) {
  if (Math.abs(z) < PONTE.mezzaL + 0.2 && x > PONTE.x0 && x < PONTE.x1) {
    const u = (x - PONTE.x0) / (PONTE.x1 - PONTE.x0);
    return Math.sin(u * Math.PI) * PONTE.alto + 0.12;
  }
  return 0;
}

export function acquaMat(ripeti, tinta) {
  const t = tex('floor_ground_water').clone(); t.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map: t, color: tinta ?? 0x7f9fd8, roughness: 0.18, metalness: 0.1, emissive: 0x0a1a38, emissiveMap: t, emissiveIntensity: 1.2 });
  m.userData.t = t;
  return m;
}

export function terreno(scene) {
  const selc = mat('floor_stone_pattern'), erba = mat('floor_ground_grass', { colore: 0xb0c8a0 });
  const pezzo = (x0, z0, x1, z1, m, tw) => {
    const q = quad(x1 - x0, z1 - z0, m, tw, tw, x0, z0); q.rotation.x = -Math.PI / 2; q.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); q.castShadow = false; scene.add(q);
  };
  pezzo(-40, -40, CANALE.x0, 9.6, selc, 1.3);
  pezzo(-40, 9.6, CANALE.x0, 40, erba, 1.6);
  pezzo(CANALE.x1, -40, 40, 40, selc, 1.3);
  // sponde del canale: muri di pietra e cordolo
  const muro = mat('wall_brick_small_stone', { colore: 0x9aa0b0 });
  for (const [x, r] of [[CANALE.x0, Math.PI / 2], [CANALE.x1, -Math.PI / 2]]) {
    const m = quad(80, 2, muro, 1, 1); m.rotation.y = r; m.position.set(x, -1, 0); m.castShadow = false; scene.add(m);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 80), mat('floor_stone_pattern_small')); c.position.set(x + (r > 0 ? 0.2 : -0.2), 0.09, 0); c.receiveShadow = true; scene.add(c);
  }
  const am = acquaMat(); am.userData.t.repeat.set(1, 1);
  const w = quad(CANALE.x1 - CANALE.x0, 80, am, 1.4, 1.4); w.rotation.x = -Math.PI / 2; w.position.set((CANALE.x0 + CANALE.x1) / 2, CANALE.acqua, 0); w.castShadow = false; scene.add(w);
  return am;
}

export function ponte(scene) {
  const g = new THREE.Group();
  const assi = mat('floor_wood_planks', { colore: 0xc8a888 });
  const N = 11, L = PONTE.x1 - PONTE.x0;
  for (let i = 0; i < N; i++) {
    const u0 = i / N, u1 = (i + 1) / N, x0 = PONTE.x0 + u0 * L, x1 = PONTE.x0 + u1 * L;
    const y0 = altezza(x0, 0) - 0.06, y1 = altezza(x1, 0) - 0.06;
    const len = Math.hypot(x1 - x0, y1 - y0) + 0.02;
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, PONTE.mezzaL * 2), assi);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); b.rotation.z = Math.atan2(y1 - y0, x1 - x0); b.castShadow = b.receiveShadow = true; g.add(b);
    for (const s of [-1, 1]) {
      const p = trave(0.12, 0.8, 0.12); p.position.set(x0, y0 + 0.45, s * (PONTE.mezzaL - 0.05)); g.add(p);
      const r = trave(len, 0.1, 0.1); r.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 0.78, s * (PONTE.mezzaL - 0.05)); r.rotation.z = b.rotation.z; g.add(r);
    }
  }
  for (const s of [-1, 1]) { const p = trave(0.16, 0.95, 0.16); p.position.set(PONTE.x1, 0.45, s * (PONTE.mezzaL - 0.05)); g.add(p); }
  // travi sotto l'arco
  for (const s of [-1, 1]) for (let i = 0; i < 12; i++) {
    const x = PONTE.x0 + 0.5 + (L - 1) * i / 11;
    const t = trave(0.1, 0.1, 0.1); t.scale.y = 3; t.position.set(x, altezza(x, 0) - 0.4, s * 0.9); if (x > CANALE.x0 && x < CANALE.x1) g.add(t);
  }
  scene.add(g);
}

export function fontana(scene, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const pietra = mat('wall_stone', { colore: 0xc0c4cc });
  const cil = (rt, rb, h, seg, m, tw) => {
    const geo = new THREE.CylinderGeometry(rt, rb, h, seg, 1, false);
    const uv = geo.attributes.uv; const circ = Math.PI * 2 * Math.max(rt, rb);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tw, uv.getY(i) * h / tw);
    const me = new THREE.Mesh(geo, m); me.castShadow = me.receiveShadow = true; return me;
  };
  const vasca = cil(2.3, 2.4, 0.7, 8, pietra, 1.2); vasca.position.y = 0.35; g.add(vasca);
  const bordo = cil(2.5, 2.5, 0.16, 8, mat('floor_stone_pattern_small'), 1.0); bordo.position.y = 0.76; g.add(bordo);
  const acqua = acquaMat(null, 0x9fc4ff);
  const disco = new THREE.Mesh(new THREE.CircleGeometry(2.2, 8), acqua); disco.rotation.x = -Math.PI / 2; disco.rotation.z = Math.PI / 8; disco.position.y = 0.6; disco.receiveShadow = true; g.add(disco);
  const col = cil(0.32, 0.4, 1.9, 8, pietra, 1.2); col.position.y = 1.35; g.add(col);
  const coppa = cil(1.0, 0.45, 0.35, 8, pietra, 1.2); coppa.position.y = 2.25; g.add(coppa);
  const d2 = new THREE.Mesh(new THREE.CircleGeometry(0.92, 8), acqua); d2.rotation.x = -Math.PI / 2; d2.position.y = 2.4; g.add(d2);
  const cima = cil(0.12, 0.2, 0.8, 8, pietra, 1.2); cima.position.y = 2.75; g.add(cima);
  const pal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), pietra); pal.position.y = 3.2; g.add(pal);
  scene.add(g);
  return acqua;
}

// ── lampioni ──
const ferro = new THREE.MeshStandardMaterial({ color: 0x24201e, roughness: 0.55, metalness: 0.6 });
export const vetroCaldo = new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 2.6, 0.9) });
export function lampione(scene, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), mat('wall_stone')); base.position.y = 0.17; base.castShadow = true; g.add(base);
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.0, 6), ferro); palo.position.y = 1.8; palo.castShadow = true; g.add(palo);
  g.add(lanterna(0, 3.45, 0));
  scene.add(g);
  return new THREE.Vector3(x, 3.45, z);
}
export function lanterna(x, y, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s);
  const vetro = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), vetroCaldo); g.add(vetro);
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), ferro); c.position.set(a * 0.18, 0, b * 0.18); g.add(c); }
  const tet = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.28, 4), ferro); tet.position.y = 0.36; tet.rotation.y = Math.PI / 4; g.add(tet);
  const fondo = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), ferro); fondo.position.y = -0.24; g.add(fondo);
  return g;
}
export function lanternaMuro(scene, pos, rot) {
  const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = rot;
  const braccio = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.4), ferro); braccio.position.set(0, 0.35, -0.16); g.add(braccio);
  g.add(lanterna(0, 0.05, 0, 0.8));
  scene.add(g);
}

// ── alberi e cespugli a sprite (girati verso la camera, solo sull'asse verticale) ──
export const cartelli = [];
const matFoglie = [];
function matChioma(seme, rampa, W = 48) {
  const m = new THREE.MeshLambertMaterial({ map: ciuffo(seme, W, W, rampa), alphaTest: 0.5, side: THREE.DoubleSide });
  matFoglie.push(m); return m;
}
const RAMPE = [
  ['#122520', '#1c3d2e', '#2a5a36', '#437f3d', '#78a948', '#b9d466'],
  ['#15221f', '#20382b', '#305232', '#4c753a', '#86a347', '#c4cf6a'],
  ['#1a1f2a', '#223a34', '#2f5842', '#46795a', '#6fa37a', '#a9cf9c'],
];
export function albero(scene, x, z, seme, h = 2.6, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.3 * s, h, 6), mat('floor_wood_planks', { colore: 0x8a6a58 }));
  tronco.position.y = h / 2; tronco.castShadow = true; g.add(tronco);
  const r = (seme * 9301 + 49297) % 233280 / 233280;
  const blob = [[0, h + 0.9, 0, 2.8], [-0.9, h + 0.3, 0.2, 2.0], [0.95, h + 0.45, 0.1, 2.1], [0.2, h + 1.8, -0.1, 2.0], [-0.4, h + 1.3, 0.35, 1.7], [0.6, h + 1.35, 0.3, 1.6]];
  blob.forEach(([bx, by, bz, bs], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bs * s, bs * s), matChioma(seme * 7 + i, RAMPE[(seme + i) % 2], 40));
    m.position.set(bx * s, by * s, bz * s); m.castShadow = true; m.customDepthMaterial = profonditaAlfa(m.material.map);
    g.add(m); cartelli.push({ m, fase: r * 6 + i, ondeggia: 0.03 });
  });
  scene.add(g);
}
export function cespuglio(scene, x, z, seme, s = 1.2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s * 1.5, s), matChioma(seme, RAMPE[seme % 3], 36));
  m.geometry.translate(0, s / 2 - 0.08, 0);
  m.position.set(x, 0, z); scene.add(m); cartelli.push({ m, fase: seme, ondeggia: 0.015 });
}
export function aiuola(scene, x, z, seme, s = 0.9) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s * 2, s), new THREE.MeshLambertMaterial({ map: fiori(seme), alphaTest: 0.5, side: THREE.DoubleSide }));
  m.geometry.translate(0, s / 2 - 0.04, 0);
  m.position.set(x, 0, z); scene.add(m); cartelli.push({ m, fase: seme, ondeggia: 0.02 });
}
export function fioriera(rng) {
  return new THREE.MeshLambertMaterial({ map: fiori(Math.floor(rng() * 1e6)), alphaTest: 0.5, side: THREE.DoubleSide });
}
const cacheProf = new Map();
export function profonditaAlfa(map) {
  if (cacheProf.has(map)) return cacheProf.get(map);
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
  cacheProf.set(map, m); return m;
}
/** Gira gli sprite verso la camera; un soffio di vento sulle chiome. */
export function aggiornaCartelli(yaw, t) {
  for (const c of cartelli) { c.m.rotation.y = yaw; c.m.rotation.z = Math.sin(t * 1.3 + c.fase) * c.ondeggia; }
}

/** Filo di lampadine fra due punti (catenaria semplice). */
export function festone(scene, a, b, n = 14, pancia = 0.9) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24; const p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * pancia; pts.push(p); }
  const filo = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.015, 4), ferro); scene.add(filo);
  const colori = [new THREE.Color(5, 2.4, 0.8), new THREE.Color(4.5, 1.4, 1.0), new THREE.Color(3.5, 3.2, 1.4)];
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial(), n);
  const M = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n; const p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * pancia + 0.08;
    M.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, M); im.setColorAt(i, colori[i % 3]);
  }
  scene.add(im);
}
