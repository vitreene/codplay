/**
 * Mapping des noms courts de visèmes ARKit (tels que stockés dans le track CodPlay)
 * vers l'index numérique du state machine Rive "lips sync id" (0–9).
 *
 * Schéma des 10 états :
 *   0 = idle / silence
 *   1 = AEI     (A, E, I)
 *   2 = BMP     (B, M, P)
 *   3 = FV      (F, V)
 *   4 = consonnes (C, D, G, K, N, R, S, T, X, Y, Z)
 *   5 = U
 *   6 = ChJSh   (Ch, Sh, J)
 *   7 = L
 *   8 = O
 *   9 = QW      (Q, W)
 *
 * Note : le mapping 4/7/9 est une estimation — à valider en ouvrant le .riv dans l'éditeur.
 */
export const VISEME_TO_RIVE_ID: Record<string, number> = {
  PP: 2,
  FF: 3,
  TH: 4,
  DD: 4,
  kk: 4,
  CH: 6,
  SS: 4,
  nn: 7,
  RR: 4,
  aa: 1,
  E:  1,
  I:  1,
  O:  8,
  U:  5,
}
