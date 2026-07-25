import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION } from '@codplay/capsule-automation'
import { CapsuleDistribution, CapsulePreset, SceneDocEditor, TransitionTiming, validateSceneDoc } from '@codplay/scene-factory'
import type { AutoCapsuleChildElementArtifact, AutoCapsuleChildInput, AutoCapsuleEventInput, AutoCapsuleType } from '@codplay/capsule-automation'
import type { CapsuleKind } from '@codplay/scene-factory'
import type { Perso, SceneDef, StoryDef } from 'codplay/builder/types'
import type { CapsuleDef, Content, Decor, Easing, EditorScene, Item, Keyframe, OffsetData } from '../app/commands/types'
import { DEFAULT_EASING } from '../sequence-editor/constants'

/**
 * ed2 scenes are single-story (cf `2026-07-08-builder-plan.md` §2) — no straps, no listen.
 */
const ROOT_STORY_ID = 'story-main'

/**
 * `AutoCapsuleType` (`capsule-automation`) and `CapsuleKind` (`scene-factory`, re-exported by
 * `app/commands/types.ts`) are two separately declared types sharing the same 5 literal strings
 * (`carousel`/`rangee`/`liste`/`grille`/`card`, confirmed against `capsule-automation`'s own type
 * registry) — the two packages are deliberately decoupled (same reasoning as capsule-automation
 * losing `TIME_MODE`: each keeps its own concern, grid/placement/CSS vs. timing). This is the ONE
 * conversion point between them in this file — every call site routes through here, rather than
 * casting inline at each boundary crossing.
 */
function toCapsuleKind(capsuleType: AutoCapsuleType): CapsuleKind {
  return capsuleType as unknown as CapsuleKind
}

/**
 * Visual proof marker for step 4 (Blob CSS → `extraResources`), not a real Builder concern.
 * Once capsule-automation's own grid/placement CSS was wired in (step 5), it stopped being
 * visually obvious whether the injected stylesheet was actually applying (a full-bleed ghost
 * zone looks the same whether it's really grid-placed or just laid out by default) — kept
 * explicitly alongside the real CSS so a broken Blob/`extraResources` path stays visible. Revisit
 * once there's a real multi-item/zoned demo where the grid CSS is unmistakable on its own.
 *
 * Fixed appearance, kept stable across iterations of this increment on purpose — dashed orange,
 * same as when this marker was first introduced (step 4). `border` (not `outline`): the ghost
 * zone makes the item full-bleed (fills the whole root capsule), so its edge IS the demo
 * container's own edge (`demo-shell.css`'s `.container { overflow: hidden }`) — `outline` draws
 * OUTSIDE the border box and gets clipped there, `border` draws AT the edge, inside the box
 * (`box-sizing: border-box`, set explicitly here rather than assumed from the demo shell's own
 * reset), so it stays visible regardless of context.
 */
const STYLE_CHECK_CLASS = 'ed2-style-check'
const STYLE_CHECK_RULE = `.${STYLE_CHECK_CLASS}{box-sizing:border-box;border:4px dashed #f7b32b;}`

export type BuildSceneResult = {
  sceneDoc: SceneDef
  /**
   * Aggregated CSS for the scene (grid container + child placement rules), meant to be pushed
   * as a dynamic Blob via `extraResources` (`2026-07-08-builder-plan.md` §7) — never as a direct
   * `<style>` tag. Comes straight from `AutoCapsule.resolve().styleSheet` for the root capsule.
   */
  styleSheet: string
  /**
   * Grille résolue du capsule racine (implicite, §6) — source du ratio d'affichage de la scène
   * (`cols/rows`, `2026-07-13-controller-islands-bridge-plan.md`, aparté sur le ratio). Rien
   * n'est placé hors de cet élément ; ses dimensions réelles sont adaptatives, seul le ratio est
   * une contrainte. Pas encore un réglage de `EditorScene` — vient du défaut du type `card`
   * (`capsule-automation/config/capsule-types.ts`) tant qu'aucun champ document ne l'expose.
   */
  rootGrid: { rows: number; cols: number }
  /**
   * Temps réservé avant le `0` de la timeline auteur, pour qu'aucune `transitionIn` (qui se
   * termine AU kf, `2026-06-11-sequence-editor-grid-spec.md` §2.2) n'ait besoin de démarrer à un
   * temps négatif — `TransitionTiming.computeScenePreRollMs()`, une seule valeur pour toute la
   * scène. Le player doit décaler tout `seek({timelineMs})` de cette valeur (le `0` que voit
   * l'auteur correspond à `preRollMs` côté player).
   */
  preRollMs: number
}

