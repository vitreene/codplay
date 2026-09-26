# Plan — Migration `ZoneDef` (dedit) vers la forme grille

**Périmètre** : `packages/editor/src/decor-editor/types.ts` (`ZoneCoords`, `ZoneDef`, `ZoneTable`, `ZoneCard`) et `zones.ts`.
**Dépend de / s'aligne sur** : la [spécification zone-editor](../../../authoring/selection-frame/specs/zone-editor-spec.md) pour le modèle vérifié, son [plan d'intégration](../../../authoring/selection-frame/plan/zone-editor-plan.md) pour les raccords non appliqués, et le [plan des variantes d'orientation](2026-07-11-zone-orientation-variants-plan.md) pour la responsabilité des surfaces côté éditeur.

---

## 1. Problème

Deux types nommés `ZoneDef`, incompatibles, existent déjà dans deux packages :

- **dedit** (`packages/editor/src/decor-editor/types.ts`) : `ZoneDef = {name, coords:{x,y,width,height}}` (ou variante `contexts`) — rectangle en **cqw**.
- **selection-frame** (`packages/authoring/selection-frame/src/zone-model.ts`) : chaque zone a un `id` stable, un `name` et `row`, `col`, `rowSpan`, `colSpan`, avec éventuellement une division `container` — **adresse de cellule de grille**.

Le second est le modèle vérifié produit par `createZoneEditor`. dedit doit passer des rectangles cqw aux coordonnées de pistes. L'identité stable `id` doit aussi être intégrée avant de brancher les attaches persistantes. Le nom reste nécessaire comme libellé dans selection-frame, tandis que le plan d'orientation propose un nom par ordre : cette différence doit être arbitrée avec les consommateurs avant de figer la forme dedit.

## 2. Forme cible

La forme cible doit conserver l'identité et la responsabilité retenues, sans figer ici un discriminant non arbitré :

- un `id` stable, distinct du `name` modifiable, pour les attaches persistantes ;
- une ou plusieurs géométries en pistes (`row`, `col`, `rowSpan`, `colSpan`) ;
- si plusieurs surfaces sont présentes, leur sélection reste une responsabilité de l'éditeur, tandis que `createZoneEditor()` reçoit l'état d'une seule surface ;
- le nommage et le lien entre `DecorPatch.zone`, la table des zones et `ZoneCard` restent à réconcilier avec les contrats de capsule et d'orientation avant l'implémentation.

## 3. Impact sur `zones.ts`

`orientationFromRatio`, `coordsForContext`, `updateZoneCoords` lisent actuellement la structure `name`/`coords`/`contexts`. Vérifier à l'implémentation quelles opérations restent valides avec les `id` et les coordonnées de pistes ; ne pas présumer que la migration est un renommage de type seul. Les tests `decor-editor-zones.spec.ts` doivent couvrir l'identité stable et la mise à jour d'une surface sans altérer les autres.

## 4. Résolution zone → placement (Builder)

Le contrat actuel de l'éditeur utilise `DecorPatch.zone: string | null` comme référence par nom. Le modèle selection-frame retient l'`id` stable pour une attache persistante. Le Builder et dedit doivent adopter une même clé avant d'implémenter la résolution zone → placement ; aucune recherche par nom n'est prescrite ici tant que cette divergence reste ouverte.

Les coordonnées plates en pistes (`row/col/rowSpan/colSpan`) sont le chemin existant à valider pour le placement CSS. Ne pas utiliser `AutoCapsuleChildPlacementInput.area` sans avoir vérifié la génération CSS de ce champ. Le drop live du cadre reste un parcours distinct, suivi dans le [plan zone-editor](../../../authoring/selection-frame/plan/zone-editor-plan.md).

## 5. Ordre

1. Arbitrer identité, nommage, surfaces et format de `ZoneCard` à partir des plans d'orientation, de capsule et de zone-editor.
2. Migrer les coordonnées cqw vers les coordonnées de pistes et ajouter l'`id` stable dans `types.ts`.
3. Adapter et compléter `decor-editor-zones.spec.ts` ; vérifier la résolution des contextes et la conservation des identifiants.
4. Implémenter et intégrer la résolution zone → placement côté Builder avec le chemin CSS de capsule-automation vérifié.
5. Valider l'attache par `id` après renommage et cassure d'une division ; coordonner le drop live avec le [plan zone-editor](../../../authoring/selection-frame/plan/zone-editor-plan.md).
