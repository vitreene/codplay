# Editor — décisions et acceptations ouvertes

Mémoire de travail unique. Les contrats vérifiés sont dans les specs Editor ;
ce document ne répète que les décisions ou portes qui restent ouvertes.

## 1. Terminer l’intégration des zones et blocs

**Décision acceptée.** La capsule porte sa grille. La grille racine fine
(`90 × 160`) rend le placement responsive et proche du libre. Une zone est une
entité distincte d’un bloc ; sa géométrie est une aire CSS Grid (`row`, `col`,
`rowSpan`, `colSpan`). Le parcours par défaut est : déclarer une zone, la
sélectionner, puis créer un bloc qui référence son `Zone.id`. Le tracé de bloc
ne crée jamais de zone. Dans ce parcours Zone, l’emprise de `Decor.zoneId` est
la base de position et de taille ; le positionnement absolu précédemment
développé reste disponible dans le modèle, mais l’éditeur Zone ne l’utilise pas.
Le mode spécial de décalage relatif à la zone est distinct.

Dans une même capsule, déposer un item dans une autre zone change
`Decor.zoneId` au KF pose ; le Builder émet le `move` existant et le player
calcule la trajectoire. Le drop ambigu ou sans cible n’écrit pas de géométrie.

**Décision acceptée — configuration de capsule dans Décor :** sélectionner une
capsule expose un onglet `CapsuleDef` qui choisit parmi les types
`Capsule Automation`. Pour les types à grille manuelle (`grille`, `card`), un
éditeur visuel règle lignes, colonnes et gouttières. Les zones personnalisées
se créent et se modifient dans l’éditeur Zone sur cette même grille ; leur
emprise reste distincte des blocs. Le Builder continue de confier la projection
de grille et de placement à Capsule Automation.

**Repli provisoire accepté — changement de grille :** préserver les `Zone.id`,
borner leurs emprises à la nouvelle grille et répartir les enfants directs dans
leur ordre Editor, un par zone dans l’ordre affiché ; les enfants excédentaires
vont sur la dernière zone. La répartition écrit le décor initial seulement ;
les affectations explicites des KF pose restent intactes. Un changement de type
préserve la grille et les zones. Ce repli ne tente pas de conserver la position
visuelle et pourra être révisé à partir de l’usage.

L’acceptation couvre le choix du type, l’édition visuelle de la grille, la
création de zones, leur utilisation pour créer des blocs, la redistribution et
la persistance/historique Editor.

**En cours — CapsuleDef :** l’onglet Capsule, les commandes centralisées, la
surface de zones imbriquées et la projection des gouttières sont raccordés ;
build et typecheck passent. Le parcours navigateur, Undo/Redo et la restauration
SQLite restent à accepter avant de déplacer le comportement vérifié dans une
spec.

**Décision acceptée — cible et déplacement dans le test Zone :** sélection
implicite et active par défaut ; Zone/Bloc choisit exclusivement le type de
cible. Entrer en mode Bloc efface la sélection visuelle et l’état de zone, puis
permet de sélectionner un bloc. Le mode Zone permet de sélectionner/éditer les
zones. Pour un item en zone, le déplacement vers une autre zone est le geste
par défaut en mode Bloc et ne demande pas d’icône dédiée ; le CS de déplacement
sans poignées réassigne le bloc via le `move` V2. L’icône Décalage active le
Selection Frame existant pour éditer les transforms relatifs à cette zone ; il
ne remplace ni l’affectation `zoneId` ni sa géométrie. Un item en placement libre
garde le Selection Frame et son circuit d’écriture existants. Dans une capsule
« zone libre » à grille fine, le CS alternatif place et dimensionne le bloc par
emprise de pistes, avec des poignées calées sur la grille ; il ne passe pas par
le Selection Frame ni par le positionnement absolu. Au pointerdown du geste de
déplacement, Editor révèle temporairement les zones de dépôt ; si la grille
active est la fine grille `90 × 160`, il révèle la grille et masque les zones.
Le réglage de masquage ne s’applique qu’au repos ; le pointerup ou l’annulation
restaure la visibilité précédente. Cet aperçu ne change pas le contrat de drop.

**Décision acceptée — décalage relatif à la zone :** la zone reste la géométrie
de référence ; l’outil Décalage applique `Decor.offset.translate`, `rotate`,
`scale` et `rotationOrigin` à cette emprise, sans écrire `offset.x/y/width/height`.
Le déplacement de zone reste le geste par défaut ; Décalage est l’option
exclusive qui transforme l’item sans le réassigner. Le Builder conserve la cible
de zone et le circuit V2 existant produit le transform CSS et interpole ses
composantes par ACE. Le Selection Frame compose les transformations dans le
bridge Editor et persiste les valeurs structurées via le contrôleur central.

**À préciser avant implémentation :** comment le mode « zone libre » est
identifié dans `CapsuleDef` et où son emprise de pistes est persistée pour
l’item (le modèle courant expose `zoneId` et `offset`, mais pas de placement de
grille direct). Capsule Automation accepte déjà `placement` par enfant ; Editor
doit l’alimenter par son contrôleur, sa persistance et le Builder existants.
Le CS position/taille en grille de la capsule zone libre reste à intégrer.
Reste aussi à définir la création d’un bloc après effacement de la sélection de
zone.

