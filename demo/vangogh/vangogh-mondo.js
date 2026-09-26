// Il villaggio di "Pennellate": colline, case con le finestre accese, la chiesa col campanile
// appuntito, ulivi, e il grande cipresso in primo piano. Più il campionamento delle superfici:
// ogni pennellata sul terreno è ancorata a un punto del mondo, così resta ferma quando si gira.
import * as THREE from 'three';
import { mergeGeometries as mg } from "three/addons/utils/BufferGeometryUtils.js";
const mergeGeometries = gs => mg(gs.map(g => g.index ? g.toNonIndexed() : g));

function hash2(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
const sm = t => t * t * (3 - 2 * t);
export function vn(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
export function rng(seme) { let s = seme >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// guardando verso +z, le x positive stanno a SINISTRA
export function altezza(x, z) {
  let y = 20 * smooth(85, -15, z) * (0.8 + 0.2 * Math.cos(x * 0.02));   // il poggio da cui si guarda
  y += 4 * (fbm(x * 0.012, z * 0.012, 3) - 0.5);
  // colline dietro al villaggio, ondulate
  const onda = 0.55 + 0.45 * Math.sin(x * 0.011 + 1.3) * Math.cos(x * 0.004);
  y += 55 * smooth(175, 330, z) * onda + 18 * smooth(200, 300, z) * fbm(x * 0.006, 3.1, 2);
  // catena lontana
  y += 70 * smooth(420, 520, z) * (0.6 + 0.4 * Math.sin(x * 0.006 + 0.5));
  return y;
}

// forme base
function casa(w, d, h, falda) {
  const corpo = new THREE.BoxGeometry(w, h, d); corpo.translate(0, h / 2, 0);
  const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.4, 0); s.lineTo(w / 2 + 0.4, 0); s.lineTo(0, falda); s.closePath();
  const tetto = new THREE.ExtrudeGeometry(s, { depth: d + 0.8, bevelEnabled: false }); tetto.translate(0, h, -d / 2 - 0.4);
  return { corpo, tetto };
}

export function costruisciMondo(scene, M) {
  const campioni = [];                 // mesh da cui nascono le pennellate a terra
  const add = (g, mat) => { const m = new THREE.Mesh(g, M(mat)); scene.add(m); campioni.push(m); return m; };

  // terreno: una griglia fitta davanti, rada lontano
  {
    const g = new THREE.PlaneGeometry(1400, 780, 220, 180); g.rotateX(-Math.PI / 2); g.translate(0, 0, 310);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, altezza(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    add(g, 'terra');
  }

  // villaggio
  const r = rng(12);
  const muri = [], tetti = [], tettiR = [], finestre = [];
  const piazza = (x, z, w, d, h, rot) => {
    const { corpo, tetto } = casa(w, d, h, h * 0.55 + 1);
    const y = altezza(x, z) - 0.3;
    for (const g of [corpo, tetto]) { g.rotateY(rot); g.translate(x, y, z); }
    muri.push(corpo); (r() < 0.55 ? tetti : tettiR).push(tetto);
    // finestre accese: piccoli rettangoli gialli sul lato verso chi guarda
    const nf = 1 + Math.floor(r() * 3);
    for (let k = 0; k < nf; k++) {
      if (r() < 0.25) continue;
      const fw = 1.3 + r() * 0.6, fh = 1.6 + r() * 0.6;
      const f = new THREE.PlaneGeometry(fw, fh);
      f.rotateY(Math.PI);
      f.translate((k - (nf - 1) / 2) * w / (nf + 0.5), h * (0.35 + r() * 0.3), -d / 2 - 0.05);
      f.rotateY(rot); f.translate(x, y, z);
      finestre.push(f);
    }
  };
  const posti = [];
  for (let i = 0; i < 46; i++) {
    const x = -70 + r() * 140, z = 95 + r() * 90;
    if (Math.hypot(x + 6, z - 128) < 14) continue;               // posto per la chiesa
    if (posti.some(p => Math.hypot(p[0] - x, p[1] - z) < 11)) continue;
    posti.push([x, z]);
    piazza(x, z, 6 + r() * 5, 5 + r() * 4, 4 + r() * 3.5, (r() - 0.5) * 0.5);
  }
  // la chiesa
  {
    const x = -6, z = 128, y = altezza(x, z) - 0.3;
    const nav = casa(10, 22, 9, 6);
    for (const g of [nav.corpo, nav.tetto]) { g.rotateY(0.1); g.translate(x, y, z); }
    muri.push(nav.corpo); tetti.push(nav.tetto);
    const torre = new THREE.BoxGeometry(5.5, 20, 5.5); torre.translate(x + 1, y + 10, z - 12); muri.push(torre);
    const guglia = new THREE.ConeGeometry(4.2, 28, 4); guglia.rotateY(Math.PI / 4); guglia.translate(x + 1, y + 34, z - 12); tetti.push(guglia);
    const f = new THREE.PlaneGeometry(1.4, 2.4); f.rotateY(Math.PI); f.translate(x + 1, y + 15, z - 14.8); finestre.push(f);
  }
  add(mergeGeometries(muri), 'muro');
  add(mergeGeometries(tetti), 'tetto');
  add(mergeGeometries(tettiR), 'tettoR');
  add(mergeGeometries(finestre), 'finestra');

  // ulivi e cespugli: nuvole tondeggianti
  const chiome = [];
  for (let i = 0; i < 70; i++) {
    const a = r();
    let x, z;
    if (a < 0.6) { x = -130 + r() * 260; z = 80 + r() * 130; } else { x = -160 + r() * 320; z = 0 + r() * 80; }
    if (Math.abs(x) < 75 && z < 95) continue;              // niente cespugli fra chi guarda e il villaggio
    if (posti.some(p => Math.hypot(p[0] - x, p[1] - z) < 7)) continue;
    const s = 2.2 + r() * 3.2;
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const g = new THREE.IcosahedronGeometry(s * (0.6 + r() * 0.4), 2);
      g.scale(1, 0.85, 1);
      g.translate(x + (r() - 0.5) * s, altezza(x, z) + s * 0.7 + r() * s * 0.5, z + (r() - 0.5) * s);
      chiome.push(g);
    }
  }
  add(mergeGeometries(chiome), 'ulivo');

  // il cipresso: una fiamma scura che si torce salendo
  {
    const H = 72, pos = [], idx = [], S = 40, V = 110;
    for (let j = 0; j <= V; j++) {
      const v = j / V, y = v * H;
      const prof = Math.pow(Math.sin(Math.min(1, v * 1.02) * Math.PI * 0.97 + 0.1), 0.7) * Math.pow(1 - v, 0.55) * 4.6 + 0.15;
      for (let i = 0; i <= S; i++) {
        const a = i / S * Math.PI * 2;
        const lobi = 1 + 0.38 * Math.pow(Math.abs(Math.sin(a * 3 + v * 19)), 3) * 1.6 - 0.2 + 0.2 * Math.sin(a * 5 - v * 31) + 0.2 * (vn(a * 2, v * 12) - 0.5);
        const rr = prof * lobi;
        pos.push(Math.cos(a) * rr + Math.sin(v * 6) * 1.6 * v, y, Math.sin(a) * rr);
      }
    }
    for (let j = 0; j < V; j++) for (let i = 0; i < S; i++) { const a = j * (S + 1) + i, b = a + S + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const cx = 17, cz = 6;
    g.translate(cx, altezza(cx, cz) - 1.5, cz);
    add(g, 'cipresso');
    // un secondo cipresso più piccolo, dietro
    const g2 = g.clone(); g2.translate(-cx, -altezza(cx, cz), -cz); g2.scale(0.55, 0.5, 0.55); g2.translate(27, altezza(27, 22) - 1, 22);
    add(g2, 'cipresso');
  }
  return { campioni };
}

// Campiona le superfici: il numero di punti per triangolo segue l'area che il triangolo occupa
// sullo schermo dalla camera iniziale, così la densità delle pennellate resta uniforme.
export function campionaSuperfici(meshes, cam0, strati, pxRad720, seme = 5) {
  const r = rng(seme);
  const out = strati.map(() => ({ pos: [], dati: [] }));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3(), v = new THREE.Vector3();
  meshes.forEach((mesh, mi) => {
    mesh.updateMatrixWorld();
    const g = mesh.geometry, P = g.attributes.position, I = g.index;
    const nt = I ? I.count / 3 : P.count / 3;
    for (let t = 0; t < nt; t++) {
      const ia = I ? I.getX(t * 3) : t * 3, ib = I ? I.getX(t * 3 + 1) : t * 3 + 1, ic = I ? I.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(P, ia).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(P, ib).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(P, ic).applyMatrix4(mesh.matrixWorld);
      n.subVectors(c, b).cross(v.subVectors(a, b));
      const area = n.length() / 2;
      if (area < 1e-6) continue;
      n.normalize();
      m.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      const d = m.distanceTo(cam0);
      const cos = Math.abs(n.dot(v.subVectors(cam0, m).normalize()));
      const aSchermo = area * Math.max(cos, 0.25) / (d * d) * pxRad720 * pxRad720;   // pixel a 720p
      strati.forEach((s, si) => {
        const atteso = aSchermo / (s.L * s.W * 0.78) * s.copertura;
        let k = Math.floor(atteso); if (r() < atteso - k) k++;
        for (let q = 0; q < k; q++) {
          let u = r(), w = r(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
          const x = a.x + (b.x - a.x) * u + (c.x - a.x) * w, y = a.y + (b.y - a.y) * u + (c.y - a.y) * w, z = a.z + (b.z - a.z) * u + (c.z - a.z) * w;
          const dd = Math.hypot(x - cam0.x, y - cam0.y, z - cam0.z);
          out[si].pos.push(x, y, z);
          out[si].dati.push(s.L * dd / pxRad720, r(), si, 0);
        }
      });
    }
  });
  return out;
}
