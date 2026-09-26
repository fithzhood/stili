// Demo "foto": natura morta fotorealistica in raster di qualità con accumulo progressivo.
// Mentre la camera si muove si vede un fotogramma normale; appena ci si ferma ogni fotogramma
// sposta di poco la camera nel pixel, il punto di vista sull'apertura dell'obiettivo e la luce
// dentro la sua sorgente: la media dà antialias, sfocatura di profondità vera e ombre morbide.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import * as O from './oggetti.js?v=6';

// Ambienti: HDRI, rotazione, esposizione, direzione e dimensione della luce principale.
const AMBIENTI = [
  { nome: 'Interno con finestra', file: 'lebombo', rot: 1.2, esp: 0.95, luce: [0.9, 0.55, -0.3], lc: 0xfff0d8, li: 5.0, morb: 0.10, sfocato: 0.12, ei: 0.6, bi: 0.9 },
  { nome: 'Studio', file: 'studio_small_03', rot: 2.2, esp: 1.0, luce: [-0.85, 0.75, -0.05], lc: 0xffffff, li: 4.5, morb: 0.22, sfocato: 0.2, ei: 0.9, bi: 0.8 },
  { nome: 'Tramonto', file: 'venice_sunset', rot: 3.6, esp: 0.85, luce: [0.35, 0.22, -1], lc: 0xffbe80, li: 5.5, morb: 0.03, sfocato: 0.08, ei: 0.6, bi: 0.9 },
  { nome: 'Caminetto', file: 'fireplace', rot: 0.4, esp: 0.95, luce: [-0.9, 0.35, 0.2], lc: 0xff9a50, li: 4.0, morb: 0.12, sfocato: 0.2, ei: 0.35, bi: 0.45 },
];

