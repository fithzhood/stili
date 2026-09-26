// Pop art: una scena 3D stampata come una vignetta di Lichtenstein.
// La scena si disegna "normale" (colori pieni, luce a gradini) in un render target;
// un passaggio finale la ristampa: ogni pixel viene scomposto in inchiostri (giallo, rosso,
// blu, nero) sulla carta avorio, e ogni inchiostro si stende pieno o a retino Ben-Day.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const Q = Demo.query;
const vign = document.getElementById('vignetta');
if (Demo.shot) document.body.classList.add('shot');

// ─────────────────────────── renderer e vignetta ───────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: Demo.shot });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
vign.prepend(renderer.domElement);

const fx = document.createElement('canvas');           // onomatopee 2D sopra la scena
fx.id = 'fx';
vign.append(fx);
const g2 = fx.getContext('2d');

let W = 2, H = 2;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);

const rtCol = new THREE.WebGLRenderTarget(2, 2, { samples: 4, type: THREE.HalfFloatType });
const rtNor = new THREE.WebGLRenderTarget(2, 2, { depthTexture: new THREE.DepthTexture(2, 2) });
rtNor.depthTexture.type = THREE.UnsignedIntType;

// ─────────────────────────── palette e materiali ───────────────────────────
// I colori della scena sono "istruzioni per la stampa": il passaggio finale li legge come
// tinta (quale inchiostro) + saturazione (quanta copertura) + valore (quanto nero).
const toni = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
toni.minFilter = toni.magFilter = THREE.NearestFilter; toni.needsUpdate = true;
const mat = (hex, o = {}) => new THREE.MeshToonMaterial({ color: hex, gradientMap: toni, ...o });
const C = {
  rosso: 0xd81c1c, giallo: 0xffd21a, blu: 0x1d5fc4, bianco: 0xf4f1ea, nero: 0x151515,
  rosa: 0xf2b7a6, celeste: 0xa8cdf0, crema: 0xf6e7a2, arancio: 0xf08a1a, verde: 0x7fbf3a,
  mattone: 0xe0664e, grigio: 0xc9c4bc,
};

// ─────────────────────────── cielo e nuvole ───────────────────────────
const cielo = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `varying vec3 vP;
    void main(){ float h = clamp(normalize(vP).y, 0., 1.);
      vec3 alto = vec3(0.42, 0.66, 1.0), basso = vec3(0.80, 0.89, 1.0);
      gl_FragColor = vec4(pow(mix(basso, alto, pow(h, 0.5)), vec3(2.2)), 1.); }`,
}));
cielo.renderOrder = -1;
scene.add(cielo);

function nuvola(x, y, z, s) {
  const g = new THREE.Group();
  const m = mat(0xffffff);
  const n = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const r = (0.6 + Math.random() * 0.5) * s;
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), m);
    b.position.set((i - n / 2) * s * 0.75 + (Math.random() - 0.5) * s * 0.4, Math.random() * s * 0.35 + (i % 2 ? 0 : s * 0.25), (Math.random() - 0.5) * s * 0.5);
    b.scale.y = 0.72;
    g.add(b);
  }
  g.position.set(x, y, z);
  g.lookAt(0, y, 0);
  scene.add(g);
}

// ─────────────────────────── luce ───────────────────────────
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8070, 1.25));
const sole = new THREE.DirectionalLight(0xffffff, 2.6);
sole.position.set(18, 30, 12);
sole.castShadow = true;
sole.shadow.mapSize.set(2048, 2048);
Object.assign(sole.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 });
sole.shadow.bias = -0.0008;
sole.shadow.normalBias = 0.03;
scene.add(sole, sole.target);

// ─────────────────────────── città ───────────────────────────
function texFinestre(base, vetro, luce, colonne, piani) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  const cw = 256 / colonne, ch = 256 / piani;
  for (let i = 0; i < colonne; i++) for (let j = 0; j < piani; j++) {
    x.fillStyle = Math.random() < 0.18 ? luce : vetro;
    x.fillRect(i * cw + cw * 0.22, j * ch + ch * 0.2, cw * 0.56, ch * 0.55);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter;
  return t;
}
const facciate = [
  texFinestre('#e0664e', '#1a1a1a', '#ffd21a', 4, 4),   // mattoni rossi
  texFinestre('#f6e7a2', '#1d5fc4', '#ffd21a', 4, 4),   // crema con vetri blu
  texFinestre('#a8cdf0', '#151515', '#f4f1ea', 3, 4),   // celeste
  texFinestre('#f4f1ea', '#151515', '#ffd21a', 5, 4),   // bianco
  texFinestre('#ffd21a', '#151515', '#d81c1c', 4, 4),   // giallo
];
const tetti = [C.grigio, C.crema, C.rosa];
function palazzo(x, z, w, d, top) {
  const h = top + 60;
  const t = facciate[Math.floor(Math.random() * facciate.length)].clone();
  t.needsUpdate = true;
  t.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 5)));
  const mLato = mat(0xffffff, { map: t });
  const mTetto = mat(tetti[Math.floor(Math.random() * tetti.length)]);
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mLato, mLato, mTetto, mTetto, mLato, mLato]);
  b.position.set(x, top - h / 2, z);
  b.castShadow = b.receiveShadow = true;
  scene.add(b);
  // cornicione
  const c = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.8, d + 0.8), mat(C.bianco));
  c.position.set(x, top - 0.4, z); scene.add(c);
  // qualche serbatoio o antenna sui tetti vicini
  if (Math.random() < 0.45) {
    const s = serbatoio(0.7 + Math.random() * 0.5);
    s.position.set(x + (Math.random() - 0.5) * w * 0.5, top, z + (Math.random() - 0.5) * d * 0.5);
    scene.add(s);
  } else if (Math.random() < 0.6) {
    const a = antenna(); a.position.set(x + (Math.random() - 0.5) * w * 0.4, top, z + (Math.random() - 0.5) * d * 0.4); a.scale.setScalar(1.6); scene.add(a);
  }
}

