// Personaggi a sprite: fogli Ninja Adventure (16×16, quattro direzioni, camminata a 4 pose).
// Il piano guarda la camera solo sull'asse verticale; la direzione disegnata si sceglie
// confrontando la direzione di marcia con la direzione della camera, come in un JRPG.
import * as THREE from 'three';
import { ombraTonda } from './pixel.js?v=8';
import { altezza } from './arredi.js?v=8';

const COLONNE = 4, RIGHE = 7;
const LATO = 1.7;                  // metri del riquadro da 16 px
let texOmbra = null;

export class Pupo {
  constructor(scene, loader, nome, x, z) {
    const t = loader.load(`assets/sprite/${nome}.png?v=8`);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(1 / COLONNE, 1 / RIGHE);
    this.tex = t;
    const g = new THREE.PlaneGeometry(LATO, LATO * 1.12); g.translate(0, LATO * 0.56 - 0.06, 0);
    // la normale punta un po' verso l'alto: così la luce dei lampioni accende lo sprite anche da sopra
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0.45, 0.89);
    this.mat = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0xb4acbc, emissiveMap: t });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.renderOrder = 2;
    texOmbra ||= ombraTonda();
    this.ombra = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), new THREE.MeshBasicMaterial({ map: texOmbra, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.8 }));
    this.ombra.rotation.x = -Math.PI / 2;
    this.ombra.renderOrder = 1;
    scene.add(this.mesh, this.ombra);
    this.pos = new THREE.Vector3(x, 0, z);
    this.dir = 0;            // angolo della direzione di marcia nel mondo
    this.vel = 0;            // velocità attuale (m/s)
    this.passo = 0;          // fase della camminata
  }
  /** yaw = angolo della camera attorno al bersaglio. */
  aggiorna(dt, yaw) {
    this.passo += dt * (this.vel > 0.05 ? 7.5 * Math.min(1.4, 0.55 + this.vel / 3.2) : 0);
    const fotogramma = this.vel > 0.05 ? Math.floor(this.passo) % 4 : 0;
    let rel = ((this.dir - yaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;   // -π..π
    let col;
    if (Math.abs(rel) < Math.PI / 4 + 0.01) col = 0;          // verso la camera
    else if (Math.abs(rel) > Math.PI * 3 / 4 - 0.01) col = 1; // di schiena
    else col = rel > 0 ? 3 : 2;                                // destra / sinistra dello schermo
    this.tex.offset.set(col / COLONNE, 1 - (fotogramma + 1) / RIGHE);
    const y = altezza(this.pos.x, this.pos.z);
    const salto = this.vel > 0.05 ? Math.abs(Math.sin(this.passo * Math.PI)) * 0.05 : 0;
    this.mesh.position.set(this.pos.x, y + salto, this.pos.z);
    this.mesh.rotation.y = yaw;
    this.ombra.position.set(this.pos.x, y + 0.02, this.pos.z + 0.02);
    this.ombra.scale.setScalar(1 - salto * 2);
  }
}

/** Abitante che passeggia lungo un giro di tappe, con qualche sosta. */
export class Passante extends Pupo {
  constructor(scene, loader, nome, tappe, vel = 1.1, sosta = 2) {
    super(scene, loader, nome, tappe[0][0], tappe[0][1]);
    this.tappe = tappe; this.i = 1; this.v = vel; this.sostaMax = sosta; this.sosta = 0;
    this.dir = Math.atan2(tappe[1][0] - tappe[0][0], tappe[1][1] - tappe[0][1]);
  }
  muovi(dt) {
    if (this.sosta > 0) { this.sosta -= dt; this.vel = 0; return; }
    const [tx, tz, s] = this.tappe[this.i];
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.08) {
      this.i = (this.i + 1) % this.tappe.length;
      if (s) this.sosta = s;
      if (s && this.tappe[this.i]) { /* guarda verso la prossima tappa dopo la sosta */ }
      return;
    }
    this.vel = this.v;
    const passo = Math.min(d, this.v * dt);
    this.pos.x += dx / d * passo; this.pos.z += dz / d * passo;
    this.dir = Math.atan2(dx, dz);
  }
}
