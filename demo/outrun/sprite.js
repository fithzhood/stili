// Sprite disegnati pixel per pixel su piccole tele: palme in controluce, lampioni al neon,
// cartelloni, frecce di curva, auto del traffico viste di coda, e l'auto del giocatore.

function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function penna(c) {
  const x = c.getContext('2d');
  const px = (a, b, col) => { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), 1, 1); };
  const rett = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h)); };
  // linea di Bresenham con spessore
  const linea = (x0, y0, x1, y1, col, sp = 1) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy; const o = Math.floor((sp - 1) / 2);
    for (;;) {
      rett(x0 - o, y0 - o, sp, sp, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  return { x, px, rett, linea };
}

// ── Palma in controluce: tronco curvo ad anelli, fronde che ricadono, bordo acceso dal tramonto ──
function palma(seme, piega) {
  const W = 72, H = 128, c = tela(W, H), { rett, linea } = penna(c);
  let s = seme; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const cima = [W / 2 + piega * 14, 26];
  // tronco: da sotto verso la cima, con una curva
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, x = W / 2 + piega * 14 * t * t + Math.sin(t * 3) * 2 * piega, y = H - 1 - (H - 1 - cima[1]) * t;
    pts.push([x, y, 5 - t * 2.2]);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [x, y, w] = pts[i], anello = (Math.floor(y) % 5) === 0;
    rett(x - w, y - 2, w * 2, 3, anello ? '#3b1646' : '#24092f');
    rett(x - w, y - 2, 1, 3, '#ff5c8a');          // bordo acceso dal tramonto
    rett(x + w - 1, y - 2, 1, 3, '#140519');
  }
  // fronde: lame piene disegnate a vettori, poi ridotte a pixel netti (alfa tutto o niente)
  const x = c.getContext('2d');
  const n = 9, luci = [];
  for (let f = 0; f < n; f++) {
    const u = f / (n - 1);
    const a = -Math.PI + 0.15 + u * (Math.PI - 0.3) + (r() - 0.5) * 0.25;
    const L = 26 + r() * 9 + Math.abs(u - 0.5) * 8, cad = 0.35 + Math.abs(u - 0.5) * 0.9 + r() * 0.2;
    const P = t => [cima[0] + Math.cos(a) * L * t, cima[1] + Math.sin(a) * L * t + t * t * L * cad];
    const sopra = [], sotto = [];
    const K = 16;
    for (let k = 0; k <= K; k++) {
      const t = k / K, [px, py] = P(t), [qx, qy] = P(Math.min(1, t + 0.02));
      let nx = -(qy - py), ny = qx - px; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      if (ny > 0) { nx = -nx; ny = -ny; }                    // la normale "sopra" punta in alto
      const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 3.2 + 0.6;
      const dente = k % 2 ? 1 : 3.2;                          // foglioline che pendono sotto
      sopra.push([px + nx * w * 0.7, py + ny * w * 0.7]);
      sotto.push([px - nx * w * dente * 0.8, py - ny * w * dente * 0.8 + (k % 2 ? 0 : 2.5 * t)]);
    }
    x.fillStyle = '#1b0726';
    x.beginPath(); x.moveTo(...sopra[0]);
    for (const q of sopra) x.lineTo(...q);
    for (let k = sotto.length - 1; k >= 0; k--) x.lineTo(...sotto[k]);
    x.closePath(); x.fill();
    luci.push(sopra);
  }
  const id = x.getImageData(0, 0, W, H);
  for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] > 110 ? 255 : 0;
  x.putImageData(id, 0, 0);
  for (const sopra of luci) for (let k = 0; k < sopra.length - 1; k++) {
    const q = sopra[k], w = sopra[k + 1];
    linea(q[0], q[1], w[0], w[1], k < sopra.length * 0.6 ? '#ff5aa0' : '#a8307a');
  }
  // noci di cocco
  rett(cima[0] - 3, cima[1] + 1, 3, 3, '#2d0d33'); rett(cima[0] + 1, cima[1] + 2, 3, 3, '#2d0d33');
  return c;
}

// ── Lampione al neon: palo scuro, braccio verso la strada, tubo che si accende ──
function lampione(verso, col) {
  const W = 40, H = 132, c = tela(W, H), { rett } = penna(c);
  const px = verso > 0 ? 8 : W - 11;
  rett(px, 18, 3, H - 18, '#1c0d2a'); rett(px, 18, 1, H - 18, '#5b2d7a');
  rett(px - 2, H - 6, 7, 6, '#150a20');
  const bx0 = verso > 0 ? px : px - 22;
  rett(bx0, 16, 25, 3, '#1c0d2a');
  const tx = verso > 0 ? px + 12 : px - 23;
  // alone
  for (let i = 6; i > 0; i--) { c.getContext('2d').globalAlpha = 0.06; rett(tx - i, 19 - i, 14 + i * 2, 3 + i * 2, col); }
  c.getContext('2d').globalAlpha = 1;
  rett(tx, 19, 14, 3, col); rett(tx + 1, 20, 12, 1, '#ffffff');
  return c;
}

