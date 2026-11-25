# Présentation des items Editor

## Identité et propriétaires

Le builder V2 produit un perso par item. Un chemin conserve le type natif
`tag`, `img` ou `media`, le parent et l’identité de cet item. Les capsules
conservent leur composant `list` et leur circuit de placement.

L’owner créé par `scene-player-bridge.ts` utilise `EDITOR_ENGINE_OPTIONS`.
Ses adaptations de composants délèguent le contenu, les images et les médias
aux classes natives et conservent leurs validateurs et modules. La surface
`media` publiée est celle du composant média natif. Les autres owners CodPlay
conservent leur catalogue.

Un composant item possède un cadre motion, une ancre privée et la racine du
composant natif. Ces parts appartiennent au même perso et au même état.
Les classes de placement restent sur le cadre ; les classes auteur restent
sur la représentation native. Les identifiants de cadre sont propres à chaque
instance, y compris pendant un rebuild avec deux scènes simultanément montées
ou entre deux chargements indépendants du module. Leur UUID ne dépend pas
d’un compteur de module ; les règles privées d’une occurrence ne ciblent pas
les cadres d’une autre occurrence.
Le champ technique `editorFrameClassName` est exclu de la capture Decor auteur.

## Géométrie

Les longueurs auteur, les contrôles de palette et les données sauvegardées
restent en cqw. Le document et le snapshot logique conservent les coordonnées
et dimensions du contenu ; les mesures physiques restent dans la projection DOM. Le canal pose produit les translations ; le canal décor produit
les propriétés décoratives. Le builder ne compense pas une bordure par des
actions `x/y` supplémentaires.

Pour un segment courbe, l’action ACE porte ensemble `move.transition.path` et
les tweens `style.x/y` issus des offsets auteur lorsque ses endpoints diffèrent.
Ces tweens établissent l’état de pose aux bornes capturées ; `move` reste le
propriétaire de la trajectoire présentée entre ces bornes. La bordure conserve
son action de décor distincte. Cette association ne sérialise aucune correction
de bordure en `x/y` et ne crée pas de seconde trajectoire.

En mode manuel, une pose sans chemin qui suit un chemin explicite déclare
son placement `move: { target }`, sans transition de move supplémentaire.
Les tweens de style restent propriétaires de sa droite, de sa rotation et de
son échelle. Ce placement explicite actualise aussi la pose publiée : après
une courbe, le CS ne réutilise pas son ancien endpoint pour le segment suivant.

