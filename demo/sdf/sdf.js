// Demo "sdf": un mondo intero in un fragment shader. Qui c'è solo il contorno:
// la camera in volo libero, la risoluzione che si adatta per restare a 60 fps,
// e l'ingrandimento finale dell'immagine calcolata a risoluzione ridotta.
import * as THREE from 'three';
import { FRAG, VERT } from './scena.js?v=6';

try {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: Demo.shot, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  document.body.prepend(renderer.domElement);
  renderer.debug.onShaderError = (gl, prog, vs, fs) => Demo.errore(new Error('shader: ' + (gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog))));

  // Scala di rendering: in foto piena (e un po' sovracampionata), dal vivo si adatta.
  // Si calcola a metà risoluzione e si ingrandisce: con una GPU integrata è l'unico modo di stare a 60 fps.
  let scala = parseFloat(Demo.query.get('scala')) || 0.5;
  const SCALA_MIN = 0.33, SCALA_MAX = 0.75;

  const bersaglio = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const accumA = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });

  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));

  const sole = new THREE.Vector3(0.94, 0.16, 0.30).normalize();
  const uni = {
    uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() },
    uRot: { value: new THREE.Matrix3() }, uFov: { value: Math.tan(THREE.MathUtils.degToRad(52) / 2) },
    uSun: { value: sole }, uJit: { value: new THREE.Vector2() }, uZero: { value: 0 }, uDebug: { value: parseInt(Demo.query.get('debug') || '0', 10) },
  };
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: uni, depthTest: false, depthWrite: false,
    vertexShader: 'precision highp float;\nin vec3 position;\n' + VERT, fragmentShader: FRAG,
  });
  const quad = new THREE.Mesh(tri, mat); quad.frustumCulled = false;
  const scena = new THREE.Scene(); scena.add(quad);
  const camOrto = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Passaggio finale: media progressiva quando si sta fermi (antialias gratis), poi a schermo.
  const uniMix = { tNuovo: { value: null }, tVecchio: { value: null }, uPeso: { value: 1 } };
  const matMix = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: uniMix, depthTest: false, depthWrite: false,
    vertexShader: 'precision highp float;\nin vec3 position;\n' + VERT,
    fragmentShader: `precision highp float; uniform sampler2D tNuovo, tVecchio; uniform float uPeso; in vec2 vUv; out vec4 o;
      void main(){ o = mix(texture(tVecchio, vUv), texture(tNuovo, vUv), uPeso); }`,
  });
  const scenaMix = new THREE.Scene(); const qMix = new THREE.Mesh(tri, matMix); qMix.frustumCulled = false; scenaMix.add(qMix);
  const matCopia = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: { t: { value: null } }, depthTest: false, depthWrite: false,
    vertexShader: 'precision highp float;\nin vec3 position;\n' + VERT,
    fragmentShader: `precision highp float; uniform sampler2D t; in vec2 vUv; out vec4 o; void main(){ o = texture(t, vUv); }`,
  });
  const scenaCopia = new THREE.Scene(); const qC = new THREE.Mesh(tri, matCopia); qC.frustumCulled = false; scenaCopia.add(qC);
  const accumB = accumA.clone();
  let acc = [accumA, accumB], nAcc = 0;

  function dimensiona() {
    const w = Math.max(2, Math.round(innerWidth * scala)), h = Math.max(2, Math.round(innerHeight * scala));
    bersaglio.setSize(w, h); accumA.setSize(w, h); accumB.setSize(w, h);
    uni.uRes.value.set(w, h);
    nAcc = 0;
  }
  renderer.setSize(innerWidth, innerHeight);
  dimensiona();
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); dimensiona(); });

  // ── Camera in volo libero ──
  // Inquadratura iniziale "da cartolina": il tempio in controluce radente, l'acquedotto
  // che scavalca il vuoto, le nuvole che si perdono verso il sole.
  const cam = new THREE.Vector3(-23, 7.5, 27);
  let yaw = 0, pitch = 0;
  (function puntaA(x, y, z) {
    const d = new THREE.Vector3(x, y, z).sub(cam).normalize();
    yaw = Math.atan2(-d.x, -d.z); pitch = Math.asin(d.y);
  })(7, 0.0, 1);
  const q = Demo.query;
  if (q.get('cam') === '2') { cam.set(12, 3, 26); yaw = 0.2; pitch = -0.05; }
  if (q.get('cam') === '3') { cam.set(60, 25, 60); yaw = 0.9; pitch = -0.25; }

  const tela = renderer.domElement;
  tela.addEventListener('click', () => { if (document.pointerLockElement !== tela) tela.requestPointerLock?.(); });
  addEventListener('mousemove', e => {
    if (document.pointerLockElement !== tela) return;
    yaw -= e.movementX * 0.0022; pitch -= e.movementY * 0.0022;
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
    nAcc = 0;
  });

  const rot = new THREE.Matrix4(), rot3 = new THREE.Matrix3(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
  const avanti = new THREE.Vector3(), destra = new THREE.Vector3();
  let vel = new THREE.Vector3();
  let mediaDt = 1 / 60, cambioScala = 0;

  // Sequenza di Halton per spostare il campione dentro il pixel a ogni fotogramma fermo.
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

  let tempo = 0;
  Demo.loop((dt, t) => {
    // movimento
    const g = Demo.guarda();
    if (g.x || g.y) { yaw -= g.x * dt * 1.8; pitch = Math.max(-1.45, Math.min(1.45, pitch + g.y * dt * 1.4)); }
    eul.set(pitch, yaw, 0); rot.makeRotationFromEuler(eul);
    avanti.set(0, 0, -1).applyMatrix4(rot); destra.set(1, 0, 0).applyMatrix4(rot);
    const a = Demo.asse();
    const su = (Demo.giu('e') ? 1 : 0) - (Demo.giu('q') ? 1 : 0);
    const veloce = Demo.giu('Shift') ? 3.2 : 1;
    const target = new THREE.Vector3().addScaledVector(avanti, a.y).addScaledVector(destra, a.x);
    target.y += su;
    target.multiplyScalar(14 * veloce);
    vel.lerp(target, 1 - Math.exp(-dt * 6));
    cam.addScaledVector(vel, dt);
    cam.y = Math.max(-40, Math.min(90, cam.y));
    const muove = vel.lengthSq() > 1e-4 || g.x || g.y;
    if (muove) nAcc = 0;
    tempo = t;

    // in foto si calcola solo l'immagine finale, non i 90 fotogrammi intermedi
    if (Demo.shot && dt > 0) return;

    // risoluzione adattiva: se si scende sotto i 50 fps si abbassa, se si sta larghi si risale
    if (!Demo.shot && dt > 0) {
      mediaDt += (dt - mediaDt) * 0.05;
      cambioScala += dt;
      if (cambioScala > 1.0) {
        cambioScala = 0;
        if (mediaDt > 1 / 50 && scala > SCALA_MIN) { scala = Math.max(SCALA_MIN, scala - 0.08); dimensiona(); }
        else if (mediaDt < 1 / 59 && scala < SCALA_MAX - 0.05 && !muove) { scala = Math.min(SCALA_MAX, scala + 0.04); dimensiona(); }
      }
    }

    // l'animazione (nuvole che scorrono, isole che ondeggiano) invalida la media: si tiene
    // una media corta, così da fermi si ha un antialias senza scie visibili
    const MAXACC = Demo.shot ? 6 : 8;
    if (Demo.shot && nAcc >= MAXACC) {            // foto già affinata: si ridisegna solo la media
      matCopia.uniforms.t.value = acc[0].texture; renderer.setRenderTarget(null); renderer.render(scenaCopia, camOrto);
      return;
    }
    const k = nAcc;
    uni.uJit.value.set(halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5);
    uni.uTime.value = tempo;
    uni.uCam.value.copy(cam);
    rot3.setFromMatrix4(rot);
    uni.uRot.value.copy(rot3);

    renderer.setRenderTarget(bersaglio);
    renderer.render(scena, camOrto);
    const [vecchio, nuovo] = acc;
    uniMix.tNuovo.value = bersaglio.texture;
    uniMix.tVecchio.value = vecchio.texture;
    uniMix.uPeso.value = 1 / Math.min(k + 1, MAXACC);
    renderer.setRenderTarget(nuovo);
    renderer.render(scenaMix, camOrto);
    acc = [nuovo, vecchio];
    nAcc++;
    matCopia.uniforms.t.value = nuovo.texture;
    renderer.setRenderTarget(null);
    renderer.render(scenaCopia, camOrto);
  });

  Demo.extra(`<p>Tutto quello che vedi, isole, colonne, acquedotto, cipressi, nuvole e cielo, è calcolato
    da un'unica funzione di distanza: nessun triangolo, nessuna texture. Da fermo l'immagine si affina
    mediando più campioni per pixel. Clic per catturare il mouse, <b>Q/E</b> per scendere e salire,
    <b>Shift</b> per volare più veloce.</p>`);
  Demo.pronto();
} catch (e) { Demo.errore(e); }
