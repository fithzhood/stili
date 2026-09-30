// Il gioco: camminata sul piano, salto, il nemico che si ribalta piatto, le battute degli abitanti,
// e la camera laterale-rialzata che segue l'esploratore.
import * as THREE from 'three';
import { scene, camera, renderer, eroe, npc, nemico, colliders, lampada, DIR_L, PONTE, FIUME, altezzaPonte } from './papermario.js?v=8';
import { animati } from './mondo.js?v=8';

const Q = Demo.query;
const G = -24, SALTO = 8.2, VEL = 4.3;
let vy = 0, spinta = 0, lampeggio = 0;
eroe.pos.y = 0;

function libero(x, z) {
  if (x < -26 || x > 30 || z < -3.5 || z > 3.4) return false;
  if (x > FIUME.x0 - 0.2 && x < FIUME.x1 + 0.2 && Math.abs(z) > PONTE.mezza - 0.3) return false;
  for (const c of colliders) {
    if (Array.isArray(c)) { if (x > c[0] - 0.35 && x < c[2] + 0.35 && z > c[1] - 0.3 && z < c[3] + 0.3) return false; }
    else if (Math.hypot(x - c.x, (z - c.z) * 1.4) < c.r) return false;
  }
  return true;
}

// coriandoli di carta quando lo scarabeo si appiattisce
const coriandoli = [];
const COL = [0xff7f8f, 0xffd34d, 0x7fc8ff, 0xb99cff, 0xffffff];
function sbuffo(p) {
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.1), new THREE.MeshStandardMaterial({ color: COL[i % 5], side: THREE.DoubleSide, roughness: 0.9 }));
    m.position.set(p.x, p.y + 0.4, p.z); m.castShadow = true; scene.add(m);
    const a = i / 16 * Math.PI * 2;
    coriandoli.push({ m, v: new THREE.Vector3(Math.cos(a) * 2.5, 4 + (i % 3), Math.sin(a) * 1.5), w: new THREE.Vector3(i, i * 1.7, i * 0.3), vita: 1.4 });
  }
}

function aggiornaNemico(dt) {
  const n = nemico;
  if (n.stato === 'cammina') {
    n.pos.x += n.v * n.lato * dt;
    if (n.pos.x > n.b) n.volta(-1); else if (n.pos.x < n.a) n.volta(1);
    n.corpo.rotation.x += (0 - n.corpo.rotation.x) * Math.min(1, dt * 12);
  } else {
    // piatto a terra: il foglio si ribalta all'indietro e vibra un attimo, poi si rialza
    n.timer -= dt;
    const target = n.timer > 0 ? -Math.PI / 2 + 0.02 : 0;
    n.corpo.rotation.x += (target - n.corpo.rotation.x) * Math.min(1, dt * (n.timer > 0 ? 18 : 6));
    if (n.timer > 3.0) n.corpo.rotation.x += Math.sin(n.timer * 60) * 0.05;
    if (n.timer < -0.5) n.stato = 'cammina';
  }
  n.aggiorna(dt, n.stato === 'cammina' ? n.v : 0);
  if (n.stato === 'piatto') { n.corpo.rotation.z = 0; n.corpo.position.y = 0.02; }
}

function contatto() {
  const n = nemico; if (n.stato !== 'cammina') return;
  const dx = eroe.pos.x - n.pos.x, dz = eroe.pos.z - n.pos.z, h = eroe.pos.y - eroe.suolo;
  if (Math.abs(dx) > 0.75 || Math.abs(dz) > 0.6) return;
  if (vy < 0 && h > 0.25) {                 // salto in testa: si appiattisce
    n.stato = 'piatto'; n.timer = 3.6; vy = SALTO * 0.7; sbuffo(n.pos);
  } else if (h < 0.6 && lampeggio <= 0) {   // di lato: rimbalzo all'indietro
    spinta = Math.sign(dx || 1) * 7; vy = 4.5; lampeggio = 1.2;
  }
}

