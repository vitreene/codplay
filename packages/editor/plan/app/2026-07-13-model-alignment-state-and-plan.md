# ed2 — État des lieux et plan de correction : alignement Builder/îlots au modèle cible

Constat déclencheur : la construction de l'app (étapes 1-2, `2026-07-10-app-construction-plan.md`) a produit un contrôleur qui possède le modèle **cible** (`app/2026-07-11-ed2-document-model.md`), sans vérifier au préalable que le Builder et les îlots existants (sequence-editor, dedit) parlent ce modèle. Ils ne le parlent pas. Ce document fait l'état des lieux exact, puis pose le plan qui aligne le tout avant de reprendre l'étape 3.

**La construction de l'app (plan général) est arrêtée jusqu'à ce que ce document soit exécuté.**

---

## 1. État des lieux

### 1.1 Deux `EditorScene` incompatibles coexistent

- **Ancien** (`packages/editor/src/sequence-editor/types.ts`) : arbre `tracks: TrackNode[]`, `contentType` en dur sur `TrackNode`, `decors` en table mais pas de `contents` séparée. C'est le modèle que compile le Builder actuel, que possède `SequenceEditorController`, et que la démo `ed2-builder-demo` prouve en fonctionnement réel.
- **Cible** (`packages/editor/src/app/commands/types.ts`) : `items: Item[]` à plat, `parentId` + `order` fractionnaire, `contents`/`decors`/`zones` en tables séparées, `Item.capsule?: CapsuleDef`. C'est le modèle que possède le contrôleur central (étape 2) et sa façade de commandes.

Les deux portent le même nom `EditorScene` mais ne sont pas substituables. Rien ne les relie aujourd'hui.

### 1.2 Le Builder (`packages/editor/src/builder/build-scene.ts`)

- Signature : `buildSceneDoc(scene: EditorScene): { sceneDoc: SceneDef, styleSheet: string }`, où `EditorScene` est l'**ancien** modèle (import direct `../sequence-editor/types`).
- Produit un `SceneDef` (= `SceneDoc`), **jamais** un `CompiledScene` — c'est la cible documentée et voulue (`builder-plan.md` §1 : *"Cible : `SceneDef`, jamais `CompiledScene`. La compilation `SceneDef → CompiledScene` reste la responsabilité du builder Codplay existant, invoquée en aval via `CodPlay.load()`"*). **Ce point n'est pas un écart — c'est le design normatif déjà tranché, confirmé bon (§2 ci-dessous).**
- Prouvé en démo réelle (`packages/demos/src/codplay/ed2-builder-demo.ts`), mais uniquement sur l'ancien modèle.

### 1.3 Le player Codplay (`packages/codplay/src/player/`)

- `Player.init({ compiledScene: CompiledScene, ... })` — exige un `CompiledScene`, jamais un `SceneDef` brut.
- `CompiledScene = { schemaVersion, createdAt, scene: SceneDef, resources: ResourceManifest, rootNodeIds }` — produit par `BuilderFacade.compile()` côté Codplay, à partir d'un `SceneDef`.
- `player.seek({ timelineMs: number })` — forme objet, c'est la référence externe.
- Rien à corriger ici : le player est déjà le point fixe (référence), ni le modèle ni son API ne bougent.

### 1.4 sequence-editor (`packages/editor/src/sequence-editor/`, `sequence-editor-main.ts`)

- **Le travail de fond existe déjà et est propre** : `SequenceEditorController` (API complète : `selectTrack`/`selectKeyframe`/`seek(timeMs: number)`/`subscribe`/`serialize`/`deserialize`…), la machine XState, et les modules de rendu déjà découpés en `create*`/`render*` par zone (`render/time-ruler.ts`, `render/track-row.ts`, `render/playhead-line.ts`, `render/cue-row.ts`, `render/marker-row.ts`, `render/waveform-row.ts`).
- **Ce qui manque** : `sequence-editor-main.ts` (652 lignes) est un script auto-exécutant, câblé en dur sur `document.querySelector('#app')`, qui mélange assemblage réutilisable (les `create*`/`render*`) et logique de démo (sélecteur de fixture, RAF loop de démo, listeners globaux). Aucune fonction exportée `mount(container, controller): { destroy }`.
- `SequenceEditorController.seek(timeMs: number)` prend un nombre brut — pas la forme `{ timelineMs }` du player. Écart de forme à ponter, pas un défaut de conception.
- Aucun callback dédié à la sélection ou au playhead séparé du `subscribe()` global (snapshot XState complet) — un consommateur externe doit aujourd'hui lire `ctx.selection`/`ctx.playheadMs` dans le snapshot complet, pas s'abonner à un événement ciblé. Fonctionnel mais rudimentaire.

