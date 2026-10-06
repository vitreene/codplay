# Elcé — builder de scène Diapo

## Périmètre vérifié

Le builder projette une page Elcé de type `diapo` en scène CodPlay. La Diapo
contient au plus un BDC direct. Sa création propose un BDC Carousel ; l’auteur
peut le remplacer par un BDC Carte autonome ou un BDC Question (Quiz). Les
cartes d’un Carousel réutilisent les mêmes BDC Carte que dans une page Flux.

## Scène et lecture

`ElcePlayerComposition` envoie une page Flux à `buildFluxScene` et une Diapo à
`buildDiapoScene`. Le builder Diapo place le contenu dans un hôte plein cadre
sans défilement visible. Une Carte autonome réutilise
`ElceCardBdcSceneBuilder` ; un Quiz réutilise le builder et la story Question.
Le Carousel garde sa story propre et la séquence de cartes qu’il porte. Sa
projection en Diapo remplit la scène au lieu d’appliquer le ratio éditorial du
Carousel Flux.

La Carte autonome observe son marqueur de fin dans la story de page, sur le
`scroll-container` Diapo. Pour une Diapo Carousel, le
marqueur de la dernière Carte observe un `scroll-container` plein cadre dans la
même story que lui. La vue masquée garde ce marqueur hors affichage ; sa
présentation le rend observable. Ce conteneur permet de reprendre le circuit
d’observation de Flux sans afficher de barre de défilement.

## Fin fonctionnelle de Diapo

Chaque variante publie exactement le signal public déjà employé par les pages
Flux :

- nom transmis à Sighty : `elce:page:finished` (`ELCE_EVENTS.PAGE_FINISHED`) ;
- données : `{ pageId }` ;
- visibilité : `public`.

La Carte le publie dès que son marqueur entre dans le viewport ; le Quiz après
validation, que la réponse soit correcte ou non ; le Carousel lorsque sa
dernière Carte apparaît. Les Pages Flux publient le même nom lorsqu’elles
atteignent leur marqueur de fin.
`buildScenario` transmet ce signal à l’action Sighty existante qui marque la
page comme terminée et met à jour le verrouillage de la navigation. Le signal
ne déclenche pas lui-même la navigation. La scène reste montée et peut
continuer à être lue. `scene:end` et `sequence:end` ne servent pas à cette fin
fonctionnelle.

## Preuves

- [`diapo-scene-builder.test.ts`](../src/builders/diapo/diapo-scene-builder.test.ts)
  vérifie les types de BDC acceptés, le conteneur sans défilement visible,
  l’événement public, le marqueur de la dernière Carte et la plage automatique
  finale.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie le chemin player réel avec Sighty/CodPlay : le marqueur Carte et le
  Quiz émettent `elce:page:finished`, et la dernière vue d’un Carousel manuel
  publie le même nom et `{ pageId }`. Avec une page suivante, Sighty la
  déverrouille tandis que la scène Diapo reste montée.
- Brave DevTools sur le serveur de référence `5175`, le 6 octobre 2026 :
  le Carousel à deux vues garde « Suivant » verrouillé jusqu’à la sélection de
  la dernière vue ; la Carte autonome le déverrouille dès son affichage ; le
  Quiz le déverrouille après validation. Les trois parcours restent sur la
  Diapo et ne produisent aucune erreur console.
