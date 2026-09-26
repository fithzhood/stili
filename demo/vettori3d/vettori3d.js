// Vettoriale 3D — un carro armato in prima persona su una pianura senza fine, come Battlezone (Atari, 1980).
// Tutto è fatto di segmenti: ogni oggetto ha un corpo nero riempito che scrive la profondità
// (così gli spigoli dietro spariscono: rimozione delle linee nascoste) e sopra i suoi spigoli.
// La scena si disegna in bianco; è il "vetro" finale a colorarla: rosso nella fascia alta
// (come la pellicola rossa incollata sul monitor del cabinato) e verde fosforo sotto.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

THREE.ColorManagement.enabled = false;
const Q = Demo.query;

// ─────────────────────────── renderer e passate ───────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: Demo.shot });
const PR = Math.min(devicePixelRatio, 1.5);
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.autoClear = false;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.5, 6000);
const hud = new THREE.Scene();
const camHud = new THREE.OrthographicCamera(0, innerWidth, innerHeight, 0, -10, 10);

const composer = new EffectComposer(renderer);
const passScena = new RenderPass(scene, camera);
const passHud = new RenderPass(hud, camHud); passHud.clear = false;
const passFosforo = new AfterimagePass(0.8);                   // persistenza del fosforo
const passBagliore = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.78, 0.28, 0.04);
const passVetro = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uAsp: { value: innerWidth / innerHeight }, uColpo: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uT; uniform float uAsp; uniform float uColpo;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      // curvatura del tubo
      vec2 c = vUv * 2.0 - 1.0;
      vec2 k = c + c * vec2(c.y * c.y / 14.0, c.x * c.x / 10.0);
      vec2 uv = k * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
      vec3 s = texture2D(tDiffuse, uv).rgb;
      float l = max(s.r, max(s.g, s.b));
      // la pellicola: rosso in alto, verde fosforo sotto (il bordo segue la curvatura del vetro)
      float rosso = smoothstep(0.785, 0.79, uv.y);
      vec3 tinta = mix(vec3(0.28, 1.0, 0.36), vec3(1.0, 0.16, 0.1), rosso);
      vec3 col = tinta * l + vec3(0.9, 1.0, 0.85) * pow(max(l - 0.75, 0.0), 2.0) * 0.8 * (1.0 - rosso);
      // sfarfallio del raggio e un velo di rumore sul vetro
      col *= 0.965 + 0.035 * sin(uT * 131.0) + 0.02 * (h(vec2(floor(uT * 60.0), 3.0)) - 0.5);
      col += tinta * 0.012 * h(uv * 900.0 + uT);
      // vignettatura e riflesso del vetro
      float r = length(c * vec2(1.0, 0.9));
      col *= 1.0 - 0.55 * smoothstep(0.6, 1.45, r);
      col += vec3(0.02, 0.035, 0.03) * smoothstep(0.9, 0.2, length(c - vec2(-0.45, 0.5)));
      col += vec3(1.0, 0.9, 0.8) * uColpo * 0.35;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(passScena);
composer.addPass(passHud);
composer.addPass(passFosforo);
composer.addPass(passBagliore);
composer.addPass(passVetro);