### 1.5 dedit (`packages/editor/src/decor-editor/`, `dedit-demo.ts`)

- **Le travail de fond existe déjà et est propre** : `DecorEditorController` (API complète : `attachItems`/`applyPatch`/`applyPathPatch`/`onDecorChange`/`onZonesChange`/`resolveField`…), la machine XState, `createDecorEditorPalette(controller)` déjà paramétrée par contrôleur.
- **Ce qui manque** : `dedit-demo.ts` (269 lignes, une seule fonction `runDecorEditorDemo()`) est câblé en dur sur `document.getElementById('app')`, avec un item et des `defaults` factices codés en dur. Le nécessaire réutilisable (`createDecorEditorPalette`, `applyResolvedDecor`) est déjà extractible tel quel.
- `onDecorChange`/`emitDecorChange` existent et fonctionnent mais n'ont **aucun appelant actuel** — jamais branchés vers un consommateur externe.

### 1.6 selection-frame (`packages/authoring/selection-frame/`)

- Ne pose pas de problème d'intégration : consomme un contrat `AuthorApi.subscribeToNode(persoId, cb)`, déjà un simple wrapper autour de `PlayerApi.subscribeToNode`. Fonctionne dès qu'un player réel est monté et qu'on lui fournit un `AuthorApi` construit via `createAuthorApi(player)`.

### 1.7 `CapsuleKind` redéclaré dans le modèle cible

`app/commands/types.ts` déclare `CapsuleKind` en dur au lieu de le réexporter depuis `@codplay/scene-factory` (source unique de vérité, déjà établie et documentée comme telle dans `sequence-editor/types.ts`, avec avertissement explicite contre une redéclaration séparée). Valeurs identiques aujourd'hui — pas de dommage actuel, mais principe violé une seconde fois.

---

## 2. Décisions (tranchées par l'utilisateur, 2026-07-13)

1. **Builder → `SceneDef` complet, joué ensuite par `Player`/`BuilderFacade.compile()`** — le chemin en deux étapes (`SceneDef` puis `CompiledScene`) est confirmé bon, malgré son apparente lourdeur. Rien à changer ici : c'est déjà le design normatif du `builder-plan.md` §1.
2. **Le Builder doit être reconstruit/adapté au nouveau modèle** — les deux modèles `EditorScene` (ancien/cible) sont structurellement proches (même esprit : items/tracks + décors référencés), donc adaptation plutôt que réécriture de zéro.
3. **`@codplay/scene-factory` reste la source de vérité pour `CapsuleKind`** — le fichier `app/commands/types.ts` doit réexporter, jamais redéclarer.
4. **sequence-editor et dedit : adaptateur d'extraction, pas refonte.** Confirmé par l'examen direct du code (§1.4, §1.5) : le travail de fond (contrôleurs, machines, modules de rendu) est déjà fait et de bonne facture. Le travail réel est l'**extraction** d'une fonction de montage paramétrable (`container`, scène/contrôleur en entrée) depuis chaque script de démo — pas une reprise de fond.
5. **`player.seek({ timelineMs })` est la référence** — c'est `SequenceEditorController.seek(timeMs: number)` (et la liaison playhead→seek à construire) qui s'adapte à cette forme, jamais l'inverse.

---

## 3. Plan de correction

Ordre : chaque étape est un préalable vérifiable à la suivante — pas de code sur l'étape N+1 avant que l'étape N soit validée (test + éventuellement rendu réel).

### Étape A — `CapsuleKind` : réexport, pas redéclaration

- `app/commands/types.ts` : remplacer la déclaration en dur de `CapsuleKind` par `export type { CapsuleKind } from '@codplay/scene-factory'` (même patron que `sequence-editor/types.ts:36`).
- **Validation** : typecheck propre, tests existants (`order-key`, `base-commands`, `facade`, `controller-machine`) inchangés et toujours verts.

### Étape B — Builder adapté au modèle cible

