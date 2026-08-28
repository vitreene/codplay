/**
 * Catalogue de courbes d'easing, extrait d'anime.js 4.5.0 (MIT, © Julian Garnier),
 * lui-même adapté des fonctions de Robert Penner (© 2001).
 *
 * Les mathématiques sont conservées à l'identique. Trois divergences assumées, signalées
 * chacune à son emplacement : la résolution d'un nom inconnu, le déterminisme d'`irregular`,
 * et l'absence des avertissements de dépréciation.
 */

/** Une courbe : progression 0→1 en entrée, valeur en sortie. Peut sortir de [0,1]. */
export type EasingFunction = (t: number) => number

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value

/** Identité — ni accélération ni ralentissement. */
export const none: EasingFunction = (t) => t

// ---------------------------------------------------------------------------
// Courbes de base, exprimées en « in » — les autres régimes en dérivent
// ---------------------------------------------------------------------------

/** Puissance paramétrable : `t^exponent`. */
export const power = (exponent: number | string = 1.68): EasingFunction => {
  const p = +exponent
  return (t) => Math.pow(t, p)
}

const HALF_PI = Math.PI / 2
const DOUBLE_PI = Math.PI * 2

const inSine: EasingFunction = (t) => 1 - Math.cos(t * HALF_PI)
const inCirc: EasingFunction = (t) => 1 - Math.sqrt(1 - t * t)
const inExpo: EasingFunction = (t) => (t ? Math.pow(2, 10 * t - 10) : 0)

/** Rebonds successifs d'amplitude décroissante. */
const inBounce: EasingFunction = (t) => {
  let pow2: number
  let b = 4
  while (t < ((pow2 = Math.pow(2, --b)) - 1) / 11);
  return 1 / Math.pow(4, 3 - b) - 7.5625 * Math.pow((pow2 * 3 - 2) / 22 - t, 2)
}

/** Dépassement avant retour. `overshoot` règle l'ampleur du dépassement. */
export const back = (overshoot: number | string = 1.7): EasingFunction => {
  const o = +overshoot
  return (t) => (o + 1) * t * t * t - o * t * t
}

/** Oscillation amortie. `amplitude` borné à [1,10], `period` à ]0,2]. */
export const elastic = (
  amplitude: number | string = 1,
  period: number | string = 0.3,
): EasingFunction => {
  const a = clamp(+amplitude, 1, 10)
  const p = clamp(+period, 1e-11, 2)
  const s = (p / DOUBLE_PI) * Math.asin(1 / a)
  const e = DOUBLE_PI / p
  return (t) =>
    t === 0 || t === 1 ? t : -a * Math.pow(2, -10 * (1 - t)) * Math.sin((1 - t - s) * e)
}

// ---------------------------------------------------------------------------
// Régimes — transforment une courbe « in » en ses trois autres formes
// ---------------------------------------------------------------------------

/** Les quatre régimes d'application d'une courbe de base. */
export const easeTypes = {
  in: (easeIn: EasingFunction): EasingFunction => (t) => easeIn(t),
  out: (easeIn: EasingFunction): EasingFunction => (t) => 1 - easeIn(1 - t),
  inOut:
    (easeIn: EasingFunction): EasingFunction =>
    (t) =>
      t < 0.5 ? easeIn(t * 2) / 2 : 1 - easeIn(t * -2 + 2) / 2,
  outIn:
    (easeIn: EasingFunction): EasingFunction =>
    (t) =>
      t < 0.5 ? (1 - easeIn(1 - t * 2)) / 2 : (easeIn(t * 2 - 1) + 1) / 2,
} as const

// ---------------------------------------------------------------------------
// Courbes autonomes — ne dérivent pas d'une courbe « in »
// ---------------------------------------------------------------------------

const calcBezier = (t: number, a1: number, a2: number): number =>
  (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + 3 * a1) * t

/** Inverse `calcBezier` par dichotomie — pas de forme fermée pour l'abscisse. */
const binarySubdivide = (x: number, x1: number, x2: number): number => {
  let a = 0
  let b = 1
  let currentX: number
  let currentT: number
  let i = 0
  do {
    currentT = a + (b - a) / 2
    currentX = calcBezier(currentT, x1, x2) - x
    if (currentX > 0) b = currentT
    else a = currentT
  } while (Math.abs(currentX) > 0.0000001 && ++i < 100)
  return currentT
}

/** Bézier cubique à deux points de contrôle, comme `cubic-bezier()` en CSS. */
export const cubicBezier = (
  x1 = 0.5,
  y1 = 0.0,
  x2 = 0.5,
  y2 = 1.0,
): EasingFunction =>
  x1 === y1 && x2 === y2
    ? none
    : (t) => (t === 0 || t === 1 ? t : calcBezier(binarySubdivide(t, x1, x2), y1, y2))

/** Escalier à `count` marches. `fromStart` place la marche au début de l'intervalle. */
export const steps = (count = 10, fromStart = false): EasingFunction => {
  const roundMethod = fromStart ? Math.ceil : Math.floor
  return (t) => roundMethod(clamp(t, 0, 1) * count) * (1 / count)
}

const parseNumber = (value: number | string): number =>
  typeof value === 'string' ? parseFloat(value) : value

/**
 * Interpolation affine par morceaux entre des valeurs données.
 *
 * Chaque valeur peut porter son abscisse en pourcentage (`'0.5 30%'`) ; sans quoi les
 * points sont répartis régulièrement.
 */