/**
 * # The ed2 Builder — what it does, and how
 *
 * `buildSceneDoc()` is the single entry point: it takes one authored `EditorScene`
 * (`app/2026-07-11-ed2-document-model.md`, the normative model) and returns one Codplay `SceneDef`
 * ready to compile and play — plus the CSS the scene needs, as a separate string (see `styleSheet`
 * below).
 *
 * ## The shape of an `EditorScene`
 *
 * An `EditorScene` is a flat scene duration (`meta.durationMs`) plus a FLAT list of `Item`s
 * (`scene.items`) — the tree is derived from `parentId` + `order` (a fractional sort key), never
 * stored as a structure. Each `Item` is one of two kinds:
 * - a leaf item (today: `type: 'text'` only, §5 of the plan; other types throw rather than
 *   silently falling back to something — `mapItemTypeToPersoType`).
 * - `type: 'capsule'` — a container with its own `Item.capsule: CapsuleDef` (sub-type, grid,
 *   distribution), whose children are every OTHER item sharing this item's `id` as `parentId`. A
 *   capsule can contain other capsules, to any depth — nesting comes from the parent chain, not
 *   from a structural `children` field.
 *
 * Every scene also has an IMPLICIT root capsule the author never sees or authors directly (§6 of
 * `2026-07-08-capsule-spec.md`) — it's the one perso that actually bridges to the player's real
 * `mountTarget`; every item with `parentId: null` is really a child of it.
 *
 * ## The pipeline, capsule by capsule
 *
 * Every capsule (the implicit root, or any authored one) goes through the exact same 3-stage
 * resolution — `resolveCapsule()` is that one function, called once per capsule level:
 *
 * 1. **Timing** — `CapsulePreset.resolve()` turns a capsule's `CapsuleDef.kind` + its author-chosen
 *    `distribution` setting (`sequential` or `stagger`) into the concrete input
 *    `CapsuleDistribution.compute()` needs. Only `carousel` has a real structural default (its grid
 *    is forced to one cell, so children MUST take turns) — every other type requires an explicit
 *    `distribution`, or the Builder throws rather than guessing (Principe B). This gives every
 *    child of the capsule its resolved `{introMs, outroMs}` — when it appears/disappears, relative
 *    to the capsule's own start.
 * 2. **Grid, placement, transitions, CSS** — that resolved timing feeds a real `AutoCapsule`
 *    instance (`capsule-automation`), which resolves the grid shape, each child's placement (its
 *    own explicit placement if given, or the type's own automatic rule — including the
 *    "ghost zone" full-surface fallback for `card`-type capsules, generated automatically, no
 *    special-casing needed here), each child's intro/outro as a concrete style diff (from the
 *    keyframe's own named transition, e.g. `fade`), and the CSS backing all of it.
 * 3. **Perso + eventimes** — the resolved artifact becomes one Codplay `perso` (always `type:
 *    'list'`, whatever the capsule's own sub-type) with a `className` carrying the resolved grid/
 *    placement classes, and a couple of NAMED ACTIONS (`${id}-intro`/`${id}-outro`) carrying the
 *    resolved style diff. The `story.eventimes` array gets two pure triggers (`{name, startAt}`,
 *    no payload) pointing at those same action names — this is Principe A: an eventime only ever
 *    fires a named action, it never carries data itself.
 *
 * ## Walking the tree
 *
 * `buildSceneDoc()` doesn't recurse through a `children` structure — it works through a flat
 * worklist (a queue): resolve one capsule's children (looked up by `parentId`, sorted by `order`),
 * and for every child that is ITSELF a capsule, push its own children onto the same queue to be
 * resolved next. Nothing about Codplay's own model requires structural recursion here — a
 * `perso`'s `move.parentId` is just a plain reference to another perso's id, regardless of how
 * deep the authoring tree was, so the worklist just needs to keep track of "these items, under
 * this parent perso id" pairs.
 *
 * ## The two outputs
 *
 * - `sceneDoc` — the real `SceneDef`, built through `SceneDocEditor` (Codplay's own authoring
 *   helper), ready for `BuilderFacade.compile()`.
 * - `styleSheet` — every capsule's own resolved CSS, concatenated. This is NEVER inlined onto any
 *   perso's own `style` — only referenced through `className` — so it has to travel to the player
 *   as an actual stylesheet (a Blob → `extraResources`, see the demo wiring in
 *   `packages/demos/src/codplay/ed2-builder-demo.ts`) for the scene to render correctly at all.
 */
export function buildSceneDoc(scene: EditorScene): BuildSceneResult {
  const editor = new SceneDocEditor()

  const createResult = editor.create({ id: scene.id, name: scene.meta.title })
  if (!createResult.ok) throw new Error(createResult.error.message)

  const rootPersoId = `${ROOT_STORY_ID}__root`
  const rootDecor = scene.rootDecorId ? scene.decors[scene.rootDecorId] : undefined

  const rootItems = childrenOf(scene.items, null)

  // Une seule valeur pour toute la scène (pas par niveau de capsule) — calculée une fois ici sur
  // `scene.items` à plat, jamais recalculée par appel à `resolveCapsule()`. Voir la doc de
  // `BuildSceneResult.preRollMs`.
  const preRollMs = TransitionTiming.computeScenePreRollMs(
    scene.items.map((item) => ({
      firstKeyframe: item.keyframes[0]
        ? { timeMs: item.keyframes[0].timeMs, transitionInDurationMs: item.keyframes[0].transitionIn?.durationMs }
        : undefined,
    })),
  )

  // The root capsule is never authored (§6, no Item/no distribution setting of its own) — its
  // children are each item the author placed directly on the scene, meant to appear on their own
  // individual keyframes rather than sharing a distributed timeline. `stagger 0/0` is the
  // structural choice for that role (see `resolveCapsule`'s own doc), not a guess derived from
  // `card` — every other `card` capsule (a real, authored one) still requires its own explicit
  // `distribution` like any other non-`carousel` type.
  const rootResolution = resolveCapsule(rootItems, CAPSULE_TYPE.card, preRollMs, {
    sceneRoot: true,
    distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
  })

  const persos: Perso[] = [buildRootCapsulePerso(rootPersoId, rootDecor, rootResolution.rootArtifact)]
  const eventimes: NonNullable<StoryDef['eventimes']> = []
  const styleSheets: string[] = [rootResolution.styleSheet]

  // Flat worklist, not a recursive tree walk : Codplay's `move.parentId` is a plain reference
  // between two flat `persos` entries regardless of how deep the *authoring* tree is (no
  // relationship between authoring-tree depth and any structural recursion on the Codplay side)
  // — so every capsule level, however deep in the `parentId` chain, just resolves its own
  // children (looked up by `parentId`, sorted by `order`) and pushes into these same flat arrays.
  // Each entry carries the artifact map resolved for exactly its own sibling group — never
  // shared/mutated across entries, since two sibling groups at different depths can be pending in
  // the queue at the same time.
  type WorkItem = { items: Item[]; parentPersoId: string; childArtifactById: Map<string, AutoCapsuleChildElementArtifact> }
  const worklist: WorkItem[] = [{ items: rootItems, parentPersoId: rootPersoId, childArtifactById: rootResolution.childArtifactById }]

  while (worklist.length > 0) {
    const { items, parentPersoId, childArtifactById } = worklist.shift()!
    for (const item of items) {
      const childArtifact = childArtifactById.get(item.id)!
      if (item.type === 'capsule') {
        const { perso, itemEventimes, ownResolution } = buildNestedCapsulePerso(item, parentPersoId, childArtifact, scene, preRollMs)
        persos.push(perso)
        eventimes.push(...itemEventimes)
        styleSheets.push(ownResolution.styleSheet)
        worklist.push({ items: childrenOf(scene.items, item.id), parentPersoId: item.id, childArtifactById: ownResolution.childArtifactById })
      } else {
        const { perso, itemEventimes } = buildItemPerso(item, parentPersoId, scene, childArtifact, preRollMs)
        persos.push(perso)
        eventimes.push(...itemEventimes)
      }
    }
  }

  const story: StoryDef = {
    id: ROOT_STORY_ID,
    name: 'main',
    initial: { move: '@root' },
    persos,
    straps: undefined,
    listen: [],
    eventimes,
  }

  const upsertResult = editor.upsertStory({ story })
  if (!upsertResult.ok) throw new Error(upsertResult.error.message)

  const exportResult = editor.exportSceneDoc()
  if (!exportResult.ok) throw new Error(exportResult.error.message)

  // ed2-specific rules (implicit root capsule, `${persoId}-intro`/`-outro` action naming) that
  // Codplay's own generic `BuilderValidator` cannot know about — run here, ahead of
  // `BuilderFacade.compile()`, so a broken invariant is caught with a diagnostic that names the
  // exact perso/story at fault rather than surfacing later as a generic runtime mounting error
  // (`2026-07-08-validation-engine-plan.md`).
  const validationReport = validateSceneDoc(exportResult.data)
  if (!validationReport.ok) {
    const errorMessages = validationReport.diagnostics.filter((d) => d.level === 'error').map((d) => d.message)
    throw new Error(`buildSceneDoc: scene validation failed —\n${errorMessages.join('\n')}`)
  }

  return {
    sceneDoc: exportResult.data,
    styleSheet: `${styleSheets.join('\n')}\n${STYLE_CHECK_RULE}`,
    rootGrid: rootResolution.grid,
    preRollMs,
  }
}