function serbatoio(s = 1) {
  const g = new THREE.Group();
  const legno = mat(C.arancio), ferro = mat(C.nero), tetto = mat(C.rosso);
  const botte = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 3.2, 20), legno);
  botte.position.y = 4.4; g.add(botte);
  for (const y of [3.3, 4.4, 5.5]) {
    const cerchio = new THREE.Mesh(new THREE.TorusGeometry(1.68, 0.07, 6, 28), ferro);
    cerchio.rotation.x = Math.PI / 2; cerchio.position.y = y; g.add(cerchio);
  }
  const cono = new THREE.Mesh(new THREE.ConeGeometry(1.95, 1.4, 20), tetto);
  cono.position.y = 6.7; g.add(cono);
  const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), ferro); pomo.position.y = 7.5; g.add(pomo);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.2, 20), ferro); base.position.y = 2.75; g.add(base);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const gamba = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 6), ferro);
    gamba.position.set(Math.cos(a) * 1.3, 1.35, Math.sin(a) * 1.3); g.add(gamba);
  }
  const croce = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.08), ferro);
  croce.position.y = 1.2; croce.rotation.z = 0.7; g.add(croce);
  g.scale.setScalar(s);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function antenna() {
  const g = new THREE.Group(), m = mat(C.nero);
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 6), m); palo.position.y = 1.3; g.add(palo);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.3 - i * 0.2, 0.04, 0.04), m);
    b.position.y = 1.6 + i * 0.3; b.rotation.y = 0.4; g.add(b);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// il nostro tetto: 26 × 26 m, a quota 0
const LATO = 13;
const solidi = [];                 // ostacoli fissi: {x, z, r}
function tettoEroe() {
  const piano = new THREE.Mesh(new THREE.BoxGeometry(LATO * 2, 1, LATO * 2), mat(C.crema));
  piano.position.y = -0.5; piano.receiveShadow = true; scene.add(piano);
  // facciate del nostro palazzo, che scendono verso la strada
  const f = facciate[0].clone(); f.needsUpdate = true; f.repeat.set(5, 12);
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(LATO * 2, 60, LATO * 2), mat(0xffffff, { map: f }));
  corpo.position.y = -31; scene.add(corpo);
  // parapetto rosso con copertina bianca
  const mp = mat(C.rosso), mc = mat(C.bianco);
  for (const [x, z, w, d] of [[0, LATO, LATO * 2 + 0.6, 0.6], [0, -LATO, LATO * 2 + 0.6, 0.6], [LATO, 0, 0.6, LATO * 2], [-LATO, 0, 0.6, LATO * 2]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, d), mp); p.position.set(x, 0.45, z);
    p.castShadow = p.receiveShadow = true; scene.add(p);
    const c = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.14, d + 0.2), mc); c.position.set(x, 0.97, z); scene.add(c);
  }
  // casotto della scala, con porta e lampada
  const cas = new THREE.Group();
  const mur = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3, 3.2), mat(C.mattone)); mur.position.y = 1.5; cas.add(mur);
  const tet = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 3.6), mat(C.bianco)); tet.position.y = 3.15; cas.add(tet);
  const porta = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.1), mat(C.blu)); porta.position.set(0, 1.05, 1.62); cas.add(porta);
  const man = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(C.giallo)); man.position.set(0.35, 1.05, 1.7); cas.add(man);
  const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 12, 1, true), mat(C.nero)); lamp.position.set(0, 2.55, 1.75); cas.add(lamp);
  cas.position.set(-8.5, 0, -8); cas.rotation.y = 0.0;
  cas.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(cas);
  solidi.push({ x: -8.5, z: -8, r: 2.3 });
  // serbatoio d'acqua
  const s = serbatoio(1); s.position.set(7.5, 0, -7.5); scene.add(s); solidi.push({ x: 7.5, z: -7.5, r: 1.9 });
  // lucernario
  const luc = new THREE.Group();
  const lb = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 2), mat(C.bianco)); lb.position.y = 0.25; luc.add(lb);
  for (const sgn of [-1, 1]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 1.2), mat(C.celeste)); v.position.set(0, 0.8, sgn * 0.45); v.rotation.x = sgn * 0.6; luc.add(v);
  }
  luc.position.set(8, 0, 6.5); luc.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(luc);
  solidi.push({ x: 7, z: 6.5, r: 1.5 }, { x: 9, z: 6.5, r: 1.5 });
  // condizionatori
  for (const [x, z] of [[-10.5, 4], [-10.5, 6.2]]) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.8), mat(C.grigio)); ac.position.set(x, 0.55, z);
    ac.castShadow = ac.receiveShadow = true; scene.add(ac);
    const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), mat(C.nero)); gr.position.set(x, 1.12, z); scene.add(gr);
    solidi.push({ x, z, r: 1.05 });
  }
  // antenne e comignoli
  const a1 = antenna(); a1.position.set(-9.8, 3.15, -8.5); scene.add(a1);
  for (const [x, z] of [[3, -11.5], [4.2, -11.5]]) {
    const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 10), mat(C.nero)); cm.position.set(x, 0.8, z); cm.castShadow = true; scene.add(cm);
  }
  // cartellone pubblicitario su un bordo
  const cc = document.createElement('canvas'); cc.width = 512; cc.height = 192;
  const x = cc.getContext('2d');
  x.fillStyle = '#ffd21a'; x.fillRect(0, 0, 512, 192);
  x.fillStyle = '#d81c1c'; x.beginPath(); x.arc(92, 96, 70, 0, 7); x.fill();
  x.fillStyle = '#f4f1ea'; x.font = '84px Bangers, Impact'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 92, 100);
  x.fillStyle = '#151515'; x.font = '78px Bangers, Impact'; x.textAlign = 'left'; x.fillText('CAFFÈ', 185, 80);
  x.fillStyle = '#1d5fc4'; x.font = '44px Bangers, Impact'; x.fillText('SVEGLIA LA CITTÀ', 188, 146);
  const tc = new THREE.CanvasTexture(cc); tc.colorSpace = THREE.SRGBColorSpace;
  const cart = new THREE.Group();
  const pan = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 0.2), [mat(C.bianco), mat(C.bianco), mat(C.bianco), mat(C.bianco), mat(0xffffff, { map: tc }), mat(C.bianco)]);
  pan.position.y = 3.6; cart.add(pan);
  for (const sx of [-3, 3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 0.15), mat(C.nero)); p.position.set(sx, 1.1, -0.2); cart.add(p); }
  cart.position.set(-2, 0, -12.2); cart.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(cart);
}
tettoEroe();