**En cours — outils Zone/Bloc :** le contrôleur efface maintenant la zone
sélectionnée à l’entrée du mode Bloc. Le clic scène et le nom de timeline
passent par la même sélection centrale ; l’écoute `pointerdown` en capture
survit à l’overlay Zone et résout l’item depuis la pose publiée quand le DOM
player ne porte pas directement son identité. En mode Bloc, l’overlay Zone
reste visuel mais inerte ; un item dont le placement effectif suit une zone
reçoit par défaut le CS de réassignation sans poignées. L’icône Décalage active
le Selection Frame pour éditer translate/rotate/scale/pivot relativement à la
zone, tandis que le Selection Frame général reste disponible pour un item en
placement libre. Le code raccorde maintenant ce geste au contrôleur et garde
`zoneId` comme cible lorsque seuls les transforms changent ; la bascule
Déplacement a été retirée. Au début du drag, les zones apparaissent comme cible
de drop ; sur la grille fine `90 × 160`, la surface affiche plutôt les pistes.
La barre d’icônes Zone/Bloc et le réglage d’affichage des zones restent au-dessus
des panneaux Décor. Il reste à valider en Editor la présentation et restauration
de cet overlay, le drag de zone et de décalage, l’écriture `Decor.zoneId` et des
transforms, Undo/Redo, Play/Seek et persistance. Conserver ce module `En cours`
jusque-là.

**À accepter dans Editor :** drop sur une autre zone au KF exact puis entre
deux KFs ; la zone reste la référence dans le parcours Zone ; présentation par
Play/Seek ; Undo/Redo et rechargement SQLite ; aucun changement de capsule. Voir
la [spec des blocs](../specs/block-creation-spec.md)
et le [contrat d’intégration](../specs/editor-v2-integration-spec.md). Le drop,
Play/Seek, Undo/Redo et le rechargement SQLite restent à accepter directement
dans l’application Editor principale, sur son layout courant. La page autonome
`zone-movement.html` et sa scène fixture sont retirées ; aucun nouveau layout de
démonstration ne sera créé pour ce parcours.

## 6. Simplifier l’interface de l’application Editor

**Décision acceptée :** garder le layout courant. Undo/Redo et les commandes de
scène sont iconiques ; la scène reste choisissable dans le catalogue. Les outils
de création `Bloc` et `Texte` sont iconiques, avec des noms accessibles, et
gardent les commandes centrales existantes. Sans item sélectionné, Décor montre
les contrôles racine déjà disponibles. `Aller à kf1` et les boutons de fixture
sont retirés. Les opérations de scène sont regroupées sous `Scène`, les créations
sous `Bloc`, et Undo/Redo forment un groupe `Application` distinct. Undo/Redo
reste à son emplacement courant jusqu’au choix ultérieur de son emplacement.
Les boutons icônes ont un gabarit compact fixe, centrent leur icône et ne
s’étirent pas sur la largeur du groupe ; chaque action à icône ou glyphe porte
un `title` descriptif. Typecheck et build Editor passent.

**Décision acceptée — suppression de scène :** supprimer la scène active de
SQLite ; la première scène restante selon l’ordre du catalogue devient active.
Conserver au moins une scène et désactiver la suppression lorsqu’il n’en reste
qu’une.

**En cours :** raccorder l’icône à une suppression SQLite transactionnelle avec
contrôle de révision, vider les écritures en attente avant suppression, charger
la scène de remplacement et actualiser le catalogue. Acceptation restante :
suppression active et cascade des lignes, activation/rechargement du remplacement,
conflit de révision et garde de dernière scène.

## 2. Fermer les portes mouvement V2

- **P2-F :** aucun défaut de ghost n’est reproduit dans une scène valide.
  Ne pas modifier la géométrie sans reproduction. Quatre écritures historiques
  ont un corps inaccessible ; qualifier la porte d’absence d’écriture sur une
  nouvelle session valide.
- **P6 :** l’acceptation du geste natif drag/double-clic reste ouverte. Vérifier
  Play, Seek, Stop, resize et invariance du document ; qualifier aussi l’écart
  restant entre le coin contenu et le Selection Frame. **Point central en
  lecture corrigé :** l’overlay suspendu masquait sa racine mais laissait visible
  son contrôle central sibling ; le rendu applique maintenant la même suspension
  à ce contrôle. Le test overlay vérifie le masquage et la reprise ; Safari dans
  l’application confirme Play/Pause sans écriture SQLite. Les autres critères
  P6 restent ouverts.

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

**Corrigé et accepté — clic sur un item :** `scene-selection` résout l’item sous
le pointeur pendant la capture, mais laisse ensuite le même `pointerdown`
atteindre le fond de grille visible ; le trace de zone crée alors une emprise
1×1 au `pointerup`, qui est un vrai commit et active Undo. Le correctif est dans
l’arbitrage Editor : quand le hit-test sélectionne un item, consommer ce
`pointerdown`. Les gestes sur le fond vide gardent le circuit de tracé V2.
`tests/scene-selection.spec.ts` couvre les deux gestes et le commit Undo du
tracé ; Safari dans l’application réelle confirme la sélection, les zones
inchangées, l’absence de PUT et Undo désactivé le 1 novembre 2026. La validation
de ce conflit de clic est close ; les autres gestes natifs restent ouverts.

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
