# Spec — Modèle d'Item (ed2)

> **⚠ PARTIELLEMENT SUPERSÉDÉE (2026-07-12) par `app/2026-07-11-ed2-document-model.md`**, qui fait désormais foi pour le modèle de données. Décisions postérieures qui **remplacent** des points ci-dessous :
> - **§4 (nesting)** : l'item porte désormais **`parentId` + une clé d'ordre fractionnaire** (modèle plat, arbre dérivé) — et NON « pas de champ parent, l'arbre porte tout ».
> - **§5 (`bloc`)** : `bloc` **EST** une valeur distincte d'`ItemType` (le type fondateur sans contenu ; tout item naît `bloc` puis se différencie) — et NON « un `text` à contenu vide ».
> - **§3 / §1** : le **contenu** vit dans une table `contents` séparée (`Content`), distincte du **décor** ; le type ouvre des propriétés dédiées (pas seulement « de décor »).
> Ces sections restent ci-dessous comme trace ; en cas de conflit, le document-modèle prime. À réécrire au chantier qui rouvrira cette spec.

**Périmètre** : le concept d'« item » — l'entité d'authoring centrale d'ed2, reliant en un seul modèle ce qui était éclaté entre `ItemType` (dedit), `TrackNode` (sequence-editor) et `Perso` (Codplay). Le pourquoi des choix ci-dessous est conservé dans `notes/2026-07-08-item-model-deliberation.md`.

---

## 1. Définition

Un item est l'entité que l'auteur crée dans ed2. Trois propriétés le définissent :

1. **Il permet de construire un perso** — au build, un item se résout en exactement un perso Codplay (cf `2026-07-08-builder-plan.md`).
2. **Il est placé dans la timeline** — représenté par un `TrackNode` (sequence-editor), portant ses keyframes.
3. **Il possède un type qui donne accès à des propriétés dédiées** — `ItemType` (dedit), qui détermine les panneaux/propriétés de décor éditables.

## 2. Identité

L'id de l'item est directement l'id du perso Codplay produit — aucune dérivation, aucun préfixe. Le même id sert de bout en bout : `TrackNode.id` (sequence-editor) = `AttachItemInput.itemId` (dedit) = `Perso.id` (Codplay, construit par le Builder via `SceneDocEditor.upsertPerso`).

Conséquence : les ids d'item doivent être uniques dans toute la scène dès leur création (pas seulement dans leur track), puisqu'ils atterrissent directement dans l'espace de nommage des persos d'une story. La capsule racine (`2026-07-08-capsule-spec.md` §6) suit la même règle — son id est celui du perso racine.

## 3. `TrackNode.itemType`

`TrackNode` porte `itemType: ItemType`, avec le vocabulaire dedit comme source unique de vérité (liste complète §5). Ce champ remplace l'ancien `contentType` de sequence-editor-grid-spec, qui dupliquait la même information sous un vocabulaire légèrement différent.

`kind: 'element'|'capsule'` reste sur `TrackNode` pour la distinction structurelle (nesting, `children`) — orthogonal à `itemType`, pas redondant avec lui.

**Le type de perso Codplay (`img`, `media`, `list`…) n'est jamais stocké sur l'item — toujours dérivé d'`itemType` par le Builder**, via la table de mapping (`2026-07-08-builder-plan.md` §5). Pas de champ séparé pour ça tant qu'aucun besoin de dérogation par item ne se présente ; le cas échéant, un nouveau champ explicitement nommé pour ce qu'il est (ex. `componentOverride`) serait la bonne réponse.

## 4. Nesting

Un item n'a pas de champ « parent » propre — son emplacement dans l'arbre (`EditorScene.tracks`, `TrackNode.children` pour les capsules) porte l'information. Un item hors de toute capsule explicite est enfant de la capsule racine (`2026-07-08-capsule-spec.md` §6).

## 5. `ItemType` — énumération

`'text' | 'image' | 'media' | 'video' | 'capsule'`.

`bloc` n'est pas une valeur distincte : un bloc est un `text` à contenu vide (surface colorée sans texte) — aucun branchement supplémentaire dans le mapping `ItemType` → perso Codplay (`2026-07-08-builder-plan.md` §5).

Futurs types média (story-comme-média, lotties, rive, threejs) : chacun sera une valeur `ItemType` **distincte**, jamais un discriminant sous `media` — même raison que celle qui distingue déjà `image`/`video`/`media` entre eux plutôt que de les fusionner (propriétés dédiées propres à chacun). Ajout au fur et à mesure de la disponibilité du composant Codplay correspondant, pas par anticipation.

## 6. Relation aux autres documents

- Décor par keyframe (`Keyframe.decorId` → `EditorScene.decors` → `DecorPatch`) : inchangé, cf `2026-06-11-sequence-editor-grid-spec.md`.
- Mapping `itemType` → type perso Codplay : `2026-07-08-builder-plan.md` §5.
- Capsule = item d'un `itemType` particulier (`'capsule'`) avec des enfants : `2026-07-08-capsule-spec.md`.
