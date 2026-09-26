// HD-2D alla Octopath Traveler: una piazzetta di borgo di notte, costruita in 3D con texture a pixel,
// abitata da sprite 16×16 su piani rivolti alla camera. La firma è tutta nella luce e nella lente:
// lanterne con luci puntiformi calde, luna fredda con raggi volumetrici, pulviscolo e lucciole,
// tilt-shift a bokeh che trasforma la piazza in un modellino, bagliore, grading caldo-freddo.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { initTex, casa, mat, trave } from './mondo.js?v=7';
import * as A from './arredi.js?v=7';
import { Pupo, Passante } from './personaggi.js?v=7';
import * as FX from './effetti.js?v=7';
import { creaPost } from './post.js?v=7';
import { rnd } from './pixel.js?v=7';

const Q = Demo.query;
Demo.carica('Accendo le lanterne', 0.05);

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: Demo.shot, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a16);
scene.fog = new THREE.Fog(0x0b1024, 26, 58);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 120);

const manager = new THREE.LoadingManager();
manager.onProgress = (u, a, b) => Demo.carica('Accendo le lanterne', 0.05 + 0.85 * a / b);
const finito = new Promise(res => { manager.onLoad = res; });
initTex(manager);
const loader = new THREE.TextureLoader(manager);
const rng = rnd(1917);

// ─────────────── luce: luna fredda + cielo notturno ───────────────
const DIR_LUNA = new THREE.Vector3(-0.55, 0.9, 0.42).normalize();
scene.add(new THREE.HemisphereLight(0x3550b0, 0x0c0a14, 0.32));
const luna = new THREE.DirectionalLight(0x8aa4ff, 0.8);
luna.castShadow = true;
luna.shadow.mapSize.set(2048, 2048);
Object.assign(luna.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
luna.shadow.bias = -0.0006; luna.shadow.normalBias = 0.03; luna.shadow.radius = 3;
scene.add(luna, luna.target);

// ─────────────── il borgo ───────────────
const acquaCanale = A.terreno(scene);
A.ponte(scene);
const FONT = { x: -2.5, z: -1.6 };
const acquaFont = A.fontana(scene, FONT.x, FONT.z);

const colliders = [];   // [x0,z0,x1,z1] rettangoli; {x,z,r} cerchi
const lanternePos = [];
const CASE = [
  // fila nord, facciate verso sud
  { x: -10.3, z: -12.2, nw: 4, nd: 4, piani: 2, tetto: 'rosso', timpano: true, camino: true },
  { x: -4.7, z: -12.2, nw: 5, nd: 4, piani: 1, tetto: 'grigio', timpano: false, camino: true, lant: true },
  { x: 0.9, z: -12.2, nw: 4, nd: 4, piani: 2, tetto: 'rosso', timpano: true },
  { x: 5.6, z: -12.0, nw: 3, nd: 4, piani: 1, tetto: 'paglia', timpano: true, porta: 1 },
  // fila ovest, facciate verso est
  { x: -15.2, z: -5.6, nw: 4, nd: 4, piani: 1, tetto: 'grigio', timpano: false, rot: Math.PI / 2, camino: true },
  { x: -15.2, z: 0.5, nw: 5, nd: 4, piani: 2, tetto: 'rosso', timpano: true, rot: Math.PI / 2, lant: true },
  { x: -15.2, z: 6.6, nw: 4, nd: 4, piani: 1, tetto: 'paglia', timpano: true, rot: Math.PI / 2 },
  // oltre il canale, facciate verso ovest
  { x: 15.6, z: -5.2, nw: 4, nd: 4, piani: 2, tetto: 'rosso', timpano: true, rot: -Math.PI / 2, lant: true },
  { x: 15.6, z: 2.3, nw: 3, nd: 4, piani: 1, tetto: 'grigio', timpano: false, rot: -Math.PI / 2, porta: 1 },
  { x: 15.6, z: 7.6, nw: 4, nd: 4, piani: 2, tetto: 'paglia', timpano: true, rot: -Math.PI / 2 },
  // seconda fila, dietro: tetti che si accavallano nella sfocatura
  { x: -7.5, z: -19.5, nw: 5, nd: 4, piani: 2, tetto: 'grigio', timpano: false },
  { x: 3.5, z: -19.8, nw: 4, nd: 4, piani: 2, tetto: 'rosso', timpano: true },
];
const porte = [], caseVis = [];
for (const o of CASE) {
  o.fioriera = A.fioriera;
  const c = casa(o, rng);
  scene.add(c.gruppo);
  caseVis.push({ g: c.gruppo, x: o.x, z: o.z, r: Math.max(o.nw, o.nd) * 0.55 + 0.8 });
  colliders.push(c.impronta);
  porte.push(c.porta);
  if (o.lant) { A.lanternaMuro(scene, c.lanterna, c.rot); lanternePos.push(c.lanterna.clone().add(new THREE.Vector3(0, 0.05, 0))); }
}
// torre campanaria sullo sfondo
{
  const tor = new THREE.Group(); tor.position.set(-1.5, 0, -27);
  const pietra = mat('wall_brick_stone_center');
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(4, 13, 4), pietra); corpo.position.y = 6.5; corpo.castShadow = true;
  const uv = corpo.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4 / 1.1, uv.getY(i) * (i < 16 ? 13 : 4) / 1.1);
  tor.add(corpo);
  const cusp = new THREE.Mesh(new THREE.ConeGeometry(3.4, 5, 4), mat('roof_clay_grey_center', { doppio: true })); cusp.position.y = 15.5; cusp.rotation.y = Math.PI / 4; tor.add(cusp);
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), mat('window_tall_rounded_lit', { lit: 0xffc070 })); f.position.set(s * 0.9, 10.5, 2.02); tor.add(f); }
  scene.add(tor);
}

