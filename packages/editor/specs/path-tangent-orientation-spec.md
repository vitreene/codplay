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
- Le CS et l’item suivent la même pose de `PresentationFrame` ; le bridge ne
  reconstruit pas le chemin. Quand Play se termine exactement à la durée d’une
  scène portant un `path`, le handoff Editor seek à `durée − 2 ms`, puis
  re-présente la durée exacte avant de réafficher le CS. Le temps intermédiaire
  distinct force le runtime à remplacer la dernière pose live du chemin par la
  pose terminale.
- Stop présente la frame auteur 0. Si le transport est déjà arrêté à cette
  frame, un Stop répété ne renvoie pas de seek identique ; la pose tangente
  présentée de l’item et celle du CS restent inchangées. Si la lecture est en
  cours ou si le transport est ailleurs, Stop conserve son seek vers 0.
- L’option suit les commandes existantes de décor : copy-on-write, Undo/Redo et
  sauvegarde SQLite.

### Projection géométrique partagée dans l’éditeur

- L’éditeur résout une `MotionGeometryPose` par pose d’endpoint, à partir du
  cadre de contenu, des insets de bordure et de la transformation affine. Cette
  projection contient le cadre de contenu du CS, le cadre extérieur bordé et le
  centre transformé de cette bordure, qui sert d’ancre au chemin.
- Le bridge publie ensemble la pose sélectionnée, les segments et les ghosts
  dans le store de géométrie. Le CS et l’overlay s’abonnent à cette projection :
  le chemin utilise les ancres, les ghosts et la surface de déplacement utilisent
  les cadres bordés, et le CS garde le cadre de contenu. Aucun consommateur ne
  déduit son propre centre ou ne retombe sur un cadre sans bordure.
- Pour un KF sélectionné à son temps, la pose présentée par le player fournit la
  géométrie d’endpoint partagée. Cette projection reste stable quand le playhead
  cherche à l’intérieur du segment ; les ancres de route ne sont pas reconstruites
  depuis la pose interpolée courante.
- La projection est éphémère et n’ajoute aucun champ au document. Elle est
  recalculée lorsque la scène ou la largeur de référence change.
- Lorsqu’un KF `pose` est inséré sur un chemin, l’éditeur reprend le point résolu
  sur ce chemin et découpe la courbe en deux arcs. Dans la précision de
  préparation ACE, la trajectoire et les tangentes aux extrémités restent celles
  de l’arc initial et la tangente entrante/sortante au KF reste continue. La
  rotation auteur du KF est l’offset de fin du segment entrant et de départ du
  segment sortant, pour que le player n’introduise pas de saut d’angle au KF.
  Un KF déplacé hors du chemin conserve le raccord géométrique par tangente
  utilisé pour cette édition.

Le contrat de calcul et de transport runtime est décrit par les
[spécifications CodPlay `move`](../../codplay/specs/move-v2-spec.md) et
[motion](../../codplay/specs/motion-frame-v2-spec.md).

## Preuves

- [`motion-editor/overlay.spec.ts`](../tests/motion-editor/overlay.spec.ts)
  vérifie le bouton icône accessible, son état et sa disponibilité uniquement
  sur un chemin actif explicite, ainsi que l’usage de la même géométrie bordée
  par le chemin, les ghosts et la surface de déplacement.
- [`motion-editor/geometry.spec.ts`](../tests/motion-editor/geometry.spec.ts)
  vérifie le centre de bordure transformé, y compris avec insets asymétriques,
  et sa conservation lors d’un changement d’orientation. Elle vérifie aussi la
  trajectoire et les tangentes lors du découpage d’un arc sur un point qui lui
  appartient.
- [`browser/tangent-editing-fixture.ts`](../tests/browser/tangent-editing-fixture.ts)
  insère un KF tourné au playhead par le geste réel de l’aiguille, puis contrôle
  la pose item/CS, les deux segments enregistrés et l’angle juste avant et au KF.
- [`decor-editor-bridge-integration-v2.spec.ts`](../tests/decor-editor-bridge-integration-v2.spec.ts)
  vérifie le stockage sur le KF cible, Undo/Redo et la rotation du CS depuis
  l’angle de la pose présentée.
- [`builder-v2/motion-path.spec.ts`](../tests/builder-v2/motion-path.spec.ts)
  vérifie le transport des rotations source/cible, le Seek, la stabilité après
  détour et la lecture réelle du player.
