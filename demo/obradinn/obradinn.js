// 1 bit — il ponte di un veliero di notte, fermo in un ricordo, come Return of the Obra Dinn.
// Tre passate a bassa risoluzione (640×360 circa, poi ingrandite senza filtro):
//   1) la luce: materiali bianchi illuminati dalla luna (con ombre) e dalle lanterne;
//   2) normali e profondità, per trovare gli spigoli; il sartiame scrive un segno "linea forzata";
//   3) la composizione: la luce diventa bianco o nero confrontandola con un rumore blu che è
//      incollato alle DIREZIONI del mondo (una cubemap attorno alla camera, non lo schermo):
//      girando la testa il retino resta fermo sulle cose invece di sfarfallare. Sopra, i contorni.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

THREE.ColorManagement.enabled = false;
const Q = Demo.query;

// ─────────────────────────── renderer ───────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: Demo.shot });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.prepend(renderer.domElement);
renderer.domElement.style.imageRendering = 'pixelated';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 900);
camera.layers.enableAll();

const LOW = new THREE.Vector2(640, 360);
const opzRT = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false };
const rtLuce = new THREE.WebGLRenderTarget(640, 360, { ...opzRT, type: THREE.HalfFloatType });
const rtNorm = new THREE.WebGLRenderTarget(640, 360, { ...opzRT, depthTexture: new THREE.DepthTexture(640, 360, THREE.FloatType) });

function dimensiona() {
  renderer.setSize(innerWidth, innerHeight);
  // righe basse e pixel grossi: un fattore intero se possibile
  const sc = Math.max(1, Math.round(innerHeight / 360));
  LOW.set(Math.ceil(innerWidth / sc), Math.ceil(innerHeight / sc));
  rtLuce.setSize(LOW.x, LOW.y); rtNorm.setSize(LOW.x, LOW.y);
  camera.aspect = LOW.x / LOW.y; camera.updateProjectionMatrix();
}
dimensiona();
addEventListener('resize', dimensiona);

// strati: 0 = nave e oggetti (luce + spigoli), 1 = sartiame (solo linee), 2 = cielo (solo luce)
const STRATO_SARTIAME = 1, STRATO_CIELO = 2;

// ─────────────────────────── texture disegnate (tavole, tela) ───────────────────────────
function tela(w, h, disegna) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); disegna(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
let seme = 1802;
const rnd = () => { seme = (seme * 1664525 + 1013904223) >>> 0; return seme / 4294967296; };
// tavolato: tavole lungo v, commenti scuri, giunte sfalsate, chiodi, venature a tratti
const texTavole = tela(512, 512, (g, w, h) => {
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
  const n = 8, lw = w / n;
  for (let i = 0; i < n; i++) {
    const x = i * lw;
    g.strokeStyle = 'rgba(60,60,60,0.35)'; g.lineWidth = 1;
    for (let k = 0; k < 7; k++) {            // venature
      const xx = x + 6 + rnd() * (lw - 12), y0 = rnd() * h, L = 40 + rnd() * 160;
      g.beginPath(); g.moveTo(xx, y0); g.bezierCurveTo(xx + 3, y0 + L / 3, xx - 3, y0 + L * 2 / 3, xx + (rnd() - 0.5) * 4, y0 + L); g.stroke();
    }
    g.fillStyle = '#2a2a2a'; g.fillRect(x, 0, 3, h);   // comento
    const gy = (i * 197) % h;                          // giunta di testa
    g.fillRect(x, gy, lw, 3);
    g.fillStyle = '#555';
    for (const yy of [gy + 9, gy - 9]) { g.fillRect(x + lw * 0.3, yy, 3, 3); g.fillRect(x + lw * 0.7, yy, 3, 3); }
  }
});
const texFasciame = tela(256, 256, (g, w, h) => {      // murate: tavole orizzontali
  g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) {
    const y = i * h / 6;
    g.fillStyle = '#303030'; g.fillRect(0, y, w, 3);
    g.fillRect((i * 97) % w, y, 3, h / 6);
    g.strokeStyle = 'rgba(70,70,70,0.3)';
    for (let k = 0; k < 4; k++) { const yy = y + 5 + rnd() * (h / 6 - 10); g.beginPath(); g.moveTo(rnd() * w, yy); g.lineTo(rnd() * w, yy + (rnd() - 0.5) * 3); g.stroke(); }
  }
});
const texVela = tela(256, 256, (g, w, h) => {
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(40,40,40,0.55)';
  for (let i = 0; i < 8; i++) g.fillRect(i * w / 8, 0, 2, h);    // cuciture dei ferzi
  g.fillRect(0, h * 0.25, w, 2);                                    // terzaroli
});
const texGrata = tela(128, 128, (g, w, h) => {
  g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#050505';
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) g.fillRect(4 + i * 21, 4 + j * 21, 14, 14);
});

const texDoghe = tela(256, 128, (g, w, h) => {
  g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#262626';
  for (let i = 0; i < 14; i++) g.fillRect(i * w / 14, 0, 2, h);
  g.fillStyle = 'rgba(60,60,60,0.35)';
  for (let i = 0; i < 30; i++) g.fillRect(rnd() * w, rnd() * h, 1, 6 + rnd() * 20);
});
// la tela è sottile: la luna la attraversa, così anche il lato in ombra di una vela si illumina
function velaTraslucida(m) {
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_lambert_pars_fragment>',
      THREE.ShaderChunk.lights_lambert_pars_fragment.replace('saturate( dot( geometryNormal, directLight.direction ) )',
        'max( dot( geometryNormal, directLight.direction ), -0.7 * dot( geometryNormal, directLight.direction ) )'));
  };
  return m;
}
const mat = {
  doghe: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texDoghe }),
  legno: new THREE.MeshLambertMaterial({ color: 0xbdbdbd }),
  tavole: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texTavole }),
  fasciame: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texFasciame }),
  vela: velaTraslucida(new THREE.MeshLambertMaterial({ color: 0xffffff, map: texVela, side: THREE.DoubleSide })),
  grata: new THREE.MeshLambertMaterial({ color: 0xffffff, map: texGrata }),
  ferro: new THREE.MeshLambertMaterial({ color: 0x6a6a6a }),
  scuro: new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  figura: new THREE.MeshLambertMaterial({ color: 0xe6e6e6 }),
  lume: new THREE.MeshBasicMaterial({ color: 0xffffff }),
};

// ─────────────────────────── raccolta della geometria per materiale ───────────────────────────
const pezzi = new Map();   // materiale → [geometrie]
function metti(g, m, matrice) {
  let geo = g.index ? g.toNonIndexed() : g.clone();
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  if (!geo.attributes.normal) geo.computeVertexNormals();
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
  if (matrice) geo.applyMatrix4(matrice);
  if (!pezzi.has(m)) pezzi.set(m, []);
  pezzi.get(m).push(geo);
}
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
function scatola(w, h, d, x, y, z, m = mat.legno, ry = 0, rx = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  // uv in metri, così le texture hanno la stessa scala ovunque
  const uv = g.attributes.uv, p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, p.getX(i) / 2, p.getZ(i) / 4);
    else if (ax > 0.5) uv.setXY(i, p.getZ(i) / 2, p.getY(i) / 2);
    else uv.setXY(i, p.getX(i) / 2, p.getY(i) / 2);
  }
  metti(g, m, M4(x, y, z, rx, ry, rz));
}
function cilindro(r0, r1, h, x, y, z, m = mat.legno, rx = 0, ry = 0, rz = 0, seg = 10) {
  metti(new THREE.CylinderGeometry(r1, r0, h, seg, 1), m, M4(x, y, z, rx, ry, rz));
}
// cilindro fra due punti
function asta(a, b, r0, r1, m = mat.legno, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  metti(g, m, new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(1, 1, 1)));
}