// lampioni sulla piazza e sul ponte
for (const [x, z] of [[-7.2, -8.4], [3.6, -8.4], [6.9, -2.2], [12.8, 2.2], [-11.4, 3.2], [4.4, 5.6]]) {
  lanternePos.push(A.lampione(scene, x, z));
  colliders.push({ x, z, r: 0.35 });
}
const luci = lanternePos.map((p, i) => {
  const l = new THREE.PointLight(0xff9040, 30, 13, 1.7); l.position.copy(p); scene.add(l);
  return { l, fase: i * 1.73, base: 30 };
});
// luce della fontana: un filo azzurrino che fa brillare l'acqua
const lf = new THREE.PointLight(0x7fb0ff, 6, 6, 2); lf.position.set(FONT.x, 1.6, FONT.z); scene.add(lf);

// alberi, cespugli, aiuole
const ALBERI = [[-11.5, 11.2, 3, 3.0], [-8.0, 13.5, 5, 2.6], [5.5, 12.4, 8, 2.8], [18.8, 11.5, 11, 3.1], [-12, -9, 13, 2.4], [18.6, -10, 17, 2.7], [-17.5, 12.5, 19, 2.6]];
for (const [x, z, s, h] of ALBERI) { A.albero(scene, x, z, s, h); colliders.push({ x, z, r: 0.5 }); }
for (let i = 0; i < 14; i++) A.cespuglio(scene, -12 + i * 1.35 + (i % 3) * 0.2, 9.9 + (i % 2) * 0.25, 30 + i, 0.8 + (i % 3) * 0.15);
for (const [x, z, s] of [[-12.6, -2.6, 40], [-12.6, 3.6, 41], [7.2, -9.2, 42], [-3.6, -9.4, 43], [13.2, -1.6, 44], [13.2, 5.2, 45], [6.0, 8.6, 46]]) A.aiuola(scene, x, z, s);
for (const [x, z, s] of [[-9.8, -9.3, 50], [2.2, -9.4, 51], [13.3, -8.4, 52], [-12.7, 8.8, 53]]) A.cespuglio(scene, x, z, s, 1.0);
colliders.push([-13, 9.6, 7.7, 10.4]);      // siepe a sud

// panchine
function panchina(x, z, r) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r;
  const assi = mat('floor_wood_planks', { colore: 0xb89878 });
  const s = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), assi); s.position.y = 0.48; s.castShadow = s.receiveShadow = true; g.add(s);
  const sch = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.08), assi); sch.position.set(0, 0.8, -0.24); sch.castShadow = true; g.add(sch);
  for (const e of [-0.75, 0.75]) { const p = trave(0.1, 0.48, 0.45); p.position.set(e, 0.24, 0); g.add(p); }
  scene.add(g);
}
panchina(-8.3, -0.6, Math.PI / 2); colliders.push([-8.7, -1.6, -7.9, 0.4]);
panchina(2.6, -2.8, -Math.PI / 2); colliders.push([2.2, -3.8, 3.0, -1.8]);

// filo di lampadine sopra la piazza
A.festone(scene, new THREE.Vector3(-8.6, 4.6, -9.6), new THREE.Vector3(-11.8, 4.4, 1.5), 16, 1.0);
A.festone(scene, new THREE.Vector3(-3.0, 4.2, -9.6), new THREE.Vector3(6.6, 4.1, -2.4), 18, 1.1);
A.festone(scene, new THREE.Vector3(-12.7, 4.0, 4.5), new THREE.Vector3(-3.0, 4.0, -9.6), 22, 1.2);