try {
  Demo.carica('Carico ambienti e modelli');
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: Demo.shot, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.02, 50);
  camera.position.set(0.56, 0.36, 1.1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.0, 0.135, 0.0);
  controls.enableDamping = true; controls.dampingFactor = 0.12;
  controls.minDistance = 0.45; controls.maxDistance = 2.2;
  controls.maxPolarAngle = Math.PI * 0.47;
  if (Demo.query.get('cam') === '2') camera.position.set(-0.45, 0.22, 0.72);
  controls.update();

  const luce = new THREE.DirectionalLight(0xffffff, 2);
  luce.castShadow = true; luce.shadow.mapSize.set(2048, 2048); luce.shadow.radius = 1.5;
  luce.shadow.bias = -0.0003; luce.shadow.normalBias = 0.002;
  const sc = luce.shadow.camera; sc.left = sc.bottom = -0.7; sc.right = sc.top = 0.7; sc.near = 0.1; sc.far = 5;
  scene.add(luce, luce.target);

  // ── oggetti ──
  scene.add(O.tavolo(), O.tovaglia());
  const calice = O.calice(); calice.position.set(0.2, 0, 0.19); scene.add(calice);
  const caraffa = O.caraffa(); caraffa.position.set(-0.33, 0, -0.06); scene.add(caraffa);
  const modelli = await Promise.all([
    O.modello('antique_ceramic_vase_01', -0.12, -0.2, 0.6),
    O.modello('brass_pot_01', 0.1, -0.06, -0.5),
    O.modello('food_apple_01', -0.07, 0.2, 0.4),
    O.modello('food_apple_01', 0.035, 0.26, 2.2),
    O.modello('food_pomegranate_01', -0.17, 0.16, 1.1),
    O.modello('lemon', 0.09, 0.14, 0.3, 1, Math.PI / 2, 0.2),
  ]);
  modelli.forEach(m => scene.add(m));
  const vetri = [calice, caraffa];

  Demo.carica('Carico ambienti', 0.6);
  const hdr = new HDRLoader();
  const mappe = await Promise.all(AMBIENTI.map(a => hdr.loadAsync(`assets/hdri/${a.file}_1k.hdr`)));
  mappe.forEach(t => { t.mapping = THREE.EquirectangularReflectionMapping; });

  // ── catena di post: scena → occlusione ambientale (senza i vetri) → tone mapping ──
  const W = () => innerWidth, H = () => innerHeight;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W(), H(), { type: THREE.HalfFloatType, samples: 0 }));
  composer.renderToScreen = false;
  composer.addPass(new RenderPass(scene, camera));
  class Visibili extends Pass {
    constructor(v) { super(); this.v = v; this.needsSwap = false; }
    render() { vetri.forEach(o => { o.visible = this.v; }); }
  }
  const gtao = new GTAOPass(scene, camera, W(), H());
  gtao.updateGtaoMaterial({ radius: 0.06, distanceExponent: 1.5, thickness: 0.02, scale: 1.0, samples: 12 });
  gtao.blendIntensity = 0.85;
  composer.addPass(new Visibili(false)); composer.addPass(gtao); composer.addPass(new Visibili(true));
  composer.addPass(new OutputPass());

  // accumulo: media progressiva dei fotogrammi da fermo
  const opz = { type: THREE.HalfFloatType, depthBuffer: false };
  let accA = new THREE.WebGLRenderTarget(W(), H(), opz), accB = new THREE.WebGLRenderTarget(W(), H(), opz);
  const mix = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tNuovo: { value: null }, tVecchio: { value: null }, peso: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tNuovo, tVecchio; uniform float peso; varying vec2 vUv; void main(){ gl_FragColor = mix(texture2D(tVecchio, vUv), texture2D(tNuovo, vUv), peso); }',
    depthTest: false, depthWrite: false, toneMapped: false,
  }));
  const copia = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { t: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }',
    depthTest: false, depthWrite: false, toneMapped: false,
  }));

  let amb = parseInt(Demo.query.get('amb') || '0', 10) % AMBIENTI.length;
  const dirLuce = new THREE.Vector3();
  function metti(i) {
    const a = AMBIENTI[i];
    scene.environment = scene.background = mappe[i];
    scene.environmentRotation.set(0, a.rot, 0); scene.backgroundRotation.set(0, a.rot, 0);
    scene.backgroundBlurriness = a.sfocato;
    scene.environmentIntensity = a.ei; scene.backgroundIntensity = a.bi;
    renderer.toneMappingExposure = a.esp;
    luce.color.set(a.lc); luce.intensity = a.li;
    dirLuce.set(...a.luce).normalize();
    mostraNome(a.nome);
    n = 0;
  }

  // etichetta dell'ambiente e barretta dei campioni accumulati
  const et = document.createElement('div');
  et.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);padding:6px 14px;border-radius:999px;background:rgba(14,13,12,.6);color:#f2efe8;font:13px "Segoe UI",sans-serif;z-index:900;transition:opacity .6s;pointer-events:none;opacity:0';
  const barra = document.createElement('div');
  barra.style.cssText = 'position:fixed;right:14px;bottom:26px;width:120px;height:3px;background:rgba(255,255,255,.15);border-radius:2px;z-index:900;overflow:hidden';
  const riemp = document.createElement('div'); riemp.style.cssText = 'height:100%;width:0;background:#e8c98f';
  barra.append(riemp); document.body.append(et, barra);
  if (Demo.shot) barra.style.display = 'none';
  let tEt = 0, n = 0;
  function mostraNome(s) { et.textContent = 'Ambiente: ' + s + ' · H per cambiare'; et.style.opacity = Demo.shot ? 0 : 1; tEt = 2.2; }
  metti(amb);

  let mosso = true;
  controls.addEventListener('change', () => { mosso = true; });
  addEventListener('resize', () => {
    camera.aspect = W() / H(); camera.updateProjectionMatrix();
    renderer.setSize(W(), H()); composer.setSize(W(), H()); gtao.setSize(W(), H());
    accA.setSize(W(), H()); accB.setSize(W(), H()); n = 0;
  });

  const MAX = Demo.shot ? 24 : 64;           // poi ci si ferma: niente GPU accesa a vuoto
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const destra = new THREE.Vector3(), su = new THREE.Vector3(), fuoco = new THREE.Vector3(), base = new THREE.Vector3();
  const APERTURA = 0.0055;                   // raggio della lente in metri: un f/5 circa a questa distanza

  Demo.loop((dt) => {
    if (Demo.premuto('h')) { amb = (amb + 1) % AMBIENTI.length; metti(amb); }
    if (tEt > 0) { tEt -= dt; if (tEt <= 0) et.style.opacity = 0; }
    controls.update();
    if (Demo.shot && dt > 0) return;          // in foto si lavora solo sui fotogrammi fermi finali
    if (mosso) { n = 0; mosso = false; }
    if (n >= MAX) {                           // immagine finita: dal vivo la tela resta com'è
      if (Demo.shot) { renderer.setRenderTarget(null); copia.material.uniforms.t.value = accA.texture; copia.render(renderer); }
      return;                                 // (in foto Chrome vuole un disegno a ogni fotogramma)
    }
    for (let rip = Demo.shot ? 6 : 1; rip > 0 && n < MAX; rip--) campione();
  });

  function campione() {

    // campione n: spostamento nel pixel, sull'apertura e dentro la sorgente di luce
    const fermo = n > 0 || Demo.shot;
    const a = AMBIENTI[amb];
    const u = halton(n + 1, 2), v = halton(n + 1, 3), w = halton(n + 1, 5);
    base.copy(camera.position);
    if (fermo) {
      camera.setViewOffset(W(), H(), u - 0.5, v - 0.5, W(), H());
      const r = Math.sqrt(w) * APERTURA, th = u * Math.PI * 2 * 7.0;
      fuoco.copy(controls.target);
      destra.setFromMatrixColumn(camera.matrixWorld, 0); su.setFromMatrixColumn(camera.matrixWorld, 1);
      camera.position.addScaledVector(destra, Math.cos(th) * r).addScaledVector(su, Math.sin(th) * r);
      camera.lookAt(fuoco);
    }
    const jl = fermo ? a.morb : 0;
    const lx = (halton(n + 1, 7) - 0.5) * 2 * jl, lz = (halton(n + 1, 11) - 0.5) * 2 * jl;
    luce.position.set(dirLuce.x + lx, dirLuce.y, dirLuce.z + lz).normalize().multiplyScalar(2);

    if (Demo.query.get('semplice')) { renderer.setRenderTarget(null); renderer.render(scene, camera); n++; return; }
    composer.render();
    mix.material.uniforms.tNuovo.value = composer.readBuffer.texture;
    mix.material.uniforms.tVecchio.value = accA.texture;
    mix.material.uniforms.peso.value = 1 / (n + 1);
    renderer.setRenderTarget(accB); mix.render(renderer);
    [accA, accB] = [accB, accA];
    renderer.setRenderTarget(null);
    copia.material.uniforms.t.value = accA.texture; copia.render(renderer);

    if (fermo) { camera.clearViewOffset(); camera.position.copy(base); camera.lookAt(controls.target); }
    n++;
    riemp.style.width = Math.min(100, n / MAX * 100) + '%';
  }

  Demo.extra(`<p>Tavolo, tovaglia, calice di vino e caraffa sono geometria procedurale; vaso, ottone e frutta
    sono scansioni fotogrammetriche di Poly Haven. La luce viene da una foto panoramica HDR dell'ambiente.
    Da fermo l'immagine si affina: ogni fotogramma sposta di poco obiettivo e luce, e la media dà sfocatura
    di profondità e ombre morbide come in una foto. La barretta in basso a destra mostra i campioni.</p>`);
  Demo.pronto();
} catch (e) { Demo.errore(e); }
