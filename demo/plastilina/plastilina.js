// Plastilina a passo uno, alla Aardman: un giardinetto da tavolo con un pupazzo.
// La firma è il tempo: tutto ciò che si anima si aggiorna a 12 pose al secondo, e a ogni posa la
// superficie "bolle" (il rumore delle impronte digitali cambia seme), mentre la camera resta fluida.
// Materiale: Standard con luce avvolgente (finta diffusione sottopelle) e impronte procedurali
// nella normale. Luce da studio calda, ombre morbide, profondità di campo da modellino.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Q = Demo.query;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: Demo.shot });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1512);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.3, 80);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;

// ─────────────────────────── il materiale plastilina ───────────────────────────
const POSA = { value: 0 };   // indice della posa corrente: cambia 12 volte al secondo
const IMPRONTE = `
varying vec3 vOP;
uniform float uPosa, uBump, uBolle, uScala; uniform vec3 uSSS;
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 h33(vec3 p){ return vec3(h31(p), h31(p + 17.3), h31(p + 41.7)); }
float vn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float polpastrello(vec3 q, float k, float sal){
  vec3 cell = floor(q * k), f = fract(q * k);
  vec3 r = h33(cell + sal);
  vec3 dv = (f - (0.32 + r * 0.36)) * vec3(1.0, 1.4, 1.0);
  float d = length(dv);
  float mask = (1.0 - smoothstep(0.10, 0.24, d)) * step(0.4, r.x);
  float fr = d * 160.0;
  float aa = 1.0 - smoothstep(0.4, 1.2, fwidth(fr));
  float righe = sin(fr + vn3(q * 9.0) * 5.0) * 0.5 * aa;
  return mask * (righe * 0.45 - 0.55);
}
// l'altezza della superficie: ammaccature larghe, graffi di stecca, polpastrelli a righe concentriche.
// A ogni posa tutto si sposta di un soffio: è la plastilina toccata fra uno scatto e l'altro.
float impronte(vec3 p){
  vec3 sh = (h33(vec3(uPosa, 1.3, 7.1)) - 0.5) * 0.16 * uBolle;
  vec3 q = p + sh;
  float h = (vn3(q * 2.3) - 0.5) * 0.9 + (vn3(q * 5.3 + 3.0) - 0.5) * 0.25 + (vn3(q * 13.0) - 0.5) * 0.04;
  h += (polpastrello(q, 1.7, 0.0) + polpastrello(q + 0.37, 2.3, 5.0) * 0.8) * 0.7;
  return h * 0.028;
}
vec3 perturbaNormale(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection){
  // derivate non normalizzate (Mikkelsen): così il rilievo è in unità del mondo, non dei pixel
  vec3 vSigmaX = dFdx(surf_pos), vSigmaY = dFdy(surf_pos), vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN), R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  vec3 n = abs(fDet) * surf_norm - vGrad;
  // derivate degeneri (bordi, pixel minuscoli): meglio la normale liscia che un NaN
  return dot(n, n) > 1e-24 ? normalize(n) : surf_norm;
}`;
// luce avvolgente: la luce "gira" oltre il terminatore, e lì la plastilina si scalda di rosso
const LUCI_CERA = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
  /float dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\s*vec3 irradiance = dotNL \* directLight\.color;/,
  `float nl = dot( geometryNormal, directLight.direction );
  float dotNL = saturate( ( nl + 0.45 ) / 1.45 );
  float fascia = smoothstep( -0.45, 0.0, nl ) * ( 1.0 - smoothstep( 0.0, 0.5, nl ) );
  vec3 irradiance = dotNL * directLight.color * mix( vec3( 1.0 ), uSSS, fascia );
  vec3 irrSpec = saturate( nl ) * directLight.color;`).replace(
  // il riflesso speculare resta quello vero: con la luce avvolgente esploderebbe sui bordi
  'reflectedLight.directSpecular += irradiance *', 'reflectedLight.directSpecular += irrSpec *');
if (LUCI_CERA === THREE.ShaderChunk.lights_physical_pars_fragment) console.warn('luce avvolgente non applicata');

