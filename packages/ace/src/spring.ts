/**
 * Ressort — solveur d'oscillateur amorti, extrait d'anime.js 4.5.0 (MIT, © Julian Garnier),
 * lui-même adapté du solveur de WebKit (© 2016 Apple Inc).
 *
 * Ce qui a été conservé tel quel : les mathématiques. Le solveur `solve()`, l'intégration
 * numérique qui détermine la durée de stabilisation, et les conversions entre
 * (rebond, durée perçue) et (raideur, amortissement) — formules SwiftUI d'Apple.
 *
 * Ce qui a été retiré, et pourquoi — voir `src/vendor/README.md` :
 *
 * 1. **La référence arrière vers l'animation et le rappel `onComplete`.** L'original les
 *    portait *dans la fonction d'easing elle-même* : évaluer à `t` déclenchait un effet de
 *    bord et mutait un drapeau `completed`. Incompatible avec une évaluation en fonction du
 *    temps — évaluer deux fois le même `t` déclencherait deux fois, et une lecture arrière
 *    puis avant re-déclencherait. Ici l'easing est une fonction pure de `t`.
 * 2. **Les accesseurs mutables** (`bounce`, `stiffness`, `damping`…) qui recalculaient le
 *    solveur à chaque écriture. Un ressort se construit une fois et ne change plus.
 * 3. **Les globales de la bibliothèque d'origine** (`globals.timeScale`). L'échelle de temps
 *    est un paramètre explicite.
 */

/** Millisecondes par seconde — l'unité de travail du solveur est la seconde. */
const MS_PER_SECOND = 1e3

/** Plancher employé pour éviter les divisions par zéro sur les paramètres physiques. */
const MIN_PARAM = 1e-11

/** Plafond commun aux paramètres physiques, hérité du solveur d'origine. */
const MAX_PARAM = MS_PER_SECOND * 10

/** Plafond de l'amortissement, au-delà duquel le solveur produit des valeurs aberrantes. */
const MAX_DAMPING = 300

/** Pas d'intégration, en secondes, employé pour mesurer la durée de stabilisation. */
const TIME_STEP = 0.02

/** En deçà de cet écart à 1, la valeur est considérée au repos. */
const REST_THRESHOLD = 0.0005

/** Durée de repos à observer, en ms, avant de conclure que le ressort est stabilisé. */
const REST_DURATION_MS = 200

/** Durée maximale autorisée pour un ressort, en ms. */
const MAX_DURATION_MS = 60000

/**
 * Paramètres d'un ressort. Deux façons de le décrire, exclusives en pratique :
 *
 * - **perceptuelle** — `bounce` et `duration` : ce qu'on veut voir ;
 * - **physique** — `stiffness`, `damping`, `mass`, `velocity` : ce qui le produit.
 *
 * Fournir l'une ou l'autre ; fournir `bounce` ou `duration` fait dériver la description
 * physique, et l'inverse n'est pas recalculé (le ressort n'a pas d'accesseurs mutables).
 */
export type SpringParams = {
  /** Rebond perçu, entre -1 (suramorti) et 1 (très rebondissant). Défaut : 0.5. */
  bounce?: number
  /** Durée perçue en ms — celle qu'un spectateur attribue au mouvement. Défaut : 628. */
  duration?: number
  /** Masse. Défaut : 1. */
  mass?: number
  /** Raideur. Défaut : 100. */
  stiffness?: number
  /** Amortissement. Défaut : 10. */
  damping?: number
  /** Vitesse initiale. Défaut : 0. */
  velocity?: number
  /** Échelle de temps : 1 pour des millisecondes, 0.001 pour des secondes. Défaut : 1. */
  timeScale?: number
}

/**
 * Un ressort résolu. Immuable : tout est calculé à la construction.
 */