// ── Cartellone al neon ──
function cartellone(testo, colTesto, colBordo) {
  const W = 112, H = 70, c = tela(W, H), { x, rett } = penna(c);
  rett(22, 40, 4, 30, '#1a0b24'); rett(W - 26, 40, 4, 30, '#1a0b24');
  rett(22, 40, 1, 30, '#4a2466'); rett(W - 26, 40, 1, 30, '#4a2466');
  rett(4, 4, W - 8, 40, '#12061c');
  x.strokeStyle = colBordo; x.lineWidth = 2; x.strokeRect(6, 6, W - 12, 36);
  rett(8, 8, W - 16, 1, '#ffffff33');
  x.font = '8px Arcade'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const righe = testo.split('\n');
  righe.forEach((t, i) => {
    const y = 24 + (i - (righe.length - 1) / 2) * 12;
    x.fillStyle = colTesto; x.fillText(t, W / 2, y + 1);
    x.fillStyle = '#ffffff'; x.globalAlpha = 0.55; x.fillText(t, W / 2, y); x.globalAlpha = 1;
  });
  return c;
}
function freccia(verso) {
  const W = 56, H = 44, c = tela(W, H), { rett, linea } = penna(c);
  rett(26, 26, 4, 18, '#1a0b24');
  rett(2, 2, W - 4, 26, '#140818'); rett(2, 2, W - 4, 2, '#ffcc33'); rett(2, 26, W - 4, 2, '#ffcc33');
  for (let k = 0; k < 3; k++) {
    const cx = W / 2 + (k - 1) * 14;
    for (let s = 0; s < 3; s++) {
      linea(cx + 5 * verso + s, 7, cx - 5 * verso + s, 15, '#ffb020');
      linea(cx - 5 * verso + s, 15, cx + 5 * verso + s, 23, '#ffb020');
    }
  }
  return c;
}

// ── Auto del traffico vista di coda ──
function autoTraffico(corpo, scuro, tetto) {
  const W = 64, H = 36, c = tela(W, H), { x, rett } = penna(c);
  x.globalAlpha = 0.45; rett(2, H - 4, W - 4, 4, '#000'); x.globalAlpha = 1;
  rett(5, H - 12, 9, 11, '#0b0710'); rett(W - 14, H - 12, 9, 11, '#0b0710');
  rett(3, 14, W - 6, 16, corpo); rett(3, 26, W - 6, 4, scuro);
  rett(10, 3, W - 20, 12, tetto); rett(12, 5, W - 24, 8, '#1a1030'); rett(13, 5, W - 26, 1, '#9a6bd8');
  rett(3, 14, W - 6, 1, '#ffffff66');
  rett(5, 18, 14, 4, '#ff2040'); rett(W - 19, 18, 14, 4, '#ff2040');
  rett(6, 19, 12, 1, '#ffb0b8'); rett(W - 18, 19, 12, 1, '#ffb0b8');
  rett(W / 2 - 7, 20, 14, 5, '#d8d4e8');
  return c;
}

export function creaSprite() {
  const S = {
    palme: [palma(11, 0.6), palma(29, -0.5), palma(57, 0.9), palma(83, -0.8)],
    lampSx: lampione(1, '#4ff0ff'), lampDx: lampione(-1, '#4ff0ff'),
    lampRosaSx: lampione(1, '#ff4fd8'), lampRosaDx: lampione(-1, '#ff4fd8'),
    cartelli: [cartellone('TRAMONTO', '#4ff0ff', '#ff3fb4'), cartellone('TURBO\n86', '#ffd23f', '#4ff0ff'),
      cartellone('NEON\nCITY', '#ff4fd8', '#ffd23f'), cartellone('RIVIERA', '#ffb020', '#ff3fb4')],
    frecciaSx: freccia(1), frecciaDx: freccia(-1),
    auto: [autoTraffico('#27c3d9', '#157282', '#1e9bb0'), autoTraffico('#f2c53d', '#9a7412', '#d8a822'),
      autoTraffico('#e8e4f4', '#8d88a8', '#c9c4dc'), autoTraffico('#8a4dff', '#4b2296', '#7440db')],
  };
  return S;
}

