// Gli oggetti della natura morta: tavolo, tovaglia, bicchiere di vino e caraffa sono
// geometria procedurale; vaso, pentolino d'ottone e frutta sono scansioni di Poly Haven.
// Unità: metri. Il piano del tavolo sta a y = 0.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const tl = new THREE.TextureLoader();
function tex(nome, srgb, rip) {
  const t = tl.load('assets/tex/' + nome);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rip[0], rip[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function tavolo() {
  const g = new THREE.BoxGeometry(1.8, 0.05, 1.1);
  g.translate(0, -0.025, -0.15);
  const m = new THREE.MeshPhysicalMaterial({
    map: tex('legno_col.jpg', true, [1.4, 1]), normalMap: tex('legno_nor.jpg', false, [1.4, 1]),
    roughnessMap: tex('legno_rug.jpg', false, [1.4, 1]), color: 0x7d5a44, roughness: 0.85,
    clearcoat: 0.25, clearcoatRoughness: 0.35, normalScale: new THREE.Vector2(0.6, 0.6),
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  return mesh;
}

// Tovaglia di lino: una griglia che si adagia sul piano e ricade oltre il bordo anteriore,
// con pieghe morbide. Il bordo del tavolo è a z = 0.4.
export function tovaglia() {
  const NX = 140, NZ = 110, W = 0.62, L = 0.78;
  const g = new THREE.PlaneGeometry(W, L, NX, NZ);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const BORDO = 0.4, R = 0.02;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i);
    // la tovaglia è ruotata di qualche grado e spostata verso destra e in avanti
    const a = -0.22;
    let X = x * Math.cos(a) - z * Math.sin(a) + 0.05, Z = x * Math.sin(a) + z * Math.cos(a) + 0.2;
    // pieghe: onde lungo la caduta più un po' di rumore
    // pieghe irregolari: somma di onde di direzione e fase diverse, smorzate verso il centro
    const piega = 0.008 * Math.sin(x * 31 + Math.sin(z * 7) * 2.2) * (0.5 + 0.5 * Math.sin(z * 4.3 + 1))
      + 0.0035 * Math.sin(x * 13 - z * 19 + 2) * Math.sin(x * 5 + 0.3) + 0.002 * Math.sin(x * 57 + z * 11);
    let y = 0.0025 + Math.max(0, piega);
    if (Z > BORDO) {
      // si arrotola sul bordo e scende
      const s = Z - BORDO;
      const ang = Math.min(s / R, Math.PI / 2);
      const giu = s > R * Math.PI / 2 ? s - R * Math.PI / 2 : 0;
      Z = BORDO + Math.sin(ang) * (R + 0.003);
      y = -R + Math.cos(ang) * (R + 0.003) - giu;
      // nel cadere le pieghe si fanno più profonde
      Z += 0.018 * Math.sin(x * 22 + 0.7) * Math.min(1, giu * 12);
    }
    p.setXYZ(i, X, y, Z);
  }
  g.computeVertexNormals();
  const m = new THREE.MeshPhysicalMaterial({
    map: tex('stoffa_col.jpg', true, [2.4, 3]), normalMap: tex('stoffa_nor.jpg', false, [2.4, 3]),
    roughnessMap: tex('stoffa_rug.jpg', false, [2.4, 3]), color: 0xe4d2b2, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1,
    sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xfff4e0), side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// Profilo chiuso (esterno su, interno giù) per un solido di rotazione con spessore vero:
// il path tracer rifrange solo attraverso volumi chiusi.
function tornio(esterno, spessore, fondo, seg = 96) {
  // il profilo passa per una spline: niente spigoli sulla sagoma del vetro
  esterno = new THREE.SplineCurve(esterno.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(esterno.length * 10).map(p => [Math.max(0.0005, p.x), Math.max(0, p.y)]);
  const pts = esterno.map(([r, y]) => new THREE.Vector2(r, y));
  const interno = [];
  for (let i = esterno.length - 1; i >= 0; i--) {
    const [r, y] = esterno[i];
    if (y < fondo) break;
    interno.push(new THREE.Vector2(Math.max(0.0005, r - spessore), y));
  }
  interno.push(new THREE.Vector2(0.0005, fondo));
  const g = new THREE.LatheGeometry(pts.concat(interno), seg);
  g.computeVertexNormals();
  return g;
}

const vetro = () => new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, ior: 1.5, thickness: 0.004,
  specularIntensity: 1, envMapIntensity: 1,
});

export function calice() {
  const gr = new THREE.Group();
  // piede, stelo e coppa in un unico profilo esterno (raggio, altezza) in metri
  const prof = [[0.0005, 0], [0.036, 0], [0.037, 0.002], [0.034, 0.004], [0.008, 0.008], [0.0042, 0.016],
    [0.0038, 0.07], [0.006, 0.078], [0.02, 0.088], [0.036, 0.105], [0.043, 0.13], [0.042, 0.155], [0.037, 0.19], [0.0365, 0.195]];
  const g = tornio(prof, 0.0018, 0.082);
  const c = new THREE.Mesh(g, vetro());
  c.castShadow = true;
  gr.add(c);
  // vino: volume chiuso dentro la coppa, fino a 0.135
  const vin = [[0.0005, 0.0835], [0.017, 0.0885], [0.033, 0.1055], [0.0405, 0.13], [0.0408, 0.136], [0.0005, 0.136]];
  const gv = new THREE.LatheGeometry(vin.map(([r, y]) => new THREE.Vector2(r, y)), 96);
  // il vino è opaco: così il vetro, che rifrange ciò che sta dietro, lo mostra deformato
  const mv = new THREE.MeshPhysicalMaterial({
    color: 0x4a0612, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
    sheen: 0.4, sheenColor: new THREE.Color(0x9a1020), sheenRoughness: 0.5,
  });
  const v = new THREE.Mesh(gv, mv); v.castShadow = true;
  gr.add(v);
  return gr;
}

export function caraffa() {
  const prof = [[0.0005, 0], [0.058, 0], [0.062, 0.004], [0.072, 0.04], [0.074, 0.08], [0.066, 0.13], [0.04, 0.17],
    [0.026, 0.2], [0.024, 0.25], [0.027, 0.27], [0.029, 0.275]];
  const m = new THREE.Mesh(tornio(prof, 0.0025, 0.006), vetro());
  m.castShadow = true;
  return m;
}

// Carica un modello glTF e lo appoggia sul tavolo in (x, z), ruotato di ry.
const gl = new GLTFLoader();
export function modello(nome, x, z, ry = 0, scala = 1, rx = 0, rz = 0) {
  return new Promise((ok, ko) => {
    gl.load(`assets/modelli/${nome}/${nome}_1k.gltf`, g => {
      const o = g.scene;
      o.scale.setScalar(scala);
      o.rotation.set(rx, ry, rz);
      o.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o);
      o.position.set(x, -b.min.y, z);
      o.traverse(n => { if (n.isMesh) { n.castShadow = n.receiveShadow = true; } });
      ok(o);
    }, undefined, ko);
  });
}
