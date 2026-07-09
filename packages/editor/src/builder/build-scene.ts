import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION } from '@codplay/capsule-automation'
import { CapsuleDistribution, CapsulePreset, SceneDocEditor } from '@codplay/scene-factory'
import type { AutoCapsuleChildElementArtifact, AutoCapsuleChildInput, AutoCapsuleEventInput, AutoCapsuleType } from '@codplay/capsule-automation'
import type { CapsuleKind } from '@codplay/scene-factory'
import type { Perso, SceneDef, StoryDef } from 'codplay/builder/types'
import type { EditorScene, Keyframe, TrackDistribution, TrackNode } from '../sequence-editor/types'

/**
 * ed2 scenes are single-story (cf `2026-07-08-builder-plan.md` §2) — no straps, no listen.
 */
const ROOT_STORY_ID = 'story-main'

/**
 * `AutoCapsuleType` (`capsule-automation`) and `CapsuleKind` (`scene-factory`, `sequence-editor`'s
 * own re-export) are two separately declared types sharing the same 5 literal strings
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
}

/**
 * # The ed2 Builder — what it does, and how
 *
 * `buildSceneDoc()` is the single entry point: it takes one authored `EditorScene` (the data
 * model `sequence-editor`/`decor-editor` produce) and returns one Codplay `SceneDef` ready to
 * compile and play — plus the CSS the scene needs, as a separate string (see `styleSheet` below).
 *
 * ## The shape of an `EditorScene`
 *
 * An `EditorScene` is a flat scene duration (`durationMs`) plus a tree of `TrackNode`s
 * (`scene.tracks`). Each `TrackNode` is one of two kinds:
 * - `kind: 'element'` — a leaf item (today: `contentType: 'text'` only, §5 of the plan; other
 *   content types throw rather than silently falling back to something — `mapContentTypeToPersoType`).
 * - `kind: 'capsule'` — a container with its own `children: TrackNode[]`, its own `capsuleType`
 *   (`carousel`/`rangee`/`liste`/`grille`/`card`), and its own `keyframes` (when it appears/
 *   disappears). A capsule can contain other capsules, to any depth — `capsule-a` holding
 *   `capsule-b` holding a leaf item is exactly as valid as one flat level.
 *
 * Every scene also has an IMPLICIT root capsule the author never sees or authors directly (§6 of
 * `2026-07-08-capsule-spec.md`) — it's the one perso that actually bridges to the player's real
 * `mountTarget`, and every top-level track in `scene.tracks` is really a child of it.
 *
 * ## The pipeline, capsule by capsule
 *
 * Every capsule (the implicit root, or any authored one) goes through the exact same 3-stage
 * resolution — `resolveCapsule()` is that one function, called once per capsule level:
 *
 * 1. **Timing** — `CapsulePreset.resolve()` turns a capsule's `capsuleType` + its author-chosen
 *    `distribution` setting (`sequential` or `stagger`, `TrackNode.distribution`) into the concrete
 *    input `CapsuleDistribution.compute()` needs. Only `carousel` has a real structural default
 *    (its grid is forced to one cell, so children MUST take turns) — every other type requires an
 *    explicit `distribution`, or the Builder throws rather than guessing (Principe B). This gives
 *    every child of the capsule its resolved `{introMs, outroMs}` — when it appears/disappears,
 *    relative to the capsule's own start.
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
 * `buildSceneDoc()` doesn't recurse through `TrackNode.children` as a call stack — it works
 * through a flat worklist (a queue): resolve one capsule's children, and for every child that is
 * ITSELF a capsule, push its own children onto the same queue to be resolved next. Nothing about
 * Codplay's own model requires structural recursion here — a `perso`'s `move.parentId` is just a
 * plain reference to another perso's id, regardless of how deep the authoring tree was, so the
 * worklist just needs to keep track of "these tracks, under this parent perso id" pairs.
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

  const createResult = editor.create({ id: scene.id, name: scene.title })
  if (!createResult.ok) throw new Error(createResult.error.message)

  const rootPersoId = `${ROOT_STORY_ID}__root`
  const rootDecor = scene.rootDecorId ? scene.decors[scene.rootDecorId] : undefined

  // The root capsule is never authored (§6, no TrackNode/no distribution setting of its own) —
  // its children are each item the author placed directly on the scene, meant to appear on their
  // own individual keyframes rather than sharing a distributed timeline. `stagger 0/0` is the
  // structural choice for that role (see `resolveCapsule`'s own doc), not a guess derived from
  // `card` — every other `card` capsule (a real, authored one) still requires its own explicit
  // `distribution` like any other non-`carousel` type.
  const rootResolution = resolveCapsule(scene.tracks, CAPSULE_TYPE.card, {
    sceneRoot: true,
    distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
  })

  const persos: Perso[] = [buildRootCapsulePerso(rootPersoId, rootDecor?.data, rootResolution.rootArtifact)]
  const eventimes: NonNullable<StoryDef['eventimes']> = []
  const styleSheets: string[] = [rootResolution.styleSheet]

  // Flat worklist, not a recursive tree walk : Codplay's `move.parentId` is a plain reference
  // between two flat `persos` entries regardless of how deep the *authoring* tree is (no
  // relationship between authoring-tree depth and any structural recursion on the Codplay side)
  // — so every capsule level, however deeply nested in `TrackNode.children`, just resolves its
  // own children and pushes into these same flat arrays. Each entry carries the artifact map
  // resolved for exactly its own sibling group — never shared/mutated across entries, since two
  // sibling groups at different depths can be pending in the queue at the same time.
  type WorkItem = { tracks: TrackNode[]; parentPersoId: string; childArtifactById: Map<string, AutoCapsuleChildElementArtifact> }
  const worklist: WorkItem[] = [{ tracks: scene.tracks, parentPersoId: rootPersoId, childArtifactById: rootResolution.childArtifactById }]

  while (worklist.length > 0) {
    const { tracks, parentPersoId, childArtifactById } = worklist.shift()!
    for (const track of tracks) {
      const childArtifact = childArtifactById.get(track.id)!
      if (track.kind === 'capsule') {
        const { perso, itemEventimes, ownResolution } = buildNestedCapsulePerso(track, parentPersoId, childArtifact)
        persos.push(perso)
        eventimes.push(...itemEventimes)
        styleSheets.push(ownResolution.styleSheet)
        worklist.push({ tracks: track.children ?? [], parentPersoId: track.id, childArtifactById: ownResolution.childArtifactById })
      } else {
        const { perso, itemEventimes } = buildItemPerso(track, parentPersoId, scene, childArtifact)
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
  return { sceneDoc: exportResult.data, styleSheet: `${styleSheets.join('\n')}\n${STYLE_CHECK_RULE}` }
}

type CapsuleResolution = {
  rootArtifact: { className: string }
  childArtifactById: Map<string, AutoCapsuleChildElementArtifact>
  styleSheet: string
}

/**
 * Resolve one capsule's timing (`CapsuleDistribution`), then grid/placement/transitions/CSS
 * (`AutoCapsule`) — `2026-07-08-capsule-spec.md` §7 pipeline. Used for the root capsule (always
 * `card`, §6) and for any nested capsule (`capsuleType`, §3) — the same pipeline at any depth,
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
 * `options.grid` reads a capsule track's own `TrackNode.grid` override when present (currently a
 * TEMPORARY field, ed2-builder demo only — cf `sequence-editor/types.ts`) — passed straight to
 * `AutoCapsuleGridInput.rows`/`.cols`, never invented here (Principe B): absent input stays absent,
 * falling back to the type's own default (`config/capsule-types.ts`).
 *
 * `options.distribution` is resolved through `CapsulePreset` (`2026-06-12-capsule-distribution-
 * spec.md` §3.3) — the one place `CapsuleKind` → concrete `mode` resolution lives, shared with
 * `sequence-editor`'s own preview. `CapsuleDistribution` itself knows nothing about capsule
 * sub-types; it only ever receives an already-resolved `mode`. `staggerInMs:0`/`staggerOutMs:0` is
 * a genuine no-op of `CapsuleDistribution.computeStagger`'s own math (every free child resolves to
 * the whole clip span; a fully-locked child keeps its exact range regardless) — not a special
 * case this Builder branches on, present or not it produces the identical result.
 */