// oggetti Kenney (stessa famiglia delle texture)
const gltf = new GLTFLoader(manager);
const OGGETTI = [['detail-barrel', -12.4, -8.3, 0.3], ['detail-barrel', -12.2, -7.6, 1.2], ['detail-crate', 7.0, -9.6, 0.2], ['barrels', 13.4, 4.4, 1.6], ['detail-crate-small', 7.2, -8.8, 0.9], ['detail-crate', -12.5, 8.0, 0.4], ['detail-barrel', 13.3, -7.6, 0]];
const promOggetti = [...new Set(OGGETTI.map(o => o[0]))].map(n => gltf.loadAsync(`assets/props/${n}.glb?v=7`).then(g => [n, g.scene]));

// ─────────────── aria e luce volumetrica ───────────────
const raggi = [];
for (const [x, z, r0, r1, f] of [[-6.5, 2.5, 0.7, 2.2, 0], [-0.8, 6.5, 0.5, 1.6, 2], [4.5, -4.5, 0.6, 1.9, 4], [-9.5, -4.2, 0.4, 1.4, 6]])
  raggi.push(FX.raggioLuna(scene, x, z, DIR_LUNA, r0, r1, 18, [0.07, 0.1, 0.2], f));
for (const p of lanternePos) FX.conoLanterna(scene, p, p.y + 0.1, 1.5);
const pts = FX.particelle(scene, {
  lucciole: [[9.8, 0, 22, 4.5], [-5.5, 13, 16, 5], [18, 10, 10, 3], [-12.5, 6, 8, 3]],
  lanterne: lanternePos, luna: [[-6.5, 2.5, 30], [-0.8, 6.5, 24], [4.5, -4.5, 24]], dirLuce: DIR_LUNA, fontana: FONT,
});
if (Q.get('fx') === '0') { pts.visible = false; raggi.forEach(r => r.visible = false); }
const aggRiflessi = FX.riflessi(scene, lanternePos.filter(p => p.x > 5 && p.x < 14), A.CANALE.acqua);

// ─────────────── personaggi ───────────────
const eroe = new Pupo(scene, loader, 'Hunter', -2.5, 4.2);
eroe.dir = Number(Q.get('yaw') ?? 1) * Math.PI / 4;   // all'inizio guarda la camera
const giro = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; giro.push([FONT.x + Math.cos(a) * 3.6, FONT.z + Math.sin(a) * 3.6, i === 3 ? 2.5 : 0]); }
const passanti = [
  new Passante(scene, loader, 'Woman', giro, 1.0),
  new Passante(scene, loader, 'Villager3', [[-11.5, 0.8, 2], [-5, 5.5, 0], [5.5, 0, 0], [9.8, 0, 0], [13.2, 0.4, 2.5], [9.8, 0, 0], [5.5, 0, 0], [-5, 5.5, 0]], 1.3),
  new Passante(scene, loader, 'OldMan', [[-5.6, 5.4, 3], [-1.2, 1.0, 3]], 0.6),
  new Passante(scene, loader, 'Monk', [[13.4, -9, 1], [13.2, -1.8, 0], [13.2, 6.2, 3], [13.2, -1.8, 0]], 0.8),
  new Passante(scene, loader, 'Knight', [[6.2, 1.9, 5], [6.2, -1.6, 5]], 0.7),
];
passanti[0].i = 3; passanti[0].pos.set(giro[2][0], 0, giro[2][1]);

// ─────────────── camera da diorama ───────────────
let yawMeta = Number(Q.get('yaw') ?? 1) * Math.PI / 4, yaw = yawMeta;
const bersaglio = new THREE.Vector3(eroe.pos.x - Math.sin(yaw) * 1.2, 0.9, eroe.pos.z - Math.cos(yaw) * 1.2);
const DIST = Number(Q.get('dist') ?? 17), BECCHEGGIO = THREE.MathUtils.degToRad(Number(Q.get('pitch') ?? 27));
function piazzaCamera() {
  const h = Math.sin(BECCHEGGIO) * DIST, o = Math.cos(BECCHEGGIO) * DIST;
  camera.position.set(bersaglio.x + Math.sin(yaw) * o, bersaglio.y + h, bersaglio.z + Math.cos(yaw) * o);
  camera.lookAt(bersaglio);
}

// ─────────────── post-produzione ───────────────
const post = creaPost(renderer, scene, camera);
function ridimensiona() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
  FX.U.uScala.value = innerHeight / 1080 * 2.6;
}
addEventListener('resize', ridimensiona);
ridimensiona();

// ─────────────── movimento e urti ───────────────
function libero(x, z, r = 0.42) {
  if (x < -12.8 || x > 13.2 + 5 || z < -9.9 || z > 9.4) return false;
  if (x > A.CANALE.x0 - 0.15 && x < A.CANALE.x1 + 0.15 && Math.abs(z) > A.PONTE.mezzaL - 0.3) return false;
  for (const c of colliders) {
    if (Array.isArray(c)) { if (x > c[0] - r && x < c[2] + r && z > c[1] - r && z < c[3] + r) return false; }
    else if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
  }
  if (Math.hypot(x - FONT.x, z - FONT.z) < 2.6 + r) return false;
  return true;
}
const tieniPasso = Q.get('passo');

