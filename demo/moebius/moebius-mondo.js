// Il deserto di "Ligne claire": terreno a dune, rocce ad arco, mesa a strati,
// rovine, uno scheletro gigante, la torre lontana, il pianeta e le nuvole.
// Tutto procedurale: nessun modello esterno.
import * as THREE from 'three';

// ── Rumore deterministico (valore, 2D e 3D) ──
function hash2(i, j) {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function hash3(i, j, k) {
  let h = (i * 374761393 + j * 668265263 + k * 1440662683) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const sm = t => t * t * (3 - 2 * t);
export function vn(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function vn3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const fx = sm(x - i), fy = sm(y - j), fz = sm(z - k);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (di, dj, dk) => hash3(i + di, j + dj, k + dk);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
           l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
}
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
export function rng(seme) { let s = seme >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ── Il terreno: dune trasversali con la cresta tagliente (la china la ripassa) ──
const VENTO = 0.55, CV = Math.cos(VENTO), SV = Math.sin(VENTO);
const piazzole = [];   // zone spianate sotto le rovine
export function altezza(x, z) {
  const r = Math.hypot(x, z);
  let y = 10 * fbm(x * 0.0022 + 3.1, z * 0.0022 - 1.7, 3) - 5;
  const u = x * CV + z * SV, v = -x * SV + z * CV;
  const w = 30 * (vn(x * 0.005, z * 0.005) - 0.5) + 9 * (vn(x * 0.021 + 5, z * 0.021) - 0.5);
  const ph = (u + w) / 44;
  const f = ph - Math.floor(ph);
  const tri = f < 0.74 ? f / 0.74 : (1 - f) / 0.26;
  const campo = 0.45 + 0.55 * smooth(0.25, 0.6, vn(v * 0.006 + 7.3, u * 0.003 + 1.1));
  const amp = 6.5 * campo * (1 - smooth(900, 1500, r));
  y += amp * Math.pow(tri, 1.35);
  // ondulazioni lontane più ampie, per un orizzonte mosso
  y += 26 * smooth(1200, 3500, r) * (fbm(x * 0.0009, z * 0.0009, 2) - 0.35);
  for (const p of piazzole) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r + p.m) y += (p.y - y) * (1 - smooth(p.r, p.r + p.m, d));
  }
  return y;
}
function spiana(x, z, r, m) { const y = altezza(x, z); piazzole.push({ x, z, r, m, y }); return y; }

// griglia non uniforme: fitta al centro (~2,3 m), rada ai bordi (fino a 4 km)
function terreno(M) {
  const N = 640, S = 4200;
  const f = s => Math.sign(s) * (0.17 * Math.abs(s) + 0.83 * Math.pow(Math.abs(s), 7)) * S;
  const pos = new Float32Array((N + 1) * (N + 1) * 3);
  let k = 0;
  const xs = [];
  for (let i = 0; i <= N; i++) xs.push(f(i / N * 2 - 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = xs[i], z = xs[j];
    pos[k++] = x; pos[k++] = altezza(x, z); pos[k++] = z;
  }
  const idx = new Uint32Array(N * N * 6); k = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, M('sabbia'));
  m.receiveShadow = true;
  return m;
}

// ── Utilità geometriche ──
function sfaccetta(g) { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; }
function tubo(curva, N, M, raggio, rumore = 0.22, seme = 1, schiaccia = 1) {
  // tubo con sezione variabile e superficie rocciosa (spostata dal rumore 3D)
  const fr = curva.computeFrenetFrames(N, false);
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = curva.getPointAt(t), n = fr.normals[i], b = fr.binormals[i];
    const r = raggio(t);
    for (let j = 0; j <= M; j++) {
      const a = j / M * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      const o = new THREE.Vector3().addScaledVector(n, dx).addScaledVector(b, dy * schiaccia);
      const p = c.clone().addScaledVector(o, r);
      const q = 1 + rumore * (vn3(p.x * 0.09 + seme, p.y * 0.09, p.z * 0.09) * 2 - 1) + rumore * 0.5 * (vn3(p.x * 0.3, p.y * 0.3 + seme, p.z * 0.3) - 0.5);
      p.copy(c).addScaledVector(o, r * q);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + M + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return sfaccetta(g);
}

// mesa a strati: ogni strato un gradino, così i bordi dei gradini vengono ripassati a china
function mesa(R, H, strati, seme, lati = 40) {
  const pos = [], R0 = [];
  const rr = rng(seme);
  let rCur = R;
  const hs = [];
  let yy = -H * 0.25;
  for (let s = 0; s <= strati; s++) { hs.push(yy); yy += (H * 1.25) / strati * (0.7 + 0.6 * rr()); }
  const prof = [];
  for (let s = 0; s < strati; s++) {
    const shrink = s === strati - 1 ? 0.92 : 0.97 - 0.06 * rr();
    const anello = [];
    for (let j = 0; j < lati; j++) {
      const a = j / lati * Math.PI * 2;
      const nz = 0.75 + 0.5 * vn(Math.cos(a) * 1.6 + seme, Math.sin(a) * 1.6 + s * 0.35);
      anello.push(rCur * nz);
    }
    prof.push(anello);
    rCur *= shrink;
  }
  const P = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
  const quad = (p1, p2, p3, p4) => pos.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
  for (let s = 0; s < strati; s++) {
    const y0 = hs[s], y1 = hs[s + 1];
    for (let j = 0; j < lati; j++) {
      const a0 = j / lati * Math.PI * 2, a1 = (j + 1) / lati * Math.PI * 2;
      const r0 = prof[s][j], r1 = prof[s][(j + 1) % lati];
      const k = 0.96; // pareti appena rastremate
      quad(P(a0, r0, y0), P(a0, r0 * k, y1), P(a1, r1 * k, y1), P(a1, r1, y0));
      // ripiano fra questo strato e il successivo
      const n0 = s + 1 < strati ? prof[s + 1][j] : 0, n1 = s + 1 < strati ? prof[s + 1][(j + 1) % lati] : 0;
      quad(P(a0, r0 * k, y1), P(a0, n0, y1), P(a1, n1, y1), P(a1, r1 * k, y1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function colonna(M, h, r, rotta, seme) {
  const g = new THREE.Group();
  const rr = rng(seme);
  const fusto = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, h, 18, 1), M('pietra'));
  fusto.position.y = h / 2; g.add(fusto);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.45, r * 0.7, 18), M('pietra'));
  base.position.y = r * 0.35; g.add(base);
  if (!rotta) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.0, r * 0.8, 18), M('pietra'));
    cap.position.y = h + r * 0.4; g.add(cap);
    const ab = new THREE.Mesh(new THREE.BoxGeometry(r * 3.4, r * 0.6, r * 3.4), M('pietra'));
    ab.position.y = h + r * 1.1; g.add(ab);
  } else {
    // spezzata: un cono irregolare in cima
    const rot = new THREE.Mesh(sfaccetta(new THREE.CylinderGeometry(r * 0.2, r * 0.92, r * 1.6, 7, 1)), M('pietra'));
    rot.position.y = h + r * 0.7; rot.rotation.set((rr() - 0.5) * 0.5, rr() * 3, (rr() - 0.5) * 0.5); g.add(rot);
  }
  // anelli incisi sul fusto (fanno righe di china)
  for (let i = 1; i < 4; i++) {
    const an = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, r * 0.06, 4, 18), M('pietra'));
    an.rotation.x = Math.PI / 2; an.position.y = h * i / 4; g.add(an);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function nuvola(M, seme, larg) {
  const rr = rng(seme), g = new THREE.Group();
  const n = 7 + Math.floor(rr() * 6);
  for (let i = 0; i < n; i++) {
    const s = larg * (0.12 + 0.16 * rr()) * (1 - Math.abs(i / n - 0.5));
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), M('nuvola'));
    b.scale.set(s * 1.5, s, s * 1.1);
    b.position.set((i / n - 0.5) * larg, s * 0.35 + rr() * s * 0.3, (rr() - 0.5) * larg * 0.2);
    g.add(b);
  }
  // fondo piatto: una lastra appena sotto
  const f = new THREE.Mesh(new THREE.CylinderGeometry(larg * 0.52, larg * 0.5, larg * 0.05, 24), M('nuvola'));
  f.scale.z = 0.3; f.position.y = larg * 0.02; g.add(f);
  return g;
}

