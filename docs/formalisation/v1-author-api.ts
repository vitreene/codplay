/**
 * Surface d'API Codplay — référence pour les auteurs
 *
 * Ce fichier décrit l'ensemble des types et fonctions qu'un auteur
 * peut utiliser pour créer une scène Codplay : document de scène,
 * straps, helpers de planification, et API du player.
 *
 * Il s'agit d'une référence annotée, pas d'un module exécutable.
 * Les sources de vérité restent les fichiers dans src/.
 */

// =============================================================================
// TYPES COMMUNS
// =============================================================================

/**
 * Résultat d'une opération d'API.
 * Toujours vérifier `.ok` avant d'accéder à `.data` ou `.error`.
 */
export type ApiResult<T> =
  | { ok: true; data: T; warnings?: ApiWarning[] }
  | { ok: false; error: ApiError }

export type ApiError = {
  code: string
  message: string
  details?: unknown
}

export type ApiWarning = {
  code: string
  message: string
  details?: unknown
}

/**
 * Événement émis ou consommé à l'intérieur du runtime Codplay.
 * `cascade: true` lève le scope story et diffuse à toute la scène.
 */
export type StoryEvent = {
  /** Nom de l'événement (ex: "quiz:answer-selected"). */
  name: string
  /** Données libres transportées avec l'événement. */
  data?: Record<string, unknown>
  /** Si true, l'événement remonte au scope scène plutôt que rester dans la story. */
  cascade?: boolean
}

/**
 * Représentation immuable et récursive d'un objet.
 * Le state reçu dans un strap est toujours DeepReadonly.
 */
export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T :
  T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T

/**
 * Handle retourné par les helpers live (wait, repeat, loop, stagger).
 * Permet d'annuler le job planifié avant son exécution.
 */
export type HelperHandle = {
  id: string
  /** Annule le job et libère la ressource associée. */
  cancel: () => void
}

/**
 * Contexte fourni à chaque tick d'un helper (repeat, loop, stagger).
 * Permet de calculer des valeurs dynamiques en fonction du temps et de l'index.
 */
export type HelperTickContext = {
  /** Horodatage absolu en ms dans la timeline virtuelle. */
  currentTimeMs: number
  /** Horodatage en ms auquel le helper a démarré. */
  startedAtMs: number
  /** Temps écoulé depuis le démarrage du helper (currentTimeMs - startedAtMs). */
  elapsedMs: number
  /** Index de l'occurrence courante (0 pour la première). */
  index: number
  /** Snapshot du state courant au moment de l'exécution du tick. */
  state: DeepReadonly<Record<string, unknown>>
}

// =============================================================================
// DOCUMENT DE SCÈNE — Structure principale
// =============================================================================

/**
 * Document de scène : artefact de plus haut niveau.
 * Contient toutes les stories, les règles globales et les pistes de timeline.
 */
export type SceneDef = {
  /** Identifiant unique de la scène. */
  id: string

  /** Map des stories de la scène, indexées par storyId. */
  stories: Record<string, StoryDef>

  /** Liste des storyIds auto-initialisés au démarrage du player. */
  rootStories: string[]

  /**
   * State initial de la scène, partagé par toutes les stories sans scope propre.
   * Accessible en lecture dans les straps via `input.state`.
   */
  initial?: Record<string, unknown>

  /**
   * Noms des straps actifs au niveau scène.
   * Ces straps reçoivent les événements non capturés par les stories.
   */
  straps?: string[]

  /**
   * Règles d'écoute au niveau scène.
   * Traitées après les règles de story quand l'événement n'a pas de scope story.
   */
  listen: ListenRule[]

  /**
   * State mutable de la scène (persisté entre play/pause, réinitialisé par seek).
   * Réservé à l'usage interne des straps — ne pas définir manuellement.
   */
  state?: Record<string, unknown>

  /**
   * Hook appelé avant le premier `scene:ready`.
   * Peut calculer et retourner un état initial enrichi.
   */
  init?: (input?: Record<string, unknown>) => Record<string, unknown> | undefined

  /** Hook appelé quand la lecture démarre (après `play()`). */
  onStart?: (...args: unknown[]) => void

  /** Hook appelé quand la séquence se termine (`sequence:end`). */
  onSequenceEnd?: (...args: unknown[]) => void

  /** Configuration des pistes de timeline (ex: `{ master: { role: "master" } }`). */
  tracks: Record<string, unknown>
}

/**
 * Définition d'une story — unité de composition de la scène.
 * Chaque story possède ses persos, son état, ses règles d'écoute et ses straps.
 */
