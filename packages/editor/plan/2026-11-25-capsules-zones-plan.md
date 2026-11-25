# Capsules et zones — plan

Statut : **En cours**. Regroupe tout ce qui concerne une capsule et ses zones (la
capsule est l’expression de ses zones) : décisions reprises du
[mémo Editor](./decisions-a-prendre.md) (§1 et §4) et du
[plan de revue](./2026-11-24-revue-interface-items-plan.md) (D-E2), actions capsule du
[plan des bornes](./2026-11-25-bornes-intro-outro-plan.md) (ex-action 3b), et la
recette complète capsule + zones. Contrats vérifiés : [intégration V2](../specs/editor-v2-integration-spec.md),
[blocs](../specs/block-creation-spec.md), [distribution des capsules](../../authoring/capsule-automation/specs/capsule-distribution-spec.md),
[Capsule Automation](../../authoring/capsule-automation/specs/capsule-automation-spec.md).

## Actions (dans l’ordre)

1. **Recette complète capsule + zones.** À concevoir avec l’utilisateur : la liste des
   parcours et leurs critères. Elle clôt les acceptations « En cours » ci-dessous
   (CapsuleDef, création de capsule, tracé de bloc, outils Zone/Bloc, drop sur zone,
   décalage relatif, borne de capsule) : création et configuration (type, grille,
   gouttières, zones), dépôt d’un item, réassignation de zone au KF exact et entre
   deux KF, décalage, capsules imbriquées, distribution et bornes (fenêtre B-11,
   fusion B-7, bornes liées), Play/Seek, Undo/Redo, rechargement SQLite. Safari MCP
   sur une copie de scène, puis revue manuelle.
2. **Entrée dans une capsule et sortie (B-8, B-9 du plan des bornes).** Commande
   `attachItem` (et création dans une capsule) : bornes verrouillées converties en
   bornes liées ; placement spatial dans la zone par défaut ; sortie vers un
   placement libre : bornes liées figées puis verrouillées. KF intermédiaires recalés
   à proportion de la nouvelle fenêtre, sauf ceux rattachés à un marqueur. Builder :
   un KF hors de la fenêtre de son item est ignoré (indisponible) ; timeline :
   signalé (`seq-kf--out-of-bounds`). Tout lecteur prend l’instant d’une borne dans
   la résolution (B-15).
3. **Bornes parentes de la timeline.** `findParentClipBounds` et
   `getParentClipMarkers` (`sequence-editor/utils.ts`) lisent les KF de la capsule
   parente, pas sa fenêtre résolue (B-11) ; une capsule sans KF borne ses enfants à
   `[0, durée]`. Les brancher sur `resolveSceneBounds` (bridage du glisser,
   matérialisation, diamant « hors bornes »).
4. **D-E2 — placement automatique ou explicite dans une capsule** (repris du plan de
   revue). `Decor.zoneId` est une référence d’usage : l’item utilise une zone de son
   parent. Changer de parent libère les références aux zones de l’ancien parent.
   Après un déplacement dans la timeline, l’item suit le placement logique de la
   capsule ; une attribution faite par l’auteur le sort du placement automatique.
   Représentation retenue pour commencer : `zoneId` absent = placement automatique
   par Capsule Automation ; `zoneId` présent = attribution explicite ; la pleine
   surface reste le comportement `card` (zone fantôme). Le repli de `setCapsuleDef`
   cesse d’écrire des `zoneId`. Acceptée ; à réviser à l’usage.
5. **Points à décider** (décrits par l’ancienne spec de distribution, jamais
   implémentés ; pas un contrat) : bridage du glisser de l’outro d’une capsule à
   `minDurationMs` (déjà rendu par la résolution) ; `KEYFRAME.CLEAR_CAPSULE`
   (événement présent, effet à vérifier) ; snap 2D sensible à la ligne, avec les
   bornes virtuelles dans la grille de snap.
6. **Modèle ZoneDef** (§ ci-dessous) : **A relire** avant code.

## Zones, blocs et capsules — décisions et acceptations (reprises du mémo)

**Décision acceptée.** La capsule porte sa grille. La grille racine fine
(`90 × 160`) rend le placement responsive et proche du libre. Une zone est une
entité distincte d’un bloc ; sa géométrie est une aire CSS Grid (`row`, `col`,
`rowSpan`, `colSpan`). L’éditeur Zone déclare et modifie ces zones sans les
confondre avec les blocs. Un item placé dans une zone déjà existante référence
son `Zone.id` par `Decor.zoneId` ; l’emprise de la zone devient sa base de
position et de taille. Le mode spécial de décalage relatif à la zone est distinct.

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

**Décision acceptée — retour du parcours de création :** l’entrée en tracé doit
donner un curseur en croix ; la création, la sélection du nouvel item et la
sortie du mode de tracé passent par `EditorActionsFacade`. Le rendu Decor du
nouvel item doit correspondre au fond présenté dans la scène.

