# ed2 — Canal Decor unique : plan opérationnel (reste à faire)

État actuel du code (déjà implémenté, vérifié) :
- `2026-07-25-decor-unified-api-study.md` §2.2/§2.4 — `DecorLiveSession` existe, alimentée par le
  pont offset, lue par le décor temporaire ; `onDecorChange` reste l'unique écrivain.
- `packages/codplay/plan/2026-07-25-perso-state-at-t-plan.md` — `AuthorApi.getPersoStates()`
  expose l'état de tous les persos animés, dans leur unité native, capturé au dernier `seek()`
  (jamais lu sur le DOM/le node). `resolveTemporaryPatch` (`decor-editor-bridge.ts`) le consomme
  déjà pour le décor temporaire — plus besoin de `referenceWidthPx`/conversion physique à ce point
  de lecture (`formatPersoValueForCssProperty`, `decor-editor/css-value-format.ts`).

Ce document ne redécrit pas cet état — un constat dit ce qui EST, un plan dit ce qui RESTE à
construire. Rationale complet du reste : constat §0bis (keyframe-varying vs stable). Chaque étape
ci-dessous est une opération de code précise, dans un ordre fixé, pas une intention.

## B. Reste à faire — capture à l'insertion de keyframe (`KEYFRAME.ADD`)

### B.1 — Constat du blocage (une phrase)

`sequence-editor/machine.ts`'s handler `'KEYFRAME.ADD'` (ligne 443) est une fonction PURE, sans
accès à `authorApi`/`scene` réels — il ne peut pas calculer l'état interpolé courant lui-même.

### B.2 — Exporter les fonctions de résolution déjà existantes (pas d'extraction de module)

Contrairement à la version précédente de ce plan : `getPersoStates()` a rendu `resolveTemporaryPatch`
indépendante de `referenceWidthPx`, et `resolveTemporaryOffset` a été supprimée (offset/style
fusionnés au niveau du perso, plus de canal séparé) — la complexité qui motivait l'extraction dans
un nouveau module (`decor-resolve.ts`) a disparu. Ces fonctions restent dans
`decor-editor-bridge.ts`, simplement rendues `export` :

- `type ItemVisualType`
- `type KeyframeAlignment`
- `function resolveKeyframeAlignment(item: Item, timelineMs: number): KeyframeAlignment`
- `function resolveTemporaryPatch(authorApi: AuthorApi, itemId: string, fields: PanelField[]): DecorPatch`
- `function resolveCurrentPatch(decor: Decor, content: Content | undefined, scene: EditorScene): DecorPatch`
- `function resolveEffectiveKeyframePatch(scene: EditorScene, item: Item, keyframeId: string, content: Content | undefined): DecorPatch`
- `function patchToDecorArgs(patch: DecorPatch, scene: EditorScene): Partial<Omit<Decor, 'id'>> | null`

**Un seul changement de signature** : `styleFieldsForItemType(controller: DecorEditorController, itemType: ItemVisualType)`
devient `styleFieldsForItemType(paletteConfig: PaletteConfig, itemType: ItemVisualType)` — le corps
utilise déjà seulement `controller.getPaletteConfig()`, jamais le reste du contrôleur ; ce
paramètre était une dépendance inutile qui empêchait l'appel hors dedit. Adapter l'unique appel
existant : `styleFieldsForItemType(controller.getPaletteConfig(), target.itemType)`.

Vérification requise à cette étape : `npx vitest run tests/` → 468/468 inchangé (aucune logique
déplacée n'a changé de comportement, seulement sa visibilité).

### B.3 — Fonction de capture, dans le même fichier (implémenté)

`getPersoStates()` ne porte QUE les propriétés activement animées à l'instant courant (pas de
transition anime.js active ⇒ propriété absente de la map, pas égale à une valeur par défaut).
`translate`/`scale` sont fusionnés par `mergePatch` (`decor-editor/merge.ts`, `STRUCTURED_GROUPS`)
comme des groupes ENTIERS, pas champ par champ — donc la pose (position/rotation/scale) a besoin
d'une fonction dédiée, `resolveTemporaryOffset`, qui reçoit `base` et retombe explicitement sur
`base.offset?.<champ>` pour tout champ absent de `getPersoStates()`, jamais un défaut arbitraire
(`0`/`1`) qui écraserait silencieusement l'héritage. Bug trouvé et corrigé en live-test (item dont
seul `y` était en transition active — `x` identique entre kf1/kf2 — sautait de `41.76px` à
`1.34px` avant ce correctif) :

