# ed2 — Migration du sequence-editor vers le modèle document cible

Sous-plan de l'étape 3 (`2026-07-10-app-construction-plan.md`) — préalable au jalon « un item qui vit ». Constat déclencheur : `2026-07-13-model-alignment-state-and-plan.md` avait déjà noté que `SequenceEditorController` parle l'**ancien** modèle (`sequence-editor/types.ts`, `tracks: TrackNode[]` arborescent), distinct du modèle **cible** que possède le contrôleur central (`app/commands/types.ts`, `items: Item[]` plat + `parentId`/`order`) — mais n'avait traité que le Builder (étape B de ce plan-là). Ce document couvre le reste : machine, contrôleur, utils, deux modules de rendu.

**Décision actée (2026-07-13)** : migration réelle de `SequenceEditorController`/sa machine vers le modèle cible — pas un adaptateur de projection, pas un report. Choisi malgré le coût, pour éliminer la double représentation plutôt que la maintenir.

---

## 1. Ce qui change, ce qui ne change pas

### 1.1 Correspondance `TrackNode` → `Item`

| Ancien (`TrackNode`) | Cible (`Item`) | Note |
|---|---|---|
| `id` | `id` | inchangé |
| `kind: 'element' \| 'capsule'` | `type === 'capsule'` vs autre | dans le modèle cible, `capsule` est une valeur d'`ItemType` parmi d'autres (`'bloc' \| 'text' \| 'image' \| 'media' \| 'video' \| 'capsule'`), pas un discriminant binaire séparé du type. `getTrackRowHeight`/les usages CSS (`data-kind`) se réduisent à `item.type === 'capsule'`. |
| `contentType?: 'text'\|'image'\|'media'\|'video'` | `type` (fusionné) | le modèle cible n'a pas de `contentType` distinct de `type` — l'ancien `TrackNode` avait les deux (`kind` + `contentType`) parce qu'il confondait piste-capsule/piste-élément et type de contenu. Cible : un seul champ `type`. |
| `children?: TrackNode[]` | *dérivé* de `parentId`/`order` | **le changement structurel central** — plus de champ enfants porté par le nœud, l'arbre entier se recalcule par filtre+tri (`childrenOf`, déjà écrit côté Builder ed2 et façade). |
| — (pas de champ dédié) | `parentId: string \| null`, `order: string` (clé fractionnaire) | chaque item porte sa place, jamais une liste d'ids enfants. |
| `label: string` | — | absent du modèle cible (`Item` n'a pas de libellé auteur). **Point ouvert, §3.** |
| `visible: boolean` | `visible: boolean` | conservé, même sémantique (affichage éditeur, pas rendu). |
| `capsuleType?: CapsuleKind`, `grid?`, `distribution?` | `capsule?: CapsuleDef { kind, distribution, grid, ... }` | regroupés sous un seul objet optionnel, présent ssi `type === 'capsule'` — même esprit, forme resserrée (déjà le patron que suit le Builder ed2). |
| `keyframes: Keyframe[]` | `keyframes: Keyframe[]` | proche mais pas identique — voir §1.2. |

### 1.2 Correspondance `Keyframe`

| Ancien | Cible | Note |
|---|---|---|
| `decorId: string \| null` | `decorId: string` (obligatoire) | la cible n'autorise pas de kf sans décor — à trancher : soit la migration crée un décor vide par défaut (même règle que `createKeyframe` de la façade, `base-commands.ts:109-126`), soit ce champ reste `string \| null` côté sequence-editor et la façade seule impose l'obligation à l'écriture. **Point ouvert, §3.** |
| `name?: string` (`'intro'`/`'outro'` en usage réel, mais typé `string`) | `name?: string` | conservé tel quel. |
| `transitionIn?`/`transitionOut?: TransitionDef` | `transitionIn?`/`transitionOut?: Transition` | formes quasi identiques (`kind: 'named'|'interpolated'`) — seule différence relevée : `Easing`/`EasingValue` diffèrent sur le nom de discriminant du variant cubic-bezier (`kind` vs `type`) et `p1x`/etc. Alignement trivial. |
| `markerId?: string` | `markerId?: string` | conservé. |

### 1.3 Ce qui n'avait pas d'équivalent dans le modèle cible — trous normatifs, TRANCHÉS le 2026-07-13

Le modèle cible (`app/2026-07-11-ed2-document-model.md`) décrit le document **normatif**, mais certaines données que le sequence-editor gère aujourd'hui n'y avaient pas encore de place explicite. Les deux trous réels de modèle (1 et 3 ci-dessous) ont été comblés séance tenante — décisions actées, modèle et code déjà mis à jour :

1. **`cues: TextCue[]`, `markerTracks: MarkerTrack[]`** — globaux sur l'ancien `EditorScene`. Le modèle cible dit que les cues vivent désormais dans `Content.cues` (par item média, cf. document-model §"Le son master"), plus de table globale. `MarkerTrack` (pistes de marqueurs libres, indépendantes de tout item média) était **absent** du modèle cible. **TRANCHÉ** : ajouté comme table indépendante `EditorScene.markerTracks: Record<string, MarkerTrack>`, même patron que `zones` (pas fusionné avec `Cue`/`Content` — un marqueur n'est pas une transcription de source média). Modèle (`2026-07-11-ed2-document-model.md`) et code (`app/commands/types.ts` — `Marker`, `MarkerTrack`, champ `EditorScene.markerTracks`) déjà mis à jour ; typecheck + 317 tests vérifiés verts (seul site d'appel touché : `app/layout/DemoMenuRegion.tsx`, fixture `emptyScene` corrigée).
2. **`audio?: AudioTrack`** (piste audio unique, avec `waveform`) — le modèle cible dit explicitement que ceci devient `masterItemId` (référence vers un item média) + `Content.waveform`/`Content.cues` sur cet item. C'est un **changement de forme**, pas juste un renommage : `AUDIO.SET`/`AUDIO.CLEAR`/`AUDIO.SET_WAVEFORM` dans `machine.ts` devront être repensés en écriture sur un item + son content, pas sur un champ scène séparé. **Reste ouvert** — décision d'implémentation locale à `machine.ts`, pas un trou de modèle (le modèle a déjà la réponse : `masterItemId` + `Content`).
3. **`TrackNode.label`** — pas de champ équivalent sur `Item`. **TRANCHÉ** : `Item.label?: string` ajouté au modèle — libellé d'affichage libre, distinct de `Content.text` (renommer une piste ne change jamais ce qu'elle montre). Absent → l'éditeur dérive un affichage par défaut (troncature du texte, nom de source, badge de type). Modèle et code déjà mis à jour, même vérification que le point 1.
4. **`durationMs`/`durationSource`** — vivent dans `EditorScene` (ancien) vs `SceneMeta.durationMs`/`.durationSource` (cible, `app/commands/types.ts`). Renommage de chemin, pas de changement de forme — trivial mais à faire partout où `scene.durationMs` est lu (nombreux, `machine.ts`).
5. **`decors: Record<string, EditorDecor>` où `EditorDecor = { id; data: Record<string, unknown> }`** (opaque, `DECOR.REGISTER`) vs `decors: Record<string, Decor>` où `Decor = { id; style?; classes?; position?; zoneId? }` (structuré, cible). L'ancien `data: Record<string, unknown>` est une boîte noire que le sequence-editor ne lit jamais lui-même (il la fait juste transiter) — la migration remplace juste le type transporté, sans logique nouvelle. Sans risque particulier, mais à vérifier qu'aucun code du sequence-editor ne suppose la forme opaque quelque part (`getDecorData`, `controller.ts:304-306`, à revérifier à l'ouverture).

Restent ouverts pour l'ouverture du travail sur `machine.ts` (§4.4, décisions d'implémentation locale, pas des trous de modèle) : le point 2 ci-dessus, et `Keyframe.decorId` obligatoire (cible) vs nullable (ancien — `KEYFRAME.ADD` crée aujourd'hui `decorId: null` par défaut, `machine.ts:453`).

---

## 2. Empreinte exacte de la migration (auditée fichier par fichier, 2026-07-13)

| Fichier | Lignes | Statut |
|---|---|---|
| `sequence-editor/types.ts` | 197 | remplacé par (ou aligné sur) `app/commands/types.ts` — les types propres au sequence-editor qui n'ont pas d'équivalent cible (`ViewportState`, `SelectionTarget`, `InteractionState`, `SnapPoint`, layout/display config) restent, seuls les types de document (`EditorScene`, `TrackNode`, `Keyframe`, `AudioTrack`, `EditorDecor`) sont remplacés. |
| `sequence-editor/machine.ts` | 1090 | **réécriture profonde** — 12 appels à `flattenTracks`/`updateTrackInScene`/`findParentClipBounds` (parcours récursif d'arbre) à remplacer par des filtres/tris sur liste plate (même patron que `build-scene.ts::childrenOf`, déjà écrit et testé côté Builder ed2). Les événements `TRACK.ADD`/`TRACK.MOVE`/`TRACK.NEST_IN_CAPSULE` changent de nature (attacher/réordonner par `parentId`+`order` au lieu d'insérer dans un tableau `children`). `AUDIO.*` à repenser (§1.3.2). Aucune fonctionnalité non liée à l'arbre (playhead, viewport, drag, snap, play range) ne change de logique — seule la représentation de la scène qu'elle consulte change. |
| `sequence-editor/controller.ts` | 441 | méthodes façade minces (proxys vers `send`) — la plupart ne changent pas de signature. Impact réel : accesseurs qui lisent `scene.tracks`/`scene.audio` directement (`getDecorData`, `clipStartDraw` qui appelle `flattenTracks`), et les méthodes `addTrack`/`moveTrack`/`nestTrack` dont la sémantique change avec la structure. |
| `sequence-editor/utils.ts` | 113 | `flattenTracks`, `findParentClipBounds`, `getParentClipMarkers`, `generateSnapPoints`, `getTrackRowHeight` — toutes perdent leur récursion d'arbre au profit d'un lookup/filtre plat sur `items`. Signatures probablement inchangées pour les appelants (même contrat, implémentation interne différente). |
| `sequence-editor/render/track-row.ts` | 211 | **à modifier** — `flattenFiltered` (récursion locale sur `.children`) → filtre+tri plat avec regroupement parent→enfants ; appel à `getParentClipMarkers` conservé (signature inchangée côté utils) ; `track.kind === 'capsule'` → `item.type === 'capsule'`. |
| `sequence-editor/render/track-label-list.ts` | 185 | **à modifier** — `flattenWithDepth` (récursion locale, calcule `depth` pour l'indentation CSS `data-depth`) → calcul de profondeur par remontée de `parentId` (nombre d'ancêtres), pas par descente récursive. Seul module où la profondeur numérique compte réellement pour le rendu (indentation CSS, `sequence-editor.css:125-126`) — tout le reste (regroupement visuel, bouton collapse, badge capsule) ne dépend que de la relation parent↔enfant, pas de la profondeur en tant que valeur. |
| `sequence-editor/render/{cue-row,keyframe-handle,marker-row,playhead-line,time-ruler,waveform-row}.ts` | 40+31+76+43+74+57 = 321 | **aucun changement de logique arborescente** — vérifié fichier par fichier (audité 2026-07-13) : aucun n'accède à `.children`/`flattenTracks`/récursion. Seuls les chemins de champs qui bougent (`scene.durationMs` → `scene.meta.durationMs`, `scene.cues`/`scene.markerTracks` si leur forme change, §1.3.1) les affectent, pas leur structure interne. |
| `sequence-editor/mount.ts` | 599 | 2 appels à `flattenTracks` (garde anti-collision de keyframe, barre d'info) — remplacement trivial par un accès direct à `scene.items` (plus besoin d'aplatir, la liste est déjà plate). Le reste du fichier (RAF, drag, zoom, assemblage des modules render/create) ne change pas de logique. |
| `sequence-editor/stub-controller.ts` | 203 | **mort** — non consommé par `mount.ts`/`AppLayout`/aucun test, seul le barrel `index.ts` le ré-exporte. **À supprimer** dans le même mouvement que cette migration (même principe que D bis : pas d'orphelin laissé derrière), pas à migrer. |
| `sequence-editor/index.ts` | 16 | à mettre à jour : retirer l'export de `StubController`, aligner les types ré-exportés sur ce qui reste propre au sequence-editor après migration. |

**Total à réécrire en profondeur** : `machine.ts` (1090) + `controller.ts` (441, partiel) + `utils.ts` (113) + `track-row.ts` (211, partiel) + `track-label-list.ts` (185, partiel) + `mount.ts` (599, 2 points ponctuels). Le reste (321 lignes de rendu + tests de montage déjà existants) n'a pas de changement structurel à faire.

---

## 3. Points ouverts restants — TRANCHÉS (2026-07-13, avant l'ouverture de `machine.ts`)

Les deux trous de modèle normatif (`MarkerTrack`, `Item.label`) sont tranchés — voir §1.3. Les deux points d'implémentation locale le sont aussi :

1. **`Keyframe.decorId` obligatoire (cible) vs nullable (ancien) — TRANCHÉ.** Même règle que la façade (`base-commands.ts::createKeyframe`, `app/commands/base-commands.ts:109-126`) : quand aucun `decorId` n'est fourni, un décor **vide** (`{ id: decorId }`) est créé et référencé — jamais de `null`. `machine.ts` (`KEYFRAME.ADD`, qui crée aujourd'hui `decorId: null`) s'aligne sur ce patron déjà établi, pas une nouvelle décision de design.
2. **`AUDIO.*` events → item média + rôle master — TRANCHÉ (principe).** Le modèle donne déjà la réponse (§1.3.2) : un son devient un item média ordinaire (`Item` de `type` média), sa waveform et ses cues vivent dans son `Content` (`Content.waveform`, `Content.cues`), et `EditorScene.masterItemId` désigne lequel porte le rythme. `AUDIO.SET`/`AUDIO.CLEAR`/`AUDIO.SET_WAVEFORM` de `machine.ts` deviennent des opérations sur l'item média désigné par `masterItemId` et son `Content`, pas un champ scène séparé — la structure exacte des nouveaux events se pose à l'écriture de `machine.ts` (§4, étape 4), le principe n'est plus à choisir.

---

## 4. Méthode — geler le comportement actuel avant de le réécrire

**Aucun test n'existe aujourd'hui sur `machine.ts`/`controller.ts`** (seul `tests/sequence-editor/mount.spec.ts`, superficiel — vérifie le montage, pas les transitions internes). Réécrire 1090 lignes de machine sans filet est le principal risque de cette migration.

Ordre de travail :

1. **Filet de sécurité (sur l'ancien modèle, avant toute réécriture)** — écrire des tests de `machine.ts` couvrant au minimum : ajout/suppression/déplacement de keyframe, snap, drag, clip draw (intro/outro), virtual keyframes de capsule imbriquée, play/pause/stop/tick, viewport zoom/pan. Objectif : pouvoir comparer le comportement AVANT/APRÈS migration sur les mêmes scénarios, pas seulement constater que "ça compile".
2. **Trancher les points ouverts restants (§3)** — décisions locales à `machine.ts`, avant de l'écrire.
3. **Réécrire `utils.ts`** — le plus isolé, base des deux suivants.
4. **Réécrire `machine.ts`** — le gros du travail, guidé par le filet de l'étape 1 (mêmes scénarios, réécrits contre le nouveau modèle, même résultat observable).
5. **Réécrire `controller.ts`** — façade mince, suit `machine.ts`.
6. **Adapter `track-row.ts`/`track-label-list.ts`** — les deux seuls modules de rendu concernés.
7. **Adapter `mount.ts`** (2 points ponctuels) et **supprimer `stub-controller.ts`**.
8. **Réécrire `tests/sequence-editor/mount.spec.ts`** contre le nouveau modèle (fixture `minimalScene()` actuelle est déjà proche de la forme ancienne — à reconstruire en forme cible).
9. **Validation** : `npx vitest run` + `npx tsc --noEmit` propres ; rendu réel dans Safari (`npm run dev:editor`, une fois câblé au contrôleur central — sinon test d'intégration isolé comme pour dedit).

---

## 5. Hors périmètre de cette migration

- Le mini-éditeur audio multipiste (`2026-07-11-sequence-editor-representation.md`) — la migration d'`AUDIO.*` (§1.3.2/§3.4) va seulement jusqu'à faire tenir le modèle actuel (un master, une piste) dans la forme cible, pas construire le multipiste.
- Le câblage réel au contrôleur central (acteur pont `mountSequenceEditor` ↔ `controllerMachine`) — c'est la suite du jalon E une fois cette migration close, pas une partie de ce document.
- Toute nouvelle fonctionnalité sequence-editor — cette migration change la représentation interne, pas les capacités visibles.