// palazzi attorno, dal vicino al lontano
function citta() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const orig = Math.random; Math.random = rnd;
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 26 + rnd() * rnd() * 150;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const w = 8 + rnd() * 12, dd = 8 + rnd() * 12;
    const top = -24 + rnd() * 20 + Math.min(45, d * 0.3) * rnd();
    palazzo(x, z, w, dd, top);
  }
  // grattacieli lontani con la guglia
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, d = 150 + rnd() * 120;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, top = 45 + rnd() * 50;
    palazzo(x, z, 16, 16, top);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 10), mat(C.bianco)); t2.position.set(x, top + 6, z); scene.add(t2);
    const gu = new THREE.Mesh(new THREE.ConeGeometry(3, 16, 4), mat(C.giallo)); gu.position.set(x, top + 20, z); scene.add(gu);
  }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + rnd();
    nuvola(Math.cos(a) * 380, 60 + rnd() * 90, Math.sin(a) * 380, 16 + rnd() * 12);
  }
  Math.random = orig;
}
citta();

// ─────────────────────────── bersagli: casse e robot di latta ───────────────────────────
function cassa() {
  const g = new THREE.Group();
  const s = 1.1;
  const legno = mat(C.giallo), listello = mat(C.arancio);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), legno));
  const e = s / 2 + 0.03;
  for (const ax of ['x', 'y', 'z']) for (const sg of [-1, 1]) {
    // cornice e diagonale su ogni faccia
    const f = new THREE.Group();
    const bars = [[s, 0.14, 0, s / 2 - 0.07, 0], [s, 0.14, 0, -s / 2 + 0.07, 0], [0.14, s, s / 2 - 0.07, 0, 0], [0.14, s, -s / 2 + 0.07, 0, 0]];
    for (const [w, h, px, py] of bars) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), listello); b.position.set(px, py, 0); f.add(b); }
    const di = new THREE.Mesh(new THREE.BoxGeometry(s * 1.3, 0.14, 0.06), listello); di.rotation.z = Math.PI / 4; f.add(di);
    if (ax === 'x') { f.rotation.y = Math.PI / 2; f.position.x = sg * e; }
    if (ax === 'y') { f.rotation.x = Math.PI / 2; f.position.y = sg * e; }
    if (ax === 'z') f.position.z = sg * e;
    g.add(f);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  return { obj: g, alto: s / 2, raggio: 0.75, robot: false };
}

function robot() {
  const g = new THREE.Group();
  const corpoC = [C.blu, C.rosso, C.blu][Math.floor(Math.random() * 3)];
  const mc = mat(corpoC), mg = mat(C.giallo), mn = mat(C.nero), mb = mat(C.bianco), mr = mat(C.rosso);
  const busto = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 0.55), mc); busto.position.y = 1.0; g.add(busto);
  const pann = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.05), mg); pann.position.set(0, 1.05, 0.29); g.add(pann);
  for (let i = 0; i < 3; i++) { const q = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), i === 1 ? mr : mn); q.rotation.x = Math.PI / 2; q.position.set(-0.15 + i * 0.15, 1.1, 0.33); g.add(q); }
  const grig = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.04), mn); grig.position.set(0, 0.93, 0.32); g.add(grig);
  const collo = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 8), mn); collo.position.y = 1.49; g.add(collo);
  const testa = new THREE.Group(); testa.position.y = 1.78; g.add(testa);
  const t = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.5), corpoC === C.rosso ? mat(C.blu) : mr); testa.add(t);
  for (const sx of [-0.14, 0.14]) {
    const oc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14), mg); oc.rotation.x = Math.PI / 2; oc.position.set(sx, 0.04, 0.26); testa.add(oc);
    const pu = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 10), mn); pu.rotation.x = Math.PI / 2; pu.position.set(sx, 0.04, 0.28); testa.add(pu);
  }
  const bocca = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.04), mb); bocca.position.set(0, -0.13, 0.26); testa.add(bocca);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), mn); ant.position.y = 0.39; testa.add(ant);
  const pal = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mr); pal.position.y = 0.56; testa.add(pal);
  for (const sx of [-0.28, 0.28]) { const or = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10), mg); or.rotation.z = Math.PI / 2; or.position.set(sx * 1.15, 0, 0); testa.add(or); }
  const braccia = [];
  for (const sx of [-1, 1]) {
    const sp = new THREE.Group(); sp.position.set(sx * 0.5, 1.3, 0); g.add(sp);
    const sf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mn); sp.add(sf);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), mb); br.position.y = -0.34; sp.add(br);
    const pinza = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12, 4.4), mg); pinza.position.y = -0.72; pinza.rotation.z = Math.PI / 2 + 0.9; sp.add(pinza);
    braccia.push(sp);
  }
  const gambe = [];
  for (const sx of [-0.2, 0.2]) {
    const gm = new THREE.Group(); gm.position.set(sx, 0.58, 0); g.add(gm);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8), mn); l.position.y = -0.2; gm.add(l);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.36), mc); p.position.set(0, -0.48, 0.05); gm.add(p);
    gambe.push(gm);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  return { obj: g, alto: 0, raggio: 0.6, robot: true, braccia, gambe, testa };
}

