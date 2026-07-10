# Conception — conteneurs de zones (division dynamique persistante)

Document de conception, pas un plan d'exécution. Remplace `docs/plans/2026-07-10-zone-dynamic-division-plan.md` (abandonné : reposait sur un modèle plat aperçu-overlay + « faux gap » calculé à la main, incompatible avec ce qui est décrit ici). Le mécanisme de "diviseur clavier" est une facette d'un modèle plus large — pas un chantier isolé — introduit ci-dessous.

**Révision du 2026-07-11** : le modèle initial (voir historique en mémoire projet) introduisait `ZoneContainer` comme un type SÉPARÉ dans une liste `state.containers` distincte de `state.zones`, avec des enfants (`ZoneContainerChild`) portés par une autre structure. Corrigé — citation exacte : « pourquoi séparer zones et container ? container est une propriété d'une zone. ce qui se passe dans un container est interne. pas de raison d'en faire une entité à part. » `container` est désormais une propriété OPTIONNELLE portée directement par `ZoneDef` : une seule liste `state.zones: ZoneDef[]`, une zone sans ce champ est une zone-feuille classique (comportement inchangé), une zone AVEC ce champ est cette même zone, portant en plus une structure interne divisible. Ce document est réécrit intégralement sur cette base.

## Pourquoi ce document existe

En implémentant le diviseur clavier initial (overlay + lignes d'aperçu + « faux gap »), un obstacle de fond est apparu : le « faux gap » (`ZoneGridModel.fakeGapUnits`, `zone-model.ts`) réinvente à la main un espacement que CSS `gap` résout déjà nativement — acceptable sur la grille fine principale (jusqu'à 160×90 pistes, où un vrai `gap` CSS a un coût documenté à éviter, cf `MAX_GAP_ROWS_COLS_FOR_CSS_GAP`), mais pas justifié sur une sous-structure de quelques pistes.

En cherchant une alternative (un vrai `display:grid` **local et autonome**, porté par le nœud de zone lui-même — voir §Rendu), une question de fond a émergé : cette structure de division doit-elle être un artefact d'édition jetable (comme prévu initialement), ou une donnée persistante de premier ordre ? La réponse, explicite : **persistante**. Une zone divisée porte une structure de division qui survit à plusieurs cycles d'édition, jusqu'à ce que l'utilisateur la casse volontairement. Ce choix porte une intention de conception sur la façon dont cet éditeur pense les grilles — pas un détail d'implémentation.

## Modèle de données

### Identifiant stable — introduit sur toutes les zones

`ZoneDef` gagne un champ `id: string`, distinct de `name` : `id` est stable et persistant (jamais modifié après création, y compris par `renameZone`), `name` reste l'étiquette affichée/renommable — même distinction que partout ailleurs dans le repo entre un identifiant technique et un nom d'auteur. Toute future attache (un enfant de capsule lié à une zone précise) référence l'`id`, jamais le `name` — un renommage ne casse donc jamais une attache existante.

### `container` — propriété optionnelle de `ZoneDef`

```ts
export type ZoneDef = {
  id: string
  name: string
  row: number
  col: number
  rowSpan: number
  colSpan: number
  /** Présent uniquement si cette zone a été divisée — voir §Cycle de vie. Absent = zone-feuille classique, comportement inchangé. */
  container?: ZoneContainerData
}

export type ZoneContainerData = {
  // Petite grille locale portant les enfants — un vrai display:grid autonome au rendu (§Rendu).
  grid: { rows: number; cols: number; gap?: { row: number; col: number } }
  // Enfants en coordonnées RELATIVES à cette grille locale (1-based, même vocabulaire que ZoneDef).
  children: ZoneContainerChild[]
}
```

Une seule liste dans `ZoneEditorState` :

```ts
export type ZoneEditorState = {
  grid: ZoneGridModel
  zones: ZoneDef[]
}
```

Plus de `state.containers` séparé, plus de synchronisation par nom entre deux tableaux. Un `ZoneDef.container` non défini est indiscernable, pour tout consommateur qui l'ignore (capsule-automation, la majorité des gestes existants), d'une `ZoneDef` d'aujourd'hui — aucune migration nécessaire pour le code qui ne s'en soucie pas.

### Nommage des enfants — pas d'identité éditable avant cassure