/** Every item directly under `parentId` (root items when `null`), sorted by their fractional `order` key. */
function childrenOf(items: Item[], parentId: string | null): Item[] {
  return items.filter((item) => item.parentId === parentId).sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
}

/** `item.keyframes` in chronological order — the array itself carries no ordering guarantee (`createKeyframe` only ever appends). */
function sortedKeyframes(item: Item): Keyframe[] {
  return [...item.keyframes].sort((a, b) => a.timeMs - b.timeMs)
}

/**
 * Style résolu EN CASCADE d'un keyframe donné — `item.initialDecorId` ⊕ tous les kf antérieurs
 * (triés) ⊕ le décor propre du kf, chacun passé par `resolveDecorStyle` puis fusionnés dans cet
 * ordre. Même cascade que `decor-editor-bridge.ts::resolveEffectiveKeyframePatch` (dedit) — un kf
 * dont le décor est vide (rien n'a encore divergé dessus) hérite donc bien du style de ses
 * prédécesseurs ici aussi, au lieu d'apparaître comme "aucun style" au diff.
 * Divergence corrigée le jour où `buildKeyframeDecorActions` comparait `scene.decors[kf.decorId]`
 * BRUT (jamais la cascade) — un kf1 vide produisait un diff `{} → styleDeKf2`, donc TOUTES les
 * propriétés de kf2 (y compris celles inchangées depuis le preset) apparaissaient comme animées
 * depuis rien, cassant l'interpolation réelle (`2026-07-17`, repro utilisateur en direct).
 */
function resolveKeyframeCascadeStyle(item: Item, scene: EditorScene, targetKf: Keyframe): Record<string, unknown> {
  const initial = scene.decors[item.initialDecorId]
  const precedingDecors = sortedKeyframes(item)
    .filter((k) => k.timeMs < targetKf.timeMs)
    .map((k) => scene.decors[k.decorId])
  const ownDecor = scene.decors[targetKf.decorId]
  const layers = [initial, ...precedingDecors, ownDecor]
  return layers.reduce((acc, d) => ({ ...acc, ...resolveDecorStyle(d) }), {} as Record<string, unknown>)
}

type CapsuleResolution = {
  rootArtifact: { className: string }
  childArtifactById: Map<string, AutoCapsuleChildElementArtifact>
  styleSheet: string
  /** Grille effectivement résolue pour ce niveau — `result.grid.context` (`AutoCapsule.resolve()`). */
  grid: { rows: number; cols: number }
}