export type StoryDef = {
  /** Identifiant unique de la story dans la scène. */
  id: string
  /** Nom lisible (usage débogage/éditeur). */
  name?: string
  /**
   * Identifiant de piste de timeline associée.
   * Si absent, la story n'a pas de piste dédiée.
   */
  trackId?: string
  /** Configuration des pistes locales à la story. */
  tracks?: Record<string, unknown>
  /** State initial de la story (écrase `scene.initial` dans son scope). */
  initial?: Record<string, unknown>
  /** Liste des persos appartenant à cette story. */
  persos: PersoDoc[]
  /** Noms des straps actifs dans cette story. */
  straps?: string[]
  /** Règles d'écoute locales à la story. */
  listen: ListenRule[]
  /**
   * Événements de timeline déclarés pour cette story.
   * Émis automatiquement à l'horodatage `startAt` de la piste.
   */
  eventimes?: StoryEventimeDoc[]
  /** State mutable de la story (réservé au runtime). */
  state?: Record<string, unknown>
  /** Hook d'initialisation locale à la story. */
  init?: (input?: Record<string, unknown>) => Record<string, unknown> | undefined
}

/**
 * Événement de timeline déclaré dans une story.
 * Déclenché automatiquement quand la piste atteint `startAt` ms.
 */
export type StoryEventimeDoc = {
  /** Nom de l'événement émis. */
  name: string
  /** Horodatage en ms relatif au début de la piste. */
  startAt: number
  /** Données libres transmises avec l'événement. */
  data?: Record<string, unknown>
  /** Événements enfants émis en cascade. */
  events?: StoryEventimeDoc[]
}

// =============================================================================
// PERSO — Composant visuel
// =============================================================================

/**
 * Composant visuel d'une story.
 * Décrit le type, l'état initial, les actions réactives, et les déclarations d'émission.
 */
export type PersoDoc = {
  /** Identifiant unique dans la story. */
  id: string
  /** Nom lisible (usage débogage/éditeur). */
  name?: string
  /**
   * Type du composant : 'text' | 'img' | 'media' | 'list' | 'layout' | string.
   * Détermine quel composant runtime est instancié.
   */
  type: ItemType
  /** Configuration de module externe (ex: player vidéo custom). */
  module?: ItemModuleConfig
  /**
   * État initial du perso.
   * Appliqué une seule fois à la création — seek reconstruit à partir de cet état.
   */
  initial: ItemState
  /**
   * Déclarations d'émission d'événements sur interactions DOM.
   * Clés = noms d'événements DOM (ex: 'click', 'pointerdown').
   */
  emit?: EmitDeclaration
  /** Configuration d'animation et de performance pour les persos de type 'list'. */
  list?: ListConfig
  /**
   * Actions déclenchées par les événements de la story.
   * Clés = noms d'événements ; valeurs = mutations à appliquer au perso.
   * `null` désactive une action héritée.
   */
  actions: Record<string, ActionDoc | null>
}

/** Types de composants built-in + extension custom. */
export type ItemType = 'text' | 'img' | 'media' | 'list' | 'layout' | string

/** Configuration opaque d'un module externe. */
export type ItemModuleConfig = Record<string, unknown>

// =============================================================================
// ÉTAT INITIAL DU PERSO — ItemState
// =============================================================================

/**
 * État initial d'un perso (propriétés DOM et de rendu).
 * Toutes les propriétés sont optionnelles.
 */
export type ItemState = {
  /** Override de l'identifiant DOM (id HTML). */
  id?: string
  /** Balise HTML à utiliser (ex: 'div', 'span', 'button'). */
  tag?: string
  /** Classe(s) CSS initiales. */
  className?: string
  /**
   * Placement initial dans l'arbre DOM.
   * Peut être un parentId (string), un objet MoveCommand, ou un mode court.
   */
  move?: MoveValue
  /** Markup HTML interne (persos de type 'layout'). */
  markup?: string
  /** Format du markup : 'html' (défaut) ou 'svg'. */
  format?: LayoutFormat
  /** Si true, ce perso sert de référence pour la projection de l'horizon de seek. */
  master?: boolean
  /** Politique de placement dans une liste (réordonnancement automatique). */
  config?: ListPlacementConfig
  /** Styles CSS inline initiaux. */
  style?: Record<string, unknown>
  /** Attributs HTML initiaux. */
  attr?: Record<string, unknown>
  /** Contenu textuel initial (persos de type 'text'). */
  content?: string
  /** URL de la source média initiale (persos de type 'img' ou 'media'). */
  src?: string
  /** Texte alternatif initial (persos de type 'img'). */
  alt?: string
  /** Mode d'adaptation de l'image : 'wallpaper' (cover) ou 'sprite' (contain). */
  fitMode?: 'wallpaper' | 'sprite'
  /** Icône de sélection pour les persos de type input. */
  selectionIcon?: InputPartDefinition
  /** Icône de correction (bonne/mauvaise réponse) pour les persos de type input. */
  correctionIcon?: InputCorrectionIconDefinition
}

export type LayoutFormat = 'html' | 'svg'

/**
 * Valeur de déplacement acceptée dans `initial.move` ou `action.move`.
 * Formes possibles :
 * - string : parentId cible (mode 'auto' implicite)
 * - string préfixée `@` : alias symbolique réservé (`@root` = story host, `@off` = détachement
 *   intentionnel) — le préfixe distingue sans ambiguïté un token réservé d'un identifiant auteur
 * - MoveCommand : commande complète avec mode, flip, reorder
 */
