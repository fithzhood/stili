// Vetrata gotica: la finestra si taglia al caricamento (cartone → tessere → texture),
// poi un solo shader fa parete, finestra, pavimento, luce proiettata e raggi nel pulviscolo.
import { creaCartone, TW, TH } from './vetrata-disegno.js?v=6';
import { tagliaVetro } from './vetrata-vetro.js?v=6';

Demo.carica('Taglio il vetro', 0.1);
await new Promise(r => setTimeout(r, 30));
const cartone = creaCartone();
const vetro = tagliaVetro(cartone);
const Q = Demo.query;

if (Q.get('cartone')) {
  // collaudo: la texture del vetro com'è, su sfondo chiaro
  const cv = document.createElement('canvas'); cv.width = TW * 2; cv.height = TH;
  cv.style.cssText = 'position:fixed;inset:0;height:100%;background:#eee';
  document.body.prepend(cv);
  const g = cv.getContext('2d');
  const img = g.createImageData(TW, TH);
  for (let i = 0; i < TW * TH * 4; i += 4) {
    img.data[i] = vetro.col[i]; img.data[i + 1] = vetro.col[i + 1]; img.data[i + 2] = vetro.col[i + 2];
    img.data[i + 3] = 255;
    if (vetro.aux[i + 3] > 128) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 90 + vetro.aux[i] * 0.3; }
  }
  g.putImageData(img, 0, 0);
  g.drawImage(cartone.cP, TW, 0);
  Demo.loop(() => {});
  Demo.pronto();
} else {
  const { avvia } = await import('./vetrata-scena.js?v=6');
  avvia(vetro);
}