**En cours — raccord du tracé et de Décor :** le curseur en croix apparaît sur
la surface active ; `EditorMenuRegion` ouvre le geste, `EditorActionsFacade`
regroupe la transaction, la sélection et la fin du geste. Les tests du tracé
vérifient le fond transparent initial et la valeur native après commit/seek.
Safari confirme le curseur en croix et la synchronisation du panneau Décor avec
l’item sélectionné dans la timeline, y compris l’affichage en damier d’un fond
absent. Il reste à accepter visuellement le tracé complet et la sélection du
nouveau bloc après commit.

**Décision acceptée — création sur la grille racine fine :** en mode racine
`fine-grid`, l’auteur trace directement le bloc sur les pistes ; ses limites
s’accrochent aux cellules et déterminent `row`, `col`, `rowSpan` et `colSpan`.
La transaction crée la zone racine correspondant à cette aire puis le bloc qui
la référence par `Decor.zoneId`. Aucune sélection de zone préalable n’est
requise. Le même chemin de tracé accepte le mode `transform` avec une géométrie
libre en `cqw`.

**En cours — validation du flux de création :** `EditorMenuRegion` ouvre le
tracé, le Selection Frame choisit l’accrochage selon le mode racine, et
`EditorActionsFacade` committe la zone et le bloc ensemble puis sélectionne le
bloc et ferme le mode. `block-creation-v2.spec.ts` couvre les deux modes,
l’emprise, le décor, Undo et Redo ; l’acceptation visuelle dans l’application
Editor reste à faire.

**En cours — CapsuleDef :** l’onglet Capsule, les commandes centralisées, la
surface de zones imbriquées et la projection des gouttières sont raccordés ;
build et typecheck passent. Le parcours navigateur, Undo/Redo et la restauration
SQLite restent à accepter avant de déplacer le comportement vérifié dans une
spec.

**Décision acceptée — création d’une capsule dans l’interface :** le bouton
ouvre le tracé sur la scène via le flux de création Selection Frame existant.
En mode `fine-grid`, la transaction crée la zone racine et la capsule qui la
référence ; en mode `transform`, elle passe le rectangle converti en `cqw`.
La capsule reprend le type et la distribution de `rootCapsule`, sans recopier
sa grille racine ; Capsule Automation fournit les dimensions initiales de la
grille selon le type. La création sélectionne la capsule. Déposer au centre de
sa ligne un item existant le rattache comme enfant via `TRACK.MOVE` →
`attachItem`.

**En cours :** le bouton et le tracé réutilisent le flux Selection Frame et la
façade centrale ; `createCapsule` transmet maintenant `zoneId` au décor initial.
Les tests couvrent les modes `transform` et `fine-grid`, la sélection,
Undo/Redo et le dépôt enfant vers `attachItem` ; le build Editor passe. Il reste
à valider visuellement le tracé, le dépôt enfant et la restauration SQLite dans
Safari. Après rechargement, l’onglet MCP expose le nouveau bouton mais
`document.visibilityState` vaut `hidden` et `document.hasFocus()` `false` ; la
capture Safari est noire. Aucune action sur le document n’a été faite dans cet
état.

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

## Borne de capsule (reprise du mémo)

**Décision acceptée — déplacement d’une borne de capsule :** le drag d’un
losange de borne déplace uniquement le KF ciblé ; il conserve l’autre borne et
ne crée pas de KF supplémentaire. Le tracé d’une plage reste réservé au fond
de ligne de capsule, hors des poignées de KF.

**En cours — validation dans Editor :** le routage protège les poignées de KF
du tracé de plage ; le test DOM et le test machine vérifient le KF ciblé et
l’unique commande de déplacement. Il reste à accepter le drag natif dans
l’application Editor sur une capsule de test. Contrat et preuves automatisées :
[intégration V2](../specs/editor-v2-integration-spec.md#interaction-des-bornes-de-capsule).

## Modèle ZoneDef (repris du mémo)

**Décision d’usage acceptée :** l’identité persistée est `Zone.id` via
`Decor.zoneId` ; le nom reste un libellé. La capsule est l’unique propriétaire
de la grille et ses zones utilisent des aires de pistes. Le Selection Frame
déclare, sélectionne et cible ces zones.

**À relire avant code :** aligner `ZoneDef`/`ZoneCard` et le Builder Editor sur
ce contrat, en préservant le circuit de placement de Capsule Automation. Le
raccord au panneau zone complet et aux capsules imbriquées reste hors de cette
tranche. Le [plan d’intégration zone-editor](../../authoring/selection-frame/plan/zone-editor-plan.md)
reste la référence hors du périmètre Editor.
