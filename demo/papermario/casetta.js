// La casetta a cubo di cartone (scatola da imballo con porta e finestre di carta), il ponte ad arco,
// lo steccato di bastoncini da gelato e le onde di carta del fiume.
import * as THREE from 'three';
import { texDa, kraft, ondulato, tela, fibre, piega } from './carta.js?v=7';
import { animati } from './mondo.js?v=7';

const TRATTO = '#3a2418';
function facciata(tipo) {
  const [c, g] = kraft(512, 432, tipo === 'fronte' ? 21 : 22);
  g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = TRATTO;
  const carta = (path, fill) => { g.save(); g.translate(5, 7); g.fillStyle = 'rgba(70,40,20,0.25)'; g.beginPath(); path(); g.fill(); g.restore(); g.fillStyle = fill; g.beginPath(); path(); g.fill(); g.stroke(); };
  // nastro adesivo in cima, un po' storto
  g.fillStyle = 'rgba(240,225,180,0.75)'; g.save(); g.translate(256, 18); g.rotate(-0.02); g.fillRect(-270, -16, 540, 34); g.restore();
  if (tipo === 'fronte') {
    carta(() => { g.moveTo(196, 432); g.lineTo(196, 250); g.arc(256, 250, 60, Math.PI, 0); g.lineTo(316, 432); }, '#e0574a');
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(296, 350, 9, 0, 7); g.fill(); g.stroke();
    for (const x of [96, 416]) {
      carta(() => g.roundRect(x - 52, 150, 104, 96, 10), '#fdf7e8');
      g.fillStyle = '#7fc8ef'; g.fillRect(x - 40, 162, 80, 72);
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x - 32, 170, 14, 30);
      g.beginPath(); g.moveTo(x, 162); g.lineTo(x, 234); g.moveTo(x - 40, 198); g.lineTo(x + 40, 198); g.stroke();
      carta(() => g.roundRect(x - 60, 246, 120, 22, 6), '#f28fa0');
    }
    carta(() => g.roundRect(186, 108, 140, 56, 8), '#fff4d0');
    g.fillStyle = TRATTO; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.fillText('CASA', 256, 148);
  } else {
    // il lato della scatola: le scritte stampate dell'imballo
    g.strokeStyle = 'rgba(40,30,30,0.7)'; g.fillStyle = 'rgba(40,30,30,0.7)'; g.lineWidth = 8;
    for (const x of [190, 250]) { g.beginPath(); g.moveTo(x, 180); g.lineTo(x, 110); g.moveTo(x - 22, 134); g.lineTo(x, 108); g.lineTo(x + 22, 134); g.stroke(); }
    g.font = 'bold 38px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('FRAGILE', 330, 260);
    g.beginPath(); g.moveTo(300, 110); g.lineTo(360, 110); g.lineTo(346, 160); g.lineTo(314, 160); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(330, 160); g.lineTo(330, 196); g.moveTo(310, 196); g.lineTo(350, 196); g.stroke();
    carta(() => g.roundRect(80, 290, 110, 90, 10), '#fdf7e8'); g.fillStyle = '#7fc8ef'; g.fillRect(92, 302, 86, 66);
  }
  piega(g, 0, 428, 512, 428, 1.5); piega(g, 4, 0, 4, 432, 1.5); piega(g, 508, 0, 508, 432, 1.5);
  return texDa(c);
}