const bersagli = [];
function nuovoBersaglio(kind, x, z) {
  const b = kind === 'robot' ? robot() : cassa();
  b.pos = new THREE.Vector3(x, b.alto, z);
  b.vel = new THREE.Vector3(); b.rot = new THREE.Euler(0, Math.random() * 6.28, 0); b.spin = new THREE.Vector3();
  b.stato = 'fermo'; b.fase = Math.random() * 6; b.attesa = 0;
  b.obj.position.copy(b.pos);
  scene.add(b.obj);
  bersagli.push(b);
  return b;
}
const posti = [[2.4, -3.2, 'robot'], [-3.5, -5, 'robot'], [4.5, 2, 'cassa'], [5.4, 2.2, 'cassa'], [4.95, 2.1, 'cassa'], [-5, 3.5, 'robot'], [-2, 7.5, 'cassa'], [0.5, -8.5, 'cassa'], [-6.5, -1, 'cassa']];
for (const [x, z, k] of posti) nuovoBersaglio(k, x, z);
// una cassa impilata
bersagli[4].pos.y = 1.1 + bersagli[4].alto; bersagli[4].pos.x = 4.95; bersagli[4].pos.z = 2.1; bersagli[4].obj.position.copy(bersagli[4].pos);

// ─────────────────────────── eroe ───────────────────────────
// Il manichino della Universal Animation Library, vestito da supereroe dentro lo shader:
// il colore dipende dalla posizione del vertice nella posa di riposo (tuta, stivali, cintura...).
const eroe = { obj: null, mixer: null, azioni: {}, pos: new THREE.Vector3(0, 0, 1.5), dir: Math.PI, vel: 0, colpo: 0, colpito: false, attiva: null, alterna: 0 };
const mantello = { mesh: null, geo: null, base: null };

