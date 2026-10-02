# Elcé — ancre de bdc dans un Flux

## Statut

**En cours — nœud Tiptap, prise déplaçable, export statique, dépôt de fichier,
montage d’un perso image et réservation visuelle dans le player DOM vérifiés ;
les sources catalogue et la réouverture d’un bdc restent dans le plan.**

## Contrat vérifié

`ElceAnchorExtension` représente une insertion de bdc comme un nœud inline
atomique et déplaçable. Ses attributs métier sont `bdcId`, `partId` et
`paddingBottom`. Un dépôt de fichier ajoute `mediaId` et `mediaType` afin que
la surface d’édition puisse résoudre son aperçu ; ces attributs ne changent pas
la projection du bdc dans la scène. L’éditeur affiche une prise déplaçable ;
l’export statique produit un seul `span` avec `id`, `data-part`, `data-bdc-id`
et `data-elce-anchor`. Le `padding-bottom` réservé est déclaré par
configuration et reste indépendant du contenu du bdc.

Le nœud ne crée aucun élément CodPlay et ne contient pas de HTML saisi par
l’auteur. Le builder Flux relit les ancres exportées dans les Sections : si le
`data-bdc-id` correspond à un bdc image ou vidéo de la page, son perso est
monté directement sur le `data-part` de l’ancre et aucun hôte média frère n’est
ajouté. Le parseur statique relit les attributs de l’ancre lorsqu’un markup est
rouvert dans Tiptap.

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

Dans la surface d’édition, le `span` de l’ancre réserve la place du bdc dans le
flux. Il ne porte pas le décor de déplacement : un enfant `elce-anchor-bdc`
représente le bdc et porte son marquage visuel, tandis que la prise
`elce-anchor-handle` est superposée et ne crée ni largeur ni hauteur
supplémentaire. Quand la source de média est disponible, le composant image ou
vidéo est rendu dans le bdc réservé ; l’aperçu ne devient pas une seconde
donnée métier. Le `span` statique exporté reste dépourvu de ce décor d’édition.

## Preuve

- [`elce-anchor-extension.test.ts`](../src/app/editor/elce-anchor-extension.test.ts)
  vérifie la conversion JSON → `span` statique, les attributs de ciblage et
  la prise d’insertion déplaçable dans la surface Tiptap, ainsi que le rendu de
  l’image résolue dans la zone réservée.
- [`flux-scene-builder.test.ts`](../src/builders/flux-scene-builder.test.ts)
  vérifie que le builder dirige le perso image vers la part exportée par
  l’ancre sans générer un second hôte média.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie le montage de l’image dans le `span` d’ancrage par le runtime réel
  Sighty/CodPlay.
- [`anchor-drop-service.test.ts`](../src/domain/anchor-drop-service.test.ts)
  vérifie la whitelist, la construction du commandement et le passage par la
  façade métier.
- [`controller-machine.test.ts`](../src/app/controller/controller-machine.test.ts)
  vérifie que deux dépôts dont la sauvegarde IndexedDB est asynchrone restent
  ordonnés dans la machine XState et produisent chacun leur bdc et leur ancre.

Une vérification Safari sur l’application servie par Vite a déposé un SVG
valide dans une page neuve. Le `markup` restauré depuis IndexedDB contient une
seule ancre ; dans la prévisualisation complète, son rectangle et celui du
`img` CodPlay mesurent 645 × 483 px, soit le cadre 4:3 réservé par l’ancre.

## Limites

Les dépôts de références du catalogue, le retour visuel d’un bdc supprimé dans
la réserve et la réouverture d’un bdc dans l’espace isolé ne sont pas encore
implémentés. Le déplacement interne est exercé par le test de l’extension et
les commandes ; une preuve navigateur dédiée reste à ajouter dans l’étape 8.