function resolveCapsule(
  tracks: TrackNode[],
  capsuleType: AutoCapsuleType,
  options?: { sceneRoot?: boolean; grid?: { rows?: number; cols?: number }; distribution?: TrackDistribution },
): CapsuleResolution {
  const preset = CapsulePreset.resolve({ capsuleType: toCapsuleKind(capsuleType), distribution: options?.distribution })
  const distribution = CapsuleDistribution.compute({
    clipDurationMs: tracks.reduce((max, track) => Math.max(max, track.keyframes[track.keyframes.length - 1]?.timeMs ?? 0), 0),
    ...preset,
    children: tracks.map((track) => ({
      trackId: track.id,
      lockedIntroMs: track.keyframes[0]?.timeMs,
      lockedOutroMs: track.keyframes[track.keyframes.length - 1]?.timeMs,
    })),
  })

  const childInputs: AutoCapsuleChildInput[] = tracks.map((track, index) => {
    const timing = distribution.children.find((child) => child.trackId === track.id)!
    return {
      id: track.id,
      order: index,
      timeRange: { startMs: timing.introMs, endMs: timing.outroMs },
      events: buildTransitionEvents(track),
    }
  })

  const autoCapsule = new AutoCapsule(
    {
      capsule: {
        id: 'root',
        type: capsuleType,
        grid: { rows: options?.grid?.rows, cols: options?.grid?.cols },
        sceneRoot: options?.sceneRoot,
        // No capsule-level transition override here — the type's own default (`config/
        // capsule-types.ts`) is what a child without its own keyframe transition falls back to.
        // Repeating the same value at the capsule level would just be an inert duplicate, not a
        // real default supplied by this Builder (Principe B).
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
  }
}

/**
 * Read the transition the author actually chose, from the track's own keyframes
 * (`Keyframe.transitionIn`/`.transitionOut`) — never a value this Builder invents (Principe B).
 * A clean, deterministic name (`${track.id}-intro`/`-outro`) is supplied explicitly too, so the
 * resolved event doesn't fall back to `AutoCapsule`'s auto-generated synthetic name.
 *
 * If a bound has no named transition, it's simply omitted here — `resolveAutoCapsuleEvents` then
 * synthesizes it from the capsule/type's own default ref, still under an auto-generated name
 * (acceptable: that fallback path is capsule-automation's documented behavior, not an invented
 * Builder default).
 */
function buildTransitionEvents(track: TrackNode): AutoCapsuleChildInput['events'] {
  const introRef = extractNamedTransitionRef(track.keyframes[0]?.transitionIn)
  const outroRef = extractNamedTransitionRef(track.keyframes[track.keyframes.length - 1]?.transitionOut)
  const events: Partial<Record<string, AutoCapsuleEventInput>> = {}

  if (introRef) {
    events[EVENT_ACTION.intro] = {
      action: EVENT_ACTION.intro,
      name: `${track.id}-intro`,
      ref: introRef.name,
      durationMs: introRef.durationMs,
    }
  }
  if (outroRef) {
    events[EVENT_ACTION.outro] = {
      action: EVENT_ACTION.outro,
      name: `${track.id}-outro`,
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
  decorData: Record<string, unknown> | undefined,
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
        ...(decorData?.style as Record<string, unknown> | undefined),
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
    if (styleDiff) {
      const stylePayload: Record<string, unknown> = {}
      for (const [prop, transition] of Object.entries(styleDiff)) {
        stylePayload[prop] = { ...transition, duration: event.durationMs || undefined }
      }
      actions[event.name] = { style: stylePayload }
    }
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
 * `capsuleType`, §3) — the same pipeline as the root, just parameterized. `flip:false` on its move
 * is the one thing every capsule's own children carry regardless of nesting depth, since it's
 * specifically the FLIP animation on a `list`'s direct children this is defusing
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
  track: TrackNode,
  parentPersoId: string,
  childArtifact: AutoCapsuleChildElementArtifact,
): NestedCapsuleBuildResult {
  if (!track.capsuleType) throw new Error(`buildSceneDoc: capsule track '${track.id}' has no capsuleType`)

  const ownResolution = resolveCapsule(track.children ?? [], track.capsuleType as AutoCapsuleType, {
    grid: track.grid,
    distribution: track.distribution,
  })
  const { actions, itemEventimes } = resolveTransitionActions(childArtifact)

  const perso: Perso = {
    id: track.id,
    name: track.label,
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
 * triggers `${track.id}-intro`/`${track.id}-outro` at the resolved `triggerMs`, the action itself
 * carries the resolved style diff, never the eventime.
 */
function buildItemPerso(
  track: TrackNode,
  rootPersoId: string,
  scene: EditorScene,
  childArtifact: AutoCapsuleChildElementArtifact,
): ItemBuildResult {
  const persoType = mapContentTypeToPersoType(track.contentType)
  const introKf = track.keyframes[0]
  const introDecor = introKf?.decorId ? scene.decors[introKf.decorId] : undefined

  const { actions, itemEventimes, initialStyleFromIntro } = resolveTransitionActions(childArtifact)

  const perso: Perso = {
    id: track.id,
    name: track.label,
    type: persoType,
    initial: {
      move: { parentId: rootPersoId, flip: false },
      tag: 'div',
      className: [childArtifact.className, STYLE_CHECK_CLASS].filter(Boolean).join(' '),
      content: introDecor?.data.content,
      style: {
        ...initialStyleFromIntro,
        ...(introDecor?.data.style as Record<string, unknown> | undefined),
      },
    },
    actions,
  }

  return { perso, itemEventimes }
}

function mapContentTypeToPersoType(contentType: TrackNode['contentType']): string {
  if (contentType === 'text') return 'text'
  throw new Error(`buildSceneDoc: unsupported contentType '${contentType}' in this minimal increment`)
}