function vestiEroe(material) {
  material.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRiposo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRiposo = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vRiposo;
      vec3 tuta(vec3 p){
        vec3 BLU = vec3(0.03, 0.12, 0.56), ROS = vec3(0.69, 0.012, 0.012), GIA = vec3(1.0, 0.64, 0.01), PEL = vec3(0.89, 0.47, 0.38);
        float ax = abs(p.x);
        vec3 c = BLU;
        if (p.y < 0.42) c = ROS;                                  // stivali
        if (p.y > 0.86 && p.y < 1.0 && ax < 0.3) c = ROS;         // mutandoni rossi sopra la tuta
        if (p.y > 0.98 && p.y < 1.06 && ax < 0.3) c = GIA;        // cintura
        if (ax > 0.62) c = ROS;                                   // guanti
        if (p.y > 1.56) c = PEL;                                  // viso
        if (p.y > 1.745 || (p.y > 1.58 && p.z < 0.0)) c = BLU;   // cappuccio
        if (p.y > 1.665 && p.y < 1.725 && p.z > 0.0) c = BLU;     // maschera sugli occhi
        vec2 e = vec2(p.x, p.y - 1.33);                           // stemma sul petto
        if (p.z > 0.05 && length(e * vec2(1.0, 1.25)) < 0.085) c = GIA;
        if (p.z > 0.05 && length(e * vec2(1.0, 1.25)) < 0.085 && abs(e.x + e.y * 0.5) < 0.018) c = ROS;
        return c;
      }`).replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( tuta(vRiposo), opacity );');
  };
  material.customProgramCacheKey = () => 'eroe';
}

function faiMantello(bone) {
  // un telo rosso che parte dalle spalle: una griglia che ondeggia e si gonfia con la corsa.
  // Non è figlio dell'osso (i suoi assi girano con l'animazione): lo si aggancia a mano a ogni fotogramma.
  const nx = 6, ny = 12;
  const geo = new THREE.PlaneGeometry(1, 1, nx, ny);
  const base = geo.attributes.position.array.slice();
  const m = new THREE.Mesh(geo, mat(C.rosso, { side: THREE.DoubleSide }));
  m.castShadow = true; m.frustumCulled = false;
  scene.add(m);
  mantello.mesh = m; mantello.geo = geo; mantello.base = base; mantello.osso = bone;
}

const _pOsso = new THREE.Vector3();
function aggiornaMantello(t, vel) {
  if (!mantello.mesh) return;
  const p = mantello.geo.attributes.position, b = mantello.base;
  const alza = Math.min(1, vel / 5);
  mantello.osso.getWorldPosition(_pOsso);
  mantello.mesh.position.set(_pOsso.x, _pOsso.y + 0.2, _pOsso.z);
  mantello.mesh.rotation.set(0, eroe.dir, 0);
  for (let i = 0; i < p.count; i++) {
    const u = b[i * 3], k = 0.5 - b[i * 3 + 1];            // u: -0.5..0.5 di traverso, k: 0 alle spalle, 1 in fondo
    const largo = 0.40 + k * 0.42;
    const lung = 1.25 - alza * 0.2;
    const onda = Math.sin(t * (3 + alza * 9) - k * 5 + u * 3) * (0.03 + alza * 0.1) * k;
    const indietro = 0.16 + k * k * (0.06 + alza * 0.95) + onda;
    const giu = k * lung * (1 - alza * 0.45 * k);
    // in alto il telo gira attorno alle spalle
    const spalla = Math.max(0, 1 - k * 6);
    p.setXYZ(i, u * largo, -giu + spalla * 0.02, -indietro + spalla * 0.05 - Math.abs(u) * 0.08 * (1 - k));
  }
  p.needsUpdate = true;
  mantello.geo.computeVertexNormals();
}

// ─────────────────────────── stampa (post-processing) ───────────────────────────
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: {
    tCol: { value: rtCol.texture }, tNor: { value: rtNor.texture }, tDep: { value: rtNor.depthTexture },
    res: { value: new THREE.Vector2() }, cella: { value: 9 }, linea: { value: 2 }, near: { value: 0.1 }, far: { value: 900 },
  },
  depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tCol, tNor, tDep; uniform vec2 res; uniform float cella, linea, near, far;
    varying vec2 vUv;
    const vec3 CARTA = vec3(0.965, 0.937, 0.862);
    const vec3 ROSSO = vec3(0.90, 0.13, 0.14), GIALLO = vec3(1.0, 0.86, 0.10), BLU = vec3(0.13, 0.42, 0.80), NERO = vec3(0.07, 0.065, 0.07);

    float lin(float d){ return near * far / (far - d * (far - near)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec3 rgb2hsv(vec3 c){
      vec4 K = vec4(0., -1./3., 2./3., -1.);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      return vec3(abs(q.z + (q.w - q.y) / (6. * d + 1e-10)), d / (q.x + 1e-10), q.x);
    }
    // copertura quantizzata a gradini: niente sfumature, solo punti piccoli, grandi o pieno
    float gradino(float c){
      if (c < 0.10) return 0.;
      if (c < 0.30) return 0.20;
      if (c < 0.52) return 0.42;
      if (c < 0.74) return 0.62;
      return 1.;
    }
    // retino Ben-Day: griglia sfalsata (a 45°), punto tondo di area = copertura
    float puntini(vec2 px, float cov, vec2 off){
      if (cov <= 0.) return 0.;
      if (cov >= 1.) return 1.;
      vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (px + off) / cella;
      vec2 f = fract(q) - 0.5;
      float r = sqrt(cov / 3.14159) ;
      float d = length(f);
      float aa = 0.9 / cella;
      return smoothstep(r + aa, r - aa, d);
    }
    void main(){
      vec2 px = gl_FragCoord.xy;
      vec3 c = texture2D(tCol, vUv).rgb;
      c = clamp(pow(c, vec3(1.0 / 2.2)), 0., 1.);        // il render target è lineare
      vec3 hsv = rgb2hsv(c);
      float h = hsv.x * 360., s = hsv.y, v = hsv.z;

      // tinta → pesi degli inchiostri (arancio = giallo + rosso, verde = giallo + blu, viola = rosso + blu)
      float wR = 0., wY = 0., wB = 0.;
      if (h < 12. || h >= 335.) wR = 1.;
      else if (h < 45.) { float f = (h - 12.) / 33.; wR = 1. - f * 0.8; wY = min(1., f * 1.6); }
      else if (h < 72.) wY = 1.;
      else if (h < 165.) { float f = (h - 72.) / 93.; wY = 1. - f; wB = min(1., f * 1.4); }
      else if (h < 255.) wB = 1.;
      else { float f = (h - 255.) / 80.; wB = 1. - f; wR = min(1., f * 1.5); }

      float sat = smoothstep(0.10, 0.80, s);
      float cR = gradino(sat * wR), cY = gradino(sat * wY), cB = gradino(sat * wB);
      // nero: dove il colore è scuro (ombre a gradini e oggetti neri)
      float k = 1. - smoothstep(0.10, 0.50, v);

      vec3 col = CARTA;
      col *= mix(vec3(1.), GIALLO, puntini(px, cY, vec2(0.)));
      col *= mix(vec3(1.), ROSSO, puntini(px, cR, vec2(cella * 0.5, 0.)));
      col *= mix(vec3(1.), BLU, puntini(px, cB, vec2(0., cella * 0.5)));

      // ombre: tratteggio diagonale a mano, poi nero pieno
      float tr = 0.;
      if (k > 0.62) tr = 1.;
      else if (k > 0.30) {
        float l = (px.x + px.y) / (cella * 0.62);
        float w = mix(0.18, 0.42, (k - 0.30) / 0.32);
        tr = smoothstep(w + 0.12, w - 0.12, abs(fract(l) - 0.5));
      }
      col = mix(col, NERO, tr);

      // contorni: profondità (laplaciano, ignora i piani inclinati) + normali
      float d0 = lin(texture2D(tDep, vUv).r);
      vec3 n0 = texture2D(tNor, vUv).rgb * 2. - 1.;
      float bordo = 0.;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7854;
        vec2 o = vec2(cos(a), sin(a)) * linea / res;
        float da = lin(texture2D(tDep, vUv + o).r), db = lin(texture2D(tDep, vUv - o).r);
        float lap = abs(da + db - 2. * d0) / d0;
        float salto = max(abs(da - d0), abs(db - d0)) / d0;
        vec3 na = texture2D(tNor, vUv + o).rgb * 2. - 1.;
        bordo = max(bordo, smoothstep(0.035, 0.07, lap));
        bordo = max(bordo, smoothstep(0.25, 0.4, salto));
        bordo = max(bordo, smoothstep(0.55, 0.8, 1. - dot(n0, na)) * step(d0, 300.));
      }
      col = mix(col, NERO, bordo);

      // carta: fibra leggera e un velo di ingiallimento ai bordi
      float gr = hash(floor(px * 0.5)) * 0.05 + hash(floor(px / 3.)) * 0.03;
      col *= 1. - gr * 0.5;
      vec2 u = vUv - 0.5;
      col *= 1. - dot(u, u) * 0.10;
      gl_FragColor = vec4(col, 1.);
    }`,
}));
const postScene = new THREE.Scene(); postScene.add(quad);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const matNormali = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });

// ─────────────────────────── camera ───────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.enablePan = false;
controls.minDistance = 4; controls.maxDistance = 16;
controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.78;
controls.target.set(0, 1.2, 1.5);
// inquadrature di prova (?cam=N): offset della camera rispetto all'eroe
const camCfg = { 0: [-1.3, 0.55, 4.3], 1: [-4, 6, 10], 2: [0.4, 1.5, 3.2], 3: [-3.2, 1.8, 0.4] }[Q.get('cam') || 0] || [-1.3, 0.55, 4.3];