Décision déterminante, précisée explicitement par l'utilisateur : « les zones container ne sont pas accessibles directement, elles héritent du nom parent plus coordonnée, jusqu'à ce qu'elles soient cassées, là elles sont accessibles comme les autres. » Un enfant n'a donc PAS de `name` propre, renommable indépendamment — son nom d'affichage est calculé (jamais stocké), dérivé du nom de la zone-conteneur et de sa position sur les deux dimensions de la grille locale (ex. zone `z3`, position row 1/col 2 → nom affiché `z3.1.2`, séparateur exact à trancher à l'implémentation). Il porte en revanche un `id` stable, seul élément qui permet une attache persistante avant toute cassure :

```ts
export type ZoneContainerChild = {
  id: string
  // Pas de `name` — calculé à l'affichage depuis ZoneDef.name (de la zone-conteneur) + row/col, jamais stocké.
  row: number
  col: number
  rowSpan: number
  colSpan: number
}
```

Conséquence directe sur l'API existante : `renameZone`/`removeZone` (`zone-model.ts`) n'ont jamais à regarder dans `zone.container?.children` — un enfant n'a rien à y renommer (pas de `name` propre) et n'y est jamais supprimé individuellement (voir §Cycle de vie : jamais moins de 2 enfants, §API `resizeContainerAxis`). Ces deux fonctions restent inchangées, opérant sur `state.zones` par `name` exactement comme aujourd'hui — une zone divisée s'y trouve toujours, comme n'importe quelle autre.

### Profondeur — un seul niveau (décision explicite)

Une zone-conteneur ne contient que des enfants plats (`ZoneContainerChild` n'a pas de `container` propre) — jamais une autre zone-conteneur comme enfant. Simplifie considérablement le rendu (un seul `display:grid` local possible à la fois, pas d'imbrication récursive à valider) et le modèle. Une profondeur illimitée resterait une extension future si un besoin réel apparaît — rien dans ce modèle ne l'empêche a priori, mais ce n'est pas construit maintenant.

### Évolutions déjà voulues, non construites dans ce document

Une zone divisée n'est PAS conçue comme une capacité fermée à `rows×cols` uniforme — c'est un point de départ délibérément minimal. Trois capacités natives de CSS Grid sont explicitement visées pour une extension ultérieure, à exposer comme interface graphique plutôt qu'à réinventer :