export type MoveValue =
  | MoveCommand
  | string
  | { mode?: string; targetId?: string; parentId?: string; flip?: boolean; flipMode?: string; reorder?: boolean }

/**
 * Commande de déplacement normalisée.
 */
export type MoveCommand = {
  /** ID du parent cible dans le DOM. */
  parentId: string
  /**
   * Mode d'insertion dans le parent :
   * - 'auto' : position mémorisée ou append (défaut)
   * - 'first' / 'last' : première/dernière position
   * - 'append' / 'prepend' : équivalents sémantiques de last/first
   * - number : index exact
   */
  mode?: MoveMode
  /** Active l'animation FLIP lors du déplacement. */
  flip?: boolean
  /**
   * Mode de calcul FLIP :
   * - 'local' : coordonnées relatives au parent (défaut)
   * - 'overlay-world' : coordonnées absolues dans le viewport
   */
  flipMode?: MoveFlipMode
  /** Force le réordonnancement interne de la liste parent. */
  reorder?: boolean
}

export type MoveMode = 'auto' | 'first' | 'last' | 'append' | 'prepend' | number
export type MoveFlipMode = 'local' | 'overlay-world'

/**
 * Politique de réordonnancement automatique dans un perso 'list'.
 */
export type ListPlacementConfig = {
  reorderOnMove?: boolean
  reorderOnAdd?: boolean
  reorderOnRemove?: boolean
}

/** Définition d'une partie décorative d'un perso input (icône de sélection). */
export type InputPartDefinition = {
  className?: string
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  content?: string
}

/** Définition d'une icône de correction avec contenu spécifique par état. */
export type InputCorrectionIconDefinition = InputPartDefinition & {
  correctContent?: string
  incorrectContent?: string
  missedCorrectContent?: string
}

// =============================================================================
// ACTION — Mutation appliquée à un perso en réponse à un événement
// =============================================================================

/**
 * Payload d'une action déclenchée sur un perso.
 * Toutes les propriétés sont optionnelles — seules les propriétés présentes sont appliquées.
 */
export type ActionDoc = {
  /**
   * Référence vers une autre action pour héritage.
   * La clé de l'action référencée est résolue dans `perso.actions`.
   */
  ref?: string
  /**
   * Modification de classes CSS :
   * - string : remplace toutes les classes
   * - `{ add, remove }` : delta déclaratif
   */
  className?: string | { add?: string; remove?: string }
  /** Styles CSS à appliquer (fusion avec les styles existants). */
  style?: Record<string, unknown>
  /** Attributs HTML à appliquer. */
  attr?: Record<string, unknown>
  /** Déplacement dans le DOM (même sémantique que `initial.move`). */
  move?: MoveValue
  /** Nouveau contenu textuel. */
  content?: string
  /** Nouvelle URL source (img/media). */
  src?: string
  /** Nouveau texte alternatif (img). */
  alt?: string
  /** Nouveau mode d'adaptation de l'image. */
  fitMode?: 'wallpaper' | 'sprite'
  /** Force l'état coché/décoché (input checkbox). */
  checked?: boolean
  /** Active/désactive l'interactivité du perso. */
  disabled?: boolean
  /**
   * État visuel d'un perso input.
   * Contrôle l'apparence de sélection et de correction.
   */
  visualState?: InputVisualStateValue
  /** Autorise la validation de la réponse. */
  canValidate?: boolean
  /** Désactive les réponses disponibles. */
  disableAnswers?: boolean
  /** Affiche la correction (bonne/mauvaise réponse). */
  showCorrection?: boolean
  /** IDs des réponses sélectionnées (perso quiz). */
  selectedAnswerIds?: string[]
  /** IDs des réponses correctes (perso quiz). */
  correctAnswerIds?: string[]
  /** Commande de contrôle média (START/PAUSE/STOP avec optionnels in/out). */
  broadcast?: BroadcastAction
  /** Commande de module externe (opaque, transmise au handler du module). */
  cmd?: ModuleCommandDoc
  /** Payload générique transmis au handler custom. */
  payload?: ActionPayloadDoc
  /** ID de cible pour les actions indirectes. */
  targetId?: string
}

export type InputVisualStateValue =
  | 'idle'
  | 'selected'
  | 'disabled'
  | 'revealed-correct'
  | 'revealed-incorrect'
  | 'revealed-missed-correct'

/**
 * Commande de contrôle d'un média (audio/vidéo).
 */
export type BroadcastAction = {
  /** Action à exécuter. */
  type: 'START' | 'PAUSE' | 'STOP'
  /** Position de départ en ms (optionnel pour START). */
  startAt?: number
  /** Position de fin en ms (optionnel pour START). */
  endAt?: number
  /** Transition CSS appliquée au conteneur lors du START. */
  transition?: {
    from?: Record<string, unknown>
    to?: Record<string, unknown>
    duration?: number
  }
}

