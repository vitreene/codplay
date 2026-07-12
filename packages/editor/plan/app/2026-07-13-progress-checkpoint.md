# ed2 — Point d'avancement (checkpoint, 2026-07-13)

Où reprendre exactement, après un commit et sur n'importe quel poste. Document jetable — à supprimer une fois l'étape E validée et le plan général (`2026-07-10-app-construction-plan.md`) repris normalement.

**Document pilote de ce travail** : `2026-07-13-model-alignment-state-and-plan.md` (état des lieux + plan de correction A→E). Ce checkpoint n'en est qu'un instantané de progression.

---

## Ce qui est fait et validé (tests verts, typecheck propre sur ces fichiers)

### Étape 1-2 du plan général (squelette + contrôleur/façade) — faites avant ce plan de correction
- `packages/editor/src/app/commands/` — modèle normatif (`types.ts`), commandes de base (`base-commands.ts`), clé d'ordre fractionnaire (`order-key.ts`, testée à 2196/2743 insertions au point extrême), façade (`facade.ts`).
- `packages/editor/src/app/controller/` — machine XState (`controller-machine.ts`), types (`types.ts`).
- `packages/editor/src/app/layout/` — squelette de layout + démo de mutation croisée (`DemoMenuRegion`/`DemoPanelRegion`, **temporaires**, à retirer à l'étape E quand les vraies régions arrivent).
- Tests : `tests/commands/`, `tests/controller/`.

### Étape A — `CapsuleKind` réexporté depuis `@codplay/scene-factory`
- `src/app/commands/types.ts` — plus de redéclaration en dur.

### Étape B — Builder adapté au modèle normatif
- `src/builder/build-scene.ts` — réécrit intégralement pour lire `app/commands/types.ts` (items plats + `parentId`/`order`, `Item.capsule`, `Content.text`, `EditorScene.rootDecorId` — champ **ajouté** au modèle normatif ET au code, cf. `2026-07-11-ed2-document-model.md` ligne ~169).
- Tests migrés : `tests/builder/build-scene.spec.ts`, `tests/validate-scene-doc.spec.ts` — mêmes assertions qu'avant, fixtures au format normatif.

### Étape C — `mountSequenceEditor` extrait, démo supprimée
- `src/sequence-editor/mount.ts` — nouveau, monte le sequence-editor dans un `container` avec un `controller` déjà construit. Option `onPlayheadChange(timeMs)` pour le jalon playhead→seek (étape E) — le pont vers `player.seek({timelineMs})` vit chez l'appelant, pas ici.
- **`src/sequence-editor-main.ts` supprimé** (pas réécrit — les démos n'ont plus d'utilité, décision utilisateur explicite).
- Test : `tests/sequence-editor/mount.spec.ts` (environnement jsdom, stub `ResizeObserver` requis — jsdom ne l'implémente pas).

## En cours — Étape D (mountDecorEditor)

**Point de conception important, tranché après une fausse piste de ma part — à ne pas rouvrir** :
`mountDecorEditor` ne reçoit PAS un élément DOM figé (`targetElement`). Le node d'un item peut disparaître/être recréé pendant l'édition (seek, rebuild — discussion `2026-07-10-app-construction-discussion.md` §233). Il reçoit donc un **`subscribeToNode(itemId, cb)`** — même contrat que `AuthorApi.subscribeToNode` (`@codplay/selection-frame`), redéclaré localement (pas de dépendance package pour un seul type) pour ne jamais tenir de référence DOM figée. dedit applique le décor résolu en **preview live** directement sur le node reçu (discussion §"Preview synchrone... ne touche jamais le document") — c'est le mécanisme normal, pas un contournement.

**Fait** :
- `src/decor-editor/mount.ts` créé — `mountDecorEditor(container, controller, subscribeToNode, options)`. Monte la palette (`createDecorEditorPalette`), s'abonne au node de chaque item attaché, applique `applyResolvedDecor`/`applyTextAutoSize`/`groupTypoIconFields` (extraits tels quels de l'ancienne démo) à chaque apparition de node ET à chaque changement de décor.
- Typecheck propre sur ce fichier.

**Reste à faire pour clore l'étape D** :
1. **Supprimer `src/decor-editor/dedit-demo.ts`** — pas encore fait. Vérifier d'abord qu'aucun test n'en dépend (`grep -rln "dedit-demo\|runDecorEditorDemo" packages/editor` — seul `src/main.ts` en dépendait au dernier check, à re-vérifier).
2. **Écrire le test d'intégration de `mountDecorEditor`** (`tests/decor-editor/mount.spec.ts`, environnement jsdom) — vérifier : la palette s'affiche, `applyResolvedDecor` s'applique bien au node reçu via un `subscribeToNode` factice fourni par le test, le décor se réapplique si le node change (simulate un rebuild : `cb(null)` puis `cb(nouveauNode)`), `destroy()` nettoie.
3. Lancer `npx vitest run` + `npx tsc --noEmit -p tsconfig.json` (en ignorant l'erreur connue sur `main.ts`, réglée à l'étape D bis) pour valider.

## Pas commencé — Étape D bis (nettoyage aiguillage orphelin)

À faire une fois l'étape D close :
1. Supprimer `packages/editor/src/main.ts` (aiguillage `?demo=`, plus de cible depuis la suppression des deux démos).
2. Supprimer `packages/editor/demo.html`.
3. `vite.config.ts` — retirer l'entrée `demo: resolve(__dirname, 'demo.html')` de `build.rollupOptions.input` (garder seulement `main: index.html`).
4. Valider : `npm run dev:editor` sert `index.html` sans erreur, plus de route `?demo=`, typecheck propre **partout** (l'erreur `main.ts` disparaît enfin).

## Pas commencé — Étape E (reprise du jalon d'intégration, plan général)

Une fois A→D bis validées, reprendre le jalon « un item qui vit » du plan général (`2026-07-10-app-construction-plan.md`, les 4 points : document→Builder→player, sélection commune, édition décor→rebuild, playhead→seek). Ce jalon nécessite en plus :
- Un acteur/pont dans le contrôleur central qui invoque `mountSequenceEditor`/`mountDecorEditor` avec les bons `controller`/`subscribeToNode` (venant du player réel une fois monté).
- Le montage réel du player Codplay dans la région scène (`BuilderFacade.compile()` en aval du Builder ed2 — jamais fait dans ce plan de correction, cf. §1.3 du document `2026-07-13-model-alignment-state-and-plan.md`, "rien à corriger ici : le player est déjà le point fixe").
- Remplacer `DemoMenuRegion`/`DemoPanelRegion` (temporaires, étape 2) par les vraies régions.

---

## Fichiers non commités à ce jour (git status)

```
 M package-lock.json
 M packages/editor/index.html
 M packages/editor/package.json
 M packages/editor/plan/app/2026-07-10-app-construction-plan.md
 M packages/editor/plan/app/2026-07-11-ed2-document-model.md
 M packages/editor/src/builder/build-scene.ts
 D packages/editor/src/sequence-editor-main.ts
 M packages/editor/tests/builder/build-scene.spec.ts
 M packages/editor/tests/validate-scene-doc.spec.ts
 M packages/editor/tsconfig.json
 M packages/editor/vite.config.ts
?? packages/editor/demo.html
?? packages/editor/plan/app/2026-07-12-app-controller-definition.md
?? packages/editor/plan/app/2026-07-13-model-alignment-state-and-plan.md
?? packages/editor/src/app/
?? packages/editor/src/decor-editor/mount.ts
?? packages/editor/src/sequence-editor/mount.ts
?? packages/editor/tests/commands/
?? packages/editor/tests/controller/
?? packages/editor/tests/sequence-editor/
```

**Note** : `src/decor-editor/dedit-demo.ts` existe encore sur disque (non supprimé) — apparaîtra en `M` ou reste absent du diff selon que sa suppression a eu lieu avant ou après ce commit.
