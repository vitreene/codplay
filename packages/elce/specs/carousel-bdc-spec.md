# Elcé — BDC Carousel et BDC Carte

## Statut

**Fixe — Carousel à enfants BDC Carte, modèle v4, implémenté et vérifié le
7 octobre 2026.** L’insertion du Carousel dans un BDC Texte reste hors de cette
tranche. Son emploi comme BDC par défaut d’une Diapo est décrit dans la
[spécification du builder Diapo](./diapo-scene-builder-spec.md).

## Rôle et modèle métier

Dans une page Flux, le BDC Carousel occupe une place dans la séquence ordonnée
des BDC. Dans une page Diapo, il peut occuper l’unique emplacement BDC direct.
Dans les deux cas, il porte les réglages de présentation et référence une
séquence ordonnée de BDC Carte enfants. Chaque Carte enfant a le Carousel comme
parent ; elle ne figure donc pas dans `page.bdcIds` ni dans le catalogue. Le
même modèle BDC Carte peut aussi être placé directement comme unique BDC d’une
Diapo ; cette Carte autonome n’a pas de parent Carousel et figure alors dans
`page.bdcIds`. Aucun BDC Carte n’est placé au catalogue. Les changements de
layout ne créent pas un nouveau BDC.

`CarouselContent` contient la durée commune, le mode manuel ou automatique, le
nombre fini de répétitions, le ratio, la transition et les entrées
`{ bdcId, durationMs }`. La durée particulière appartient à l’entrée du
Carousel ; `null` signifie que la durée commune s’applique. Un Carousel doit
contenir au moins un BDC Carte.

Chaque BDC Carte porte dans `card` tous les champs : surtitre (`overline`),
titre, description, message (250 caractères maximum), note, légende et
position de l’image. Son `presetId` sélectionne l’un des layouts configurés :
Texte court, Texte avec image, Photo ou vidéo plein cadre, ou Image avec
légende. Les champs et `mediaId` restent conservés lorsqu’un layout ne les
projette pas. Photo ou vidéo plein cadre accepte une image ou une vidéo ; Texte
avec image et Image avec légende acceptent une image ; Texte court ne projette
aucun média. Une image ou vidéo référencée est une ressource du catalogue,
indépendante et réutilisable ; les règles d’import et de projection dépendent
du layout actif.

Ces quatre layouts sont les seuls layouts Carte enregistrés dans
`CARD_PRESETS`. Un ancien preset statique « Message » n’était proposé ni par
l’éditeur ni par le builder Carte et a été retiré ; les champs de texte court
restent dans le preset Texte court prévu à cet effet.

À la création du Carousel, la même commande crée son premier BDC Carte
identifié en layout Texte court. Un BDC Carte peut être déplacé vers un autre
Carousel par le placement parent existant : son identifiant, son layout, ses
champs et son média sont conservés ; l’entrée du Carousel de destination reçoit
sa durée par défaut (`null`). Le déplacement est refusé si le Carousel source
deviendrait vide, car chaque Carousel conserve au moins une carte. La suppression
d’un Carousel supprime ses BDC Carte enfants, mais conserve les ressources
média. La suppression d’une carte unitaire est également refusée lorsqu’elle
laisserait son Carousel vide.

Le preset `carousel-basic` fournit le cadre responsive et sa navigation. Le
Carousel n’ajoute ni un format de page Diapo ni une story CodPlay au modèle
métier. Les contenus des cartes restent des données de BDC Elcé ; les builders
les projettent dans les parts du preset. La Carte directe de Diapo et ses
restrictions sont décrites dans la [spécification du builder Diapo](./diapo-scene-builder-spec.md).

## Édition

« Ajouter un bloc Carousel » crée le conteneur à la fin de la séquence de la
page Flux et ouvre son éditeur. Les changements passent par les commandes
XState et les services métier ; React ne conserve pas une seconde copie du
document.

