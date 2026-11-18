# Orientation de l’item sur la tangente du chemin

## Contrat

- Le mode `Item.rotationMode` est unique pour toutes les trajectoires d’un
  item : `manual` (défaut si absent) ou `tangent`. Une ancienne propriété
  `Decor.orientToPath` ne décide plus de l’orientation. `Decor.path` reste
  propre au segment entrant du KF cible et ne cascade pas.
- Le bouton icône « Aligner sur la tangente » change le mode de l’item entier.
  Il apparaît sur le segment actif, courbe explicite ou droite implicite ;
  son état est identique quel que soit le segment sélectionné. La commande cible
  l’item de la sélection centrale, indépendamment du cache de segment actif.
  Des clics successifs restent une bascule aux KFs comme aux temps interpolés.
- Entrer en mode tangente efface les rotations `offset.rotate` des décors
  référencés par l’item. Les autres propriétés et les chemins sont conservés.
  Un décor également référencé par un autre item ou la racine est copié avant
  cette modification. Revenir en manuel ne restaure pas les angles effacés.
- En tangente, l’outil de rotation n’est disponible qu’au temps du premier KF
  pose. Le `offset.rotate` de ce KF, ou celui du décor initial s’il est absent,
  définit un décalage constant par rapport à la tangente. Les angles des KFs
  suivants ne participent pas à la résolution de rotation. Le builder transmet
  ce même décalage comme `rotateOffset.from` et `.to` sur chaque `move`, sans
  tween de rotation entre ces angles. Une droite implicite utilise le chemin
  natif `M 0 0 L 1 0` à la compilation, sans écrire ce chemin dans le document.
- Pour des poses libres résolues en coordonnées numériques, le Builder reçoit
  la largeur physique de projection et le ratio de pixels depuis le bridge de
  scène. Après le premier segment, il prépare une référence de capture avec
  la tangente de fin du segment précédent et le décalage initial. La propriété
  technique `--editor-item-motion-reference-angle` appartient uniquement au
  cadre de présentation. Elle rend les références de rotation cohérentes avant
  l’interpolation affine, sans ajouter de scale ni remplacer les échelles
  auteur. L’angle logique reste le décalage initial. Le Builder sans contexte
  de projection, les poses dépendant d’une zone et les dimensions non résolues
  ne reçoivent pas cette préparation ; ces cas ne font pas partie de cette
  garantie d’échelle.
- En manuel, les angles des KFs retrouvent leur interpolation de pose ; les
  chemins continuent de décrire le déplacement sans imposer la tangente.
- La pose de Play et de Seek vient du même résolveur CodPlay. Le centre visuel
  de l’item reste ancré au chemin et la pose alignée est conservée au KF cible
  et après la fin du segment.
- Le CS suit la pose publiée par `PresentationFrame` et les dimensions de
  contenu du snapshot courant. La conversion et la preview de l’unique perso
  appartiennent au composant Editor, conformément à la
  [spécification de présentation](./item-presentation-spec.md). La fin de lecture
  conserve la pose native sans détour temporel par `durée − 2 ms`.
- Stop présente la frame auteur 0. Si le transport est déjà arrêté à cette
  frame, un Stop répété ne renvoie pas de seek identique ; la pose tangente
  présentée de l’item et celle du CS restent inchangées. Si la lecture est en
  cours ou si le transport est ailleurs, Stop conserve son seek vers 0.
- La bascule passe par la commande centrale `setItemRotationMode` ; Undo/Redo
  et SQLite conservent le mode et le reset dans le circuit documentaire existant.

### Projection géométrique partagée dans l’éditeur

- L’éditeur résout une `MotionGeometryPose` par pose d’endpoint, à partir du
  cadre de contenu, des insets de bordure/padding et de la transformation affine. Cette
  projection contient le cadre de contenu du CS, le cadre extérieur bordé et
  le point `transform-origin` transformé de cette boîte, qui sert d’ancre au
  chemin et de référence au ghost. La présentation des poses libres résolues
  place le centre du cadre motion sur ce point, selon la
  [spécification de présentation](./item-presentation-spec.md).
- Le bridge publie ensemble la pose sélectionnée, les segments et les ghosts
  dans le store de géométrie. Le CS et l’overlay s’abonnent à cette projection :
  le chemin utilise les ancres, les ghosts utilisent les cadres bordés, et le CS
  garde le cadre de contenu. Le body du Selection Frame est l’unique surface de
  déplacement et son preview suit `snapshot.set`, y compris aux KFs extrêmes.
  L’overlay ne monte pas de surface de déplacement. En édition, son point de
  contrôle porte `data-editor-overlay` afin que la capture globale de sélection
  laisse sa saisie de trajectoire commencer sans désélectionner l’item. Le point
  de contrôle et le bouton de tangente restent au-dessus du Selection Frame
  pour être ciblables lorsque la pose interpolée recouvre la courbe. En lecture, la
  suspension Editor masque le point central et l’action de tangente ; leur
  affichage reprend à la sortie de `playing`. Aucun consommateur ne déduit son
  propre centre ou ne retombe sur un cadre sans bordure.
- Une part DOM de ghost réutilisée n'est cliquable que si la projection courante
  lui associe un KF. Quand elle quitte cette projection, l'overlay retire aussi
  ses identifiants de KF et de distance ; un identifiant d'un rendu précédent ne
  peut donc pas cibler un décor après remplacement ou rechargement de scène.