export function casetta(scene, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const W = 4.2, H = 3.5, D = 3.4;
  const lato = new THREE.MeshStandardMaterial({ map: facciata('lato'), roughness: 0.95 });
  const [kc] = kraft(256, 256, 30); const tetto0 = new THREE.MeshStandardMaterial({ map: texDa(kc), roughness: 1 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [lato, lato, tetto0, tetto0, new THREE.MeshStandardMaterial({ map: facciata('fronte'), roughness: 0.95 }), lato]);
  box.position.y = H / 2; box.castShadow = box.receiveShadow = true; g.add(box);
  // le alette della scatola, aperte verso l'esterno sui lati
  const ala = new THREE.MeshStandardMaterial({ map: texDa(kc), roughness: 1, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.5, D), ala); a.geometry.translate(0, 0.75, 0);
    a.position.set(s * W / 2, H, 0); a.rotation.z = -s * 0.55; a.castShadow = true; g.add(a);
  }
  // tetto: un cartoncino rosso piegato a capanna, col bordo ondulato in vista
  const [rc, rg] = tela(256, 256); rg.fillStyle = '#e46a55'; rg.fillRect(0, 0, 256, 256);
  rg.strokeStyle = 'rgba(120,30,20,0.35)'; rg.lineWidth = 4; for (let y = 20; y < 256; y += 32) for (let x = (y / 32 % 2) * 16; x < 256; x += 32) { rg.beginPath(); rg.arc(x, y, 16, 0, Math.PI); rg.stroke(); }
  fibre(rg, 256, 256, 1.2, 4);
  const rosso = new THREE.MeshStandardMaterial({ map: texDa(rc), roughness: 0.9 });
  const ond = new THREE.MeshStandardMaterial({ map: ondulato(), roughness: 1 });
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.08, D * 0.72), [ond, ond, rosso, rosso, ond, ond]);
    f.rotation.x = s * 0.62; f.position.set(0, H + 0.62, s * D * 0.25); f.castShadow = f.receiveShadow = true; g.add(f);
  }
  const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.3, 16, 1, true), new THREE.MeshStandardMaterial({ map: texDa(kraft(64, 64, 2)[0]), side: THREE.DoubleSide, roughness: 1 }));
  cam.position.set(W * 0.28, H + 1.1, -0.4); cam.castShadow = true; g.add(cam);
  scene.add(g);
  return [x - W / 2, z - D / 2, x + W / 2, z + D / 2];
}

export const PONTE = { x0: 8.6, x1: 13.4, mezza: 1.35, alto: 0.85 };
export function altezzaPonte(x, z) {
  if (Math.abs(z) > PONTE.mezza + 0.3 || x < PONTE.x0 || x > PONTE.x1) return 0;
  return Math.sin((x - PONTE.x0) / (PONTE.x1 - PONTE.x0) * Math.PI) * PONTE.alto + 0.05;
}
const legno = new THREE.MeshStandardMaterial({ color: 0xe9c98f, roughness: 0.8 });
export function ponte(scene) {
  const N = 24, L = PONTE.x1 - PONTE.x0;
  const geo = new THREE.PlaneGeometry(L, PONTE.mezza * 2, N, 1); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + PONTE.x0 + L / 2; p.setY(i, altezzaPonte(x, 0) - 0.03); }
  geo.computeVertexNormals();
  const [c, g] = kraft(512, 128, 17, '#d9a46c'); g.strokeStyle = 'rgba(90,50,20,0.55)'; g.lineWidth = 3;
  for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  const d = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texDa(c), side: THREE.DoubleSide, roughness: 1 }));
  d.position.x = PONTE.x0 + L / 2; d.castShadow = d.receiveShadow = true; scene.add(d);
  // parapetti di bastoncini da gelato
  for (const s of [-1, 1]) for (let i = 0; i <= 8; i++) {
    const x = PONTE.x0 + L * i / 8, y = altezzaPonte(x, 0);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.05), legno); st.position.set(x, y + 0.4, s * PONTE.mezza); st.castShadow = true; scene.add(st);
    if (i < 8) {
      const x2 = PONTE.x0 + L * (i + 1) / 8, y2 = altezzaPonte(x2, 0), len = Math.hypot(x2 - x, y2 - y);
      const r = new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, 0.12, 0.05), legno); r.position.set((x + x2) / 2, (y + y2) / 2 + 0.72, s * PONTE.mezza + s * 0.03);
      r.rotation.z = Math.atan2(y2 - y, x2 - x); r.castShadow = true; scene.add(r);
    }
  }
}
export function steccato(scene, x0, x1, z) {
  for (let x = x0; x <= x1; x += 0.45) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.04), legno); st.position.set(x, 0.4, z); st.rotation.z = Math.sin(x * 7) * 0.05; st.castShadow = true; scene.add(st);
  }
  for (const y of [0.3, 0.6]) { const r = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.3, 0.1, 0.04), legno); r.position.set((x0 + x1) / 2, y, z + 0.04); r.castShadow = true; scene.add(r); }
}