`EditorActionsFacade` (`app/facades/editor-actions-facade.ts`) expose les
intentions Carousel et Carte à l’éditeur, puis délègue aux façades existantes.
`ElceCarouselFacade` (`app/facades/carousel/`) orchestre les réglages du
Carousel et délègue les champs des Cartes à `ElceCardFacade`
(`app/facades/card/`). Les mêmes actions de Carte servent au BDC direct d’une
Diapo et aux Cartes enfants du Carousel.

L’auteur peut ajouter, supprimer et réordonner les BDC Carte, choisir leur
layout, éditer les champs communs, la position d’image, la référence média et
la durée propre à chaque entrée. Les quatre layouts utilisent le même BDC
Carte. Les valeurs masquées restent éditables après retour à un layout qui les
affiche. Les médias arrivent depuis le catalogue ou l’import existant ; aucun
nouveau circuit média n’est créé.

Le Carousel règle aussi le mode, la durée commune, le ratio, la transition et
le nombre de passages automatiques supplémentaires. Les valeurs initiales
sont définies dans `CAROUSEL_CONFIG` : mode manuel, ratio 16:9, durée de cinq
secondes, dix répétitions supplémentaires et fondu. Le nombre de répétitions va
de 0 à 10 ; 0 correspond à un passage. En lecture automatique, une durée
particulière remplace la durée commune pour l’entrée concernée. Les points
permettent de sélectionner une carte dans les deux modes ; en automatique, la
séquence temporisée continue après la sélection.
Dans l’éditeur, les réglages du Carousel restent sur une rangée unique.

## Projection et lecture

`ElceFluxSceneBuilder` conserve la place du Carousel dans la page Flux et lui
transmet les BDC du document. `ElceCarouselSceneBuilder` résout les IDs des
enfants dans `CarouselContent.cards`, puis délègue chaque carte à
`ElceCardBdcSceneBuilder`. `ElceCardPresetBuilder` reste propriétaire du
markup fixe de chaque layout. Les persos de texte et de média CodPlay ciblent
les ancres commentaire `<!-- data-part="…" -->` générées pour le BDC Carte
sélectionné. Les champs texte sont insérés directement sous leur élément
parent comme `h2`, paragraphe ou `footer`, avec leur classe de style issue du
preset ; aucun élément texte vide ne les enveloppe. Les conteneurs de cadre,
de média et de groupe restent lorsque le CSS ou la sémantique en a besoin, et
portent le commentaire à l’intérieur.

En Flux, la racine Carousel `section` contient directement la Capsule et la
navigation `nav`. Le point de montage `frame` est un commentaire avant la
Capsule ; il n’ajoute pas de `div` et n’a pas de règle CSS propre. En Diapo, la
Capsule et la navigation sont montées directement sur le `scroll-container`
racine. La carte Photo conserve
son conteneur média afin que ce même emplacement puisse évoluer vers
`<picture>` et une légende ; la vidéo peut y recevoir des éléments `<track>`.

Dans un Carousel Flux, le perso layout porte l’article racine de la carte. Le
builder ajoute à cet article la classe racine fournie par le preset, avec les
classes de la vue Capsule, afin que les styles s’appliquent au nœud matérialisé.
Dans un Carousel Diapo, une Carte Photo conserve son `div` média comme racine
visuelle de la vue ; le builder y porte l’identifiant et les classes de layout,
de vue et de transition. Ce cas n’ajoute pas l’`article` externe. La racine
Photo garde les ancres commentaire CodPlay de racine et de média. Elle est
conservée comme emplacement futur pour un rendu `<picture>` et une légende ;
le conteneur vidéo reste disponible pour de futurs éléments `<track>`.

Les zones de média et l’image native sont dimensionnées à 100 % de leur
conteneur ; `object-fit` règle le cadrage `cover` ou `contain` sur l’image.
L’image ne conserve donc pas ses dimensions intrinsèques au-delà du cadre.
Pour une Diapo, le marqueur de fin cible un commentaire dans la carte finale ;
la racine Carousel plein cadre utilise elle aussi son commentaire d’insertion.
Ces marqueurs n’ajoutent pas de boîtes DOM. Dans le chemin vérifié Safari d’une
image Photo de Carousel Diapo, les cinq éléments depuis la région de contenu
sont : la région `section`, la racine Carousel `section`, la racine Photo
`div`, le conteneur média CodPlay `div`, et `img.cp-img-inner`.

