# Dedit — moteur de panneaux de palette : plan de conception

> Le raccordement au player et au cadre décrit par les anciens plans est
> remplacé par le plan V2 actif [`2026-09-01-editor-v2-organization-plan.md`](./2026-09-01-editor-v2-organization-plan.md).
> Ce document ne doit pas être relu comme une instruction de créer un pont V1;
> il conserve uniquement le plan du moteur de panneaux et de son rendu.

**Date** : 2026-07-07
**Périmètre** : refonte de `Family` (`packages/editor/src/decor-editor/`) en un moteur de
panneaux de palette générique, avec séparation stricte contrat/rendu.
**Statut** : implémenté (§3, §4). Voir `2026-07-07-dedit-spec.md` § 4 bis pour l'intégration
dans la spec principale.

---

## 1. Le problème

L'implémentation actuelle de la phase 3 (rendu palette v1) a introduit un type `Family`
(`'color' | 'typo' | 'dimensions' | 'content' | 'transform' | 'capsule' | 'custom'`) qui **fait
double emploi** : il sert à la fois de nom des groupes de propriétés dans `DecorPatch` et de
nom des onglets affichés dans la palette. Cette confusion bloque un besoin exprimé deux fois
par l'utilisateur (onglet « Forme » avec fond + bord + rayon + padding, un regroupement qui
**traverse** plusieurs groupes du patch) et n'a été comprise qu'à la troisième reformulation —
erreur de ma part, à ne pas reproduire : une demande de regroupement d'affichage n'est pas une
demande de restructuration du domaine, et je n'aurais pas dû transformer « border va dans le
groupe logique border » en question ouverte alors que c'était déjà tranché.

Le nom `Family` n'est pas dans la spec d'origine — la spec (§5) parle en prose de familles
comme regroupement thématique filtré par type d'item, sans figer de liste ni de mécanisme.
C'est l'implémentation qui a indûment fusionné ce regroupement avec la structure du décor.

## 2. Principe d'architecture

Le module se scinde en deux couches strictement séparées, communiquant par un **contrat
stable** :

1. **Contrat** (module abstrait, ne change jamais sans raison de fond) :
   - **input** : décor résolu, catalogue de configuration (panneaux, champs, visibilité par
     type d'item), événements utilisateur (sélection de panneau, saisie de valeur, hériter) ;
   - **output** : écarts de décor émis (`onDecorChange`), état de la palette (panneau actif,
     état par champ — uniforme/mixte/écart) ;
   - **organisation des données** : `DecorPatch` (groupes plats, alignés CSS — `color`,
     `border`, `typo`, `dimensions`, `content`, `transform`, `capsule`), résolution
     d'héritage, fusion de patch, multi-sélection. Rien de tout cela ne connaît le mot
     « panneau » ni la notion d'onglet.

2. **Rendu** (couche remplaçable) : construit le DOM, dispatche les panneaux configurés,
   affiche les champs. **Doit pouvoir être dupliqué, modifié, adapté sans changer le contrat**
   — c'est-à-dire sans toucher au domaine, à la machine XState, ni à l'API du contrôleur qui
   n'a pas trait au rendu. Plusieurs rendus pourront coexister à terme (éditeurs différents,
   configurations différentes) sur le même contrat.

Le pont entre les deux est la **configuration de palette** (panneaux + visibilité), fournie
par l'hôte à la construction — jamais codée en dur dans le contrat ni dans un rendu
particulier. C'est la même règle que celle déjà actée pour `selection-frame` : *« tout
catalogue vit dans l'éditeur, les modules ne reçoivent que des valeurs »*.

## 3. Modèle proposé

### 3.1 `DecorPatch` — organisation des données (contrat, inchangé sauf `border`)

`border` devient son propre groupe **plat**, au même niveau que `color`/`typo`/`dimensions` —
pas un sous-groupe imbriqué dans `color`. Raison déjà donnée deux fois par l'utilisateur :
CSS ne groupe pas couleur/épaisseur/rayon de bord sous une clé commune (`border-color`,
`border-width`, `border-radius` sont des propriétés indépendantes), et ce n'est de toute
façon pas une question de regroupement d'affichage — c'est le domaine qui reflète le modèle
CSS fidèlement.

```typescript
color?: {
  background?: ColorValue | null
  text?: ColorValue | null
}
border?: {
  color?: ColorValue | null
  width?: number | null      // cqw
  radius?: number | null     // cqw
}
```

