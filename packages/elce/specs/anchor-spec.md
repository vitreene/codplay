# Elcé — ancre de bdc dans un Flux

## Statut

**En cours — insertion des Cartes et du Graphe par le circuit
d’ancre partagé. La réserve Tableau/SVG du Graphe et la superposition du panneau
d’édition sur le média sont vérifiées dans Brave ; les autres parcours média,
layouts Carte et gestes d’édition restent en cours de validation.**

Le 3 octobre 2026, le déplacement de l’ancre après « For » puis le resize de
l’éditeur conservent « For the » sur une même ligne naturelle avant l’image.
La réservation reste visible sous cette ligne et le texte reprend sous le bdc.
Le précédent `margin-inline-end:100%` coupait cette ligne et a été retiré de
l’éditeur.

Le raccord détaillé entre le builder Elcé, les parts `layout` et le montage
des persos CodPlay est décrit dans la
[spécification d’intégration CodPlay](./codplay-anchor-integration-spec.md).

## Contrat vérifié

`ElceAnchorExtension` représente une insertion de BDC comme un nœud inline
atomique et déplaçable. Ses attributs métier sont `bdcId`, `partId` et
`paddingBottom`. L’extension ne stocke ni `mediaId` ni type de média :
l’éditeur résout le BDC par `bdcId`. Une Carte utilise son preset et ses médias ;
un Graphe utilise son builder de scène.
L’aperçu utilise le même `ElceCardPresetBuilder` et le même `CARD_PRESETS` que
la projection Flux ; il affiche les champs de texte déclarés par le layout et
les médias compatibles avec ce layout, en conservant ses réglages de position
et de cadrage lorsqu’ils s’appliquent. Texte court peut donc servir aux
citations et exergues sans introduire un type de BDC distinct. Les layouts
Texte avec image et Image avec légende gardent leur gabarit Carte ; Photo reste
le seul layout qui accepte une vidéo. L’éditeur affiche une prise déplaçable ;
l’export statique produit un seul `span` avec `id`, `data-part`, `data-bdc-id`
et `data-elce-anchor`. À la première insertion Photo, le `padding-bottom` a un
ratio provisoire défini dans la configuration : `75%` pour une image et
`56.25%` pour une vidéo dont le cadre reste au format `16 / 9`. Après chargement
de l’image, le NodeView calcule
`hauteur intrinsèque / largeur intrinsèque × 100 %` et inscrit le résultat dans
l’attribut de l’ancre par une transaction Tiptap. Si l’image est déjà chargée
quand le NodeView est créé, la mesure est différée à la microtâche suivante :
le nœud est alors monté dans le document ProseMirror et sa transaction passe
par l’événement `update` normal de `SectionTiptapAdapter`, jusqu’à la commande
XState existante. Un média vidéo déjà présent dans un document importé est
normalisé à `56.25%` par une transaction du même NodeView, conformément au cadre
vidéo Elcé. Les autres layouts utilisent la réservation par défaut configurée.
Le `padding-bottom` réservé comprend la ligne d’insertion et les
marges ; le player ajoute la marge supérieure
`ANCHOR.DEFAULT_BDC_MARGIN_TOP`, également définie dans la configuration et non
éditable dans le POC. Les marges haute et basse des BDC ancrés valent chacune
`2rem` ; la réservation du player inclut les deux marges.

Le nœud ne crée aucun élément CodPlay et ne contient pas de HTML saisi par
l’auteur. Une Carte ou un Graphe ancré est un BDC enfant de la
Section qui l’emploie : son
`parentBdcId` désigne la Section, `pageId` vaut `null` et son identifiant
n’apparaît pas dans `page.bdcIds`. Le builder Flux relit les ancres exportées
dans les Sections : si le `data-bdc-id` correspond à ce BDC enfant,
l’ancre d’édition est remplacée par un `span` de flux inline à
largeur nulle, porteur du `data-part` et de la réservation verticale. Le
`span` d’ancrage propre à l’éditeur et ses attributs métier ne sont pas rendus
dans le player. Le BDC est monté directement dans ce slot et aucun hôte frère
n’est ajouté. Dans l’éditeur, la NodeView aligne le haut
de l’ancre sur le haut de la ligne (`vertical-align:top`) et réserve par son
`padding-bottom` le ratio intrinsèque de l’image, une ligne (`1lh`) et deux
marges configurées.

