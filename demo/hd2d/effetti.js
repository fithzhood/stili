// L'aria del diorama: raggi di luce volumetrici (coni additivi che si spengono di taglio),
// coni caldi sotto i lampioni, lucciole e pulviscolo, spruzzi della fontana, riflessi sul canale.
import * as THREE from 'three';
import { rnd, alone } from './pixel.js?v=8';

export const U = { uT: { value: 0 }, uScala: { value: 1 } };

const VS_RAGGIO = `
varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * mv;
}`;
const FS_RAGGIO = `
uniform vec3 uCol; uniform float uT, uFaseT, uCoda, uTesta;
varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
float h(float n){ return fract(sin(n) * 43758.5453); }
float vn(float x){ float i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(h(i), h(i+1.0), f); }
void main(){
  float fr = abs(dot(normalize(vN), normalize(vV)));
  float a = pow(fr, 2.2);                                   // il cono è denso al centro, nulla sul bordo
  float lungo = smoothstep(0.0, uCoda, vUv.y) * (1.0 - smoothstep(uTesta, 1.0, vUv.y));
  float strie = 0.55 + 0.45 * vn(vUv.x * 9.0 + uFaseT) * (0.7 + 0.3 * sin(uT * 0.4 + vUv.x * 20.0 + uFaseT));
  float suolo = smoothstep(0.0, 0.6, vW.y);                  // sfuma dove tocca terra: niente taglio netto
  gl_FragColor = vec4(uCol * a * lungo * strie * suolo, 1.0);
}`;
function matRaggio(col, fase, coda = 0.35, testa = 0.7) {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(col) }, uT: U.uT, uFaseT: { value: fase }, uCoda: { value: coda }, uTesta: { value: testa } },
    vertexShader: VS_RAGGIO, fragmentShader: FS_RAGGIO,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

/** Fascio di luna: cono lungo inclinato lungo la direzione della luce, che arriva a terra in (x,z). */
export function raggioLuna(scene, x, z, dirLuce, r0 = 0.6, r1 = 1.8, lung = 16, col = [0.10, 0.14, 0.24], fase = 0) {
  const geo = new THREE.CylinderGeometry(r0, r1, lung, 20, 1, true);
  geo.translate(0, -lung / 2, 0);                        // punta in alto, base a -lung
  const m = new THREE.Mesh(geo, matRaggio(new THREE.Color(...col), fase, 0.25, 0.75));
  // l'asse del cono (−y locale) deve seguire la luce che scende: −dirLuce
  const giu = dirLuce.clone().normalize().negate();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), giu);
  m.position.set(x, 0, z).addScaledVector(giu, -lung);
  m.renderOrder = 5;
  scene.add(m); return m;
}
/** Cono caldo sotto una lanterna. */
export function conoLanterna(scene, p, h = 3.3, r = 1.7, col = [0.09, 0.05, 0.018]) {
  const geo = new THREE.CylinderGeometry(0.18, r, h, 18, 1, true); geo.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(geo, matRaggio(new THREE.Color(...col), p.x * 3.1, 0.3, 0.8));
  m.position.copy(p); m.position.y -= 0.15; m.renderOrder = 5; scene.add(m); return m;
}

// ── particelle: un solo Points, ogni punto ha base, seme, tipo ──
const VS_P = `
attribute vec4 aDati;   // x = seme, y = raggio di deriva, z = dimensione, w = tipo (0 lucciola, 1 pulviscolo, 2 spruzzo)
attribute vec3 aCol;
uniform float uT, uScala;
varying vec3 vCol; varying float vA;
float h(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  vec3 p = position; float s = aDati.x, r = aDati.y, tipo = aDati.w;
  float lum = 1.0;
  if (tipo < 0.5) {             // lucciola: vaga lenta, si accende e si spegne
    p += vec3(sin(uT*0.37 + s*6.0) + 0.5*sin(uT*0.83 + s*11.0), 0.6*sin(uT*0.51 + s*3.0), cos(uT*0.29 + s*5.0) + 0.5*sin(uT*0.71 + s*7.0)) * r;
    float c = fract(uT * 0.23 + s);
    lum = smoothstep(0.0, 0.08, c) * (1.0 - smoothstep(0.2, 0.45, c)) * 0.9 + 0.1;
  } else if (tipo < 1.5) {      // pulviscolo: sale piano e oscilla
    float y = fract(s * 7.3 + uT * 0.015 * (0.5 + h(s)));
    p.y += y * r * 2.0 - r * 0.5;
    p.x += sin(uT * 0.3 + s * 20.0) * 0.4; p.z += cos(uT * 0.25 + s * 13.0) * 0.4;
    lum = smoothstep(0.0, 0.15, y) * (1.0 - smoothstep(0.75, 1.0, y)) * (0.6 + 0.4 * sin(uT * 2.0 + s * 30.0));
  } else {                      // spruzzo della fontana: parabola dalla coppa alla vasca
    float c = fract(uT * 0.9 + s);
    float a = s * 97.0;
    vec2 d = vec2(cos(a), sin(a));
    p.xz += d * (0.95 + c * 0.55);
    p.y += 0.25 - c * c * 1.75;
    lum = 1.0 - smoothstep(0.85, 1.0, c);
  }
  vCol = aCol; vA = lum;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aDati.z * uScala / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FS_P = `