// ─────────────────────────── materiali ───────────────────────────
const matLinea = new LineMaterial({ color: 0xffffff, linewidth: 1.6, worldUnits: false });
const matLineaC = new LineMaterial({ color: 0xffffff, linewidth: 1.6, worldUnits: false, vertexColors: true });
const matHud = new LineMaterial({ color: 0xffffff, linewidth: 1.5, worldUnits: false, vertexColors: true, depthTest: false });
const matPieno = new THREE.MeshBasicMaterial({ color: 0x000000, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
const LINEE = [matLinea, matLineaC, matHud];

function dimensiona() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  camHud.right = innerWidth; camHud.top = innerHeight; camHud.updateProjectionMatrix();
  const w = innerWidth * PR, h = innerHeight * PR;
  LINEE.forEach(m => m.resolution.set(w, h));
  const lw = Math.max(1.3, Math.min(2.2, innerHeight / 560));
  matLinea.linewidth = matLineaC.linewidth = lw;
  matHud.linewidth = lw * 0.95;
  passVetro.uniforms.uAsp.value = innerWidth / innerHeight;
}
dimensiona();
addEventListener('resize', dimensiona);

// ─────────────────────────── costruzione dei modelli ───────────────────────────
// Un "prisma" da due rettangoli orizzontali: base [x0,x1,z0,z1] a y0 e cima a y1.
function prisma(b, y0, t, y1) {
  const v = [
    [b[0], y0, b[2]], [b[1], y0, b[2]], [b[1], y0, b[3]], [b[0], y0, b[3]],
    [t[0], y1, t[2]], [t[1], y1, t[2]], [t[1], y1, t[3]], [t[0], y1, t[3]],
  ];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const pos = [];
  f.forEach(tri => tri.forEach(i => pos.push(...v[i])));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
function segmentiDa(geoms) {
  const out = [];
  for (const g of geoms) {
    const e = new THREE.EdgesGeometry(g, 8);
    out.push(...e.attributes.position.array);
  }
  return out;
}
// oggetto vettoriale: corpo nero (nasconde ciò che sta dietro) + spigoli
function vettoriale(geoms, extra = []) {
  const grp = new THREE.Group();
  for (const g of geoms) grp.add(new THREE.Mesh(g, matPieno));
  const seg = segmentiDa(geoms).concat(extra);
  const lg = new LineSegmentsGeometry(); lg.setPositions(seg);
  const l = new LineSegments2(lg, matLinea);
  grp.add(l);
  grp.userData.seg = seg;
  return grp;
}

function geoCarro() {
  return [
    prisma([-2.1, 2.1, -3.4, 3.4], 0, [-2.4, 2.4, -4.3, 4.1], 1.1),           // cingoli
    prisma([-1.9, 1.9, -3.4, 2.6], 1.1, [-1.35, 1.35, -2.6, 0.9], 2.2),         // scafo a cuneo
    prisma([-0.95, 0.95, -1.9, 0.5], 2.2, [-0.8, 0.8, -1.7, 0.2], 2.95),        // torretta
    prisma([-0.2, 0.2, 0.2, 4.6], 2.42, [-0.2, 0.2, 0.2, 4.6], 2.72),           // cannone
    prisma([-0.3, 0.3, 4.3, 4.7], 2.35, [-0.3, 0.3, 4.3, 4.7], 2.8),            // bocca
  ];
}
function nuovoCarro() {
  const c = vettoriale(geoCarro());
  // il radar sulla torretta gira sempre
  const radar = vettoriale([prisma([-0.7, 0.7, -0.05, 0.05], 0.5, [-0.8, 0.8, -0.05, 0.05], 1.0)],
    [0, 0, 0, 0, 0.5, 0]);
  radar.position.set(0, 2.95, -1.2);
  c.add(radar);
  c.userData.radar = radar;
  return c;
}
const GEO_PIRAMIDE = (() => { const g = new THREE.ConeGeometry(5.5, 9, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, 4.5, 0); return g.toNonIndexed(); })();
const GEO_PIRAMIDE_BASSA = (() => { const g = new THREE.ConeGeometry(7, 5, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, 2.5, 0); return g.toNonIndexed(); })();
const GEO_CUBO = (() => { const g = new THREE.BoxGeometry(7, 7, 7); g.translate(0, 3.5, 0); return g.toNonIndexed(); })();
const GEO_BLOCCO = (() => { const g = new THREE.BoxGeometry(5, 11, 5); g.translate(0, 5.5, 0); return g.toNonIndexed(); })();

// ─────────────────────────── generatore deterministico ───────────────────────────
let seme = 1980;
const rnd = () => { seme = (seme * 1664525 + 1013904223) >>> 0; return seme / 4294967296; };

// ─────────────────────────── ostacoli su un campo che si ripete all'infinito ───────────────────────────
const TILE = 520;
const ostacoli = [];
function aggiungiOstacolo(tipo, x, z, rot) {
  const g = { piramide: GEO_PIRAMIDE, bassa: GEO_PIRAMIDE_BASSA, cubo: GEO_CUBO, blocco: GEO_BLOCCO }[tipo];
  const o = vettoriale([g]);
  o.rotation.y = rot;
  scene.add(o);
  ostacoli.push({ o, bx: x, bz: z, x, z, r: tipo === 'blocco' ? 3.6 : tipo === 'bassa' ? 5 : 4.8 });
}
// alcuni fissi vicino alla partenza, per una bella prima inquadratura
aggiungiOstacolo('piramide', 16, -42, 0.3);
aggiungiOstacolo('cubo', -30, -78, 0.5);
aggiungiOstacolo('bassa', 44, -110, 0.1);
aggiungiOstacolo('blocco', -9, -150, 0.2);
aggiungiOstacolo('piramide', -70, -130, 0.8);
for (let i = 0; i < 26; i++) {
  let x, z, ok;
  do {
    x = (rnd() - 0.5) * TILE; z = (rnd() - 0.5) * TILE;
    ok = Math.hypot(x, z) > 40 && ostacoli.every(o => Math.hypot(o.bx - x, o.bz - z) > 45);
  } while (!ok);
  aggiungiOstacolo(['piramide', 'piramide', 'cubo', 'bassa', 'blocco'][Math.floor(rnd() * 5)], x, z, rnd() * 3);
}
function aggiornaOstacoli(px, pz) {
  for (const o of ostacoli) {
    o.x = o.bx + Math.round((px - o.bx) / TILE) * TILE;
    o.z = o.bz + Math.round((pz - o.bz) / TILE) * TILE;
    o.o.position.set(o.x, 0, o.z);
  }
}

// ─────────────────────────── orizzonte: montagne, vulcano, luna ───────────────────────────
// Sta sempre alla stessa distanza dal carro: si gira, ma non ci si avvicina mai.
const orizzonte = new THREE.Group();
scene.add(orizzonte);
const R = 2600;
const ANG_VULCANO = Math.PI * 0.53;   // davanti, un po' a sinistra della partenza
const ANG_LUNA = Math.PI * 0.36;
{
  const seg = [];
  const punto = (a, h, r = R) => [Math.cos(a) * r, h, -Math.sin(a) * r];
  // catena di picchi: profilo spezzato, e da alcune punte una cresta che scende verso valle
  const picchi = [];
  let a = 0;
  while (a < Math.PI * 2) {
    const w = 0.035 + rnd() * 0.09;
    const dv = Math.abs(Math.atan2(Math.sin(a - ANG_VULCANO), Math.cos(a - ANG_VULCANO)));
    let h = 70 + rnd() * 330;
    if (rnd() < 0.3) h *= 0.45;
    if (dv < 0.16) h *= 0.18 + dv * 2.5;      // il vulcano sta da solo
    picchi.push({ a, w, h });
    a += w * (0.8 + rnd() * 0.6);
  }
  let prev = null;
  for (const p of picchi) {
    const sx = p.a - p.w, dx = p.a + p.w;
    const valle = prev ? prev : punto(sx, p.h * 0.15);
    const cima = punto(p.a + (rnd() - 0.5) * p.w * 0.5, p.h);
    seg.push(...valle, ...cima);
    const fine = punto(dx * 0.5 + p.a * 0.5 + p.w * 0.3, p.h * (0.2 + rnd() * 0.35));
    seg.push(...cima, ...fine);
    if (p.h > 180 && rnd() < 0.8) {
      // cresta interna e una seconda punta accanto
      seg.push(...cima, ...punto(p.a + p.w * (0.1 + rnd() * 0.4), p.h * (0.25 + rnd() * 0.2)));
    }
    prev = fine;
  }
  // linea dell'orizzonte
  for (let i = 0; i < 96; i++) {
    const a0 = i / 96 * Math.PI * 2, a1 = (i + 1) / 96 * Math.PI * 2;
    seg.push(...punto(a0, 0), ...punto(a1, 0));
  }
  // il vulcano: tronco di cono con il cratere
  const va = ANG_VULCANO, w = 0.11, top = 560, cw = 0.02;
  seg.push(...punto(va - w, 20), ...punto(va - cw, top), ...punto(va - cw, top), ...punto(va + cw, top),
    ...punto(va + cw, top), ...punto(va + w, 20),
    ...punto(va - cw * 0.3, top), ...punto(va - w * 0.45, top * 0.35),
    ...punto(va + cw * 0.6, top), ...punto(va + w * 0.3, top * 0.55));
  // la luna: una falce, due archi
  const lc = punto(ANG_LUNA, 420, R * 1.02);
  const lr = 70;
  const dirA = new THREE.Vector3(Math.sin(ANG_LUNA), 0, Math.cos(ANG_LUNA)); // tangente orizzontale
  for (let i = 0; i < 24; i++) {
    const t0 = -Math.PI / 2 + i / 24 * Math.PI, t1 = -Math.PI / 2 + (i + 1) / 24 * Math.PI;
    const arco = (t, k) => [lc[0] + dirA.x * Math.cos(t) * lr * k, lc[1] + Math.sin(t) * lr, lc[2] + dirA.z * Math.cos(t) * lr * k];
    seg.push(...arco(t0, 1), ...arco(t1, 1), ...arco(t0, 0.45), ...arco(t1, 0.45));
  }
  const lg = new LineSegmentsGeometry(); lg.setPositions(seg);
  orizzonte.add(new LineSegments2(lg, matLinea));
}

// ─────────────────────────── linee dinamiche (proiettili, schegge, lava, HUD) ───────────────────────────
class Linee {
  constructor(max, mat, parent) {
    this.max = max; this.n = 0;
    this.g = new LineSegmentsGeometry();
    this.g.setPositions(new Float32Array(max * 6));
    this.g.setColors(new Float32Array(max * 6));
    this.p = this.g.attributes.instanceStart.data;
    this.c = this.g.attributes.instanceColorStart.data;
    this.obj = new LineSegments2(this.g, mat);
    this.obj.frustumCulled = false;
    parent.add(this.obj);
  }
  seg(x1, y1, z1, x2, y2, z2, b = 1) {
    if (this.n >= this.max) return;
    const i = this.n++ * 6, P = this.p.array, C = this.c.array;
    P[i] = x1; P[i + 1] = y1; P[i + 2] = z1; P[i + 3] = x2; P[i + 4] = y2; P[i + 5] = z2;
    C[i] = C[i + 1] = C[i + 2] = C[i + 3] = C[i + 4] = C[i + 5] = b;
  }
  inizia() { this.n = 0; }
  chiudi() { this.g.instanceCount = this.n; this.p.needsUpdate = true; this.c.needsUpdate = true; }
}
const effetti = new Linee(6000, matLineaC, scene);
const lineeHud = new Linee(3000, matHud, hud);

// ─────────────────────────── font vettoriale a segmenti ───────────────────────────
// Ogni lettera è una lista di spezzate su una griglia 4×6 ("xy xy xy").
const FONT = {
  '0': ['00 40 46 06 00'], '1': ['20 26', '15 26'], '2': ['06 46 43 03 00 40'], '3': ['06 46 40 00', '03 43'],
  '4': ['06 03 43', '46 40'], '5': ['46 06 03 43 40 00'], '6': ['46 06 00 40 43 03'], '7': ['06 46 40'],
  '8': ['00 40 46 06 00', '03 43'], '9': ['40 46 06 03 43'],
  A: ['00 04 26 44 40', '03 43'], B: ['00 06 36 45 44 33 03', '33 42 41 30 00'], C: ['40 00 06 46'],
  D: ['00 06 26 44 42 20 00'], E: ['40 00 06 46', '03 33'], F: ['00 06 46', '03 33'], G: ['46 06 00 40 42 22'],
  H: ['00 06', '40 46', '03 43'], I: ['00 40', '06 46', '20 26'], J: ['02 00 40 46'], K: ['00 06', '46 03 40'],
  L: ['06 00 40'], M: ['00 06 23 46 40'], N: ['00 06 40 46'], O: ['00 40 46 06 00'], P: ['00 06 46 43 03'],
  Q: ['00 40 46 06 00', '22 40'], R: ['00 06 46 43 03', '13 40'], S: ['00 40 43 03 06 46'], T: ['06 46', '20 26'],
  U: ['06 00 40 46'], V: ['06 20 46'], W: ['06 00 22 40 46'], X: ['00 46', '06 40'], Y: ['06 23 46', '23 20'],
  Z: ['06 46 00 40'], '-': ['03 43'], ' ': [],
};
function testo(s, x, y, dim, b = 1, centrato = false) {
  const sc = dim / 6, passo = 6 * sc;
  if (centrato) x -= (s.length * passo - 2 * sc) / 2;
  for (const ch of s.toUpperCase()) {
    for (const tratto of (FONT[ch] || [])) {
      const p = tratto.split(' ').map(q => [+q[0] * sc, +q[1] * sc]);
      for (let i = 0; i < p.length - 1; i++) lineeHud.seg(x + p[i][0], y + p[i][1], 0, x + p[i + 1][0], y + p[i + 1][1], 0, b);
    }
    x += passo;
  }
}

// ─────────────────────────── stato del gioco ───────────────────────────
const pl = { x: 0, z: 0, rot: 0, vivo: true, morte: 0, bloccato: 0, rinculo: 0, scossa: 0 };
let punti = 0, record = 25000, vite = 3;
const nemici = [];
const colpi = [];         // {x,y,z,vx,vz,vita,mio}
const schegge = [];       // {a:[x,y,z], b:[x,y,z], v:[..], w:[asse, vel], vita, max}
const lava = [];          // particelle del vulcano
const crepe = [];         // crepe sul vetro quando ti colpiscono
let lampo = 0;

function nuovoNemico(x, z, rot) {
  const c = nuovoCarro();
  c.position.set(x, 0, z); c.rotation.y = rot;
  scene.add(c);
  const n = { c, x, z, rot, stato: 'gira', timer: 1 + rnd() * 2, ricarica: 2 + rnd() * 2, meta: null };
  nemici.push(n);
  return n;
}
function generaNemico() {
  const a = pl.rot + (rnd() - 0.5) * 2.4;       // di solito davanti, a volte di lato
  const d = 170 + rnd() * 120;
  nuovoNemico(pl.x - Math.sin(a) * d, pl.z - Math.cos(a) * d, rnd() * Math.PI * 2);
}

// esplosione: ogni spigolo del carro diventa una scheggia che vola e rotola
function esplodi(n) {
  n.c.updateMatrixWorld(true);
  const tutti = [];
  n.c.traverse(o => { if (o.userData.seg) tutti.push([o.userData.seg, o.matrixWorld]); });
  const cen = new THREE.Vector3(n.x, 1.5, n.z);
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  for (const [seg, mw] of tutti) {
    for (let i = 0; i < seg.length; i += 6) {
      A.set(seg[i], seg[i + 1], seg[i + 2]).applyMatrix4(mw);
      B.set(seg[i + 3], seg[i + 4], seg[i + 5]).applyMatrix4(mw);
      const m = A.clone().add(B).multiplyScalar(0.5);
      const d = m.clone().sub(cen).normalize();
      const v = d.multiplyScalar(3 + rnd() * 8); v.y += 5 + rnd() * 9;
      schegge.push({ a: A.clone().sub(m), b: B.clone().sub(m), m, v, ax: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), w: (rnd() - 0.5) * 14, vita: 0, max: 2.2 + rnd() * 1.4 });
    }
  }
  // lampo: una stella di raggi
  for (let i = 0; i < 22; i++) {
    const d = new THREE.Vector3(rnd() - 0.5, rnd() * 0.8, rnd() - 0.5).normalize();
    schegge.push({ a: new THREE.Vector3(), b: d.clone().multiplyScalar(1.2), m: cen.clone(), v: d.multiplyScalar(28), ax: new THREE.Vector3(0, 1, 0), w: 0, vita: 0, max: 0.45 });
  }
  scene.remove(n.c);
  nemici.splice(nemici.indexOf(n), 1);
}

function colpito() {
  pl.vivo = false; pl.morte = 0; pl.scossa = 1; lampo = 1;
  vite = Math.max(0, vite - 1);
  // crepe: spezzate che partono dal punto d'impatto
  crepe.length = 0;
  const cx = innerWidth * (0.42 + rnd() * 0.16), cy = innerHeight * (0.35 + rnd() * 0.2);
  for (let i = 0; i < 11; i++) {
    let a = i / 11 * Math.PI * 2 + rnd() * 0.4, x = cx, y = cy;
    const pezzi = [];
    const L = Math.max(innerWidth, innerHeight) * (0.25 + rnd() * 0.5);
    for (let k = 0; k < 7; k++) {
      const s = L / 7 * (0.6 + rnd() * 0.8);
      const nx = x + Math.cos(a) * s, ny = y + Math.sin(a) * s;
      pezzi.push([x, y, nx, ny]); x = nx; y = ny; a += (rnd() - 0.5) * 0.7;
    }
    crepe.push(...pezzi);
  }
  // anelli attorno all'impatto
  for (let r = 18; r < 90; r += 34) {
    for (let i = 0; i < 9; i++) {
      const a0 = i / 9 * Math.PI * 2 + rnd() * 0.2, a1 = a0 + Math.PI * 2 / 9;
      crepe.push([cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r * (0.9 + rnd() * 0.2), cy + Math.sin(a1) * r * (0.9 + rnd() * 0.2)]);
    }
  }
}

// ─────────────────────────── scena iniziale ───────────────────────────
nuovoNemico(-13, -46, 0.75);
nuovoNemico(70, -190, -0.6);
// in foto, una battaglia già in corso: un terzo carro sta saltando in aria
if (Demo.shot && !Q.has('calmo')) {
  const n = nuovoNemico(19, -64, 2.2);
  esplodi(n);
  schegge.forEach(s => { s.max += 1.2; });
}
if (Q.has('morto')) colpito();
let prossimoNemico = 0;

// ─────────────────────────── ciclo ───────────────────────────
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
const ang = a => Math.atan2(Math.sin(a), Math.cos(a));
let messaggio = '', tMsg = 0;

function passo(dt, t) {
  // ── carro del giocatore ──
  const a = Demo.asse();
  const g = Demo.guarda();
  if (pl.vivo) {
    pl.rot -= (a.x + g.x) * 1.25 * dt;
    const v = a.y * 15 * dt;
    const nx = pl.x - Math.sin(pl.rot) * v, nz = pl.z - Math.cos(pl.rot) * v;
    const blocco = ostacoli.find(o => Math.hypot(o.x - nx, o.z - nz) < o.r + 2.2)
      || nemici.find(n => Math.hypot(n.x - nx, n.z - nz) < 6);
    if (blocco && v !== 0) pl.bloccato = 1.2;
    else { pl.x = nx; pl.z = nz; }
    if (Demo.premuto(' ') && !colpi.some(c => c.mio)) {
      colpi.push({ x: pl.x - Math.sin(pl.rot) * 3, y: 1.6, z: pl.z - Math.cos(pl.rot) * 3, vx: -Math.sin(pl.rot) * 110, vz: -Math.cos(pl.rot) * 110, vita: 2.4, mio: true });
      pl.rinculo = 1;
    }
  } else {
    pl.morte += dt;
    if (pl.morte > 3.2) {
      pl.vivo = true; crepe.length = 0;
      if (vite === 0) { vite = 3; record = Math.max(record, punti); punti = 0; }
      // i nemici si allontanano: si riparte con un po' di respiro
      nemici.forEach(n => { const d = Math.hypot(n.x - pl.x, n.z - pl.z); if (d < 120) { n.x = pl.x + (n.x - pl.x) / d * 160; n.z = pl.z + (n.z - pl.z) / d * 160; } });
    }
  }
  pl.bloccato = Math.max(0, pl.bloccato - dt);
  pl.rinculo = Math.max(0, pl.rinculo - dt * 4);
  pl.scossa = Math.max(0, pl.scossa - dt * 0.8);
  lampo = Math.max(0, lampo - dt * 3);

  // camera: dentro il carro, con il sussulto dei cingoli e del rinculo
  const mov = pl.vivo ? Math.abs(a.y) : 0;
  camera.position.set(pl.x, 2.1 + Math.sin(t * 17) * 0.03 * mov + (rnd() - 0.5) * 0.25 * pl.scossa, pl.z);
  camera.rotation.set(0.035 + pl.rinculo * 0.02 + (rnd() - 0.5) * 0.04 * pl.scossa, pl.rot + (rnd() - 0.5) * 0.03 * pl.scossa, (pl.vivo ? 0 : 0.06) + (rnd() - 0.5) * 0.02 * pl.scossa, 'YXZ');
  camera.updateMatrixWorld();
  orizzonte.position.set(pl.x, 0, pl.z);
  aggiornaOstacoli(pl.x, pl.z);

  // ── nemici ──
  for (const n of nemici) {
    const dx = pl.x - n.x, dz = pl.z - n.z, d = Math.hypot(dx, dz);
    const verso = Math.atan2(-dx, -dz);                 // rotazione che guarda il giocatore (avanti = -z)
    const diff = ang(verso - n.rot);
    n.timer -= dt; n.ricarica -= dt;
    if (n.stato === 'gira') {
      n.rot += Math.sign(diff) * Math.min(Math.abs(diff), 0.7 * dt);
      if (Math.abs(diff) < 0.05) { n.stato = d > 90 ? 'avanza' : 'mira'; n.timer = 2 + rnd() * 3; }
    } else if (n.stato === 'avanza') {
      n.rot += Math.sign(diff) * Math.min(Math.abs(diff), 0.25 * dt);
      const nx = n.x - Math.sin(n.rot) * 9 * dt, nz = n.z - Math.cos(n.rot) * 9 * dt;
      if (!ostacoli.some(o => Math.hypot(o.x - nx, o.z - nz) < o.r + 4)) { n.x = nx; n.z = nz; }
      else { n.rot += 1.2 * dt; }
      if (n.timer < 0 || d < 70) { n.stato = 'mira'; n.timer = 1.5; }
    } else if (n.stato === 'mira') {
      n.rot += Math.sign(diff) * Math.min(Math.abs(diff), 0.5 * dt);
      if (Math.abs(diff) < 0.06 && n.ricarica < 0 && pl.vivo && d < 260) {
        const err = (rnd() - 0.5) * 0.09;
        colpi.push({ x: n.x - Math.sin(n.rot) * 5, y: 1.6, z: n.z - Math.cos(n.rot) * 5, vx: -Math.sin(n.rot + err) * 70, vz: -Math.cos(n.rot + err) * 70, vita: 4, mio: false });
        n.ricarica = 4 + rnd() * 3;
      }
      if (n.timer < 0) { n.stato = rnd() < 0.5 ? 'avanza' : 'gira'; n.timer = 2 + rnd() * 2; if (n.stato === 'gira') n.rot += 0.001; }
    }
    n.c.position.set(n.x, 0, n.z); n.c.rotation.y = n.rot + Math.PI;   // il modello guarda verso +z
    n.c.userData.radar.rotation.y = t * 2.6;
  }
  if (nemici.length < 2 && t > prossimoNemico) { generaNemico(); prossimoNemico = t + 4; }

  // ── proiettili ──
  for (let i = colpi.length - 1; i >= 0; i--) {
    const c = colpi[i];
    c.x += c.vx * dt; c.z += c.vz * dt; c.vita -= dt;
    let via = c.vita < 0;
    const ost = ostacoli.find(o => Math.hypot(o.x - c.x, o.z - c.z) < o.r);
    if (ost) { via = true; scintille(c.x, c.y, c.z, 8); }
    if (c.mio) {
      const n = nemici.find(n => Math.hypot(n.x - c.x, n.z - c.z) < 4.2);
      if (n) { via = true; esplodi(n); punti += 1000; prossimoNemico = t + 3; }
    } else if (pl.vivo && Math.hypot(pl.x - c.x, pl.z - c.z) < 3) { via = true; colpito(); }
    if (via) colpi.splice(i, 1);
  }

  // ── il vulcano sputa lapilli ──
  if (rnd() < dt * 9) {
    const va = ANG_VULCANO + (rnd() - 0.5) * 0.02;
    lava.push({ a: va, h: 560, vh: 90 + rnd() * 120, va: (rnd() - 0.5) * 0.02, vita: 0 });
  }
  for (let i = lava.length - 1; i >= 0; i--) {
    const l = lava[i];
    l.vita += dt; l.h += l.vh * dt; l.vh -= 70 * dt; l.a += l.va * dt;
    if (l.h < 300) lava.splice(i, 1);
  }
  // ── schegge ──
  for (let i = schegge.length - 1; i >= 0; i--) {
    const s = schegge[i];
    s.vita += dt;
    s.m.addScaledVector(s.v, dt); s.v.y -= 22 * dt;
    if (s.m.y < 0.1) { s.m.y = 0.1; s.v.y *= -0.35; s.v.x *= 0.6; s.v.z *= 0.6; s.w *= 0.6; }
    tmpQ.setFromAxisAngle(s.ax, s.w * dt);
    s.a.applyQuaternion(tmpQ); s.b.applyQuaternion(tmpQ);
    if (s.vita > s.max) schegge.splice(i, 1);
  }
}

function scintille(x, y, z, n) {
  for (let i = 0; i < n; i++) {
    const d = new THREE.Vector3(rnd() - 0.5, rnd() * 0.7, rnd() - 0.5).normalize();
    schegge.push({ a: new THREE.Vector3(), b: d.clone().multiplyScalar(0.6), m: new THREE.Vector3(x, y, z), v: d.multiplyScalar(14), ax: new THREE.Vector3(0, 1, 0), w: 0, vita: 0, max: 0.35 });
  }
}

function disegnaEffetti(t) {
  effetti.inizia();
  // proiettili: piccoli rombi
  for (const c of colpi) {
    const s = 0.45;
    effetti.seg(c.x - s, c.y, c.z, c.x, c.y + s, c.z); effetti.seg(c.x, c.y + s, c.z, c.x + s, c.y, c.z);
    effetti.seg(c.x + s, c.y, c.z, c.x, c.y - s, c.z); effetti.seg(c.x, c.y - s, c.z, c.x - s, c.y, c.z);
    effetti.seg(c.x, c.y, c.z - s * 2, c.x, c.y, c.z + s * 2);
  }
  for (const s of schegge) {
    const b = Math.max(0, 1 - s.vita / s.max);
    effetti.seg(s.m.x + s.a.x, s.m.y + s.a.y, s.m.z + s.a.z, s.m.x + s.b.x, s.m.y + s.b.y, s.m.z + s.b.z, Math.min(1, b * 1.6));
  }
  // lapilli: brevi tratti nella direzione del moto, all'orizzonte
  for (const l of lava) {
    const x = pl.x + Math.cos(l.a) * R, z = pl.z - Math.sin(l.a) * R;
    const dx = Math.cos(l.a + Math.PI / 2) * l.va * R * 0.06, dh = l.vh * 0.12;
    effetti.seg(x, l.h, z, x - dx, l.h - dh, z, Math.max(0.3, 1 - l.vita / 4));
  }
  effetti.chiudi();
}

function disegnaHud(t) {
  const W = innerWidth, H = innerHeight;
  const u = H / 720;              // unità di misura del cruscotto
  lineeHud.inizia();
  // ── mirino al centro ──
  const cx = W / 2, cy = H / 2 + H * 0.035 / 0.36 * 0.36 * 0 ;
  const cyM = cy + (camera.rotation.x) * 0; // il mirino resta fisso sullo schermo
  const bersaglio = nemici.some(n => {
    tmpV.set(n.x, 1.5, n.z).project(camera);
    return tmpV.z < 1 && Math.abs(tmpV.x) < 0.035 && Math.abs(tmpV.y) < 0.2;
  });
  const ap = bersaglio ? 1.8 : 1;
  const s = 16 * u;
  lineeHud.seg(cx, cyM + s * 1.6, 0, cx, cyM + s * 4, 0);
  lineeHud.seg(cx, cyM - s * 1.6, 0, cx, cyM - s * 4, 0);
  for (const sg of [-1, 1]) {
    const x = cx + sg * s * 1.6 * ap;
    lineeHud.seg(x, cyM + s * 1.1, 0, x, cyM - s * 1.1, 0);
    lineeHud.seg(x, cyM + s * 1.1, 0, x - sg * s * 0.5, cyM + s * 1.1, 0);
    lineeHud.seg(x, cyM - s * 1.1, 0, x - sg * s * 0.5, cyM - s * 1.1, 0);
    lineeHud.seg(cx + sg * s * 4.2, cyM, 0, cx + sg * s * 2.6 * ap, cyM, 0);
  }

  // ── fascia rossa: radar, messaggi, punteggio ──
  const top = H * 0.9;
  const rr = 52 * u, rx = W / 2, ry = H - 72 * u;
  for (let i = 0; i < 40; i++) {
    const a0 = i / 40 * Math.PI * 2, a1 = (i + 1) / 40 * Math.PI * 2;
    lineeHud.seg(rx + Math.cos(a0) * rr, ry + Math.sin(a0) * rr, 0, rx + Math.cos(a1) * rr, ry + Math.sin(a1) * rr, 0, 0.8);
  }
  // tacche e il cono di visuale
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    lineeHud.seg(rx + Math.cos(a) * rr, ry + Math.sin(a) * rr, 0, rx + Math.cos(a) * rr * 0.9, ry + Math.sin(a) * rr * 0.9, 0, 0.8);
  }
  const fovH = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  for (const sg of [-1, 1]) lineeHud.seg(rx, ry, 0, rx + Math.sin(sg * fovH) * rr * 0.35, ry + Math.cos(fovH) * rr * 0.35, 0, 0.6);
  // scansione
  const sweep = -t * 2.4;
  lineeHud.seg(rx, ry, 0, rx + Math.cos(sweep) * rr, ry + Math.sin(sweep) * rr, 0, 1);
  lineeHud.seg(rx, ry, 0, rx + Math.cos(sweep + 0.06) * rr, ry + Math.sin(sweep + 0.06) * rr, 0, 0.35);
  // puntini dei nemici: si riaccendono quando passa la scansione
  let vicino = null, dmin = 1e9;
  for (const n of nemici) {
    const dx = n.x - pl.x, dz = n.z - pl.z, d = Math.hypot(dx, dz);
    if (d < dmin) { dmin = d; vicino = n; }
    if (d > 420) continue;
    // nel riferimento del carro: avanti = su
    const fw = -(dx * Math.sin(pl.rot) + dz * Math.cos(pl.rot)), rt = dx * Math.cos(pl.rot) - dz * Math.sin(pl.rot);
    const bx = rx + rt / 420 * rr, by = ry + fw / 420 * rr;
    const aB = Math.atan2(by - ry, bx - rx);
    const dall = ((aB - sweep) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);   // quanto è passato dalla scansione
    const b = Math.max(0.15, 1 - dall / (Math.PI * 2) * 1.3);
    const p = 2.2 * u;
    lineeHud.seg(bx - p, by, 0, bx + p, by, 0, b); lineeHud.seg(bx, by - p, 0, bx, by + p, 0, b);
  }
  // messaggi a sinistra
  const tx = 40 * u, ty = H - 50 * u, fs = 15 * u;
  if (vicino && pl.vivo) {
    const dx = vicino.x - pl.x, dz = vicino.z - pl.z;
    const rel = ang(Math.atan2(-dx, -dz) - pl.rot);
    if (dmin < 200 && (t % 0.7) < 0.5) testo('ENEMY IN RANGE', tx, ty, fs);
    if (Math.abs(rel) > 0.55) testo(Math.abs(rel) > 2.4 ? 'ENEMY TO REAR' : rel > 0 ? 'ENEMY TO LEFT' : 'ENEMY TO RIGHT', tx, ty - fs * 1.9, fs);
  }
  if (pl.bloccato > 0) testo('MOTION BLOCKED BY OBJECT', W / 2, H * 0.24, fs, 1, true);
  // punteggio a destra
  const sx = W - 300 * u;
  testo('SCORE  ' + String(punti).padStart(6, ' '), sx, ty, fs);
  testo('HIGH SCORE  ' + String(record), sx, ty - fs * 1.9, fs * 0.8, 0.85);
  // vite: piccoli carri di profilo
  for (let i = 0; i < vite; i++) {
    const x = sx + i * 34 * u, y = ty - fs * 4;
    const k = u * 1.1;
    const P = [[0, 0], [22, 0], [25, 4], [-3, 4], [0, 0]];
    for (let j = 0; j < P.length - 1; j++) lineeHud.seg(x + P[j][0] * k, y + P[j][1] * k, 0, x + P[j + 1][0] * k, y + P[j + 1][1] * k, 0, 0.9);
    lineeHud.seg(x + 5 * k, y + 4 * k, 0, x + 8 * k, y + 8 * k, 0, 0.9); lineeHud.seg(x + 8 * k, y + 8 * k, 0, x + 16 * k, y + 8 * k, 0, 0.9);
    lineeHud.seg(x + 16 * k, y + 8 * k, 0, x + 18 * k, y + 4 * k, 0, 0.9); lineeHud.seg(x + 12 * k, y + 7 * k, 0, x + 26 * k, y + 7 * k, 0, 0.9);
  }
  // crepe sul vetro
  for (const c of crepe) lineeHud.seg(c[0], c[1], 0, c[2], c[3], 0, 1);
  lineeHud.chiudi();
}

Demo.extra(`<h4>Tasti</h4><p><b>W S</b> avanti e indietro · <b>A D</b> ruotano il carro · <b>spazio</b> spara (un colpo per volta, come nel cabinato)</p>
  <h4>La pellicola</h4><p>Il monitor del cabinato era in bianco e nero: il colore veniva da due strisce di plastica, rossa in alto e verde sotto.
  Qui è lo stesso: la scena è disegnata in bianco e l'ultima passata la tinge a seconda dell'altezza. Per questo i lapilli del vulcano diventano rossi quando salgono.</p>`);

Demo.loop((dt, t) => {
  passo(dt, t);
  disegnaEffetti(t);
  disegnaHud(t);
  passVetro.uniforms.uT.value = t;
  passVetro.uniforms.uColpo.value = lampo;
  composer.render(dt);
});
Demo.pronto();