Pour un Graphe ancré, le même slot réserve `100%` de la largeur de ligne en mode
Tableau et `56.25%` pour un rendu SVG. Le Tableau garde sa hauteur naturelle ;
ses cellules visibles partagent la taille de police calculée pour le contenu le
plus contraignant.
Pour une Carte, le bdc commence après cette ligne et la marge supérieure. Les mots qui suivent
l’ancre restent dans le flux normal : aucun retour forcé n’est exporté.
La variable `--elce-anchor-padding` conserve le ratio métier. L’aperçu et le
perso image utilisent `object-fit:cover`; le ratio du cadre est déduit de ce
même padding. Pour une Carte ancrée au layout Photo, la racine suit ce ratio
avec une hauteur automatique ; elle ne reprend pas la hauteur `100 %` utilisée
par ce preset dans un Carousel. La réserve et le cadre gardent ainsi le même
ratio, auquel s’ajoutent les marges configurées. Dans le player,
le composant CodPlay `layout` replace le slot existant après la fin de la ligne
visuelle et recalcule sa réservation quand la largeur change ; aucun code Elcé
ne mesure ou ne déplace un nœud après le montage CodPlay. Le parseur statique
relit les attributs de l’ancre lorsqu’un markup est rouvert dans Tiptap.

Le dépôt d’un fichier image ou vidéo passe par `EditorActionsFacade`
(`app/facades/editor-actions-facade.ts`), qui délègue à la façade spécialisée
`ElceAnchorDropFacade` (`app/facades/anchor/`) avant le contrôleur XState.
Cette façade délègue à `ElceAnchorDropService` les cibles métier et la création
de commande ; le service métier applique la whitelist Carte/Graphe et décrit le
BDC. La
machine XState séquence ensuite la sauvegarde dans `ElceDocumentStore`, la
création du bdc, l’insertion de l’ancre et l’enregistrement de la source de
lecture. Les changements de contenu, le déplacement et la suppression d’une
ancre empruntent la même commande `section.change` ; aucun circuit Promise
parallèle ne peut réécrire un markup plus récent. Le composant d’édition ne
possède aucune mutation documentaire.

Avant cette sauvegarde, le worker de la même file demande au service média de
comparer le fichier aux ressources de même taille, puis aux octets conservés,
par SHA-256. Un fichier identique réutilise l’entrée et le blob existants,
quel que soit son nom ou son MIME ; le dépôt garde son nouvel identifiant de BDC. Des octets différents créent une nouvelle ressource média.
Le contrôleur sérialise les imports afin qu’un second dépôt attende le commit
du premier avant la comparaison.

Le dépôt d’une référence de BDC disponible suit aussi la façade et la machine
XState : `ElceAnchorDropService` prépare une cible de source BDC et la commande
`bdc.anchor.attach` insère dans la page ce même BDC, qui était disponible dans
le catalogue. Le document réaffecte ce BDC à la page ; il ne le duplique pas
et ne recrée pas sa ressource média. Le test du contrôleur vérifie ce parcours
et le refus de proposer de nouveau le BDC après son placement.

