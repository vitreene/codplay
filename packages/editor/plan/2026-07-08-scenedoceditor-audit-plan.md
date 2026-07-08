# Plan — Audit et remise à niveau de `SceneDocEditor` depuis Codplay

**Périmètre** : `packages/authoring/scene-factory/src/scene-doc-editor.ts`, comparé au modèle de domaine Codplay actuel (`packages/codplay/src/builder/types.ts`, `player/types.ts`).
**Origine** : hypothèse de l'utilisateur (2026-07-08) — depuis la séparation `SceneDocEditor`/`CodPlay` (2026-06-20), des notions du modèle de scène ont pu évoluer côté Codplay sans que `SceneDocEditor` suive. **Confirmée ci-dessous, pas seulement plausible.**
**Chantier distinct** du plan Builder (`2026-07-08-builder-plan.md`) — celui-ci en dépend, ne le contient pas.

---

## 1. Principe

`SceneDocEditor` est un **helper de squelette** : il permet de construire aisément les parties nécessaires à une scène en fournissant une charpente (id, structure, valeurs par défaut) dans laquelle les données injectées par l'appelant viennent se placer. Ce n'est pas une classe de validation ni un moteur de règles métier — c'est un outil de confort qui absorbe le boilerplate structurel (génération d'id, valeurs par défaut de `move`, forme des collections) pour que l'appelant ne fournisse que le contenu propre à sa scène.

## 2. Preuve du décalage (git, pas une supposition)

`scene-doc-editor.ts` n'a été touché que par **deux commits** depuis son extraction (`404d1cd`, 2026-06-20) : `69c4acb` (« story at root », 2026-06-29) et `ca5af19` (« maj spec pratiques » — documentaire). Sur la même période, `packages/codplay/src/builder/types.ts`/`player/types.ts` ont évolué par au moins trois autres commits qui n'ont **jamais** touché `scene-doc-editor.ts` :

- **`74ae023` « composants types » (2026-06-26)** — `PersoDoc` (player) devient générique et type-sûr par type de perso : `PersoDoc<T extends ItemType> = { ..., initial: ItemState<T>, list?: ListConfig, actions: Record<string, ActionDoc<T> | null> }`. **`Perso` (builder, celui que `SceneDocEditor` clone) n'a jamais reçu la même mise à niveau** — toujours `{id, name?, type: string, initial: Record<string,unknown>|undefined, actions: Record<string,unknown>, emit?}`, sans `list`. **Le décalage n'est donc pas uniquement dans `SceneDocEditor` : le type `Perso` lui-même (`packages/codplay/src/builder/types.ts`) doit d'abord recevoir le champ `list?: ListConfig`, avant que `SceneDocEditor` puisse le préserver au clone.**
- **`ee6b87d` « migration entries vers @root » (2026-06-29 matin)** — `entries: string[]` retiré de `StoryDef`/`SceneStoryDoc`. Le plan d'origine de `SceneDocEditor` (`2026-06-20-authoring-reorganisation-plan.md`) prévoyait un `setStoryEntries(...)` — jamais implémenté, correctement (le champ a disparu du modèle avant que cette partie ne soit construite). Confirme que le modèle a continué de bouger juste après l'extraction — pas un manque à corriger aujourd'hui, un signe de plus.
- **`69c4acb` « story at root » (2026-06-29 soir)** — suppression de `rootStories`, remplacé par le move porté par chaque story. **A touché `scene-doc-editor.ts`** — synchronisation à confirmer explicitement (§4, point 2), pas juste supposée bonne.

## 3. Ce que le plan d'origine (2026-06-20) prévoyait, vs ce qui existe, vs ce qu'il faut