`AutoCapsule` fournit le type Carousel et les transitions ;
`CapsuleDistribution` résout les plages construites depuis la durée commune et
les durées particulières. Le mode automatique ajoute les occurrences finies
dans `eventimes`. Les points émettent un événement CodPlay ; le strap et les
actions des persos changent l’état visible et la navigation. Aucun minuteur ni
état de lecture parallèle n’est ajouté dans React ou dans Elcé.

## Preuves

- [`document-commands.test.ts`](../src/domain/commands/document-commands.test.ts)
  vérifie la conservation des champs et médias à travers les quatre layouts,
  le retrait d’une carte avec maintien de la dernière, le refus de supprimer
  cette dernière, le déplacement d’un BDC Carte vers un autre Carousel sans
  clonage, la suppression en cascade du Carousel avec conservation des médias,
  la fusion des médias référencés par une Carte et le rejet des documents
  v1/v2/v3.
- [`carousel-service.test.ts`](../src/domain/carousel/carousel-service.test.ts) vérifie
  l’ajout, le retrait, le réordonnancement des IDs et la conservation de la
  durée de chaque entrée lors du réordonnancement.
- [`app-layout.test.tsx`](../src/app/layout/app-layout.test.tsx) vérifie la
  création du Carousel, l’édition de cartes identifiées, leurs layouts et
  l’attachement de média par les commandes de l’éditeur.
- [`flux-scene-builder.test.ts`](../src/builders/flux/flux-scene-builder.test.ts)
  vérifie la projection des BDC Carte, des champs visibles, des médias selon
  le layout, les commentaires d’insertion et les plages Capsule, ainsi que dix
  passages automatiques supplémentaires finis ; CodPlay compile la scène.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  exécute le player réel en DOM de test : sélection manuelle, sélection durant
  l’automatique, avancement temporisé, répétition, arrêt sur la dernière carte,
  montage d’un média de carte et conservation de la structure et de la ressource
  Photo après navigation de page et retour.
- Brave DevTools, le 6 octobre 2026, vérifie sur l’application construite que
  l’auteur crée et ordonne des BDC Carte, édite les champs, change entre les
  quatre layouts sans perdre les valeurs, puis recharge l’éditeur. L’ordre,
  les relations parent/enfant, les layouts, les champs et le document v4 sont
  relus depuis IndexedDB. La preview distincte affiche les cartes et les points
  changent la carte active ; après synchronisation vers le mode automatique,
  le changement temporisé est observé. À 390 px, le cadre reste en ratio 16:9
  et la carte active conserve ses attributs visibles. Aucun média importé
  depuis un fichier n’a été vérifié dans ce parcours navigateur ; le montage
  média est couvert par les tests builder et player.
- Après la correction du 6 octobre 2026, Brave mesure en mode Photo/vidéo
  plein cadre l’article, l’hôte média et l’image à 916 × 515 px sur ordinateur,
  puis 298 × 168 px à 390 px de largeur. `scrollWidth` et `scrollHeight` restent
  égaux aux dimensions du cadre ; l’image conserve le cadrage `contain`. La
  validation visuelle des trois autres layouts reste suivie dans le plan actif.
- Vérification du 6 octobre 2026 : typecheck réussi, 140 tests réussis dans
  20 fichiers et build réussi. Le build émet un avertissement sur le chunk
  JavaScript supérieur à 500 kB.
- Vérification du 7 octobre 2026 : Safari MCP monte une composition réelle
  Sighty/CodPlay avec un Carousel Flux, une Carte Photo et une Carte Texte.
  La Capsule et la navigation sont les deux enfants directs de la racine ; le
  wrapper `.elce-carousel__frame` est absent. Le cadre mesure `686 × 386 px`
  avec `aspect-ratio: 16 / 9`, l’image charge, et un clic sur le second point
  change `aria-current` de `[true, false]` à `[false, true]`.