`color.border` (ancien emplacement) disparaît, remplacé par `border.color`.

### 3.2 Panneau — configuration de rendu (pas un type fermé du domaine)

```typescript
interface PanelField {
  path: string          // "color.background", "border.width", "content.padding"…
  kind: 'color' | 'number' | 'boolean' | 'select' | 'text'
  label: string
  options?: string[]    // pour kind: 'select'
}

interface PalettePanel {
  id: string             // ex. "shape", "typo" — libre, jamais énuméré par le domaine
  label: string
  fields: PanelField[]
}

interface PaletteConfig {
  panels: PalettePanel[]
  panelsByItemType: Record<ItemType, string[]>   // ids de panneaux visibles par type
}
```

- Un panneau lit des champs de **n'importe quel groupe** de `DecorPatch` — ex. « Forme » lit
  `color.background`, `border.color`, `border.width`, `border.radius`, `content.padding`.
- Visibilité par type d'item au niveau du **panneau entier** (pas champ par champ pour
  l'instant — raffinement possible plus tard si un besoin réel apparaît, pas anticipé ici).
- **dedit ne fournit aucun panneau câblé en dur.** `dedit-demo.ts` fournit sa propre
  `PaletteConfig` (§4) — un exemple d'usage du moteur, pas une norme imposée par le module.

### 3.3 Ce qui ne change pas (le contrat)

- `DecorPatch`, `ResolvedDecor`, `resolveDecor`, `mergePatch`, `stripInherited`, conversions
  px↔cqw : inchangés — ils opèrent sur des chemins de propriété et des groupes de domaine,
  jamais sur des « familles » ou des « panneaux ».
- `resolveField`, `hasOwnPatch` (multi-sélection au niveau valeur) : inchangés, déjà par
  chemin. Seule l'intersection de **panneaux visibles** doit passer d'un type fermé à des ids
  configurés (`panelsForType`/`panelsForTypes`, mêmes signatures, sur `string`).

### 3.4 Ce qui change dans le rendu et son point d'ancrage dans le contrat

| Avant | Après |
|---|---|
| `type Family = 'color' \| …` (fermé, dans `types.ts` du domaine) | `type PanelId = string` (ouvert) — le contrat ne connaît qu'un identifiant opaque |
| `FAMILIES_BY_TYPE` (constante figée dans `families.ts`) | `PaletteConfig` fournie par l'hôte à la construction du contrôleur — aucune constante par défaut dans dedit |
| Machine : `context.family: Family` | `context.activePanelId: string`, `context.paletteConfig: PaletteConfig` (portée par le contrat, consultée par le rendu) |
| Contrôleur : `selectFamily`/`getFamiliesForCurrentItems` | `selectPanel`/`getPanelsForCurrentItems` — même contrat d'API, généralisé |
| `render.ts` : une fonction par famille (`renderColorPanel`, `renderTypoPanel`…) câblée en dur | Un rendu **générique**, piloté par `PalettePanel.fields` — un seul `renderField(field)` qui dispatch sur `field.kind`. Ce fichier EST la couche remplaçable : un second `render.ts` pourrait exister à côté sans toucher au contrat |

## 4. Configuration fournie par la démo (exemple d'usage, pas une norme dedit)

```
Forme       → color.background, border.color, border.width, border.radius, content.padding
Typo        → typo.fontFamily, typo.fontSize, typo.bold, typo.italic, typo.align, color.text
Dimensions  → dimensions.x, dimensions.y, dimensions.width, dimensions.height
Custom      → custom (mini-éditeur, cas spécial — pas une liste de PanelField classique)
```

`transform`/`content` (attache-flex)/`capsule` restent hors de cette démo v1 (phases 4/6) —
absents de la config, donc absents des tabs, sans code mort à prévoir.

## 5. Décisions prises lors de l'implémentation

1. **`custom`** : cas spécial hors modèle `PanelField[]` — un `PalettePanel` est marqué
   `kind: 'custom-code'` au niveau du panneau entier plutôt que d'un champ.
2. Tests réécrits pour `PanelId`/`PANEL.SELECT`/`panelsForType(s)` ; `decor-editor-families.spec.ts`
   supprimé, remplacé par `decor-editor-palette-panel.spec.ts`. Aucune compatibilité
   préservée avec `Family`/`FAMILY.SELECT`/`familiesForType(s)`.
