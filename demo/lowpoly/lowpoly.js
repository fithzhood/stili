// Low poly atmosferico alla Firewatch: una valle di pini a facce piatte, una torretta
// d'avvistamento, e la prospettiva aerea che scioglie i crinali lontani nel colore della foschia.
// Tutto procedurale. Ogni colore della scena (cielo, foschia, prati, rocce, alberi, lago, legno)
// viene da una tavolozza che cambia con l'ora: ↑↓ la fanno scorrere.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Q = Demo.query;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: Demo.shot });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 1, 9000);

// ─────────────────────────── tavolozze ───────────────────────────
// Una tavolozza per momento del giorno; fra un momento e l'altro si interpola.
const T = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? new THREE.Color(v) : v]));
const NOTTE = T({ alto: '#060a20', oriz: '#1a2a50', nebbia: '#182848', nebbiaSole: '#233a66', luce: '#7f98d8', forza: 0.55,
  ambC: '#2a3c68', ambT: '#0c1224', amb: 1.1, prato: '#2c4a4c', roccia: '#3a4866', bosco: '#1f3238', albero: '#10262e', lago: '#0c1c34', legno: '#34323e', dens: 0.0016, bassa: 0.35 });
const TAVOLE = [
  [0.00, NOTTE],
  [0.19, T({ alto: '#121a44', oriz: '#4c4478', nebbia: '#3e3a68', nebbiaSole: '#7a5480', luce: '#9a7ab0', forza: 0.4,
    ambC: '#3a3a72', ambT: '#141030', amb: 1.1, prato: '#3a3c58', roccia: '#4a4868', bosco: '#2a2a44', albero: '#1a1c38', lago: '#2a2c58', legno: '#3a3444', dens: 0.0016, bassa: 0.8 })],
  [0.265, T({ alto: '#4a5c9e', oriz: '#ffb49c', nebbia: '#d9a4b4', nebbiaSole: '#ffd09a', luce: '#ffb488', forza: 1.9,
    ambC: '#8078b8', ambT: '#3a2f4a', amb: 1.2, prato: '#b09a78', roccia: '#a88aa0', bosco: '#6a5a6a', albero: '#3a4262', lago: '#c4a8cc', legno: '#9a6a60', dens: 0.0017, bassa: 0.6 })],
  [0.36, T({ alto: '#4f9ad8', oriz: '#e6e4c4', nebbia: '#c4d8c8', nebbiaSole: '#fff2cc', luce: '#fff0d0', forza: 2.6,
    ambC: '#9ac0d4', ambT: '#5a5a40', amb: 1.15, prato: '#c8c070', roccia: '#b0a898', bosco: '#5a7050', albero: '#355f4c', lago: '#5aa0b4', legno: '#a07850', dens: 0.0012, bassa: 0.45 })],
  [0.50, T({ alto: '#3a8ad6', oriz: '#b4e0e0', nebbia: '#9ccfcc', nebbiaSole: '#e4f4e0', luce: '#fff6e2', forza: 2.9,
    ambC: '#88b8d2', ambT: '#4a5a3a', amb: 1.1, prato: '#cfc45a', roccia: '#aaa496', bosco: '#4f7a4a', albero: '#2c664f', lago: '#2f8aa2', legno: '#a87a4a', dens: 0.0011, bassa: 0.15 })],
  [0.62, T({ alto: '#4886c8', oriz: '#f2d49a', nebbia: '#e2c68e', nebbiaSole: '#ffe0a0', luce: '#ffdca4', forza: 2.6,
    ambC: '#a0a8c4', ambT: '#5a4a3a', amb: 1.1, prato: '#dcae4c', roccia: '#bc9a80', bosco: '#6a6a40', albero: '#35553e', lago: '#5a9aa8', legno: '#b07a48', dens: 0.0012, bassa: 0.25 })],
  [0.71, T({ alto: '#553a7c', oriz: '#ff9450', nebbia: '#ec8c62', nebbiaSole: '#ffba66', luce: '#ff8c44', forza: 2.3,
    ambC: '#8a5c9e', ambT: '#40203e', amb: 1.25, prato: '#e67a38', roccia: '#c46464', bosco: '#7c3c4a', albero: '#3a244a', lago: '#f2925c', legno: '#a45432', dens: 0.0014, bassa: 0.3 })],
  [0.785, T({ alto: '#1c1846', oriz: '#b44c6c', nebbia: '#6c3c6a', nebbiaSole: '#d46262', luce: '#c45464', forza: 0.5,
    ambC: '#4c3c7c', ambT: '#1a1030', amb: 1.15, prato: '#5a3252', roccia: '#5c4262', bosco: '#3c2c4a', albero: '#201a36', lago: '#7c3c5c', legno: '#3c2c3a', dens: 0.0015, bassa: 0.5 })],
  [0.86, NOTTE],
  [1.00, NOTTE],
];
const P = {};   // tavolozza corrente
for (const [k, v] of Object.entries(NOTTE)) P[k] = v.isColor ? v.clone() : v;
function tavolozza(ora) {
  let i = 0; while (i < TAVOLE.length - 2 && TAVOLE[i + 1][0] <= ora) i++;
  const [t0, a] = TAVOLE[i], [t1, b] = TAVOLE[i + 1];
  let f = (ora - t0) / (t1 - t0); f = f * f * (3 - 2 * f);
  for (const k in a) { if (a[k].isColor) P[k].copy(a[k]).lerp(b[k], f); else P[k] = a[k] + (b[k] - a[k]) * f; }
}
/** Direzione del sole: sorge a est (+x), a mezzogiorno è alto a sud, tramonta a ovest (-x). */
function dirSole(ora, out) {
  const p = (ora - 0.25) * Math.PI * 2;
  return out.set(Math.cos(p), Math.sin(p) * 0.82, 0.38 + Math.sin(p) * 0.2).normalize();
}

