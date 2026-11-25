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

Les décisions et acceptations des zones, blocs et capsules sont dans le
[plan Capsules et zones](./2026-11-25-capsules-zones-plan.md). Reste ici :

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

**Défaut d’échelle sur les trajectoires — Résolu dans le cœur (2026-11-25) :** la
rotation déformait l’échelle pendant un `move`, parce que CodPlay interpolait la
matrice des poses de borne coefficient par coefficient. La correction a été faite
dans `codplay` (autorisée par l’utilisateur), à la place de la correction Editor
qui était prévue ici : la pose est décomposée en rotation, échelles et cisaillement,
interpolés séparément ([spec CodPlay, « Interpolation de la pose »](../../codplay/specs/motion-frame-v2-spec.md)).
Preuve Safari MCP : l’item `Tangente` garde une échelle de 1 après le glisser de son
KF médian ([plan de revue, E16](./2026-11-24-revue-interface-items-plan.md)).

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

Déplacé dans le [plan Capsules et zones](./2026-11-25-capsules-zones-plan.md).

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
