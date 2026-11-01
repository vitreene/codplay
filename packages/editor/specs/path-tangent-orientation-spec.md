# Orientation de l’item sur la tangente du chemin

## Contrat

- L’option d’alignement sur la tangente appartient au segment entrant du KF
  cible. Elle est enregistrée sur son décor, à côté de `path`.
- Le contrôle est un bouton icône sans texte visible, avec le nom accessible
  « Aligner sur la tangente ». L’icône montre une courbe en U et sa tangente
  horizontale fléchée au point de contact, sans axe vertical central. Le bouton
  n’apparaît que pour un segment actif portant un chemin explicite. Un
  déplacement droit et un document sans `orientToPath` conservent le
  comportement antérieur.
- Quand l’option est active, les rotations des décors source et cible sont des
  décalages en degrés par rapport à la tangente avant. Le builder transmet le
  chemin, l’option et les deux décalages dans le `move` V2.
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
- L’option suit les commandes existantes de décor : copy-on-write, Undo/Redo et
  sauvegarde SQLite.

### Projection géométrique partagée dans l’éditeur

- L’éditeur résout une `MotionGeometryPose` par pose d’endpoint, à partir du
  cadre de contenu, des insets de bordure/padding et de la transformation affine. Cette
  projection contient le cadre de contenu du CS, le cadre extérieur bordé et le
  centre transformé de cette bordure, qui sert d’ancre au chemin.
- Le bridge publie ensemble la pose sélectionnée, les segments et les ghosts
  dans le store de géométrie. Le CS et l’overlay s’abonnent à cette projection :
  le chemin utilise les ancres, les ghosts utilisent les cadres bordés, et le CS
  garde le cadre de contenu. Le body du Selection Frame est l’unique surface de
  déplacement et son preview suit `snapshot.set`, y compris aux KFs extrêmes.
  L’overlay ne monte pas de surface de déplacement. Son point de contrôle et
  son bouton de tangente restent au-dessus du Selection Frame pour être ciblables
  lorsque la pose interpolée recouvre la courbe. Aucun consommateur ne déduit
  son propre centre ou ne retombe sur un cadre sans bordure.
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
  unité de projection. La rotation auteur du KF est l’offset de fin du
  segment entrant et de départ du segment sortant, pour que cet offset commun
  ne crée pas un saut d’angle. Un KF déplacé hors du chemin conserve le raccord
  géométrique par tangente utilisé pour cette édition.

Le contrat de calcul et de transport runtime est décrit par les
[spécifications CodPlay `move`](../../codplay/specs/move-v2-spec.md) et
[motion](../../codplay/specs/motion-frame-v2-spec.md).

## Preuves

- [`motion-editor/overlay.spec.ts`](../tests/motion-editor/overlay.spec.ts)
  vérifie le bouton icône accessible, son état et sa disponibilité uniquement
  sur un chemin actif explicite, son niveau de ciblage au-dessus du Selection
  Frame, ainsi que l’usage de la même géométrie bordée par le chemin et les
  ghosts. Le déplacement appartient au Selection Frame, sans surface seconde.
  Le test vérifie aussi que
  les ghosts réutilisables perdent leur adresse de KF lorsqu'ils sortent de la
  projection, puis reçoivent une seule adresse fraîche quand ils y reviennent.
- [`motion-editor/geometry.spec.ts`](../tests/motion-editor/geometry.spec.ts)
  vérifie le centre de bordure transformé, y compris avec insets asymétriques,
  et sa conservation lors d’un changement d’orientation. Elle vérifie aussi la
  trajectoire et les tangentes lors du découpage d’un arc, dont le raccord
  inférieur à `0,11°` sur la route initiale et inférieur à `0,1°` pour une
  insertion au progrès interpolé avec rotation auteur.
- [`browser/tangent-editing-fixture.ts`](../tests/browser/tangent-editing-fixture.ts)
  insère un KF tourné au playhead par le geste réel de l’aiguille, puis contrôle
  la pose item/CS, les deux segments enregistrés et le raccord réel. Le Play
  rAF lit des échantillons de rotation avant et après le KF.
