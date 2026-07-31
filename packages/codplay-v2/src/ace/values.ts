/**
 * Décomposition et recomposition de valeurs, extrait d'anime.js 4.5.0 (MIT, © Julian Garnier).
 *
 * C'est la facilité centrale du chantier : **porter une valeur d'auteur avec son unité**,
 * sans la convertir vers le substrat. `-8.62cqw` entre, se décompose en `{ number: -8.62,
 * unit: 'cqw' }`, s'interpole avec une borne de même unité, et ressort avec son unité. Aucune
 * résolution vers un substrat n'a lieu ici — c'est le travail de l'étage de projection.
 *
 * Divergences assumées :
 *
 * 1. **Objets immuables et champs nommés.** L'original mute en place des objets réutilisés
 *    aux champs d'une lettre (`{t,n,u,o,d,s}`) pour éviter les allocations, la décomposition
 *    ayant lieu à chaque image. Ici elle a lieu **à la préparation**, hors chemin chaud : la
 *    contrainte tombe, la lisibilité prime.
 * 2. **Les couleurs sont normalisées avant ACE.** Cette décomposition les signale pour empêcher
 *    qu'une chaîne CSS couleur soit traitée comme une chaîne composée ordinaire.
 */

/** Ce qu'une valeur d'auteur peut être, une fois reconnue. */
export type ValueKind =
  /** Un nombre nu : `42`, `'42'`. */
  | 'number'
  /** Un nombre et son unité : `'12cqw'`, `'-8.62%'`, `'1.5rem'`. */
  | 'unit'
  /** Une couleur : `#fff`, `rgb()`, `rgba()`, `hsl()` ou `hsla()`. */
  | 'color'
  /** Une chaîne mêlant nombres et texte : `'blur(5px) saturate(2)'`, coordonnées, `calc()`. */
  | 'complex'

/** Opérateur relatif : la valeur se calcule à partir de la précédente. */
export type RelativeOperator = '+' | '-' | '*'

/** Numeric value kept apart from its author unit until the render boundary. */
export type UnitValue = {
  number: number
  unit: string | null
}

/**
 * Une valeur d'auteur décomposée.
 *
 * `numbers` et `strings` ne sont renseignés que pour le type `complex` : les nombres extraits
 * et les fragments de texte qui les séparent, dans l'ordre, de sorte que la chaîne se
 * reconstruise en les entrelaçant.
 */
export type DecomposedValue = UnitValue & {
  kind: ValueKind
  /** L'opérateur relatif si la valeur en portait un (`'+=8'`) ; `null` sinon. */
  operator: RelativeOperator | null
  /** Les nombres extraits, pour `complex`. */
  numbers: number[] | null
  /** Les fragments de texte, pour `complex`. */
  strings: string[] | null
}

/** Nombre suivi d'une unité, éventuellement en notation exponentielle. */
const UNIT_PATTERN = /^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)([a-z]+|%)$/i

/** Nombres en notation décimale ou exponentielle, pour découper une valeur complexe. */
const NUMBER_PATTERN = /[-+]?\d*\.?\d+(?:e[-+]?\d+)?/g