Glisser une ancre depuis Tiptap sur le bouton ou le panneau de l’onglet
« Blocs disponibles » la retire du texte et remet le même BDC au catalogue.
Si le dépôt cible le bouton, l’onglet devient actif. Le clavier Suppr conserve
son autre comportement : il supprime l’ancre et le BDC, sans remettre ce dernier
au catalogue. Pour le retour, le plugin Tiptap mémorise le BDC au `dragstart` ;
après que ProseMirror a sérialisé son propre contenu de glisser-déposer, un
écouteur du plugin ajoute `ANCHOR_RETURN.MIME_TYPE` au `DataTransfer`. Le bouton
et le panneau des BDC acceptent ce type et fixent l’effet du dépôt à `move` ; le
`dragend` source retire le nœud d’ancre par une transaction marquée `return`.
Safari expose `dropEffect: move` mais une liste `DataTransfer.types` vide sur ce
`dragend`, même après que la cible a accepté le dépôt. La décision source
s’appuie donc sur l’identifiant et la position mémorisés au départ, l’effet
`move` et la vérification du nœud courant ; elle ne revalide pas le type MIME
après le dépôt.
`SectionEditor` transmet le document riche actualisé à `EditorActionsFacade`,
qui appelle `ElceAnchorDropFacade` ; XState traite `section.change`, puis la
commande `bdc.anchor.return` vérifie l’ancre,
conserve son identifiant et sa ressource média, et réaffecte le BDC au
catalogue. Le BDC n’est ni cloné ni supprimé.

Une édition ordinaire du texte (`kind: 'content'`) met à jour la Section par
`bdc.section.update`. [`ElceAnchorReferenceService`](../src/domain/anchor/anchor-reference-service.ts)
compare les identifiants présents dans l’ancien et le nouveau document riche ;
chaque BDC ancré qui n’est plus référencé est supprimé dans la même commande,
et son média reste conservé. Le BDC est le transport unique d’une insertion ;
il référence la ressource média réutilisable au lieu de la remplacer.
La suppression d’une Section par `bdc.section.delete` applique la même règle à
toutes ses ancres : les Cartes et Graphes statistiques enfants sont supprimés
avec la Section,
leurs ressources média restent disponibles.
`applyDocumentCommand` vérifie les invariants avant de rendre chaque nouveau
document : une ancre référence un seul BDC Carte ou Graphe enfant
de sa Section, qui ne peut pas être déplacé vers le catalogue ou une autre page
sans retirer son ancre. ProseMirror applique
`transformPasted` aux collages et aussi à la tranche d’un glisser-déposer avant
d’appeler `handleDrop`. Au `dragstart`, l’extension mémorise la position de
l’ancre source ; si cette tranche contient cette ancre locale, le filtre la
laisse intacte pour que `handleDrop` puisse effectuer le déplacement par la
commande d’ancre existante. Le même gestionnaire arrête une copie déplacée avec
un modificateur sans créer une seconde ancre. Hors de ce glisser local, le
collage conserve le texte mais retire les nœuds d’ancre.

Dans la surface d’édition comme dans le player, le `span` de l’ancre est un
élément inline de largeur nulle : il ne prend pas de largeur de texte. Sa
variable CSS conserve le ratio métier et sa réservation calculée inclut les
marges du bdc. Son enfant
`elce-anchor-bdc` ou le perso média CodPlay est positionné en absolu par CSS
Anchor Positioning. La poignée `elce-anchor-handle` est un autre enfant de la
NodeView, frère du bdc. Elle cible le même `anchor-name` et se centre sur le
point d’insertion dans le texte sans prendre de largeur dans le flux. Le bdc
ne contient plus de poignée. Quand la source de média est disponible, le composant image ou
vidéo est rendu dans le bdc réservé ; l’aperçu ne devient pas une seconde
donnée métier. Le slot projeté du player est une interface de montage
structurelle, sans prise ni décor d’édition. Le composant CodPlay `layout`
lit la géométrie de la ligne du texte pour replacer ce slot après le montage.
Dans l’adaptateur Remix, chaque NodeView d’ancre enregistre aussi un rappel de
rafraîchissement : quand XState met à jour la source média sans changer le JSON
de la Section, l’image ou la vidéo apparaît dans le même DOM ProseMirror, sans
remonter l’éditeur.