`projectItemStyle` possède la conversion contenu/cadre. Il réutilise les
insets et la conversion affine communs de `motion-editor`, avec bordure et
padding. À la frontière CSS, il conserve séparément la bordure et le padding :
la bordure suit l’[arrondi CSS aux pixels physiques](https://www.w3.org/TR/css-values-4/#snap-a-length-as-a-border-width),
le padding conserve ses fractions. Les projections CSS responsive et numérique
partagent le même ratio de pixels de la fenêtre. Le CSS utilise `round` ; aucune
mesure d’item ni cache historique ne fournit les insets. Les services
HTML natifs formatent les styles de chaque part.

La taille de contenu courante est appliquée à la représentation native,
centrée dans le cadre motion. `move` conserve les dimensions et la pose de ses
frontières capturées. Une bordure animée sur 2 s et une pose sur 5 s gardent
ainsi leurs horloges et leurs responsabilités respectives.

Pour afficher le CS, le bridge combine la pose numérique publiée par CodPlay
avec les dimensions de contenu du même snapshot logique et les insets courants.
Il ne déduit pas ces dimensions de la taille interpolée du cadre motion.
Les endpoints auteur et leur indépendance aux visites sont décrits dans la
[spécification d’orientation](./path-tangent-orientation-spec.md).

Les gestes de rotation du Selection Frame modifient le canal pose. En mode
tangente, seule la première position expose cet outil ; son angle devient le
décalage constant décrit par la [spec d’orientation](./path-tangent-orientation-spec.md). L’angle de
rotation est exprimé en degrés ; l’origine de rotation est une paire de
fractions `(fx, fy)`, avec `(0.5, 0.5)` comme origine par défaut. Le delta de
pivot fournit la cible absolue : l’éditeur la compare à l’origine du début du
geste pour détecter un changement. Les fractions `(0, 0)` constituent une cible
valide et sont commitées. Preview et commit réutilisent la projection et le
circuit pose existants. Le test d’intégration
[`decor-editor-bridge-integration-v2.spec.ts`](../tests/decor-editor-bridge-integration-v2.spec.ts)
vérifie la rotation, la cible pivot `(0, 0)` et son commit.

## Présentation et preview

Le composant applique la géométrie auteur dans une règle CSS privée, formatée
par le service style natif. Le présentateur motion possède les contributions
inline du cadre. La libération de ces contributions lors d’une capture révèle
la règle auteur courante. Ce partage préserve aussi une pose motion identique
lors d’une nouvelle présentation logique.

Quand l’état natif porte `width` ou `height: 100%`, l’ancre privée remplit
l’axe correspondant du cadre motion au lieu de rétrécir le visuel à sa taille
intrinsèque. La dimension vient ainsi du cadre courant, y compris d’une aire de
zone ; aucun offset auteur n’est ajouté. Les axes sans cette valeur restent
centrés à leur taille intrinsèque.

Le patch auteur produit par un geste reste limité aux propriétés modifiées. La
preview runtime réunit ce patch avec le cadre affiché complet, afin que le rendu
de l’item suive le même candidat que le Selection Frame pendant le geste. Cette
pose complète reste éphémère et n’est pas committée au document.

Le composant applique la pose runtime au cadre et les transformations CSS
locales à son ancre `-transform`. Il enregistre la matrice 2D calculée de cette
ancre, avec ses quatre coefficients linéaires et son déplacement. Le bridge
résout cette même ancre à partir de l’identifiant du cadre matérialisé, puis
compose sa matrice locale avec la pose runtime avant de produire le cadre du CS
et de l’overlay. Le contour utilise la matrice affine complète ; resize et
pivot utilisent ses coefficients pour calculer leurs deltas. Cette composition
conserve translation, rotation, échelles, transformations CSS et cisaillement
dans le même chemin, sans liste de propriétés à préserver séparément. Le
candidat auteur et les patches de commit restent clairsemés.

Pour un geste du CS sur une pose libre, les coefficients de la matrice affichée
servent à la géométrie du geste. Un nouveau waypoint ou un KF décor promu en KF
pose capture l’échelle logique au temps du geste, y compris une interpolation
auteur en cours. Sans échelle auteur, cette valeur est l’identité. L’échelle
extraite de la matrice affichée ne devient pas un patch de décor. Le geste de
redimensionnement relatif à une zone conserve son édition explicite du scale.

Pendant une preview, le bridge calcule la matrice locale du candidat affiché à
partir de l’inverse de la pose runtime publiée et de l’affine complète du cadre
candidat : `previewLocal = inverse(runtimePose) × displayedFrame`. Il fournit
cette matrice et les dimensions candidates en pixels CSS à l’ancre privée. La
matrice de l’ancre est composée sous la pose runtime du cadre ; leur produit
restitue ainsi l’affine du candidat affiché, y compris son origine, ses
translations et ses contributions linéaires. Le composant consomme ces champs
privés avant de déléguer le style au composant natif. `snapshot.clear` retire la
matrice et les dimensions de preview et restaure la projection CSS normale.

Cette composition suppose une pose runtime que la preview ne déplace pas : c'est
le cas d'une présentation matérialisée (`local`, `reparent`), où le `move` possède
la trajectoire. Un item présenté dans son propre nœud (`source`, par exemple à la
fin d'un `move` temporisé) est placé par la géométrie du snapshot elle-même : le
patch de preview déplace déjà son cadre, et une matrice calculée contre la pose
précédente appliquerait le geste une seconde fois. Dans ce cas, la preview ne porte
que la géométrie complète du candidat, sans matrice d'ancre. `itemPreviewTransform`
(`src/item-presentation/item-preview.ts`) porte seul cette règle. jsdom ne recalcule
pas la pose runtime : les tests vérifient donc la règle sur le patch, et le parcours
navigateur vérifie l'alignement du cadre et de l'item pendant le geste.

Le champ `affineProjection` et ses opérations géométriques sont décrits dans la
[spécification Selection Frame V2](../../authoring/selection-frame/specs/selection-frame-v2-spec.md).

La conversion entre cadre de contenu et boîte de bordure applique les insets
avec le même linéaire affine et recalcule l’origine projetée après translation.
La géométrie de trajectoire transforme le point `transform-origin` de la boîte
de bordure pour produire ensemble l’ancre du chemin, les ghosts et le CS.
Pour un item animé dont les quatre longueurs de pose libre sont résolues et
l’origine est exprimée en fractions, `projectItemStyle` place le centre du
cadre de mouvement sur cet axe. L’ancre privée repositionne le visuel dans le
cadre et sa projection inclut ce déplacement. Le trajet peut ainsi suivre
l’axe du visuel avec le contrat du mouvement par le centre. Un premier pivot
auteur s’interpole depuis le centre par défaut dans l’action de pose.
Pendant un geste tangent, une modification de dimensions ou de pivot conserve
l’orientation affine affichée ; un déplacement le long du chemin recalcule la
tangente, et une rotation explicite applique sa contribution sur la matrice
présentée.

La preview est éphémère et absente de `snapshot.get()` et du document ;
`snapshot.clear` rétablit la présentation publiée.

Pour les raccords tangentiels de poses libres résolues, la compilation peut
fournir `--editor-item-motion-reference-angle`. Cette propriété technique
prépare le cadre naturel dans la référence de rotation de la borne entrante.
`projectItemStyle` conserve l’ancre, les dimensions et les échelles auteur ;
ses expressions de position gardent séparément les longueurs cqw et px et
les insets CSS. Le snapshot logique conserve l’angle initial auteur. La
propriété est exclue de la représentation native et des captures de décor.
Cette référence prépare la transformation runtime ; elle ne remplace pas les
valeurs sparse de l’auteur pendant une preview.

## Défaut du bloc texte

`assignType('text')` applique une seule fois le preset texte à `item.initialDecorId`.
Il centre le contenu horizontalement avec `text-align: center` et verticalement
avec `display: flex`, `align-items: center` et `justify-content: center`. Les
décors de keyframes restent clairsemés : ils héritent de ces valeurs initiales
et ne les recopient que si l’auteur les modifie. Une rotation de pose tourne le
bloc et son texte ensemble, sans changer leur centrage relatif.

Le preset texte définit aussi `font-size: 3cqw`. Au chargement, la façade
matérialise cette taille dans le décor initial des anciens items texte qui ne
portent pas de taille dans `style` ni `custom`, avant leur compilation. Les
keyframes utilisent ensuite le tween ACE générique ; une taille déjà déclarée
dans ces champs reste prioritaire. Cette initialisation conserve les longueurs
auteur en cqw et ne copie pas le défaut dans chaque KF.

Le texte suit la transformation de l’item qui le contient. Sa taille de police
reste celle du décor courant. Un scale auteur peut modifier sa taille à
l’écran sans changer cette propriété typographique.

Le preset utilise le circuit décor existant ; il ne crée pas de canal temporel
par propriété. Sa définition est dans
[`default-decor-presets.ts`](../src/app/commands/default-decor-presets.ts), son
application dans [`base-commands.ts`](../src/app/commands/base-commands.ts).
[`base-commands.spec.ts`](../tests/commands/base-commands.spec.ts) et
[`default-decor-presets.spec.ts`](../tests/commands/default-decor-presets.spec.ts)
couvrent son application, sa matérialisation au chargement et la conservation
des tailles auteur.

La coordination adopte la fin de lecture sans inspecter les chemins ni
traverser `durée − 2 ms`. Un dépassement lié à l’outro virtuelle conserve le
Seek existant vers la durée auteur. Les Stop répétés conservent leur garde.

## Références de vérification

- [`item-component.spec.ts`](../tests/item-presentation/item-component.spec.ts)
  couvre la projection CSS locale, la composition d’une matrice affine avec
  cisaillement, la matrice temporaire inverse de la pose runtime et le cycle de
  vie du composant natif.
- [`decor-editor-bridge-v2.spec.ts`](../tests/decor-editor-bridge-v2.spec.ts)
  couvre les transformations move, resize, rotation et pivot du cadre.
- [`decor-editor-bridge-integration-v2.spec.ts`](../tests/decor-editor-bridge-integration-v2.spec.ts)
  couvre la pose complète de preview, les patches auteur clairsemés, les gestes
  de cadre, leur annulation et leur commit.
- [`geometry.spec.ts`](../tests/motion-editor/geometry.spec.ts) et
  [`content-box.spec.ts`](../tests/motion-editor/content-box.spec.ts) et
  [`border-insets.spec.ts`](../tests/motion-editor/border-insets.spec.ts)
  couvrent les dimensions de contenu, l’affine, le pivot et les insets.
- [`motion-path.spec.ts`](../tests/builder-v2/motion-path.spec.ts),
  [`player-interpolation.spec.ts`](../tests/builder-v2/player-interpolation.spec.ts)
  et [`decor-properties-stress.spec.ts`](../tests/builder-v2/decor-properties-stress.spec.ts)
  couvrent le builder et le player avec poses et chemins.
- [`scene-player-bridge-v2.spec.ts`](../tests/scene-player-bridge-v2.spec.ts)
  couvre la fin de lecture, Seek terminal et Stop.
