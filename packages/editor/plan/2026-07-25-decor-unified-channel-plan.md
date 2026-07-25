# ed2 — Canal Decor unique : plan opérationnel (reste à faire)

État actuel du code (déjà implémenté, vérifié) : `2026-07-25-decor-unified-api-study.md` §2.2/§2.4 —
`DecorLiveSession` existe, alimentée par le pont offset, lue par le décor temporaire ; `onDecorChange`
reste l'unique écrivain. Ce document ne redécrit pas cet état — un constat dit ce qui EST, un plan
dit ce qui RESTE à construire. Rationale complet du reste : constat §0bis (keyframe-varying vs
stable). Chaque étape ci-dessous est une opération de code précise, dans un ordre fixé, pas une
intention.

## B. Reste à faire — capture à l'insertion de keyframe (`KEYFRAME.ADD`)

### B.1 — Constat du blocage (une phrase)

`sequence-editor/machine.ts`'s handler `'KEYFRAME.ADD'` (ligne 443) est une fonction PURE, sans accès
à `authorApi`/`scene` réels — il ne peut pas calculer l'état interpolé courant lui-même.

### B.2 — Extraire les fonctions de résolution dans un module partagé

Nouveau fichier : **`packages/editor/src/app/bridges/decor-resolve.ts`**.

Déplacer VERBATIM (signatures et corps inchangés, vérifiés dans `decor-editor-bridge.ts` à date) :
- `type ItemVisualType = 'text' | 'image' | 'media' | 'video' | 'capsule'` (ligne 26)
- `type KeyframeAlignment = { kind: 'no-keyframes' } | { kind: 'before-first' } | { kind: 'exact'; keyframeId: string } | { kind: 'after-last'; keyframeId: string } | { kind: 'between'; prevKeyframeId: string; nextKeyframeId: string }` (ligne 74)
- `function resolveKeyframeAlignment(item: Item, timelineMs: number): KeyframeAlignment` (ligne 87)
- `function resolveTemporaryPatch(authorApi: AuthorApi, itemId: string, fields: PanelField[], referenceWidthPx: number): DecorPatch` (ligne 125)
- `function resolveTemporaryOffset(authorApi: AuthorApi, itemId: string, referenceWidthPx: number): DecorPatch` (ligne 149)
- `function resolveCurrentPatch(decor: Decor, content: Content | undefined, scene: EditorScene): DecorPatch` (ligne 180)
- `function resolveEffectiveKeyframePatch(scene: EditorScene, item: Item, keyframeId: string, content: Content | undefined): DecorPatch` (ligne 216)
- `function patchToDecorArgs(patch: DecorPatch, scene: EditorScene): Partial<Omit<Decor, 'id'>> | null` (ligne 240 — nécessaire à B.4, résout `patch.zone` nom→id via `scene.zones`, sinon inchangée)

**Un seul changement de signature** : `styleFieldsForItemType(controller: DecorEditorController, itemType: ItemVisualType)`
devient `styleFieldsForItemType(paletteConfig: PaletteConfig, itemType: ItemVisualType)` — le corps
utilisait déjà seulement `controller.getPaletteConfig()`, jamais le reste du contrôleur ; ce
paramètre était une dépendance inutile qui empêchait l'appel hors dedit.

`decor-editor-bridge.ts` : remplacer les 8 définitions locales par
`import { ... } from './decor-resolve'` ; remplacer l'unique appel
`styleFieldsForItemType(controller, target.itemType)` par
`styleFieldsForItemType(controller.getPaletteConfig(), target.itemType)`.

Vérification requise à cette étape : `npx vitest run tests/` → 468/468 inchangé (aucune logique
déplacée n'a changé de comportement, seulement d'adresse).

### B.3 — Fonction de capture, dans le même module

Ajouter à `decor-resolve.ts` :

```ts
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
 */
export function resolveKeyframeInsertionPatch(
  scene: EditorScene,
  item: Item,
  timelineMs: number,
  content: Content | undefined,
  authorApi: AuthorApi,
  paletteConfig: PaletteConfig,
  itemType: ItemVisualType,
  referenceWidthPx: number,
): DecorPatch | null {
  const alignment = resolveKeyframeAlignment(item, timelineMs)
  if (alignment.kind !== 'between') return null
  const base = resolveEffectiveKeyframePatch(scene, item, alignment.prevKeyframeId, content)
  const liveStyle = resolveTemporaryPatch(authorApi, item.id, styleFieldsForItemType(paletteConfig, itemType), referenceWidthPx)
  const liveOffset = resolveTemporaryOffset(authorApi, item.id, referenceWidthPx)
  const patch = mergePatch(mergePatch(base, liveStyle), liveOffset)
  return patchDiffersFromBase(base, patch) ? patch : null
}
```