3. Spec principale (`2026-07-07-dedit-spec.md`) mise à jour en conséquence (§ 3, § 4, § 4 bis,
   § 5, § 7 bis).

## 6. Deuxième refonte : `DecorPatch` devient une carte CSS plate

Après une première correction (`border` en groupe plat séparé de `color`, § 3.1), l'erreur de
fond persistait à un niveau plus large : `color`/`typo`/`dimensions`/`content`/`transform`
étaient eux-mêmes des sous-catégories CSS artificielles introduites par l'implémentation,
sans aucune justification de fond — CSS ne se subdivise pas ainsi (`dimensions` regroupait
déjà des propriétés CSS indépendantes par thème, exactement comme le `border` corrigé en
première passe). Le principe retenu, dicté par l'utilisateur : *« un ensemble de propriétés
représente un décor : des classes CSS, des styles CSS, des paramètres de configuration
(capsule), un module spécial position (données transposées ensuite en styles/classes CSS,
donc à part) »* — CSS lui-même reste un **groupe unique**, jamais subdivisé dans le domaine.

Conséquences retenues, actées dans la spec principale (§ 3.2) :

- `DecorPatch.style: Record<string, string>` remplace tous les anciens groupes CSS
  (`color`, `typo`, `dimensions`, `content`, `transform`, `border`) — carte ouverte,
  aucune propriété nommée en dur.
- Chaque valeur de `style` est une **chaîne CSS déjà finale** (jamais un nombre brut avec
  unité implicite à convertir en aval) — la palette résout la conversion via une config
  centralisée (`css-value-format.ts`), pas des fonctions arbitraires par champ.
- `classes` réutilise le modèle déjà existant du runtime codplay (`ClassNameValue` =
  `string | { add?: string; remove?: string }`, `packages/codplay/src/runtime/perso-shared-types.ts`)
  plutôt qu'un format `string[]` propre à dedit — un seul modèle de classes CSS dans tout
  le projet. La fusion d'écarts successifs réutilise le même algorithme add/remove que
  `applyClassNamePatch`, réimplémenté en pur (sans DOM) dans `merge.ts`.
- `position` (ex-`dimensions`+`transform`+`content.anchor`) devient le premier exemple d'une
  famille de modules « non-CSS transposés en aval » — d'autres pourront suivre (bordures par
  côté, clip-path…) chaque fois qu'une interface intermédiaire est nécessaire.
- La couleur ne porte pas de type structuré dédié dans le domaine (plus de `ColorValue`) —
  simple chaîne CSS comme le reste de `style`. Elle pourra devenir un module à part comme
  `position` si son édition a besoin d'un état structuré (roue teinte/chroma, dégradés à
  plusieurs arrêts), mais ce n'est pas le cas actuellement.

Fichiers impactés : `types.ts` (modèle), `merge.ts`/`strip-inherited.ts` (fusion générique,
plus de liste de groupes figée sauf `position`/`capsule`), `css-value-format.ts` (nouveau,
config de formatage), `render.ts` (champs génériques par `field.kind`, plus de fonction par
nom de panneau), `dedit-demo.ts` (config de palette avec chemins `style.*`), tous les tests
du module.

## 7. Reste à faire

- **Cadre de sélection** : l'intégration V2 est traitée par le plan actif ; ce
  plan de panneaux ne crée pas de pont de position. Les extensions attache-flex
  et coordination multi-contexte restent hors de son périmètre.
- **Zones** (spec § 7) : palette de nommage/sélection, cards, contextes d'orientation,
  contrat avec `createZoneEditor` — dépend du module `createZoneEditor` de
  `selection-frame`, non implémenté.
- **Dégradés** : linéaire à 2 arrêts et angle pour l'instant, à étendre si besoin.
- **Seuil d'orientation** : ratio l/h ≥ 1 → horizontal, sans hystérésis — à ajouter si un
  battement est observé en pratique.

## 8. Point de méthode retenu

Une demande de réorganisation d'affichage reformulée plusieurs fois sans effet signale une
confusion de modèle côté implémentation (deux responsabilités distinctes fusionnées dans un
seul type), pas une formulation ambiguë côté utilisateur — chercher la séparation manquante
plutôt que redemander une clarification.