```ts
function resolveTemporaryOffset(authorApi: AuthorApi, itemId: string, base: DecorPatch): DecorPatch {
  const persoState = authorApi.getPersoStates().get(itemId)
  if (!persoState) return {}
  const parseCqw = (raw: unknown): number | undefined => {
    if (raw === undefined) return undefined
    const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const x = parseCqw(persoState.x) ?? base.offset?.translate?.x
  const y = parseCqw(persoState.y) ?? base.offset?.translate?.y
  const width = parseCqw(persoState.width) ?? base.offset?.width
  const height = parseCqw(persoState.height) ?? base.offset?.height
  const rotate = parseCqw(persoState.rotate) ?? base.offset?.rotate
  const scaleX = parseCqw(persoState.scaleX) ?? base.offset?.scale?.x
  const scaleY = parseCqw(persoState.scaleY) ?? base.offset?.scale?.y
  const offset: OffsetPatch = {}
  if (x !== undefined || y !== undefined) offset.translate = { x: x ?? 0, y: y ?? 0 }
  if (width !== undefined) offset.width = width
  if (height !== undefined) offset.height = height
  if (rotate !== undefined) offset.rotate = rotate
  if (scaleX !== undefined || scaleY !== undefined) offset.scale = { x: scaleX ?? 1, y: scaleY ?? 1 }
  return Object.keys(offset).length > 0 ? { offset } : {}
}

/**
 * Diff propriété par propriété entre deux DecorPatch résolus — vrai si `patch` diverge de `base`
 * sur au moins une propriété présente dans `patch`. Granularité identique à `mergePatch`
 * (`decor-editor/merge.ts`) : clés de `style` une à une, sous-champs d'`offset` un à un,
 * `classes`/`custom`/`zone` comme valeurs entières.
 */
export function patchDiffersFromBase(base: DecorPatch, patch: DecorPatch): boolean {
  if (patch.style) {
    for (const [k, v] of Object.entries(patch.style)) if (base.style?.[k] !== v) return true
  }
  if (patch.offset) {
    for (const k of Object.keys(patch.offset) as (keyof OffsetPatch)[]) {
      if (JSON.stringify(base.offset?.[k]) !== JSON.stringify(patch.offset[k])) return true
    }
  }
  if (patch.classes !== undefined && JSON.stringify(patch.classes) !== JSON.stringify(base.classes)) return true
  if (patch.custom !== undefined && patch.custom !== base.custom) return true
  if (patch.zone !== undefined && patch.zone !== base.zone) return true
  return false
}

/**
 * Décor à consigner pour un NOUVEAU keyframe inséré à `timelineMs` sur `item` — `null` si rien à
 * consigner (pas entre deux keyframes réels, ou état live identique à la cascade : le keyframe
 * s'ouvre vide, comportement actuel de `adjacentDecorId` inchangé). Non-null seulement si l'état
 * réellement affiché DIVERGE de la cascade — jamais un instantané complet systématique.
 *
 * `getPersoStates()` couvre TOUTE propriété du perso (couleur/dimensions via la palette, ET
 * position/rotation/scale, jamais exposées par la palette mais tout aussi capturées) — deux
 * canaux de fusion distincts (`resolveTemporaryPatch` pour le style, `resolveTemporaryOffset`
 * pour la pose) car leurs défauts d'absence diffèrent (rien vs repli sur `base`).
 */
export function resolveKeyframeInsertionPatch(
  scene: EditorScene,
  item: Item,
  timelineMs: number,
  content: Content | undefined,
  authorApi: AuthorApi,
  paletteConfig: PaletteConfig,
  itemType: ItemVisualType,
): DecorPatch | null {
  const alignment = resolveKeyframeAlignment(item, timelineMs)
  if (alignment.kind !== 'between') return null
  const base = resolveEffectiveKeyframePatch(scene, item, alignment.prevKeyframeId, content)
  const liveStyle = resolveTemporaryPatch(authorApi, item.id, styleFieldsForItemType(paletteConfig, itemType))
  const liveOffset = resolveTemporaryOffset(authorApi, item.id, base)
  const patch = mergePatch(mergePatch(base, liveStyle), liveOffset)
  return patchDiffersFromBase(base, patch) ? patch : null
}
```

### B.4 — Point de coordination : `sequence-editor-bridge.ts`

