# Plan — Migration `ZoneDef` (dedit) vers la forme grille

**Périmètre** : `packages/editor/src/decor-editor/types.ts` (`ZoneCoords`, `ZoneDef`, `ZoneTable`, `ZoneCard`) et `zones.ts`.
**Dépend de / s'aligne sur** : `docs/plans/2026-07-03-selection-frame-variantes-plan.md` (plan zones déjà arbitré, module `createZoneEditor` à construire séparément dans selection-frame).

---

## 1. Problème

Deux types nommés `ZoneDef`, incompatibles, existent déjà dans deux packages :

- **dedit** (`packages/editor/src/decor-editor/types.ts`) : `ZoneDef = {name, coords:{x,y,width,height}}` (ou variante `contexts`) — rectangle en **cqw**.
- **plan zones / selection-frame** (déjà arbitré) : `ZoneDef = {name, row, col, rowSpan, colSpan}` — **adresse de cellule de grille**.

Le second est celui qui sera réellement produit par `createZoneEditor` (tracé aimanté aux pistes mesurées) et consommé par capsule-automation (classes CSS `grid-row`/`grid-column`, déjà fonctionnelles pour ce chemin). dedit doit migrer vers cette forme — c'est elle qui fait foi.

## 2. Forme cible

```ts
// dedit/types.ts — après migration
export interface ZoneCellCoords {
  row: number; col: number         // 1-based
  rowSpan: number; colSpan: number
}

export type ZoneDef =
  | { name: string; coords: ZoneCellCoords }
  | { name: string; contexts: Record<OrientationContext, ZoneCellCoords> }

export type ZoneTable = ZoneDef[]
export interface ZoneCard { name: string; zones: ZoneTable }   // inchangé
```

La structure externe (`name` + `coords`/`contexts` par `OrientationContext`) ne change pas — seul le contenu de `coords` change de rectangle cqw à adresse de cellule. Le plan zones lui-même ne gère qu'une seule surface à la fois (§« Surfaces et contraintes ») ; le découpage par `OrientationContext` reste une responsabilité dedit, pas du module `createZoneEditor`.

## 3. Impact sur `zones.ts`

`orientationFromRatio`, `coordsForContext`, `updateZoneCoords` sont génériques — elles manipulent la structure `name`/`coords`/`contexts` sans jamais lire les champs internes de `coords`. **Migration attendue : renommage de type seul, aucun changement de logique.** À vérifier concrètement à l'implémentation (les tests existants, `decor-editor-zones.spec.ts`, doivent passer après le seul changement de type + adaptation des fixtures de test).

## 4. Résolution zone → placement (Builder)

Quand un enfant référence une zone par nom (`DecorPatch.zone: string`), le Builder résout : `zone = capsule.zones.find(z => z.name === decorPatch.zone)` → `coordsForContext(zone, currentContext)` → pose directement `{row, col, rowSpan, colSpan}` sur `AutoCapsuleChildInput.placement` (le chemin `row/col/rowSpan/colSpan` de capsule-automation, qui génère déjà du CSS correctement).

**Ne pas utiliser `AutoCapsuleChildPlacementInput.area`** pour cette résolution : ce champ existe dans les types mais ne génère aujourd'hui aucune règle CSS (`cssRules: []`, confirmé à l'audit) — il est réservé par le plan zones pour une étape d'intégration finale et distincte (drop live du cadre de sélection directement par référence de zone, §« Lien avec le cs » du plan zones, étape 9 de sa séquence d'implémentation). Résoudre le nom en `row/col/rowSpan/colSpan` côté Builder évite cette dépendance non prête.

## 5. Ordre

1. Renommer les types (`ZoneCoords` → `ZoneCellCoords`, champs `x/y/width/height` → `row/col/rowSpan/colSpan`) dans `types.ts`.
2. Adapter les fixtures de `decor-editor-zones.spec.ts` à la nouvelle forme ; confirmer qu'aucune logique de `zones.ts` ne change (§3).
3. Implémenter la résolution zone → placement côté Builder (§4), une fois le Builder et capsule-automation en place (dépend de `2026-07-08-builder-plan.md`).
4. Pas de dépendance dure sur `createZoneEditor` lui-même (Phase 2 du plan selection-frame) pour cette migration de type — mais le champ n'aura de vraies valeurs à afficher/éditer qu'une fois ce module construit.