// ─────────────────────────── uniform condivise ───────────────────────────
const U = {
  uNebbia: { value: new THREE.Color() }, uNebbiaV: { value: new THREE.Color() }, uNebbiaSole: { value: new THREE.Color() },
  uSole: { value: new THREE.Vector3(1, 0, 0) }, uDens: { value: 0.0014 }, uBassa: { value: 0.5 },
  uAlto: { value: new THREE.Color() }, uOriz: { value: new THREE.Color() }, uLuce: { value: new THREE.Color() },
  uNotte: { value: 0 }, uT: { value: 0 },
  uPrato: { value: new THREE.Color() }, uRoccia: { value: new THREE.Color() }, uBosco: { value: new THREE.Color() },
  uLago: { value: new THREE.Color() },
};
const QUOTA_LAGO = 0;
// La prospettiva aerea: la distanza tinge tutto del colore della foschia, più verso il sole
// il colore del sole, e nelle valli basse c'è un velo in più. Il fattore è leggermente
// "a gradini" per dare i piani netti da poster.
const NEBBIA_GLSL = `
uniform vec3 uNebbia, uNebbiaV, uNebbiaSole, uSole; uniform float uDens, uBassa;
vec3 nebbia(vec3 col, vec3 wp){
  vec3 v = wp - cameraPosition; float d = length(v); vec3 vd = v / max(d, 1e-3);
  float f = 1.0 - exp(-pow(d * uDens, 1.75));
  float bassa = exp(-max(wp.y - ${QUOTA_LAGO.toFixed(1)} - 4.0, 0.0) / 38.0);
  f = max(f, (1.0 - exp(-d * uDens * 2.2)) * bassa * uBassa);
  float gradini = floor(f * 9.0 + 0.5) / 9.0;
  f = mix(f, gradini, 0.35);
  float s = pow(max(dot(vd, uSole), 0.0), 5.0);
  // i piani di mezzo prendono una foschia più scura e fredda, quelli lontani la più chiara
  vec3 fc = mix(uNebbiaV, uNebbia, smoothstep(0.25, 0.85, f));
  fc = mix(fc, uNebbiaSole, s * 0.85 * smoothstep(0.2, 0.8, f));
  return mix(col, fc, clamp(f, 0.0, 1.0));
}`;