- **Pistes de tailles variables, d'abord sur un seul axe puis les deux** : `grid.rows`/`grid.cols` (compteurs uniformes, `repeat(n, 1fr)`) évolueraient vers des tailles de piste individuelles par axe (ex. `colWidths: number[]`), rendues en `grid-template-columns` comme liste explicite au lieu d'un `repeat()` uniforme.
- **Fusion d'enfants adjacents** (comportement colspan/rowspan de tableau) : deux enfants voisins d'une même zone-conteneur fusionnés en un seul avec un `rowSpan`/`colSpan` étendu sur la grille locale — distinct de `mergeZones` existant (qui opère sur des zones-feuilles indépendantes, hors toute structure).
- **Redimensionnement du gap par geste graphique** : cliquer-glisser sur la frontière entre deux pistes adjacentes redistribue leurs tailles (l'une gagne, l'autre perd), avec un accrochage borné par la résolution de la grille fine PRINCIPALE du zone-editor (même résolution que le tracé/déplacement de zones aujourd'hui) — pas une résolution propre à la zone-conteneur. Signalé comme suffisamment porteur à lui seul pour mériter réflexion : « ce seul niveau apporte déjà beaucoup ».

Ces trois points sont cités ici pour qu'ils ne soient jamais redécouverts par accident en supposant le modèle figé à `rows×cols` uniforme — mais volontairement non développés davantage : chacun mérite sa propre session de conception au moment de sa mise en chantier, pas une décision hâtive prise en marge de ce document.

## Cycle de vie

« Diviser en 2 » est le signal fondateur — pas la création d'une structure vide qu'on peuple ensuite. Précision déterminante de l'utilisateur : « dans la capsule, on définit une zone. Dès que "divide" est cliqué (interface extérieure), la zone est divisée en 2. L'interface désigne ensuite combien et quel axe les divisions se font. Les flèches jouent le même rôle. Diviser en deux est le signal que cette zone est devenue un "conteneur de zones". »

```
zone-feuille sélectionnée
  │ action « diviser » (interface externe) — un seul axe, 1 division → 2
  ▼
La MÊME ZoneDef gagne un `container` (grid + 2 enfants) — sa propre géométrie (row/col/
rowSpan/colSpan) ne change PAS, son `id`/`name` non plus. Jamais un `container` avec
children:[] ; jamais moins de 2 enfants (« c'est un diviseur, on passe de deux à un,
jamais à zéro » — le seuil bas de toute réduction ultérieure est 2, pas 1, pas 0)
  │ ajustements suivants : nombre de divisions par axe (flèches clavier ou interface),
  │ mêmes gestes que toute autre zone pour son déplacement/redimensionnement PROPRE
  │ (poignées, drag du corps — inchangés, cf §`ZoneDef.container` et le geste)
  ▼
Zone-conteneur persistante — survit à la désélection, à la fermeture/réouverture de
l'éditeur, à plusieurs cycles de re-sélection + re-édition (ajuster rows/cols encore)
  │ action volontaire explicite de l'utilisateur ("casser" cette zone-conteneur précise)
  ▼
Les enfants sont transposés en ZoneDef indépendantes, géométrie relative → absolue,
FIGÉE telle qu'affichée au moment de la cassure (pas de recalcul ultérieur) — chaque
enfant gagne un `name` propre (calculé avant cassure, désormais persisté), son `id` déjà
existant ne change pas (l'attache d'un item déjà lié à cet id survit à la cassure).
La zone-conteneur SOURCE elle-même disparaît de `state.zones`, remplacée par ces enfants —
irréversible sans un futur système undo/redo (hors scope ici)
```

Point important : il n'y a pas de notion d'« annulation » au sens classique — le seuil bas d'une zone-conteneur est 2 enfants, jamais 1 ni 0 (« c'est un diviseur »). Seule la cassure explicite fait disparaître la structure de division (et la zone-conteneur source elle-même, remplacée par ses enfants). Les gestes exacts de division/ajustement/cassure restent à spécifier dans un futur plan d'implémentation — ce document pose le modèle, pas les gestes exacts.

## `ZoneDef.container` et le geste — un conteneur EST une zone

Décision déterminante, citée verbatim : « aucune raison d'en faire une zone différente des autres, même comportement. » Une zone portant un `container` reste, pour tout geste de sélection/déplacement/redimensionnement de SA PROPRE boîte, une zone comme une autre — mêmes poignées, même drag du corps, même mécanisme de sélection. Rien de nouveau à concevoir sur ce point : le geste existant pour une zone-feuille s'applique tel quel, puisque `container` est un simple champ supplémentaire sur le même `ZoneDef`.

Ce qui EST spécifique à une zone portant `container` :
- Elle affiche en plus, à l'intérieur de sa propre boîte, un rendu `display:grid` matérialisant ses enfants (§Rendu).
- Ses enfants individuels n'ont pas de geste propre (pas de sélection/déplacement individuel) tant que la cassure n'a pas eu lieu — cf §Nommage des enfants.
- Le nombre de divisions par axe (`grid.rows`/`grid.cols`) est ajustable (flèches ou interface) — un axe de manipulation qui n'existe pas sur une zone-feuille classique.

## Rendu — `display:grid` local autonome

Le nœud DOM d'une zone portant `container`, en plus de son rendu de zone normal (bordure de sélection, position en `%`), affiche en son sein un vrai `display:grid` :

```
gridTemplateColumns: repeat(zone.container.grid.cols, 1fr)
gridTemplateRows: repeat(zone.container.grid.rows, 1fr)
gap: zone.container.grid.gap ? `${gap.row}px ${gap.col}px` : undefined   // vrai CSS gap natif
```

Ses enfants sont posés avec `gridRow`/`gridColumn` réels (CSS Grid classique, pas de calcul de fraction manuel) — le navigateur résout position et gap. `measureGridTracks()` (déjà existant, `grid-geometry.ts`) fonctionne directement dessus sans modification : il lit `getComputedStyle().gridTemplateColumns/Rows`, qui retourne des pixels résolus pour un `display:grid` classique.

