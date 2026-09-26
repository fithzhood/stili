# Brief comune per chi costruisce le demo di "Stili"

Stai costruendo alcune demo di un sito-vetrina: **un catalogo di stili grafici per videogiochi,
2D e 3D**, fatto per mostrare all'utente (Luca) quanto in là si possono spingere le capacità
grafiche. Ogni demo è una piccola scena **interattiva** in uno stile riconoscibile al primo
sguardo. Il valore è tutto visivo: una demo che "funziona" ma ha l'aria di un esempio tecnico
(cubi grigi, primitive a caso, luce piatta) è un fallimento. Pensala come la schermata che
finisce nella copertina di un articolo sullo stile.

## Dove stai

- Progetto: `C:\Users\lfili\OneDrive\Documenti\app\Stili` (non è un repo git).
- **Tocca solo le cartelle `demo/<id>/` delle tue demo.** Non modificare `comune/`, `stili-data.js`,
  `vendor/`, `stili.html` né le demo degli altri: altri agenti lavorano in parallelo sugli stessi
  file condivisi. Se ti serve qualcosa nel guscio comune, scrivilo nel rapporto finale.
- Modello da copiare: `demo/_modello/_modello.html` + `_modello.js`. Per la demo `xyz` crei
  `demo/xyz/xyz.html` e `demo/xyz/xyz.js` (nomi uguali all'id, mai `index.html`), con
  `<body data-demo="xyz">`. Tieni l'ordine degli script del modello (stili-data → comune → modulo).
- three.js r186 è in `vendor/three/` con **tutti** gli addons (`three/addons/...` nell'import map).
  Niente CDN: tutto locale. Se ti serve un'altra libreria, mettila in `demo/<id>/lib/`.
- Più moduli JS per demo vanno bene, ma gli import relativi fra i tuoi moduli devono portare
  `?v=1` (es. `import { x } from './mare.js?v=1'`), come il `<script>` nell'HTML.
- Niente audio.

## Il guscio comune (`window.Demo`, già caricato prima del tuo modulo)

- `Demo.loop((dt, t) => { ... })` — il tuo ciclo per fotogramma. **Usa `t` e `dt` di Demo, mai
  `performance.now()`/`Date.now()`** per animare: serve perché le foto in headless siano possibili.
- `Demo.pronto()` — chiamalo quando la scena è caricata (toglie il velo di caricamento).
- `Demo.carica('Carico i modelli', 0.4)` — testo del caricamento.
- `Demo.asse()` → `{x, y}` da WASD/frecce/croce/stick sinistro (y+ = avanti/su), analogico col pad.
- `Demo.guarda()` → `{x, y}` stick destro del pad: sommalo al mouse per la visuale.
- `Demo.giu(k)` / `Demo.premuto(k)` — tasto tenuto / appena premuto (`' '`, `'Shift'`, `'e'`, `'ArrowLeft'`...).
  Il pad è già mappato su tasti virtuali: **A = `' '`**, B = `'x'`, X = `'r'`, Y = `'h'`, LB = `'q'`,
  RB = `'e'`, croce = frecce. `Demo.pad` ha anche `lt`/`rt` (grilletti 0..1). Start apre la scheda
  informativa, Back torna alla galleria: non usarli.
- Tasti riservati dal guscio: `i` (scheda), `Esc` (chiude scheda), `Shift+F` (fps). Non usarli per altro.
- `Demo.extra(html)` — righe in più nella scheda "come è fatto" (per esempio una legenda).
- `Demo.errore(e)` — mostra un errore leggibile invece di una pagina nera (gli errori non catturati
  ci finiscono da soli).
- `Demo.shot` è `true` in modalità foto. Il renderer WebGL va creato con
  `preserveDrawingBuffer: Demo.shot`, altrimenti la foto esce nera.

## Solo PC

Si gioca **su PC con tastiera e mouse** (e joypad). Il telefono non interessa: puoi usare effetti
pesanti. Obiettivo 60 fps a 1920×1080 su un PC di fascia media; se un effetto costa troppo, rendi
a risoluzione ridotta e scala (o limita `setPixelRatio`). Visuale col mouse: pointer lock al clic,
`Esc` lo rilascia; oppure trascinamento (OrbitControls), a seconda di cosa è più naturale.
Gestisci il `resize`.

## Asset

Libreria locale, tutta a licenza libera: `C:\Users\lfili\OneDrive\Documenti\app\assets`
(indice in `assets\LEGGIMI.md`, crediti in `assets\LICENZE.md`). Famiglie utili: `21-3d-kenney` e
`22-3d-quaternius` (modelli .glb/.fbx, molti personaggi riggati e animati), `23-hdri-ambienti`
(HDRI 2K), `24-materiali-pbr` (1K), `04-pixel-platformer`, `15-pixel-sideview-fantasy`,
`18-pixel-cartoon`, `19-topdown-rpg-ninja`, `16-disegnato-a-mano`, `11-font`, `09-effetti-e-sfondi`.
**Copia** i file che usi dentro `demo/<id>/assets/` (niente percorsi esterni), tieni le texture
≤ 1024 px e la cartella della demo sotto ~8 MB (la demo fotorealistica può arrivare a ~25 MB).
Scrivi i crediti in `demo/<id>/CREDITI.md`. Puoi anche generare tutto proceduralmente: spesso è
la scelta migliore per uno stile. Blender portatile c'è
(`C:\Users\lfili\dev\blender\blender-5.2.1-windows-x64\blender.exe -b --python script.py`) se
ti serve modellare o cuocere qualcosa; in headless EEVEE rende vuoto, usa CYCLES o WORKBENCH.
Uno stile, una famiglia di asset: non mescolare famiglie che stonano.

## Come si collauda (NON usare il pannello del browser: è condiviso con gli altri agenti)

Il server di sviluppo gira su `http://127.0.0.1:8340` (senza cache). Se non risponde
(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8340/stili-data.js`), avvialo in
sottofondo: `python servi.py 8340` dalla radice del progetto.

Foto di una demo in Chrome headless (GPU vera, ~3 s):

```
python strumenti/scatta.py <id> [uscita.png] [--frames N] [--size 1280x720] [--q "tieni=w,d&altro=1"]
```

- Stampa `TITOLO: SHOT-READY` se la demo è arrivata a `Demo.pronto()`, oppure `TITOLO: ERRORE: ...`
  con lo stack. Poi guardi la foto con lo strumento Read (è un'immagine).
- `--frames N`: quanti fotogrammi da 1/60 s simulare dopo `pronto()` (predefinito 90).
- `tieni=w,ArrowLeft,spazio` nella `--q` tiene premuti quei tasti per tutti i fotogrammi: così
  verifichi che il movimento funzioni davvero (foto prima e dopo, il personaggio deve essersi mosso).
- Puoi leggere altri parametri tuoi da `Demo.query` (es. `cam=2` per inquadrature di prova, `ora=0.8`).
- La foto **senza parametri, a 1280×720, con 90 fotogrammi** diventa l'anteprima nella galleria:
  deve essere una bella inquadratura rappresentativa, con il soggetto in vista.

Guarda davvero le foto, più volte, a più inquadrature e momenti, e correggi. Metti la tua demo
mentalmente accanto al riferimento dichiarato (il gioco o l'artista): chi guarda deve riconoscere
lo stile senza leggere il titolo. Chiediti anche se la descrizione nel registro (sotto) è
**mantenuta** dal codice: se la descrizione promette la schiuma sul mare, la schiuma ci deve essere.
Tieni le foto di prova in `anteprime/_prove/` con nomi tuoi (es. `cel-2.png`).

## Rapporto finale (breve)

Per ogni demo: file creati; asset usati e licenza; **testo `tecnica` e `controlli` corretti** per il
registro (italiano, stesso tono e lunghezza di quelli sotto, se quelli attuali non corrispondono più
a quello che hai fatto); limiti noti; cosa ti servirebbe nel guscio comune. Niente altro.