// ─────────────────────────── la nave ───────────────────────────
const PRUA = -17.8, POPPA = 17.5;
function mezza(z) {                     // mezza larghezza della coperta
  if (z < -8) { const t = (z + 8) / (PRUA + 8); return 4.3 * Math.sqrt(Math.max(0, 1 - t * t)); }
  if (z > 9) { const t = (z - 9) / (POPPA - 9); return 4.3 - 0.6 * t * t; }
  return 4.3;
}
function pianoY(z) { return z > 7 ? 1.6 : z < -11 ? 1.4 : 0; }
const SCALA_CASS = { x0: -1.2, x1: 1.2, z0: 5.2, z1: 7 };       // scala verso il cassero
const SCALE_CASTELLO = [-2.6, 2.6];                               // due scalette verso il castello

// tavolato di una coperta fra z0 e z1
function coperta(z0, z1, y) {
  const pos = [], uv = [], nor = [];
  const passi = Math.max(2, Math.ceil((z1 - z0) / 0.5));
  for (let i = 0; i < passi; i++) {
    const za = z0 + (z1 - z0) * i / passi, zb = z0 + (z1 - z0) * (i + 1) / passi;
    const wa = mezza(za), wb = mezza(zb);
    const q = [[-wa, za], [wa, za], [wb, zb], [-wb, zb]];
    for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(q[k][0], y, q[k][1]); uv.push(q[k][0] / 2, q[k][1] / 4); nor.push(0, 1, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  metti(g, mat.tavole);
}
// una striscia verticale lungo il bordo: per ogni tratto un quadrilatero da yBasso a yAlto
function fascia(punti, yBasso, yAlto, m, verso) {
  const pos = [], uv = [];
  let s = 0;
  for (let i = 0; i < punti.length - 1; i++) {
    const a = punti[i], b = punti[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ya0 = yBasso(a), ya1 = yAlto(a), yb0 = yBasso(b), yb1 = yAlto(b);
    const v = [[a[0], ya0, a[1], s, ya0], [b[0], yb0, b[1], s + L, yb0], [b[0], yb1, b[1], s + L, yb1], [a[0], ya1, a[1], s, ya1]];
    const ord = verso > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const k of ord) { pos.push(v[k][0], v[k][1], v[k][2]); uv.push(v[k][3] / 2, v[k][4] / 2); }
    s += L;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  metti(g, m);
}

const CANNONI_Z = [-8.3, -4.6, 0.6, 3.2];
const PORTELLI = CANNONI_Z.map(z => [z - 0.45, z + 0.45]);
function nelPortello(z) { return PORTELLI.some(([a, b]) => z > a && z < b); }

function scafo() {
  // coperte
  coperta(-11, 7, 0);
  coperta(7, POPPA, 1.6);
  coperta(PRUA + 0.01, -11, 1.4);
  // campionatura del bordo (fitta a prua, con i bordi dei portelli)
  const zs = new Set();
  for (let z = PRUA; z <= POPPA; z += 0.5) zs.add(+z.toFixed(3));
  for (let z = PRUA; z < -12; z += 0.12) zs.add(+z.toFixed(3));
  PORTELLI.forEach(([a, b]) => { zs.add(a); zs.add(b); });
  [7, -11].forEach(z => { zs.add(z - 0.001); zs.add(z + 0.001); });
  zs.add(POPPA);
  const Z = [...zs].sort((a, b) => a - b);
  const alto = z => pianoY(z) + 1.1;
  for (const lato of [-1, 1]) {
    const dentro = Z.map(z => [lato * (mezza(z)), z]);
    const fuori = Z.map(z => [lato * (mezza(z) + 0.22), z]);
    // murata interna: interrotta ai portelli (sotto e sopra la bocca del cannone)
    fascia(dentro, p => pianoY(p[1]), p => nelPortello(p[1]) ? pianoY(p[1]) + 0.3 : alto(p[1]), mat.fasciame, lato);
    fascia(dentro, p => nelPortello(p[1]) ? 0.95 : alto(p[1]), p => alto(p[1]), mat.fasciame, lato);
    // fianco esterno fino all'acqua
    fascia(fuori, p => nelPortello(p[1]) ? 0.95 : -3.4, p => alto(p[1]), mat.fasciame, -lato);
    fascia(fuori, () => -3.4, p => nelPortello(p[1]) ? 0.3 : -3.39, mat.fasciame, -lato);
    // capodibanda: la trave in cima
    for (let i = 0; i < Z.length - 1; i++) {
      const za = Z[i], zb = Z[i + 1];
      const xa = lato * (mezza(za) + 0.11), xb = lato * (mezza(zb) + 0.11);
      const a = new THREE.Vector3(xa, alto(za) + 0.06, za), b = new THREE.Vector3(xb, alto(zb) + 0.06, zb);
      if (a.distanceTo(b) < 1e-3) continue;
      const L = a.distanceTo(b);
      const g = new THREE.BoxGeometry(0.34, 0.12, L + 0.02);
      const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0));
      m.setPosition(a.clone().lerp(b, 0.5));
      metti(g, mat.legno, m);
    }
    // costole (scalmi) sulla faccia interna, ogni metro e poco
    for (let z = PRUA + 1.5; z < POPPA - 0.3; z += 1.15) {
      if (nelPortello(z) || Math.abs(z - 7) < 0.2 || Math.abs(z + 11) < 0.2) continue;
      const x = lato * (mezza(z) - 0.06);
      scatola(0.12, 1.1, 0.14, x, pianoY(z) + 0.55, z, mat.legno, -lato * Math.atan2(mezza(z + 0.1) - mezza(z - 0.1), 0.2));
    }
  }
  // specchio di poppa
  const wp = mezza(POPPA);
  scatola(wp * 2 + 0.44, 1.1 + 1.6 + 3.4, 0.22, 0, (-3.4 + 2.7) / 2, POPPA + 0.11, mat.fasciame);
  scatola(wp * 2 + 0.5, 0.14, 0.4, 0, 2.77, POPPA + 0.1, mat.legno);
  // fronte del cassero e del castello
  scatola(8.6, 1.6, 0.2, 0, 0.8, 7.0, mat.fasciame);
  scatola(2 * mezza(-11) + 0.1, 1.4, 0.2, 0, 0.7, -11, mat.fasciame);
  // sotto la coperta: scafo chiuso (il fondo si vede solo dall'acqua)
}

// ringhiera a balaustri
function ringhiera(x0, x1, z, y, h = 0.9, passo = 0.28) {
  scatola(x1 - x0, 0.1, 0.16, (x0 + x1) / 2, y + h, z, mat.legno);
  scatola(x1 - x0, 0.08, 0.12, (x0 + x1) / 2, y + 0.08, z, mat.legno);
  for (let x = x0 + passo / 2; x < x1; x += passo) {
    metti(new THREE.LatheGeometry([[0.0, 0], [0.05, 0], [0.05, 0.1], [0.035, 0.2], [0.06, 0.45], [0.035, 0.7], [0.05, h - 0.1], [0.0, h - 0.05]].map(p => new THREE.Vector2(p[0], p[1])), 6), mat.legno, M4(x, y, z));
  }
}
function scala(x, z0, z1, y0, y1, larg) {
  const n = Math.round((y1 - y0) / 0.27);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    scatola(larg, 0.06, (z1 - z0) / n * 1.3, x, y0 + (y1 - y0) * (i + 1) / n - 0.03, z0 + (z1 - z0) * t, mat.legno);
  }
  const lung = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y1 - y0, z1 - z0);
  for (const s of [-1, 1]) scatola(0.08, 0.3, lung, x + s * larg / 2, (y0 + y1) / 2 + 0.05, (z0 + z1) / 2, mat.legno, 0, -ang);
}