**Nombre de pistes borné** : une zone-conteneur porte `rows×cols` d'UNE division (généralement 2 à quelques dizaines), jamais la grille fine entière (jusqu'à 14400 pistes) — la contrainte qui a fait abandonner le CSS Grid pour le rendu de la grille fine principale (`renderGridBackground`, `repeating-linear-gradient`) ne s'applique pas ici. Une limite arbitraire (ex. 500 cellules, valeur à ajuster) reste envisageable comme garde-fou si un besoin de protection apparaît, mais rien dans le mécanisme lui-même ne pousse vers de grands nombres.

**Valeur de `gap` par défaut** : demandée explicitement (« il doit y avoir une valeur de gap par défaut »), alignée sur le principe déjà posé pour l'ancien « faux gap » — sa valeur doit s'aligner avec les cellules de la grille PRINCIPALE (`state.grid`), pas être un nombre de pixels arbitraire déconnecté de cette échelle. Calcul concret : mesurer la taille résolue en px d'une piste de la grille principale (via `containerTrackGeometry()`, déjà existant côté `zone-editor.ts` — ce calcul ne peut PAS vivre dans `zone-model.ts`, qui reste pur/sans DOM) et appliquer cette taille (ou un multiple) comme `gap` par défaut lors d'une division. Non encore implémenté — noté ici comme point à trancher avant/pendant l'implémentation du geste de division réel.

**Les enfants suivent le parent nativement** : déplacer/redimensionner la zone-conteneur (sa géométrie propre `row/col/rowSpan/colSpan`, via le même geste que toute zone) redistribue ses enfants automatiquement — propriété native d'un `display:grid` (les enfants grid suivent leur conteneur par construction, aucune logique de re-répartition à écrire).

## Rapport à « card »

« Grille »/« carrousel »/« card » sont des intentions d'usage présentées à l'utilisateur final pour qu'il exprime comment il compte employer une capsule — le mot « capsule » lui-même ne lui est jamais communiqué, c'est un objet strictement interne. Côté utilisateur, « card » se manifeste comme une liste de presets qu'il choisit dans un catalogue (côté éditeur hôte, inchangé par ce document).

La façon de FABRIQUER une card reste délibérément ouverte : une card est au final une collection de zones, et zone-editor a vocation à faciliter cette création — une zone portant `container` en est un outil parmi d'autres pour cette fabrication (division interactive avec gaps ajustables, zones fusionnables une fois ces capacités construites), pas LA nouvelle définition de card ni un remplacement des `ZoneDef` figées comme mécanisme unique. Ce document ne prescrit donc aucun lien structurel entre `container` et le concept de card — seulement que l'un peut servir à produire l'autre, parmi d'autres façons de faire.

## Devenir de `splitZone`

`splitZone`/`getSplitOptions` actuels (éclatement immédiat en zones-feuilles indépendantes, sans structure de division) deviennent redondants avec `divideZone` + cassure immédiate — même résultat final par composition de deux opérations plus simples, au lieu d'une troisième voie de calcul séparée. **Décision : `splitZone` est retiré**, remplacé par `divideZone`/`breakContainer` (signatures exactes ci-dessous, §API).

Conséquences concrètes à traiter dans un futur plan d'implémentation (non détaillées ici) :
- La démo (`packages/demos/src/codplay/zone-editor-demo.ts`, bouton « diviser en 2 ») recomposée en `divideZone` + `breakContainer` immédiat.
- Les tests actuels de `splitZone` (`tests/zone-model.spec.ts`) migrés vers `divideZone`/`breakContainer`.
- `ZoneGridModel.fakeGapUnits` et la fonction `validSplitCounts`/formule `(span−(n−1)×g) % n === 0` deviennent obsolètes — une zone-conteneur a un vrai `gap` CSS, plus de comptage de parts égales à valider a priori (un `display:grid` accepte n'importe quel `rows×cols`, la contrainte "parts égales entières" n'a plus lieu d'être).

`mergeZones` (fusion de zones-feuilles en une seule zone englobante, sans structure interne) reste inchangé — besoin distinct, non concerné par ce document.

## API — signatures exactes (prêtes pour implémentation)

Cette section formalise ce que la prose ci-dessus décrit, pour qu'un futur consommateur externe (l'UI de sauvegarde/emploi de card, dans un autre projet — §Ce que ce document NE couvre PAS) puisse s'appuyer sur un contrat écrit, sans avoir à lire l'implémentation.

### `zone-model.ts` — fonctions pures

