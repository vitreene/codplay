# Elcé — builder de scène Flux

## Statut

**Fixe — projection Flux et montage Sighty/CodPlay implémentés et vérifiés.**

L’observation du repère et le parcours dans un navigateur restent la preuve
d’intégration visuelle de la tranche 2 du plan.

## Contrat

`buildFluxScene(page, bdcs)` accepte une page Elcé de type `flux` et ses bdc
Section. Une source média optionnelle peut être fournie séparément par
`mediaSources`; un bdc image ou vidéo simple produit alors un hôte de média et
un seul perso CodPlay correspondant, directement dans la story de page afin que
son observation utilise le même `scroll-container`. Lorsqu’une Section exporte
une ancre `data-elce-anchor` dont le `data-bdc-id` désigne ce bdc, le builder
réutilise la part `data-part` de l’ancre et n’ajoute pas d’hôte frère. Il produit
un `SceneDoc` avec :

- un perso `scroll-container` racine, placé sur `@root` ;
- un perso `layout` article, placé dans ce scrollport, dont le markup possède
  des `id` explicites et des parts `data-part` pour chaque Section et pour le
  repère bas ;
- chaque Section contient un hôte de titre avant son markup HTML statique ; le
  perso de titre est monté dans cet hôte afin de conserver l’ordre titre puis
  texte de l’éditeur ;
- l’article occupe au minimum toute la zone de contenu et sa hauteur augmente
  avec le texte, tandis que le scrollport porte le défilement ;
- un perso marqueur observant le scrollport et émettant l’événement public
  `elce:page:bottom` avec l’identifiant de page ; la déclaration demande aussi
  `initial: 'enter'` pour qu’un repère déjà visible signale immédiatement la
  fin d’une page courte ;
- une story de page et une story par Section, les stories donnant accès aux
  persos mais ne constituant pas des éléments DOM.

Les cibles de montage restent des identifiants de persos/parts CodPlay. La
projection n’ajoute pas de player ou de routeur local. L’émission initiale du
repère est portée par la déclaration `initial: 'enter'` du composant scroll et
suit le même événement public que les transitions de défilement.

La résolution du type de page est explicite : Flux est envoyé vers ce builder
et Diapo produit une erreur dédiée tant que son builder n’est pas implémenté.
L’exhaustivité du `switch` force l’ajout d’un cas lorsque `PageType` évolue.

`buildScenario(document, scenes)` construit séparément le graphe Sighty avec
le layout à la racine et ses slots persistants `slot-menu`, `slot-title`,
`slot-content` et `slot-navigation`. Le graphe de scénario contient une
entrée dédiée au slot des pages racine, puis une entrée par chapitre ; ces
entrées sont au même niveau. Chaque entrée de chapitre ouvre le graphe de son
slot de contenu sur sa première page. Un chapitre n’est donc pas une page
supplémentaire. Les scènes du menu, du titre et de la navigation sont des
scènes CodPlay distinctes ; les pages racine sont les vues du slot racine et
les pages de chapitre celles du slot du chapitre. Les pages du catalogue ne
sont jamais intégrées au scénario. Quand aucune page n’est placée, le builder
projette une vue vide explicite afin que le cadre reste montable.

Le graphe reprend le circuit de la démo 5 : les boutons émettent des
événements publics, Sighty route les passages `next`/`previous` et les
sélections du menu, et le repère bas d’une page Flux alimente le contexte de
progression. Le titre, l’état du menu et les boutons de navigation sont
actualisés par des événements adressés aux persos de leurs scènes ; le
composant scroll porte aussi la politique déclarative d’émission initiale.

`ElcePlayerComposition` instancie le runtime Sighty avec les définitions
optionnelles `scroll-container`, compile le catalogue de scènes fourni par le
builder et démarre la scène de layout. Il conserve le circuit de navigation
Sighty ; aucun contrôle géométrique ni dispatch local n’est ajouté au player
Elcé.

Les contrats de sortie sont isolés dans
[`flux-scene-builder-types.ts`](../src/builders/flux-scene-builder-types.ts) et
[`scenario-builder-types.ts`](../src/builders/scenario-builder-types.ts) ; les
builders ne déclarent que leur comportement d’exécution.

## Preuves

- [`flux-scene-builder.test.ts`](../src/builders/flux-scene-builder.test.ts)
  vérifie les stories, le scrollport, les parts et la compilation avec les
  définitions réelles `scroll-container` de CodPlay, ainsi que le montage
  d’un bdc image simple vers un seul perso `img`, y compris son montage sur une
  part d’ancre exportée.
- [`scenario-builder.test.ts`](../src/builders/scenario-builder.test.ts)
  vérifie la présence des scènes persistantes, du graphe Sighty et du layout
  complet de slots.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie le montage réel du cadre complet, du menu, du titre, de la
  navigation, du slot et de la page Flux par Sighty et CodPlay dans un DOM de
  test, ainsi que
  le montage d’un bdc image simple avec le composant `img` réel, d’une image
  dans une ancre de texte et d’un bdc vidéo avec le composant `media`.