| Méthode/champ (plan d'origine) | État actuel | Décision |
|---|---|---|
| `create`, `createStory`, `createPerso`, `upsertStory`, `removeStory`, `upsertPerso`, `removePerso`, `setStoryListen`, `setStoryStraps` | Présents, conformes | Conserver |
| `setStoryEntries` | Absent | **Correctement absent** — `entries` n'existe plus dans `StoryDef` (§2). Ne pas réimplémenter. |
| `scene.rootStories` | Absent | **Correctement absent** — `rootStories` n'existe plus dans `SceneDef` (§2). Ne pas réimplémenter. |
| `scene.initial/init/listen/straps/tracks` | Présents (`tracks` a en plus `.upsert`/`.remove`) | Conserver |
| — (pas dans le plan d'origine) | `setStoryDisabled` existe déjà (ajouté après coup, `StoryDef.disabled` réel) | Conserver |
| — (pas dans le plan d'origine) | `createStory`/`createPerso` : id toujours auto-généré par slug, aucune option d'id explicite | **À ajouter** — paramètre `id?` optionnel, génération par slug conservée par défaut si absent |
| — (pas dans le plan d'origine) | `cloneStory()` supprime `trackId` à chaque écriture | **À corriger** — simple oubli de champ dans le clone, pas une nouvelle méthode |
| — (pas dans le plan d'origine) | `SceneDef.state`/`onStart`/`onSequenceEnd` inaccessibles (pas de `scene.state`/`scene.onStart`/`scene.onSequenceEnd`) | **À ajouter**, sur le modèle de `scene.initial.set` |
| — (pas dans le plan d'origine) | `clonePerso()` ne garde que `{id,name,type,initial,actions,emit}` | **À corriger** — une fois `Perso.list` ajouté côté Codplay (§2), le faire suivre dans `clonePerso()` |

## 4. Méthode de mise en œuvre

1. **Lister les méthodes nécessaires** — table ci-dessus, complétée si la revue des specs normatives (`v1-scene-spec.md`, `v1-story-spec.md`, `v1-perso-spec.md`, `v1-authoring-api.md`) révèle un besoin non capturé par le seul diff de types (contraintes de validation, invariants).
2. **Revoir les besoins spécifiques du plan d'origine** — fait ci-dessus (§3). Vérifier en particulier que `69c4acb` a bien retiré toute trace de `rootStories` dans `scene-doc-editor.ts` (pas de reliquat mort).
3. **Reconstruire proprement la classe** — appliquer la table §3, en gardant le principe de squelette (§1) : chaque méthode reste un placement de données dans une charpente, pas une validation métier.
4. **Surveiller les usages existants** pour ne rien casser silencieusement — inventaire complet, confirmé par recherche dans tout le repo (aucun usage dans `packages/demos`, uniquement ces trois fichiers) :
   - `packages/codplay/tests/v1/creator-api.spec.ts` — verrouille le contrat de `SceneDocEditor` lui-même (`create`/`createStory`/`createPerso`/`exportSceneDoc`/`scene.initial`/`scene.tracks`/`upsertStory`). Référence directe pour ne pas changer un comportement sans le vouloir.
   - `packages/codplay/tests/v1/codplay-flow.spec.ts` — flux bout-en-bout `SceneDocEditor → BuilderFacade → Player.init`, exactement le pipeline que suivra le Builder ed2.
   - `packages/codplay/tests/v1/third-party-binding-registration.spec.ts` — utilise `SceneDocEditor` uniquement comme raccourci pour fabriquer une scène minimale valide (`createMinimalCompiledScene()`), afin de tester autre chose. Exemple concret du principe de squelette (§1) à l'œuvre.

   Toute modification de comportement observable doit mettre à jour ces tests explicitement, jamais les laisser rouge ou les contourner.

## 4 bis. Colocalisation avec `CapsuleDistribution` (décidé 2026-07-08)

`CapsuleDistribution` (aujourd'hui `packages/editor/src/sequence-editor/capsule-distribution.ts`) rejoint `packages/authoring/scene-factory/` — les deux classes métier du Builder vivent dans le même dossier, chacune avec son périmètre propre et testable (cf `2026-07-08-capsule-automation-reconciliation-plan.md`). `CapsuleDistribution` n'a besoin d'aucune remise à niveau structurelle (déjà pure, statique, isolée — vérifié) : seul son import change de place.

## 5. Relation avec le Builder

`2026-07-08-builder-plan.md` dépend du résultat de ce chantier (`SceneDocEditor` en devient la classe métier testable) mais ne le contient pas. Ordre : ce chantier avant l'étape 2 du plan Builder (« Compléter `SceneDocEditor` »), qui se réduit alors à appliquer les conclusions de l'audit plutôt qu'à le redécouvrir.