function sovrastrutture() {
  // ringhiera sul bordo del cassero, con l'apertura per la scala
  ringhiera(-mezza(7) + 0.1, SCALA_CASS.x0, 7.05, 1.6);
  ringhiera(SCALA_CASS.x1, mezza(7) - 0.1, 7.05, 1.6);
  scala(0, SCALA_CASS.z0, SCALA_CASS.z1, 0, 1.6, 2.2);
  // castello di prua: ringhiera e due scalette
  const w = mezza(-11) - 0.1;
  ringhiera(-w, -3.1, -11.05, 1.4); ringhiera(-2.1, 2.1, -11.05, 1.4); ringhiera(3.1, w, -11.05, 1.4);
  for (const x of SCALE_CASTELLO) scala(x, -9.6, -11, 0, 1.4, 0.9);
}

function albero(z, y0, h, rBase) {
  const hBasso = h * 0.58;
  cilindro(rBase, rBase * 0.72, hBasso, 0, y0 + hBasso / 2, z, mat.legno, 0, 0, 0, 12);
  // la coffa
  scatola(2.4, 0.16, 1.8, 0, y0 + hBasso - 0.3, z + 0.1, mat.tavole);
  scatola(0.3, 0.5, 0.8, 0, y0 + hBasso - 0.6, z - 0.2, mat.legno);
  const hAlto = h - hBasso + 1.5;
  cilindro(rBase * 0.55, rBase * 0.3, hAlto, 0, y0 + hBasso - 1.5 + hAlto / 2, z - 0.35, mat.legno, 0, 0, 0, 10);
  scatola(0.9, 0.1, 0.7, 0, y0 + h * 0.86, z - 0.35, mat.legno);   // crocette
  cilindro(0.1, 0.07, 0.3, 0, y0 + h + 0.15, z - 0.35, mat.legno);  // pomo
  return { z, y0, h, hBasso, testa: new THREE.Vector3(0, y0 + hBasso - 0.4, z), cima: new THREE.Vector3(0, y0 + h, z - 0.35) };
}
function pennone(z, y, L, r = 0.14) {
  asta(new THREE.Vector3(-L / 2, y, z - 0.45), new THREE.Vector3(0, y, z - 0.45), r * 0.45, r);
  asta(new THREE.Vector3(0, y, z - 0.45), new THREE.Vector3(L / 2, y, z - 0.45), r, r * 0.45);
}
// vela quadra gonfia: dal pennone di sopra (larghezza Ls) a quello di sotto (Li)
function velaQuadra(z, ys, Ls, yi, Li, gonfio, sfasa = 0) {
  const nu = 12, nv = 8, pos = [], uv = [], idx = [];
  const P = (u, v) => {
    const L = Ls + (Li - Ls) * v;
    const x = (u - 0.5) * L;
    const y = ys + (yi - ys) * v;
    const b = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.15)) * gonfio;
    return [x, y, z - 0.5 - b + sfasa * v];
  };
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { pos.push(...P(i / nu, j / nv)); uv.push(i / nu * 2, j / nv * 2); }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = (i + 1) * (nv + 1) + j;
    idx.push(a, b + 1, b, a, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  metti(g, mat.vela);
}
// vela serrata sul pennone: un rotolo bitorzoluto
function velaSerrata(z, y, L) {
  for (let i = 0; i < 9; i++) {
    const x = (i / 8 - 0.5) * L * 0.85;
    const r = 0.26 * (1 - Math.abs(i / 8 - 0.5) * 1.1);
    const g = new THREE.SphereGeometry(r, 8, 5); g.scale(L / 7, 1, 1);
    metti(g, mat.vela, M4(x, y - 0.25, z - 0.35));
  }
}

// ─────────────────────────── oggetti sul ponte ───────────────────────────
const ostacoli = [];   // cerchi {x, z, r, y0, y1}
function blocca(x, z, r, y = 0) { ostacoli.push({ x, z, r, y }); }

function cannone(lato, z) {
  const y = 0, x = lato * (mezza(z) - 1.05);
  const rot = lato > 0 ? -Math.PI / 2 : Math.PI / 2;  // la volata esce dal portello
  const m = M4(x, y, z, 0, rot);
  const add = (g, mm) => metti(g, mm, m.clone().multiply(g.userData.m || new THREE.Matrix4()));
  // affusto: due fiancate a gradini, assali, ruote
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const g = new THREE.BoxGeometry(0.1, 0.5 - k * 0.12, 0.42); g.translate(s * 0.28, 0.25 + 0.2 - k * 0.06, -0.3 + k * 0.4);
      add(g, mat.legno);
    }
    for (const zz of [-0.45, 0.45]) {
      const g = new THREE.CylinderGeometry(0.17, 0.17, 0.08, 10); g.rotateZ(Math.PI / 2); g.translate(s * 0.38, 0.17, zz);
      add(g, mat.legno);
    }
  }
  const asse = new THREE.BoxGeometry(0.8, 0.1, 0.12);
  add(asse.clone().translate(0, 0.17, -0.45), mat.legno); add(asse.clone().translate(0, 0.17, 0.45), mat.legno);
  // canna al tornio
  const prof = [[0, -0.95], [0.12, -0.95], [0.16, -0.85], [0.2, -0.8], [0.21, -0.3], [0.2, 0.1], [0.17, 0.2], [0.16, 1.1], [0.19, 1.15], [0.19, 1.25], [0.12, 1.25], [0.1, 1.2], [0, 1.2]];
  const canna = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 12);
  canna.rotateX(-Math.PI / 2 + 0.04); canna.translate(0, 0.62, -0.1);
  add(canna, mat.ferro);
  blocca(x, z, 0.85);
}
function barile(x, y, z, sdraiato = 0) {
  const prof = [[0, 0], [0.3, 0], [0.34, 0.08], [0.38, 0.3], [0.395, 0.5], [0.38, 0.7], [0.34, 0.92], [0.3, 1.0], [0, 1.0]];
  const g = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 14);
  if (sdraiato) { g.translate(0, -0.5, 0); g.rotateZ(Math.PI / 2); g.rotateY(sdraiato); g.translate(0, 0.4, 0); }
  metti(g, mat.doghe, M4(x, y, z));
  // cerchi di ferro
  for (const h of [0.12, 0.88]) {
    const c = new THREE.TorusGeometry(sdraiato ? 0.36 : 0.345, 0.025, 4, 14);
    if (sdraiato) { c.rotateY(Math.PI / 2); c.translate(h - 0.5, 0.4, 0); c.rotateY(sdraiato); }
    else { c.rotateX(Math.PI / 2); c.translate(0, h, 0); }
    metti(c, mat.ferro, M4(x, y, z));
  }
  blocca(x, z, 0.45, y);
}
function cassa(x, y, z, s = 0.75, ry = 0) {
  scatola(s, s * 0.8, s, x, y + s * 0.4, z, mat.fasciame, ry);
  for (const k of [-1, 1]) scatola(s + 0.02, 0.06, 0.08, x, y + s * 0.4 + k * s * 0.25, z, mat.legno, ry);
  blocca(x, z, s * 0.6, y);
}
function rotolo(x, y, z, r = 0.45) {
  for (let i = 0; i < 4; i++) {
    const g = new THREE.TorusGeometry(r - i * 0.07, 0.045, 5, 18); g.rotateX(Math.PI / 2);
    metti(g, mat.legno, M4(x, y + 0.05 + i * 0.07, z));
  }
}
function lanterna(x, y, z, forza = 14, raggio = 12) {
  scatola(0.2, 0.28, 0.2, x, y, z, mat.ferro);
  scatola(0.16, 0.2, 0.16, x, y, z, mat.lume);  // il vetro acceso
  cilindro(0.12, 0.02, 0.12, x, y + 0.2, z, mat.ferro);
  const l = new THREE.PointLight(0xffffff, forza, raggio, 1.5);
  l.position.set(x, y - 0.05, z);
  scene.add(l);
  return l;
}