- [`scene-player-bridge-v2.spec.ts`](../tests/scene-player-bridge-v2.spec.ts)
  vérifie qu’une fin naturelle exactement à la durée enchaîne pause, Seek à
  `durée − 2 ms`, puis Seek terminal avant la réconciliation et le retour du CS ;
  les rotations de l’item et du CS correspondent à la pose terminale présentée.
  Le même test vérifie que deux Stops depuis la fin n’envoient qu’un seek vers
  0 et conservent l’item et le CS sur leur pose tangente initiale.
- [`motion-graph.spec.ts`](../../codplay/tests/runtime/motion/motion-graph.spec.ts)
  vérifie l’orientation d’un enfant réparenté entre deux parents transformés.

Le 29 octobre 2026, Safari Technology Preview a joué la scène SQLite de 0 à 5 s
avec un chemin courbe et l’option active. La matrice est passée de `80,04°` au
départ à `33,03°` à 2,5 s puis `344,52°` au terme. Un Seek à 2,5 s a produit
`32,48°`, soit un écart de `0,55°` avec Play. Stop a restauré la frame 0 ; le
rechargement a conservé le chemin et l’option. Un resize à `1100 × 700` a gardé
la tête à 2,5 s et la pose à `32,45°`; le viewport a ensuite été restauré à
`1328 × 775`. La console Safari n’a signalé ni avertissement ni erreur pendant
le scénario. Le 29 octobre, après rechargement de la scène SQLite, le bouton
icône seul était visible au milieu du path ; à `2,5 s`, l’item et le CS
affichaient tous deux `32,481°`. À `4,2 s`, après Play puis pause, ils
affichaient également `-8,894°`. À la fin naturelle à `5 s`, l’élément
conservait sa dernière pose live à `46°` alors que le CS affichait la frame
terminale à `-15,483°`. Un Seek de `4,2 s` vers `5 s` réappliquait cette frame.
Le Seek répété à `5 s` ne la réappliquait pas ; le handoff Editor présente
maintenant `4,998 s`, puis `5 s`, avant de réconcilier le temps et de réafficher
le CS. Après Play réel de `0` à `5 s` dans Safari MCP, l’item et le CS affichaient
la même pose terminale. Le Seek de `4,2 s` vers `5 s` et Stop de `5 s` à `0` ont
également été vérifiés. Le modèle SQLite a conservé ses deux KF à `0` et `5 s`.
Un double Stop sur cette scène restaurée reproduisait ensuite un nouvel écart :
le premier clic ramenait l’item et le CS à `81,041586°`, le second laissait
l’item à `rotate(0deg)` et le CS à `81,041586°`. `onStopClick()` renvoyait un
seek vers 0 même lorsque le transport était déjà arrêté à 0. Il vérifie
maintenant le temps et l’état du transport avant ce repli : le second Stop
n’émet plus de seek, tandis qu’un Stop pendant Play conserve le reset. Le test
d’intégration couvre ces deux Stops. Après Play de `0` à `5 s`, Safari MCP a
confirmé que le premier Stop et le second gardent l’item sur
`81,041586°`, aligné au CS ; Stop pendant Play ramène également les deux à 0.
SQLite conserve les KF auteur à `0` et `5 s`, Annuler/Rétablir restent inactifs,
et la console ne relève pas d’erreur ni d’avertissement.

Le 30 octobre 2026, après rechargement de la scène SQLite, Safari Technology
Preview a confirmé qu’au KF cible la fin de la courbe coïncide avec le centre de
la bordure transformée de l’item et du CS (`575,566 × 272,893 px`). La bordure
mesurait `20,5 px` par côté. Le ghost cible et la surface de déplacement
occupaient le même cadre extérieur. Après un Seek à `2,2 s`, l’ancre finale de
la courbe est restée identique tandis que le CS suivait la pose présentée. La
console n’a signalé ni erreur ni avertissement.

Le 30 octobre 2026, Safari a inséré par l’aiguille un KF tourné de `20°` à `3 s`
sur un arc entre `0` et `5 s`. La courbe a été découpée en deux segments, avec
un écart de tangente de `0,114°` au raccord. L’angle player de `2,999 s` à `3 s`
a varié de `0,114°` ; l’erreur de coïncidence entre item et CS était de `0,52 px`.
