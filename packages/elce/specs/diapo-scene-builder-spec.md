# Elcé — builder de scène Diapo

## Périmètre vérifié

Le builder projette une page Elcé de type `diapo` en scène CodPlay. La Diapo
contient au plus un BDC direct. Sa création propose un BDC Carousel ; l’auteur
peut le remplacer par un BDC Carte autonome ou un BDC Question (Quiz). Les
cartes d’un Carousel réutilisent les mêmes BDC Carte que dans une page Flux.

## Scène et lecture

`ElcePlayerComposition` envoie une page Flux à `buildFluxScene` et une Diapo à
`buildDiapoScene`. Une Carte autonome réutilise `ElceCardBdcSceneBuilder` ; un
Quiz réutilise le builder et la story Question. Ces pages utilisent l’hôte
plein cadre et le `scroll-container` de page Diapo.

Pour un BDC Carousel, `buildDiapoScene` adopte la story construite par le
builder Carousel comme story de la page. Sa racine unique est un
`scroll-container` CodPlay matérialisé en `section`. Il porte les rôles de
layout Diapo, de cadre Carousel, de grille Capsule et de conteneur observé par
le marqueur de fin. Les persos de carte ciblent directement cette racine ; la
navigation à points occupe une ligne distincte de sa grille. Le Carousel remplit
la Diapo et n’applique pas le ratio éditorial du Carousel Flux. Il n’y a donc
pas d’hôte de page ni de wrappers `frame` ou `completion-root` supplémentaires,
ni de classes résiduelles qui nommeraient ces anciens wrappers.
Les persos média sont réunis dans cette même story de page, qui conserve l’état
et les actions du Carousel.

Dans le layout Sighty, la région `content` et le slot de contenu sont le même
`section` : le slot reçoit l’identifiant, les classes et les attributs de la
région. La composition n’insère pas une seconde section entre cette région et
la racine Diapo Carousel.

Les layouts de Carte exposent leurs cibles CodPlay avec des commentaires HTML
`<!-- data-part="…" -->`. Le commentaire n’ajoute aucune boîte DOM. Un
conteneur reste dans le layout seulement s’il porte une fonction de grille,
cadrage média ou structure sémantique ; les champs texte sont insérés
directement sous leur conteneur utile. La page Diapo et son Carousel n’ajoutent
pas de balise intermédiaire uniquement pour donner une cible à un perso.

Pour une Question Diapo, le `header` de titre et le conteneur d’illustration
sont créés uniquement lorsque leurs contenus facultatifs sont renseignés. Le
formulaire, le `fieldset` et le groupe de réponses restent les structures
requises par la sélection et la validation natives.

La Carte autonome observe son marqueur de fin dans la story de page, sur le
`scroll-container` Diapo. Pour une Diapo Carousel, le marqueur de la dernière
Carte observe la racine `scroll-container` plein cadre, dans la même story que
les cartes. La vue masquée garde ce marqueur hors affichage ; sa présentation
le rend observable. Ce conteneur permet de reprendre le circuit d’observation
de Flux sans afficher de barre de défilement.

Dans une Carte Photo de Carousel Diapo, le `div.elce-carousel-photo__media`
conservé devient la racine visuelle de la vue : il porte son identifiant, les
classes de layout, de vue et de transition, ainsi que les ancres commentaire
CodPlay de racine et de média. L’`article` qui l’entourait est supprimé pour ce
cas. Le conteneur média CodPlay et son image native restent ses enfants. Cette
racine conserve l’emplacement où le layout pourra évoluer vers `<picture>` et
une légende ; le conteneur média vidéo peut accueillir des éléments `<track>`.
Le chemin image testé entre la région de contenu et l’élément `img` compte cinq
éléments : `section` de contenu, `section` Carousel, `div` racine Photo,
`div.elce-carousel-media`, puis `img.cp-img-inner`.

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
  vérifie les types de BDC acceptés, la story unique du Carousel Diapo, sa
  racine `scroll-container`, le placement direct des cartes et de la
  navigation, la racine Photo sans `article`, l’événement public, le marqueur
  de la dernière Carte et les commentaires d’insertion sans attribut
  `data-part` sur les éléments.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie le chemin player réel avec Sighty/CodPlay : le marqueur Carte et le
  Quiz émettent `elce:page:finished`, et la dernière vue d’un Carousel manuel
  publie le même nom et `{ pageId }`. Il vérifie également qu’une image liée à
  une Carte Carousel est montée dans la composition réelle d’une Diapo. Avec
  une page suivante, Sighty la déverrouille tandis que la scène Diapo reste
  montée. Il vérifie aussi que structure DOM et source de l’image restent
  identiques après navigation vers une autre page puis retour, que le replay
  réactive la première carte et que le chemin image compte au plus six éléments.
- Safari MCP, le 7 octobre 2026, initialise une nouvelle composition Sighty/
  CodPlay en mémoire avec un Carousel et une Carte Photo contenant une image.
  Le chemin entre la région de contenu et `img.cp-img-inner` compte cinq
  éléments ; l’image charge depuis sa ressource, les points changent de carte,
  une seule vue est visible et la console ne signale ni erreur ni avertissement.
  La grille répartit le cadre de la carte et la rangée de navigation en deux
  lignes distinctes.
- Brave DevTools sur le serveur de référence `5175`, le 6 octobre 2026 :
  le Carousel à deux vues garde « Suivant » verrouillé jusqu’à la sélection de
  la dernière vue ; la Carte autonome le déverrouille dès son affichage ; le
  Quiz le déverrouille après validation. Les trois parcours restent sur la
  Diapo et ne produisent aucune erreur console.