/** Lambert a facce piatte con la nebbia di prima. */
function materiale(opz = {}) {
  const m = new THREE.MeshLambertMaterial({ flatShading: true, color: opz.color ?? 0xffffff, vertexColors: !!opz.vertexColors, fog: false });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;' + (opz.terreno ? '\nattribute vec3 aTipo; attribute float aVar; varying vec3 vTipo; varying float vVar;' : ''))
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 w = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            w = instanceMatrix * w;
          #endif
          vWP = (modelMatrix * w).xyz; }` + (opz.terreno ? '\nvTipo = aTipo; vVar = aVar;' : ''));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform vec3 uPrato, uRoccia, uBosco;\n' + NEBBIA_GLSL + (opz.terreno ? '\nvarying vec3 vTipo; varying float vVar;' : ''))
      .replace('#include <opaque_fragment>', 'outgoingLight = nebbia(outgoingLight, vWP);\n#include <opaque_fragment>');
    if (opz.terreno) sh.fragmentShader = sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );',
      'vec4 diffuseColor = vec4((vTipo.x * uPrato + vTipo.y * uRoccia + vTipo.z * uBosco) * vVar, opacity);');
  };
  m.customProgramCacheKey = () => 'lp' + (opz.terreno ? 't' : '') + (opz.vertexColors ? 'v' : '');
  return m;
}

// ─────────────────────────── rilievo ───────────────────────────
const perlin = new ImprovedNoise();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function fbm(x, z, ott) { let a = 1, f = 1, s = 0, n = 0; for (let i = 0; i < ott; i++) { s += a * perlin.noise(x * f, 0.37 + i * 7.1, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
function creste(x, z, ott) { let a = 1, f = 1, s = 0, n = 0; for (let i = 0; i < ott; i++) { let v = 1 - Math.abs(perlin.noise(x * f, 11.3 + i * 3.1, z * f) * 1.6); v = Math.max(0, v); s += a * v * v; n += a; a *= 0.5; f *= 2.1; } return s / n; }

const TORRE = new THREE.Vector3(-170, 0, -40);
const LAGO = { x: -30, z: -115, r: 115 };
function quota(x, z) {
  const r = Math.hypot(x, z);
  // conca: la valle al centro, e montagne sempre più alte man mano che ci si allontana
  const conca = smooth(180, 2200, r);
  let h = 14 + conca * 400 * (0.3 + 0.8 * creste(x * 0.0009 + 3, z * 0.0009, 5)) + conca * conca * 110;
  // colline morbide nel fondovalle
  h += (1 - conca) * 38 * fbm(x * 0.004, z * 0.004, 3);
  h += 10 * fbm(x * 0.012, z * 0.012, 2);
  // il lago: una conca poco profonda
  const dl = Math.hypot((x - LAGO.x) / LAGO.r, (z - LAGO.z) / (LAGO.r * 0.7));
  h = h - 30 * (1 - smooth(0.55, 1.25, dl));
  // l'altura della torretta
  const dt = Math.hypot(x - TORRE.x, z - TORRE.z);
  h += 62 * Math.exp(-(dt * dt) / (2 * 62 * 62));
  return h;
}

const EST = 3400, SEG = 330;
function costruisciTerreno() {
  // griglia non uniforme: fitta vicino al centro, larga ai margini (tanto là c'è la foschia)
  const coord = (u) => EST * (0.3 * u + 0.7 * u * u * u);
  const N = SEG + 1;
  const hx = new Float32Array(N * N), px = new Float32Array(N * N), pz = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = coord(i / SEG * 2 - 1), z = coord(j / SEG * 2 - 1), k = j * N + i;
    px[k] = x; pz[k] = z; hx[k] = quota(x, z);
  }
  const tri = SEG * SEG * 2;
  const pos = new Float32Array(tri * 9), tipo = new Float32Array(tri * 9), vari = new Float32Array(tri * 3);
  let t = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const faccia = (k0, k1, k2) => {
    a.set(px[k0], hx[k0], pz[k0]); b.set(px[k1], hx[k1], pz[k1]); c.set(px[k2], hx[k2], pz[k2]);
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
    const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
    // tipo di suolo per faccia: roccia se ripido o alto, bosco dove crescono i pini, prato altrove
    const ripido = smooth(0.80, 0.68, n.y), alto = smooth(260, 420, cy);
    let roccia = Math.max(ripido, alto);
    const bosco = (1 - roccia) * (densitaBosco(cx, cz, cy) > 0.35 ? 1 : 0);
    const prato = Math.max(0, 1 - roccia - bosco);
    const w = [prato, roccia, bosco];
    const v = 0.9 + 0.2 * (Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453 % 1 + 1) % 1;
    for (const [q, p] of [[0, a], [1, b], [2, c]]) {
      pos.set([p.x, p.y, p.z], t * 9 + q * 3); tipo.set(w, t * 9 + q * 3); vari[t * 3 + q] = v;
    }
    t++;
  };
  for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) {
    const k = j * N + i;
    if ((i + j) % 2) { faccia(k, k + N, k + 1); faccia(k + 1, k + N, k + N + 1); }
    else { faccia(k, k + N, k + N + 1); faccia(k, k + N + 1, k + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aTipo', new THREE.BufferAttribute(tipo, 3));
  g.setAttribute('aVar', new THREE.BufferAttribute(vari, 1));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, materiale({ terreno: true }));
  m.receiveShadow = true;
  return m;
}
function densitaBosco(x, z, h) {
  if (h < QUOTA_LAGO + 3 || h > 330) return 0;
  const dT = Math.hypot(x - TORRE.x, z - TORRE.z);
  if (dT < 34) return 0;
  const n = fbm(x * 0.0045 + 20, z * 0.0045, 3) * 0.5 + 0.5;
  return smooth(0.30, 0.52, n) * (1 - smooth(260, 330, h));
}

// ─────────────────────────── pini ───────────────────────────
function geoPino(slanciato) {
  const parti = [];
  const tronco = new THREE.CylinderGeometry(0.28, 0.4, 3, 5, 1, true); tronco.translate(0, 1.5, 0);
  const col = (g, c) => { const k = g.attributes.position.count, arr = new Float32Array(k * 3), cc = new THREE.Color(c);
    for (let i = 0; i < k; i++) arr.set([cc.r, cc.g, cc.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return g; };
  parti.push(col(tronco, '#5a3a2a'));
  const piani = slanciato ? [[2.0, 5.0, 2.2], [1.6, 4.6, 5.0], [1.1, 4.0, 7.6], [0.7, 3.2, 10.0]] : [[2.8, 4.4, 2.0], [2.2, 4.0, 4.4], [1.5, 3.6, 6.7]];
  // solo il palco più basso ha il fondo: gli altri non si vedono mai da sotto, e sono migliaia di triangoli risparmiati
  piani.forEach(([r, h, y], i) => { const c = new THREE.ConeGeometry(r, h, 7, 1, i > 0); c.translate(0, y + h / 2, 0); parti.push(col(c, '#ffffff')); });
  return mergeGeometries(parti.map(p => p.index ? p.toNonIndexed() : p));
}
function costruisciBosco() {
  const specie = [geoPino(false), geoPino(true)];
  const posti = [[], [], [], []];   // due specie × (vicini alla torretta, lontani)
  let r = 12345; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const PASSO = 7.5;
  for (let z = -1500; z < 1500; z += PASSO) for (let x = -1500; x < 1500; x += PASSO) {
    const jx = x + (rnd() - 0.5) * PASSO * 1.3, jz = z + (rnd() - 0.5) * PASSO * 1.3;
    const d = Math.hypot(jx, jz); if (d > 1500) continue;
    const h = quota(jx, jz);
    const dens = densitaBosco(jx, jz, h);
    // più lontano, meno alberi (tanto la foschia li scioglie): si risparmia
    const rada = d < 700 ? 1 : d < 1100 ? 0.55 : 0.3;
    const pend = Math.hypot(quota(jx + 3, jz) - h, quota(jx, jz + 3) - h) / 3;
    const isolati = 0.035 * (h > QUOTA_LAGO + 3 ? 1 : 0);
    if (pend > 0.9 || rnd() > Math.max(dens * 0.85, isolati) * rada) continue;
    const lontano = Math.hypot(jx - TORRE.x, jz - TORRE.z) > 480 ? 2 : 0;
    posti[(rnd() < 0.35 ? 1 : 0) + lontano].push([jx, h - 0.6, jz, 0.75 + rnd() * 0.75, rnd() * 6.28, 0.78 + rnd() * 0.3]);
  }
  const mat = materiale({ vertexColors: true });
  const out = [];
  posti.forEach((lista, s) => {
    const geo = specie[s % 2];
    const im = new THREE.InstancedMesh(geo, mat, lista.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    lista.forEach(([x, y, z, s2, rot, lum], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      sc.set(s2, s2 * (0.9 + (lum - 0.78) * 1.2), s2);
      m4.compose(p.set(x, y, z), q, sc); im.setMatrixAt(i, m4);
      im.setColorAt(i, c.setScalar(lum));
    });
    // solo i pini vicini proiettano ombre: l'ombra copre comunque solo l'intorno della torretta
    im.castShadow = s < 2; im.receiveShadow = true;
    out.push(im);
  });
  return { alberi: out, mat, n: posti.reduce((a, l) => a + l.length, 0) };
}

// ─────────────────────────── sassi ───────────────────────────
function costruisciSassi() {
  const geos = [];
  let r = 999; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const a = rnd() * 6.28, d = 60 + rnd() * 520;
    const x = TORRE.x * 0.4 + Math.cos(a) * d, z = TORRE.z * 0.4 + Math.sin(a) * d;
    const h = quota(x, z); if (h < QUOTA_LAGO + 1) continue;
    const g = new THREE.DodecahedronGeometry(1, 0);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (1 + rnd() * 0.3), p.getY(k) * (0.6 + rnd() * 0.2), p.getZ(k) * (1 + rnd() * 0.3));
    const s = 2 + rnd() * 5;
    g.scale(s, s, s); g.rotateY(rnd() * 6); g.translate(x, h + s * 0.2, z);
    geos.push(g.index ? g.toNonIndexed() : g);
  }
  const m = new THREE.Mesh(mergeGeometries(geos), materiale({}));
  m.castShadow = m.receiveShadow = true;
  matSassi = m.material;
  return m;
}

// ─────────────────────────── torretta ───────────────────────────
const matLegno = materiale({ color: 0xffffff });
const matTetto = materiale({ color: 0xffffff });
const matFinestra = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
function costruisciTorre() {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const H = 17, B = 4.2, Tp = 2.6;   // altezza gambe, mezza base, mezza cima
  // quattro gambe inclinate
  const ang = Math.atan2(B - Tp, H);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const gamba = add(new THREE.BoxGeometry(0.45, H + 0.6, 0.45), matLegno, sx * (B + Tp) / 2, H / 2, sz * (B + Tp) / 2);
    gamba.rotation.set(-sz * ang, 0, sx * ang);
  }
  // crociere a X su ogni lato, a tre livelli
  for (let l = 0; l < 3; l++) {
    const y0 = l * H / 3, y1 = (l + 1) * H / 3;
    const w0 = B - (B - Tp) * (y0 / H), w1 = B - (B - Tp) * (y1 / H);
    for (let lato = 0; lato < 4; lato++) {
      const rot = lato * Math.PI / 2;
      for (const s of [1, -1]) {
        const x0 = -s * w0, x1 = s * w1, L = Math.hypot(x1 - x0, y1 - y0);
        const tr = new THREE.Mesh(new THREE.BoxGeometry(0.18, L, 0.18), matLegno);
        tr.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); tr.rotation.z = -Math.atan2(x1 - x0, y1 - y0);
        const piv = new THREE.Group(); piv.rotation.y = rot; piv.add(tr); tr.position.z = (w0 + w1) / 2;
        tr.castShadow = true; g.add(piv);
      }
      const trav = new THREE.Mesh(new THREE.BoxGeometry(w1 * 2, 0.25, 0.25), matLegno);
      trav.position.set(0, y1, w1); const piv = new THREE.Group(); piv.rotation.y = rot; piv.add(trav); g.add(piv);
    }
  }
  // ballatoio e cabina
  const yC = H;
  add(new THREE.BoxGeometry(8.4, 0.4, 8.4), matLegno, 0, yC, 0);
  for (let lato = 0; lato < 4; lato++) {
    const piv = new THREE.Group(); piv.rotation.y = lato * Math.PI / 2; g.add(piv);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.12, 0.12), matLegno); ring.position.set(0, yC + 1.1, 4.1); piv.add(ring);
    for (let k = -2; k <= 2; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), matLegno); p.position.set(k * 2, yC + 0.55, 4.1); piv.add(p); }
    // pareta: fascia bassa di legno, finestrone continuo, architrave
    const basso = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.2, 0.2), matLegno); basso.position.set(0, yC + 0.8, 2.7); basso.castShadow = true; piv.add(basso);
    const vetro = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.7), matFinestra); vetro.position.set(0, yC + 2.25, 2.72); piv.add(vetro);
    const alto = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.4, 0.2), matLegno); alto.position.set(0, yC + 3.25, 2.7); piv.add(alto);
    for (const k of [-2.7, -0.9, 0.9, 2.7]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 0.22), matLegno); m.position.set(k, yC + 2.25, 2.7); piv.add(m); }
  }
  // tetto a piramide con sporgenza
  const tetto = add(new THREE.ConeGeometry(5.4, 2.4, 4, 1), matTetto, 0, yC + 4.6, 0);
  tetto.rotation.y = Math.PI / 4;
  // scala a rampe dentro la struttura (suggerita da qualche gradino)
  for (let k = 0; k < 14; k++) add(new THREE.BoxGeometry(1.6, 0.12, 0.5), matLegno, Math.sin(k * 0.9) * 1.2, 0.8 + k * 1.15, Math.cos(k * 0.9) * 1.2);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

// ─────────────────────────── lago ───────────────────────────
const lagoMat = new THREE.ShaderMaterial({
  uniforms: U,
  vertexShader: `varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
    uniform vec3 uLago, uOriz, uAlto, uLuce; uniform float uT, uNotte;
    varying vec3 vWP;
    ${NEBBIA_GLSL}
    void main(){
      vec3 V = normalize(cameraPosition - vWP);
      float fres = pow(1.0 - max(V.y, 0.0), 3.0);
      // il lago riflette il cielo: da vicino (sguardo in giù) il cielo alto, verso il fondo l'orizzonte
      vec3 c = mix(mix(uLago, uAlto, 0.55), uOriz, smoothstep(0.1, 0.9, fres));
      // increspature: trattini orizzontali piatti, più chiari
      vec2 q = vWP.xz * vec2(0.06, 0.5) + vec2(uT * 0.15, 0.0);
      float cellaR = fract(sin(dot(floor(q), vec2(12.9898, 78.233))) * 43758.5453);
      float tratto = step(0.82, cellaR) * step(0.35, fract(q.y)) * step(fract(q.y), 0.6);
      c = mix(c, uOriz, tratto * 0.45);
      // riflesso del sole: una scia di scaglie lungo la linea camera-sole
      vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
      float s = max(dot(R, uSole), 0.0);
      float scaglie = step(0.75, fract(sin(dot(floor(vWP.xz * vec2(0.5, 2.0)), vec2(12.9898, 78.233))) * 43758.5453));
      c = mix(c, uLuce * 1.2, step(0.985, s) * scaglie * (1.0 - uNotte) * step(0.0, uSole.y));
      gl_FragColor = vec4(nebbia(c, vWP), 1.0);
      #include <colorspace_fragment>
    }`,
});

// ─────────────────────────── cielo ───────────────────────────
const cieloMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, uniforms: U,
  vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: `
    uniform vec3 uAlto, uOriz, uNebbia, uNebbiaSole, uLuce, uSole; uniform float uNotte, uT;
    varying vec3 vD;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec3 d = normalize(vD);
      float h = d.y;
      float s = max(dot(d, uSole), 0.0);
      // gradiente dipinto: alto → orizzonte, e all'orizzonte il colore della foschia (i monti lontani ci si sciolgono)
      vec3 c = mix(uOriz, uAlto, pow(smoothstep(-0.02, 0.62, h), 0.7));
      c = mix(c, uNebbia, 1.0 - smoothstep(0.0, 0.06, h));
      // bagliore del sole sul cielo
      c = mix(c, uNebbiaSole, pow(s, 6.0) * 0.7 * (1.0 - smoothstep(0.1, 0.6, h)));
      // nuvole a lunghe strisce piatte, due toni, basse sull'orizzonte
      float az = atan(d.z, d.x);
      float nv = vn(vec2(az * 5.0 + uT * 0.004, h * 38.0)) * 0.65 + vn(vec2(az * 13.0, h * 90.0)) * 0.35;
      float fascia = smoothstep(0.04, 0.10, h) * (1.0 - smoothstep(0.20, 0.32, h));
      float nuv = step(0.62, nv) * fascia;
      vec3 cn = mix(mix(uOriz, uAlto, 0.35), uNebbiaSole, pow(s, 3.0) * 0.8);
      cn = mix(cn, uLuce, step(0.70, nv) * 0.35 * (1.0 - uNotte));
      c = mix(c, cn, nuv * 0.85);
      // il grande sole: disco pieno e due aloni a gradini
      float sole = step(0.99955, s);
      c = mix(c, mix(uNebbiaSole, vec3(1.0, 0.97, 0.88), 0.55), step(0.9965, s) * 0.35 * (1.0 - uNotte));
      c = mix(c, mix(uNebbiaSole, vec3(1.0), 0.4), step(0.9988, s) * 0.5 * (1.0 - uNotte));
      c = mix(c, vec3(1.0, 0.97, 0.86), sole * (1.0 - uNotte) * step(-0.02, h));
      // di notte: stelle e luna (opposta al sole)
      if (uNotte > 0.01) {
        vec2 cella = floor(vec2(az * 260.0, h * 260.0));
        float st = step(0.9965, h21(cella)) * smoothstep(0.02, 0.2, h);
        float tw = 0.6 + 0.4 * sin(uT * 2.0 + h21(cella + 3.0) * 30.0);
        c += vec3(0.9, 0.95, 1.0) * st * tw * uNotte;
        float l = max(dot(d, -uSole), 0.0);
        c = mix(c, vec3(0.95, 0.96, 0.88), step(0.99965, l) * uNotte);
        c = mix(c, c + vec3(0.10, 0.13, 0.20), step(0.996, l) * uNotte * 0.6);
      }
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
});

