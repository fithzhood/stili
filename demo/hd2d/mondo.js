// Il borgo: texture a pixel (Kenney, filtro nearest), case a graticcio costruite a pannelli,
// selciato, canale. Le UV sono in metri: ogni texture copre sempre la stessa misura,
// così i pixel hanno una densità costante su tutto il diorama.
import * as THREE from 'three';

export const P = 1.1;             // larghezza di un pannello di graticcio (64 px)
let loader;
const cacheTex = {}, cacheMat = {};
export function initTex(manager) { loader = new THREE.TextureLoader(manager); }

export function tex(nome) {
  if (cacheTex[nome]) return cacheTex[nome];
  const t = loader.load(`assets/tex/${nome}.png?v=6`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;            // il pixel resta pixel
  t.minFilter = THREE.LinearMipmapLinearFilter; // ma da lontano non sfarfalla
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return (cacheTex[nome] = t);
}

/** Materiale da texture: opz.lit = finestra accesa (emissiva), opz.rough, opz.colore. */
export function mat(nome, opz = {}) {
  const k = nome + JSON.stringify(opz);
  if (cacheMat[k]) return cacheMat[k];
  const t = tex(nome);
  const m = new THREE.MeshStandardMaterial({
    map: t, roughness: opz.rough ?? 0.92, metalness: 0, side: opz.doppio ? THREE.DoubleSide : THREE.FrontSide,
    color: opz.colore ?? 0xffffff, transparent: false, alphaTest: opz.alpha ? 0.5 : 0,
  });
  if (opz.lit) { m.emissiveMap = t; m.emissive = new THREE.Color(opz.lit); }
  return (cacheMat[k] = m);
}

/** Rettangolo con UV in metri: la texture misura tw × th metri. */
export function quad(w, h, m, tw = 1, th = 1, u0 = 0, v0 = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (u0 + uv.getX(i) * w) / tw, (v0 + uv.getY(i) * h) / th);
  const me = new THREE.Mesh(g, m); me.castShadow = true; me.receiveShadow = true;
  return me;
}

const legnoScuro = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 });
export function trave(w, h, d, m = legnoScuro) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.castShadow = true; me.receiveShadow = true; return me;
}

const TIMBER = ['wall_timber_structure', 'wall_timber_structure_cross', 'wall_timber_structure_diagonal', 'wall_timber_structure_horizontal'];
const TETTI = { rosso: 'roof_clay_red_center', grigio: 'roof_clay_grey_center', paglia: 'roof_thatch_center' };

/**
 * Una casa a graticcio: piano terra in pietra, piani sporgenti a pannelli, tetto a capanna.
 * Locale: facciata verso +z. Restituisce { gruppo, lanterne: [Vector3 locali→mondo], impronta }.
 */