export type Spring = {
  /**
   * Fonction d'easing pure : progression 0→1 en entrée, valeur en sortie.
   * Peut dépasser 1 avant de revenir — c'est le rebond.
   */
  ease: (t: number) => number
  /**
   * Durée réelle jusqu'à stabilisation, en ms. **C'est elle qui doit servir de durée au
   * tween** : un ressort porte sa propre durée, elle ne se déclare pas à côté.
   */
  settlingDuration: number
  /** Durée perçue en ms, telle que fournie ou dérivée. */
  perceivedDuration: number
  /** Rebond, tel que fourni ou dérivé. */
  bounce: number
  /** Raideur effective. */
  stiffness: number
  /** Amortissement effectif. */
  damping: number
  /** Masse effective. */
  mass: number
  /** Vitesse initiale effective. */
  velocity: number
}

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value

const orDefault = (value: number | undefined, fallback: number): number =>
  value === undefined ? fallback : value

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Coefficients du régime d'oscillation, dérivés des paramètres physiques.
 *
 * - `w0` : pulsation propre ;
 * - `zeta` : taux d'amortissement — sous 1 le ressort oscille, à 1 il est critique,
 *   au-dessus il est suramorti et ne dépasse jamais sa cible ;
 * - `wd` : pulsation amortie ;
 * - `b` : coefficient issu de la vitesse initiale.
 */
type SpringCoefficients = { w0: number; zeta: number; wd: number; b: number }

/**
 * Résout la position du ressort à un instant donné du solveur (en secondes).
 *
 * Trois régimes selon `zeta`. Le cas suramorti emploie deux exponentielles plutôt que
 * `cosh`/`sinh`, qui débordent vers l'infini sur de grandes valeurs.
 */
const solveAt = (time: number, { w0, zeta, wd, b }: SpringCoefficients): number => {
  let t: number
  if (zeta < 1) {
    t = Math.exp(-time * zeta * w0) * (Math.cos(wd * time) + b * Math.sin(wd * time))
  } else if (zeta === 1) {
    t = (1 + b * time) * Math.exp(-time * w0)
  } else {
    t =
      ((1 + b) * Math.exp((-zeta * w0 + wd) * time) +
        (1 - b) * Math.exp((-zeta * w0 - wd) * time)) /
      2
  }
  return 1 - t
}

/**
 * Dérive raideur et amortissement d'un couple (rebond, durée perçue).
 *
 * Implémentation de la durée perçue de SwiftUI : raideur = (2π ÷ durée)², l'amortissement
 * variant selon le signe du rebond. Masse et vitesse sont ramenées à leurs valeurs neutres,
 * la description perceptuelle ne les exprimant pas.
 */
const deriveFromPerceptual = (
  bounce: number,
  perceivedDuration: number,
  timeScale: number,
): { stiffness: number; damping: number } => {
  const pds = timeScale === 1 ? perceivedDuration / MS_PER_SECOND : perceivedDuration
  const stiffness = ((2 * Math.PI) / pds) ** 2
  const damping =
    bounce >= 0
      ? ((1 - bounce) * 4 * Math.PI) / pds
      : (4 * Math.PI) / (pds * (1 + bounce))
  return {
    stiffness: round(clamp(stiffness, MIN_PARAM, MAX_PARAM), 3),
    damping: round(clamp(damping, MIN_PARAM, MAX_DAMPING), 3),
  }
}

/**
 * Dérive rebond et durée perçue d'un couple (raideur, amortissement).
 *
 * Réciproque de `deriveFromPerceptual`, sous les mêmes hypothèses de masse et vitesse
 * neutres. Sert uniquement à renseigner les champs perceptuels du ressort construit.
 */
const derivePerceptual = (
  stiffness: number,
  damping: number,
  timeScale: number,
): { bounce: number; perceivedDuration: number } => {
  const pds = (2 * Math.PI) / Math.sqrt(stiffness)
  const perceivedDuration = pds * (timeScale === 1 ? MS_PER_SECOND : 1)
  const zeta = damping / (2 * Math.sqrt(stiffness))
  const bounce =
    zeta <= 1 ? 1 - (damping * pds) / (4 * Math.PI) : (4 * Math.PI) / (damping * pds) - 1
  return {
    bounce: round(clamp(bounce, -1, 1), 3),
    perceivedDuration: round(
      clamp(perceivedDuration, 10 * timeScale, MAX_PARAM * timeScale),
      3,
    ),
  }
}

