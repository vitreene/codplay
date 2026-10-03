# Elcé — ancre de bdc dans un Flux

## Statut

**En cours — ratio natif et continuité de l’image vérifiés ; le chargement et le
montage d’une vidéo réelle ont aussi été vérifiés dans Safari.**

Le 3 octobre 2026, le déplacement de l’ancre après « For » puis le resize de
l’éditeur conservent « For the » sur une même ligne naturelle avant l’image.
La réservation reste visible sous cette ligne et le texte reprend sous le bdc.
Le précédent `margin-inline-end:100%` coupait cette ligne et a été retiré de
l’éditeur.

Le raccord détaillé entre le builder Elcé, les parts `layout` et le montage
des persos CodPlay est décrit dans la
[spécification d’intégration CodPlay](./codplay-anchor-integration-spec.md).

## Contrat vérifié

`ElceAnchorExtension` représente une insertion de bdc comme un nœud inline
atomique et déplaçable. Ses attributs métier sont `bdcId`, `partId` et
`paddingBottom`. Un dépôt de fichier ajoute `mediaId` et `mediaType` afin que
la surface d’édition puisse résoudre son aperçu ; ces attributs ne changent pas
la projection du bdc dans la scène. L’éditeur affiche une prise déplaçable ;
l’export statique produit un seul `span` avec `id`, `data-part`, `data-bdc-id`
et `data-elce-anchor`. À la première insertion, le `padding-bottom` a un ratio
provisoire défini dans la configuration. Après chargement de l’image, le
NodeView calcule
`hauteur intrinsèque / largeur intrinsèque × 100 %` et inscrit le résultat dans
l’attribut de l’ancre par une transaction Tiptap. Le `padding-bottom` réservé
garde ce ratio, auquel s’ajoutent la ligne d’insertion et les marges. Le player
ajoute la marge supérieure `ANCHOR.DEFAULT_BDC_MARGIN_TOP`, également définie
dans la configuration et non éditable dans le POC.

Le nœud ne crée aucun élément CodPlay et ne contient pas de HTML saisi par
l’auteur. Le builder Flux relit les ancres exportées dans les Sections avant
de projeter le player : si le `data-bdc-id` correspond à un bdc image ou vidéo
de la page, l’ancre d’édition est remplacée par un `span` de flux inline à
largeur nulle, porteur du `data-part` et de la réservation verticale. Le
`span` d’ancrage propre à l’éditeur et ses attributs métier ne sont pas rendus
dans le player. Le perso média CodPlay est monté directement dans ce slot et
aucun hôte média frère n’est ajouté. Dans l’éditeur, la NodeView aligne le haut
de l’ancre sur le haut de la ligne (`vertical-align:top`) et réserve par son
`padding-bottom` le ratio intrinsèque de l’image, une ligne (`1lh`) et deux
marges configurées.
Le bdc commence après cette ligne et la marge supérieure. Les mots qui suivent
l’ancre restent dans le flux normal : aucun retour forcé n’est exporté.
La variable `--elce-anchor-padding` conserve le ratio métier. L’aperçu et le
perso image utilisent `object-fit:cover`; le ratio du cadre est déduit de ce
même padding. Dans le player,
le composant CodPlay `layout` replace le slot existant après la fin de la ligne
visuelle et recalcule sa réservation quand la largeur change ; aucun code Elcé
ne mesure ou ne déplace un nœud après le montage CodPlay. Le parseur statique
relit les attributs de l’ancre lorsqu’un markup est rouvert dans Tiptap.

Le dépôt d’un fichier image ou vidéo passe par `ElceAnchorDropFacade`, puis par
le contrôleur XState. La façade et `ElceAnchorDropService`, deux classes métier
indépendantes de React, appliquent la whitelist, créent les identifiants de
média et de bdc et décrivent la commande. La machine XState séquence ensuite
la sauvegarde dans `ElceDocumentStore`, la création du bdc, l’insertion de
l’ancre et l’enregistrement de la source de lecture. Les changements de
contenu, le déplacement et la suppression d’une ancre empruntent la même
commande `section.change` ; aucun circuit Promise parallèle ne peut réécrire
un markup plus récent. Le composant d’édition ne possède aucune mutation
documentaire.

Une édition ordinaire du texte (`kind: 'content'`) met à jour la Section par
`bdc.section.update`. [`ElceAnchorReferenceService`](../src/domain/anchor-reference-service.ts)
compare les identifiants présents dans l’ancien et le nouveau document riche ; le bdc de chaque ancre
effacée retourne au catalogue dans la même commande documentaire, tandis que
sa ressource média est conservée. `applyDocumentCommand` vérifie les invariants
avant de rendre chaque nouveau document : une ancre référence un seul bdc
image ou vidéo de la même page, et un bdc ancré ne peut pas être déplacé vers
le catalogue ou une autre page sans supprimer son ancre. Le collage conserve
le texte copié mais retire les nœuds d’ancre ; un glisser-déposer copié est
refusé. Le déplacement réel reste traité par la commande de déplacement
d’ancre existante.

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

## Preuve

- [`elce-anchor-extension.test.ts`](../src/app/editor/elce-anchor-extension.test.ts)
  vérifie la conversion JSON → `span` statique, les attributs de ciblage et
  la prise d’insertion déplaçable dans la surface Tiptap, ainsi que le rendu de
  l’image résolue dans la zone réservée. La poignée est sœur du bdc et reste
  sous le nœud d’ancre déplaçable ; le test exerce un `dragstart` sur cette
  poignée puis le dépôt géré par le plugin Tiptap.
- [`flux-anchor-player-markup.test.ts`](../src/builders/flux-anchor-player-markup.test.ts)
  vérifie que la projection conserve le texte, remplace l’ancre d’édition par
  un slot de flux inline à largeur nulle et conserve la cible logique du bdc.
- [`flux-scene-builder.test.ts`](../src/builders/flux-scene-builder.test.ts)
  vérifie que le builder dirige le perso image vers la part du slot projeté
  sans générer un second hôte média.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie le montage de l’image dans le slot projeté par le runtime réel
  Sighty/CodPlay.
- [`anchor-drop-service.test.ts`](../src/domain/anchor-drop-service.test.ts)
  vérifie la whitelist, la construction du commandement et le passage par la
  façade métier.
- [`document-commands.test.ts`](../src/app/commands/document-commands.test.ts)
  vérifie qu’une mise à jour de texte ordinaire qui efface une ancre renvoie
  son bdc au catalogue sans supprimer le média, et refuse une ancre dupliquée.
- [`controller-machine.test.ts`](../src/app/controller/controller-machine.test.ts)
  vérifie que deux dépôts dont la sauvegarde IndexedDB est asynchrone restent
  ordonnés dans la machine XState et produisent chacun leur bdc et leur ancre.
  Il vérifie aussi qu’une édition ordinaire qui efface l’ancre traverse la
  machine et renvoie le bdc au catalogue.
- [`elce-anchor-extension.test.ts`](../src/app/editor/elce-anchor-extension.test.ts)
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

Dans Safari, la poignée reste centrée sur la position de l’ancre lors du
déplacement et après réduction de la colonne de `491,8 px` à `170,8 px`. Elle
reste hors du cadre image. La preview du même document ne contient aucune
poignée d’édition et conserve son unique image.

## Limites

Les dépôts de références du catalogue, le retour visuel d’un bdc supprimé dans
la réserve et la réouverture d’un bdc dans l’espace isolé ne sont pas encore
implémentés. Le déplacement interne est exercé par le test de l’extension et
les commandes. Le rendu navigateur de plusieurs ancres distinctes reste à
vérifier dans une tranche ultérieure.