export type ModuleCommandDoc = { name: string } & Record<string, unknown>
export type ActionPayloadDoc = Record<string, unknown>

// =============================================================================
// ÉMISSION D'ÉVÉNEMENTS — Interactions DOM sur les persos
// =============================================================================

/**
 * Déclarations d'émission d'événements sur interactions DOM.
 * Clé = nom de l'événement DOM (ex: 'click', 'pointerdown').
 */
export type EmitDeclaration = Record<string, EmitRule>

/**
 * Règle d'émission associée à un événement DOM.
 * Peut être une seule action ou un tableau d'actions.
 */
export type EmitRule = EmitRuleAction | EmitRuleAction[]

/**
 * Action d'émission : définit quel événement story est émis en réaction à l'interaction.
 */
export type EmitRuleAction = {
  /** Référence à une autre règle pour héritage. */
  ref?: string
  /** Événement story à émettre. */
  event: EmitRuleEvent
  /** Données libres ajoutées à l'événement (en plus des données DOM). */
  data?: Record<string, unknown>
  /**
   * Session de capture pour les interactions continues (ex: drag).
   * Active le tracking pointermove pendant la durée spécifiée.
   */
  capture?: EmitCapture
}

export type EmitRuleEvent = {
  name: string
  cascade?: boolean
}

/**
 * Configuration d'une session de capture d'interaction continue (ex: drag-drop).
 * Déclenche un tracking point par point pendant toute la durée du geste.
 */
export type EmitCapture = {
  /**
   * Événement émis à chaque tick de capture (ex: pointermove).
   * Les données portent : `{ dx, dy, baseX, baseY, x, y }`.
   */
  event: EmitRuleEvent
  /**
   * Événement émis à la fin de la capture (ex: pointerup).
   * Les données portent : `{ fromX, fromY, toX, toY, duration, snapAt }`.
   * Si absent, réutilise `event` avec mode `persist-only`.
   */
  endEvent?: EmitRuleEvent
  /** Durée maximale de la session de capture en ms. */
  duration: number
  /** Point de référence pour le calcul de déplacement : 'start' ou 'end'. */
  snapAt: 'start' | 'end'
  /** Événements DOM qui déclenchent chaque tick (défaut : ['pointermove']). */
  trackOn?: string[]
  /** Événements DOM qui terminent la capture (défaut : ['pointerup']). */
  endOn?: string[]
}

// =============================================================================
// RÈGLES D'ÉCOUTE — listen
// =============================================================================

/**
 * Règle d'écoute d'événement dans une story ou au niveau scène.
 * Quand l'événement `on` est reçu :
 * 1. Les `transform` sont appliquées en premier, produisant de nouveaux événements.
 * 2. Les `straps` sont exécutés.
 * 3. Les `emit` sont publiés.
 */
export type ListenRule = {
  /** Nom de l'événement écouté. */
  on: string
  /**
   * Fonctions de transformation d'événement.
   * Chaque fonction reçoit l'événement déclencheur et retourne un tableau d'événements.
   * Exécutées dans l'ordre, leurs sorties sont réinjectées dans le pipeline.
   */
  transform?: TransformFn[]
  /** Événements à émettre en réponse (avec données optionnelles). */
  emit?: ListenEmit[]
  /** Noms des straps à exécuter en réponse. */
  straps?: string[]
}

/**
 * Fonction de transformation d'événement dans une règle d'écoute.
 * Reçoit l'événement déclencheur et retourne les événements générés.
 */
export type TransformFn = (event: StoryEvent) => StoryEvent[]

export type ListenEmit = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
}

// =============================================================================
// STRAP — Fonction de comportement réactive
// =============================================================================

/**
 * Collection de straps enregistrés dans le player.
 * Clé = nom du strap (référencé dans `story.straps` ou `listen.straps`).
 */
export type StrapCollection = Record<string, StrapFn>

/**
 * Signature d'un strap.
 * Appelé en réponse à un événement et retourne des effets (immédiats ou planifiés).
 */
export type StrapFn = (input: StrapInput) => Promise<StrapReturnValue> | StrapReturnValue

/**
 * Paramètre d'entrée d'un strap.
 */
export type StrapInput = {
  /** L'événement déclencheur. */
  event: StoryEvent
  /**
   * Snapshot du state courant (scène ou story selon le scope).
   * Immuable — utiliser `update` dans le retour pour modifier le state.
   */
  state: DeepReadonly<Record<string, unknown>>
  /** Métadonnées sur le contexte d'exécution (origine, persoId déclencheur). */
  meta: StrapMeta
  /**
   * Contexte d'exécution donnant accès aux helpers de planification et à l'API runtime.
   */
  context: StrapContext
}

