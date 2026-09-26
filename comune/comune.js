// Guscio comune di ogni demo: barra in alto, scheda della tecnica, caricamento,
// tastiera, orologio pilotabile (per le foto in headless) e numero di versione.
// Script classico: espone window.Demo. Va caricato DOPO stili-data.js.
(function () {
  'use strict';
  const VER = ((document.currentScript && document.currentScript.src || '').match(/\?v=\d+/) || [''])[0];
  const VERSIONE = (VER.match(/\d+/) || ['dev'])[0];
  const Q = new URLSearchParams(location.search);
  const SHOT = Q.has('shot');                 // modalità foto: niente rAF, fotogrammi a mano
  const SHOT_FRAMES = parseInt(Q.get('shot') || '0', 10) || 90;

  const id = document.body.dataset.demo;
  const info = (window.STILI || []).find(s => s.id === id) || { titolo: id, dim: '', ispirazione: '', descrizione: '', tecnica: '', controlli: '' };
  const lista = window.STILI || [];
  const idx = lista.indexOf(info);

  // ── HUD ──
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const hud = el('div', 'dm-hud');
  const back = el('a', 'dm-back', '<span>←</span> Galleria'); back.href = '../../stili.html';
  const tit = el('div', 'dm-tit', `<b>${info.titolo}</b><i>${info.dim}</i>`);
  const nav = el('div', 'dm-nav');
  const prev = lista[(idx - 1 + lista.length) % lista.length], next = lista[(idx + 1) % lista.length];
  if (idx >= 0) {
    const a1 = el('a', 'dm-btn', '‹'); a1.href = `../${prev.id}/${prev.id}.html`; a1.title = prev.titolo;
    const a2 = el('a', 'dm-btn', '›'); a2.href = `../${next.id}/${next.id}.html`; a2.title = next.titolo;
    nav.append(a1, a2);
  }
  const bInfo = el('button', 'dm-btn', 'i'); bInfo.title = 'Come è fatto (I)';
  nav.append(bInfo);
  hud.append(back, tit, nav);

  const scheda = el('div', 'dm-scheda');
  scheda.innerHTML = `
    <div class="dm-sk-ispi">${info.ispirazione}</div>
    <p>${info.descrizione}</p>
    <h4>Come è fatto</h4><p>${info.tecnica}</p>
    <h4>Comandi</h4><p class="dm-sk-cmd">${info.controlli}</p>
    <div class="dm-sk-extra"></div>`;
  const cmd = el('div', 'dm-cmd', info.controlli);
  const ver = el('div', 'dm-ver', 'v' + VERSIONE);
  const fps = el('div', 'dm-fps', '');
  const load = el('div', 'dm-load', '<div class="dm-spin"></div><div class="dm-load-t">Carico…</div>');

  function monta() {
    document.body.append(hud, scheda, cmd, ver, fps, load);
    if (SHOT) document.body.classList.add('dm-shot');
  }
  if (document.body) monta(); else addEventListener('DOMContentLoaded', monta);

  let schedaAperta = false;
  const toggleScheda = (v) => { schedaAperta = v == null ? !schedaAperta : v; scheda.classList.toggle('on', schedaAperta); };
  bInfo.onclick = () => toggleScheda();
  // la scheda si apre da sola la prima volta che si entra in una demo, per 5 s
  setTimeout(() => { cmd.classList.add('off'); }, 6000);

  // ── Tastiera ──
  const giu = new Set(), premuti = new Set();
  addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!giu.has(k)) premuti.add(k);
    giu.add(k);
    if (k === 'i' && !e.ctrlKey) toggleScheda();
    if (k === 'Escape') toggleScheda(false);
    if (k === 'f' && e.shiftKey) fps.classList.toggle('on');
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  });
  addEventListener('keyup', e => giu.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  addEventListener('blur', () => giu.clear());

  // ── Joypad (Gamepad API, mappatura standard) ──
  // I pulsanti diventano tasti virtuali, così una demo che legge la tastiera funziona
  // anche col pad senza scrivere nulla: A=spazio, B=x, X=r, Y=h, LB=q, RB=e, croce=frecce.
  const PAD_TASTI = { 0: ' ', 1: 'x', 2: 'r', 3: 'h', 4: 'q', 5: 'e', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
  const padGiu = new Set();
  const pad = { connesso: false, sx: { x: 0, y: 0 }, dx: { x: 0, y: 0 }, lt: 0, rt: 0 };
  const zm = v => Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85;   // zona morta
  function leggiPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let p = null;
    for (const g of pads) if (g && g.connected) { p = g; break; }
    pad.connesso = !!p;
    if (!p) { for (const k of padGiu) giu.delete(k); padGiu.clear(); return; }
    const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
    for (const [i, k] of Object.entries(PAD_TASTI)) {
      if (b(+i)) { if (!padGiu.has(k)) { padGiu.add(k); if (!giu.has(k)) premuti.add(k); giu.add(k); } }
      else if (padGiu.has(k)) { padGiu.delete(k); giu.delete(k); }
    }
    if (b(9) && !padGiu.has('#start')) { padGiu.add('#start'); toggleScheda(); } else if (!b(9)) padGiu.delete('#start');
    if (b(8)) location.href = back.href;
    pad.sx.x = zm(p.axes[0] || 0); pad.sx.y = -zm(p.axes[1] || 0);
    pad.dx.x = zm(p.axes[2] || 0); pad.dx.y = -zm(p.axes[3] || 0);
    pad.lt = p.buttons[6] ? p.buttons[6].value : 0; pad.rt = p.buttons[7] ? p.buttons[7].value : 0;
  }

  // ── Orologio e ciclo ──
  let cb = null, t = 0, avviato = false, ultimo = 0, nf = 0, accF = 0, accT = 0;
  function passo(dt) {
    t += dt;
    if (!SHOT) leggiPad();
    if (cb) cb(dt, t);
    premuti.clear();
  }
  function rafLoop(now) {
    const dt = Math.min(0.05, (now - ultimo) / 1000 || 0);
    ultimo = now;
    passo(dt);
    accF++; accT += dt;
    if (accT > 0.5) { fps.textContent = Math.round(accF / accT) + ' fps'; accF = 0; accT = 0; }
    requestAnimationFrame(rafLoop);
  }

  const Demo = {
    info, versione: VERSIONE, shot: SHOT, query: Q,
    /** Registra la funzione per fotogramma: fn(dt, t). dt in secondi, t tempo della demo. */
    loop(fn) {
      cb = fn;
      if (SHOT || avviato) return;
      avviato = true;
      ultimo = performance.now();
      requestAnimationFrame(rafLoop);
    },
    /** Tasto tenuto giù ('w', 'ArrowLeft', ' ', 'Shift'...). */
    giu: k => giu.has(k),
    /** Tasto appena premuto in questo fotogramma. */
    premuto: k => premuti.has(k),
    /** Asse di movimento da WASD + frecce + croce + stick sinistro: {x: -1..1 (destra +), y: -1..1 (avanti/su +)}. Analogico col pad. */
    asse() {
      let x = (giu.has('d') || giu.has('ArrowRight') ? 1 : 0) - (giu.has('a') || giu.has('ArrowLeft') ? 1 : 0);
      let y = (giu.has('w') || giu.has('ArrowUp') ? 1 : 0) - (giu.has('s') || giu.has('ArrowDown') ? 1 : 0);
      if (!x) x = pad.sx.x; if (!y) y = pad.sx.y;
      return { x, y };
    },
    /** Asse della visuale dallo stick destro: {x, y} -1..1 (0 senza pad). Le demo lo sommano al mouse. */
    guarda() { return { x: pad.dx.x, y: pad.dx.y }; },
    /** Stato grezzo del pad: {connesso, sx, dx, lt, rt}. */
    pad,
    /** Testo del caricamento (0..1 opzionale). */
    carica(msg, frac) {
      load.querySelector('.dm-load-t').textContent = msg + (frac != null ? ` ${Math.round(frac * 100)}%` : '');
    },
    /** Da chiamare quando la scena è pronta. In modalità foto avanza SHOT_FRAMES fotogrammi e segnala. */
    pronto() {
      load.classList.add('off');
      if (SHOT) {
        // ?tieni=w,ArrowLeft,  → quei tasti restano giù per tutti i fotogrammi della foto
        const tieni = (Q.get('tieni') || '').split(',').filter(Boolean).map(k => k === 'spazio' ? ' ' : k);
        tieni.forEach(k => { giu.add(k); premuti.add(k); });
        for (let i = 0; i < SHOT_FRAMES; i++) passo(1 / 60);
        tieni.forEach(k => giu.delete(k));
        document.title = 'SHOT-READY';
        window.__shotReady = true;
        // Chrome headless fotografa solo ciò che è stato disegnato in un fotogramma composto:
        // si ridisegna a tempo fermo (dt = 0) finché la foto non viene scattata.
        const ferma = () => { if (cb) cb(0, t); requestAnimationFrame(ferma); };
        requestAnimationFrame(ferma);
      }
    },
    /** Aggiunge righe alla scheda "come è fatto" (HTML). */
    extra(html) { scheda.querySelector('.dm-sk-extra').innerHTML = html; },
    /** Mostra un messaggio d'errore leggibile invece di una pagina nera. */
    errore(e) {
      console.error(e);
      document.title = 'ERRORE: ' + (e && (e.stack || e.message) || e);
      load.classList.remove('off');
      load.querySelector('.dm-spin').style.display = 'none';
      load.querySelector('.dm-load-t').textContent = 'Errore: ' + (e && e.message || e);
    },
  };
  // Avanzamento manuale per il collaudo: __frame(n, dt)
  window.__frame = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) passo(dt); return t; };
  addEventListener('error', e => Demo.errore(e.error || e.message));
  addEventListener('unhandledrejection', e => Demo.errore(e.reason));
  window.Demo = Demo;
})();