Dans l’éditeur Remix, l’action « Modifier le bloc illustratif ancré » ouvre
l’éditeur partagé du même BDC. Un conteneur de positionnement couvre la largeur
de la ligne et laisse passer les pointeurs ; seul le bouton de `2.5rem` est
interactif. Le SVG décoratif ne capte pas lui-même le pointeur, qui arrive donc
sur le bouton. Le panneau est ancré au cadre média par CSS Anchor Positioning et
`anchor-size(width/height)` : il occupe exactement le rectangle réservé à
l’image ou à la vidéo, au même emplacement que le BDC sélectionné, au lieu de
s’ajouter après tout le texte de la Section. Le clic fait défiler ce cadre dans
la zone visible avec `scrollIntoView({ block: 'nearest' })`.

## Preuve

- [`elce-anchor-extension.test.ts`](../src/app/editor/anchor/elce-anchor-extension.test.ts)
  vérifie la conversion JSON → `span` statique, les attributs de ciblage,
  l’aperçu image Photo et les aperçus Texte court, Texte avec image et Image
  avec légende. Les gabarits de ces aperçus viennent de `ElceCardPresetBuilder`.
  Le test vérifie aussi le déplacement d’une ancre image par le chemin complet
  `dragstart` → ProseMirror → `drop` → commande de déplacement. Le test vérifie
  que le même BDC change de position et qu’un glisser en mode copie ne le
  duplique pas. Le test du retour couvre le cas Safari où `dragend` garde
  `dropEffect: move` avec une liste de types vide. Il couvre aussi le collage
  qui retire les ancres.
- [`remix-section-production.test.tsx`](../src/app/editor/section/remix-section-production.test.tsx)
  vérifie dans la page Remix de production le rafraîchissement du média après
  persistance XState sans remplacer l’instance `Editor` ni son DOM ProseMirror.
  Avec une image déjà complète au montage, il vérifie que le ratio calculé passe
  par XState jusqu’à `flowReservations` du builder Flux. Il déclenche aussi le
  clic sur le vrai bouton d’édition, puis vérifie que le panneau partagé cible le
  cadre du même BDC, avec sa position CSS et son défilement.
- [`section-editor-tiptap-adapter.test.ts`](../src/app/editor/section/section-editor-tiptap-adapter.test.ts)
  couvre explicitement l’image chargée avant le montage du NodeView et la
  soumission du ratio calculé par le callback de modification de Section.
- Le 22 octobre, le vrai bouton `40 × 40 px` ouvre l’éditeur partagé du même
  BDC. Brave DevTools confirme que le panneau recouvre exactement le cadre
  média ciblé (`643.6 × 424.1 px`) au point d’ancrage, et que les champs Carte
  restent visibles dans ce cadre.
- Le projet Demo5 enregistré utilise maintenant les ratios mesurés pour ses
  neuf images : `900 × 593` → `65.88888889%`, `640 × 416` → `65%` et
  `640 × 421` → `65.78125%`. Son unique vidéo reprend le cadre Elcé existant
  `16 / 9` → `56.25%`. L’éditeur a enregistré ces valeurs par ses transactions
  normales et le projet indique « Synchronisé » à la révision 12 ; aucune
  écriture SQL directe n’a été faite.
- **Mesure antérieure au doublement des marges du 26 octobre 2026 :** une
  preview fraîche ouverte depuis l’éditeur affiche les deux images de la
  première page, décodées en `900 × 593` et `640 × 416`. À `918 px` de largeur,
  leurs cadres mesurent respectivement `918 × 604.86 px` et `918 × 596.70 px` ;
  les deux slots gardent leurs `16 px` de marge supérieure et inférieure. La
  preview de la page vidéo réserve `56.25%`. Les consoles de l’éditeur et de
  cette preview sont sans erreur.