**Vérifié dans le code réel** (pas supposé, re-vérifié le 2026-07-26) :
- `sequence-editor-bridge.ts` reçoit déjà `machine: Actor<typeof controllerMachine>` ;
  `context.authorApi: AuthorApi | null` y est publié depuis `PLAYER_READY`
  (`app/controller/types.ts`). `context.referenceWidthPx` n'est plus nécessaire à ce point.
- `controller.onCommand` (`sequence-editor-bridge.ts:21-23`) relaie tel quel vers
  `RUN_TRANSACTION`, sans enrichissement — `machine.send({ type: 'RUN_TRANSACTION', commands })`.
- `machine.ts`'s `'KEYFRAME.ADD'` (ligne 443-453) émet un seul `Command`,
  `name: 'createNamedKeyframe'`.
- `createNamedKeyframe` (`sequence-editor/commands.ts`, args :
  `{ itemId: string; keyframeId: string; timeMs: number; decorId?: string; name?: string }`) —
  **si `decorId` est omis ou n'existe pas dans `scene.decors`, la fonction crée déjà elle-même une
  entrée décor VIDE fraîche, à l'id dérivé déterministe `` `decor-${args.keyframeId}` ``**. Aucune
  modification de cette fonction n'est nécessaire — le point d'insertion existe déjà, il suffit de
  ne pas lui fournir de `decorId` partagé quand une capture doit être écrite.
- `Item.type: ItemType` (`'bloc' | 'text' | 'image' | 'media' | 'video' | 'capsule'`) — **`'bloc'`
  n'est PAS dans `ItemVisualType`** (`'text' | 'image' | 'media' | 'video' | 'capsule'`). Un item
  `bloc` n'a pas de panneau de palette (même garde que `resolveTarget` : `if (item.type === 'bloc')
  return null`) — jamais de capture pour ce cas.

Modifier `createSequenceEditorBridge` (`app/bridges/sequence-editor-bridge.ts`), le callback
`controller.onCommand` :

```ts
import { DEFAULT_PALETTE } from '../../decor-editor/default-palette'
import { resolveKeyframeInsertionPatch, patchToDecorArgs, type ItemVisualType } from './decor-editor-bridge'

const unsubscribeCommand = controller.onCommand((commands) => {
  machine.send({ type: 'RUN_TRANSACTION', commands: commands.flatMap(enrichIfKeyframeCreation) })
})