function arredi() {
  CANNONI_Z.forEach(z => { cannone(-1, z); cannone(1, z); });
  // grata del boccaporto di prua
  scatola(2.2, 0.35, 2.2, 0, 0.175, -6.3, mat.legno);
  scatola(1.9, 0.04, 1.9, 0, 0.37, -6.3, mat.grata);
  blocca(0, -6.3, 1.4);
  // boccaporto aperto: il vano scende nel buio, con la scaletta
  const hx = 0.8, hz = 0.9, hc = 3.6;
  scatola(0.12, 0.4, hz * 2 + 0.24, -hx - 0.06, 0.2, hc, mat.legno); scatola(0.12, 0.4, hz * 2 + 0.24, hx + 0.06, 0.2, hc, mat.legno);
  scatola(hx * 2, 0.4, 0.12, 0, 0.2, hc - hz - 0.06, mat.legno); scatola(hx * 2, 0.4, 0.12, 0, 0.2, hc + hz + 0.06, mat.legno);
  scatola(hx * 2, 0.02, hz * 2, 0, -2.4, hc, mat.scuro);
  for (const s of [-1, 1]) scatola(0.02, 2.4, hz * 2, s * hx, -1.2, hc, mat.scuro);
  scatola(hx * 2, 2.4, 0.02, 0, -1.2, hc - hz, mat.scuro); scatola(hx * 2, 2.4, 0.02, 0, -1.2, hc + hz, mat.scuro);
  scala(0, hc + 0.8, hc - 0.6, -2.4, 0.05, 0.9);
  blocca(0, hc, 1.25);
  // argano, sul cassero
  const za = 9.4, ya = 1.6;
  metti(new THREE.LatheGeometry([[0, 0], [0.55, 0], [0.5, 0.15], [0.38, 0.25], [0.34, 0.7], [0.45, 0.8], [0.5, 0.95], [0, 0.95]].map(p => new THREE.Vector2(p[0], p[1])), 14), mat.legno, M4(0, ya, za));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.3;
    scatola(1.5, 0.07, 0.09, Math.cos(a) * 0.85, ya + 0.88, za + Math.sin(a) * 0.85, mat.legno, -a);
  }
  blocca(0, za, 1.0, ya);
  // barili e casse attorno all'albero di maestra
  barile(1.3, 0, -1.3); barile(1.95, 0, -0.9); barile(1.6, 1.0, -1.1);
  barile(-2.6, 0, -2.2, 0.3); barile(-2.7, 0, -1.3, 0.3);
  cassa(2.9, 0, 5.5, 0.8, 0.2); cassa(2.8, 0.64, 5.5, 0.6, 0.6); cassa(-3.0, 0, 5.0, 0.8, -0.1);
  rotolo(-1.4, 0, -3.6); rotolo(1.2, 0, 2.6, 0.38);
  // castello: campana con il suo telaio, barili
  scatola(0.12, 1.6, 0.12, -0.6, 2.2, -11.35); scatola(0.12, 1.6, 0.12, 0.6, 2.2, -11.35); scatola(1.4, 0.14, 0.18, 0, 3.0, -11.35);
  metti(new THREE.LatheGeometry([[0, 0], [0.26, 0], [0.24, 0.05], [0.18, 0.2], [0.14, 0.38], [0.08, 0.44], [0, 0.45]].map(p => new THREE.Vector2(p[0], p[1])), 12), mat.ferro, M4(0, 2.45, -11.35));
  barile(2.1, 1.4, -13.5); barile(-2.3, 1.4, -14.2, 1.2);
  rotolo(-1.2, 1.4, -15.2);
  // cassero: ruota del timone, chiesuola, casse
  const zw = 14.2, yw = 1.6;
  scatola(0.25, 1.0, 0.25, 0, yw + 0.5, zw + 0.25, mat.legno); scatola(0.9, 0.35, 0.35, 0, yw + 1.0, zw + 0.25, mat.legno);
  metti(new THREE.TorusGeometry(0.62, 0.045, 5, 24), mat.legno, M4(0, yw + 1.05, zw - 0.05));
  metti(new THREE.TorusGeometry(0.22, 0.05, 5, 16), mat.legno, M4(0, yw + 1.05, zw - 0.05));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    asta(new THREE.Vector3(0, yw + 1.05, zw - 0.05), new THREE.Vector3(Math.cos(a) * 0.86, yw + 1.05 + Math.sin(a) * 0.86, zw - 0.05), 0.035, 0.025, mat.legno, 5);
  }
  blocca(0, zw + 0.1, 0.7, yw);
  scatola(0.6, 1.0, 0.6, 0, yw + 0.5, 12.6, mat.fasciame); cilindro(0.3, 0.3, 0.25, 0, yw + 1.1, 12.6, mat.ferro);
  blocca(0, 12.6, 0.5, yw);
  cassa(-2.8, 1.6, 15.8, 0.8, 0.3); cassa(2.6, 1.6, 9.2, 0.7, -0.2); barile(2.9, 1.6, 10.2);
  // bompresso
  asta(new THREE.Vector3(0, 1.9, -15.5), new THREE.Vector3(0, 6.2, -27.5), 0.34, 0.16);
}

