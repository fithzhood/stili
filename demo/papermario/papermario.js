// Personaggi di carta, alla Paper Mario: un diorama di cartoncino sul tavolo, luce morbida da lampada,
// e figure sottili come un foglio che si voltano come una pagina. Tutto disegnato nel codice.
import * as THREE from 'three';
import * as M from './mondo.js?v=6';
import { casetta, ponte, steccato, altezzaPonte, PONTE } from './casetta.js?v=6';
import * as S from './scenari.js?v=6';
import * as D from './disegni.js?v=6';
import { Foglio, fumetto } from './figura.js?v=6';
import { FIUME } from './prato.js?v=6';
import { rnd } from './carta.js?v=6';

const Q = Demo.query;
Demo.carica('Ritaglio il cartoncino', 0.1);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: Demo.shot });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe9f2);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.3, 120);

// luce da tavolo: una lampada calda in alto a sinistra, ombre morbide, e il riverbero del foglio
scene.add(new THREE.HemisphereLight(0xfff6e6, 0xa9c98e, 1.15));
const lampada = new THREE.DirectionalLight(0xfff0d6, 2.9);
lampada.castShadow = true; lampada.shadow.mapSize.set(2048, 2048);
Object.assign(lampada.shadow.camera, { left: -22, right: 22, top: 16, bottom: -16, near: 1, far: 80 });
lampada.shadow.bias = -0.0004; lampada.shadow.normalBias = 0.02; lampada.shadow.radius = 5;
scene.add(lampada, lampada.target);
const DIR_L = new THREE.Vector3(-0.45, 1, 0.6).normalize();

// ─────────────── il diorama ───────────────
M.prato3d(scene);
M.sole(scene, 17, 9.2, -22, 4.6);
for (const [x, y, z, s, k] of [[-24, 6.8, -19, 3.0, 1], [-11, 5.9, -17.5, 3.0, 2], [1, 7.0, -19.5, 3.6, 3], [11, 5.6, -16.5, 2.5, 4], [25, 6.6, -18, 3.2, 5]]) M.nuvola(scene, x, y, z, s, k);
for (const [x, z, W, H, c, sc, s, n] of [
  [-10, -20, 34, 5.2, '#a6dccb', 'rgba(60,110,120,0.3)', 1, 3], [22, -20.5, 30, 4.8, '#bfe3d3', 'rgba(60,110,120,0.25)', 2, 3],
  [-16, -15, 22, 3.8, '#8fd27e', 'rgba(40,100,60,0.4)', 3, 2], [8, -15.5, 24, 3.4, '#a2da80', 'rgba(40,100,60,0.4)', 4, 3], [28, -15, 16, 3.8, '#88cd7a', 'rgba(40,100,60,0.4)', 5, 2],
  [-21, -10.5, 14, 3, '#b0dc72', 'rgba(70,120,40,0.4)', 6, 2], [1, -11, 18, 2.5, '#bfe27e', 'rgba(70,120,40,0.4)', 7, 3], [22, -10.5, 14, 3, '#aad86e', 'rgba(70,120,40,0.4)', 8, 2],
]) M.collina(scene, x, z, W, H, c, sc, s, n);
const colliders = [];
colliders.push(casetta(scene, -14.5, -5.4));
ponte(scene);
steccato(scene, -9.5, -3.5, -3.3); steccato(scene, 15, 21, -3.4);
const TINTE = [['#b6e38a', '#7cc46a', '#4f9a57'], ['#d8ef9a', '#a6d46e', '#6fae55'], ['#9fe0b0', '#63bf82', '#3f9a67']];
for (const [x, z, h, s] of [[-23, -6.5, 4.4, 1], [-8, -7.5, 5, 2], [-2.2, -6, 4, 3], [5, -7, 4.6, 4], [16, -6.5, 4.2, 5], [26, -7.2, 4.8, 6], [-19, -5, 3.4, 7]])
  M.piegato(scene, S.albero(s, TINTE[s % 3]), x, z, h, 0.3);
for (const [x, z, s] of [[-17, 5.4, 1], [2.5, 5.6, 3], [22, 5.4, 5], [-11, -4.2, 6], [7.5, -4.6, 7], [21, -4.3, 8]])
  M.piegato(scene, S.cespuglio(s * 11), x, z, z > 0 ? 1.0 : 1.3 + (s % 3) * 0.25, 0.22);
{
  const r = rnd(33), col = ['#ff7f8f', '#ffffff', '#b99cff', '#ffb24d', '#7fc8ff'];
  const fi = col.map((c, i) => S.fiore(c, i));
  for (let i = 0; i < 34; i++) {
    const x = -24 + r() * 50, lato = r() < 0.5 ? -1 : 1, z = lato * (2.5 + r() * 1.1);
    if (x > FIUME.x0 - 0.8 && x < FIUME.x1 + 0.8) continue;
    M.piegato(scene, fi[Math.floor(r() * fi.length)], x, z, 0.5 + r() * 0.35, 0.35, (r() - 0.5) * 0.6);
  }
}

// ─────────────── i personaggi ───────────────
const eroe = new Foglio(scene, [D.esploratore(0), D.esploratore(1)], 1.8, Number(Q.get('x') ?? -7), 0.6);
const npc = [
  { f: new Foglio(scene, [D.coniglia()], 1.75, -10.2, -2.2), testo: 'Che bel sole oggi!' },
  { f: new Foglio(scene, [D.gufo()], 2.0, 17.8, -2.3), testo: 'Posta per te!' },
];
for (const n of npc) { n.b = fumetto(n.testo); scene.add(n.b); n.f.volta(n.f.pos.x > 0 ? -1 : 1); colliders.push({ x: n.f.pos.x, z: n.f.pos.z, r: 0.6 }); }
const nemico = new Foglio(scene, [D.scarabeo()], 1.1, 4, 0.3);
Object.assign(nemico, { stato: 'cammina', timer: 0, v: 1.3, a: 0.5, b: 7.2 });

export { scene, camera, renderer, eroe, npc, nemico, colliders, lampada, DIR_L, PONTE, FIUME, altezzaPonte };
import('./gioco.js?v=6').catch(Demo.errore);