/**
 * Mesure la durée de stabilisation en intégrant le solveur pas à pas.
 *
 * On avance par `TIME_STEP` jusqu'à observer `REST_DURATION_MS` consécutives sous le seuil
 * de repos, ou jusqu'à `MAX_DURATION_MS`. Il n'existe pas de forme fermée pour cette durée :
 * la mesure numérique est la méthode, pas un pis-aller.
 *
 * @returns la durée du solveur en secondes, et la durée de stabilisation en ms.
 */
const measureSettling = (
  coefficients: SpringCoefficients,
  timeScale: number,
): { solverDuration: number; settlingDuration: number } => {
  const maxRestSteps = REST_DURATION_MS / TIME_STEP / MS_PER_SECOND
  const maxIterations = MAX_DURATION_MS / TIME_STEP / MS_PER_SECOND
  let solverTime = 0
  let solverDuration = 0
  let restSteps = 0
  let iterations = 0
  while (restSteps <= maxRestSteps && iterations <= maxIterations) {
    restSteps = Math.abs(1 - solveAt(solverTime, coefficients)) < REST_THRESHOLD ? restSteps + 1 : 0
    solverDuration = solverTime
    solverTime += TIME_STEP
    iterations++
  }
  return {
    solverDuration,
    settlingDuration: round(solverDuration * MS_PER_SECOND, 0) * timeScale,
  }
}

/**
 * Construit un ressort à partir de ses paramètres.
 *
 * Le résultat est immuable et porte sa propre `settlingDuration`, qui doit servir de durée
 * au tween qui l'emploie.
 */
export const spring = (parameters: SpringParams = {}): Spring => {
  const timeScale = orDefault(parameters.timeScale, 1)
  const describedPerceptually =
    parameters.bounce !== undefined || parameters.duration !== undefined

  const mass = describedPerceptually ? 1 : clamp(orDefault(parameters.mass, 1), 1, MAX_PARAM)
  const velocity = describedPerceptually
    ? 0
    : clamp(orDefault(parameters.velocity, 0), -MAX_PARAM, MAX_PARAM)

  let bounce: number
  let perceivedDuration: number
  let stiffness: number
  let damping: number

  if (describedPerceptually) {
    bounce = clamp(orDefault(parameters.bounce, 0.5), -1, 1)
    perceivedDuration = clamp(
      orDefault(parameters.duration, 628),
      10 * timeScale,
      MAX_PARAM * timeScale,
    )
    ;({ stiffness, damping } = deriveFromPerceptual(bounce, perceivedDuration, timeScale))
  } else {
    stiffness = clamp(orDefault(parameters.stiffness, 100), MIN_PARAM, MAX_PARAM)
    damping = clamp(orDefault(parameters.damping, 10), MIN_PARAM, MAX_PARAM)
    ;({ bounce, perceivedDuration } = derivePerceptual(stiffness, damping, timeScale))
  }

  const w0 = clamp(Math.sqrt(stiffness / mass), MIN_PARAM, MS_PER_SECOND)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  let wd: number
  let b: number
  if (zeta < 1) {
    wd = w0 * Math.sqrt(1 - zeta * zeta)
    b = (zeta * w0 - velocity) / wd
  } else if (zeta === 1) {
    wd = 0
    b = w0 - velocity
  } else {
    wd = w0 * Math.sqrt(zeta * zeta - 1)
    b = (zeta * w0 - velocity) / wd
  }

  const coefficients: SpringCoefficients = { w0, zeta, wd, b }
  const { solverDuration, settlingDuration } = measureSettling(coefficients, timeScale)

  return {
    ease: (t) => (t === 0 || t === 1 ? t : solveAt(t * solverDuration, coefficients)),
    settlingDuration,
    perceivedDuration,
    bounce,
    stiffness,
    damping,
    mass,
    velocity,
  }
}