Demo.loop((dt, t) => {
  FX.U.uT.value = t;
  // Q/E (e LB/RB del pad): la visuale gira a scatti di 45°, con un'interpolazione morbida
  if (Demo.premuto('q')) yawMeta -= Math.PI / 4;
  if (Demo.premuto('e')) yawMeta += Math.PI / 4;
  yaw += (yawMeta - yaw) * (1 - Math.exp(-dt * 7));

  const a = Demo.asse();
  const m = Math.min(1, Math.hypot(a.x, a.y));
  if (m > 0.1) {
    // avanti = lontano dalla camera
    const vx = Math.cos(yaw) * a.x - Math.sin(yaw) * a.y, vz = -Math.sin(yaw) * a.x - Math.cos(yaw) * a.y;
    const l = Math.hypot(vx, vz), v = 3.4 * m;
    const dx = vx / l * v * dt, dz = vz / l * v * dt;
    if (libero(eroe.pos.x + dx, eroe.pos.z)) eroe.pos.x += dx;
    if (libero(eroe.pos.x, eroe.pos.z + dz)) eroe.pos.z += dz;
    eroe.dir = Math.atan2(vx, vz); eroe.vel = v;
  } else eroe.vel = 0;
  eroe.aggiorna(dt, yaw);
  for (const p of passanti) { p.muovi(dt); p.aggiorna(dt, yaw); }

  // la camera insegue con calma, un po' più avanti di dove si guarda
  const k = 1 - Math.exp(-dt * 4);
  // il bersaglio sta un paio di metri oltre l'eroe: l'eroe resta nel terzo basso, le facciate entrano in scena
  const ax = eroe.pos.x - Math.sin(yaw) * 1.2, az = eroe.pos.z - Math.cos(yaw) * 1.2;
  bersaglio.x += (ax - bersaglio.x) * k;
  bersaglio.z += (az - bersaglio.z) * k;
  bersaglio.y += (A.altezza(eroe.pos.x, eroe.pos.z) + 0.9 - bersaglio.y) * k;
  piazzaCamera();
  luna.position.copy(bersaglio).addScaledVector(DIR_LUNA, 40); luna.target.position.copy(bersaglio);

  // le case fra la camera e l'eroe spariscono, come nei diorami che si aprono verso chi guarda
  const cx = Math.sin(yaw), cz = Math.cos(yaw);
  for (const h of caseVis) {
    const dx = h.x - eroe.pos.x, dz = h.z - eroe.pos.z;
    const lungo = dx * cx + dz * cz, lato = Math.abs(dx * cz - dz * cx);
    h.g.visible = !(lungo > 1.5 && lato < h.r + 1.5);
  }
  A.aggiornaCartelli(yaw, t);
  for (const L of luci) L.l.intensity = L.base * (0.9 + 0.07 * Math.sin(t * 9.1 + L.fase) + 0.05 * Math.sin(t * 23.7 + L.fase * 2));
  acquaCanale.userData.t.offset.set(Math.sin(t * 0.3) * 0.05, t * 0.035);
  acquaFont.userData.t.offset.set(t * 0.02, t * 0.05);
  aggRiflessi(camera, t, A.CANALE.x0, A.CANALE.x1);

  // il fuoco della lente segue l'eroe sullo schermo
  const s = eroe.mesh.position.clone(); s.y += 0.7; s.project(camera);
  // la fascia a fuoco è il terzo centrale; segue l'eroe solo se esce da lì
  post.tilt.u.uFuoco.value = THREE.MathUtils.clamp(s.y * 0.5 + 0.5 + 0.12, 0.44, 0.56);
  post.grade.uniforms.uT.value = t;
  if (Q.get('post') === '0') renderer.render(scene, camera); else post.comp.render(dt);
});

// ─────────────── attesa del caricamento ───────────────
(async () => {
  const og = Object.fromEntries(await Promise.all(promOggetti));
  for (const [n, x, z, r] of OGGETTI) {
    const o = og[n].clone(); o.position.set(x, 0, z); o.rotation.y = r; o.scale.setScalar(1.0);
    o.traverse(c => { if (c.isMesh) { c.castShadow = c.receiveShadow = true; if (c.material.map) { c.material.map.magFilter = THREE.NearestFilter; } } });
    scene.add(o); colliders.push({ x, z, r: 0.55 });
  }
  await finito;
  Demo.extra('<p>Gli sprite sono fogli da 16×16 pixel; la piazza è 3D, ma ogni texture è pixel art a filtro nearest. Lo sfocato in alto e in basso è una sfocatura a disco che fa dei punti di luce dei dischi di bokeh.</p>');
  Demo.pronto();
})().catch(Demo.errore);