```ts
type Axis = 'row' | 'col'

/**
 * Ajoute `container` à une zone-feuille existante — ne la retire jamais de `zones`, ne crée
 * aucune nouvelle entrée : c'est la MÊME ZoneDef qui gagne le champ. Toujours une division en 2
 * sur UN axe — « diviser en 2 » est le signal fondateur (§Cycle de vie), pas un rows×cols
 * arbitraire choisi d'entrée.
 */
export function divideZone(
  state: ZoneEditorState,
  name: string,
  axis?: Axis
): ZoneEditorState
// Lève si `name` n'existe pas dans `zones`, ou si cette zone porte déjà un `container`.
// Grille locale initiale : { rows: 2, cols: 1 } (axis:'row') ou { rows: 1, cols: 2 } (axis:'col',
// et le défaut sans argument — axe vertical, 2 colonnes, décision explicite de l'utilisateur,
// jamais dérivée d'une heuristique).
// 2 enfants créés, chacun avec un nouvel `id`, en position 1 et 2 sur l'axe divisé.
// `gap` par défaut : non calculé ici (fonction pure, sans DOM) — laissé absent ; le geste appelant
// (côté `zone-editor.ts`) applique la valeur mesurée sur la grille principale avant d'appeler ceci,
// ou ajuste `container.grid.gap` après coup (§Rendu — Valeur de gap par défaut).

/**
 * Ajuste le nombre de divisions d'UN axe d'une zone-conteneur existante. « Les zones-enfants
 * correspondent aux cellules d'une grille » — pas un compteur abstrait de pistes qu'il faudrait
 * peupler séparément : `children` est RÉGÉNÉRÉ pour correspondre exactement à rows×cols, une
 * cellule 1×1 par position. Les cellules déjà existantes gardent leur `id` (une attache survit) ;
 * les cellules ajoutées (agrandissement) reçoivent un `id` neuf ; les cellules retirées
 * (rétrécissement) disparaissent avec leur `id` — aucune attache ne peut survivre à ça, il n'y a
 * plus rien à quoi se raccrocher.
 */
export function resizeContainerAxis(
  state: ZoneEditorState,
  name: string,
  axis: Axis,
  count: number
): ZoneEditorState
// Lève si `name` ne porte pas de `container`, ou si `count < 2` sur l'axe résultant en écrasant le
// seuil bas du diviseur (le minimum GLOBAL d'enfants est 2, quel que soit l'axe). Plus de rejet
// « hors bornes » — rétrécir retire simplement les cellules qui n'existent plus, comme retirer une
// ligne/colonne de n'importe quelle grille.

/**
 * Casse UNE zone-conteneur — relative→absolue, figée. La zone SOURCE (portant `container`)
 * disparaît de `zones`, remplacée par ses enfants devenus ZoneDef indépendantes.
 */
export function breakContainer(
  state: ZoneEditorState,
  name: string
): { state: ZoneEditorState; createdNames: string[] }
// Lève si `name` ne porte pas de `container`. `name` (la zone-conteneur) retirée de `zones`,
// remplacée par un ZoneDef par enfant — coordonnées absolues = géométrie affichée au moment de
// l'appel, `name` calculé au moment de la cassure (devient persisté), `id` déjà existant inchangé.
// Jamais appliqué en bloc à toutes les zones-conteneurs — un appelant qui veut "tout figer" itère
// lui-même sur `state.zones.filter(z => z.container)` et appelle `breakContainer` pour chacune.

/**
 * Listing en lecture seule de TOUTES les zones nommées de la scène (feuilles et enfants de
 * zones-conteneurs confondus) — pour le contexte d'attribution : « toutes les zones doivent être
 * accessibles (pas d'édition dans ce contexte) ». Jamais utilisé pour l'édition elle-même
 * (renommer/supprimer un enfant reste impossible avant cassure, cf §Nommage des enfants).
 */
export function listAllZoneNames(state: ZoneEditorState): Array<{
  id: string
  name: string  // calculé pour les enfants, stocké pour les zones-feuilles ET les zones-conteneurs
  kind: 'leaf' | 'container-child'
  containerId?: string  // présent seulement si kind === 'container-child' — id de la zone-conteneur parente
}>
```

### `zone-editor.ts` — `ZoneEditorHandle` (méthodes gestuelles/module)