// ── L'auto del giocatore: spider rossa vista di coda, disegnata a rettangoli ogni fotogramma.
// lean -1..1 sposta gli strati a velocità diverse (parallasse) e scopre la fiancata: sembra girare.
export function disegnaAuto(x, cx, base, lean, frena, t, S = 1.5) {
  const R = (a, b, w, h, col) => {
    x.fillStyle = col; const X0 = Math.round(cx + a * S), Y0 = Math.round(base + b * S);
    x.fillRect(X0, Y0, Math.round(cx + (a + w) * S) - X0, Math.round(base + (b + h) * S) - Y0);
  };
  const l1 = lean * 2, l2 = lean * 3.5, l3 = lean * 5.5;
  // ombra sull'asfalto
  x.globalAlpha = 0.55; R(-58, -3, 116, 5, '#05000a'); R(-54, -5, 108, 2, '#05000a'); x.globalAlpha = 1;
  // ruote: sono il perno, non si spostano
  const ruota = a => {
    R(a, -18, 17, 18, '#0b0910'); R(a + 1, -17, 15, 1, '#3a3446');
    for (let k = 0; k < 4; k++) R(a + 2, -14 + k * 4 + ((t * 40 | 0) % 4 > 1 ? 1 : 0), 13, 1, '#231f2c');
  };
  ruota(-55); ruota(38);
  R(-38, -11, 76, 8, '#12060c');                               // sottoscocca in ombra
  // fiancata che la curva scopre
  if (lean > 0.08) { R(-53 + l1 - l3 * 1.3, -33, l3 * 1.3, 20, '#6e0812'); R(-53 + l1 - l3 * 1.3, -33, l3 * 1.3, 2, '#b8243a'); }
  if (lean < -0.08) { R(53 + l1, -33, -l3 * 1.3, 20, '#6e0812'); R(53 + l1, -33, -l3 * 1.3, 2, '#b8243a'); }
  // diffusore e scarichi
  R(-47 + l1, -15, 94, 6, '#2c0a12');
  for (const e of [-34, -26, 20, 28]) { R(e + l1, -12, 6, 4, '#c9c2d6'); R(e + 1 + l1, -11, 4, 2, '#140a18'); }
  // pannello posteriore largo sui fianchi, spigoli smussati
  R(-53 + l1, -30, 106, 16, '#c8122a');
  R(-51 + l1, -32, 102, 2, '#e0203a'); R(-49 + l1, -33, 98, 1, '#ff5a70');
  R(-53 + l1, -18, 106, 4, '#8a0a1a');
  R(-53 + l1, -30, 2, 14, '#ff4a60');                          // spigolo acceso dal tramonto
  R(51 + l1, -30, 2, 14, '#7a0616');
  // fanali a tutta larghezza: griglia nera a lamelle sopra la luce
  const luce = frena ? '#ff6070' : '#ff1c3a', nucleo = frena ? '#fff0f2' : '#ff9aa8';
  R(-47 + l1, -29, 94, 10, '#150308');
  for (let i = 0; i < 5; i++) {
    R(-46 + l1, -28 + i * 2, 31, 1, luce); R(15 + l1, -28 + i * 2, 31, 1, luce);
    R(-13 + l1, -28 + i * 2, 26, 1, '#3a0a14');
  }
  R(-44 + l1, -27, 27, 1, nucleo); R(17 + l1, -27, 27, 1, nucleo);
  // targa senza scritte
  R(-11 + l1, -18, 22, 6, '#1a0710'); R(-10 + l1, -17, 20, 4, '#e2dcea');
  // cofano motore con le feritoie, visto di taglio
  R(-47 + l2, -39, 94, 6, '#d4162e');
  R(-45 + l2, -40, 90, 1, '#ff8ea4');
  for (let k = 0; k < 3; k++) R(-30 + l2, -38 + k * 2, 60, 1, '#7c0816');
  // abitacolo: poggiatesta, teste, parabrezza, specchietti
  R(-31 + l3, -47, 16, 8, '#1c0810'); R(15 + l3, -47, 16, 8, '#1c0810');
  R(-30 + l3, -47, 14, 1, '#4a2030'); R(16 + l3, -47, 14, 1, '#4a2030');
  // lui: capelli scuri
  R(-29 + l3, -57, 12, 10, '#2c160c'); R(-28 + l3, -58, 10, 1, '#2c160c'); R(-27 + l3, -57, 5, 1, '#4a2a18');
  // lei: bionda, i capelli al vento
  const v = Math.sin(t * 14) > 0 ? 1 : 0, v2 = Math.sin(t * 9 + 1) > 0 ? 1 : 0;
  R(17 + l3, -57, 12, 10, '#f0c552'); R(18 + l3, -58, 10, 1, '#f0c552'); R(19 + l3, -57, 5, 1, '#fff0a0');
  R(29 + l3, -55 + v, 6, 4, '#e8bb48'); R(35 + l3, -53 - v, 5, 3, '#d9a83a'); R(40 + l3, -51 + v2, 4, 2, '#c99530');
  // parabrezza: cornice sottile davanti alle teste
  R(-41 + l3 * 1.2, -52, 82, 1, '#6a4a78'); R(-42 + l3 * 1.2, -52, 2, 12, '#4a3058'); R(40 + l3 * 1.2, -52, 2, 12, '#4a3058');
  R(-51 + l3, -46, 6, 3, '#a00c20'); R(45 + l3, -46, 6, 3, '#a00c20');
}