- **Contrôle Brave après doublement, le 26 octobre 2026 :** sur la preview Demo5,
  les deux BDC ancrés commencent à `2rem` du haut de leur slot et laissent
  `2rem` en bas. Ces espacements suivent la largeur mobile et ordinateur sans
  débordement horizontal. [`anchor-position.test.ts`](../src/app/anchor/anchor-position.test.ts),
  [`elce-anchor-extension.test.ts`](../src/app/editor/anchor/elce-anchor-extension.test.ts),
  [`flux-scene-builder.test.ts`](../src/builders/flux/flux-scene-builder.test.ts)
  et [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  couvrent les réservations et les deux marges ; typecheck et build passent.
- Le 8 octobre 2026, Brave DevTools reproduit le défaut dans la preview réelle
  de Page A du Projet 1, sans modifier le document : le slot réservait
  `918 × 1462,75 px`, tandis que la racine Photo et son image ne faisaient que
  `918 × 19 px`. La règle du preset `height:100%` se résolvait sur la ligne de
  texte. La racine ancrée reçoit maintenant une hauteur automatique et son
  aspect ratio détermine son cadre. Après rechargement, le cadre et l’image
  mesurent `918 × 1430,75 px` dans la réserve, avec `16 px` de marge au-dessus
  et au-dessous. À `960 px` de largeur de fenêtre, ils suivent le resize à
  `598 × 932,01 px` ; le ratio du cadre (`0,64163`) correspond au ratio source
  (`0,64162`). L’image répond `200` depuis l’URL serveur et garde le cadrage
  `object-fit:cover` ; la console reste vide.
- `flux-scene-builder.test.ts` vérifie le style de la scène et
  `elce-player-composition.test.ts` celui du perso monté dans la composition
  réelle. Les 35 tests ciblés et les 206 tests Elcé passent ; le typecheck et le
  build réussissent.
- [`flux-anchor-player-markup.test.ts`](../src/builders/flux/flux-anchor-player-markup.test.ts)
  vérifie que la projection conserve le texte, remplace l’ancre d’édition par
  un slot de flux inline à largeur nulle et conserve la cible logique du bdc.
- [`flux-scene-builder.test.ts`](../src/builders/flux/flux-scene-builder.test.ts)
  vérifie que le builder dirige le perso image vers la part du slot projeté
  sans générer un second hôte média.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie le montage de l’image dans le slot projeté par le runtime réel
  Sighty/CodPlay.
- [`anchor-drop-service.test.ts`](../src/domain/anchor/anchor-drop-service.test.ts)
  vérifie les cibles et commandes métier pour l’insertion d’une Carte ou d’un
  Graphe.
- [`statistical-graph-placements.test.ts`](../src/builders/statistical-graph/statistical-graph-placements.test.ts)
  vérifie le slot de Section, la réserve Tableau/SVG et le montage de la story
du Graphe par le builder Flux réel.
- [`anchor-drop-facade.test.ts`](../src/app/facades/anchor/anchor-drop-facade.test.ts)
  vérifie le transfert de l’intention Section vers le contrôleur.
- [`document-commands.test.ts`](../src/domain/commands/document-commands.test.ts)
  vérifie qu’une mise à jour de texte ordinaire ou une suppression dédiée
  efface le BDC ancré sans le réinscrire au catalogue, conserve le média,
  supprime aussi les ancres lorsqu’une Section entière est supprimée, et refuse
  une ancre dupliquée.
- [`controller-machine.test.ts`](../src/app/controller/controller-machine.test.ts)
  vérifie que deux dépôts dont la sauvegarde IndexedDB est asynchrone restent
  ordonnés dans la machine XState et produisent chacun leur bdc et leur ancre.
  Il vérifie aussi qu’un même fichier déposé sous deux noms réutilise un seul
  média et un seul blob tout en créant deux BDC distincts.
  Il vérifie aussi qu’une édition ordinaire qui efface l’ancre traverse la
  machine, supprime le BDC concerné et conserve le média. Le test vérifie aussi
  qu’un retour traverse `section.change` et XState, remet le même BDC au
  catalogue et conserve sa ressource média.
- Dans Safari MCP, le retour a été déposé directement sur le bouton
  « Blocs disponibles » alors que l’onglet « Médias » était actif. L’application
  a activé l’onglet, retiré l’ancre et remis au catalogue le même BDC et son
  média. Sa réinsertion dans le texte a conservé le même identifiant ; le
  catalogue n’en garde aucune copie lorsqu’il est replacé.
- Après un rechargement complet ayant chargé le correctif dans le plugin Tiptap,
  le glisser physique de Page A vers « Blocs disponibles » retire
  `bdc-video-d49f2d52-8e10-4f77-977a-c57bd16df6d0` de la page et le rend
  disponible sous le même identifiant. L’autre Carte reste ancrée. Le retour
  et la conservation de l’ancre restante persistent après un nouveau
  rechargement Safari.
- [`elce-anchor-extension.test.ts`](../src/app/editor/anchor/elce-anchor-extension.test.ts)
  vérifie que le collage de texte conserve les mots et retire les ancres
  copiées, et qu’un glisser-déposer en mode copie est arrêté.

La preuve navigateur se fait dans l’application Elcé : déposer une image ou
une vidéo dans la Section WYSIWYG, attendre la fin de la commande XState, puis
ouvrir `Prévisualiser`. Cette preview monte le scénario Sighty et la scène
CodPlay produits par le circuit courant. Elle doit montrer une seule image ou
vidéo dans le slot, sans `data-elce-anchor` visible, avec le haut du bdc
décalé par `ANCHOR.DEFAULT_BDC_MARGIN_TOP`, une séparation équivalente sous le
média et le texte suivant conservé dans le flux. Le cadre de l’image utilise
son ratio intrinsèque et le rendu `cover`, cohérents avec la réservation du
slot. La vérification
Safari du 3 octobre 2026 confirme, dans l’éditeur, la phrase continue de
chaque côté de l’ancre à des colonnes de `491,8 px` et `170,8 px`. L’image
mesure `1200 × 981 px` : l’ancre enregistre `81.75%` et son cadre couvre
l’image au ratio `1.22324159 / 1`. Après
déplacement par le plugin de dépôt, « For the » partage la ligne avant l’image ;
le résultat persiste après rechargement et resize. Dans la preview réelle, le
slot et l’unique perso image occupent la largeur du texte et le texte reprend
sous le média. Le typecheck et le build passent. Une vidéo MP4 réelle
(`442 × 300 px`, `5,89 s`) a ensuite été déposée dans l’éditeur, restaurée
après rechargement, puis montée dans le slot du player avec une réserve
`56.25%` et un cadre `16 / 9`. L’éditeur emploie actuellement `contain`, le
player `cover` ; le plan Elcé actif garde la parité de cadrage à décider.
L’édition ordinaire qui efface une ancre est vérifiée par les tests de commande
et de machine XState ; son rendu persistant reste à refaire dans Safari avec
plusieurs ancres distinctes.

Le 3 octobre 2026, dans Safari, le dépôt d’un média réutilisable sur Page E a
créé un BDC unique. Sa suppression par le clavier a laissé Page E sans ancre,
gardé le nombre de BDC disponibles et conservé les trois références média du
catalogue. Un nouveau dépôt du même média a créé un autre identifiant de BDC ;
le média est resté présent et une seule vidéo apparaît dans l’éditeur. Page A
est restée intacte avec ses deux ancres.

Dans Safari, la poignée reste centrée sur la position de l’ancre lors du
déplacement et après réduction de la colonne de `491,8 px` à `170,8 px`. Elle
reste hors du cadre image. La preview du même document ne contient aucune
poignée d’édition et conserve son unique image.

## Limites

Le cycle retour/réinsertion a été exercé dans Safari MCP par dispatch
d’événements de glisser-déposer sur les nœuds de l’application ; le glisser
physique à la souris reste à éprouver. La réouverture d’un BDC dans l’espace
isolé reste à vérifier. Le déplacement interne est exercé par le test de
l’extension et les commandes. Le rendu navigateur de plusieurs ancres distinctes
reste à vérifier dans une tranche ultérieure.