/**
 * Resolve one capsule's timing (`CapsuleDistribution`), then grid/placement/transitions/CSS
 * (`AutoCapsule`) — `2026-07-08-capsule-spec.md` §7 pipeline. Used for the root capsule (always
 * `card`, §6) and for any nested capsule (`CapsuleDef.kind`, §3) — the same pipeline at any depth,
 * only the type and the child list change.
 *
 * Ghost-zone placement (§3/§11, full grid surface) only applies to `card` — `placementPolicy:
 * explicitOnly`, the only type where an unplaced child gets no placement at all
 * (`resolveAutoCapsulePlacement`, capsule-automation) unless one is supplied here. Every other
 * type (`carousel`/`rangee`/`liste`/`grille`) has `placementPolicy: auto`/`mixed` and resolves its
 * own placement from the grid when none is given — so `setChildPlacement` is skipped there,
 * deliberately, rather than forcing a ghost zone that isn't part of those types' own semantics.
 *
 * `options.sceneRoot` marks the ONE capsule bridging the scene to its real host container (the
 * player's `mountTarget`) — never a nested capsule, which sizes from its own grid/content instead.
 * Passed straight to `AutoCapsuleDefinition.sceneRoot`, which is capsule-automation's own concern
 * to turn into a `width:100%;height:100%` CSS rule on the generated grid class.
 *
 * `options.grid` reads a capsule item's own `CapsuleDef.grid` override when present — passed
 * straight to `AutoCapsuleGridInput.rows`/`.cols`, never invented here (Principe B): absent input
 * stays absent, falling back to the type's own default (`config/capsule-types.ts`).
 *
 * `options.distribution` is resolved through `CapsulePreset` (`2026-06-12-capsule-distribution-
 * spec.md` §3.3) — the one place `CapsuleKind` → concrete `mode` resolution lives, shared with
 * `sequence-editor`'s own preview. `CapsuleDistribution` itself knows nothing about capsule
 * sub-types; it only ever receives an already-resolved `mode`. `staggerInMs:0`/`staggerOutMs:0` is
 * a genuine no-op of `CapsuleDistribution.computeStagger`'s own math (every free child resolves to
 * the whole clip span; a fully-locked child keeps its exact range regardless) — not a special
 * case this Builder branches on, present or not it produces the identical result.
 *
 * `preRollMs` (see `BuildSceneResult.preRollMs`) is computed ONCE in `buildSceneDoc()` and passed
 * down unchanged to every level — every item is resolved by exactly one `resolveCapsule()` call
 * (root, or exactly one parent capsule), so it is never applied twice to the same item. The actual
 * bound math (`kf.timeMs ± duration`, shifted by `preRollMs`) lives in `TransitionTiming`
 * (`@codplay/scene-factory`) — this Builder only calls it, per Principe B/the Builder's own
 * orchestrator-only convention (same reasoning as `CapsulePreset`/`CapsuleDistribution` above).
 */
function resolveCapsule(
  items: Item[],
  capsuleType: AutoCapsuleType,
  preRollMs: number,
  options?: { sceneRoot?: boolean; grid?: { rows?: number; cols?: number }; distribution?: CapsuleDef['distribution'] },
): CapsuleResolution {
  const preset = CapsulePreset.resolve({ capsuleType: toCapsuleKind(capsuleType), distribution: options?.distribution })
  const distribution = CapsuleDistribution.compute({
    clipDurationMs: items.reduce((max, item) => Math.max(max, item.keyframes[item.keyframes.length - 1]?.timeMs ?? 0), 0) + preRollMs,
    ...preset,
    children: items.map((item) => ({
      trackId: item.id,
      lockedIntroMs: TransitionTiming.lockedIntroMs(
        item.keyframes[0]
          ? { timeMs: item.keyframes[0].timeMs, transitionInDurationMs: item.keyframes[0].transitionIn?.durationMs }
          : undefined,
        preRollMs,
      ),
      lockedOutroMs: TransitionTiming.lockedOutroMs(item.keyframes[item.keyframes.length - 1], preRollMs),
    })),
  })

  const childInputs: AutoCapsuleChildInput[] = items.map((item, index) => {
    const timing = distribution.children.find((child) => child.trackId === item.id)!
    return {
      id: item.id,
      order: index,
      timeRange: { startMs: timing.introMs, endMs: timing.outroMs },
      events: buildTransitionEvents(item),
    }
  })

  const autoCapsule = new AutoCapsule(
    {
      capsule: {
        id: 'root',
        type: capsuleType,
        grid: { rows: options?.grid?.rows, cols: options?.grid?.cols },
        sceneRoot: options?.sceneRoot,
        // `card` (et d'autres types) portent un défaut de type `fade` (`config/capsule-types.ts`,
        // hérité d'Eddy, pensé pour d'autres appelants) — sans cette surcharge, un enfant SANS
        // transition authored sur son propre keyframe hérite silencieusement de ce fondu : une
        // transition qu'aucune donnée du document ne porte, invisible dans la timeline, non
        // éditable, et qui produit des cas de bord insolubles (ex. un kf à t=0 « au milieu » d'un
        // fondu qui n'a matériellement pas la place de se jouer). C'est exactement ce que Principe
        // B interdit — corrigé ici, pas en amont dans `capsule-automation` (comportement partagé
        // par d'autres appelants, hors périmètre ed2). `cut` = aucune animation, visibilité
        // instantanée : le seul « défaut » qui ne soit pas lui-même une donnée inventée.
        defaults: { introTransitionRef: 'cut', outroTransitionRef: 'cut' },
      },
      children: childInputs,
    },
    { autoResolveOnWrite: false },
  )

  // Ghost-zone placement for `explicitOnly` types (ex. `card`, §3/§11) is resolved entirely
  // inside `AutoCapsule.resolve()`/`resolveAutoCapsulePlacement` now — declarative, automatic for
  // any current or future `explicitOnly` type, no `capsuleType === CAPSULE_TYPE.card` branching
  // needed here at all (previously a literal-comparison special case in this file).
  const result = autoCapsule.resolve()

  return {
    rootArtifact: { className: result.capsule.className },
    childArtifactById: new Map(result.children.map((child) => [child.id, child])),
    styleSheet: result.styleSheet,
    grid: { rows: result.grid.context.rows, cols: result.grid.context.cols },
  }
}

/**
 * Read the transition the author actually chose, from the item's own keyframes
 * (`Keyframe.transitionIn`/`.transitionOut`) — never a value this Builder invents (Principe B).
 * A clean, deterministic name (`${item.id}-intro`/`-outro`) is supplied explicitly too, so the
 * resolved event doesn't fall back to `AutoCapsule`'s auto-generated synthetic name.
 *
 * If a bound has no named transition, it's simply omitted here — `resolveAutoCapsuleEvents` then
 * synthesizes it from the capsule/type's own default ref, still under an auto-generated name
 * (acceptable: that fallback path is capsule-automation's documented behavior, not an invented
 * Builder default).
 */
