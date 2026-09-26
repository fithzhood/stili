// Il diorama: prato, cielo, colline di cartone ondulato, alberi piegati a V con la linguetta, nuvole appese al filo.
import * as THREE from 'three';
import { texDa, ondulato, kraft } from './carta.js?v=7';
import * as S from './scenari.js?v=7';
import { prato, TERRA } from './prato.js?v=7';

export const animati = [];      // {fn(t)}
const profCache = new Map();
export function profondita(map) {
  if (!profCache.has(map)) profCache.set(map, new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 }));
  return profCache.get(map);
}
export function matCarta(tex, opz = {}) {
  return new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, ...opz });
}

/** Ritaglio in piedi piegato a V lungo la mezzeria, con la linguetta di cartone che lo tiene su. */
export function piegato(scene, cv, x, z, h, piegaA = 0.28, rotY = 0) {
  const tex = texDa(cv), w = h * cv.width / cv.height;
  const m = matCarta(tex), g = new THREE.Group();
  for (const s of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(w / 2, h); geo.translate(s * w / 4, h / 2, 0);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, s < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
    const me = new THREE.Mesh(geo, m); me.rotation.y = s * -piegaA; me.castShadow = me.receiveShadow = true;
    me.customDepthMaterial = profondita(tex); g.add(me);
  }
  // linguetta: un trapezio di cartone piegato a terra dietro il ritaglio
  const tab = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.3, 0.35), linguettaMat); tab.rotation.x = -Math.PI / 2; tab.position.set(0, 0.012, -0.2); tab.receiveShadow = true; g.add(tab);
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  return g;
}
const [kc] = kraft(128, 64, 3); const linguettaMat = new THREE.MeshStandardMaterial({ map: texDa(kc), roughness: 1 });

export function prato3d(scene) {
  const { x0, x1, z0, z1 } = TERRA;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ map: prato(), roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
  // il tavolo sotto il foglio, oltre i bordi
  const [tc] = kraft(512, 512, 8, '#b98a5c'); const tt = texDa(tc, true); tt.repeat.set(8, 8);
  const tav = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: tt, roughness: 1, color: 0xd8b890 }));
  tav.rotation.x = -Math.PI / 2; tav.position.y = -0.02; tav.receiveShadow = true; scene.add(tav);
  // cielo: un grande foglio in piedi in fondo
  const cie = new THREE.Mesh(new THREE.PlaneGeometry(130, 40), new THREE.MeshBasicMaterial({ map: S.cielo() }));
  cie.position.set(2, 14, -24); scene.add(cie);
}

/** Collina di cartone ondulato: sagoma a gobbe estrusa, bordo con le onde del cartone in vista. */
const texOnd = ondulato();
export function collina(scene, x, z, W, H, col, scuro, seme, gobbe = 3) {
  const tr = g => {
    g.moveTo(0, 0); g.lineTo(0, H * 0.45);
    for (let i = 0; i < gobbe; i++) {
      const a = i / gobbe * W, b = (i + 1) / gobbe * W, hh = H * (0.7 + 0.3 * Math.sin(seme + i * 2.1));
      g.bezierCurveTo(a + (b - a) * 0.05, hh * 1.25, b - (b - a) * 0.05, hh * 1.25, b, H * (0.45 + 0.15 * Math.sin(seme + i)));
    }
    g.lineTo(W, 0); g.closePath();
  };
  const sh = new THREE.Shape(); tr(sh);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: false, curveSegments: 16 });
  const t = texOnd.clone(); t.needsUpdate = true; t.repeat.set(1.5, 1 / 0.14);
  const mats = [new THREE.MeshStandardMaterial({ map: S.cartoncino(tr, W, H, col, scuro, seme), roughness: 0.95 }), new THREE.MeshStandardMaterial({ map: t, roughness: 1 })];
  const m = new THREE.Mesh(geo, mats); m.position.set(x - W / 2, 0, z); m.castShadow = m.receiveShadow = true; scene.add(m);
  // i puntelli dietro: triangoli di cartone che la tengono in piedi
  for (let i = 0; i < 3; i++) {
    const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(1.2, 0); tri.lineTo(0, H * 0.4); tri.closePath();
    const p = new THREE.Mesh(new THREE.ShapeGeometry(tri), mats[1]); p.rotation.y = Math.PI / 2;
    p.position.set(x - W / 2 + W * (0.2 + i * 0.3), 0, z); p.castShadow = true; scene.add(p);
  }
  return m;
}

export function nuvola(scene, x, y, z, s, seme) {
  const cv = S.nuvola(seme), tex = texDa(cv);
  const g = new THREE.Group(); g.position.set(x, y, z);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s * 1.78, s), matCarta(tex)); m.castShadow = true; m.customDepthMaterial = profondita(tex); g.add(m);
  const filo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 20, 4), new THREE.MeshBasicMaterial({ color: 0x8a8070 }));
  filo.position.set(0, 10 + s * 0.3, -0.02); g.add(filo);
  scene.add(g);
  animati.push(t => { g.rotation.z = Math.sin(t * 0.6 + seme) * 0.03; g.position.x = x + Math.sin(t * 0.25 + seme) * 0.3; });
}

export function sole(scene, x, y, z, s) {
  const tex = texDa(S.sole());
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), matCarta(tex, { emissive: 0xffc860, emissiveIntensity: 0.25, emissiveMap: tex }));
  m.position.set(x, y, z); scene.add(m);
  animati.push(t => { m.rotation.z = t * 0.08; });
}