// ─────────────────────────── sartiame (linee) ───────────────────────────
const sartie = [];
function linea(a, b) { sartie.push(a.x, a.y, a.z, b.x, b.y, b.z); }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function sartiame(alberi) {
  for (const al of alberi) {
    // sartie basse con le griselle
    for (const lato of [-1, 1]) {
      const base = [], cima = [];
      for (let k = 0; k < 5; k++) {
        const z = al.z - 0.8 + k * 0.55;
        base.push(V(lato * (mezza(z) + 0.25), pianoY(z) + 0.9, z));
        cima.push(V(lato * 0.35, al.testa.y - 0.2, al.z + (k - 2) * 0.08));
      }
      for (let k = 0; k < 5; k++) linea(base[k], cima[k]);
      const n = Math.floor((al.testa.y - base[0].y) / 0.42);
      for (let j = 1; j < n; j++) {
        const t = j / n;
        for (let k = 0; k < 4; k++) linea(base[k].clone().lerp(cima[k], t), base[k + 1].clone().lerp(cima[k + 1], t));
      }
      // sartie di gabbia: dalla coffa alla testa dell'alberetto
      for (let k = 0; k < 3; k++) {
        const b = V(lato * 1.1, al.testa.y + 0.1, al.z - 0.4 + k * 0.4), c = V(lato * 0.18, al.cima.y - 1.8, al.cima.z);
        linea(b, c);
        for (let j = 1; j < 7; j++) if (k < 2) linea(b.clone().lerp(c, j / 7), V(lato * 1.1, al.testa.y + 0.1, al.z + k * 0.4).lerp(V(lato * 0.18, al.cima.y - 1.8, al.cima.z), j / 7));
      }
      // paterazzi: dalla cima alla murata, più a poppa
      linea(V(lato * 0.15, al.cima.y - 0.4, al.cima.z), V(lato * (mezza(al.z + 3.2) + 0.2), pianoY(al.z + 3.2) + 1.0, al.z + 3.2));
    }
  }
  // stralli: da ogni albero in avanti e in basso
  const [tr, ma, mz] = alberi;
  linea(ma.testa, V(0, tr.y0 + 0.5, tr.z + 0.4)); linea(ma.cima, V(0, tr.testa.y + 2.5, tr.z));
  linea(mz.testa, V(0, ma.y0 + 1.2, ma.z + 0.4)); linea(mz.cima, V(0, ma.testa.y + 3, ma.z));
  linea(tr.testa, V(0, 5.0, -24)); linea(tr.cima, V(0, 6.1, -27.3));
  // fiocchi (vele di prua triangolari, solo il bordo come cima) e la drizza
  linea(V(0, tr.cima.y - 2, tr.z), V(0, 3.2, -22));
}

// alberi e vele
function alberatura() {
  const tr = albero(-13.2, 1.4, 22, 0.36);
  const ma = albero(-2.4, 0, 27, 0.42);
  const mz = albero(11.2, 1.6, 18, 0.3);
  // trinchetto: vela bassa serrata, gabbia a vento
  pennone(tr.z, tr.y0 + 10.5, 13); velaSerrata(tr.z, tr.y0 + 10.5, 13);
  pennone(tr.z, tr.y0 + 16.8, 10); pennone(tr.z, tr.y0 + 21, 6.5);
  velaQuadra(tr.z - 0.05, tr.y0 + 16.6, 9.4, tr.y0 + 10.9, 12.4, 1.3);
  // maestra: gabbia e velaccio a vento, maestra serrata
  pennone(ma.z, ma.y0 + 12.3, 15.4); velaSerrata(ma.z, ma.y0 + 12.3, 15.4);
  pennone(ma.z, ma.y0 + 19.6, 11.5); pennone(ma.z, ma.y0 + 25.3, 7.4);
  velaQuadra(ma.z - 0.05, ma.y0 + 19.4, 10.8, ma.y0 + 12.7, 14.6, 1.6);
  velaQuadra(ma.z - 0.05, ma.y0 + 25.1, 7.0, ma.y0 + 19.9, 10.8, 1.1);
  // mezzana: pennone e randa (vela aurica tra picco e boma)
  pennone(mz.z, mz.y0 + 8.8, 9.5); velaSerrata(mz.z, mz.y0 + 8.8, 9.5);
  pennone(mz.z, mz.y0 + 14.2, 7);
  const bomaA = V(0, mz.y0 + 2.4, mz.z + 0.3), bomaB = V(0, mz.y0 + 2.2, POPPA + 3.5);
  const piccoA = V(0, mz.y0 + 8.2, mz.z + 0.3), piccoB = V(0, mz.y0 + 11.5, POPPA + 1.2);
  asta(bomaA, bomaB, 0.13, 0.09); asta(piccoA, piccoB, 0.11, 0.07);
  {
    const pos = [], uv = [], nu = 8, nv = 8;
    const P = (u, v) => {
      const alto = piccoA.clone().lerp(piccoB, u), basso = bomaA.clone().lerp(bomaB, u);
      const p = basso.lerp(alto, v);
      p.x += Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * 0.8;
      return p;
    };
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const q = [[i / nu, j / nv], [(i + 1) / nu, j / nv], [(i + 1) / nu, (j + 1) / nv], [i / nu, (j + 1) / nv]];
      for (const k of [0, 1, 2, 0, 2, 3]) { const p = P(...q[k]); pos.push(p.x, p.y, p.z); uv.push(q[k][0] * 2, q[k][1] * 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    metti(g, mat.vela);
  }
  [tr, ma, mz].forEach(a => blocca(0, a.z, 0.6, a.y0));
  sartiame([tr, ma, mz]);
  // mantigli e bracci dei pennoni: dalle varee all'albero
  for (const [al, ys] of [[tr, [10.5, 16.8]], [ma, [12.3, 19.6]], [mz, [8.8]]]) {
    for (const y of ys) {
      const L = y === 10.5 ? 13 : y === 16.8 ? 10 : y === 12.3 ? 15.4 : y === 19.6 ? 11.5 : 9.5;
      for (const s of [-1, 1]) {
        linea(V(s * L / 2, al.y0 + y, al.z - 0.45), V(s * 0.3, al.y0 + y + 3.2, al.z - 0.3));
        linea(V(s * L / 2, al.y0 + y, al.z - 0.45), V(s * (mezza(al.z + 6) + 0.1), pianoY(al.z + 6) + 1.1, Math.min(POPPA - 0.5, al.z + 6)));
      }
    }
  }
  return { tr, ma, mz };
}

// ─────────────────────────── mare e cielo ───────────────────────────
function mare() {
  const g = new THREE.PlaneGeometry(700, 700, 220, 220);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = 0.35 * Math.sin(x * 0.21 + z * 0.13) + 0.22 * Math.sin(x * -0.11 + z * 0.37 + 1.3) + 0.12 * Math.sin(x * 0.63 + z * 0.51 + 2.1) + 0.06 * Math.sin(x * 1.3 - z * 0.9);
    p.setY(i, -2.7 + y);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: 0x0c0c0c, specular: 0xffffff, shininess: 140 }));
  m.receiveShadow = true;
  m.userData.flag = 0.5;
  return m;
}
function cielo(dirLuna) {
  const pos = [];
  for (let i = 0; i < 1400; i++) {
    const u = rnd(), v = rnd();
    const th = u * Math.PI * 2, ph = Math.acos(1 - v * 0.95);    // solo sopra l'orizzonte
    const d = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    if (d.y < 0.04) continue;
    pos.push(d.x * 600, d.y * 600, d.z * 600);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const stelle = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1, sizeAttenuation: false }));
  stelle.layers.set(STRATO_CIELO);
  scene.add(stelle);
  // luna e alone
  const luna = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  luna.position.copy(dirLuna).multiplyScalar(560); luna.lookAt(0, 0, 0);
  luna.layers.set(STRATO_CIELO); scene.add(luna);
  const alone = new THREE.Mesh(new THREE.CircleGeometry(140, 48), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vec3(pow(max(0.0, 1.0 - r), 3.0) * 0.55), 1.0); }',
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  alone.position.copy(dirLuna).multiplyScalar(580); alone.lookAt(0, 0, 0);
  alone.layers.set(STRATO_CIELO); scene.add(alone);
}

