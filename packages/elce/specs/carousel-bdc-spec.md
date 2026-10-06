# Elcé — BDC Carousel et BDC Carte

## Statut

**Fixe — Carousel à enfants BDC Carte, modèle v3, implémenté et vérifié le
6 octobre 2026.** L’insertion du Carousel dans un BDC Texte et son emploi comme
conteneur de Diapo restent hors de cette tranche.

## Rôle et modèle métier

Le BDC Carousel est placé dans la séquence ordonnée des BDC d’une page Flux.
Il porte les réglages de présentation et référence une séquence ordonnée de
BDC Carte enfants. Les BDC Carte sont des entités métier identifiées, chacune
avec un parent unique ; ils ne figurent donc pas dans `page.bdcIds` ni dans le
catalogue. Les changements de layout ne créent pas un nouveau BDC.

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
les projettent dans les parts du preset.

## Édition

« Ajouter un bloc Carousel » crée le conteneur à la fin de la séquence de la
page Flux et ouvre son éditeur. Les changements passent par les commandes
XState et les services métier ; React ne conserve pas une seconde copie du
document.

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

## Projection et lecture

`ElceFluxSceneBuilder` conserve la place du Carousel dans la page Flux et lui
transmet les BDC du document. `ElceCarouselSceneBuilder` résout les IDs des
enfants dans `CarouselContent.cards`, puis délègue chaque carte à
`ElceCardBdcSceneBuilder`. `ElceCardPresetBuilder` reste propriétaire du
markup fixe de chaque layout. Les persos de texte et de média CodPlay ciblent
les parts générées pour le BDC Carte sélectionné.

`AutoCapsule` fournit le type Carousel et les transitions ;
`CapsuleDistribution` résout les plages construites depuis la durée commune et
les durées particulières. Le mode automatique ajoute les occurrences finies
dans `eventimes`. Les points émettent un événement CodPlay ; le strap et les
actions des persos changent l’état visible et la navigation. Aucun minuteur ni
état de lecture parallèle n’est ajouté dans React ou dans Elcé.

## Preuves

- [`document-commands.test.ts`](../src/app/commands/document-commands.test.ts)
  vérifie la conservation des champs et médias à travers les quatre layouts,
  le retrait d’une carte avec maintien de la dernière, le refus de supprimer
  cette dernière, le déplacement d’un BDC Carte vers un autre Carousel sans
  clonage, la suppression en cascade du Carousel avec conservation des médias,
  la fusion des médias référencés par une carte et le rejet des documents v1/v2.
- [`carousel-service.test.ts`](../src/domain/carousel-service.test.ts) vérifie
  l’ajout, le retrait, le réordonnancement des IDs et la conservation de la
  durée de chaque entrée lors du réordonnancement.
- [`app-layout.test.tsx`](../src/app/layout/app-layout.test.tsx) vérifie la
  création du Carousel, l’édition de cartes identifiées, leurs layouts et
  l’attachement de média par les commandes de l’éditeur.
- [`flux-scene-builder.test.ts`](../src/builders/flux-scene-builder.test.ts)
  vérifie la projection des BDC Carte, des champs visibles, des médias selon
  le layout et des plages Capsule, ainsi que dix passages automatiques
  supplémentaires finis ; CodPlay compile la scène.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  exécute le player réel en DOM de test : sélection manuelle, sélection durant
  l’automatique, avancement temporisé, répétition, arrêt sur la dernière carte
  et montage d’un média de carte.
- Brave DevTools, le 6 octobre 2026, vérifie sur l’application construite que
  l’auteur crée et ordonne des BDC Carte, édite les champs, change entre les
  quatre layouts sans perdre les valeurs, puis recharge l’éditeur. L’ordre,
  les relations parent/enfant, les layouts, les champs et le document v3 sont
  relus depuis IndexedDB. La preview distincte affiche les cartes et les points
  changent la carte active ; après synchronisation vers le mode automatique,
  le changement temporisé est observé. À 390 px, le cadre reste en ratio 16:9
  et la carte active conserve ses attributs visibles. Aucun média importé
  depuis un fichier n’a été vérifié dans ce parcours navigateur ; le montage
  média est couvert par les tests builder et player.
- Vérification du 6 octobre 2026 : typecheck réussi, 140 tests réussis dans
  20 fichiers et build réussi. Le build émet un avertissement sur le chunk
  JavaScript supérieur à 500 kB.
