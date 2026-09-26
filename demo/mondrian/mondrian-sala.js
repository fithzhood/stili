// La sala del museo: parete, luce del faretto, cornice a listello, ombra del quadro, didascalia.
import { mulberry } from './mondrian-trama.js?v=4';

/** Parete + cornice + ombra, in una tela in cache (si rifà a ogni resize). */
export function creaSala(W, H, dpr, X0, Y0, pw, ph) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  // parete calda, faretto dall'alto sul quadro
  g.fillStyle = '#cfcac0'; g.fillRect(0, 0, W, H);
  const cx = X0 + pw / 2;
  let gr = g.createRadialGradient(cx, Y0 - ph * 0.15, 10, cx, Y0 + ph * 0.35, Math.max(W, H) * 0.75);
  gr.addColorStop(0, '#f1ede5'); gr.addColorStop(0.45, '#dcd7ce'); gr.addColorStop(1, '#a9a49b');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // grana dell'intonaco
  const R = mulberry(5);
  for (let i = 0; i < W * H / 60; i++) {
    g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(60,50,40,0.04)';
    g.fillRect(R() * W, R() * H, 1 + R() * 1.5, 1 + R() * 1.5);
  }
  // zoccolo del pavimento, se c'è spazio
  const fondo = H - 10;
  gr = g.createLinearGradient(0, fondo - 30, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,30,20,0.18)');
  g.fillStyle = gr; g.fillRect(0, fondo - 30, W, 40);

  // cornice a listello, più grande della tela di un filo
  const m = Math.max(5, ph * 0.013);
  const fx = X0 - m, fy = Y0 - m, fw = pw + 2 * m, fh = ph + 2 * m;
  // ombra portata morbida (il faretto è in alto)
  g.save();
  g.shadowColor = 'rgba(40,30,20,0.42)'; g.shadowBlur = 38; g.shadowOffsetY = 22; g.shadowOffsetX = 6;
  g.fillStyle = '#e9e5dc'; g.fillRect(fx, fy, fw, fh);
  g.restore();
  g.save();
  g.shadowColor = 'rgba(40,30,20,0.35)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
  g.fillStyle = '#e9e5dc'; g.fillRect(fx, fy, fw, fh);
  g.restore();
  // legno del listello: luce in alto, ombra in basso
  gr = g.createLinearGradient(0, fy, 0, fy + fh);
  gr.addColorStop(0, '#f4f1ea'); gr.addColorStop(1, '#d6d1c6');
  g.fillStyle = gr; g.fillRect(fx, fy, fw, fh);
  g.strokeStyle = 'rgba(80,70,55,0.35)'; g.lineWidth = 1;
  g.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);
  // fessura scura fra listello e tela
  g.fillStyle = '#3b352c'; g.fillRect(X0 - 2, Y0 - 2, pw + 4, ph + 4);
  return c;
}

const NOMI = { '#cf2a1c': 'rosso', '#f2c616': 'giallo', '#1c3b91': 'blu', '#151414': 'nero', '#d4d1c7': 'grigio' };

/** Didascalia da museo, accanto al quadro. */
export function didascalia(g, x, y, w, Q, n, perse) {
  let righe;
  if (Q.tipo === 'boogie') {
    righe = [['b', `Broadway Boogie Woogie n. ${n}`], ['i', 'alla maniera di Piet Mondrian'], ['', 'olio su tela, 2026'], ['-'],
      ['', `quadratini rimasti: ${Q.rimasti()}`], ['', `palline perse: ${perse}`]];
  } else {
    const c = [...Q.colori()].map(k => NOMI[k]).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    const con = c.length ? 'con ' + (c.length > 1 ? c.slice(0, -1).join(', ') + ' e ' + c[c.length - 1] : c[0]) : 'in bianco e nero';
    righe = [['b', `Composizione n. ${n}`], ['i', con], ['', 'alla maniera di Piet Mondrian'], ['', 'olio su tela, 2026'], ['-'],
      ['', `rettangoli rimasti: ${Q.rimasti()}`], ['', `palline perse: ${perse}`]];
  }
  const lh = 17, h = righe.length * lh + 22;
  g.save();
  g.shadowColor = 'rgba(40,30,20,0.3)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.fillStyle = '#f7f5f0'; g.fillRect(x, y, w, h);
  g.restore();
  let yy = y + 22;
  for (const [t, s] of righe) {
    if (t === '-') { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x + 14, yy - 8, w - 28, 1); yy += 6; continue; }
    g.font = (t === 'b' ? '600 13px ' : t === 'i' ? 'italic 12.5px ' : '12px ') + '"Segoe UI", system-ui, sans-serif';
    g.fillStyle = t === 'b' ? '#1a1814' : '#4a463e';
    g.fillText(s, x + 14, yy);
    yy += lh;
  }
  return h;
}