export const linear = (...args: Array<number | string>): EasingFunction => {
  const argsLength = args.length
  if (!argsLength) return none
  const totalPoints = argsLength - 1
  const xPoints: number[] = [0]
  const yPoints: number[] = [parseNumber(args[0])]
  for (let i = 1; i < totalPoints; i++) {
    const arg = args[i]
    const split = typeof arg === 'string' ? arg.trim().split(' ') : [arg]
    const percent = split[1]
    xPoints.push(percent !== undefined ? parseNumber(percent) / 100 : i / totalPoints)
    yPoints.push(parseNumber(split[0]))
  }
  yPoints.push(parseNumber(args[totalPoints]))
  xPoints.push(1)
  return (t) => {
    for (let i = 1, l = xPoints.length; i < l; i++) {
      const currentX = xPoints[i]
      if (t <= currentX) {
        const prevX = xPoints[i - 1]
        const prevY = yPoints[i - 1]
        return prevY + ((yPoints[i] - prevY) * (t - prevX)) / (currentX - prevX)
      }
    }
    return yPoints[yPoints.length - 1]
  }
}

/**
 * Escalier aux marches inégales, entre régularité et hasard.
 *
 * **Divergence assumée — la source de hasard est un paramètre.** L'original appelle
 * `Math.random()` : deux constructions de la même courbe donnent deux courbes différentes.
 * Pour une scène sérialisable et reconstruite, cela signifie qu'un rendu ne se reproduit
 * pas d'une lecture à l'autre. Ici la source est explicite, donc reproductible si l'appelant
 * fournit un générateur déterministe.
 *
 * @param random générateur dans [0,1[. Par défaut `Math.random`, donc non reproductible.
 */
export const irregular = (
  length = 10,
  randomness = 1,
  random: () => number = Math.random,
): EasingFunction => {
  const values: number[] = [0]
  const total = length - 1
  for (let i = 1; i < total; i++) {
    const previousValue = values[i - 1]
    const spacing = i / total
    const segmentEnd = (i + 1) / total
    const randomVariation = spacing + (segmentEnd - spacing) * random()
    values.push(clamp(spacing * (1 - randomness) + randomVariation * randomness, previousValue, 1))
  }
  values.push(1)
  return linear(...values)
}

// ---------------------------------------------------------------------------
// Catalogue nommé
// ---------------------------------------------------------------------------

/** Courbes de base sans paramètre, déclinées dans les quatre régimes. */
const plainBases: Record<string, EasingFunction> = {
  Quad: power(2),
  Cubic: power(3),
  Quart: power(4),
  Quint: power(5),
  Sine: inSine,
  Circ: inCirc,
  Expo: inExpo,
  Bounce: inBounce,
}

/** Courbes de base paramétrables, déclinées dans les quatre régimes. */
const parametricBases: Record<string, (...args: Array<number | string>) => EasingFunction> = {
  '': power,
  Back: back,
  Elastic: elastic,
}

/**
 * Catalogue complet : `inQuad`, `outBounce`, `inOutSine`… plus les formes paramétrables
 * `in`, `out`, `inOut`, `outIn` (puissance), `inBack`, `outElastic`, etc.
 *
 * Les entrées sans paramètre sont des courbes ; les entrées paramétrables sont des
 * fabriques auxquelles il faut passer leurs arguments.
 */
/**
 * Noms du catalogue qui désignent une **fabrique** et non une courbe : il faut leur passer
 * leurs arguments avant d'obtenir une courbe.
 *
 * Marqué à la construction plutôt que déduit du nom — l'original teste `nom.includes('Back')`,
 * ce qui casserait dès qu'une courbe future contiendrait ce mot.
 */
export const parametricNames = new Set<string>()

export const eases: Record<string, EasingFunction | ((...args: Array<number | string>) => EasingFunction)> =
  (() => {
    const list: Record<string, EasingFunction | ((...args: Array<number | string>) => EasingFunction)> = {
      linear: none,
      none,
    }
    for (const type of Object.keys(easeTypes) as Array<keyof typeof easeTypes>) {
      const applyType = easeTypes[type]
      for (const name in plainBases) {
        list[type + name] = applyType(plainBases[name])
      }
      for (const name in parametricBases) {
        const base = parametricBases[name]
        const fullName = type + name
        list[fullName] = (...args: Array<number | string>) => applyType(base(...args))
        parametricNames.add(fullName)
      }
    }
    return list
  })()

const resolved = new Map<string, EasingFunction>()

/**
 * Résout un nom de courbe, avec ou sans arguments : `'inOutQuad'`, `'outBack(2)'`,
 * `'inElastic(1.5, .4)'`.
 *
 * **Divergence assumée — un nom inconnu lève.** L'original retombe silencieusement sur
 * l'identité, ce qui transforme une faute de frappe en animation linéaire sans le dire.
 * Une déclaration qui ne se résout pas doit échouer, pas se deviner.
 */
export const parseEase = (name: string): EasingFunction => {
  const cached = resolved.get(name)
  if (cached) return cached

  const openParen = name.indexOf('(')
  let fn: EasingFunction

  if (openParen <= -1) {
    const entry = eases[name]
    if (entry === undefined) throw new Error(`ace: courbe d'easing inconnue « ${name} »`)
    // Une fabrique nommée sans arguments retombe sur ses valeurs par défaut.
    fn = parametricNames.has(name)
      ? (entry as (...a: Array<number | string>) => EasingFunction)()
      : (entry as EasingFunction)
  } else {
    const base = name.slice(0, openParen)
    const entry = eases[base]
    if (entry === undefined) throw new Error(`ace: courbe d'easing inconnue « ${base} »`)
    const args = name.slice(openParen + 1, -1).split(',')
    fn = (entry as (...a: Array<number | string>) => EasingFunction)(...args)
  }

  resolved.set(name, fn)
  return fn
}