function ridimensiona() {
  const r = vign.getBoundingClientRect();
  W = Math.max(2, Math.round(r.width - 10)); H = Math.max(2, Math.round(r.height - 10));
  renderer.setSize(W, H);
  rtCol.setSize(W, H); rtNor.setSize(W, H);
  fx.width = W; fx.height = H; fx.style.width = W + 'px'; fx.style.height = H + 'px';
  camera.aspect = W / H; camera.updateProjectionMatrix();
  quad.material.uniforms.res.value.set(W, H);
  quad.material.uniforms.cella.value = Math.max(6, H / 96);
  quad.material.uniforms.linea.value = Math.max(1.5, H / 420);
}
addEventListener('resize', ridimensiona);
ridimensiona();

// ─────────────────────────── onomatopee ───────────────────────────
const PAROLE = ['POW!', 'BAM!', 'SBAM!', 'WHAM!', 'KRAK!', 'SOC!', 'BONK!'];
const scoppi = [];
function scoppio(pos3, parola) {
  const v = pos3.clone().project(camera);
  const e = tmp2.copy(eroe.pos).setY(1.2).project(camera);
  const seme = Math.random() * 1000;
  let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
  const ex = (e.x * 0.5 + 0.5) * W;
  // la stella si sposta dalla parte opposta all'eroe, così lui resta in vista
  x += Math.sign(x - ex || 1) * H * 0.16; y -= H * 0.1;
  const U = H / 720, m = 200 * U;
  x = Math.min(W - m, Math.max(m, x)); y = Math.min(H - m * 0.8, Math.max(m * 0.8, y));
  scoppi.push({ x, y, t: 0, parola, seme, rot: (Math.random() - 0.5) * 0.5 });
}
function rnd1(s) { const x = Math.sin(s * 91.345) * 47453.23; return x - Math.floor(x); }
function stella(x, y, r1, r2, n, seme) {
  g2.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = i / (n * 2) * Math.PI * 2 + seme;
    const r = (i % 2 ? r2 : r1) * (i % 2 ? 1 : 0.8 + rnd1(seme + i) * 0.45);
    g2.lineTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r);
  }
  g2.closePath();
}
function disegnaScoppi(dt) {
  g2.clearRect(0, 0, W, H);
  const U = H / 720;
  for (let i = scoppi.length - 1; i >= 0; i--) {
    const s = scoppi[i];
    s.t += dt;
    if (s.t > 1.5) { scoppi.splice(i, 1); continue; }
    // entra con un rimbalzo elastico, resta, e sparisce rimpicciolendo
    const e = s.t < 0.22 ? 1.18 * Math.sin(s.t / 0.22 * Math.PI / 2) : s.t < 0.34 ? 1.18 - (s.t - 0.22) / 0.12 * 0.18 : s.t > 1.25 ? 1 - (s.t - 1.25) / 0.25 : 1;
    if (e <= 0) continue;
    g2.save();
    g2.translate(s.x, s.y);
    g2.rotate(s.rot);
    g2.scale(e * U * 0.85, e * U * 0.85);
    // linee d'impatto
    g2.strokeStyle = '#111'; g2.lineWidth = 4;
    for (let k = 0; k < 14; k++) {
      const a = k / 14 * Math.PI * 2 + s.seme, r0 = 150 + rnd1(s.seme + k * 3) * 30, r1 = r0 + 40 + rnd1(s.seme + k) * 50;
      g2.beginPath(); g2.moveTo(Math.cos(a) * r0 * 1.25, Math.sin(a) * r0); g2.lineTo(Math.cos(a) * r1 * 1.25, Math.sin(a) * r1); g2.stroke();
    }
    // stella rossa sotto, stella gialla sopra
    stella(0, 0, 150, 92, 13, s.seme); g2.fillStyle = '#e3232a'; g2.fill(); g2.lineWidth = 7; g2.stroke();
    stella(0, 0, 118, 76, 11, s.seme + 1.3); g2.fillStyle = '#ffe01c'; g2.fill(); g2.lineWidth = 6; g2.stroke();
    // retino rosso dentro la stella gialla
    g2.save(); g2.clip();
    g2.fillStyle = 'rgba(227,35,42,.55)';
    for (let yy = -130; yy < 130; yy += 11) for (let xx = -170; xx < 170; xx += 11) {
      const ox = (Math.round(yy / 11) % 2) * 5.5, dd = Math.hypot(xx / 1.25, yy) / 120;
      if (dd > 0.55) { g2.beginPath(); g2.arc(xx + ox, yy, 1.2 + dd * 2.2, 0, 7); g2.fill(); }
    }
    g2.restore();
    // lettering: ogni lettera inclinata e un po' diversa, con l'estrusione nera
    const lett = s.parola.split('');
    g2.font = '104px Bangers, Impact, sans-serif';
    g2.textBaseline = 'middle'; g2.textAlign = 'center';
    let tot = 0; const lw = lett.map(l => { const w = g2.measureText(l).width * 0.92; tot += w; return w; });
    let xx = -tot / 2;
    g2.lineJoin = 'round';
    lett.forEach((l, k) => {
      const cx = xx + lw[k] / 2; xx += lw[k];
      g2.save();
      g2.translate(cx, (k - lett.length / 2) * -5);
      g2.rotate(-0.12 + (rnd1(s.seme + k * 7) - 0.5) * 0.18);
      g2.scale(1, 1.08 + (k === 0 ? 0.12 : 0));
      g2.fillStyle = '#111'; g2.fillText(l, 7, 8);
      g2.strokeStyle = '#111'; g2.lineWidth = 12; g2.strokeText(l, 0, 0);
      g2.fillStyle = '#e3232a'; g2.fillText(l, 0, 0);
      g2.strokeStyle = '#fff'; g2.lineWidth = 2.5; g2.globalAlpha = 0.9; g2.strokeText(l, -2, -2);
      g2.restore();
    });
    g2.restore();
  }
}