function enrichIfKeyframeCreation(command: Command): Command[] {
  if (command.name !== 'createNamedKeyframe') return [command]
  const { itemId, timeMs, keyframeId } = command.args
  const { scene, authorApi } = machine.getSnapshot().context
  const item = scene?.items.find((i) => i.id === itemId)
  if (!scene || !authorApi || !item || item.type === 'bloc') return [command]
  const content = item.contentId ? scene.contents[item.contentId] : undefined
  const patch = resolveKeyframeInsertionPatch(
    scene, item, timeMs, content, authorApi, DEFAULT_PALETTE, item.type as ItemVisualType,
  )
  if (patch === null) return [command]
  // `decorId` omis (jamais celui résolu par `adjacentDecorId` côté machine.ts) : `createNamedKeyframe`
  // crée alors lui-même un décor vide frais à `decor-${keyframeId}` — `setDecor` l'y remplit dans la
  // MÊME transaction, aucune commande `registerDecor` séparée n'est nécessaire.
  const { decorId: _ignored, ...argsWithoutDecorId } = command.args
  return [
    { ...command, args: argsWithoutDecorId },
    { name: 'setDecor', args: { decorId: `decor-${keyframeId}`, patch: patchToDecorArgs(patch, scene) } },
  ]
}
```

## C. Hors périmètre de ce plan

- `zone-editor.ts`/`multi-selection-frame.ts` (dormants, non câblés — constat §3bis) : même modèle
  à appliquer une fois câblés, pas avant. Cascade dupliquée 3× (constat §3) : chantier séparé.
- La réconciliation `offset`/`style` en une seule valeur partagée (notée en attente, détails à
  venir de l'auteur) : hors périmètre ici, ne bloque pas ce chantier.
- `toHexForPicker` limité au format `oklch()` (`decor-editor/render.ts:265-270`, découvert le
  2026-07-25) : défaut préexistant distinct, pas traité ici.
- **Édition d'un keyframe posé à mi-move zone→zone** — cadré, pas implémenté. Invariant transversal :
  la capture lit toujours l'un de trois canaux LOGIQUES (continue animée → `getPersoStates()` ;
  placement discret → move-state ; pose auteur stable → `getPersoStates()`/repli sur `base`), JAMAIS
  la transform de rendu du node (matrice FLIP en espace-local, jetable, non re-dérivable au resize).
  Trois opérations possibles sur un tel kf :
  1. **Propriété simultanée non-spatiale** (ex. couleur) — interpolation continue ajoutée en
     parallèle du move, canal `getPersoStates()`. **À intégrer.** Zéro impact sur le move.
  2. **Modifier la trajectoire** (droite → brisée / arc) — non pas capturer une position
     intermédiaire, mais ajouter une **propriété de trajectoire déclarative au move** (géométrie en
     unité native, dans le repère du parent — les zones de l'éditeur partagent le même parent, repère
     unique `cqw`). **À intégrer.** Corollaire clé : la trajectoire matérialisée REND la position à
     `t` lisible depuis la description (point sur la géométrie → `lerp`/évaluation de courbe), sans
     jamais lire le node — c'est le canal de placement animé qui manquait, et il tombe de ce cas 2
     sans chantier séparé. L'éditeur de trajectoire (ajout/retrait de point, droite/arc) est un détail
     d'implémentation à créer, mais reste une **vue auteur** (édite la description, pas le rendu).
  3. **Détachement** (briser A→B ; ou créer une zone C à la position courante + restructurer en
     A→C figé puis C→B) — **différé, pas maintenant.** Une fois la trajectoire du cas 2 disponible, la
     position d'ancrage de C se calcule depuis la description (point sur la trajectoire à `t`), pas
     depuis le node.
  Rationale complet : mémoire `project-item-perso-node-one-way-projection`.

## D. Tests ajoutés pour B (fait)

- `patchDiffersFromBase` : cas identique (false), un champ style qui diverge (true), un sous-champ
  offset qui diverge (true), rien ne diverge sur classes/custom/zone (false). 5 tests.
- `resolveKeyframeInsertionPatch` : `between` avec divergence → patch non-null contient style
  (couleur/dimensions/position, tout via `getPersoStates()`) ; `between` sans divergence → `null` ;
  `exact`/`after-last`/`before-first`/`no-keyframes` → `null` sans même lire `authorApi`. 6 tests.
- Mocks `fakeAuthorApi`/`fakeAuthorApiWithNodes` (`decor-editor-bridge.spec.ts`,
  `offset-editor-bridge.spec.ts`) complétés avec `getPersoStates`/`setNodePose` — leur absence
  aurait laissé les tests verts même en cas de régression complète de la lecture live (vérifié en
  reproduisant délibérément l'échec avant correctif).
- Non-régression : suite complète `packages/editor` verte (479/479), gates `packages/codplay`
  verts (12/12, 4/4).

## E. Validation Safari (fait)

Répro exacte : item avec position (x/y) + rotation + couleur tous animés entre deux keyframes,
insertion d'un nouveau keyframe à mi-parcours (dblclick sur la track à t≈4.5s) sans keyframe
sélectionné au préalable. Style DOM capturé immédiatement avant et après insertion : `x`
(`translate`), `y`, `rotate` et couleur restent continus, aucun saut visuel.

Un bug a été trouvé et corrigé pendant cette validation : `x` était identique entre kf1/kf2 (donc
aucune transition anime.js active dessus, absent de `getPersoStates()`), et le premier jet de
`resolveTemporaryOffset` défaultait les champs absents à `0`/`1` — ce qui écrasait silencieusement
le `x` hérité via la fusion `mergePatch` en groupe entier (`translate` remplacé tout entier, pas
champ par champ). Corrigé en passant `base` à `resolveTemporaryOffset` et en repliant chaque champ
absent sur `base.offset?.<champ>` plutôt que sur un défaut arbitraire (voir §B.3). Re-vérifié en
Safari après correctif : `x` stable à `41.76px`, plus de saut.

---

**Statut** : B terminé (§B.2 → B.3 → B.4 → D → E, dans l'ordre prévu). Suite complète et gates
verts, validation Safari faite avec le bug `resolveTemporaryOffset`/`x` trouvé et corrigé en cours
de route. Reste hors périmètre (§C, inchangé) : `zone-editor.ts`/`multi-selection-frame.ts`,
réconciliation offset/style, `toHexForPicker` oklch-only. Le sujet cqw/px et réactivité au
redimensionnement de fenêtre, signalé par l'auteur pendant cette session, reste ouvert et n'est
traité par aucun plan à ce jour.
