# Editor — décisions et acceptations ouvertes

Mémoire de travail unique. Les contrats vérifiés sont dans les specs Editor ;
ce document ne répète que les décisions ou portes qui restent ouvertes.

## 1. Terminer l’intégration des zones et blocs

**Décision acceptée.** La capsule porte sa grille. La grille racine fine
(`90 × 160`) rend le placement responsive et proche du libre. Une zone est une
entité distincte d’un bloc ; sa géométrie est une aire CSS Grid (`row`, `col`,
`rowSpan`, `colSpan`). Le parcours par défaut est : déclarer une zone, la
sélectionner, puis créer un bloc qui référence son `Zone.id`. Le tracé de bloc
ne crée jamais de zone. Une géométrie auteur explicite (`x`, `y`, `width`,
`height`) prime sur l’attache à la zone ; la case « Placement par zone » permet
de capturer la géométrie actuelle ou de l’effacer pour revenir à l’emprise de la
zone, en conservant les autres transformations.

Dans une même capsule, déposer un item dans une autre zone change
`Decor.zoneId` au KF pose ; le Builder émet le `move` existant et le player
calcule la trajectoire. Le drop ambigu ou sans cible n’écrit pas de géométrie.

**À accepter dans Editor :** drop sur une autre zone au KF exact puis entre
deux KFs ; priorité de la géométrie explicite et bascule par case à cocher ;
présentation par Play/Seek ; Undo/Redo et rechargement SQLite ; aucun changement
de capsule. Voir la [spec des blocs](../specs/block-creation-spec.md)
et le [contrat d’intégration](../specs/editor-v2-integration-spec.md). La nouvelle
fixture [`zone-movement.html`](../tests/browser/zone-movement.html) exerce les
deux emprises et le `move` réel. La projection du bloc vide remplit maintenant
le cadre de sa zone ; les Seek à 0, 2500 et 5000 ms vérifient départ,
interpolation et arrivée. Le fixture importe le layout réel ; le scroll interne
du menu ne déplace pas la scène. Play rAF reste à accepter : Safari MCP renvoie
`document.hidden === true` après le changement d’onglet ; le drop Editor,
Undo/Redo et le rechargement SQLite restent également ouverts.

## 2. Fermer les portes mouvement V2

- **P2-F :** aucun défaut de ghost n’est reproduit dans une scène valide.
  Ne pas modifier la géométrie sans reproduction. Quatre écritures historiques
  ont un corps inaccessible ; qualifier la porte d’absence d’écriture sur une
  nouvelle session valide.
- **P6 :** l’acceptation du geste natif drag/double-clic reste ouverte. Vérifier
  Play, Seek, Stop, resize et invariance du document ; qualifier aussi l’écart
  restant entre le coin contenu et le Selection Frame.

Les comportements déjà vérifiés sont spécifiés dans les specs
[d’intégration](../specs/editor-v2-integration-spec.md),
[de présentation](../specs/item-presentation-spec.md) et
[d’orientation](../specs/path-tangent-orientation-spec.md).

## 3. Fermer l’acceptation native Remix et historique

Le portage Remix/SQLite, l’historique local et leurs parcours automatisés sont
implémentés. Reste à vérifier les gestes physiques dans l’interface : chaque
geste produit une transaction cohérente, Undo/Redo restaure la sélection encore
valide et le document persiste après rechargement. Les règles stables sont dans
les specs [historique](../specs/editor-history-spec.md), [SQLite](../specs/editor-sqlite-persistence-spec.md)
et [intégration](../specs/editor-v2-integration-spec.md).

## 4. Aligner le modèle ZoneDef de l’éditeur

**Décision d’usage acceptée :** l’identité persistée est `Zone.id` via
`Decor.zoneId` ; le nom reste un libellé. La capsule est l’unique propriétaire
de la grille et ses zones utilisent des aires de pistes. Le Selection Frame
déclare, sélectionne et cible ces zones.

**À relire avant code :** aligner `ZoneDef`/`ZoneCard` et le Builder Editor sur
ce contrat, en préservant le circuit de placement de Capsule Automation. Le
raccord au panneau zone complet et aux capsules imbriquées reste hors de cette
tranche. Le [plan d’intégration zone-editor](../../authoring/selection-frame/plan/zone-editor-plan.md)
reste la référence hors du périmètre Editor.

## 5. Décisions de modèle décor encore ouvertes

- La représentation commune de `width`/`height` entre `Decor.offset` et
  `Decor.style` n’est pas arbitrée. Ne pas introduire de fusion ou de valeur
  de repli qui masquerait l’un des champs.
- **Décision acceptée :** toute valeur CSS ajoutée automatiquement appartient
  au `Decor`. Le code Editor matérialise `width`/`height: 100%` manquants sur le
  décor qui prend en charge l’attache à une zone ; il respecte `style`, `custom`,
  l’offset effectif hérité et les décors partagés. Le Builder ne les injecte plus
  dans l’état runtime. L’ancre privée de `item-component` reste une projection
  structurelle : `max-content` par défaut, `100%` si le Decor résolu demande
  explicitement cette dimension. Typecheck et build Editor passent. La validation
  d’usage sur création, bascule zone/géométrie, Play/Seek, Undo/Redo et SQLite
  reste ouverte avec la tranche 1 ; ne pas déclarer la tranche stabilisée.
- Le projet de catalogue général de capacités du Builder Decor est **A relire**.
  Aucune refonte du Builder ne commence avant validation explicite de son
  modèle, de ses frontières et de son chemin d’acceptation. Les correctifs
  vérifiés restent décrits dans les specs existantes.
