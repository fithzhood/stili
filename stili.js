// Galleria: griglia di anteprime, filtri 2D/3D, navigazione da tastiera e da joypad.
(function () {
  'use strict';
  const VER = ((document.currentScript && document.currentScript.src || '').match(/\?v=\d+/) || [''])[0];
  const VERSIONE = (VER.match(/\d+/) || ['dev'])[0];
  const lista = window.STILI;
  const griglia = document.getElementById('griglia');
  document.getElementById('ver').textContent = 'v' + VERSIONE;
  document.getElementById('conta').textContent = ({20:'Venti',21:'Ventuno',22:'Ventidue',23:'Ventitré',24:'Ventiquattro',25:'Venticinque',26:'Ventisei',27:'Ventisette',28:'Ventotto',29:'Ventinove',30:'Trenta'})[lista.length] || lista.length;

  const carte = lista.map((s, i) => {
    const a = document.createElement('a');
    a.className = 'carta';
    a.href = `demo/${s.id}/${s.id}.html`;
    a.dataset.dim = s.dim;
    a.innerHTML = `
      <div class="quadro">
        <img alt="" loading="lazy" src="anteprime/${s.id}.jpg?v=${VERSIONE}">
        <span class="dim">${s.dim}</span>
        <div class="desc">${s.descrizione}${s.asset ? `<em>Già pronti: ${s.asset}.</em>` : ''}</div>
      </div>
      <div class="didascalia">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <div><h2>${s.titolo}</h2><p>${s.ispirazione}</p>
          <span class="orig ${s.asset ? 'pronti' : 'codice'}" title="${s.asset ? 'Già pronti: ' + s.asset : 'Nessun asset esterno'}">${s.asset ? 'Con asset già pronti' : 'Tutto disegnato dal codice'}</span></div>
      </div>`;
    const img = a.querySelector('img');
    img.onerror = () => { img.remove(); a.querySelector('.quadro').insertAdjacentHTML('afterbegin', `<div class="vuoto">${s.titolo}</div>`); };
    griglia.append(a);
    return a;
  });

  // ── Filtri ──
  const bott = [...document.querySelectorAll('#filtri button')];
  bott.forEach(b => {
    const f = b.dataset.f;
    b.querySelector('i').textContent = f === 'tutti' ? lista.length : lista.filter(s => s.dim === f).length;
    b.onclick = () => filtra(f);
  });
  function filtra(f) {
    bott.forEach(b => b.classList.toggle('on', b.dataset.f === f));
    carte.forEach(c => c.classList.toggle('nascosta', f !== 'tutti' && c.dataset.dim !== f));
    try { sessionStorage.setItem('stili-filtro', f); } catch (e) {}
  }
  try { const f = sessionStorage.getItem('stili-filtro'); if (f) filtra(f); } catch (e) {}

  // ── Navigazione a griglia (frecce / croce del pad) ──
  const visibili = () => carte.filter(c => !c.classList.contains('nascosta'));
  function colonne() {
    const v = visibili(); if (v.length < 2) return 1;
    const y0 = v[0].offsetTop; let n = 0;
    for (const c of v) { if (c.offsetTop !== y0) break; n++; }
    return n;
  }
  function muovi(dx, dy) {
    const v = visibili(); if (!v.length) return;
    let i = v.indexOf(document.activeElement);
    if (i < 0) { v[0].focus(); return; }
    i = Math.max(0, Math.min(v.length - 1, i + dx + dy * colonne()));
    v[i].focus(); v[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  addEventListener('keydown', e => {
    const m = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (m) { e.preventDefault(); muovi(...m); }
  });

  // Joypad: croce/stick per spostarsi, A per aprire, LB/RB per i filtri
  const ordineFiltri = ['tutti', '3D', '2D'];
  let prima = {}, ripeti = 0;
  function pad() {
    const p = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(g => g && g.connected);
    if (p) {
      const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const dir = b(15) || ax > .6 ? [1, 0] : b(14) || ax < -.6 ? [-1, 0] : b(13) || ay > .6 ? [0, 1] : b(12) || ay < -.6 ? [0, -1] : null;
      if (dir) { if (ripeti-- <= 0) { muovi(...dir); ripeti = prima.dir ? 8 : 20; } } else ripeti = 0;
      if (b(0) && !prima.a && document.activeElement.classList.contains('carta')) document.activeElement.click();
      const f = ordineFiltri.indexOf(bott.find(x => x.classList.contains('on')).dataset.f);
      if (b(5) && !prima.rb) filtra(ordineFiltri[(f + 1) % 3]);
      if (b(4) && !prima.lb) filtra(ordineFiltri[(f + 2) % 3]);
      prima = { dir: !!dir, a: b(0), rb: b(5), lb: b(4) };
    }
    requestAnimationFrame(pad);
  }
  requestAnimationFrame(pad);
})();
