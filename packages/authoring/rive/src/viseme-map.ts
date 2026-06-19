/**
 * ARKit viseme short names → Rive "lips sync id" state machine input index (0–9).
 *
 * 0 = idle / silence
 * 1 = AEI     (A, E, I)
 * 2 = BMP     (B, M, P)
 * 3 = FV      (F, V)
 * 4 = consonants (C, D, G, K, N, R, S, T, X, Y, Z)
 * 5 = U
 * 6 = ChJSh   (Ch, Sh, J)
 * 7 = L
 * 8 = O
 * 9 = QW      (Q, W)
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