function inquadra(k) {
  const tx = eroe.pos.x, tz = eroe.pos.z * 0.4;
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.z += (tz + 11.5 - camera.position.z) * k;
  camera.position.y += (3.6 + eroe.suolo * 0.5 - camera.position.y) * k;
  camera.lookAt(camera.position.x, 1.75, camera.position.z - 11.5);
  lampada.position.set(camera.position.x, 0, 0).addScaledVector(DIR_L, 30);
  lampada.target.position.set(camera.position.x, 0, 0);
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
camera.position.set(eroe.pos.x, 3.6, 11.5 + eroe.pos.z * 0.4); inquadra(1);
if (Q.get('salta')) { eroe.pos.y = Number(Q.get('salta')); }

Demo.loop((dt, t) => {
  const a = Demo.asse();
  let vx = a.x * VEL, vz = -a.y * VEL * 0.8;
  if (Math.abs(spinta) > 0.1) { vx = spinta; spinta *= Math.exp(-dt * 6); }
  if (Math.abs(a.x) > 0.2 && Math.abs(spinta) < 1) eroe.volta(a.x > 0 ? 1 : -1);
  const nx = eroe.pos.x + vx * dt, nz = eroe.pos.z + vz * dt;
  if (libero(nx, eroe.pos.z)) eroe.pos.x = nx;
  if (libero(eroe.pos.x, nz)) eroe.pos.z = nz;
  eroe.suolo = altezzaPonte(eroe.pos.x, eroe.pos.z);
  const aTerra = eroe.pos.y <= eroe.suolo + 0.001;
  if (aTerra && Demo.premuto(' ')) vy = SALTO;
  vy += G * dt; eroe.pos.y += vy * dt;
  if (eroe.pos.y < eroe.suolo) { eroe.pos.y = eroe.suolo; vy = 0; }
  eroe.aggiorna(dt, aTerra ? Math.hypot(vx, vz) : 0);
  // in aria le gambe restano nella posa del passo lungo
  if (!aTerra) eroe.fotogramma(1);
  lampeggio -= dt; eroe.g.visible = lampeggio <= 0 || Math.floor(lampeggio * 16) % 2 === 0;

  aggiornaNemico(dt); contatto();
  for (const n of npc) {
    const d = Math.hypot(eroe.pos.x - n.f.pos.x, eroe.pos.z - n.f.pos.z);
    if (d < 4.5) n.f.volta(eroe.pos.x > n.f.pos.x ? 1 : -1);
    n.f.aggiorna(dt, 0);
    n.f.corpo.scale.y = 1 + Math.sin(t * 2.2 + n.f.pos.x) * 0.015;   // respira
    const s = n.b.scale.x + ((d < 4.5 ? 2.6 : 0.001) - n.b.scale.x) * Math.min(1, dt * 10);
    n.b.scale.set(s, s * 0.39, 1); n.b.position.set(n.f.pos.x, n.f.pos.y + 2.9, n.f.pos.z + 0.2); n.b.visible = s > 0.05;
  }
  for (let i = coriandoli.length - 1; i >= 0; i--) {
    const c = coriandoli[i]; c.vita -= dt; c.v.y += G * 0.35 * dt; c.v.multiplyScalar(Math.exp(-dt * 1.5));
    c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.w.x * dt; c.m.rotation.y += c.w.y * dt;
    if (c.m.position.y < 0.02) { c.m.position.y = 0.02; c.v.set(0, 0, 0); }
    if (c.vita < 0) { scene.remove(c.m); coriandoli.splice(i, 1); }
  }
  for (const f of animati) f(t);
  inquadra(1 - Math.exp(-dt * 4));
  renderer.render(scene, camera);
});
Demo.extra('<p>Ogni figura è un solo foglio con due facce: davanti il disegno, dietro lo stesso disegno speculare e un po\' più chiaro, come la carta vista in controluce. Tutti i disegni sono fatti nel codice su canvas.</p>');
Demo.pronto();