export type StrapMeta = {
  /** Nom de l'événement qui a déclenché ce strap. */
  originEventName: string
  /** Origine de l'interaction (perso ou événement DOM). */
  origin?: {
    /** ID du perso à l'origine de l'événement (si disponible dans `event.data.self.id`). */
    persoId?: string
    /** Nom de l'événement DOM d'origine. */
    userEvent?: string
  }
}

/**
 * Valeur de retour d'un strap.
 * Peut être :
 * - `StrapRuntimeOutput` : effets immédiats (événements + update de state)
 * - `PlannedStrapOccurrence[]` : étapes planifiées dans le temps (retour de `context.planned.*`)
 * - Un tableau mixte imbriqué (le runtime aplatit récursivement)
 * - `void` pour ne rien faire
 */
export type StrapReturnValue =
  | StrapRuntimeOutput
  | PlannedStrapOccurrence[]
  | StrapReturnValue[]
  | void

/**
 * Effets immédiats retournés par un strap (appliqués dans le tick courant).
 */
export type StrapRuntimeOutput = {
  /** Événements à émettre immédiatement dans la pipeline. */
  events?: StoryEvent[]
  /** Mutation partielle du state courant (fusion superficielle). */
  update?: Record<string, unknown>
  /** Avertissements à logguer sans bloquer l'exécution. */
  warnings?: string[]
}

/**
 * Étape planifiée dans le temps, produite par `context.planned.*`.
 * Matérialisée sur la piste du strap à l'offset indiqué.
 */
export type PlannedStrapOccurrence = {
  /** Décalage en ms depuis le moment d'exécution du strap. */
  offsetMs: number
  /** Contenu de l'étape : événement et/ou mise à jour de state. */
  step: StrapStep
}

/**
 * Contenu d'une étape strap : peut émettre un événement, modifier le state, ou les deux.
 */
export type StrapStep = {
  event?: StoryEvent
  update?: Record<string, unknown>
}

/**
 * Input d'une étape strap :
 * - statique : StrapStep ou StrapStep[]
 * - dynamique : factory appelée à chaque tick avec le contexte courant
 */
export type StrapStepInput = StrapStep | StrapStep[] | StrapStepFactory

export type StrapStepFactory = (context: HelperTickContext) => StrapStep | StrapStep[] | void

// =============================================================================
// CONTEXTE D'EXÉCUTION DU STRAP — context
// =============================================================================

/**
 * Contexte fourni à chaque exécution de strap.
 * Contient l'accès aux helpers planifiés, live, et à l'API du runtime.
 */
export type StrapContext = {
  /** API runtime : accès à des informations sur l'état visuel courant. */
  api: PlayerStrapApi
  /**
   * Helpers de planification dans le temps (mode "planned").
   * Retournent des `PlannedStrapOccurrence[]` qui sont matérialisées sur la piste.
   * Idéal pour les séquences finies et reproductibles par seek.
   */
  planned: PlannedStrapHelpers
  /**
   * Helpers de planification live (mode "jit" — just-in-time).
   * Retournent un `HelperHandle` cancellable et s'exécutent en temps réel.
   * Idéal pour les séquences interruptibles ou dépendant d'événements futurs.
   */
  live: LiveStrapHelpers
}

/**
 * API d'accès au runtime visuel depuis un strap.
 */
export type PlayerStrapApi = {
  /**
   * Retourne l'ID du perso situé aux coordonnées (x, y) dans le viewport.
   * Utile pour les interactions de type drag-over.
   * @param excludeId — ID à ignorer (ex: le perso en cours de déplacement)
   */
  getPersoIdAt: (x: number, y: number, excludeId?: string) => string | null
}

// =============================================================================
// HELPERS PLANIFIÉS — context.planned.*
// =============================================================================

/**
 * Helpers qui planifient des étapes dans le temps en mode "planned".
 * Retournent des `PlannedStrapOccurrence[]` à inclure dans le retour du strap.
 * Ces occurrences sont matérialisées sur la piste du strap et reproductibles par seek.
 */
export type PlannedStrapHelpers = {
  /**
   * Planifie une étape unique après `ms` millisecondes.
   * Équivalent sémantique de `delay`.
   *
   * @example
   * return context.planned.wait(500, { event: { name: "anim:done" } })
   */
  wait: (ms: number, input: StrapStepInput, options?: WaitOptions) => PlannedStrapOccurrence[]

  /**
   * Alias de `wait` — même comportement.
   */
  delay: (ms: number, input: StrapStepInput, options?: WaitOptions) => PlannedStrapOccurrence[]

  /**
   * Planifie une série finie de `times` étapes espacées de `everyMs` ms.
   *
   * @example
   * return context.planned.repeat({ everyMs: 200, times: 5 }, { event: { name: "blink" } })
   */
  repeat: (options: RepeatOptions, input: StrapStepInput) => PlannedStrapOccurrence[]

  /**
   * Planifie une boucle.
   * Fonctionne en mode "planned" si `until` est numérique ou temporel.
   * Bascule automatiquement en mode "jit" si `until.event` est utilisé (avec warning).
   *
   * @example
   * return context.planned.loop(
   *   { eachMs: 100, until: { type: "times", max: 10 } },
   *   ({ index }) => ({ event: { name: "tick", data: { i: index } } })
   * )
   */
  loop: (options: LoopOptions, factory: StrapStepFactory) => PlannedStrapOccurrence[]

  /**
   * Planifie plusieurs étapes en décalage progressif (une par stepMs).
   * Chaque élément de l'input est déclenché à `index * stepMs`.
   *
   * @example
   * return context.planned.stagger(
   *   { stepMs: 80 },
   *   [{ event: { name: "a:show" } }, { event: { name: "b:show" } }]
   * )
   */
  stagger: (options: StaggerOptions, input: StrapStepInput) => PlannedStrapOccurrence[]
}

