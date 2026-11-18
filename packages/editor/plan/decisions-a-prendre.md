# Editor — décisions et acceptations ouvertes

Mémoire de travail unique. Les contrats vérifiés sont dans les specs Editor ;
ce document ne répète que les décisions ou portes qui restent ouvertes.

**Décision acceptée — dépôt dans l’espace avant la première piste :** déposer un
item dans la zone vide de `.seq-labels` située au-dessus de la première ligne
d’item le place avant le premier frère racine. Le geste réutilise
`resolveTrackDrop` → `TRACK.MOVE` → `attachItem` ; il ne crée pas un circuit de
réorganisation séparé. Les tests de `tree-reorder.spec.ts` couvrent le drop
sur l’espace vide et les ancres de tête ; Safari MCP confirme le nouvel ordre,
le rendu et la sauvegarde SQLite.

**En cours :** raccorder l’espace de tête à la commande existante, vérifier le
rebuild visuel et sauvegarder/recharger l’ordre dans l’unique onglet Safari.

## 1. Terminer l’intégration des zones et blocs

**Décision acceptée — surface de scène indépendante du placement :** le cadre
de scène est défini par le document et garde le même périmètre quel que soit le
choix `Libre` ou `Grille`. Pendant l’élaboration, ce cadre garde un ratio 16:9 ;
le choix ne règle que le placement racine. L’interface future de configuration
du document proposera le réglage de ce ratio par scène.

**À faire dans la configuration future du document :** ajouter le réglage
persistant du ratio de scène, l’appliquer au cadre, puis retirer la constante
temporaire 16:9 de `scene-player-bridge.ts`. Le test d’intégration actuel vérifie
que `Libre` et `Grille` gardent ce cadre 16:9 sans changer leurs grilles de
placement respectives.

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

## 6. Simplifier l’interface de l’application Editor

**Décision acceptée :** garder le layout courant, en faisant occuper à la scène
sa taille maximale selon son ratio avant d’allouer le reliquat vertical à
l’éditeur de pistes. Un séparateur horizontal permet à l’utilisateur de régler
la hauteur de cette zone ; la valeur est mémorisée comme préférence locale
Editor, hors document et hors Undo/Redo. Les outils Undo/Redo et les commandes de
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

### Editor vers le player — synchronisation décor/projection et rotation

**Décision ouverte — emplacement du mode global :** le proposer dans le décor
initial. Préciser si ce déplacement concerne le contrôle seul ou aussi le
stockage, actuellement porté par l’item ; ne pas réintroduire d’option par KF.

Le mode unique tangente/manuelle, le reset des angles et l’orientation
initiale constante sont décrits dans la
[spec d’orientation](../specs/path-tangent-orientation-spec.md). Leur acceptation
utilise une scène neuve à trois items, conformément au choix utilisateur de
remplacer les anciens documents de test ; aucune compatibilité des anciennes
options segment-locales n’est promise.

**Décision acceptée — continuité de l’orientation tangentielle :** conserver
intacts les chemins auteurs, y compris leur cassure aux KFs. Au début de chaque
segment tangent après le premier, compenser l’offset `rotateOffset.from` pour
que l’orientation égale celle de la fin du segment précédent ; interpoler cet
offset jusqu’au décalage initial constant à la fin du segment, avec la
progression eased déjà portée par `move`. La position reste pilotée par le
chemin courant. Sur le premier segment, préparer la référence d’affichage de la
première pose avec la tangente au départ du chemin et le décalage initial ;
l’offset auteur reste inchangé aux deux bornes de `rotateOffset`. Cette
préparation évite un pivot visible avant le mouvement sans modifier les valeurs
logiques de rotation. La correction reste dans le Builder Editor et réutilise
l’interpolation existante de `rotateOffset` ; aucun changement CodPlay partagé
ni nouveau lecteur temporel.

**En cours — saut de rotation tangentielle :** Safari MCP reproduit un pivot
initial sur `Manuel` : la pose présente l’offset auteur `0°`, puis atteint la
tangente initiale d’environ `173,76°` au départ du premier segment. La
référence de présentation de la pose initiale doit donc être préparée depuis
cette tangente, sans remplacer l’offset logique. Safari MCP reproduit aussi le
saut sur `Manuel`, en mode tangente, au KF de `2,5 s` : `+68,57°` à `2,45 s`,
puis `−135,66°` vers `2,49 s`. Les tangentes des deux arcs au raccord valent
`+68,72°` et `−135,69°`, soit un virage de `155,6°`. `build-scene.ts` applique
maintenant l’offset de raccord calculé par `item-rotation/tangent-reference.ts`
pour les poses libres dont la projection géométrique est résolue ; l’offset
rejoint le décalage initial à la fin du segment. La régression garde deux
segments droits formant un virage de plus de `150°`, vérifie le move compilé,
le chemin auteur et les seeks autour du KF. Ajouter la preuve du premier segment
sur pose initiale, Play et Seek, et vérifier que les items frères ne sautent
pas. Les tests ciblés (16 cas), le typecheck et le build Editor passent pour le
raccord au KF ; la preuve de rendu reste en attente.