function buildTransitionEvents(item: Item): AutoCapsuleChildInput['events'] {
  const introRef = extractNamedTransitionRef(item.keyframes[0]?.transitionIn)
  const outroRef = extractNamedTransitionRef(item.keyframes[item.keyframes.length - 1]?.transitionOut)
  const events: Partial<Record<string, AutoCapsuleEventInput>> = {}

  if (introRef) {
    events[EVENT_ACTION.intro] = {
      action: EVENT_ACTION.intro,
      name: `${item.id}-intro`,
      ref: introRef.name,
      durationMs: introRef.durationMs,
    }
  }
  if (outroRef) {
    events[EVENT_ACTION.outro] = {
      action: EVENT_ACTION.outro,
      name: `${item.id}-outro`,
      ref: outroRef.name,
      durationMs: outroRef.durationMs,
    }
  }
  return events
}

function extractNamedTransitionRef(transition: Keyframe['transitionIn']): { name: string; durationMs: number } | undefined {
  if (transition?.kind !== 'named') return undefined
  return { name: transition.name, durationMs: transition.durationMs }
}

/**
 * The root capsule — always `list`, always `move:'@root'`, never receives an eventime
 * (`2026-07-08-capsule-spec.md` §6). Its decor is resolved once here, statically — no keyframe.
 *
 * The grid layout (`display:grid`, template columns/rows) AND the `width:100%;height:100%` fill —
 * needed since this capsule bridges the scene to its real host container, `mountTarget` — come
 * ONLY from the resolved `className` (`resolveCapsule(..., {sceneRoot:true})`), never duplicated
 * as inline style here — those rules live in `styleSheet` (Blob → `extraResources`). Setting them
 * inline too would silently work even if that delivery mechanism broke, defeating the point of
 * validating it (`2026-07-08-builder-plan.md` step 4).
 */
function buildRootCapsulePerso(
  rootPersoId: string,
  rootDecor: Decor | undefined,
  rootArtifact: CapsuleResolution['rootArtifact'],
): Perso {
  return {
    id: rootPersoId,
    name: 'root',
    type: 'list',
    initial: {
      move: '@root',
      tag: 'div',
      className: rootArtifact.className || undefined,
      style: {
        ...rootDecor?.style,
      },
    },
    actions: {},
  }
}

type TransitionActionsResult = {
  /** Named actions to merge into `perso.actions` — one entry per resolved intro/outro. */
  actions: Record<string, unknown>
  /** Pure triggers (`{name, startAt}`) for `story.eventimes` — Principe A, no payload. */
  itemEventimes: NonNullable<StoryDef['eventimes']>
  /**
   * The intro transition's own `from` values, keyed by CSS prop — meant to seed a perso's
   * `initial.style` so it starts in the pre-transition state rather than snapping into `to`
   * before the intro event fires. Empty when the resolved intro has no style diff (e.g. `cut`).
   */
  initialStyleFromIntro: Record<string, unknown>
}

/**
 * Resolve one child's intro/outro (`AutoCapsuleChildElementArtifact.events`) into named actions +
 * trigger eventimes — the shared mechanics behind BOTH a leaf item's transitions and a nested
 * capsule's own transitions (as a child of ITS parent capsule). A capsule is exactly as much a
 * "child with an intro/outro" as any other item here — nothing about containing further children
 * changes how it participates as someone else's child, so this is not duplicated per perso kind.
 */
function resolveTransitionActions(childArtifact: AutoCapsuleChildElementArtifact): TransitionActionsResult {
  const actions: Record<string, unknown> = {}
  const itemEventimes: NonNullable<StoryDef['eventimes']> = []

  for (const event of Object.values(childArtifact.events)) {
    const styleDiff = event.definition?.style?.[event.action]
    // `cut` resolves to a truthy but EMPTY style object ({}), not undefined — Object.keys catches
    // it where a bare `!styleDiff` check wouldn't. No resolved style → no action, so no eventime
    // to trigger it either (nothing to fire, Principe B: no dangling no-op event).
    if (!styleDiff || Object.keys(styleDiff).length === 0) continue
    const stylePayload: Record<string, unknown> = {}
    for (const [prop, transition] of Object.entries(styleDiff)) {
      stylePayload[prop] = { ...transition, duration: event.durationMs || undefined }
    }
    actions[event.name] = { style: stylePayload }
    itemEventimes.push({ name: event.name, startAt: event.triggerMs })
  }

  const introStyleDiff = childArtifact.events.intro?.definition?.style?.intro
  const initialStyleFromIntro: Record<string, unknown> = {}
  if (introStyleDiff) {
    for (const [prop, transition] of Object.entries(introStyleDiff)) {
      if (transition.from !== undefined) initialStyleFromIntro[prop] = transition.from
    }
  }

  return { actions, itemEventimes, initialStyleFromIntro }
}

type NestedCapsuleBuildResult = {
  perso: Perso
  itemEventimes: NonNullable<StoryDef['eventimes']>
  ownResolution: CapsuleResolution
}

/**
 * Build a nested capsule's own perso — same `list` mapping and the same intro/outro-as-named-
 * action treatment as any other item (`resolveTransitionActions`, §5, Principe A: a capsule is a
 * child of its parent capsule exactly like a leaf item is, nothing exempts it from that), but it
 * ALSO resolves its own grid/timing pipeline for its own children (`resolveCapsule`, using its
 * `CapsuleDef.kind`, §3) — the same pipeline as the root, just parameterized. `flip:false` on its
 * move is the one thing every capsule's own children carry regardless of nesting depth, since
 * it's specifically the FLIP animation on a `list`'s direct children this is defusing
 * (`2026-07-08-capsule-spec.md` §6), not a root-only concern.
 *
 * `initialStyleFromIntro` is intentionally NOT applied here (unlike `buildItemPerso`) — a capsule
 * perso has no `initial.style` at all today, its layout comes only from its class (same principle
 * as the root capsule, §"buildRootCapsulePerso" above: never duplicate what the injected
 * stylesheet already covers). If a capsule ever needs a transition that isn't purely
 * class/CSS-driven, that's a real gap to revisit then, not one to paper over now.
 *
 * `CapsuleKind` and `AutoCapsuleType` are the same literal strings today (`carousel`/`rangee`/
 * `liste`/`grille`/`card`, confirmed in `capsule-automation`'s own registry) — no translation
 * table, just a type-level cast at this one boundary between the two packages' vocabularies.
 */
