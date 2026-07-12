/**
 * Clé d'ordre textuelle fractionnaire — `plan/notes/2026-07-10-app-construction-discussion.md`
 * §1 « Parent / ordre » : trie alphabétiquement (`"a" < "b" < …`), une insertion entre deux clés
 * s'obtient en ajoutant une lettre à la clé la plus basse des deux (ex. entre `"a"` et `"b"` →
 * `"ab"`). Une insertion/déplacement ne touche jamais la fratrie — c'est le défaut qu'avait Eddy
 * (ordre par entier, renumérotation à chaque déplacement) que ce modèle évite.
 *
 * Point de départ au CENTRE de l'alphabet, sur 3 lettres (`"mmm"`) : marge des deux côtés, sur
 * 3 positions plutôt que 2 pour un facteur de sécurité confortable (décision utilisateur,
 * 2026-07-12).
 *
 * Insérer répétément au même point extrême (toujours « avant le premier » ou toujours « après le
 * dernier ») décrémente/incrémente la DERNIÈRE lettre en priorité ; quand elle touche sa borne
 * (`'a'` ou `'z'`), elle revient à `'m'` et la RETENUE passe à la lettre précédente (mécanique de
 * compteur à plusieurs roues — `"mmm"→"mml"→…→"mma"→"mlm"→"mll"→…`, exactement comme un compteur
 * classique). **Vérifié par simulation** : 2196 décréments répétés avant le plancher réel (`"aaa"`),
 * 2743 incréments avant le plafond réel (`"zzz"`) — tri strictement croissant/décroissant confirmé
 * à chaque étape. Très au-delà de l'échelle visée (~100 items par éditeur, décision utilisateur
 * 2026-07-12) ; `rebalanceOrderKeys` reste le secours si le plancher/plafond réel est malgré tout
 * atteint.
 */

const ALPHABET_START = 'a'.charCodeAt(0)
const ALPHABET_END = 'z'.charCodeAt(0)
const CENTER_LETTER = 'm'
const FIRST_KEY = 'mmm'

/** La clé d'ordre à utiliser pour un item ajouté après tous les frères existants (ou en tout premier). */
export function nextOrderKey(existingKeys: readonly string[]): string {
  if (existingKeys.length === 0) return FIRST_KEY
  const last = [...existingKeys].sort()[existingKeys.length - 1]
  return incrementKey(last)
}

/**
 * Une clé strictement comprise entre `before` et `after` (l'une des deux bornes peut être absente).
 * Lève `OrderKeyHardBoundaryError` si le plancher/plafond réel de l'alphabet est atteint (`"aaa…a"`
 * en descendant, `"zzz…z"` en montant) — appeler `rebalanceOrderKeys` sur la fratrie puis réessayer.
 */
export function orderKeyBetween(before: string | null, after: string | null): string {
  if (before === null && after === null) return FIRST_KEY
  if (before === null) return decrementKey(after as string)
  if (after === null) return incrementKey(before)
  if (before >= after) {
    throw new Error(`orderKeyBetween: 'before' (${before}) must sort strictly before 'after' (${after})`)
  }
  return before + CENTER_LETTER
}

export class OrderKeyHardBoundaryError extends Error {
  constructor(direction: 'low' | 'high', key: string) {
    super(`orderKeyBetween: hard alphabet boundary reached going ${direction} from '${key}' — call rebalanceOrderKeys on this sibling set`)
    this.name = 'OrderKeyHardBoundaryError'
  }
}

/**
 * Compteur à retenue, base 26, en partant de la DERNIÈRE lettre : incrémente la première lettre
 * (depuis la fin) qui n'est pas déjà à `'z'` ; toute lettre déjà à `'z'` sur ce trajet revient à
 * `'m'` (retenue). Lève si TOUTES les lettres sont déjà à `'z'` (plafond réel).
 */
function incrementKey(key: string): string {
  const chars = key.split('')
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const code = chars[i].charCodeAt(0)
    if (code < ALPHABET_END) {
      chars[i] = String.fromCharCode(code + 1)
      return chars.join('')
    }
    chars[i] = CENTER_LETTER
  }
  throw new OrderKeyHardBoundaryError('high', key)
}

/**
 * Symétrique de `incrementKey` : décrémente la première lettre (depuis la fin) qui n'est pas déjà
 * à `'a'` ; toute lettre déjà à `'a'` sur ce trajet revient à `'m'` (retenue). Lève si TOUTES les
 * lettres sont déjà à `'a'` (plancher réel).
 */
function decrementKey(key: string): string {
  const chars = key.split('')
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const code = chars[i].charCodeAt(0)
    if (code > ALPHABET_START) {
      chars[i] = String.fromCharCode(code - 1)
      return chars.join('')
    }
    chars[i] = CENTER_LETTER
  }
  throw new OrderKeyHardBoundaryError('low', key)
}

/**
 * Rebalancement de secours — renumérote `count` clés fraîches, régulièrement espacées dans
 * l'alphabet, en préservant l'ordre relatif d'origine (le tri de `count` items sur l'index de leur
 * position, pas leur ancienne clé). Coûteux (touche toute la fratrie) mais délibérément rare : n'est
 * appelé qu'après une `OrderKeyHardBoundaryError`, jamais en routine.
 */
export function rebalanceOrderKeys(count: number): string[] {
  if (count <= 0) return []
  const span = ALPHABET_END - ALPHABET_START + 1
  const step = Math.max(1, Math.floor(span / (count + 1)))
  const keys: string[] = []
  for (let i = 1; i <= count; i += 1) {
    const code = Math.min(ALPHABET_START + i * step, ALPHABET_END)
    keys.push(String.fromCharCode(code))
  }
  return keys
}