// =============================================================================
// HELPERS LIVE — context.live.*
// =============================================================================

/**
 * Helpers qui planifient des étapes en mode "jit" (just-in-time).
 * Retournent un `HelperHandle` cancellable.
 * S'exécutent en temps réel — non reproductibles par seek.
 * Idéal pour les interactions ou boucles conditionnelles.
 */
export type LiveStrapHelpers = {
  /**
   * Déclenche une étape unique après `ms` millisecondes (live).
   *
   * @example
   * const handle = context.live.wait(1000, { event: { name: "timeout" } })
   * // Annuler si nécessaire : handle.cancel()
   */
  wait: (ms: number, input: StrapStepInput, options?: WaitOptions) => HelperHandle

  /**
   * Alias live de `wait`.
   */
  delay: (ms: number, input: StrapStepInput, options?: WaitOptions) => HelperHandle

  /**
   * Déclenche une série finie de `times` étapes espacées de `everyMs` ms (live).
   */
  repeat: (options: RepeatOptions, input: StrapStepInput) => HelperHandle

  /**
   * Déclenche une boucle indéfinie jusqu'à condition d'arrêt (live).
   * Supporte `until: { type: "event", name }` pour stopper sur un événement.
   *
   * @example
   * const handle = context.live.loop(
   *   { eachMs: 300, until: { type: "event", name: "drag:end" } },
   *   () => ({ event: { name: "drag:tick" } })
   * )
   */
  loop: (options: LoopOptions, factory: StrapStepFactory) => HelperHandle

  /**
   * Déclenche plusieurs étapes en décalage progressif (live).
   * Retourne un handle par étape.
   */
  stagger: (options: StaggerOptions, input: StrapStepInput) => HelperHandle[]
}

// =============================================================================
// OPTIONS DES HELPERS
// =============================================================================

/**
 * Options communes aux helpers `wait` et `delay`.
 */
export type WaitOptions = {
  /**
   * Mode d'exécution :
   * - 'planned' (défaut) : matérialisé sur la piste, reproductible par seek
   * - 'jit' : exécuté en temps réel, non reproductible
   */
  mode?: HelperMode
}

/**
 * Options du helper `repeat`.
 */
export type RepeatOptions = {
  /** Intervalle entre deux occurrences en ms. */
  everyMs: number
  /** Nombre total d'occurrences. */
  times: number
  /** Mode d'exécution (voir WaitOptions). */
  mode?: HelperMode
}

/**
 * Options du helper `loop`.
 */
export type LoopOptions = {
  /** Intervalle entre deux occurrences en ms. */
  eachMs: number
  /**
   * Condition(s) d'arrêt de la boucle.
   * Plusieurs conditions peuvent être combinées : la boucle s'arrête dès que l'une est remplie.
   */
  until: LoopStopCondition | LoopStopCondition[]
  /** Mode d'exécution ('jit' par défaut pour loop). */
  mode?: HelperMode
}

/**
 * Condition d'arrêt d'une boucle.
 */
export type LoopStopCondition =
  /** Arrêt après `max` occurrences. */
  | { type: 'times'; max: number }
  /** Arrêt après `maxMs` millisecondes écoulées. */
  | { type: 'duration'; maxMs: number }
  /** Arrêt dès qu'un événement de nom `name` est émis dans la scène. */
  | { type: 'event'; name: string }

/**
 * Options du helper `stagger`.
 */
export type StaggerOptions = {
  /** Décalage en ms entre deux éléments consécutifs. */
  stepMs: number
  /** Mode d'exécution (voir WaitOptions). */
  mode?: HelperMode
}

export type HelperMode = 'planned' | 'jit'

// =============================================================================
// CONFIGURATION DES LISTES — ListConfig
// =============================================================================

/**
 * Configuration d'animation et de performance pour les persos de type 'list'.
 */
export type ListConfig = {
  /**
   * Politique d'animation automatique FLIP sur les mouvements dans la liste.
   * Basé sur la bibliothèque AutoAnimate.
   */
  autoAnimate?: ListAutoAnimateConfig
  /** Contraintes de performance pour les grandes listes. */
  perf?: ListPerfConfig
}