function buildNestedCapsulePerso(
  item: Item,
  parentPersoId: string,
  childArtifact: AutoCapsuleChildElementArtifact,
  scene: EditorScene,
  preRollMs: number,
): NestedCapsuleBuildResult {
  if (!item.capsule) throw new Error(`buildSceneDoc: capsule item '${item.id}' has no CapsuleDef`)

  const ownResolution = resolveCapsule(childrenOf(scene.items, item.id), item.capsule.kind as AutoCapsuleType, preRollMs, {
    grid: item.capsule.grid,
    distribution: item.capsule.distribution,
  })
  const { actions, itemEventimes } = resolveTransitionActions(childArtifact)

  const perso: Perso = {
    id: item.id,
    name: item.id,
    type: 'list',
    initial: {
      move: { parentId: parentPersoId, flip: false },
      tag: 'div',
      className: [ownResolution.rootArtifact.className, childArtifact.className].filter(Boolean).join(' '),
    },
    actions,
  }

  return { perso, itemEventimes, ownResolution }
}

type ItemBuildResult = {
  perso: Perso
  itemEventimes: NonNullable<StoryDef['eventimes']>
}

/**
 * Build one item's perso and its intro/outro eventimes from the already-resolved
 * `AutoCapsuleChildElementArtifact` — placement class from capsule-automation, transitions
 * turned into named actions (`resolveTransitionActions`, Principe A) : the eventime only
 * triggers `${item.id}-intro`/`${item.id}-outro` at the resolved `triggerMs`, the action itself
 * carries the resolved style diff, never the eventime.
 */
function buildItemPerso(
  item: Item,
  rootPersoId: string,
  scene: EditorScene,
  childArtifact: AutoCapsuleChildElementArtifact,
  preRollMs: number,
): ItemBuildResult {
  const persoType = mapItemTypeToPersoType(item.type)
  const introDecor = scene.decors[item.initialDecorId]
  const firstKf = sortedKeyframes(item)[0]
  const firstKfDecor = firstKf ? scene.decors[firstKf.decorId] : undefined
  const content = item.contentId ? scene.contents[item.contentId] : undefined

  const { actions: transitionActions, itemEventimes: transitionEventimes, initialStyleFromIntro } = resolveTransitionActions(childArtifact)
  const { actions: decorActions, itemEventimes: decorEventimes } = buildKeyframeDecorActions(item, scene, preRollMs)

  const common = {
    move: { parentId: rootPersoId, flip: false },
    className: [childArtifact.className, STYLE_CHECK_CLASS].filter(Boolean).join(' '),
    // Un seul état initial, une seule autorité par propriété : `initialStyleFromIntro` (le `from`
    // de la transition nommée d'entrée, s'il y en a une) < `introDecor` (`item.initialDecorId`,
    // réglages qui ne dépendent d'aucun kf) < le décor du PREMIER kf (le plus spécifique — ce que
    // l'auteur a réellement fixé à cet instant), `translate`/`rotate`/`scale` inclus (fusionnés en
    // style, `resolveDecorStyle` — cf `OffsetData`, un module dedit qui fusionne avec le style,
    // pas un mécanisme séparé). Le premier kf n'a donc jamais sa propre action
    // (`buildKeyframeDecorActions` ne lui en crée pas) : sans ça, cette même propriété serait
    // réglée deux fois au même instant — un cut ici ET une animation démarrant juste après,
    // en course l'une contre l'autre (lecture hachée, signalé en test réel).
    style: {
      ...initialStyleFromIntro,
      ...resolveDecorStyle(introDecor),
      ...resolveDecorStyle(firstKfDecor),
    },
  }

  const perso: Perso = {
    id: item.id,
    name: item.id,
    type: persoType,
    initial: buildItemInitial(persoType, item, scene, content, common),
    actions: { ...transitionActions, ...decorActions },
  }

  return { perso, itemEventimes: [...transitionEventimes, ...decorEventimes] }
}

/**
 * `2026-06-11-sequence-editor-grid-spec.md` §2.2, "Transition d'état de décor" : « **par défaut
 * automatique, couvre tout l'intervalle entre les deux [kf]**... Le builder calcule l'animation
 * depuis le diff entre les décors adjacents ; la grille ne stocke que durée/easing/direction,
 * jamais le diff lui-même. » — l'interpolation N'EST PAS conditionnée à la présence d'un
 * `TransitionDef` explicite : deux kf adjacents dont le décor diffère s'animent TOUJOURS sur tout
 * l'intervalle qui les sépare, par défaut. Un `TransitionDef` (`kf.transitionIn`/`prevKf.
 * transitionOut`, règle d'exclusivité §2.2, jamais les deux à la fois) ne fait que SURCHARGER ce
 * défaut — raccourcir la fenêtre (`durationMs` < intervalle, `direction` choisit quel bord la
 * porte), changer l'`easing`, ou couper franchement (`durationMs:0`). Principe A étendu aux kf
 * intermédiaires, pas seulement intro/outro (`resolveTransitionActions` ne couvre que le diff de la
 * transition NOMMÉE d'une borne, ex. `fade` → `opacity` ; jamais `Keyframe.decorId` lui-même, donc
 * jamais une propriété de décor hors du preset, ex. `background-color`).
 *
 * Pour chaque paire de kf adjacents (triés par `timeMs` — l'ordre du tableau n'est pas garanti,
 * `createKeyframe` se contente d'ajouter en fin) : diff des décors résolus, propriété par
 * propriété. Une propriété inchangée n'émet rien (Principe B). `{to,duration,easing}` — `from` est
 * facultatif sur `StyleTransitionValue`, jamais fourni ici : le runtime interpole depuis la valeur
 * actuelle du perso, plus robuste qu'un `from` figé recalculé depuis le document au moment du
 * build. Déclenchement via `TransitionTiming.interpolatedTransitionTriggerMs` (`direction:'before'`
 * s'achève AU kf destination, `'after'` — défaut — démarre AU kf source, §2.2) ; `durationMs:0`
 * (cut explicite) dégénère en cut instantané, `Math.max` évite toute durée négative égarée.
 * Le premier kf n'a pas de prédécesseur : son décor est déjà porté par `initial.style`
 * (`buildItemPerso`, `sortedKeyframes(item)[0]`) — jamais une action ici, sinon la même propriété
 * serait réglée deux fois au même instant (un cut ET l'animation du segment suivant, en course).
 */