// ─────────────────────────── caricamento ───────────────────────────
Demo.carica('Stampo la vignetta', 0.2);
const gltf = await new GLTFLoader().loadAsync('assets/eroe.glb');
try { await document.fonts.load('104px Bangers'); } catch (e) { /* va bene anche senza */ }
eroe.obj = gltf.scene;
eroe.obj.traverse(o => {
  if (o.isMesh) {
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const m = new THREE.MeshToonMaterial({ gradientMap: toni, color: 0xffffff });
    vestiEroe(m);
    o.material = m;
  }
});
const spalle = eroe.obj.getObjectByName('spine_03');
faiMantello(spalle);
eroe.obj.scale.set(1.12, 1.04, 1.12);
scene.add(eroe.obj);
eroe.mixer = new THREE.AnimationMixer(eroe.obj);
for (const clip of gltf.animations) eroe.azioni[clip.name] = eroe.mixer.clipAction(clip);
for (const n of ['Punch_Cross', 'Punch_Jab', 'Hit_Chest']) { const a = eroe.azioni[n]; a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
const ciclo = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop'];
for (const n of ciclo) { eroe.azioni[n].play(); eroe.azioni[n].setEffectiveWeight(n === 'Idle_Loop' ? 1 : 0); }
eroe.azioni.Jog_Fwd_Loop.timeScale = 1.05;

// posizione iniziale: davanti a un robot, pronto a colpire (bella inquadratura per l'anteprima)
eroe.pos.set(-0.5, 0, 0.5);
bersagli[0].pos.set(0.85, 0, 0.35); bersagli[0].obj.position.copy(bersagli[0].pos);
eroe.dir = Math.atan2(bersagli[0].pos.x - eroe.pos.x, bersagli[0].pos.z - eroe.pos.z);
controls.target.set(eroe.pos.x + 0.6, 1.5, eroe.pos.z);
camera.position.set(eroe.pos.x + camCfg[0], camCfg[1], eroe.pos.z + camCfg[2]);

// ─────────────────────────── gioco ───────────────────────────
const tmp2 = new THREE.Vector3();
const tmp = new THREE.Vector3(), avanti = new THREE.Vector3();
let scossa = 0, fermo = 0, autoPugno = Demo.shot && Q.get('auto') !== '0' ? +(Q.get('auto') || 0.95) : -1;

function colpisci() {
  if (eroe.colpo > 0) return;
  const nome = eroe.alterna++ % 2 ? 'Punch_Jab' : 'Punch_Cross';
  const a = eroe.azioni[nome];
  a.reset(); a.setEffectiveWeight(1); a.timeScale = 1.35; a.fadeIn(0.08); a.play();
  eroe.attiva = a;
  eroe.colpo = a.getClip().duration / a.timeScale;
  eroe.durata = eroe.colpo;
  eroe.colpito = false;
}

function impatto() {
  avanti.set(Math.sin(eroe.dir), 0, Math.cos(eroe.dir));
  let quanti = 0;
  for (const b of bersagli) {
    if (b.stato === 'vola' || b.stato === 'cade') continue;
    tmp.copy(b.pos).sub(eroe.pos); tmp.y = 0;
    const d = tmp.length();
    if (d > 2.2 || (d > 0.4 && tmp.normalize().dot(avanti) < 0.35)) continue;
    b.stato = 'vola';
    b.vel.copy(avanti).multiplyScalar(11 + Math.random() * 5).add(tmp.set((Math.random() - 0.5) * 3, 6 + Math.random() * 3, 0));
    b.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14);
    // anche quello impilato sopra deve cadere
    for (const o of bersagli) if (o !== b && o.stato === 'fermo' && o.pos.y > 0.9 && Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z) < 0.6) { o.stato = 'vola'; o.vel.set(avanti.x * 4, 3, avanti.z * 4); o.spin.set(3, 2, 4); }
    if (quanti++ === 0) {
      tmp.copy(b.pos); tmp.y += b.robot ? 1.3 : 0.6;
      scoppio(tmp, PAROLE[Math.floor(Math.random() * PAROLE.length)]);
    }
  }
  if (quanti) { scossa = 0.28; fermo = 0.07; }
}

function aggiornaBersagli(dt, t) {
  for (const b of bersagli) {
    if (b.stato === 'fermo') {
      if (b.robot) {
        // i robot di latta dondolano e guardano l'eroe
        b.fase += dt * 3;
        const verso = Math.atan2(eroe.pos.x - b.pos.x, eroe.pos.z - b.pos.z);
        let dd = verso - b.rot.y; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
        b.rot.y += dd * Math.min(1, dt * 2);
        b.obj.rotation.set(0, b.rot.y, Math.sin(b.fase) * 0.06);
        b.braccia[0].rotation.x = Math.sin(b.fase) * 0.5 - 0.3; b.braccia[1].rotation.x = -Math.sin(b.fase) * 0.5 - 0.3;
        b.gambe[0].rotation.x = Math.sin(b.fase) * 0.25; b.gambe[1].rotation.x = -Math.sin(b.fase) * 0.25;
        b.testa.rotation.z = Math.sin(b.fase * 0.5) * 0.12;
        b.obj.position.set(b.pos.x, b.pos.y + Math.abs(Math.sin(b.fase)) * 0.04, b.pos.z);
      }
      continue;
    }
    if (b.stato === 'attesa') {
      b.attesa -= dt;
      if (b.attesa <= 0) {
        // ricade dal cielo in un punto libero del tetto
        b.pos.set((Math.random() - 0.5) * 16, 18, (Math.random() - 0.5) * 16);
        b.vel.set(0, -2, 0); b.spin.set(0, (Math.random() - 0.5) * 3, 0);
        b.rot.set(0, Math.random() * 6, 0);
        b.stato = 'cade'; b.obj.visible = true;
      }
      continue;
    }
    b.vel.y -= 22 * dt;
    b.pos.addScaledVector(b.vel, dt);
    b.rot.x += b.spin.x * dt; b.rot.y += b.spin.y * dt; b.rot.z += b.spin.z * dt;
    const sulTetto = Math.abs(b.pos.x) < LATO && Math.abs(b.pos.z) < LATO;
    if (sulTetto && b.pos.y <= b.alto && b.vel.y < 0) {
      b.pos.y = b.alto;
      if (b.stato === 'cade' || b.vel.length() < 3) {
        b.stato = 'fermo'; b.vel.set(0, 0, 0); b.rot.x = 0; b.rot.z = 0;
      } else { b.vel.y *= -0.35; b.vel.x *= 0.6; b.vel.z *= 0.6; b.spin.multiplyScalar(0.5); }
    }
    // se vola oltre il parapetto sparisce giù in strada, e dopo un po' ne ricade un altro
    if (b.pos.y < -30 || b.pos.length() > 90) { b.stato = 'attesa'; b.attesa = 1.5 + Math.random() * 2; b.obj.visible = false; }
    b.obj.position.copy(b.pos);
    b.obj.rotation.copy(b.rot);
  }
}