**À valider :** Play/Seek/replay et orientation visible autour de KF1 dans Safari
MCP, puis consolider la spec. Malgré l’activation de Safari Technology Preview
et la sélection MCP de l’onglet Editor, le serveur le signale inactif,
`document.visibilityState` vaut `hidden`, `document.hasFocus()` vaut `false` et
la capture est noire. Garder la correction `En cours` jusqu’à une preuve de
rendu visible. Les transitions dont la géométrie dépend d’une zone ou n’a pas
de projection résolue ne reçoivent pas encore cette correction.

**Défaut d’échelle sur les trajectoires — En cours :** la rotation déforme
l’échelle pendant un `move`, en mode manuel comme en mode tangente. Sur la scène
Editor active, Safari MCP reproduit le défaut en mode manuel : pour le segment
0–2 500 ms de l’item `Manuel`, les angles auteur passent de `15°` à `97°` et le
scale de `1` à `0,793353`. Au milieu, l’échelle rendue est `0,680117`, alors que
l’interpolation auteur attendue est `0,896677`. Un item sans scale auteur,
rotaté de `0°` à `35°`, atteint `0,953717` au milieu au lieu de `1`. L’item
`Tangente`, qui garde le même angle manuel sur son premier segment, reste à
`1` : ce cas ne suffisait donc pas à couvrir la régression.

La capture du `move` interpole les coefficients de la matrice affine complète.
L’extraction de son scale dépend alors des angles source et cible ; une
rotation peut ainsi créer ou réduire l’échelle rendue. L’interpolation d’un
scale auteur doit rester indépendante de cette rotation.

**Décision de correction acceptée :** la rotation ne change jamais le scale.
Sans variation de scale auteur, le scale présenté reste constant ; lorsque
l’auteur le fait varier, seul cet écart est interpolé. Cette règle s’applique
aux deux modes de rotation. Le périmètre reste Editor : étendre la projection
du composant item existant afin que la capture de trajectoire ne mélange pas
rotation et scale, tout en restituant les transformations auteur via cette même
présentation. Garder le `move`, le chemin, les keyframes et l’horloge existants ;
ne pas créer de lecteur temporel ni compenser le scale avec une valeur calculée.
Les angles manuels restent interpolés ; en tangente, le runtime conserve la
tangente et le décalage initial. Les poses et ancres de chemin, insets, pivot,
preview, CS/ghosts, resize, capsule et parent restent invariants. Ne pas toucher
aux paquets partagés.

**Actions :** ajouter une régression indépendante du mode pour rotation seule
et rotation avec scale auteur ; modifier le Builder et le présentateur item
Editor propriétaire pour isoler les transformations de la capture affine,
avec scale identité `1` aux sources où l’auteur n’en a pas défini ; vérifier le
CS/ghost, les trajectoires courbes et droites, rotation initiale, insertion,
Play/Seek/replay, Undo/Redo, resize, capsule, parent/pivot/insets et persistance.
Typecheck, tests, build et MCP Safari sur la scène Editor sont requis. Consolider
la spec uniquement après cette preuve.

**Capture de l’échelle au waypoint :** le bridge Decor utilise l’échelle du
snapshot logique, avec la cascade auteur comme repli. Les gestes du CS sur pose
libre gardent leur patch sans échelle issue de la matrice affichée. Le test
d’intégration vérifie la promotion d’un KF décor avec un scale auteur
interpolé différent de celui du CS. Dans « Rotation — scène neuve », le KF de
« Manuel » à 2,5 s portait un scale de 0,793353 issu de l’ancienne capture.
Ce champ a été retiré de ce KF via l’API versionnée. Safari MCP vérifie Play,
Seek à 2,5 s et replay après rechargement SQLite, avec une taille de police
constante à 14,36 px et une échelle à 1 à la précision de projection.

**Preview Selection Frame par valeurs modifiées — En cours.**

**Décision acceptée :** le bridge transporte seulement les propriétés auteur
modifiées. La présentation combine toutes les contributions actives dans une
matrice affine complète ; item, CS et overlay suivent cette composition.
Translation, dimensions, rotation, échelles, pivot, transform CSS et éventuel
cisaillement restent dans le même circuit. Le skew futur entrera comme
contribution matricielle. Les propriétés peuvent être éditées par des
interfaces distinctes ; leur projection complète est réunie dans le même
cycle de preview/commit. Aucun changement du cœur `packages/codplay`.