const materiali = [];
/** Plastilina: colore, ruvidezza, forza delle impronte, quanto "bolle", scala del disegno. */
function argilla(colore, opz = {}) {
  const m = new THREE.MeshStandardMaterial({ color: colore, roughness: opz.rough ?? 0.62, metalness: 0 });
  const u = {
    uPosa: POSA, uBump: { value: (opz.bump ?? 1) * Number(Q.get('bump') ?? 1) }, uBolle: { value: opz.bolle ?? 1 }, uScala: { value: opz.scala ?? 1 },
    uSSS: { value: new THREE.Color(opz.sss ?? 0xffb090).multiplyScalar(1.5) },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + IMPRONTE)
      .replace('#include <lights_physical_pars_fragment>', LUCI_CERA)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float hh = impronte(vOP * uScala);
          // di taglio le derivate impazziscono: lì il rilievo si spegne (niente puntini bianchi sui bordi)
          float fronte = smoothstep(0.08, 0.4, abs(dot(normal, normalize(vViewPosition))));
          vec2 dh = vec2(dFdx(hh), dFdy(hh)) * uBump * fronte;
          normal = perturbaNormale(-vViewPosition, normal, dh, faceDirection); }`);
  };
  m.customProgramCacheKey = () => 'argilla';
  materiali.push(m);
  return m;
}
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };

// ─────────────────────────── texture dipinte ───────────────────────────
function rndSeme(s) { let r = s; return () => ((r = (r * 16807) % 2147483647) / 2147483647); }
function texFondale() {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const rnd = rndSeme(77);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#4f8fd6'); gr.addColorStop(0.55, '#9fcbea'); gr.addColorStop(0.8, '#e6ecd2'); gr.addColorStop(1, '#f1e2bc');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // pennellate: la trama del pennello su tutto il cielo
  const pennellata = (x, y, l, w, col) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath();
    g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y + (rnd() - 0.5) * 8, x + l, y + (rnd() - 0.5) * 6); g.stroke();
  };
  for (let i = 0; i < 1600; i++) {
    const y = rnd() * H * 0.8, chiaro = rnd() < 0.5;
    pennellata(rnd() * W - 40, y, 30 + rnd() * 90, 3 + rnd() * 7, chiaro ? `rgba(255,255,255,${0.03 + rnd() * 0.05})` : `rgba(40,80,140,${0.02 + rnd() * 0.04})`);
  }
  // sole di cartone
  g.fillStyle = '#ffe79a'; g.beginPath(); g.arc(800, 120, 44, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,240,180,0.35)'; g.beginPath(); g.arc(800, 120, 62, 0, Math.PI * 2); g.fill();
  // nuvole: grumi di ellissi bianche con l'ombra grigio-azzurra sotto
  const nuvola = (cx, cy, s) => {
    const bolle = [];
    for (let i = 0; i < 7; i++) bolle.push([cx + (i - 3) * 22 * s + (rnd() - 0.5) * 10 * s, cy - Math.sin(i / 6 * Math.PI) * 18 * s + (rnd() - 0.5) * 6 * s, (18 + Math.sin(i / 6 * Math.PI) * 16 + rnd() * 6) * s]);
    g.fillStyle = '#c9d6e6'; for (const [x, y, r] of bolle) { g.beginPath(); g.ellipse(x, y + 5 * s, r * 1.2, r, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#fbfaf4'; for (const [x, y, r] of bolle) { g.beginPath(); g.ellipse(x, y, r * 1.12, r * 0.92, 0, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 40; i++) pennellata(cx + (rnd() - 0.6) * 150 * s, cy + (rnd() - 0.6) * 30 * s, 20 * s, 3, 'rgba(255,255,255,0.35)');
  };
  nuvola(170, 110, 1.3); nuvola(470, 70, 1.0); nuvola(650, 170, 0.8); nuvola(930, 60, 0.9);
  // colline dipinte in due piani, con il bordo ondulato
  const collina = (base, amp, col, seme) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.006 + seme) * Math.cos(x * 0.011 + seme * 2)) - Math.sin(x * 0.05) * 3);
    g.lineTo(W, H); g.fill();
    for (let i = 0; i < 300; i++) pennellata(rnd() * W, base - rnd() * amp * 0.4 + 20 + rnd() * (H - base), 20 + rnd() * 40, 4, `rgba(20,50,20,${0.05 + rnd() * 0.05})`);
  };
  collina(390, 90, '#8cbf72', 1.0);
  collina(440, 70, '#6fa656', 3.0);
  // puntini di "alberi" dipinti
  for (let i = 0; i < 26; i++) { const x = rnd() * W, y = 380 + rnd() * 50; g.fillStyle = rnd() < 0.5 ? '#4e8a42' : '#3f7a3a'; g.beginPath(); g.ellipse(x, y, 10 + rnd() * 8, 14 + rnd() * 10, 0, 0, Math.PI * 2); g.fill(); }
  // grana del cartone
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function texLegno(chiaro) {
  const S = 512; const cv = document.createElement('canvas'); cv.width = S; cv.height = S; const g = cv.getContext('2d');
  const rnd = rndSeme(chiaro ? 5 : 9);
  g.fillStyle = chiaro ? '#b98a5a' : '#6b4429'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const y = rnd() * S; g.strokeStyle = chiaro ? `rgba(120,70,30,${0.08 + rnd() * 0.12})` : `rgba(30,15,5,${0.10 + rnd() * 0.15})`;
    g.lineWidth = 1 + rnd() * 3; g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= S; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3 + Math.sin(x * 0.005 + i * 0.3) * 6);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ─────────────────────────── il set ───────────────────────────
const R_BASE = 4.1;
/** quota della superficie erbosa del diorama (leggera cupola) */
const quotaPrato = (x, z) => 0.62 - 0.2 * Math.min(1, (x * x + z * z) / (R_BASE * R_BASE));
const ostacoli = [];
const animati = [];   // oggetti con un'animazione propria (fiori), aggiornati a passo uno

function costruisciSet() {
  // tavolo e basamento di legno
  const legnoT = texLegno(false); legnoT.repeat.set(3, 3);
  const tavolo = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: legnoT, roughness: 0.6 }));
  tavolo.rotation.x = -Math.PI / 2; tavolo.receiveShadow = true; scene.add(tavolo);
  const legnoB = texLegno(true);
  const base = mesh(new THREE.CylinderGeometry(4.45, 4.5, 0.32, 64), new THREE.MeshStandardMaterial({ map: legnoB, roughness: 0.55 }), 0, 0.16, 0);
  scene.add(base);

  // prato di plastilina: una cupola bassa col bordo arrotondato
  const prof = [];
  for (let i = 0; i <= 24; i++) { const r = i / 24 * (R_BASE - 0.12); prof.push(new THREE.Vector2(r, quotaPrato(r, 0))); }
  for (let i = 1; i <= 8; i++) { const a = i / 8 * Math.PI / 2; prof.push(new THREE.Vector2(R_BASE - 0.12 + Math.sin(a) * 0.12, quotaPrato(R_BASE, 0) - (1 - Math.cos(a)) * 0.12 - 0.0)); }
  prof.push(new THREE.Vector2(R_BASE, 0.3));
  const prato = mesh(new THREE.LatheGeometry(prof.reverse(), 96), argilla(0x4fa03a, { scala: 1.4, bolle: 0.25, sss: 0xd8ff90 }));
  prato.geometry.computeVertexNormals();
  scene.add(prato);

  // ciuffi d'erba: coni di plastilina schiacciati fra le dita
  const erba = [], rnd = rndSeme(31);
  for (let i = 0; i < 90; i++) {
    const a = rnd() * 6.28, r = 0.6 + rnd() * 3.2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const c = new THREE.ConeGeometry(0.035 + rnd() * 0.02, 0.18 + rnd() * 0.12, 5); c.rotateZ((rnd() - 0.5) * 0.6); c.rotateX((rnd() - 0.5) * 0.6);
    c.translate(x, quotaPrato(x, z) + 0.08, z); erba.push(c);
  }
  scene.add(mesh(mergeGeometries(erba), argilla(0x4a9a35, { bolle: 0.4 })));

  // vialetto di sassolini piatti
  const sassi = [];
  for (let i = 0; i < 16; i++) {
    const s = i / 15, x = -0.2 + Math.sin(s * 2.6) * 0.9 + (rnd() - 0.5) * 0.15, z = 3.4 - s * 3.6;
    const g = new THREE.SphereGeometry(0.2 + rnd() * 0.06, 16, 10); g.scale(1.2, 0.28, 0.9); g.rotateY(rnd() * 3); g.translate(x, quotaPrato(x, z) + 0.02, z); sassi.push(g);
  }
  scene.add(mesh(mergeGeometries(sassi), argilla(0xd9c9a8, { bolle: 0.3, scala: 2.0 })));

  // cuccia (un omaggio a Gromit): pareti color panna, tetto rosso, porta ad arco scura
  {
    const g = new THREE.Group();
    const panna = argilla(0xefe2c4, { bolle: 0.3, scala: 1.6 }), rosso = argilla(0xc9362c, { bolle: 0.3, scala: 1.6 }), scuro = argilla(0x2a1a14, { bolle: 0.2 });
    g.add(mesh(new RoundedBoxGeometry(1.3, 0.95, 1.1, 4, 0.09), panna, 0, 0.48, 0));
    const tetto = (s) => { const m = mesh(new RoundedBoxGeometry(0.95, 0.1, 1.35, 3, 0.04), rosso, s * 0.4, 1.18, 0); m.rotation.z = -s * 0.72; return m; };
    g.add(tetto(1), tetto(-1));
    const timpano = new THREE.Shape(); timpano.moveTo(-0.66, 0); timpano.lineTo(0.66, 0); timpano.lineTo(0, 0.58); timpano.closePath();
    const tg = new THREE.ExtrudeGeometry(timpano, { depth: 1.0, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3 });
    tg.translate(0, 0.92, -0.5); g.add(mesh(tg, panna));
    const porta = new THREE.Shape(); porta.moveTo(-0.26, 0); porta.lineTo(0.26, 0); porta.lineTo(0.26, 0.38); porta.absarc(0, 0.38, 0.26, 0, Math.PI, false); porta.closePath();
    const pg = new THREE.ExtrudeGeometry(porta, { depth: 0.04, bevelEnabled: false }); pg.translate(0, 0.03, 0.54); g.add(mesh(pg, scuro));
    // targhetta col nome
    g.add(mesh(new RoundedBoxGeometry(0.46, 0.14, 0.04, 2, 0.02), argilla(0xf6d36a, { bolle: 0.3 }), 0, 0.84, 0.57));
    g.position.set(-1.75, quotaPrato(-1.75, -1.7) - 0.02, -1.7); g.rotation.y = 0.45;
    scene.add(g); ostacoli.push({ x: -1.75, z: -1.7, r: 0.95 });
  }

  // albero: tronco a pasta, chioma a palle, mele rosse
  {
    const g = new THREE.Group();
    const tr = new THREE.CylinderGeometry(0.16, 0.26, 1.7, 16, 6); tr.translate(0, 0.85, 0);
    const p = tr.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 2.2) * 0.06); }
    tr.computeVertexNormals();
    g.add(mesh(tr, argilla(0x7b4a2a, { scala: 2.5, bolle: 0.3, sss: 0xffa070 })));
    const verde = argilla(0x3f9a3a, { bolle: 0.35, scala: 1.3, sss: 0xc0ff80 }), verde2 = argilla(0x55b046, { bolle: 0.35, scala: 1.3, sss: 0xc0ff80 });
    [[0, 2.05, 0, 0.62], [0.45, 1.8, 0.15, 0.45], [-0.42, 1.85, 0.1, 0.48], [0.05, 1.75, -0.4, 0.46], [0.1, 2.5, 0.05, 0.4]].forEach(([x, y, z, r], i) =>
      g.add(mesh(new THREE.SphereGeometry(r, 32, 20), i % 2 ? verde2 : verde, x, y, z)));
    const mela = argilla(0xd8322a, { rough: 0.35, bolle: 0.4 });
    [[0.35, 1.95, 0.55], [-0.45, 2.1, 0.42], [0.62, 1.55, 0.32], [-0.1, 1.55, 0.55]].forEach(([x, y, z]) => g.add(mesh(new THREE.SphereGeometry(0.085, 16, 12), mela, x, y, z)));
    g.position.set(2.05, quotaPrato(2.05, -1.55) - 0.02, -1.55);
    scene.add(g); ostacoli.push({ x: 2.05, z: -1.55, r: 0.45 });
  }

  // aiuola con fiori che ondeggiano (a scatti, come tutto il resto)
  {
    const ax = 2.1, az = 1.1;
    const terra = new THREE.SphereGeometry(1, 40, 20); terra.scale(1.05, 0.2, 0.62);
    const aiuola = mesh(terra, argilla(0x5a3a26, { scala: 2.2, bolle: 0.3, sss: 0xff9060 }), ax, quotaPrato(ax, az) - 0.02, az);
    aiuola.rotation.y = -0.4; scene.add(aiuola);
    ostacoli.push({ x: ax, z: az, r: 0.8 });
    const stelo = argilla(0x3f8a30, { bolle: 0.5 });
    const colori = [0xe84a5f, 0xf7c948, 0xa05ad8, 0xff8a3c, 0xf2f0e8, 0xe84a5f, 0xf7c948];
    for (let i = 0; i < 7; i++) {
      const u = (i / 6 - 0.5) * 1.6, v = (i % 2 ? 0.2 : -0.2);
      const x = ax + Math.cos(-0.4) * u - Math.sin(-0.4) * v, z = az + Math.sin(-0.4) * u + Math.cos(-0.4) * v;
      const f = new THREE.Group();
      const h = 0.55 + (i % 3) * 0.12;
      const st = new THREE.CylinderGeometry(0.025, 0.035, h, 8); st.translate(0, h / 2, 0);
      f.add(mesh(st, stelo));
      const foglia = new THREE.SphereGeometry(0.1, 12, 8); foglia.scale(1.6, 0.35, 0.7); foglia.translate(0.12, h * 0.35, 0); foglia.rotateY(i);
      f.add(mesh(foglia, stelo));
      const col = argilla(colori[i], { rough: 0.45, bolle: 1.0 });
      if (i % 2 === 0) {   // tulipano
        const petali = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.09, 0.03), new THREE.Vector2(0.12, 0.12), new THREE.Vector2(0.1, 0.22), new THREE.Vector2(0.07, 0.25)], 16);
        petali.translate(0, h - 0.02, 0); f.add(mesh(petali, col));
      } else {             // margherita
        f.add(mesh(new THREE.SphereGeometry(0.06, 14, 10), argilla(0xf2b233, { bolle: 1 }), 0, h + 0.02, 0.02));
        for (let k = 0; k < 7; k++) {
          const pet = new THREE.SphereGeometry(0.05, 10, 8); pet.scale(1.9, 0.45, 0.9); pet.translate(0.1, 0, 0); pet.rotateY(k / 7 * Math.PI * 2);
          const pm = mesh(pet, col, 0, h + 0.01, 0); pm.rotation.x = 0.5; f.add(pm);
        }
      }
      f.position.set(x, quotaPrato(x, z) + 0.05, z);
      scene.add(f);
      animati.push({ obj: f, fase: i * 1.7 });
    }
  }

  // stagno: un disco azzurro più lucido, bordato di sassi, con una ninfea
  {
    const px = -2.0, pz = 1.2;
    const acqua = mesh(new THREE.CircleGeometry(0.82, 48), argilla(0x3aa6d9, { rough: 0.12, bump: 0.5, bolle: 0.6, scala: 1.2, sss: 0x90e0ff }), px, quotaPrato(px, pz) + 0.035, pz);
    acqua.rotation.x = -Math.PI / 2; acqua.scale.set(1, 0.75, 1); scene.add(acqua);
    const pietra = argilla(0x9b958c, { scala: 2.5, bolle: 0.3, sss: 0xffc0a0 }), pietra2 = argilla(0x7f7a74, { scala: 2.5, bolle: 0.3 });
    const r2 = rndSeme(3);
    for (let i = 0; i < 15; i++) {
      const a = i / 15 * Math.PI * 2, x = px + Math.cos(a) * 0.88, z = pz + Math.sin(a) * 0.66;
      const s = new THREE.SphereGeometry(0.13 + r2() * 0.06, 16, 10); s.scale(1.2, 0.65, 1);
      const m = mesh(s, i % 3 ? pietra : pietra2, x, quotaPrato(x, z) + 0.04, z); m.rotation.y = a; scene.add(m);
    }
    const ninfea = new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20, 1, false, 0.4, Math.PI * 1.8);
    scene.add(mesh(ninfea, argilla(0x4aa040, { bolle: 0.8 }), px + 0.25, quotaPrato(px, pz) + 0.06, pz - 0.1));
    scene.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), argilla(0xf6a0c0, { bolle: 1 }), px + 0.27, quotaPrato(px, pz) + 0.1, pz - 0.1));
    ostacoli.push({ x: px, z: pz, r: 0.9 });
  }

  // funghetto rosso a pois vicino all'albero
  {
    const fx = 2.9, fz = -0.6;
    const g = new THREE.Group();
    const gambo = new THREE.CylinderGeometry(0.08, 0.11, 0.3, 14); gambo.translate(0, 0.15, 0);
    g.add(mesh(gambo, argilla(0xf2e8d0, { bolle: 0.8 })));
    const cappello = new THREE.SphereGeometry(0.24, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); cappello.scale(1, 0.7, 1); cappello.translate(0, 0.27, 0);
    g.add(mesh(cappello, argilla(0xe0302a, { rough: 0.4, bolle: 0.8 })));
    const pois = argilla(0xfaf6ea, { bolle: 0.8 });
    for (let i = 0; i < 6; i++) { const a = i * 1.1, rr = i === 0 ? 0 : 0.15; const s = new THREE.SphereGeometry(0.035, 10, 6); s.scale(1, 0.4, 1);
      g.add(mesh(s, pois, Math.cos(a) * rr, 0.27 + Math.sqrt(Math.max(0, 0.24 * 0.24 - rr * rr)) * 0.7, Math.sin(a) * rr)); }
    g.position.set(fx, quotaPrato(fx, fz), fz); g.scale.setScalar(1.2);
    scene.add(g); ostacoli.push({ x: fx, z: fz, r: 0.3 });
  }

  // steccato sul retro: assicelle arrotondate e due traverse
  {
    const pezzi = [], traverse = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + 0.35 + i / 16 * (Math.PI - 0.7), r = R_BASE - 0.35, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const b = new RoundedBoxGeometry(0.2, 0.75 + (i % 2) * 0.06, 0.06, 2, 0.03);
      b.rotateY(-a + Math.PI / 2); b.translate(x, quotaPrato(x, z) + 0.36, z); pezzi.push(b);
      if (i < 16) {
        const a2 = a + (Math.PI - 0.7) / 32, x2 = Math.cos(a2) * (r - 0.05), z2 = Math.sin(a2) * (r - 0.05);
        const len = 2 * Math.sin((Math.PI - 0.7) / 32) * r + 0.06;
        for (const y of [0.2, 0.52]) { const t = new RoundedBoxGeometry(len, 0.07, 0.05, 2, 0.02); t.rotateY(-a2 + Math.PI / 2); t.translate(x2, quotaPrato(x2, z2) + y, z2); traverse.push(t); }
      }
    }
    scene.add(mesh(mergeGeometries(pezzi), argilla(0xf4efe2, { bolle: 0.3, scala: 2 })));
    scene.add(mesh(mergeGeometries(traverse), argilla(0xe8e0cc, { bolle: 0.3, scala: 2 })));
  }

  // fondale di cartone dipinto, curvo, appoggiato dietro al diorama
  {
    const geo = new THREE.CylinderGeometry(8.5, 8.5, 6.5, 64, 1, true, Math.PI - 1.3, 2.6);
    geo.translate(0, 3.25, 0);
    const fondale = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texFondale(), roughness: 0.92, side: THREE.BackSide }));
    fondale.position.z = 2.2; fondale.receiveShadow = true;
    scene.add(fondale);
  }
}

// ─────────────────────────── il pupazzo ───────────────────────────
const pupazzo = new THREE.Group();
const P = {};
function costruisciPupazzo() {
  const pelle = argilla(0xd4682c, { bolle: 1.3, scala: 2.2, sss: 0xff8060 });
  const bianco = argilla(0xf5f0e6, { rough: 0.3, bolle: 1.0, scala: 3, sss: 0xffe0d0 });
  const nero = argilla(0x151010, { rough: 0.25, bolle: 0.6, scala: 3 });
  const naso = argilla(0xc0541f, { rough: 0.4, bolle: 1.3, scala: 3.5, sss: 0xff7050 });
  const bocca = argilla(0x3a1310, { rough: 0.5, bolle: 1, scala: 3 });

  P.corpo = new THREE.Group(); pupazzo.add(P.corpo);
  // corpo a goccia tornito: largo in basso, testa tonda in alto
  const prof = [[0, 0.0], [0.2, 0.012], [0.34, 0.06], [0.43, 0.17], [0.46, 0.3], [0.45, 0.44], [0.41, 0.58], [0.36, 0.72], [0.31, 0.85], [0.24, 0.96], [0.14, 1.03], [0, 1.06]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const corpo = mesh(new THREE.LatheGeometry(prof, 48), pelle, 0, 0.06, 0);
  P.corpo.add(corpo);
  // occhi grandi da pupazzo, con palpebre e pupille che guardano
  P.occhi = []; P.palpebre = [];
  for (const s of [-1, 1]) {
    const o = mesh(new THREE.SphereGeometry(0.135, 28, 18), bianco, s * 0.12, 0.9, 0.2);
    o.scale.set(1, 1.12, 0.9);
    const pup = mesh(new THREE.SphereGeometry(0.058, 18, 12), nero, 0, 0.0, 0.118); pup.scale.set(1, 1.1, 0.5);
    const luce = mesh(new THREE.SphereGeometry(0.016, 8, 6), bianco, 0.022, 0.03, 0.03); pup.add(luce);
    o.add(pup);
    const palp = mesh(new THREE.SphereGeometry(0.143, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), pelle, 0, 0, 0);
    o.add(palp);
    P.corpo.add(o); P.occhi.push(pup); P.palpebre.push(palp);
  }
  P.naso = mesh(new THREE.SphereGeometry(0.092, 20, 14), naso, 0, 0.75, 0.37); P.naso.scale.set(1.15, 0.9, 1);
  P.corpo.add(P.naso);
  // bocca: un arco scuro a sorriso
  const bg = new THREE.TorusGeometry(0.12, 0.024, 10, 24, Math.PI); bg.rotateZ(Math.PI);
  P.bocca = mesh(bg, bocca, 0, 0.66, 0.385); P.bocca.rotation.x = -0.35; P.bocca.scale.set(1, 0.8, 1);
  P.corpo.add(P.bocca);
  // braccia a salsicciotto con le manine
  P.braccia = [];
  for (const s of [-1, 1]) {
    const spalla = new THREE.Group(); spalla.position.set(s * 0.4, 0.55, 0.02);
    const b = new THREE.CapsuleGeometry(0.068, 0.26, 6, 14); b.translate(0, -0.18, 0);
    spalla.add(mesh(b, pelle));
    spalla.add(mesh(new THREE.SphereGeometry(0.09, 16, 12), pelle, 0, -0.38, 0.01));
    spalla.rotation.z = s * 0.28;
    P.corpo.add(spalla); P.braccia.push(spalla);
  }
  // piedi
  P.piedi = [];
  for (const s of [-1, 1]) {
    const pg = new THREE.SphereGeometry(0.13, 20, 12); pg.scale(1, 0.55, 1.45);
    const p = mesh(pg, pelle, s * 0.17, 0.06, 0.06);
    pupazzo.add(p); P.piedi.push(p);
  }
  scene.add(pupazzo);
}

// la posa: tutto quello che si muove si calcola da qui, 12 volte al secondo
const stato = { x: 0.35, z: 1.35, rot: 0.25, vel: 0, fase: 0, cammina: 0 };
function applicaPosa(n) {
  const tq = n / 12;
  const s = Math.sin(stato.fase * Math.PI * 2), c2 = Math.cos(stato.fase * Math.PI * 4);
  const k = stato.cammina;   // 0 fermo, 1 in cammino
  pupazzo.position.set(stato.x, quotaPrato(stato.x, stato.z), stato.z);
  pupazzo.rotation.y = stato.rot;
  // corpo: sobbalzo, schiacciamento e allungamento, dondolio
  const respiro = Math.sin(tq * 2.6) * 0.018 * (1 - k);
  P.corpo.position.y = 0.04 + k * Math.abs(s) * 0.06;
  P.corpo.scale.set(1 + k * c2 * 0.03 - respiro * 0.5, 1 - k * c2 * 0.05 + respiro, 1 + k * c2 * 0.03 - respiro * 0.5);
  P.corpo.rotation.set(k * 0.1, 0, k * s * 0.07 + (1 - k) * Math.sin(tq * 0.9) * 0.03);
  // piedi alternati
  P.piedi.forEach((p, i) => {
    const ss = i ? -s : s;
    p.position.z = 0.06 + k * ss * 0.16;
    p.position.y = 0.06 + k * Math.max(0, ss) * 0.1;
    p.rotation.x = -k * ss * 0.35;
  });
  // braccia che dondolano
  P.braccia.forEach((b, i) => { b.rotation.x = k * (i ? s : -s) * 0.7 + (1 - k) * Math.sin(tq * 1.3 + i) * 0.06; });
  // sguardo e ammiccamento
  const giro = (1 - k) * Math.sin(tq * 0.55) * 0.035;
  P.occhi.forEach(o => { o.position.x = giro; o.position.y = (1 - k) * Math.sin(tq * 0.37) * 0.015 + k * 0.01; });
  const blink = (n % 46 === 0 || n % 46 === 1 || n % 131 === 60) ? 1 : 0;
  P.palpebre.forEach(p => { p.rotation.x = blink ? 1.75 : 0.42 + k * 0.1; });
  // fiori: ondeggiano anche loro, a scatti
  for (const a of animati) { a.obj.rotation.z = Math.sin(tq * 1.8 + a.fase) * 0.07; a.obj.rotation.x = Math.sin(tq * 1.3 + a.fase * 0.7) * 0.05; }
}

function libero(x, z) {
  if (x * x + z * z > 3.35 * 3.35) return false;
  for (const o of ostacoli) if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + 0.3) ** 2) return false;
  return true;
}

// ─────────────────────────── luci ───────────────────────────
const chiave = new THREE.SpotLight(0xffd2a0, 95, 0, 0.55, 0.85, 1.2);
chiave.position.set(-5.5, 9, 6.5); chiave.target.position.set(0, 0.5, 0);
chiave.castShadow = true; chiave.shadow.mapSize.set(2048, 2048); chiave.shadow.radius = 10; chiave.shadow.blurSamples = 20;
chiave.shadow.bias = -0.0005; chiave.shadow.camera.near = 4; chiave.shadow.camera.far = 30;
scene.add(chiave, chiave.target);
const riempi = new THREE.DirectionalLight(0x9fb8ff, 0.35); riempi.position.set(7, 4, 5); scene.add(riempi);
const controluce = new THREE.SpotLight(0xfff4e0, 45, 0, 0.5, 0.9, 1.2);
controluce.position.set(4, 7, -7); controluce.target.position.set(0, 0.8, 0); scene.add(controluce, controluce.target);
scene.add(new THREE.HemisphereLight(0xfff0dc, 0x40302a, 0.25));

// ─────────────────────────── camera e post ───────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
controls.minDistance = 5.5; controls.maxDistance = 13;
controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.42;
controls.minAzimuthAngle = -1.25; controls.maxAzimuthAngle = 1.25;   // il fondale sta dietro: non si gira oltre
controls.rotateSpeed = 0.6;
controls.target.set(0, 0.9, 0.3);
{ const c = (Q.get('cam') || '').split(',').map(Number); if (c.length === 3) camera.position.set(...c); else camera.position.set(1.4, 2.7, 7.0); }
controls.update();

// il composer disegna in un bersaglio con la profondità, che serve alla sfocatura
const pr = renderer.getPixelRatio();
const rt = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: 4 });
rt.depthTexture = new THREE.DepthTexture(innerWidth * pr, innerHeight * pr);
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
// profondità di campo fatta in casa: ogni pixel raccoglie 48 campioni su un disco a spirale aurea,
// grande quanto il suo cerchio di confusione (e i campioni davanti possono sbordare sul fuoco)
const bokeh = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uNear: { value: camera.near }, uFar: { value: camera.far },
    uFuoco: { value: 8 }, uAper: { value: 26 }, uMax: { value: 15 }, uRis: { value: new THREE.Vector2(innerWidth * pr, innerHeight * pr) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse, tDepth; uniform float uNear, uFar, uFuoco, uAper, uMax; uniform vec2 uRis; varying vec2 vUv;
    float lin(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
    float coc(float z){ return min(abs(z - uFuoco) / z * uAper, uMax); }
    void main(){
      float zc = lin(vUv), cc = coc(zc);
      vec3 acc = texture2D(tDiffuse, vUv).rgb; float wt = 1.0;
      float scala = uRis.y / 1080.0;
      for (int i = 0; i < 48; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / 48.0) * uMax * scala;
        float a = fi * 2.39996;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r / uRis;
        float zs = lin(uv), cs = coc(zs) * scala;
        float usa = zs < zc ? cs : min(cs, cc * scala);
        float w = smoothstep(r - 1.5, r, usa);
        acc += min(texture2D(tDiffuse, uv).rgb, vec3(3.0)) * w; wt += w;
      }
      gl_FragColor = vec4(acc / wt, 1.0);
    }`,
});
if (!Q.has('nodof')) composer.addPass(bokeh);
// vignettatura, grana e il lieve sfarfallio di esposizione fra una posa e l'altra (la lampada del set non è mai identica)
const pellicola = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uPosa: { value: 0 }, uLuce: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uPosa, uLuce; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uPosa * 1.618) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb *= uLuce;
      float v = smoothstep(1.05, 0.35, length((vUv - 0.5) * vec2(1.25, 1.0)));
      c.rgb *= mix(0.55, 1.0, v);
      c.rgb += (h(floor(vUv * 900.0)) - 0.5) * 0.035;
      gl_FragColor = c;
    }`,
});
composer.addPass(pellicola);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bokeh.uniforms.uRis.value.set(innerWidth * pr, innerHeight * pr);
});

// ─────────────────────────── ciclo ───────────────────────────
Demo.carica('Impasto la plastilina', 0.3);
costruisciSet();
costruisciPupazzo();
Demo.extra('<p style="opacity:.75">Il pupazzo, i fiori e le impronte sulla plastilina cambiano solo 12 volte al secondo; la camera invece si muove liscia a ogni fotogramma, come la macchina da presa di un vero set a passo uno.</p>');
let posaPrec = -1;
const tmp = new THREE.Vector3();
Demo.loop((dt, t) => {
  const posa = Math.floor(t * 12 + 1e-6);
  if (posa !== posaPrec) {
    // uno scatto: il pupazzo si sposta di quanto farebbe in 1/12 di secondo
    const passi = posaPrec < 0 ? 1 : Math.min(3, posa - posaPrec);
    posaPrec = posa;
    const ax = Demo.asse();
    const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    const fx = -Math.sin(az), fz = -Math.cos(az);
    let dx = fx * ax.y - fz * ax.x, dz = fz * ax.y + fx * ax.x;
    const L = Math.hypot(dx, dz), m = Math.min(1, L);
    if (L > 0) { dx /= L; dz /= L; }
    for (let i = 0; i < passi; i++) {
      if (m > 0.1) {
        const v = 1.15 * m / 12;
        const nx = stato.x + dx * v, nz = stato.z + dz * v;
        if (libero(nx, nz)) { stato.x = nx; stato.z = nz; }
        else if (libero(nx, stato.z)) stato.x = nx;
        else if (libero(stato.x, nz)) stato.z = nz;
        let d = Math.atan2(dx, dz) - stato.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
        stato.rot += Math.max(-0.55, Math.min(0.55, d));
        stato.fase = (stato.fase + 1 / 8) % 1;
        stato.cammina = Math.min(1, stato.cammina + 0.5);
      } else {
        stato.cammina = Math.max(0, stato.cammina - 0.5);
        if (stato.cammina === 0) stato.fase = 0;
      }
    }
    applicaPosa(posa);
    POSA.value = posa % 997;
    pellicola.uniforms.uPosa.value = posa % 997;
    pellicola.uniforms.uLuce.value = 1 + (Math.sin(posa * 12.9898) * 43758.5453 % 1) * 0.018;
  }
  controls.update();
  // la messa a fuoco segue il pupazzo: il resto del set sfuma come in un modellino fotografato da vicino
  camera.getWorldDirection(tmp);
  const fuoco = tmp.dot(new THREE.Vector3(pupazzo.position.x, pupazzo.position.y + 0.6, pupazzo.position.z).sub(camera.position));
  bokeh.uniforms.uFuoco.value = fuoco;
  // il RenderPass disegna nel readBuffer, che si alterna fra i due bersagli: la profondità va presa da lì
  bokeh.uniforms.tDepth.value = composer.readBuffer.depthTexture;
  if (!Demo.shot || dt === 0) composer.render();
});
Demo.pronto();