```ts
divideZone(name: string, axis?: Axis): void
resizeContainerAxis(name: string, axis: Axis, count: number): void
breakContainer(name: string): string[]  // retourne createdNames
listAllZoneNames(): Array<{ id: string; name: string; kind: 'leaf' | 'container-child'; containerId?: string }>
```

Les trois premières remplacent `splitZone`/`getSplitOptions` dans `ZoneEditorHandle` — même discipline que l'existant (`applyState` comme seul chemin d'écriture, notification `onZonesChange`). `listAllZoneNames` est une lecture pure, jamais de notification associée.

### Card — contrat de type dédié

```ts
/** Alias explicite : une card sauvegardée EST un ZoneEditorState complet. */
export type ZoneCard = ZoneEditorState
```

Documente l'intention dans le code plutôt que par convention implicite. Un futur projet UI (externe à ce package, §Ce que ce document NE couvre PAS) sauve une card via `zoneEditorHandle.getState(): ZoneCard`, l'emploie via `zoneEditorHandle.setState(card: ZoneCard): void` — les deux méthodes existent déjà sur `ZoneEditorHandle`, aucune modification requise pour ce point.

## `container` est interne au zone-editor, pas un niveau supplémentaire vers capsule-automation

Deux rapports distincts, à ne pas confondre :

1. **zone-editor ↔ capsule** — déjà établi, inchangé par ce document. `zone-editor` agit sur une capsule EXISTANTE (donnée en amont via `containerId`, toujours en placement grid) pour y définir un groupe de zones nommées. À la fin de l'édition, toutes les zones définies sont disponibles pour cette capsule — ses enfants (via un futur mécanisme de décor) s'accrochent à l'une de ces zones nommées.
2. **`container` — interne au zone-editor uniquement**. Une zone déjà définie peut être divisée pour en créer de nouvelles ; `container` est le mécanisme de cette division, entièrement circonscrit à l'intérieur de l'édition. Il ne « devient » jamais une capsule, ne s'appuie jamais sur `capsule-automation` pour se résoudre.

Conséquence pour la matérialisation : `capsule-automation` ne connaît que des placements plats (`AutoCapsuleChildPlacementInput`, vocabulaire `ZoneDef`-compatible) et n'a jamais besoin de connaître `container`. **Seules les zones sans `container` (ou cassées) sont matérialisables** — une zone portant encore `container` n'a d'existence utile que dans l'éditeur de zones lui-même ; l'éditeur hôte force une cassure avant de pouvoir utiliser ses enfants comme placements réels. Cohérent avec la contrainte déjà actée dans le plan zones original (« pas d'extension capsule-automation »).

## Geste clavier — ajuster rows/cols (implémenté, 2026-07-11)