export type ListAutoAnimateConfig = {
  /** Anime les insertions (défaut: true). */
  insert?: boolean
  /** Anime les suppressions (défaut: true). */
  remove?: boolean
  /** Anime les déplacements (défaut: true). */
  move?: boolean
  /** Durée des animations en ms. */
  durationMs?: number
  /** Fonction de lissage CSS (ex: 'ease', 'ease-in-out'). */
  easing?: string
  /** Décalage entre les animations des éléments de la liste en ms. */
  staggerMs?: number
}

export type ListPerfConfig = {
  /** Nombre maximum d'animations FLIP simultanées. */
  maxMoveAnimations?: number
}

// =============================================================================
// API DU PLAYER
// =============================================================================

/**
 * API publique du player Codplay.
 * Instancier `Player` (src/player/player.ts) et appeler `init` avant toute opération.
 */
export type PlayerApi = {
  /**
   * Initialise le player avec une scène compilée.
   * Doit être appelé avant `play()`.
   *
   * @param input.mountTarget — Élément DOM cible du rendu
   * @param input.compiledScene — Scène compilée par le Builder
   * @param input.strapCollection — Straps actifs pour cette session
   * @param input.runtimePolicy — Politique d'événements (cascade, rate-limiting)
   * @param input.resourceManifest — Manifeste de ressources à précharger
   */
  init: (input: PlayerInitInput) => Promise<ApiResult<void>>

  /**
   * Démarre la lecture.
   * Si la séquence était terminée, repart du début en réinitialisant le state.
   */
  play: () => Promise<ApiResult<void>>

  /**
   * Met la lecture en pause.
   * Les événements utilisateur sont désactivés pendant la pause.
   */
  pause: () => Promise<ApiResult<void>>

  /**
   * Reprend la lecture après une pause.
   * Équivalent de `play()` depuis un état pausé.
   */
  resume: () => Promise<ApiResult<void>>

  /**
   * Arrête la lecture et émet `scene:end`.
   * Différent de `pause()` : les helpers live sont détruits.
   */
  stop: () => Promise<ApiResult<void>>

  /**
   * Détruit complètement le runtime.
   * Le player ne peut pas être réutilisé après `destroy()`.
   */
  destroy: () => Promise<ApiResult<void>>

  /**
   * Déplace la tête de lecture à `timelineMs`.
   * Reconstruit l'état visuel en rejouant les entrées de piste jusqu'à cette position.
   * Les straps et effets ne sont PAS ré-exécutés — seulement les mutations matérialisées.
   */
  seek: (input: { timelineMs: number }) => Promise<ApiResult<void>>

  /**
   * Émet un événement dans la pipeline de la scène.
   * Désactivé si le player est en pause ou en seek.
   */
  emit: (input: StoryEvent) => Promise<ApiResult<void>>

  /**
   * Retourne un snapshot de l'état courant du player.
   */
  getState: () => PlayerStateSnapshot

  /**
   * Abonne un listener aux changements d'état du player.
   * Retourne une fonction de désabonnement.
   */
  onChange: (listener: (state: PlayerStateSnapshot) => void) => () => void

  /**
   * Abonne un listener aux lignes de trace du runtime (pour débogage).
   * Retourne une fonction de désabonnement.
   */
  onTrace: (listener: (row: RuntimeTraceRow) => void) => () => void

  /**
   * Accès direct aux helpers de planification hors strap.
   * Même API que `context.live.*` dans un strap, mais disponible depuis l'extérieur.
   *
   * @example
   * player.schedule.wait(2000, { name: "intro:end" })
   */
  schedule: PlayerScheduleApi
}

/**
 * Paramètres d'initialisation du player.
 */
export type PlayerInitInput = {
  /** Élément DOM cible du rendu (HTMLElement). */
  mountTarget: unknown
  /** Scène compilée produite par `builder.compile()`. */
  compiledScene: CompiledScene
  /** Manifeste de ressources à précharger (optionnel). */
  resourceManifest?: ResourceManifest
  /** Politique d'événements runtime (rate-limiting, cascade depth). */
  runtimePolicy?: RuntimeEventPolicy
  /** Collection des straps actifs pour cette session. */
  strapCollection?: StrapCollection
}

/**
 * Snapshot de l'état courant du player.
 */
export type PlayerStateSnapshot = {
  /** Statut courant de la machine d'état. */
  status: PlayerStatus
  /** True si `init()` a été appelé avec succès. */
  initialized: boolean
  /** True si la séquence a émis `sequence:end`. */
  sequenceEnded: boolean
  /** ID de la scène courante. */
  sceneId?: string
  /** Position courante de la tête de lecture en ms. */
  timelineMs: number
  /** Horizon de seek : limites calculées pour la navigation dans le temps. */
  horizon: HorizonSnapshot
  /** Numéro de révision du runtime (incrémenté à chaque rebuild). */
  runtimeRevision: number
}

export type PlayerStatus =
  | 'idle'
  | 'preloading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'rewinding'
  | 'error'

/**
 * Snapshot de l'horizon de seek — zones accessibles selon la politique configurée.
 */
