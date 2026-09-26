// Disposizione del villaggio (in tessere da 16 px): bosco tutto attorno, tre case con la piazza,
// il pozzo, il laghetto a est, il prato a sud con l'erba alta e i cespugli.
export function costruisciLuoghi(m) {
  const { rett, albero, gemelli, pino, casa, recinto, cesp, erba, fiore, sasso, ogg, blocca } = m;

  // ── il bosco che chiude la mappa ──
  for (let c = 0; c < 44; c += 4) gemelli(c, 0);
  for (let c = 2; c < 44; c += 4) gemelli(c, 29);
  blocca(0, 29, 43, 31);
  for (let r = 3; r < 29; r += 2) { pino(0, r); pino(42, r); }
  albero(2, 2, 'verde', true); albero(39, 2, 'verde', true);

  // ── sentieri ──
  rett(1, 4, 8, 13, 9);          // piazza davanti alle case
  rett(1, 8, 10, 9, 14);         // dalla piazza alla strada
  rett(1, 3, 15, 25, 16);        // la strada verso il lago
  rett(1, 16, 14, 17, 14);       // porta della terza casa
  rett(1, 11, 17, 12, 27);       // verso il prato a sud
  rett(1, 20, 5, 21, 14);        // verso il bosco a nord

  // ── acqua ──
  rett(2, 27, 12, 36, 21); rett(2, 29, 10, 34, 23); rett(2, 25, 14, 28, 19);

  // ── case, pozzo, recinti, orti ──
  casa(4, 5, 0); casa(10, 5, 12); casa(15, 11, 8);
  ogg('element', 7, 1, 1, 2, 22, 11); blocca(22, 12, 22, 12);
  m.OMBRE_POZZO = true;
  ogg('element', 4, 0, 1, 1, 14, 7); blocca(14, 7, 14, 7);      // botte
  ogg('element', 0, 1, 1, 1, 3, 7); blocca(3, 7, 3, 7);         // vaso
  ogg('element', 0, 0, 1, 1, 19, 13); blocca(19, 13, 19, 13);   // cassa
  recinto(3, 7, 13); recinto(10, 13, 13);
  for (const [c, r, k] of [[4, 11, 0], [5, 11, 2], [6, 11, 0], [4, 12, 1], [6, 12, 1], [5, 12, 0],
    [11, 11, 2], [12, 11, 0], [11, 12, 0], [12, 12, 2], [13, 11, 1], [13, 12, 0]]) fiore(c, r, k);
  albero(15, 5, 'rosa');
  albero(23, 6, 'autunno');

  // ── bosco a nord-est, oltre il lago ──
  albero(26, 3); albero(30, 4); albero(34, 3); albero(37, 6); albero(25, 8, 'verde');
  pino(33, 7); pino(29, 7);
  erba(36, 9, 40, 12); erba(31, 5, 33, 6);
  for (const [c, r] of [[28, 6], [32, 9], [35, 8], [24, 10], [38, 14]]) cesp(c, r);

  // ── est del lago ──
  albero(38, 16); albero(37, 21, 'autunno'); sasso(38, 12); sasso(37, 24, 4, 13);
  erba(38, 19, 40, 20);

  // ── prato a sud ──
  albero(14, 18); albero(3, 19); albero(13, 24, 'rosa'); albero(34, 25); albero(27, 25);
  for (const [c, r] of [[18, 17], [19, 17], [20, 17], [21, 18], [23, 18], [24, 19], [22, 20], [26, 21], [17, 19],
    [4, 17], [5, 17], [16, 21], [9, 19], [31, 24], [32, 24], [38, 26], [23, 26], [24, 27], [7, 27]]) cesp(c, r);
  erba(20, 19, 24, 21); erba(23, 21, 27, 24); erba(6, 21, 10, 25); erba(29, 26, 33, 28); erba(15, 26, 18, 28); erba(2, 23, 4, 27);
  for (const [c, r, k] of [[19, 19, 0], [19, 21, 1], [22, 22, 2], [15, 19, 0], [12, 21, 1], [3, 15, 2],
    [26, 13, 0], [24, 12, 1], [23, 13, 2], [24, 14, 0], [19, 14, 1], [14, 14, 0], [36, 22, 2], [18, 24, 0], [10, 17, 1], [28, 22, 0], [25, 22, 2]]) fiore(c, r, k);
  sasso(8, 18); sasso(25, 27); sasso(19, 25, 4, 13);
  ogg('nature', 4, 8, 1, 1, 6, 18); blocca(6, 18, 6, 18);       // ceppo
}