// ─────────────────────────── le figure ───────────────────────────
// Il ricordo: un colpo di pistola, un uomo che cade all'indietro, un altro già a terra con un
// compagno in ginocchio accanto, uno scontro di sciabole a prua, e chi alza la lanterna per vedere.
const SCENA = [
  // posa, x, y, z, rotazione, oppure verso chi guarda
  ['spara', 2.2, 0, 2.3, null, 'colpito'],
  ['colpito', -1.5, 0, 3.3, null, 'spara'],
  ['lanterna', -3.1, 0, 1.2, null, 'colpito'],
  ['accucciato', 2.7, 0, -1.9, -2.2],
  ['morto', 1.5, 0, -8.5, 2.6],
  ['inginocchiato', 0.7, 0, -9.3, null, 'morto'],
  ['fendente', 1.6, 1.4, -14.7, null, 'cade'],
  ['cade', -0.3, 1.4, -15.5, null, 'fendente'],
  ['indica', -2.1, 1.6, 9.2, 3.0],
]

async function figure() {
  const g = await new GLTFLoader().loadAsync('assets/figure.glb');
  const pose = {}, mani = {};
  g.scene.traverse(o => {
    if (o.isMesh && o.name.startsWith('posa_')) pose[o.name.slice(5)] = o;
    else if (o.name.startsWith('mano_')) mani[o.name.slice(5)] = o;
  });
  g.scene.updateMatrixWorld(true);
  const posti = {};
  for (const [nome, x, y, z] of SCENA) posti[nome] = new THREE.Vector3(x, y, z);
  // ?pose: tutte le pose in fila sul ponte, per sceglierle
  const elenco = Q.has('pose') ? Object.keys(pose).map((n, i) => [n, -3.4 + (i % 5) * 1.7, 0, i < 5 ? -1 : 2.2, 0.5]) : SCENA;
  for (const [nome, x, y, z, rot, verso] of elenco) {
    const m = pose[nome];
    if (!m) continue;
    const f = new THREE.Group();
    const corpo = new THREE.Mesh(m.geometry, mat.figura);
    corpo.castShadow = corpo.receiveShadow = true;
    f.add(corpo);
    let r = rot;
    if (verso && posti[verso]) { const d = posti[verso].clone().sub(posti[nome]); r = Math.atan2(d.x, d.z); }
    f.position.set(x, y, z); f.rotation.y = r;
    scene.add(f);
    blocca(x, z, nome === 'morto' ? 0.9 : 0.45, y);
    // oggetti in mano
    const mano = mani[nome];
    if (mano) {
      const og = new THREE.Group();
      mano.matrixWorld.decompose(og.position, og.quaternion, og.scale);
      og.scale.setScalar(1);
      if (nome === 'spara') {
        const canna = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.3, 6), mat.ferro); canna.position.set(0, 0.12, 0.03);
        const calcio = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), mat.legno); calcio.position.set(0, -0.02, 0.02); calcio.rotation.x = 0.8;
        og.add(canna, calcio);
      } else if (nome === 'fendente') {
        const lama = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.8, 0.045), mat.ferro); lama.position.set(0, 0.5, 0);
        const elsa = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.14), mat.ferro); elsa.position.set(0, 0.1, 0);
        og.add(lama, elsa);
      } else if (nome === 'lanterna') {
        const lt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), mat.lume); lt.position.set(0, 0.18, 0);
        og.add(lt);
        const l = new THREE.PointLight(0xffffff, 16, 13, 1.4); l.position.set(0, 0.18, 0); og.add(l);
      }
      og.traverse(o => { if (o.isMesh) o.castShadow = true; });
      if (og.children.length) f.add(og);
    }
  }
  // il fumo dello sparo, fermo nell'aria, e la sua scia
  const fumo = new THREE.Group();
  const da = posti.spara.clone().add(V(0, 1.45, 0)), a = posti.colpito.clone().add(V(0, 1.3, 0));
  const dir = a.clone().sub(da).normalize();
  // una nuvola che si allarga a cono dalla bocca della pistola
  for (let i = 0; i < 14; i++) {
    const t = rnd();
    const r = 0.04 + t * 0.13 + rnd() * 0.05;
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat.vela);
    const spargi = 0.05 + t * 0.28;
    s.position.copy(da).addScaledVector(dir, 0.65 + t * 0.9).add(V((rnd() - 0.5) * spargi * 2, (rnd() - 0.35) * spargi * 1.6, (rnd() - 0.5) * spargi * 2));
    s.scale.set(1 + rnd() * 0.5, 0.8 + rnd() * 0.4, 1 + rnd() * 0.5);
    fumo.add(s);
  }
  scene.add(fumo);
}

// ─────────────────────────── luci ───────────────────────────
const dirLuna = new THREE.Vector3(0.55, 0.42, -0.72).normalize();
const luna = new THREE.DirectionalLight(0xffffff, 2.6);
luna.position.copy(dirLuna).multiplyScalar(60);
luna.castShadow = true;
luna.shadow.mapSize.set(2048, 2048);
Object.assign(luna.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 });
luna.shadow.bias = -0.0006;
luna.shadow.normalBias = 0.03;
scene.add(luna, luna.target);
scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 0.12));

// ─────────────────────────── materiali della passata "spigoli" ───────────────────────────
const matNorm = new THREE.ShaderMaterial({
  uniforms: { uFlag: { value: 1 } },
  vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform float uFlag; varying vec3 vN; void main(){ vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; gl_FragColor = vec4(n * 0.5 + 0.5, uFlag); }',
  side: THREE.DoubleSide,
});
const matNormMare = matNorm.clone(); matNormMare.uniforms.uFlag.value = 0.5; matNormMare.side = THREE.FrontSide;
const matSartie = new THREE.ShaderMaterial({
  vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.5, 0.5, 1.0, 0.0); }',
});