uniform sampler2D uMap; varying vec3 vCol; varying float vA;
void main(){ vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vCol * c.r * vA, 1.0); }`;

export function particelle(scene, zone) {
  const P = [], D = [], C = [];
  const r = rnd(4242);
  const agg = (x, y, z, seme, raggio, dim, tipo, col) => { P.push(x, y, z); D.push(seme, raggio, dim, tipo); C.push(...col); };
  // lucciole attorno agli alberi, sul canale e nelle aiuole
  for (const [cx, cz, n, rr] of zone.lucciole) for (let i = 0; i < n; i++)
    agg(cx + (r() - 0.5) * rr * 2, 0.6 + r() * 2.2, cz + (r() - 0.5) * rr * 2, r(), 0.6 + r() * 0.8, 90 + r() * 60, 0, [2.2, 3.0, 0.9]);
  // pulviscolo nei coni delle lanterne (caldo) e nei raggi di luna (freddo)
  for (const l of zone.lanterne) for (let i = 0; i < 26; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()) * 1.5;
    agg(l.x + Math.cos(a) * d, 0.3 + r() * 2.0, l.z + Math.sin(a) * d, r(), 1.2, 34 + r() * 30, 1, [2.2, 1.3, 0.6]);
  }
  for (const [x, z, n] of zone.luna) for (let i = 0; i < n; i++) {
    const t = r(); const p = new THREE.Vector3(x, 0, z).addScaledVector(zone.dirLuce, t * 8);
    agg(p.x + (r() - 0.5) * 1.6, p.y + 0.3, p.z + (r() - 0.5) * 1.6, r(), 1.4, 30 + r() * 26, 1, [0.6, 0.8, 1.2]);
  }
  // spruzzi: cadono dal bordo della coppa
  const f = zone.fontana;
  for (let i = 0; i < 140; i++) agg(f.x, 2.3, f.z, r(), 0, 26 + r() * 18, 2, [0.6, 0.85, 1.3]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('aDati', new THREE.Float32BufferAttribute(D, 4));
  geo.setAttribute('aCol', new THREE.Float32BufferAttribute(C, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: U.uT, uScala: U.uScala, uMap: { value: alone() } }, vertexShader: VS_P, fragmentShader: FS_P,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 6;
  scene.add(pts); return pts;
}

// ── riflessi delle lanterne sul canale: una striscia che si allunga verso chi guarda ──
const texAlone = alone();
export function riflessi(scene, lanterne, acquaY) {
  const lista = [];
  for (const l of lanterne) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texAlone, color: new THREE.Color(1.6, 0.8, 0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 4; scene.add(m);
    lista.push({ l, m, fase: l.x * 2.7 });
  }
  const tmp = new THREE.Vector3();
  return (camera, t, x0, x1) => {
    for (const r of lista) {
      // punto specchiato sotto l'acqua, e dove la retta camera→specchio incontra la superficie
      const s = tmp.set(r.l.x, 2 * acquaY - r.l.y, r.l.z);
      const c = camera.position;
      const u = (c.y - acquaY) / (c.y - s.y);
      const px = c.x + (s.x - c.x) * u, pz = c.z + (s.z - c.z) * u;
      const vis = px > x0 + 0.2 && px < x1 - 0.2;
      r.m.visible = vis;
      r.m.position.set(px, acquaY + 0.02, pz);
      const ang = Math.atan2(c.x - px, c.z - pz);
      r.m.rotation.z = ang;
      const tremo = 1 + 0.25 * Math.sin(t * 3.1 + r.fase) + 0.15 * Math.sin(t * 7.3 + r.fase);
      r.m.scale.set(0.9 * tremo, 3.2, 1);
    }
  };
}
