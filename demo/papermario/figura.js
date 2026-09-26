// La figura di carta: due facce su un foglio sottilissimo (davanti il disegno, dietro lo speculare
// schiarito), che si volta come una pagina quando cambia verso e ondeggia camminando.
import * as THREE from 'three';
import { texDa, retro, tela, ritaglio } from './carta.js?v=5';

let texOmbra;
function ombraTex() {
  if (texOmbra) return texOmbra;
  const [c, g] = tela(64, 64); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(40,30,20,0.55)'); gr.addColorStop(0.6, 'rgba(40,30,20,0.35)'); gr.addColorStop(1, 'rgba(40,30,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (texOmbra = new THREE.CanvasTexture(c));
}
const DURATA_GIRO = 0.15;

export class Foglio {
  constructor(scene, fotogrammi, h, x, z) {
    this.front = fotogrammi.map(c => texDa(c)); this.back = fotogrammi.map(c => texDa(retro(c)));
    const w = h * fotogrammi[0].width / fotogrammi[0].height;
    this.g = new THREE.Group(); this.perno = new THREE.Group(); this.corpo = new THREE.Group();
    this.g.add(this.perno); this.perno.add(this.corpo);
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2 - h * 0.03, 0);
    const faccia = (map, dietro) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.9 }));
      m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
      if (dietro) { m.rotation.y = Math.PI; m.position.z = -0.012; }
      m.castShadow = true; this.corpo.add(m); return m;
    };
    this.fDav = faccia(this.front[0], false); this.fDie = faccia(this.back[0], true);
    this.ombra = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, w * 0.36), new THREE.MeshBasicMaterial({ map: ombraTex(), transparent: true, depthWrite: false }));
    this.ombra.rotation.x = -Math.PI / 2; this.ombra.renderOrder = 1;
    scene.add(this.g, this.ombra);
    this.pos = new THREE.Vector3(x, 0, z); this.suolo = 0;
    this.lato = 1; this.giro = 1; this.rDa = 0; this.rA = 0; this.fase = 0; this.passo = 0;
  }
  fotogramma(i) {
    if (this.fDav.material.map === this.front[i]) return;
    this.fDav.material.map = this.front[i]; this.fDie.material.map = this.back[i];
    this.fDav.customDepthMaterial.map = this.front[i]; this.fDie.customDepthMaterial.map = this.back[i];
  }
  /** Cambia verso: rotazione di mezzo giro attorno all'asse verticale, come una pagina. */
  volta(lato) {
    if (lato === this.lato) return;
    this.lato = lato; this.rDa = this.perno.rotation.y; this.rA = lato > 0 ? 0 : Math.PI; this.giro = 0;
  }
  aggiorna(dt, vel) {
    if (this.giro < 1) {
      this.giro = Math.min(1, this.giro + dt / DURATA_GIRO);
      const e = this.giro * this.giro * (3 - 2 * this.giro);
      this.perno.rotation.y = this.rDa + (this.rA - this.rDa) * e;
    }
    if (vel > 0.1) { this.fase += dt * vel * 3.2; this.passo = Math.floor(this.fase / Math.PI) % 2; }
    else { this.fase += (Math.round(this.fase / Math.PI) * Math.PI - this.fase) * Math.min(1, dt * 10); this.passo = 0; }
    this.fotogramma(this.front.length > 1 ? this.passo : 0);
    const alto = this.pos.y - this.suolo;
    this.corpo.rotation.z = vel > 0.1 && alto < 0.05 ? Math.sin(this.fase) * 0.07 : this.corpo.rotation.z * 0.8;
    this.corpo.position.y = vel > 0.1 && alto < 0.05 ? Math.abs(Math.sin(this.fase)) * 0.07 : 0;
    this.g.position.copy(this.pos);
    this.ombra.position.set(this.pos.x, this.suolo + 0.015, this.pos.z + 0.05);
    const s = Math.max(0.35, 1 - alto * 0.25); this.ombra.scale.set(s, s, 1); this.ombra.material.opacity = s;
  }
}

/** Nuvoletta di carta con una battuta: compare vicino a chi parla. */
export function fumetto(testo) {
  const cv = ritaglio(512, 200, g => {
    g.fillStyle = '#fffdf6'; g.strokeStyle = '#3a2418'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(20, 20, 472, 120, 40); g.moveTo(220, 138); g.lineTo(250, 190); g.lineTo(280, 138); g.fill(); g.stroke();
    g.fillStyle = '#fffdf6'; g.fillRect(224, 128, 52, 14);
    g.fillStyle = '#3a2418'; g.font = 'bold 44px "Comic Sans MS", "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.fillText(testo, 256, 96);
  }, 7);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texDa(cv), depthWrite: false }));
  s.scale.set(0.001, 0.001, 1); s.renderOrder = 10;
  return s;
}