function aggiornaEroe(dt, t) {
  const ax = Demo.asse();
  // movimento relativo alla camera
  const yaw = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
  const mx = -ax.y * Math.sin(yaw) + ax.x * Math.cos(yaw);
  const mz = -ax.y * Math.cos(yaw) - ax.x * Math.sin(yaw);
  const m = Math.min(1, Math.hypot(mx, mz));
  const inColpo = eroe.colpo > 0;
  const velMax = 4.6 * (inColpo ? 0.25 : 1);
  eroe.vel += ((m * velMax) - eroe.vel) * Math.min(1, dt * 8);
  if (m > 0.05) {
    const obj = Math.atan2(mx, mz);
    let d = obj - eroe.dir; d = Math.atan2(Math.sin(d), Math.cos(d));
    eroe.dir += d * Math.min(1, dt * 12);
  }
  const vx = Math.sin(eroe.dir) * eroe.vel, vz = Math.cos(eroe.dir) * eroe.vel;
  eroe.pos.x += vx * dt; eroe.pos.z += vz * dt;
  const lim = LATO - 0.8;
  eroe.pos.x = THREE.MathUtils.clamp(eroe.pos.x, -lim, lim);
  eroe.pos.z = THREE.MathUtils.clamp(eroe.pos.z, -lim, lim);
  for (const s of [...solidi, ...bersagli.filter(b => b.stato === 'fermo').map(b => ({ x: b.pos.x, z: b.pos.z, r: b.raggio }))]) {
    const dx = eroe.pos.x - s.x, dz = eroe.pos.z - s.z, d = Math.hypot(dx, dz), r = s.r + 0.35;
    if (d < r && d > 1e-4) { eroe.pos.x = s.x + dx / d * r; eroe.pos.z = s.z + dz / d * r; }
  }
  eroe.obj.position.copy(eroe.pos);
  eroe.obj.rotation.y = eroe.dir;

  // miscela camminata / corsa / fermo
  const v = eroe.vel / 4.6;
  const wIdle = Math.max(0, 1 - v * 3), wWalk = Math.max(0, 1 - Math.abs(v - 0.35) * 3.5), wJog = Math.max(0, (v - 0.3) * 1.6);
  const somma = wIdle + wWalk + wJog || 1;
  const riduci = inColpo ? 0.15 : 1;
  eroe.azioni.Idle_Loop.setEffectiveWeight(wIdle / somma * riduci);
  eroe.azioni.Walk_Loop.setEffectiveWeight(wWalk / somma * riduci);
  eroe.azioni.Jog_Fwd_Loop.setEffectiveWeight(Math.min(1, wJog / somma) * riduci);

  if (Demo.premuto(' ') || (autoPugno > 0 && t >= autoPugno)) { autoPugno = -1; colpisci(); }
  if (inColpo) {
    eroe.colpo -= dt;
    const fatto = 1 - eroe.colpo / eroe.durata;
    if (!eroe.colpito && fatto > 0.36) { eroe.colpito = true; impatto(); }
    if (eroe.colpo <= 0) { eroe.attiva.fadeOut(0.15); }
  }
  aggiornaMantello(t, eroe.vel);
}

// ─────────────────────────── ciclo ───────────────────────────
const vecchioTarget = new THREE.Vector3().copy(controls.target);
const u = quad.material.uniforms;
Demo.loop((dt, t) => {
  let dtg = dt;
  if (fermo > 0) { fermo -= dt; dtg = dt * 0.05; }      // un attimo di sospensione all'impatto
  aggiornaEroe(dtg, t);
  aggiornaBersagli(dtg, t);
  eroe.mixer.update(dtg);

  // la camera segue l'eroe mantenendo l'orbita scelta col mouse
  const nt = tmp.set(eroe.pos.x, 1.5, eroe.pos.z);
  const delta = nt.clone().sub(vecchioTarget);
  controls.target.add(delta); camera.position.add(delta); vecchioTarget.copy(controls.target);
  controls.update();
  let sx = 0, sy = 0;
  if (scossa > 0) { scossa -= dt; sx = (Math.random() - 0.5) * scossa * 0.5; sy = (Math.random() - 0.5) * scossa * 0.5; }
  camera.position.x += sx; camera.position.y += sy;
  camera.updateMatrixWorld();

  sole.position.set(eroe.pos.x + 18, 30, eroe.pos.z + 12); sole.target.position.set(eroe.pos.x, 0, eroe.pos.z);

  renderer.setRenderTarget(rtCol); renderer.render(scene, camera);
  cielo.visible = false; scene.overrideMaterial = matNormali; const bg = scene.background; scene.background = null;
  renderer.setClearColor(0x000000, 1);
  renderer.setRenderTarget(rtNor); renderer.render(scene, camera);
  scene.overrideMaterial = null; cielo.visible = true; scene.background = bg;
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  camera.position.x -= sx; camera.position.y -= sy;

  disegnaScoppi(dt);
});
Demo.extra('<p>Palette di stampa: <b style="color:#e3232a">rosso</b>, <b style="color:#e0b800">giallo</b>, <b style="color:#2a6bcc">blu</b>, nero e carta. Arancio e verde nascono da due retini sovrapposti.</p>');
Demo.pronto();
