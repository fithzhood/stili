// Demo "voxel": un'isola sospesa a cubetti da scavare e ricostruire.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as M from './mondo.js?v=6';

try {
  Demo.carica('Genero l\'isola');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: Demo.shot, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 1, 1200);
  // il mondo è centrato sull'origine: la griglia va da -48 a +48
  const OFF = new THREE.Vector3(-M.SX / 2, -44, -M.SZ / 2);
  const mondo = new THREE.Group(); mondo.position.copy(OFF); scene.add(mondo);

  // ── cielo: gradiente con sole, dipinto su una sfera ──
  const cieloMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSole: { value: new THREE.Vector3() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 uSole;
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 zen = vec3(0.08, 0.26, 0.70), orz = vec3(0.46, 0.68, 0.95), sot = vec3(0.34, 0.54, 0.86);
        vec3 c = y > 0.0 ? mix(orz, zen, pow(y, 0.55)) : mix(orz, sot, pow(-y, 0.6));
        float s = max(dot(d, uSole), 0.0);
        c += vec3(1.0, 0.85, 0.6) * (0.25 * pow(s, 12.0) + 0.6 * pow(s, 400.0));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), cieloMat);
  cielo.frustumCulled = false; scene.add(cielo);
  scene.fog = new THREE.Fog(0x8fb4e6, 260, 800);

  // ── luci ──
  const dirSole = new THREE.Vector3(-0.55, 0.72, 0.42).normalize();
  cieloMat.uniforms.uSole.value.copy(dirSole);
  const sole = new THREE.DirectionalLight(0xfff0d8, 3.1);
  sole.position.copy(dirSole).multiplyScalar(120);
  sole.target.position.set(0, 0, 0);
  sole.castShadow = true;
  sole.shadow.mapSize.set(2048, 2048);
  const sc = sole.shadow.camera; sc.left = -66; sc.right = 66; sc.top = 66; sc.bottom = -66; sc.near = 10; sc.far = 260;
  sole.shadow.bias = -0.0008; sole.shadow.normalBias = 0.25; sole.shadow.radius = 2.2;
  scene.add(sole, sole.target);
  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x9c8e78, 1.35));
  // luce che risale dalle nuvole sotto l'isola: senza, la pancia di roccia è un buco nero
  const riflessa = new THREE.DirectionalLight(0xc8dcff, 0.9); riflessa.position.set(40, -100, 60); scene.add(riflessa);

  // ── materiali ──
  const matBlocchi = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const uTempo = { value: 0 };
  const matAcqua = new THREE.MeshStandardMaterial({
    color: 0x3a8ad0, vertexColors: true, roughness: 0.08, metalness: 0.05,
    transparent: true, opacity: 0.78, depthWrite: false,
  });
  matAcqua.onBeforeCompile = sh => {
    sh.uniforms.uTempo = uTempo;
    sh.uniforms.uFondo = { value: 4.0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMondo; varying vec3 vNorm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMondo = (modelMatrix * vec4(transformed, 1.0)).xyz - vec3(' + OFF.x.toFixed(1) + ',' + OFF.y.toFixed(1) + ',' + OFF.z.toFixed(1) + ');\nvNorm = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTempo; uniform float uFondo; varying vec3 vMondo; varying vec3 vNorm;
        float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float verticale = 1.0 - abs(vNorm.y);
        // cascata: strisce di schiuma che scendono
        float lungo = vNorm.x != 0.0 ? vMondo.z : vMondo.x;
        float sch = nn(vec2(lungo * 3.0, vMondo.y * 0.8 + uTempo * 6.0)) * nn(vec2(lungo * 7.0, vMondo.y * 2.0 + uTempo * 9.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.97, 1.0), verticale * smoothstep(0.18, 0.55, sch) * 0.85);
        // lago: riflessi mossi
        float rip = nn(vMondo.xz * 1.3 + uTempo * vec2(0.6, 0.35)) * nn(vMondo.xz * 2.1 - uTempo * vec2(0.4, 0.5));
        diffuseColor.rgb += (1.0 - verticale) * vec3(0.35, 0.45, 0.5) * smoothstep(0.35, 0.7, rip);
        diffuseColor.a = mix(diffuseColor.a, 0.9, verticale);
        // la cascata svanisce nel vuoto
        diffuseColor.a *= smoothstep(uFondo, uFondo + 22.0, vMondo.y);`);
  };

  // ── chunk ──
  M.genera();
  const NCX = M.SX / M.CH, NCY = M.SY / M.CH, NCZ = M.SZ / M.CH;
  const chunk = new Map();
  function rifaiChunk(cx, cy, cz) {
    if (cx < 0 || cy < 0 || cz < 0 || cx >= NCX || cy >= NCY || cz >= NCZ) return;
    const k = cx + ',' + cy + ',' + cz;
    const vecchio = chunk.get(k);
    if (vecchio) { for (const m of vecchio) { mondo.remove(m); m.geometry.dispose(); } }
    const { g, gw } = M.costruisciChunk(cx, cy, cz);
    const mesh = [];
    if (g) { const m = new THREE.Mesh(g, matBlocchi); m.castShadow = m.receiveShadow = true; mondo.add(m); mesh.push(m); }
    if (gw) { const m = new THREE.Mesh(gw, matAcqua); m.receiveShadow = true; m.renderOrder = 2; mondo.add(m); mesh.push(m); }
    chunk.set(k, mesh);
  }
  for (let cy = 0; cy < NCY; cy++) for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) rifaiChunk(cx, cy, cz);

  // ── ciuffi d'erba e fiori: piccoli cubi istanziati sopra i prati ──
  const COL_CIUFFI = [0x5fa83a, 0xf2d24a, 0xe8604a, 0xf0f0ff].map(c => new THREE.Color(c));
  const nCiuffi = M.ciuffi.length * 2;
  const ciuffiMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), nCiuffi);
  ciuffiMesh.castShadow = false; ciuffiMesh.receiveShadow = true;
  const mtx = new THREE.Matrix4(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), pv = new THREE.Vector3();
  const cellaCiuffo = new Map();
  M.ciuffi.forEach((c, i) => {
    for (let j = 0; j < 2; j++) {
      const r1 = M.hash(c.x, c.z, 20 + j), r2 = M.hash(c.z, c.x, 40 + j);
      const fiore = c.t > 0 && j === 0;
      const alto = fiore ? 0.55 : 0.3 + 0.35 * r1;
      scl.set(fiore ? 0.26 : 0.14, alto, fiore ? 0.26 : 0.14);
      pv.set(c.x + 0.2 + 0.6 * r1, c.y + alto / 2, c.z + 0.2 + 0.6 * r2);
      if (fiore) pv.y = c.y + 0.35;
      mtx.compose(pv, quat, scl);
      ciuffiMesh.setMatrixAt(i * 2 + j, mtx);
      const col = fiore ? COL_CIUFFI[c.t] : COL_CIUFFI[0].clone().multiplyScalar(0.8 + 0.4 * r2);
      ciuffiMesh.setColorAt(i * 2 + j, col);
    }
    cellaCiuffo.set(c.x + ',' + c.y + ',' + c.z, i);
  });
  mondo.add(ciuffiMesh);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function togliCiuffo(x, y, z) {
    const i = cellaCiuffo.get(x + ',' + y + ',' + z);
    if (i == null) return;
    ciuffiMesh.setMatrixAt(i * 2, zero); ciuffiMesh.setMatrixAt(i * 2 + 1, zero);
    ciuffiMesh.instanceMatrix.needsUpdate = true;
    cellaCiuffo.delete(x + ',' + y + ',' + z);
  }

  // ── nuvole a blocchi, piatte come quelle di Minecraft, che scorrono piano ──
  const nuvole = new THREE.Group(); scene.add(nuvole);
  const matNuvola = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa9bd, emissiveIntensity: 0.35, transparent: true, opacity: 0.9, fog: false });
  function strato(y, seme, soglia, cella, alt) {
    const g = [];
    const N = 36;
    const box = new THREE.BoxGeometry(cella, alt, cella);
    const occ = (i, j) => {
      const v = 0.6 * vn(i * 0.22, j * 0.22, seme) + 0.4 * vn(i * 0.5, j * 0.5, seme + 3);
      return v > soglia;
    };
    const m = new THREE.InstancedMesh(box, matNuvola, N * N);
    let n = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (occ(i, j)) {
      const x = (i - N / 2) * cella, z = (j - N / 2) * cella;
      const d = Math.hypot(x, z);
      if (d < 85) continue;                          // lontano dall'isola, che resti in vista     // niente nuvole dentro l'isola
      mtx.makeTranslation(x, y, z); m.setMatrixAt(n++, mtx);
    }
    m.count = n;
    m.userData.giro = N * cella;
    return m;
  }
  function vn(x, z, s) {
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = M.hash(xi, zi, s), b = M.hash(xi + 1, zi, s), c = M.hash(xi, zi + 1, s), d = M.hash(xi + 1, zi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const stratoAlto = strato(95, 51, 0.64, 14, 5);
  const stratoBasso = strato(-70, 17, 0.6, 16, 6);
  nuvole.add(stratoAlto, stratoBasso);

  // ── camera ──
  camera.position.set(-80, 36, 102);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(4, -9, 6);
  controls.enableDamping = true;
  controls.minDistance = 40; controls.maxDistance = 320;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };
  controls.maxPolarAngle = Math.PI * 0.9;
  if (Demo.query.get('cam') === '2') { camera.position.set(70, 40, 60); controls.target.set(14, 3, 10); }
  if (Demo.query.get('cam') === '3') { camera.position.set(-30, 20, 45); controls.target.set(-10, 6, 0); }
  if (!Demo.shot) { controls.autoRotate = false; }
  controls.update();

  // ── evidenziatore del blocco sotto il puntatore ──
  const evid = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
    new THREE.LineBasicMaterial({ color: 0x101010, transparent: true, opacity: 0.75 }));
  const facciaEvid = new THREE.Mesh(new THREE.BoxGeometry(1.015, 1.015, 1.015),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }));
  evid.add(facciaEvid);
  evid.visible = false; mondo.add(evid);

  // ── barra dei materiali ──
  const SCELTE = [M.ERBA, M.TERRA, M.PIETRA, M.SABBIA, M.ASSI];
  let scelta = 0;
  const barra = document.createElement('div');
  barra.style.cssText = 'position:fixed;left:50%;bottom:56px;transform:translateX(-50%);display:flex;gap:6px;padding:6px;background:rgba(20,22,28,.55);border:2px solid rgba(0,0,0,.35);border-radius:6px;z-index:900;font:600 11px "Segoe UI",sans-serif;color:#fff';
  const caselle = SCELTE.map((b, i) => {
    const c = document.createElement('div');
    c.style.cssText = 'position:relative;width:48px;height:48px;border:2px solid rgba(255,255,255,.18);border-radius:3px;cursor:pointer;display:grid;place-items:center;background:rgba(0,0,0,.2)';
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40; disegnaCubo(cv, M.MAT[b].c);
    const n = document.createElement('span'); n.textContent = i + 1;
    n.style.cssText = 'position:absolute;left:3px;top:1px;text-shadow:0 1px 2px #000;opacity:.9';
    c.append(cv, n); c.title = M.MAT[b].nome;
    c.onclick = () => scegli(i);
    barra.append(c);
    return c;
  });
  const etichetta = document.createElement('div');
  etichetta.style.cssText = 'position:fixed;left:50%;bottom:122px;transform:translateX(-50%);font:600 14px "Segoe UI",sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.7);z-index:900;transition:opacity .6s;pointer-events:none';
  document.body.append(barra, etichetta);
  let timerEt = 0;
  function scegli(i) {
    scelta = i;
    caselle.forEach((c, j) => { c.style.borderColor = j === i ? '#fff' : 'rgba(255,255,255,.18)'; c.style.background = j === i ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.2)'; });
    etichetta.textContent = M.MAT[SCELTE[i]].nome; etichetta.style.opacity = 1; timerEt = 1.6;
  }
  scegli(0); etichetta.style.opacity = 0;
  function disegnaCubo(cv, c) {
    const x = cv.getContext('2d'), w = 40;
    const P = (a, b) => [w / 2 + (a - b) * 16 * 0.866, 4 + (a + b) * 8];
    const faccia = (pts, col) => { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.closePath(); x.fillStyle = col; x.fill(); };
    const top = [[w / 2, 3], [w / 2 + 16, 11], [w / 2, 19], [w / 2 - 16, 11]];
    faccia(top, c[0]);
    faccia([[w / 2 - 16, 11], [w / 2, 19], [w / 2, 37], [w / 2 - 16, 29]], c[1]);
    x.globalAlpha = 0.25; faccia([[w / 2 - 16, 11], [w / 2, 19], [w / 2, 37], [w / 2 - 16, 29]], '#000'); x.globalAlpha = 1;
    faccia([[w / 2, 19], [w / 2 + 16, 11], [w / 2 + 16, 29], [w / 2, 37]], c[1]);
    x.globalAlpha = 0.45; faccia([[w / 2, 19], [w / 2 + 16, 11], [w / 2 + 16, 29], [w / 2, 37]], '#000'); x.globalAlpha = 1;
  }

  // ── scavare e costruire ──
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let colpo = null;
  function mira(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const o = ray.ray.origin.clone().sub(OFF), d = ray.ray.direction;
    colpo = M.raggio(o, d);
    evid.visible = !!colpo;
    if (colpo) evid.position.set(colpo.x + 0.5, colpo.y + 0.5, colpo.z + 0.5);
  }
  function aggiorna(x, y, z) {
    // si ricostruisce solo il chunk toccato, più il vicino se il blocco sta sul bordo
    const cx = Math.floor(x / M.CH), cy = Math.floor(y / M.CH), cz = Math.floor(z / M.CH);
    const set = new Set([cx + ',' + cy + ',' + cz]);
    const lx = x % M.CH, ly = y % M.CH, lz = z % M.CH;
    const add = (a, b, c) => set.add(a + ',' + b + ',' + c);
    if (lx === 0) add(cx - 1, cy, cz); if (lx === M.CH - 1) add(cx + 1, cy, cz);
    if (ly === 0) add(cx, cy - 1, cz); if (ly === M.CH - 1) add(cx, cy + 1, cz);
    if (lz === 0) add(cx, cy, cz - 1); if (lz === M.CH - 1) add(cx, cy, cz + 1);
    for (const k of set) rifaiChunk(...k.split(',').map(Number));
  }
  let giu = null;
  const tela = renderer.domElement;
  tela.addEventListener('contextmenu', e => e.preventDefault());
  tela.addEventListener('pointerdown', e => { giu = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }; });
  tela.addEventListener('pointermove', e => { if (!giu) mira(e); });
  addEventListener('pointerup', e => {
    if (!giu) return;
    const mosso = Math.hypot(e.clientX - giu.x, e.clientY - giu.y) > 5;
    const b = giu.b; giu = null;
    if (mosso || e.target !== tela) return;
    azione(e, b);
  });
  function azione(e, b) {
    mira(e);
    if (!colpo) return;
    if (b === 0) {
      const { x, y, z } = colpo;
      // se il buco tocca l'acqua (di lato o da sopra) si riempie: un solo passo, niente simulazione dei fluidi
      const bagnato = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].some(([a, b, c]) => M.get(x + a, y + b, z + c) === M.ACQUA);
      M.set(x, y, z, bagnato ? M.ACQUA : M.ARIA);
      togliCiuffo(x, y + 1, z);
      aggiorna(x, y, z);
    } else if (b === 2) {
      const { px, py, pz } = colpo;
      if (!M.dentro(px, py, pz)) return;
      M.set(px, py, pz, SCELTE[scelta]);
      togliCiuffo(px, py, pz);
      aggiorna(px, py, pz);
    }
    mira(e);
  }
  // collaudo in foto: ?prova=1 scava 12 volte al centro dello schermo e costruisce una torretta accanto
  if (Demo.query.get('prova')) {
    const cx = innerWidth * 0.5, cy = innerHeight * 0.42;
    for (let i = 0; i < 12; i++) azione({ clientX: cx, clientY: cy }, 0);
    scegli(2);
    for (let i = 0; i < 6; i++) azione({ clientX: cx + 60, clientY: cy - i * 8 }, 2);
    mira({ clientX: cx, clientY: cy });
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  Demo.loop((dt, t) => {
    for (let i = 0; i < 5; i++) if (Demo.premuto(String(i + 1))) scegli(i);
    if (timerEt > 0) { timerEt -= dt; if (timerEt <= 0) etichetta.style.opacity = 0; }
    uTempo.value = t;
    // le nuvole scorrono e ricominciano dall'altro lato
    for (const s of [stratoAlto, stratoBasso]) {
      s.position.x = ((t * (s === stratoAlto ? 2.2 : 1.4) + s.userData.giro / 2) % s.userData.giro) - s.userData.giro / 2;
    }
    const g = Demo.guarda();
    if (g.x || g.y) {
      const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      sph.theta -= g.x * dt * 1.5; sph.phi = Math.max(0.2, Math.min(2.8, sph.phi - g.y * dt * 1.2));
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    }
    controls.update();
    renderer.render(scene, camera);
  });

  Demo.extra(`<p>Il mondo è una griglia di ${M.SX}×${M.SY}×${M.SZ} blocchi divisa in pezzi da 16³: a ogni modifica
    si ricostruisce solo il pezzo toccato. Di ogni cubo si disegnano solo le facce che danno sull'aria, e ogni
    vertice si scurisce in base ai tre blocchi che lo circondano: è l'occlusione ambientale per vertice.</p>
    <p><b>1-5</b> scelgono il materiale · trascina col sinistro per girare, col destro per spostare.</p>`);
  Demo.pronto();
} catch (e) { Demo.errore(e); }