export function casa(o, rng) {
  const g = new THREE.Group();
  const W = o.nw * P, D = o.nd * P, h0 = 2.3, h1 = 2.2, j = 0.28;
  const pietra = mat('wall_brick_stone_center');
  const finAcc = mat('window_square_divided_lit', { lit: 0xffb45a });
  const finSpenta = mat('window_square_divided');
  const porta = mat('door_wood_window_lit', { lit: 0xff9a40 });
  const lati = (w, d, y, fn) => [[0, d / 2, 0, w], [Math.PI, -d / 2, 0, w], [-Math.PI / 2, 0, -w / 2, d], [Math.PI / 2, 0, w / 2, d]]
    .forEach(([r, z, x, L], i) => { const s = new THREE.Group(); s.rotation.y = r; s.position.set(x, y, z); g.add(s); fn(s, L, i); });
  // piano terra
  const portaI = o.porta ?? Math.floor(o.nw / 2);
  lati(W, D, 0, (s, L, i) => {
    const q = quad(L, h0, pietra, P, P); q.position.y = h0 / 2; s.add(q);
    const n = Math.round(L / P);
    for (let k = 0; k < n; k++) {
      const x = -L / 2 + P * (k + 0.5);
      if (i === 0 && k === portaI) {
        const p = quad(0.95, 1.9, porta, 0.95, 1.9); p.position.set(x, 0.95, 0.03); p.castShadow = false; s.add(p);
        const arch = trave(1.15, 0.14, 0.16); arch.position.set(x, 1.95, 0.06); s.add(arch);
      } else if ((k + i) % 2 === 1 && i !== 1) {
        const acc = rng() < 0.7;
        const f = quad(0.78, 0.78, acc ? finAcc : finSpenta, 0.78, 0.78); f.position.set(x, 1.35, 0.03); f.castShadow = false; s.add(f);
      }
    }
  });
  const fascia = trave(W + 2 * j + 0.1, 0.2, D + 2 * j + 0.1); fascia.position.y = h0 + 0.02; g.add(fascia);
  // piani a graticcio, sporgenti
  let y = h0;
  const Wj = W + 2 * j, Dj = D + 2 * j;
  for (let p = 0; p < o.piani; p++) {
    lati(Wj, Dj, y, (s, L, i) => {
      const n = Math.round(L / P), pw = L / n;
      for (let k = 0; k < n; k++) {
        const x = -L / 2 + pw * (k + 0.5);
        const q = quad(pw, h1, mat(TIMBER[Math.floor(rng() * TIMBER.length)]), pw, h1); q.position.set(x, h1 / 2, 0); s.add(q);
        if ((k + p + i) % 2 === 0 && i !== 1) {
          const acc = rng() < 0.65;
          const f = quad(0.72, 0.72, acc ? finAcc : finSpenta, 0.72, 0.72); f.position.set(x, h1 * 0.52, 0.03); f.castShadow = false; s.add(f);
          if (o.fioriera && rng() < 0.5) {
            const c = trave(0.8, 0.16, 0.2); c.position.set(x, h1 * 0.52 - 0.45, 0.1); s.add(c);
            const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), o.fioriera(rng)); fl.position.set(x, h1 * 0.52 - 0.22, 0.14); s.add(fl);
          }
        }
      }
    });
    y += h1;
    const f2 = trave(Wj + 0.12, 0.14, Dj + 0.12); f2.position.y = y; g.add(f2);
  }
  // tetto a capanna: costruito con il colmo lungo x, poi girato se il timpano guarda la strada
  const tetto = new THREE.Group(); tetto.position.y = y;
  const lungo = o.timpano ? Dj : Wj, largo = o.timpano ? Wj : Dj;
  const sb = 0.45, hd = largo / 2 + sb, rh = (largo / 2) * (o.pendenza ?? 1.05), L = Math.hypot(hd, rh * hd / (largo / 2));
  const incl = Math.atan2(rh, largo / 2);
  const mt = mat(TETTI[o.tetto || 'rosso'], { doppio: true });
  for (const sgn of [1, -1]) {
    const q = quad(lungo + 0.7, L, mt, 0.8, 0.8); q.receiveShadow = true;
    q.rotation.x = -Math.PI / 2 + incl * 1; q.rotation.order = 'YXZ';
    q.rotation.y = sgn > 0 ? 0 : Math.PI;
    const cx = 0, off = hd / 2;
    q.position.set(cx, rh - Math.tan(incl) * off, sgn * off);
    tetto.add(q);
    // travi di bordo sulle falde (fanno da contorno al diorama)
    for (const e of [-1, 1]) {
      const b = trave(0.14, 0.14, L + 0.05); b.rotation.x = sgn * incl; b.position.set(e * (lungo / 2 + 0.35), rh - Math.tan(incl) * off + 0.03, sgn * off); tetto.add(b);
    }
  }
  const colmo = trave(lungo + 0.8, 0.18, 0.18); colmo.position.y = rh + 0.08; tetto.add(colmo);
  // timpani triangolari a graticcio semplice
  const tri = new THREE.Shape(); tri.moveTo(-largo / 2, 0); tri.lineTo(largo / 2, 0); tri.lineTo(0, rh); tri.closePath();
  const tg = new THREE.ShapeGeometry(tri); const uv = tg.attributes.uv, pos = tg.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / P + 0.5, pos.getY(i) / h1);
  const mtt = mat('wall_timber_structure_cross');
  for (const e of [-1, 1]) {
    const m = new THREE.Mesh(tg, mtt); m.castShadow = m.receiveShadow = true;
    m.rotation.y = e * Math.PI / 2; m.position.x = e * lungo / 2; tetto.add(m);
    if (o.timpano && e === 1) {
      const f = quad(0.6, 0.6, finAcc, 0.6, 0.6); f.position.set(e * lungo / 2 + 0.03, rh * 0.38, 0); f.rotation.y = Math.PI / 2; f.castShadow = false; tetto.add(f);
    }
  }
  if (o.timpano) tetto.rotation.y = -Math.PI / 2;   // il timpano con la finestrella va sulla facciata (+z)
  g.add(tetto);
  if (o.camino) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), pietra); c.castShadow = true;
    c.position.set(o.timpano ? W * 0.25 : W * 0.3, y + rh * 0.75, o.timpano ? -D * 0.2 : -D * 0.15); g.add(c);
  }
  g.position.set(o.x, 0, o.z); g.rotation.y = o.rot || 0;
  // impronta allineata agli assi (le rotazioni sono multipli di 90°)
  const ruota = Math.abs(Math.sin(o.rot || 0)) > 0.5;
  const ex = (ruota ? D : W) / 2 + 0.1, ez = (ruota ? W : D) / 2 + 0.1;
  // punto per una lanterna a muro: accanto alla porta, fuori dalla facciata
  const lx = -W / 2 + P * (portaI + 0.5) + 0.85;
  const lant = new THREE.Vector3(lx, 2.05, D / 2 + 0.28).applyAxisAngle(new THREE.Vector3(0, 1, 0), o.rot || 0).add(g.position);
  const davanti = new THREE.Vector3(-W / 2 + P * (portaI + 0.5), 0, D / 2 + 0.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), o.rot || 0).add(g.position);
  return { gruppo: g, lanterna: lant, porta: davanti, impronta: [o.x - ex, o.z - ez, o.x + ex, o.z + ez], rot: o.rot || 0 };
}