**Cause établie :** l’ancre privée conserve la matrice CSS complète, mais sa
projection ne conserve pas la fraction `transform-origin` utilisée pour cette
matrice. Le bridge peut donc afficher la géométrie avec la bonne matrice tout
en plaçant l’axe du CS au centre par défaut. Safari MCP reproduit cet écart sur
« Départ décalé » : l’item tourne autour de son axe CSS bas-gauche, tandis que
le point du CS reste au centre. Les helpers `motion-editor/geometry.ts` et
`content-box.ts` calculent aussi centre visuel, axe et insets depuis `rotate` et
`scaleX/Y` seulement ; ils ne propagent pas une matrice générale jusque dans le
chemin et les ghosts. Au KF1 de « Manuel », resize pendant `pointermove`
conserve la rotation et l’alignement du contour à moins de `0,11 px` ;
`pointercancel` restaure exactement la pose.

**Actions :** faire porter à la projection CSS existante la matrice affine et
son `transform-origin` normalisé ; le bridge réutilise ces deux valeurs pour
produire ensemble l’item, le CS et l’overlay. Étendre les calculs existants de
`content-box.ts` et `geometry.ts` à la même matrice pour centre, inset, axe du
trajet et ghosts. Garder les patches auteur clairsemés. Couvrir rotation,
resize, move et pivot avec matrice générale, axe décentré et cisaillement ;
annulation et commit. Mettre à jour les specs `item-presentation`, motion
Editor et Selection Frame V2 après vérification.

**Preuve actuelle :** 70 tests ciblés Editor, 10 tests Selection Frame,
typecheck Editor et build Editor passent. Safari MCP a vérifié le focus réel,
la rotation et le resize pendant `pointermove`, puis `pointercancel` sans
commit. Le défaut d’axe ci-dessus est reproduit et reste à corriger.

**Acceptation restante :** tests ciblés avec l’origine issue du transform CSS,
non-régression parent/enfant et reparent, Play/Seek/replay, resize,
persistance, cycle de vie, typecheck, tests et build. Rejouer rotation et resize
dans Safari MCP sur la scène Editor et constater l’alignement axe/item/CS
pendant `pointermove`. Les gestes MCP synthétiques ne couvrent pas la capture
native du pointeur.

**Décision acceptée — axe du trajet et ghosts :** l’ancre d’un segment et
le point de référence du ghost doivent être le point d’axe
`transform-origin` de l’item, y compris quand il est décentré. Remplacer
l’ancre centrale du cadre bordé définie par la spec de projection. Garder la
projection propriétaire `resolveMotionGeometryPose`, afin que le chemin, les
ghosts et la pose sélectionnée utilisent les mêmes coordonnées. Valider la
continuité visuelle au pivot centré et aux quatre coins, ainsi qu’en lecture
avec plusieurs items pour contrôler qu’aucun autre item ne saute.

**Acceptation axe et ghosts — En cours :** la projection item fait suivre
l’axe au cadre de mouvement existant. Sur « Départ décalé », Safari MCP
confirme le raccord à 0,02 px après Seek au KF final, le suivi du chemin en
lecture et en relance, ainsi que le déplacement du ghost et du tracé vers les
quatre coins pendant des gestes annulés. Vérifier la lecture dans une scène à
plusieurs items visibles et la capture native du pointeur pour clore la validation.

**Preuve indépendante en attente :** aucun geste scale autonome n’existe dans
le Selection Frame V2. Vérifier la préservation et la composition des scales
déjà présents pendant les autres gestes ; ne pas présenter une mesure visuelle
directe d’un geste scale comme acquise.

**Acceptation indépendante restante :** les six échecs de la suite Editor sur
les zones, les valeurs de décor et les attentes d’offset vide sont aussi
reproduits sur `HEAD` avant ce fix. Cette tranche ne les résout pas.

Le renforcement général du couplage décor/projection reste **A relire**, hors
de cette tranche. L’[analyse](./notes/2026-10-29-editor-path-playback-analysis.md)
conserve son raisonnement. Les invariants restent le circuit documentaire
unique, les unités cqw, la rotation affichée au degré entier, l’alignement du
CS et de l’item, les chemins/ghosts et les capsules tournées ou imbriquées.

**Décision acceptée — déplacement d’une borne de capsule :** le drag d’un
losange de borne déplace uniquement le KF ciblé ; il conserve l’autre borne et
ne crée pas de KF supplémentaire. Le tracé d’une plage reste réservé au fond
de ligne de capsule, hors des poignées de KF.

**En cours — validation dans Editor :** le routage protège les poignées de KF
du tracé de plage ; le test DOM et le test machine vérifient le KF ciblé et
l’unique commande de déplacement. Il reste à accepter le drag natif dans
l’application Editor sur une capsule de test. Contrat et preuves automatisées :
[intégration V2](../specs/editor-v2-integration-spec.md#interaction-des-bornes-de-capsule).

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
- **Tangente :** le bouton passe maintenant au-dessus du Selection Frame (`1161`
  contre `1160`) et l’icône active a un orange plus marqué ; valider son ciblage
  et son contraste dans l’application avant d’actualiser la preuve de la spec
  d’orientation.
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

**Évolution différée — édition directe du texte :** cadrer séparément l’édition
dans le bloc. Le survol est couvert par la spécification d’intégration.

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