function buildKeyframeDecorActions(
  item: Item,
  scene: EditorScene,
  preRollMs: number,
): { actions: Record<string, unknown>; itemEventimes: NonNullable<StoryDef['eventimes']> } {
  const actions: Record<string, unknown> = {}
  const itemEventimes: NonNullable<StoryDef['eventimes']> = []
  const keyframes = sortedKeyframes(item)

  for (let i = 1; i < keyframes.length; i++) {
    const kf = keyframes[i]!
    const prevKf = keyframes[i - 1]!
    const actionName = `${item.id}-kf-${kf.id}`
    const fromStyle = resolveKeyframeCascadeStyle(item, scene, prevKf)
    const diff = computeStyleDiff(fromStyle, resolveKeyframeCascadeStyle(item, scene, kf))
    if (Object.keys(diff).length === 0) continue

    const transition = kf.transitionIn ?? prevKf.transitionOut
    const fullIntervalMs = Math.max(0, kf.timeMs - prevKf.timeMs)
    const durationMs = transition?.kind === 'interpolated' ? transition.durationMs : fullIntervalMs
    const ease = transition?.kind === 'interpolated' ? resolveEasingString(transition.easing) : resolveEasingString(DEFAULT_EASING)
    const direction = transition?.kind === 'interpolated' ? transition.direction ?? 'after' : 'after'

    if (durationMs <= 0) {
      actions[actionName] = { style: diff }
      itemEventimes.push({ name: actionName, startAt: kf.timeMs + preRollMs })
    } else {
      // `from` explicite, calculé depuis le PERSO (cascade résolue, cqw natif) — jamais dérivé
      // du node/d'un cache anime.js implicite. Sans ça, anime.js devine le `from` depuis l'état
      // courant du target au moment du trigger : fiable par coïncidence pour le node réel (déjà
      // posé au style initial statique), mais absent pour tout autre récepteur qui rejouerait la
      // même transition sans partager ce cache (ex. un objet miroir vierge) — bug constaté en
      // direct, `2026-07-25-perso-state-at-t-plan.md` : la couleur dérivait vers le noir/transparent
      // près du début d'une transition, faute d'un `from` connu du perso lui-même.
      const stylePayload: Record<string, unknown> = {}
      for (const [prop, value] of Object.entries(diff)) {
        const from = fromStyle[prop]
        stylePayload[prop] = from === undefined ? { to: value, duration: durationMs, ease } : { from, to: value, duration: durationMs, ease }
      }
      actions[actionName] = { style: stylePayload }
      const triggerMs = TransitionTiming.interpolatedTransitionTriggerMs({
        sourceKfTimeMs: prevKf.timeMs,
        destKfTimeMs: kf.timeMs,
        durationMs,
        direction,
      })
      itemEventimes.push({ name: actionName, startAt: triggerMs + preRollMs })
    }
  }

  return { actions, itemEventimes }
}

/**
 * `OffsetData` (décalage libre — transform + dimensions, distinct de la future `position` de
 * grille) est un module dedit qui fusionne avec le style (pas un mécanisme séparé) — sa partie
 * animable se résout vers les mêmes clés que `Decor.style` porte déjà pour ce même rôle,
 * confirmées par une scène ed2 réelle (`packages/demos/src/scenes/s6-dnd-list-scene.ts`, `x`/`y`
 * mélangés à du CSS classique — `zIndex` — dans le même objet `style`, aussi bien en action qu'en
 * `event.data`). Codplay applique `style` (aussi bien `initial` que les actions) via
 * `animejs.utils.set`/le moteur de transition — jamais une assignation DOM littérale — donc toute
 * grandeur numérique y suit la convention anime.js « unitless = px » (`core/consts.js`,
 * `unitsExecRgx`, un suffixe alphabétique est requis pour toute autre unité). `translate`/`width`/
 * `height` sont en `cqw` dans `OffsetData` (jamais des px) : ils sortent donc en CHAÎNE avec
 * suffixe (`'50.39cqw'`), jamais en nombre brut, `width`/`height` confirmés par la même scène
 * réelle (`width: '480px'`, jamais un nombre nu). `rotate` (degrés) et `scaleX`/`scaleY` (facteurs
 * sans dimension) n'ont pas cette ambiguïté — nombre brut inchangé. `anchor`/`ratio` (reste de la
 * partie statique de `OffsetData`) restent hors périmètre ici — aucune résolution ne leur
 * correspond nulle part dans ce dépôt, gap séparé.
 */
function resolveOffsetAsStyle(offset: OffsetData | undefined): Record<string, unknown> {
  if (!offset) return {}
  const out: Record<string, unknown> = {}
  if (offset.translate?.x !== undefined) out.x = `${offset.translate.x}cqw`
  if (offset.translate?.y !== undefined) out.y = `${offset.translate.y}cqw`
  if (offset.rotate !== undefined) out.rotate = offset.rotate
  if (offset.scale?.x !== undefined) out.scaleX = offset.scale.x
  if (offset.scale?.y !== undefined) out.scaleY = offset.scale.y
  if (offset.width !== undefined) out.width = `${offset.width}cqw`
  if (offset.height !== undefined) out.height = `${offset.height}cqw`
  return out
}