// ─────────────────────────── composizione finale ───────────────────────────
const PALETTE = [
  ['Macintosh', 0x333319, 0xe5ffff],
  ['IBM 5151 · fosforo verde', 0x25342f, 0x01eb5f],
  ['Zenith ZVM 1240 · ambra', 0x3f291e, 0xfdca55],
  ['IBM 8503 · grigio', 0x2e3037, 0xebe5ce],
  ['Commodore 1084', 0x40318e, 0x88d7de],
  ['LCD', 0x1b1d1e, 0xa9b39a],
];
let iPal = Math.max(0, Math.min(PALETTE.length - 1, parseInt(Q.get('pal') || '0', 10) || 0));
const texBlu = new THREE.TextureLoader().load('assets/rumore-blu.png', t => { t.needsUpdate = true; });
texBlu.wrapS = texBlu.wrapT = THREE.RepeatWrapping;
texBlu.minFilter = texBlu.magFilter = THREE.NearestFilter; texBlu.generateMipmaps = false;
texBlu.colorSpace = THREE.NoColorSpace;

const composito = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: {
    tLuce: { value: rtLuce.texture }, tNorm: { value: rtNorm.texture }, tDepth: { value: rtNorm.depthTexture },
    tBlu: { value: texBlu }, uLow: { value: LOW }, uInvPV: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() },
    uK: { value: 1 }, uNear: { value: camera.near }, uFar: { value: camera.far },
    uScuro: { value: new THREE.Color() }, uChiaro: { value: new THREE.Color() }, uEsp: { value: 1.0 },
  },
  vertexShader: 'out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tLuce, tNorm, tDepth, tBlu;
    uniform vec2 uLow; uniform mat4 uInvPV; uniform vec3 uCam; uniform float uK, uNear, uFar, uEsp;
    uniform vec3 uScuro, uChiaro;
    in vec2 vUv;
    out vec4 colore;
    float invZ(ivec2 p) {                      // 1/profondità: varia in modo lineare sui piani
      float d = texelFetch(tDepth, p, 0).r;
      float z = uNear * uFar / (uFar - d * (uFar - uNear));
      return 1.0 / z;
    }
    void main() {
      ivec2 p = ivec2(floor(vUv * uLow));
      ivec2 mx = ivec2(uLow) - 1;
      vec3 lr = texelFetch(tLuce, p, 0).rgb;
      float l = dot(lr, vec3(0.3333));
      l = smoothstep(0.06, 0.9, clamp(l * uEsp, 0.0, 1.0));

      // soglia: rumore blu incollato alle direzioni del mondo (cubemap attorno alla camera)
      vec2 ndc = (vec2(p) + 0.5) / uLow * 2.0 - 1.0;
      vec4 w = uInvPV * vec4(ndc, 1.0, 1.0);
      vec3 d = normalize(w.xyz / w.w - uCam);
      vec3 a = abs(d);
      vec2 f; float faccia;
      if (a.x >= a.y && a.x >= a.z) { f = d.zy / a.x; faccia = d.x > 0.0 ? 0.0 : 1.0; }
      else if (a.y >= a.z)          { f = d.xz / a.y; faccia = d.y > 0.0 ? 2.0 : 3.0; }
      else                          { f = d.xy / a.z; faccia = d.z > 0.0 ? 4.0 : 5.0; }
      vec2 tc = f * uK / 64.0 + faccia * vec2(0.37, 0.61);
      float soglia = texture(tBlu, tc).r;
      bool acceso = l > soglia;

      // spigoli: normali, salti di profondità, sartiame
      vec4 nC = texelFetch(tNorm, p, 0);
      bool linea = nC.a < 0.25;
      if (!linea) {
        ivec2 pr = min(p + ivec2(1, 0), mx), pu = min(p + ivec2(0, 1), mx), pl = max(p - ivec2(1, 0), ivec2(0)), pd = max(p - ivec2(0, 1), ivec2(0));
        vec4 nR = texelFetch(tNorm, pr, 0), nU = texelFetch(tNorm, pu, 0);
        float dC = texelFetch(tDepth, p, 0).r;
        bool mareC = abs(nC.a - 0.5) < 0.1;
        if (dC < 1.0) {
          float wC = invZ(p);
          float wl = invZ(pl), wr = invZ(pr), wd = invZ(pd), wu = invZ(pu);
          float lapX = wl + wr - 2.0 * wC, lapY = wd + wu - 2.0 * wC;
          // lato vicino di un salto di profondità; una piega vista di taglio ha pendenza forte
          // da tutti e due i lati, un salto vero da uno solo: così le pieghe non fanno linea
          float gX = min(abs(wl - wC), abs(wr - wC)), gY = min(abs(wd - wC), abs(wu - wC));
          if (!mareC && (lapX < -0.1 * wC - 3.0 * gX || lapY < -0.1 * wC - 3.0 * gY)) linea = true;
          if (mareC && (texelFetch(tDepth, pu, 0).r >= 1.0)) linea = true;     // l'orizzonte
          // piega fra superfici (non sul mare)
          if (!mareC) {
            vec3 n0 = nC.xyz * 2.0 - 1.0;
            if (abs(nR.a - 0.5) > 0.1 && texelFetch(tDepth, pr, 0).r < 1.0 && dot(n0, nR.xyz * 2.0 - 1.0) < 0.72) linea = true;
            if (abs(nU.a - 0.5) > 0.1 && texelFetch(tDepth, pu, 0).r < 1.0 && dot(n0, nU.xyz * 2.0 - 1.0) < 0.72) linea = true;
          }
          // dove la nave tocca il mare
          if (!mareC && (abs(nR.a - 0.5) < 0.1 || abs(nU.a - 0.5) < 0.1)) linea = true;
        }
      }
      vec3 c = acceso ? uChiaro : uScuro;
      // il contorno prende il colore opposto alla luce del punto: bianco nel buio, nero nel chiaro
      if (linea) c = l > 0.45 ? uScuro : uChiaro;
      colore = vec4(c, 1.0);
    }`,
  depthTest: false, depthWrite: false,
}));
composito.frustumCulled = false;
const scenaComp = new THREE.Scene(); scenaComp.add(composito);
const camComp = new THREE.Camera();

function applicaPalette() {
  const [, s, c] = PALETTE[iPal];
  composito.material.uniforms.uScuro.value.setHex(s);
  composito.material.uniforms.uChiaro.value.setHex(c);
  document.body.style.background = '#' + s.toString(16).padStart(6, '0');
}
applicaPalette();
const cartellino = document.createElement('div');
Object.assign(cartellino.style, { position: 'fixed', left: '18px', bottom: '16px', font: '600 13px/1 "Courier New", monospace', padding: '7px 10px', letterSpacing: '0.06em', transition: 'opacity .6s', opacity: 0, pointerEvents: 'none', zIndex: 900 });
document.body.append(cartellino);
let tCartellino = 0;
function mostraPalette() {
  const [n, s, c] = PALETTE[iPal];
  cartellino.textContent = n.toUpperCase();
  cartellino.style.color = '#' + c.toString(16).padStart(6, '0');
  cartellino.style.background = '#' + s.toString(16).padStart(6, '0');
  cartellino.style.border = '1px solid #' + c.toString(16).padStart(6, '0');
  cartellino.style.opacity = 1; tCartellino = 2.2;
}

// ─────────────────────────── costruzione ───────────────────────────
const conMateriale = [];   // mesh a cui scambiare il materiale per la passata degli spigoli
try {
  Demo.carica('Varo la nave', 0.2);
  if (Q.has('pose')) coperta(-11, 7, 0);
  else { scafo(); sovrastrutture(); arredi(); alberatura(); }
  for (const [m, geos] of pezzi) {
    const g = mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = m !== mat.lume; mesh.receiveShadow = m !== mat.vela;
    scene.add(mesh);
  }
  lanterna(0.9, 1.6 + 2.2, 12.8);          // appesa sotto la mezzana
  lanterna(0, 2.9, -1.95);                 // appesa all'albero di maestra, sopra la scena
  lanterna(-0.9, 2.75, 7.35, 8, 10);       // appesa alla ringhiera del cassero
  lanterna(2.8, 1.28, 5.5, 5, 7);          // posata sulle casse
  lanterna(-0.8, 1.4 + 2.3, -13.6);        // a prua, all'albero di trinchetto
  lanterna(0, 2.75 + 0.25, POPPA + 0.05);  // il fanale di poppa
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(sartie, 3));
  const cime = new THREE.LineSegments(lg, matSartie);
  cime.layers.set(STRATO_SARTIAME);
  scene.add(cime);
  scene.add(mare());
  cielo(dirLuna);
  Demo.carica('Richiamo il ricordo', 0.6);
  await figure();
  scene.traverse(o => { if (o.isMesh && o.layers.isEnabled(0) && !o.layers.isEnabled(STRATO_CIELO)) conMateriale.push(o); });
  Demo.extra(`<h4>Tasti</h4><p><b>H</b> cambia i due colori (Macintosh, fosforo verde, ambra, grigio, Commodore, LCD) · clic per catturare il mouse, <b>Esc</b> per liberarlo</p>
    <h4>Il retino che non sfarfalla</h4><p>Il rumore blu che decide quale pixel è bianco non è steso sullo schermo ma su un cubo attorno alla testa,
    orientato come il mondo: girandosi, i puntini restano attaccati al cielo e alle vele invece di strisciare sullo schermo. I contorni vengono
    da tre prove: un salto di profondità, una piega fra due superfici, oppure il sartiame, che è disegnato solo come linea.</p>`);
} catch (e) { Demo.errore(e); throw e; }

// ─────────────────────────── movimento ───────────────────────────
const pl = { x: -2.0, z: 8.1, yaw: -0.25, pitch: 0.0, y: 1.6 };
const INQ = {
  1: { x: 3.3, z: -5.0, yaw: 2.2, pitch: 0.02 },          // tra i cannoni, verso l'uomo che spara
  2: { x: 0.5, z: -10.4, yaw: 3.0, pitch: 0.35 },          // dal castello verso poppa, in alto le vele
  3: { x: -3.2, z: 4.6, yaw: 0.9, pitch: -0.1 },           // l'uomo in ginocchio
  4: { x: 1.2, z: 16.2, yaw: 0.0, pitch: 0.0 },            // da poppa, tutta la nave
  7: { x: -2.6, z: 8.4, yaw: -0.22, pitch: 0.1 },          // dal cassero
  9: { x: 0, z: 7.4, yaw: 0, pitch: -0.2 },
  5: { x: -3.4, z: 3.0, yaw: -0.55, pitch: 0.12 },
  6: { x: 0.3, z: 3.2, yaw: -0.5, pitch: -0.05 },
};
if (INQ[Q.get('cam')]) Object.assign(pl, INQ[Q.get('cam')]);
function pavimento(x, z) {
  if (z >= SCALA_CASS.z0 && z <= SCALA_CASS.z1 && x > SCALA_CASS.x0 && x < SCALA_CASS.x1) return (z - SCALA_CASS.z0) / (SCALA_CASS.z1 - SCALA_CASS.z0) * 1.6;
  for (const sx of SCALE_CASTELLO) if (z <= -9.6 && z >= -11.2 && Math.abs(x - sx) < 0.45) return Math.min(1.4, (-9.6 - z) / 1.4 * 1.4);
  return pianoY(z);
}
pl.y = pavimento(pl.x, pl.z);
let mouseX = 0, mouseY = 0;
renderer.domElement.addEventListener('click', () => { if (!Demo.shot) renderer.domElement.requestPointerLock?.(); });
addEventListener('mousemove', e => { if (document.pointerLockElement === renderer.domElement) { mouseX += e.movementX; mouseY += e.movementY; } });

function libero(x, z, y) {
  if (z < PRUA + 2.2 || z > POPPA - 0.5) return false;
  if (Math.abs(x) > mezza(z) - 0.45) return false;
  const yN = pavimento(x, z);
  if (Math.abs(yN - y) > 0.45) return false;
  for (const o of ostacoli) if (Math.abs(o.y - yN) < 1 && Math.hypot(o.x - x, o.z - z) < o.r + 0.3) return false;
  return true;
}

const eul = new THREE.Euler(0, 0, 0, 'YXZ');
const invPV = new THREE.Matrix4();
Demo.loop((dt, t) => {
  const g = Demo.guarda();
  pl.yaw -= mouseX * 0.0022 + g.x * 2.2 * dt;
  pl.pitch = Math.max(-1.3, Math.min(1.35, pl.pitch - mouseY * 0.0022 + g.y * 1.8 * dt));
  mouseX = mouseY = 0;
  if (Demo.premuto('h')) { iPal = (iPal + 1) % PALETTE.length; applicaPalette(); mostraPalette(); }
  tCartellino -= dt; if (tCartellino < 0) cartellino.style.opacity = 0;

  const a = Demo.asse();
  const v = (Demo.giu('Shift') ? 4.5 : 2.4) * dt;
  const sx = Math.sin(pl.yaw), cz = Math.cos(pl.yaw);
  const dx = (-sx * a.y + cz * a.x) * v, dz = (-cz * a.y - sx * a.x) * v;
  if (libero(pl.x + dx, pl.z + dz, pl.y)) { pl.x += dx; pl.z += dz; }
  else if (libero(pl.x + dx, pl.z, pl.y)) pl.x += dx;
  else if (libero(pl.x, pl.z + dz, pl.y)) pl.z += dz;
  pl.y = pavimento(pl.x, pl.z);

  camera.position.set(pl.x, pl.y + 1.62, pl.z);
  eul.set(pl.pitch, pl.yaw, 0);
  camera.quaternion.setFromEuler(eul);
  camera.updateMatrixWorld();

  // 1) luce
  camera.layers.set(0); camera.layers.enable(STRATO_CIELO);
  renderer.setRenderTarget(rtLuce);
  renderer.setClearColor(0x000000, 1); renderer.clear();
  renderer.render(scene, camera);
  // 2) normali e sartiame
  for (const o of conMateriale) { o.userData.m = o.material; o.material = o.userData.flag === 0.5 ? matNormMare : matNorm; }
  camera.layers.set(0); camera.layers.enable(STRATO_SARTIAME);
  const ombre = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(rtNorm);
  renderer.setClearColor(0x8080ff, 1); renderer.clear();
  renderer.render(scene, camera);
  renderer.shadowMap.autoUpdate = ombre;
  for (const o of conMateriale) o.material = o.userData.m;
  // 3) composizione a schermo
  const u = composito.material.uniforms;
  invPV.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  u.uInvPV.value.copy(invPV); u.uCam.value.copy(camera.position);
  u.uK.value = LOW.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  renderer.setRenderTarget(null);
  renderer.render(scenaComp, camComp);
});
Demo.pronto();