export type HorizonSnapshot = {
  /** Fin de la zone effectivement jouée. */
  playedEndMs: number
  /** Fin projetée de la piste master. */
  projectedMasterEndMs: number
  /** Fin déclarée par l'auteur. */
  authorEndMs: number
  /** Fin accessible selon la politique de seek. */
  progressEndMs: number
  /** Limite maximale du seek courant. */
  seekEndMs: number
  /** Segment actif si la scène est segmentée. */
  segment?: { startMs: number; endMs: number }
}

/**
 * API de planification d'événements depuis l'extérieur d'un strap.
 * Même helpers que `context.live.*` mais utilisables directement sur le player.
 */
export type PlayerScheduleApi = {
  /** Déclenche un événement unique après `ms` ms. */
  wait: (ms: number, input: EventInput, options?: WaitOptions) => HelperHandle
  /** Alias de `wait`. */
  delay: (ms: number, input: EventInput, options?: WaitOptions) => HelperHandle
  /** Déclenche `times` événements espacés de `everyMs` ms. */
  repeat: (options: RepeatOptions, input: EventInput) => HelperHandle
  /** Boucle indéfinie avec condition d'arrêt. */
  loop: (options: LoopOptions, factory: (context: HelperTickContext) => StoryEvent[]) => HelperHandle
  /** Série d'événements en décalage progressif. */
  stagger: (options: StaggerOptions, input: EventInput) => HelperHandle[]
}

/**
 * Input des helpers de `PlayerScheduleApi` — événement direct ou factory.
 */
export type EventInput = StoryEvent | StoryEvent[] | EventFactory
export type EventFactory = (context: HelperTickContext) => StoryEvent | StoryEvent[] | void

// =============================================================================
// BUILDER
// =============================================================================

/**
 * API du compilateur de scène.
 * Transforme un `SceneDef` en `CompiledScene` prêt à être injecté dans le player.
 */
export type BuilderApi = {
  /**
   * Compile un `SceneDef` en `CompiledScene`.
   * Normalise les IDs, valide les types de persos, construit le schedule d'événements.
   */
  compile: (input: BuilderCompileInput) => ApiResult<BuilderCompileOutput>

  /**
   * Valide un `SceneDef` sans le compiler.
   * Retourne un rapport d'erreurs et d'avertissements.
   */
  validate: (input: { scene: SceneDef }) => ValidationReport

  /**
   * Exporte une `CompiledScene` via un exporteur nommé.
   */
  export: (input: BuilderExportInput) => ApiResult<{ output: unknown; warnings?: ApiWarning[] }>
}

export type BuilderCompileInput = {
  scene: SceneDef
  options?: Record<string, unknown>
}

export type BuilderCompileOutput = {
  compiledScene: CompiledScene
  resourceManifest: ResourceManifest
  diagnostics: { warnings: ApiWarning[] }
}

export type BuilderExportInput = {
  compiledScene: CompiledScene
  exporterName: string
  options?: Record<string, unknown>
}

/**
 * Scène compilée — artefact produit par le builder, consommé par le player.
 */
export type CompiledScene = {
  schemaVersion: string
  createdAt: string
  scene: SceneDef
  resources: ResourceManifest
}

export type ValidationReport = {
  ok: boolean
  errors: ValidationError[]
  warnings: ApiWarning[]
}

export type ValidationError = {
  code: string
  message: string
  details?: unknown
}

// =============================================================================
// MANIFESTE DE RESSOURCES
// =============================================================================

/**
 * Manifeste des ressources à précharger avant la lecture.
 */
export type ResourceManifest = {
  entries: ResourceManifestEntry[]
}

export type ResourceManifestEntry = {
  /** URL absolue de la ressource. */
  url: string
  /** Type de ressource. */
  type: 'video' | 'audio' | 'image' | 'font' | 'css'
  /** Politique de cache et priorité de chargement. */
  policy: {
    cache: 'default' | 'no-store' | 'immutable'
    version?: string
    hash?: string
    priority?: 'high' | 'normal' | 'low'
  }
}

// =============================================================================
// POLITIQUE RUNTIME
// =============================================================================

/**
 * Politique d'événements runtime — contrôle le comportement du dispatcher.
 */
export type RuntimeEventPolicy = {
  /**
   * Profondeur maximale de cascade d'événements.
   * Empêche les boucles infinies (défaut : 10).
   */
  maxCascadeDepth?: number
  /**
   * Nombre maximum d'événements émis par tick.
   * Protège contre les rafales d'événements.
   */
  maxEventsPerTick?: number
  /**
   * Politique de dédoublonnage des événements simultanés.
   */
  sameTickHandling?: {
    mode: 'keep-all' | 'coalesce-first' | 'coalesce-last'
    eventNames?: string[]
    key?: 'name' | 'name+data'
  }
}

// Référence opaque — définie dans src/runtime/trace-store.ts
export type RuntimeTraceRow = unknown