- La sélection affichée suit la pose présentée par le player. Les endpoints de
  route sont dérivés des poses auteur et des insets de leurs KFs ; seul un
  geste auteur actif ou son commit en attente peut superposer son candidat à
  l’endpoint visé. Ils ne sont pas mémorisés lors d’une visite par sélection et
  ne sont pas reconstruits depuis la pose interpolée courante. Revenir au même
  temps après avoir visité les KFs conserve donc les mêmes chemins et ghosts.
- La projection est éphémère et n’ajoute aucun champ au document. Elle est
  recalculée lorsque la scène ou la largeur de référence change.
- Le segment actif est dérivé du document courant. Un `sceneLoaded` l’invalide
  puis le reconstruit, même si le document reçu réutilise les mêmes IDs d’item
  et de KF ; aucun path en mémoire de la scène précédente ne pilote la preview.
- Lorsqu’un KF `pose` est inséré sur un chemin, l’éditeur reprend le point résolu
  sur ce chemin et découpe la courbe en deux arcs. Dans la précision de
  préparation ACE, les rayons normalisés quantifiés peuvent empêcher une
  continuité mathématique exacte. Parmi les couples gardant les tangentes
  d’extrémité à moins de `1°`, l’éditeur choisit celui dont l’écart au raccord
  est le plus faible ; si aucun couple ne respecte cette borne, il conserve le
  score précédent. Les tangentes d’extrémité des cas acceptés restent à moins
  de `1°` de l’arc initial et les échantillons du trajet à moins de `1,25`
  unité de projection. En manuel, la rotation auteur du KF appartient aux deux
  segments adjacents. En tangente, l’insertion conserve le décalage initial de
  l’item pour les deux arcs ; elle n’ajoute pas une nouvelle référence d’angle.
  Un KF déplacé hors du chemin conserve le raccord
  géométrique par tangente utilisé pour cette édition.

Le contrat de calcul et de transport runtime est décrit par les
[spécifications CodPlay `move`](../../codplay/specs/move-v2-spec.md) et
[motion](../../codplay/specs/motion-frame-v2-spec.md).

## Preuves et limites

- [`tangent-reference.spec.ts`](../tests/builder-v2/tangent-reference.spec.ts)
  vérifie la référence de raccord, les échelles auteur, le snapshot logique,
  l’exclusion des captures et la libération de la référence pendant la preview.
  Safari MCP vérifie un scale constant à moins de `0,000002` de `1` dans la
  scène Editor à trois items, sur la courbe puis la droite. Les fixtures
  indépendantes vérifient aussi une échelle animée, une capsule tournée et des
  insets asymétriques avec pivot décentré.
- [`commands/item-rotation.spec.ts`](../tests/commands/item-rotation.spec.ts)
  vérifie le reset de toute la chaîne, l’isolation des décors partagés, la
  conservation des chemins et le retour en manuel sans restauration des angles.
- [`builder-v2/motion-path.spec.ts`](../tests/builder-v2/motion-path.spec.ts)
  vérifie le même décalage initial sur une courbe et une droite, l’absence de
  tween de rotation en tangente et l’indépendance d’un second item en manuel.
- [`decor-editor-bridge-integration-v2.spec.ts`](../tests/decor-editor-bridge-integration-v2.spec.ts)
  vérifie la bascule d’item avec Undo/Redo, l’édition de l’angle initial par le
  geste existant et l’absence d’outil de rotation aux autres positions. Les
  clics successifs au temps interpolé vérifient le retour en manuel puis en
  tangente. Safari MCP vérifie ces deux sens à `3 750 ms`, puis aux KFs de
  `0` et `2 500 ms`, avec l’état du bouton, SQLite et Undo/Redo.
- [`motion-editor/overlay.spec.ts`](../tests/motion-editor/overlay.spec.ts)
  vérifie le bouton global, sa disponibilité sur une droite ou une courbe,
  son ciblage au-dessus du CS et la suspension des contrôles pendant Play.
- [`sqlite-editor-scene-persistence.spec.ts`](../tests/app/persistence/sqlite-editor-scene-persistence.spec.ts)
  vérifie le round-trip des modes `manual`, `tangent` et absent.
Le parcours Safari MCP utilise une scène neuve créée par les commandes Editor,
avec trois items, des chemins courbes et droits et un départ décalé à `1,5 s`.
Il vérifie la bascule globale, le reset et l’isolation des autres items, la
rotation initiale tangentielle et la rotation manuelle entre deux KFs, puis
l’insertion d’un waypoint par déplacement. La lecture rAF visible traverse les
segments ; les seeks directs, les retours après détour, Stop/replay, Undo/Redo,
l’annulation et le rechargement SQLite gardent le mode et les angles attendus.
Le resize de `1220 × 867` à `1100 × 780` ne modifie pas le document.

Dans ces cas, la distance du centre au tracé pendant Play reste inférieure à
`0,22 px` CSS. Les gestes de rotation conservent un écart visuel/CS inférieur
à `0,00008°` et un écart de centre inférieur à `0,10 px` après commit. Une
capsule fixe tournée à `30°` vérifie aussi l’orientation initiale de son enfant,
l’absence de rotation parentale recopiée dans l’enfant, Seek et resize, avec
un écart de centre inférieur à `0,08 px`. Les événements de pointeur envoyés
aux handlers réels couvrent preview/commit et annulation ; ils ne certifient
pas la capture matérielle du pointeur.

Les changements de parent pendant un segment ne sont pas produits par cette
bascule : `parentId`, les zones, les instants et les destinations de placement
restent inchangés. Le réglage n’ajoute aucune conversion parent/local ni aucun
régime de présentation. Les cas de reparent animés restent du ressort des
contrats motion partagés ; leur calcul n’est pas modifié par le mode Editor.