/** Formes de couleur reconnues : `#rgb`, `#rrggbb`, `rgb()`, `rgba()`, `hsl()`, `hsla()`. */
const COLOR_PATTERN = /^(#|rgb|hsl)/i

const emptyDecomposed = (): DecomposedValue => ({
  kind: 'number',
  number: 0,
  unit: null,
  operator: null,
  numbers: null,
  strings: null,
})

/**
 * Décompose une valeur d'auteur.
 *
 * Aucune validation par propriété : `-8.62cqw` est une valeur à unité, point. C'est
 * précisément ce qui permet d'accepter les longueurs relatives négatives et les nombres nus
 * que les grammaires CSS par propriété rejettent.
 *
 * @example
 * decompose('-8.62cqw')          // { kind: 'unit', number: -8.62, unit: 'cqw' }
 * decompose(42)                  // { kind: 'number', number: 42 }
 * decompose('+=10')              // { kind: 'number', number: 10, operator: '+' }
 * decompose('blur(5px)')         // { kind: 'complex', numbers: [5], strings: ['blur(', 'px)'] }
 */
export const decompose = (rawValue: number | string | null | undefined): DecomposedValue => {
  const decomposed = emptyDecomposed()
  if (rawValue === null || rawValue === undefined || rawValue === '') return decomposed

  const asNumber = +rawValue
  if (!Number.isNaN(asNumber)) {
    decomposed.number = asNumber
    return decomposed
  }

  let str = String(rawValue)

  // Opérateur relatif en tête : '+=', '-=', '*='
  if (str[1] === '=') {
    decomposed.operator = str[0] as RelativeOperator
    str = str.slice(2)
  }

  // Une valeur complexe contient des espaces ; l'écarter tôt évite un retour arrière coûteux
  // du motif d'unité.
  const unitMatch = str.includes(' ') ? null : UNIT_PATTERN.exec(str)
  if (unitMatch) {
    decomposed.kind = 'unit'
    decomposed.number = +unitMatch[1]
    decomposed.unit = unitMatch[2]
    return decomposed
  }

  if (decomposed.operator) {
    decomposed.number = +str
    return decomposed
  }

  if (COLOR_PATTERN.test(str)) {
    decomposed.kind = 'color'
    return decomposed
  }

  decomposed.kind = 'complex'
  decomposed.numbers = (str.match(NUMBER_PATTERN) ?? []).map(Number)
  decomposed.strings = str.split(NUMBER_PATTERN)
  return decomposed
}

/**
 * Applique un opérateur relatif : `'+=10'` sur une base de 5 donne 15.
 */
export const applyRelative = (
  base: number,
  value: number,
  operator: RelativeOperator,
): number => (operator === '-' ? base - value : operator === '+' ? base + value : base * value)

/**
 * Interpolation affine.
 *
 * Les bornes sont traitées explicitement : `from + (to - from) * progress` ne retombe pas
 * exactement sur `to` à 1 (`-8.62 → 12` donne `11.999999999999998`). Sans étape de calage
 * final — et il n'y en a pas quand l'état se lit comme une fonction du temps — une lecture
 * à la fin rendrait une valeur fausse.
 */
export const lerp = (from: number, to: number, progress: number): number =>
  progress === 1 ? to : progress === 0 ? from : from + (to - from) * progress

/**
 * Arrondit à un nombre de décimales. Un `decimals` négatif laisse la valeur intacte —
 * convention de l'original, employée pour éviter tout arrondi sur les cibles qui consomment
 * des nombres bruts.
 */
export const round = (value: number, decimals: number): number => {
  if (decimals < 0) return value
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Recompose une valeur à partir de sa forme et d'une part numérique interpolée.
 *
 * Pour `unit`, recolle l'unité. Pour `number`, rend le nombre. Le cas `complex` passe par
 * {@link composeComplex}, qui a besoin des deux extrémités.
 */
export const compose = (kind: ValueKind, number: number, unit: string | null): number | string =>
  kind === 'unit' ? `${number}${unit}` : number

/**
 * Recompose une valeur complexe en interpolant chacun de ses nombres et en les entrelaçant
 * avec les fragments de texte.
 *
 * Les deux extrémités doivent avoir la même structure — même quantité de nombres, mêmes
 * fragments — faute de quoi le résultat n'a pas de sens.
 */
export const composeComplex = (
  from: DecomposedValue,
  to: DecomposedValue,
  progress: number,
  precision: number,
): string => {
  const fromNumbers = from.numbers ?? []
  const toNumbers = to.numbers ?? []
  const strings = to.strings ?? []
  let out = strings[0] ?? ''
  for (let i = 0, l = toNumbers.length; i < l; i++) {
    const n = round(lerp(fromNumbers[i], toNumbers[i], progress), precision)
    const s = strings[i + 1]
    out += s ? `${n}${s}` : `${n}`
  }
  return out
}