- Reconstruire `buildSceneDoc` (ou une nouvelle fonction dédiée, à trancher à l'ouverture — nom/emplacement) pour qu'elle accepte le `EditorScene` **cible** (`app/commands/types.ts`) en entrée.
- Portage guidé par la proximité déjà notée (décision 2) : la logique de résolution de transitions/timing/CSS (`build-scene.ts`, principes A/B déjà actés) reste valable dans son principe ; ce qui change est la **lecture** de la structure d'entrée (arbre `TrackNode[]` → items plats `parentId`/`order`, `contentType` en dur → `Item.type`/`Content` référencé, `CapsulePatch` implicite → `Item.capsule: CapsuleDef`).
- Sortie inchangée : toujours `{ sceneDoc: SceneDef, styleSheet }` (décision 1 — rien à changer côté Codplay/`BuilderFacade.compile()`).
- **Validation** : un test d'intégration reprenant le principe de `tests/builder/build-scene.spec.ts`, mais avec une fixture au modèle cible (un item, une capsule racine implicite) — vérifie que le Builder cible produit un `SceneDef` structurellement équivalent à ce que l'ancien produisait pour un cas comparable.
- **Hors périmètre de cette étape** : la migration des fixtures/démos qui utilisent encore l'ancien modèle (`ed2-builder-scene.ts`, tests `builder/*.spec.ts` existants) — décision explicite à prendre séparément (garder les deux Builders en parallèle le temps de la transition, ou migrer immédiatement) : **à trancher à l'ouverture de cette étape, pas ici.**

### Étape C — Point de montage sequence-editor, suppression de la démo

**Les démos n'ont plus d'utilité et sont supprimées, pas réécrites.** Une démo qui mélange construction de vue et logique métier (comme `sequence-editor-main.ts` et `dedit-demo.ts`) est le mauvais patron à ne pas reconduire — le bon comportement pour éprouver un module est de le monter via son API dans l'app réelle (ou un test d'intégration isolé), jamais de bricoler un script séparé.

- Extraire de `sequence-editor-main.ts` une fonction exportée, ex. `mountSequenceEditor(container: Element, controller: SequenceEditorController): { destroy(): void }`, qui assemble les modules `create*`/`render*` déjà existants — sans changer leur logique interne.
- **Supprimer ensuite `sequence-editor-main.ts` dans son intégralité** — pas de version réécrite conservée à côté. La preuve de bon fonctionnement de `mountSequenceEditor` passe par le test d'intégration (ci-dessous) et par son usage réel dans l'app (étape E), pas par un script de démo.
- Ajouter à `SequenceEditorController` (ou à la nouvelle fonction de montage) un pont `seek({ timelineMs })` conforme à la forme du player — traduction interne vers `seek(timeMs: number)` existant, pas un changement de l'API interne.
- **Validation** : un test d'intégration monte `mountSequenceEditor` dans un conteneur de test isolé (vitest + DOM), avec une scène minimale, et vérifie l'affichage et le pilotage de base (sélection, playhead) — c'est le seul « lieu de démonstration » du module désormais, avec l'app réelle.

### Étape D — Point de montage dedit, suppression de la démo

- Extraire de `dedit-demo.ts` une fonction exportée, ex. `mountDecorEditor(container: Element, controller: DecorEditorController): { destroy(): void }`, réutilisant `createDecorEditorPalette`/`applyResolvedDecor` déjà génériques.
- **Supprimer ensuite `dedit-demo.ts` dans son intégralité** — même principe qu'étape C, aucune version réécrite conservée.
- **Validation** : même principe qu'étape C — test d'intégration de montage isolé.

### Étape D bis — nettoyage de la chaîne d'aiguillage devenue orpheline

Une fois les deux démos supprimées, plus rien ne consomme l'aiguillage `?demo=` : à supprimer dans la même opération, pas laissé en orphelin.

- `packages/editor/src/main.ts` — supprimé (l'aiguillage `?demo=dedit`/sequence-editor n'a plus de cible).
- `packages/editor/demo.html` — supprimé.
- `packages/editor/vite.config.ts` — retirer l'entrée `demo: resolve(__dirname, 'demo.html')` de `build.rollupOptions.input` (ne garder que `main: index.html`).
- **Validation** : `npm run dev:editor` sert toujours `index.html` (l'app) sans erreur ; plus aucune route `?demo=` ni fichier `demo.html`/`main.ts` dans le package ; typecheck propre (aucune référence résiduelle aux fichiers supprimés).

### Étape E — Reprise de l'étape 3 du plan général

Une fois A-D validées, l'étape 3 (`app-construction-plan.md`) redevient exécutable telle que planifiée : le jalon « un item qui vit » (les 4 points) peut réellement être câblé et testé, parce que chaque maillon (document cible → Builder cible → `BuilderFacade.compile()` → player ; sélection commune ; édition décor → rebuild ; playhead → seek) existe désormais sous une forme montable/pilotable.

---

## 4. Ce que ce document ne tranche pas

- Le détail exact de la nouvelle fonction du Builder (nom, fichier — remplace `build-scene.ts` ou fichier neuf à côté) : à l'ouverture de l'étape B.
- Le sort des fixtures/tests sur l'ancien modèle (garder en parallèle vs migrer) : à l'ouverture de l'étape B.
- La forme exacte des callbacks de sélection/playhead à ajouter à `SequenceEditorController` si le besoin s'en confirme à l'usage (§1.4) — pas bloquant pour l'étape C telle que décrite (le `subscribe()` global suffit pour un premier montage fonctionnel).