/**
 * `Decor.custom` (CSS libre, panneau « Custom ») résolu en propriétés de style — même traitement
 * qu'`resolveOffsetAsStyle` ci-dessus (un champ structuré du décor, converti en `Record` de style),
 * juste plus simple : une chaîne à découper, pas plusieurs champs à convertir avec leurs unités.
 * Déclarations séparées par `;`, `propriété: valeur` — une déclaration mal formée (pas de `:`) est
 * ignorée plutôt que de lever, cohérent avec « CSS libre, responsabilité auteur »
 * (`decor-editor/types.ts`).
 */
function resolveCustomAsStyle(custom: string | undefined): Record<string, unknown> {
  if (!custom) return {}
  const out: Record<string, unknown> = {}
  for (const declaration of custom.split(';')) {
    const separatorIndex = declaration.indexOf(':')
    if (separatorIndex === -1) continue
    const prop = declaration.slice(0, separatorIndex).trim()
    const value = declaration.slice(separatorIndex + 1).trim()
    if (prop && value) out[prop] = value
  }
  return out
}

/** Le style résolu d'un décor pour toute fin de diff/action — `Decor.style`, la partie animable de `Decor.offset`, et `Decor.custom` fusionnés, un seul enregistrement (`custom` en dernier : « responsabilité auteur », l'emporte en cas de conflit). */
function resolveDecorStyle(decor: Decor | undefined): Record<string, unknown> {
  return { ...decor?.style, ...resolveOffsetAsStyle(decor?.offset), ...resolveCustomAsStyle(decor?.custom) }
}

/**
 * Diff propriété par propriété entre deux styles de décor résolus — seules les propriétés qui
 * changent réellement émettent une entrée (Principe B, rien d'inventé pour une valeur inchangée).
 * Une propriété présente dans `fromStyle` mais absente de `toStyle` n'apparaît jamais dans le diff
 * — on ne parcourt que les clés de `toStyle` : rien ne la touche, elle reste telle quelle (principe
 * du diff — l'absence d'un réglage n'est pas une instruction de le retirer).
 */
function computeStyleDiff(
  fromStyle: Record<string, unknown> | undefined,
  toStyle: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {}
  for (const [prop, toValue] of Object.entries(toStyle ?? {})) {
    if (fromStyle?.[prop] === toValue) continue
    diff[prop] = toValue
  }
  return diff
}

/**
 * `Easing` (`app/commands/types.ts`, casse à tiret CSS-like — `'ease-in'`) → nom historique CodPlay
 * (`packages/codplay/src/animation/adapter.ts::normalizeAnimeEase`, casse `easeIn`/`easeOut`/
 * `easeInOut`, converti ensuite vers Anime.js v4). Simple question de nomenclature entre les deux
 * packages, pas de logique — alignée sur CodPlay ici plutôt que l'inverse (un seul point de
 * conversion, même patron que `toCapsuleKind`). `cubic-bezier` produit la syntaxe CSS standard.
 */
const EASING_TO_CODPLAY: Record<string, string> = {
  linear: 'linear',
  'ease-in': 'easeIn',
  'ease-out': 'easeOut',
  'ease-in-out': 'easeInOut',
}

function resolveEasingString(easing: Easing): string {
  if (typeof easing === 'string') return EASING_TO_CODPLAY[easing] ?? easing
  return `cubic-bezier(${easing.p1x},${easing.p1y},${easing.p2x},${easing.p2y})`
}

/**
 * Forme d'`initial` propre à chaque type de perso (`2026-07-08-builder-plan.md` §5) — `move`/
 * `className`/`style` sont communs (placement/transition, indifférents au type de contenu) ;
 * `tag`/`src`/`content`/`master` divergent. `content?.source` absent reste absent (Principe B,
 * jamais une chaîne vide inventée) ; `master` est une vraie donnée dérivée du document
 * (`scene.masterItemId`), jamais un défaut deviné.
 */
function buildItemInitial(
  persoType: string,
  item: Item,
  scene: EditorScene,
  content: Content | undefined,
  common: { move: { parentId: string; flip: boolean }; className: string; style: Record<string, unknown> },
): Record<string, unknown> {
  if (persoType === 'img') {
    return { ...common, src: content?.source }
  }
  if (persoType === 'media') {
    return { ...common, tag: item.type === 'video' ? 'video' : 'audio', src: content?.source, master: item.id === scene.masterItemId }
  }
  return { ...common, tag: 'div', content: resolveContentText(content) }
}

/** The `content` a text perso shows — only `Content.text` is mapped in this increment (§5 of the plan). */
function resolveContentText(content: Content | undefined): string | undefined {
  return content?.text
}

/**
 * `2026-07-08-builder-plan.md` §5 — table de mapping complète. `bloc` (item pas encore différencié,
 * `2026-07-08-item-model-spec.md` §5) rend un `text` à contenu vide, jamais une levée — ce n'est
 * pas une valeur `ItemType` distincte, seulement l'état initial de tout item avant `assignType`.
 * `image` → `img` (piège de nom confirmé : `ResourceManifestEntry.type` utilise `'image'`, le
 * perso Codplay utilise `'img'`). `capsule` n'atteint jamais cette fonction (branché séparément,
 * `buildNestedCapsulePerso`) — le throw n'est qu'un filet d'exhaustivité.
 */
function mapItemTypeToPersoType(itemType: Item['type']): string {
  if (itemType === 'bloc' || itemType === 'text') return 'text'
  if (itemType === 'image') return 'img'
  if (itemType === 'video' || itemType === 'media') return 'media'
  throw new Error(`buildSceneDoc: unsupported item type '${itemType}'`)
}