### B.4 — Point de coordination : `sequence-editor-bridge.ts`

**Vérifié dans le code réel** (pas supposé) :
- `sequence-editor-bridge.ts` reçoit déjà `machine: Actor<typeof controllerMachine>` ;
  `context.authorApi: AuthorApi | null`, `context.referenceWidthPx: number` y sont publiés depuis
  `PLAYER_READY` (`app/controller/types.ts:52-54`).
- `controller.onCommand` (`sequence-editor/controller.ts:86-87`) relaie l'event `commandBatch` émis
  par `machine.ts`'s `'KEYFRAME.ADD'` (ligne 443) — un seul `Command` dedans, `name:
  'createNamedKeyframe'`.
- `createNamedKeyframe` (`sequence-editor/commands.ts:79-94`, args :
  `{ itemId: string; keyframeId: string; timeMs: number; decorId?: string; name?: string }`) —
  **si `decorId` est omis ou n'existe pas dans `scene.decors`, la fonction crée déjà elle-même une
  entrée décor VIDE fraîche, à l'id dérivé déterministe `` `decor-${args.keyframeId}` `` (ligne 86)**.
  Aucune modification de cette fonction n'est nécessaire — le point d'insertion existe déjà, il
  suffit de ne pas lui fournir de `decorId` partagé quand une capture doit être écrite.
- `Item.type: ItemType` (`'bloc' | 'text' | 'image' | 'media' | 'video' | 'capsule'`) — **`'bloc'`
  n'est PAS dans `ItemVisualType`** (`'text' | 'image' | 'media' | 'video' | 'capsule'`,
  `decor-resolve.ts`). Un item `bloc` n'a pas de panneau de palette (même garde que
  `resolveTarget` : `if (item.type === 'bloc') return null`) — jamais de capture pour ce cas.

Modifier `createSequenceEditorBridge` (`app/bridges/sequence-editor-bridge.ts`), le callback
`controller.onCommand` :

```ts
import { DEFAULT_PALETTE } from '../../decor-editor/default-palette'
import { resolveKeyframeInsertionPatch } from './decor-resolve'
import type { ItemVisualType } from './decor-resolve'

const unsubscribeCommand = controller.onCommand((commands) => {
  machine.send({ type: 'RUN_TRANSACTION', commands: commands.flatMap(enrichIfKeyframeCreation) })
})

function enrichIfKeyframeCreation(command: Command): Command[] {
  if (command.name !== 'createNamedKeyframe') return [command]
  const { itemId, timeMs, keyframeId } = command.args
  const { scene, authorApi, referenceWidthPx } = machine.getSnapshot().context
  const item = scene?.items.find((i) => i.id === itemId)
  if (!scene || !authorApi || !item || item.type === 'bloc') return [command]
  const content = item.contentId ? scene.contents[item.contentId] : undefined
  const patch = resolveKeyframeInsertionPatch(
    scene, item, timeMs, content, authorApi, DEFAULT_PALETTE, item.type as ItemVisualType, referenceWidthPx,
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

`zone-editor.ts`/`multi-selection-frame.ts` (dormants, non câblés — constat §3bis) : même modèle
`DecorLiveSession` à appliquer une fois câblés, pas avant. Cascade dupliquée 3× (constat §3) :
chantier séparé.

## D. Tests à ajouter pour B

- `patchDiffersFromBase` : cas identique (false), un champ style qui diverge (true), un sous-champ
  offset qui diverge (true), rien ne diverge sur classes/custom/zone (false).
- `resolveKeyframeInsertionPatch` : `between` avec divergence → patch non-null contient offset ET
  style ; `between` sans divergence → `null` ; `exact`/`after-last`/`before-first`/`no-keyframes` →
  `null` sans même lire `authorApi`.
- Intégration (`sequence-editor-bridge.spec.ts` ou équivalent) : insertion de kf via `KEYFRAME.ADD`
  sur un item interpolé → commande(s) résultante(s) portent le patch capturé ; sur un item statique
  → décor vide/partagé, comportement actuel inchangé.
- Non-régression : suite complète `packages/editor` verte.

## E. Ordre d'exécution

B.2 (extraction, vérifiée seule — `npx vitest run tests/` 468/468) → B.3 (nouvelles fonctions,
testées en isolation, D premiers tirets) → B.4 (coordination) → tests d'intégration (D) → validation
Safari (répro exacte : item position+couleur animées, insertion mi-parcours, plus de saut visuel) →
suite complète + gates.

---

**Statut** : B non commencé — soumis pour relecture avant code. Aucun point de conception ouvert
restant (B.2/B.4 vérifiés contre le code réel, pas supposés) — relecture porte sur les choix déjà
faits, pas sur des alternatives à trancher.