// posizioni dei monumenti (guardando verso +z, le x positive stanno a sinistra)
const RX = -85, RZ = 135, AX = 190, AZ = 420, SX = -58, SZ = 40;

export function costruisciMondo(scene, M) {
  const solidi = [];   // cerchi di collisione {x, z, r}
  const aggiungi = (o, ombra = true) => { o.traverse(c => { if (c.isMesh) { c.castShadow = ombra; c.receiveShadow = true; } }); scene.add(o); return o; };

  // piazzole spianate prima di costruire il terreno
  const yRov = spiana(RX, RZ, 42, 30);
  const yAn = spiana(AX, AZ, 30, 40);
  const ySch = spiana(SX, SZ, 26, 22);

  scene.add(terreno(M));

  // ── Archi di roccia ──
  const arco = (x, z, W, H, sp, rotY, seme) => {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (i / 12);
      pts.push(new THREE.Vector3(-Math.cos(a) * W / 2, Math.sin(a) * H - 6 + (i === 0 || i === 12 ? -8 : 0), 0));
    }
    const c = new THREE.CatmullRomCurve3(pts);
    const g = tubo(c, 70, 12, t => sp * (0.85 + 1.5 * Math.pow(Math.abs(2 * t - 1), 4)), 0.3, seme, 0.6);
    const m = new THREE.Mesh(g, M('roccia'));
    m.position.set(x, altezza(x, z), z); m.rotation.y = rotY;
    aggiungi(m);
    const d = new THREE.Vector3(W / 2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    solidi.push({ x: x + d.x, z: z + d.z, r: sp * 2.2 }, { x: x - d.x, z: z - d.z, r: sp * 2.2 });
  };
  arco(55, 165, 84, 56, 7.5, -0.25, 3);
  arco(-230, 330, 46, 30, 5, 0.9, 9);
  arco(420, 640, 130, 95, 11, -0.2, 17);

  // guglie e massi isolati
  const rrm = rng(42);
  for (let i = 0; i < 16; i++) {
    const a = rrm() * Math.PI * 2, d = 140 + rrm() * 600;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - RX, z - RZ) < 70 || Math.hypot(x - AX, z - AZ) < 60 || Math.hypot(x - SX, z - SZ) < 40 || Math.hypot(x - 55, z - 165) < 60 || Math.hypot(x, z) < 60) continue;
    const h = 14 + rrm() * 40, r = 4 + rrm() * 6;
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -6, 0), new THREE.Vector3((rrm() - .5) * 4, h * 0.5, (rrm() - .5) * 4), new THREE.Vector3((rrm() - .5) * 6, h, (rrm() - .5) * 6)]);
    const g = tubo(c, 16, 9, t => r * (1.2 - 0.55 * t + 0.25 * Math.sin(t * 9 + i)), 0.35, i * 7, 1);
    const m = new THREE.Mesh(g, M(i % 3 === 0 ? 'rocciaT' : 'roccia'));
    m.position.set(x, altezza(x, z), z);
    aggiungi(m);
    solidi.push({ x, z, r: r * 1.3 });
  }

  // sassi sparsi: danno la scala al deserto
  {
    const rs = rng(99), N = 380;
    const g = sfaccetta(new THREE.IcosahedronGeometry(1, 0));
    const im = new THREE.InstancedMesh(g, M('roccia'), N);
    const im2 = new THREE.InstancedMesh(g, M('rocciaT'), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let a = 0, b = 0;
    for (let i = 0; i < N * 2; i++) {
      const r = 15 + Math.pow(rs(), 1.3) * 700, t = rs() * Math.PI * 2;
      const x = Math.cos(t) * r, z = Math.sin(t) * r;
      if (Math.hypot(x + 20, z + 5) < 45) continue;
      const s = 0.2 + Math.pow(rs(), 4) * 3.0;
      q.setFromEuler(e.set(rs() * 3, rs() * 3, rs() * 3));
      m4.compose(new THREE.Vector3(x, altezza(x, z) + s * 0.1, z), q, new THREE.Vector3(s * (1 + rs()), s * 0.7, s));
      if (i % 3) { if (a < N) im.setMatrixAt(a++, m4); } else if (b < N) im2.setMatrixAt(b++, m4);
    }
    im.count = a; im2.count = b;
    im.castShadow = im2.castShadow = true; im.receiveShadow = im2.receiveShadow = true;
    scene.add(im, im2);
  }

  // ── Mesa lontane, a strati ──
  const mesaDati = [
    [900, 1500, 170, 290, 7, 'roccia'], [-1000, 1800, 230, 340, 8, 'rocciaT'], [1500, 400, 200, 230, 6, 'rocciaT'],
    [-1500, 500, 260, 300, 7, 'roccia'], [-250, 2900, 380, 330, 9, 'rocciaT'], [-600, -1800, 300, 260, 6, 'roccia'],
    [1300, -1300, 220, 280, 7, 'rocciaT'], [-2300, 1500, 420, 380, 8, 'rocciaT'], [2300, 1900, 380, 330, 7, 'roccia'],
    [480, 1250, 90, 170, 5, 'roccia'], [-420, 1350, 70, 150, 5, 'rocciaT'],
  ];
  mesaDati.forEach(([x, z, R, H, s, mat], i) => {
    const m = new THREE.Mesh(mesa(R, H, s, 11 + i * 5), M(mat));
    m.position.set(x, altezza(x, z) - 5, z);
    aggiungi(m, Math.hypot(x, z) < 900);
  });

  // ── Rovine: colonnato ──
  const rov = new THREE.Group(); rov.position.set(RX, yRov - 0.6, RZ); rov.rotation.y = 0.45;
  const colonne = [[-24, 0, 26, 0], [-12, 0, 27, 0], [0, 0, 26, 0], [12, 0, 16, 1], [24, 0, 27, 0], [-24, 18, 9, 1], [24, 18, 22, 0], [0, 18, 6, 1]];
  colonne.forEach(([x, z, h, rotta], i) => { const c = colonna(M, h, 2.1, rotta, i + 3); c.position.set(x, 0, z); rov.add(c); });
  // architrave sopra le prime tre
  const arch = new THREE.Mesh(new THREE.BoxGeometry(30, 3, 5), M('pietra'));
  arch.position.set(-12, 29.3, 0); rov.add(arch);
  const arch2 = new THREE.Mesh(new THREE.BoxGeometry(14, 2.6, 4.6), M('pietra'));
  arch2.position.set(4, 28.8, 0); arch2.rotation.z = -0.05; rov.add(arch2);
  // rocchi caduti
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 5 + i % 3 * 2, 18), M('pietra'));
    r.rotation.z = Math.PI / 2; r.rotation.y = i * 1.3; r.position.set(-30 + i * 13, 1.2, 32 + (i % 2) * 6);
    rov.add(r);
  }
  // basamento a gradini
  for (let s = 0; s < 3; s++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(62 - s * 5, 1.1, 30 - s * 4), M('pietra'));
    b.position.set(0, -0.2 + s * 1.0, 9); rov.add(b);
  }
  aggiungi(rov);
  colonne.forEach(([x, z]) => { const p = new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.45); solidi.push({ x: RX + p.x, z: RZ + p.z, r: 3.4 }); });

  // ── Grande anello di pietra, mezzo sepolto ──
  const anello = new THREE.Group(); anello.position.set(AX, yAn - 9, AZ); anello.rotation.y = -0.5;
  const tor = new THREE.Mesh(new THREE.TorusGeometry(30, 4.2, 6, 64), M('pietra'));
  anello.add(tor);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(4, 11.5, 11.5), M('pietraS'));
    b.position.set(Math.cos(a) * 30, Math.sin(a) * 30, 0); b.rotation.z = a;
    anello.add(b);
  }
  aggiungi(anello);
  { const d = new THREE.Vector3(30, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.5); solidi.push({ x: AX + d.x, z: AZ + d.z, r: 8 }, { x: AX - d.x, z: AZ - d.z, r: 8 }); }

  // ── Scheletro gigante: spina dorsale e costole ──
  const sch = new THREE.Group(); sch.position.set(SX, ySch - 2.5, SZ); sch.rotation.y = 1.25;
  const spinaC = new THREE.CatmullRomCurve3([new THREE.Vector3(-34, 1, 0), new THREE.Vector3(-18, 5, 1), new THREE.Vector3(0, 7, 0), new THREE.Vector3(18, 5, -1), new THREE.Vector3(32, 1.5, 0), new THREE.Vector3(44, -1, 2)]);
  for (let i = 0; i < 26; i++) {
    const t = i / 25, p = spinaC.getPointAt(t);
    const v = new THREE.Mesh(sfaccetta(new THREE.IcosahedronGeometry(1.5 * (1 - 0.4 * t), 0)), M('osso'));
    v.position.copy(p); v.scale.set(0.9, 1.3, 1.2); sch.add(v);
  }
  // costole: si alzano dalla spina sdraiata e si piegano a gabbia verso l'interno
  for (let i = 0; i < 11; i++) {
    const tS = 0.16 + i * 0.055, base = spinaC.getPointAt(tS);
    const s = 1 - Math.abs(i - 3.5) / 11;
    const H = 15 * s, lat = 8 * s;
    for (const lato of [-1, 1]) {
      if (lato === 1 && i % 4 === 3) continue;   // qualche costola manca
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10, a = u * Math.PI * 0.8;
        pts.push(new THREE.Vector3(base.x, base.y + Math.sin(u * Math.PI * 0.5) * H, lato * Math.sin(u * Math.PI * 0.86) * lat));
      }
      const c = new THREE.CatmullRomCurve3(pts);
      const g = tubo(c, 26, 8, t => 0.8 * (1 - 0.6 * t), 0.05, i, 1);
      sch.add(new THREE.Mesh(g, M('osso')));
    }
  }
  // cranio: una forma allungata con le orbite
  const cr = new THREE.Mesh(sfaccetta(new THREE.IcosahedronGeometry(1, 1)), M('osso'));
  cr.scale.set(8, 4.2, 4.6); cr.position.set(-40, 1.5, 0); cr.rotation.z = 0.25; sch.add(cr);
  const muso = new THREE.Mesh(sfaccetta(new THREE.CylinderGeometry(1.6, 3.2, 9, 6)), M('osso'));
  muso.rotation.z = Math.PI / 2 + 0.3; muso.position.set(-49, -0.8, 0); sch.add(muso);
  for (const l of [-1, 1]) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), M('buio'));
    orb.position.set(-43, 3, l * 3.2); sch.add(orb);
  }
  aggiungi(sch);
  solidi.push({ x: SX, z: SZ, r: 12 });

  // ── Piramide a gradoni, lontana ──
  const pir = new THREE.Group(); const px = -620, pz = 1150;
  for (let s = 0; s < 7; s++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(150 - s * 19, 16, 150 - s * 19), M('pietra'));
    b.position.y = s * 16; pir.add(b);
  }
  const tempio = new THREE.Mesh(new THREE.BoxGeometry(20, 22, 20), M('pietraS')); tempio.position.y = 7 * 16 + 3; pir.add(tempio);
  pir.position.set(px, altezza(px, pz) - 6, pz); pir.rotation.y = 0.3;
  aggiungi(pir, false);

  // ── La torre strana, lontanissima ──
  const tz = 2600, tx = 260;
  const prof = [];
  const pp = [[0, 0], [70, 0], [52, 25], [30, 60], [16, 120], [12, 300], [10, 480], [26, 520], [48, 560], [52, 600], [40, 640], [18, 660], [9, 700], [8, 780], [22, 800], [20, 816], [4, 830], [2, 900], [0, 960]];
  pp.forEach(([r, y]) => prof.push(new THREE.Vector2(r, y)));
  const torre = new THREE.Group();
  torre.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 32), M('torre')));
  for (const [y, r, inc] of [[380, 60, 0.25], [590, 95, -0.15], [740, 50, 0.4]]) {
    const an = new THREE.Mesh(new THREE.TorusGeometry(r, 3.5, 6, 64), M('torre'));
    an.position.y = y; an.rotation.x = Math.PI / 2 + inc; torre.add(an);
  }
  // bolle appese
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(12 + i * 3, 24, 16), M('torre'));
    const a = i * 1.3;
    b.position.set(Math.cos(a) * 58, 520 + i * 22, Math.sin(a) * 58); torre.add(b);
  }
  torre.position.set(tx, altezza(tx, tz) - 10, tz);
  aggiungi(torre, false);

  // ── Il cielo: pianeta con anelli, luna piccola, nuvole ──
  const cielo = new THREE.Group();
  const pDir = new THREE.Vector3(-0.42, 0.25, 0.87).normalize();
  const pianeta = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 48), M('pianeta'));
  pianeta.position.copy(pDir).multiplyScalar(9000);
  const anelloP = new THREE.Mesh(new THREE.RingGeometry(1150, 1650, 128, 1), M('anello'));
  anelloP.rotation.set(-1.25, 0.25, 0.3);
  const anelloP2 = new THREE.Mesh(new THREE.RingGeometry(1700, 1780, 128, 1), M('anello'));
  anelloP2.rotation.copy(anelloP.rotation);
  pianeta.add(anelloP, anelloP2);
  const luna = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 24), M('pianeta'));
  luna.position.copy(new THREE.Vector3(0.1, 0.5, 0.86).normalize().multiplyScalar(8500));
  cielo.add(pianeta, luna);
  const rn = rng(77);
  for (let i = 0; i < 9; i++) {
    const a = -1.3 + i * 0.33 + rn() * 0.2, d = 3000 + rn() * 2500;
    const n = nuvola(M, 100 + i, 500 + rn() * 700);
    n.position.set(Math.sin(a) * d, 500 + rn() * 900, Math.cos(a) * d);
    n.lookAt(0, n.position.y, 0);
    cielo.add(n);
  }
  scene.add(cielo);

  return { solidi };
}