// ─────────────────────────── scena ───────────────────────────
const sole = new THREE.DirectionalLight(0xffffff, 2.5);
sole.castShadow = true;
sole.shadow.mapSize.set(2048, 2048);
const scam = sole.shadow.camera; scam.left = -260; scam.right = 260; scam.top = 260; scam.bottom = -260; scam.near = 10; scam.far = 2000;
sole.shadow.bias = -0.0006; sole.shadow.normalBias = 0.6;
scene.add(sole, sole.target);
const emi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
scene.add(emi);
const lampada = new THREE.PointLight(0xffb45a, 0, 90, 1.6);

let matSassi = null;
let ora = Number(Q.get('ora') ?? 0.69);
let torre;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

(async () => {
  Demo.carica('Sollevo le montagne', 0.1);
  await new Promise(r => setTimeout(r, 0));
  scene.add(costruisciTerreno());
  Demo.carica('Pianto i pini', 0.5);
  await new Promise(r => setTimeout(r, 0));
  const bosco = costruisciBosco();
  bosco.alberi.forEach(a => scene.add(a));
  scene.add(costruisciSassi());
  torre = costruisciTorre();
  const hT = quota(TORRE.x, TORRE.z);
  torre.position.set(TORRE.x, hT - 0.3, TORRE.z); torre.rotation.y = 0.5;
  scene.add(torre);
  lampada.position.set(TORRE.x, hT + 19.5, TORRE.z); scene.add(lampada);
  const lago = new THREE.Mesh(new THREE.CircleGeometry(LAGO.r * 1.6, 64), lagoMat);
  lago.rotation.x = -Math.PI / 2; lago.position.set(LAGO.x, QUOTA_LAGO, LAGO.z);
  scene.add(lago);
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(6000, 48, 24), cieloMat);
  cielo.renderOrder = -1;
  scene.add(cielo);

  // visuale: orbita attorno alla torretta
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 45; controls.maxDistance = 520;
  controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.5;
  controls.rotateSpeed = 0.5; controls.zoomSpeed = 0.8;
  controls.target.set(TORRE.x + 30, hT + 12, TORRE.z + 10);
  const cp = (Q.get('cam') || '').split(',').map(Number);
  if (cp.length === 3) camera.position.set(cp[0], cp[1], cp[2]);
  else camera.position.set(TORRE.x + 330, hT + 38, TORRE.z - 175);
  controls.update();

  Demo.extra(`<p style="opacity:.75">L'ora corrente è in basso a sinistra. Tutti i colori della scena vengono da una sola tavolozza, che si interpola fra nove momenti del giorno. Nella valle ci sono ${bosco.n.toLocaleString('it-IT')} pini.</p>`);
  const etichetta = document.createElement('div');
  etichetta.style.cssText = 'position:fixed;left:14px;bottom:14px;font:600 13px/1 "Segoe UI",system-ui,sans-serif;color:#fff;background:rgba(14,13,12,.45);padding:7px 11px;border-radius:999px;z-index:900;letter-spacing:.04em';
  if (!Demo.shot) document.body.append(etichetta);

  const dS = new THREE.Vector3();
  Demo.loop((dt, t) => {
    // ↑↓ (o la croce del pad, o lo stick sinistro) fanno scorrere l'ora
    const ax = Demo.asse().y;
    ora = (ora + ax * dt * 0.07 + 1) % 1;
    tavolozza(ora);
    dirSole(ora, dS);
    const notte = 1 - smooth(-0.10, 0.06, dS.y);
    U.uNotte.value = notte; U.uT.value = t;
    U.uAlto.value.copy(P.alto); U.uOriz.value.copy(P.oriz); U.uNebbia.value.copy(P.nebbia); U.uNebbiaSole.value.copy(P.nebbiaSole);
    U.uNebbiaV.value.copy(P.nebbia).lerp(P.alto, 0.4).multiplyScalar(0.82);
    U.uLuce.value.copy(P.luce); U.uPrato.value.copy(P.prato); U.uRoccia.value.copy(P.roccia); U.uBosco.value.copy(P.bosco); U.uLago.value.copy(P.lago);
    U.uDens.value = P.dens; U.uBassa.value = P.bassa;
    U.uSole.value.copy(dS);
    // la luce che illumina: il sole di giorno, la luna (opposta) di notte
    const luceDir = dS.y > -0.02 ? dS.clone() : dS.clone().negate();
    luceDir.y = Math.max(luceDir.y, 0.12); luceDir.normalize();
    sole.color.copy(P.luce); sole.intensity = P.forza;
    sole.position.copy(controls.target).addScaledVector(luceDir, 900);
    sole.target.position.copy(controls.target);
    emi.color.copy(P.ambC); emi.groundColor.copy(P.ambT); emi.intensity = P.amb;
    bosco.mat.color.copy(P.albero);
    matSassi.color.copy(P.roccia).multiplyScalar(1.1);
    matLegno.color.copy(P.legno); matTetto.color.copy(P.legno).multiplyScalar(0.72);
    // la finestra: di giorno riflette il cielo, di notte è accesa
    matFinestra.color.copy(P.oriz).multiplyScalar(0.55).lerp(new THREE.Color(1.0, 0.72, 0.32), notte);
    lampada.intensity = notte * 2600;

    controls.update();
    // mai sotto il terreno
    const hc = quota(camera.position.x, camera.position.z) + 10;
    if (camera.position.y < hc) camera.position.y = hc;
    const hh = Math.floor(ora * 24), mm = Math.floor((ora * 24 - hh) * 60);
    etichetta.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + '  ↑↓';
    if (!Demo.shot || dt === 0) renderer.render(scene, camera);
  });
  Demo.pronto();
})().catch(e => Demo.errore(e));