- [`decor-editor-bridge-integration-v2.spec.ts`](../tests/decor-editor-bridge-integration-v2.spec.ts)
  vérifie le stockage sur le KF cible, Undo/Redo et la rotation du CS depuis
  l’angle de la pose présentée. Le test `keeps route endpoints independent of
  previously visited keyframes` vérifie le retour à la même géométrie après
  visite des deux KFs, sans changement documentaire ; il échoue avec le cache
  de l’implémentation précédente. Un autre cas charge deux documents avec les
  mêmes IDs et confirme que le path actif suit le second document.
- [`builder-v2/motion-path.spec.ts`](../tests/builder-v2/motion-path.spec.ts)
  vérifie le transport des rotations source/cible, le Seek, la stabilité après
  détour et la lecture réelle du player.
- [`scene-player-bridge-v2.spec.ts`](../tests/scene-player-bridge-v2.spec.ts)
  vérifie la fin de lecture sans Seek compensateur, le Seek terminal répété et
  les deux Stops. La pose inline motion et le CS restent cohérents.
- [`motion-graph.spec.ts`](../../codplay/tests/runtime/motion/motion-graph.spec.ts)
  vérifie l’orientation d’un enfant réparenté entre deux parents transformés.

Le 30 octobre 2026, Safari MCP à 1328 × 775 a validé les gestes de rotation,
pivot, resize, bordure et déplacement, puis la création d’un KF pose au playhead.
Les écarts item/CS de cette série restent inférieurs à 0,58 px, ceux des ghosts
courants à 0,77 px. La couleur et la promotion d’un KF décor en pose passent
également. Undo/Redo, rechargement JSON et Stop répété gardent l’alignement.
Le contenu de la fixture garde `width/height: 20/12 cqw` sans tween de
dimensions ; l’épaisseur de bordure, déclarée en `cqw`, varie et la rotation
tangentielle change l’encombrement visuel. Après le choix amélioré des rayons,
Safari mesure un raccord de `0,1074°` dans la scène initiale et de `0,0681°`
après insertion d’un KF tourné à 20°, respectivement sous `0,11°` et `0,1°` aux
viewports 1328 × 775, 1100 × 780 et 1024 × 775. Le Play rAF naturel traverse le
KF dans les trois viewports avec la page visible. Après alignement
de l’arrondi des bordures avec le CSS natif, les gestes et ghosts passent dans
les trois viewports avec des écarts inférieurs à 0,59 px. Le parcours Play rAF
du raccord tangent est validé ; les autres gates de transport restent suivies
au [mémo de décisions Editor](../plan/decisions-a-prendre.md). Après le nettoyage de l’identité DOM des
ghosts réutilisés, les parcours navigateur `editing` (17 contrôles) et `decor`
(4 contrôles) passent sans adresse de KF obsolète ; l’erreur item/CS maximale
mesurée dans ces deux parcours est de 0,584 px.

Le 31 octobre 2026, Safari a aussi rechargé un document après promotion d’un KF
décor en pose, puis répété la promotion avec les mêmes IDs. Le path reconstruit
depuis le document chargé garde la preview et le commit à moins de 0,02 unité
CSS d’écart.
La fixture vérifie aussi chaque ghost des trois KFs pose à son propre temps ;
l’écart ghost/player maximal mesuré reste inférieur à 0,21 unité CSS.

Le 31 octobre 2026, le déplacement depuis le body du Selection Frame a été
vérifié au premier et au dernier KF avec les `PointerEvent` envoyés aux handlers
de production dans Safari. À chaque preview, l’item et le cadre restent alignés à moins de
0,006 unité CSS ; le commit garde quatre KFs. À 1,5 s, le contrôle de courbe et
le bouton de tangente restent les cibles DOM au-dessus du cadre. Le déplacement
et l’édition de courbe passent par leurs propriétaires respectifs.
