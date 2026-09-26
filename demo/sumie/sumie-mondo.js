// Il paesaggio di "Inchiostro sumi-e": valle con il torrente, ponticello, pino contorto
// sullo sperone, boschetto di bambù, alberi secchi da far fiorire, picchi carsici nella nebbia.
// Tutto procedurale.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ── Rumore e caso deterministici ──
function hash2(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function hash3(i, j, k) { let h = (i * 374761393 + j * 668265263 + k * 1440662683) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
const sm = t => t * t * (3 - 2 * t);
export function vn(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function vn3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const fx = sm(x - i), fy = sm(y - j), fz = sm(z - k);
  const l = (a, b, t) => a + (b - a) * t, c = (a, b, d) => hash3(i + a, j + b, k + d);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy), l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
}
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
export function rng(seme) { let s = seme >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ── Il torrente e la valle ──
// guardando verso +z, le x positive stanno a SINISTRA dello schermo
export const fiumeX = z => 14 * Math.sin(z * 0.017 + 0.6) + 7 * Math.sin(z * 0.043 + 1.3);
export function altezza(x, z) {
  const d = x - fiumeX(z);
  // valle larga e piatta, rive dolci che salgono verso i lati
  let y = Math.min(0.0045 * d * d, 14 + 8 * fbm(x * 0.012, z * 0.012, 3));
  y += 4 * (fbm(x * 0.025 + 4, z * 0.025, 3) - 0.5);
  // letto del torrente
  y -= 2.6 * (1 - smooth(3.5, 8, Math.abs(d)));
  // sperone di roccia a sinistra, sotto la camera: ci sta il pino
  const dr = Math.hypot(x - 30, z + 12);
  y += 30 * (1 - smooth(4, 30, dr)) + 5 * (1 - smooth(8, 26, dr)) * vn(x * 0.25, z * 0.25);
  // oltre la valle il terreno scende nella nebbia
  y -= 30 * smooth(230, 480, z);
  return y;
}

function sfaccetta(g) { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; }

// tubo con raggio variabile e superficie irregolare
export function tubo(curva, N, M, raggio, rumore = 0.15, seme = 1) {
  const fr = curva.computeFrenetFrames(N, false);
  const pos = [], idx = [];
  const o = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = curva.getPointAt(t), n = fr.normals[i], b = fr.binormals[i];
    const r = raggio(t);
    for (let j = 0; j <= M; j++) {
      const a = j / M * Math.PI * 2;
      o.set(0, 0, 0).addScaledVector(n, Math.cos(a)).addScaledVector(b, Math.sin(a));
      p.copy(c).addScaledVector(o, r);
      const q = 1 + rumore * (vn3(p.x * 1.3 + seme, p.y * 0.6, p.z * 1.3) * 2 - 1);
      p.copy(c).addScaledVector(o, r * q);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// picco carsico: un "pan di zucchero" alto e irregolare, che si allarga sotto la nebbia
function picco(R, H, seme) {
  const S = 56, V = 56;
  const pos = [], idx = [];
  const lean = (vn(seme, 1) - 0.5) * 0.5 * R, leanZ = (vn(seme, 7) - 0.5) * 0.3 * R;
  const esp = 1.5 + 2.2 * vn(seme, 3.3);           // cima più tonda o più aguzza
  const spalle = vn(seme, 5.1) * 0.35;              // gobbe lungo il fianco
  for (let j = 0; j <= V; j++) {
    const v = j / V, y = -H * 0.25 + v * H * 1.25;
    const h01 = Math.max(0, y / H);
    let r = R * Math.pow(Math.max(0, 1 - Math.pow(h01, esp)), 0.5) * (1 + 0.6 * Math.max(0, -y / H) * 4);
    r *= 1 + spalle * Math.sin(h01 * Math.PI * 3.2 + seme);
    for (let i = 0; i <= S; i++) {
      const a = i / S * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const n1 = vn(ca * 1.5 + seme, sa * 1.5 + h01 * 2.6), n2 = vn(ca * 4 + seme * 2, sa * 4 + h01 * 7), n3 = vn(ca * 11 + seme, sa * 11 + h01 * 20);
      const rr = r * (0.62 + 0.7 * n1 + 0.2 * n2 + 0.02 * n3);
      pos.push(ca * rr + lean * h01 * h01, y, sa * rr + leanZ * h01 * h01);
    }
  }
  for (let j = 0; j < V; j++) for (let i = 0; i < S; i++) { const a = j * (S + 1) + i, b = a + S + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ── Alberi ──
// ramificazione ricorsiva; restituisce la geometria e i punti dove possono sbocciare i fiori
function ramifica(rr, p, dir, len, rad, liv, geos, punte, contorto = 0.45) {
  const pts = [p.clone()];
  const q = p.clone(), d = dir.clone();
  for (let k = 1; k <= 4; k++) {
    d.x += (rr() - 0.5) * contorto; d.y += (rr() - 0.5) * contorto * 0.6; d.z += (rr() - 0.5) * contorto;
    d.normalize();
    q.addScaledVector(d, len / 4); pts.push(q.clone());
  }
  const c = new THREE.CatmullRomCurve3(pts);
  geos.push(tubo(c, 8, 6, t => rad * (1 - 0.45 * t), 0.18, rr() * 50));
  if (liv <= 1) for (let k = 0; k < 4; k++) punte.push({ p: c.getPointAt(0.4 + k * 0.2), liv });
  if (liv === 0) return;
  const figli = 2 + (rr() < 0.5 ? 1 : 0);
  for (let f = 0; f < figli; f++) {
    const t = 0.55 + rr() * 0.45;
    const s = c.getPointAt(t), tg = c.getTangentAt(t);
    const nd = tg.clone().add(new THREE.Vector3((rr() - 0.5) * 1.6, (rr() - 0.2) * 0.9, (rr() - 0.5) * 1.6)).normalize();
    ramifica(rr, s, nd, len * (0.62 + rr() * 0.15), rad * 0.58, liv - 1, geos, punte, contorto);
  }
}

function forma(punti) { const s = new THREE.Shape(); s.moveTo(...punti[0]); for (let i = 1; i < punti.length; i++) s.lineTo(...punti[i]); return s; }

export function costruisciMondo(scene, M) {
  const solidi = [];     // bersagli del raggio (per capire se il cerchio è nel cielo)
  const add = (m, ombra = true) => { m.castShadow = ombra; m.receiveShadow = true; scene.add(m); return m; };

  // terreno
  {
    const W = 700, N = 260, cz = 180;
    const g = new THREE.PlaneGeometry(W, W, N, N); g.rotateX(-Math.PI / 2); g.translate(0, 0, cz);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, altezza(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    solidi.push(add(new THREE.Mesh(g, M('terreno'))));
  }
  // acqua
  {
    const g = new THREE.PlaneGeometry(700, 700); g.rotateX(-Math.PI / 2); g.translate(0, -1.2, 180);
    add(new THREE.Mesh(g, M('acqua')), false);
  }
  // picchi
  const picchi = [
    [70, 430, 119, 27], [-45, 540, 170, 36], [165, 600, 146, 34], [-300, 700, 204, 46],
    [340, 820, 197, 44], [10, 950, 272, 60], [-560, 1050, 244, 64], [600, 1150, 272, 68], [130, 340, 71, 18],
    [-120, 370, 88, 21], [-240, 400, 64, 18], [-780, 880, 204, 57], [820, 880, 217, 61], [-150, 860, 217, 50]
  ];
  const rp = rng(31);
  picchi.forEach(([x, z, H, R], i) => {
    // ogni picco con uno o due fratelli minori accanto
    const n = 1 + Math.floor(rp() * 2.6);
    for (let k = 0; k < n; k++) {
      const hh = k ? H * (0.45 + rp() * 0.35) : H, rr = k ? R * (0.6 + rp() * 0.3) : R;
      const ox = k ? (rp() < 0.5 ? -1 : 1) * R * (0.8 + rp() * 0.7) : 0, oz = k ? (rp() - 0.3) * R * 1.5 : 0;
      const m = new THREE.Mesh(picco(rr, hh, i * 3.7 + k * 11.3 + 1), M('monte'));
      m.position.set(x + ox, -30, z + oz);
      solidi.push(add(m, z < 500));
    }
  });

  // sperone e massi
  const rrm = rng(5);
  for (let i = 0; i < 18; i++) {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const pa = g.attributes.position;
    for (let k = 0; k < pa.count; k++) { const s = 0.75 + 0.5 * vn3(pa.getX(k) * 1.5 + i, pa.getY(k) * 1.5, pa.getZ(k) * 1.5); pa.setXYZ(k, pa.getX(k) * s, pa.getY(k) * s, pa.getZ(k) * s); }
    g.computeVertexNormals();
    let x, z, s;
    if (i < 4) { x = 22 + rrm() * 14; z = -16 + rrm() * 14; s = 2 + rrm() * 3; }
    else { z = 10 + rrm() * 170; x = fiumeX(z) + (rrm() < 0.5 ? -1 : 1) * (5 + rrm() * 9); s = 0.8 + rrm() * 2.4; }
    const m = new THREE.Mesh(g, M('roccia'));
    m.position.set(x, altezza(x, z) - s * 0.3, z); m.scale.set(s * (1 + rrm() * 0.6), s * (0.6 + rrm() * 0.5), s);
    m.rotation.y = rrm() * 6;
    add(m);
  }

  // ── Pino contorto sullo sperone ──
  const pino = new THREE.Group();
  {
    const rr = rng(11);
    const base = new THREE.Vector3(27, altezza(27, -10) - 1, -10);
    const pts = [base, base.clone().add(new THREE.Vector3(-1, 5, 1)), base.clone().add(new THREE.Vector3(1.5, 9, 0.5)), base.clone().add(new THREE.Vector3(-3, 13, 2)), base.clone().add(new THREE.Vector3(-9, 16, 3)), base.clone().add(new THREE.Vector3(-15, 17, 5))];
    const c = new THREE.CatmullRomCurve3(pts);
    const geos = [tubo(c, 40, 10, t => 1.1 * (1 - 0.7 * t) + 0.5 * Math.pow(1 - t, 6), 0.22, 3)];
    const chiome = [];
    const rami = [[0.45, [1, 0.3, -0.4], 9], [0.62, [0.8, 0.2, 0.8], 7], [0.75, [-0.7, 0.1, -0.7], 8], [0.9, [-1, 0.15, 0.3], 7], [1.0, [-1, 0.2, 0.2], 4], [0.55, [-0.6, 0.35, 0.9], 6]];
    for (const [t, d, L] of rami) {
      const s = c.getPointAt(Math.min(t, 1));
      const dir = new THREE.Vector3(...d).normalize();
      const e = s.clone().addScaledVector(dir, L);
      const mid = s.clone().lerp(e, 0.5); mid.y += 1.2 * (rr() - 0.3);
      const bc = new THREE.CatmullRomCurve3([s, mid, e]);
      geos.push(tubo(bc, 10, 6, u => 0.38 * (1 - 0.6 * u), 0.2, t * 9));
      chiome.push(e, mid.clone().lerp(e, 0.3));
    }
    chiome.push(c.getPointAt(1).clone().add(new THREE.Vector3(-1, 0.6, 0)));
    const tronco = new THREE.Mesh(mergeGeometries(geos), M('tronco'));
    tronco.castShadow = tronco.receiveShadow = true;
    pino.add(tronco);
    // cuscinetti di aghi: nuvole schiacciate, scure
    const cg = [];
    for (const p of chiome) {
      const n = 6 + Math.floor(rr() * 4), rad = 2.2 + rr() * 1.4;
      for (let k = 0; k < n; k++) {
        const g = new THREE.IcosahedronGeometry(rad * (0.45 + rr() * 0.4), 2);
        g.scale(1, 0.34, 1);
        const a = rr() * Math.PI * 2, d = rr() * rad * 0.9;
        g.translate(p.x + Math.cos(a) * d, p.y + (rr() - 0.3) * 0.7, p.z + Math.sin(a) * d);
        cg.push(g);
      }
    }
    const chioma = new THREE.Mesh(mergeGeometries(cg), M('aghi'));
    chioma.castShadow = chioma.receiveShadow = true;
    pino.add(chioma);
    scene.add(pino);
    solidi.push(tronco, chioma);
  }

  // ── Bambù a destra ──
  const bambu = [];
  {
    const rr = rng(21);
    const foglia = new THREE.ShapeGeometry(forma([[0, 0], [0.07, 0.25], [0.06, 0.6], [0, 0.95], [-0.05, 0.6], [-0.06, 0.25]]));
    for (let i = 0; i < 11; i++) {
      const a = rr() * Math.PI * 2, d = 3 + Math.sqrt(rr()) * 10; const x = -25 + Math.cos(a) * d * 1.1, z = -4 + Math.sin(a) * d * 0.9;
      const h = 17 + rr() * 9, r = 0.3 + rr() * 0.1;
      const gr = new THREE.Group(); gr.position.set(x, altezza(x, z) - 0.3, z);
      gr.rotation.set((rr() - 0.5) * 0.18, rr() * 6, (rr() - 0.5) * 0.18);
      const gs = [], gn = [];
      const nodi = Math.floor(h / 1.7);
      for (let k = 0; k < nodi; k++) {
        const seg = new THREE.CylinderGeometry(r * 0.97, r, 1.62, 8, 1, true); seg.translate(0, k * 1.7 + 0.85, 0); gs.push(seg);
        const nodo = new THREE.TorusGeometry(r * 1.02, r * 0.2, 4, 10); nodo.rotateX(Math.PI / 2); nodo.translate(0, k * 1.7 + 1.68, 0); gn.push(nodo);
      }
      const fusto = new THREE.Mesh(mergeGeometries(gs), M('bambu'));
      fusto.castShadow = true; fusto.receiveShadow = true; gr.add(fusto);
      gr.add(new THREE.Mesh(mergeGeometries(gn), M('nodo')));
      const fg = [];
      const ciuffi = 3 + Math.floor(rr() * 2);
      for (let c = 0; c < ciuffi; c++) {
        const y = h * (0.6 + rr() * 0.42);
        const a0 = rr() * Math.PI * 2;
        const nf = 3 + Math.floor(rr() * 3);
        for (let f = 0; f < nf; f++) {
          const g = foglia.clone();
          const L = 2.4 + rr() * 1.2;
          g.scale(L * 1.3, L, L);
          g.rotateX(-Math.PI / 2 + 0.5 + rr() * 0.7);        // pendono verso il basso
          g.rotateY(a0 + (f - nf / 2) * 0.45 + (rr() - 0.5) * 0.3);
          const ax = Math.cos(a0) * 0.6, az = -Math.sin(a0) * 0.6;
          g.translate(ax, y, az);
          fg.push(g);
        }
      }
      const foglie = new THREE.Mesh(mergeGeometries(fg), M('foglia'));
      foglie.castShadow = false; gr.add(foglie);
      scene.add(gr);
      bambu.push({ g: gr, fase: rr() * 6, amp: 0.012 + rr() * 0.02, rx: gr.rotation.x, rz: gr.rotation.z });
    }
  }

  // ── Ponticello ad arco, con la ringhiera vermiglia ──
  {
    const zc = 44, xc = fiumeX(zc);
    const pz = new THREE.Group();
    const L = 30, arcoH = 5;
    const curva = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => { const u = i / 8 - 0.5; return new THREE.Vector3(u * L, arcoH * (1 - 4 * u * u) + 0.5, 0); }));
    const gs = [];
    for (let i = 0; i < 24; i++) {
      const t = (i + 0.5) / 24, p = curva.getPointAt(t), tg = curva.getTangentAt(t);
      const b = new THREE.BoxGeometry(L / 24 * 1.02, 0.4, 3.6);
      b.rotateZ(Math.atan2(tg.y, tg.x)); b.translate(p.x, p.y, p.z); gs.push(b);
    }
    const piano = new THREE.Mesh(mergeGeometries(gs), M('legno'));
    piano.castShadow = piano.receiveShadow = true; pz.add(piano);
    const rs = [];
    for (const lato of [-1.7, 1.7]) {
      for (let i = 0; i <= 8; i++) {
        const p = curva.getPointAt(i / 8);
        const b = new THREE.CylinderGeometry(0.17, 0.17, 1.8, 6); b.translate(p.x, p.y + 1.0, lato); rs.push(b);
        if (i === 0 || i === 8) { const k = new THREE.SphereGeometry(0.2, 8, 6); k.translate(p.x, p.y + 2.0, lato); rs.push(k); }
      }
      for (const hh of [1.85, 1.0]) { const rc = new THREE.CatmullRomCurve3(curva.points.map(p => new THREE.Vector3(p.x, p.y + hh, lato))); rs.push(new THREE.TubeGeometry(rc, 30, hh > 1.5 ? 0.16 : 0.1, 6)); }
    }
    // pile nel torrente
    for (const u of [-0.32, 0.32]) { const b = new THREE.CylinderGeometry(0.3, 0.35, 5, 8); const p = curva.getPointAt(u + 0.5); b.translate(p.x, p.y - 2.6, 0); rs.push(b); }
    const ringh = new THREE.Mesh(mergeGeometries(rs), M('vermiglio'));
    ringh.castShadow = true; pz.add(ringh);
    pz.position.set(xc, -0.8, zc);
    pz.rotation.y = Math.PI / 2 + Math.atan(14 * 0.017 * Math.cos(zc * 0.017 + 0.6) + 7 * 0.043 * Math.cos(zc * 0.043 + 1.3));
    scene.add(pz);
    solidi.push(piano);
  }

  // ── Alberi secchi (pruni) da far fiorire ──
  const alberi = [];
  const fioreGeo = (() => {
    const s = new THREE.Shape();
    for (let i = 0; i <= 60; i++) {
      const a = i / 60 * Math.PI * 2, r = 0.55 + 0.45 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.7);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    return new THREE.ShapeGeometry(s);
  })();
  const siti = [[fiumeX(36) + 20, 32, 2.2, 7], [fiumeX(80) - 20, 80, 2.5, 13], [-44, 46, 2.0, 29]];
  siti.forEach(([x, z, sc, seme], idx) => {
    const rr = rng(seme * 17);
    const geos = [], punte = [];
    const base = new THREE.Vector3(x, altezza(x, z) - 0.5, z);
    ramifica(rr, base, new THREE.Vector3((rr() - 0.5) * 0.4, 1, (rr() - 0.5) * 0.4).normalize(), 5.5 * sc, 0.5 * sc, 3, geos, punte, 0.6);
    const tronco = new THREE.Mesh(mergeGeometries(geos), M('secco'));
    tronco.castShadow = tronco.receiveShadow = true;
    scene.add(tronco);
    solidi.push(tronco);
    // fiori istanziati, a grandezza zero finché l'albero non fiorisce
    const n = Math.min(punte.length * 4, 1400);
    const fiori = new THREE.InstancedMesh(fioreGeo, M('fiore'), n);
    fiori.frustumCulled = false;
    const dati = [];
    const box = new THREE.Box3().setFromObject(tronco);
    const centro = box.getCenter(new THREE.Vector3());
    const raggio = box.getSize(new THREE.Vector3()).length() * 0.42;
    for (let i = 0; i < n; i++) {
      const pt = punte[i % punte.length].p;
      const p = pt.clone().add(new THREE.Vector3((rr() - 0.5) * 0.9 * sc, (rr() - 0.5) * 0.7 * sc, (rr() - 0.5) * 0.9 * sc));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rr() * 6, rr() * 6, rr() * 6));
      dati.push({ p, q, s: (0.22 + rr() * 0.18) * sc, ritardo: p.distanceTo(base) / (raggio * 2.2) + rr() * 0.15 });
      fiori.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    }
    scene.add(fiori);
    alberi.push({ tronco, fiori, dati, centro, raggio, fiore: 0, fiorito: false, punte, base });
  });

  return { solidi, bambu, alberi, pino };
}