Écoute globale sur `document` (`keydown`), filtrée par sélection — actif dès qu'exactement une zone est sélectionnée ET qu'elle porte `container`, quel que soit l'élément DOM réellement focus. Zéro préalable côté éditeur hôte. ←→ ajuste `cols` (→ agrandit, ← réduit), ↑↓ ajuste `rows` (↑ agrandit, ↓ réduit — « haut = plus, bas = moins », décision explicite de l'utilisateur), un pas de 1 par frappe, en appelant directement `resizeContainerAxis` (même fonction que l'API — pas de logique dupliquée). Aucun plafond ; le plancher de 2 est déjà géré par `resizeContainerAxis` lui-même (frappe sous le plancher = no-op silencieux). Écoute retirée dans `destroy()`.

**Correction importante trouvée en implémentant, qui a changé `resizeContainerAxis` lui-même** : la première version de cette fonction changeait `grid.rows`/`grid.cols` (un compteur abstrait de pistes) SANS jamais toucher à `children` — grandir la grille laissait de nouvelles pistes visuellement vides. Corrigé après un recadrage direct de l'utilisateur : « les zones-enfants correspondent aux cellules d'une grille ». `resizeContainerAxis` régénère maintenant `children` pour correspondre EXACTEMENT à `rows×cols` à chaque appel — une cellule 1×1 par position, les positions déjà existantes gardant leur `id` (une attache survit), les positions nouvelles recevant un `id` neuf, les positions retirées disparaissant avec leur `id` (rien à quoi une attache pourrait survivre). Le rejet « enfant hors bornes » de la première version n'a plus lieu d'être — rétrécir un axe retire simplement les cellules qui n'existent plus, comme retirer une ligne/colonne de n'importe quelle grille.

## Cassure — bouton de démo (implémenté, 2026-07-11)

La démo (`zone-editor-demo.ts`) expose un bouton « Détacher les zones enfants de la sélection », appelant `editor.breakContainer(name)` sur la première zone sélectionnée — geste ponctuel choisi par l'utilisateur, jamais en bloc, conforme à la motivation déjà posée plus haut. `ZoneEditorHandle.breakContainer` lui-même était déjà exposé depuis la passe précédente ; ce qui manquait était uniquement le point d'entrée UI démo.

## Labels de zone (implémenté, 2026-07-11)

Chaque zone (feuille ou portant `container`) affiche un petit label texte (`data-zone-editor-label`, coin haut-gauche, `pointerEvents:'none'`) montrant son propre `name`. Un enfant de zone-conteneur affiche son nom CALCULÉ (`computeContainerChildName`, désormais exporté — même formule que `breakContainer` utilise, le label montre donc exactement ce qu'une cassure produirait). Visibilité contrôlable indépendamment des zones elles-mêmes via `setPartVisibility('labels', visible)` — troisième bascule à côté de `'grid'`/`'zones'` déjà existantes, demandée explicitement (« un paramètre gérable par api permet d'afficher/masquer : les labels, et les zones elles-mêmes »). `ZoneMachineContext` gagne `labelsVisible` (même pattern d'observation que `gridVisible`/`zonesVisible`).

## Geste clavier — Delete/Backspace efface la sélection (implémenté, 2026-07-11)

`Delete`/`Backspace` retire toutes les zones actuellement sélectionnées (via `removeZone`, sans distinction feuille/`container` — une zone-conteneur part avec toute sa structure interne). Même écoute globale sur `document`, pas de préalable côté éditeur hôte, no-op si rien n'est sélectionné.

**Verrouillage par machine, ajouté après coup sur les DEUX écoutes clavier** (flèches et Delete) suite à une remarque de l'utilisateur : « grâce à xstate, la portée des opérations clavier doit se limiter au contexte de cet éditeur. » Ni l'écoute des flèches ni celle-ci ne consultaient la machine avant cette correction — un vrai trou, du même type que celui déjà trouvé et corrigé pour Alt+clic pendant l'audit de consolidation. Les deux écoutes exigent maintenant `actor.getSnapshot().matches({active:'still'})` avant d'agir — bloque le cas nœud disparu (`suspended`/`idle`) ET le cas d'un autre geste pointeur déjà en capture (`tracing`/`resizing`/`moving`), même garde que celle déjà systématique sur tous les gestes pointeur de ce fichier. Prouvé par test (pas seulement par lecture de code) : un `pointerdown`+`pointermove` sans `pointerup` sur une AUTRE zone laisse la machine en `{active:'moving'}`, et une frappe clavier dans cet état est vérifiée comme un no-op.

## Ce que ce document NE couvre PAS (pour un futur plan d'implémentation)

- Le geste/l'UI côté éditeur hôte pour sauver l'état courant du zone-editor comme entrée de catalogue de card, et pour réappliquer une card existante — techniquement déjà possible sans rien ajouter à `ZoneEditorHandle` (`getState()`/`setState()` suffisent), mais le geste UI lui-même (bouton, menu, etc.) n'est identifié nulle part encore.
- Calcul exact du `gap` par défaut à la division (§Rendu — mesure de piste principale, formule précise, arrondi).
- Le hit-test/sélection des enfants d'une zone-conteneur (sont-ils sélectionnables individuellement en lecture, avant cassure, pour prévisualisation seulement — ou strictement inertes tant que non cassés).
- Migration de l'état existant (une scène avec des zones créées par l'ancien `splitZone`).
- Undo/redo, explicitement mentionné comme hors-scope ("projeté plus tard").
- Détails de rendu visuel (bordure distincte d'une zone-feuille normale sans container, etc.).
- Les trois évolutions listées en « Évolutions déjà voulues, non construites dans ce document » (pistes variables, fusion d'enfants, geste de redimensionnement du gap).

Ces points sont à trancher dans un plan d'implémentation dédié, écrit séparément, avant tout code.
