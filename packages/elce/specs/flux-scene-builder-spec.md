# Elcé — builder de scène Flux

## Statut

**En cours — projection Flux et scénario racine mixte construits ; la
structure du graphe et de l’ordre est vérifiée. La navigation visible entre
un chapitre et une page racine reste à valider dans le player.**

L’observation du repère et le parcours dans un navigateur restent la preuve
d’intégration visuelle de la tranche 2 du plan.

Le parcours complet du slot inline et du montage du perso média est détaillé
dans la [spécification d’intégration CodPlay](./codplay-anchor-integration-spec.md).
Le montage d’un Carousel dans la séquence Flux est décrit dans la
[spécification du BDC Carousel](./carousel-bdc-spec.md).

## Contrat

`buildFluxScene(page, bdcs)` accepte une page Elcé de type `flux` et sa séquence
ordonnée de BDC Texte, Question, Image, Vidéo ou Carousel. Une page Question n’a pas
besoin d’un BDC Texte. Une source média optionnelle peut être fournie séparément par
`mediaSources`; un bdc image ou vidéo simple produit alors un hôte de média et
un seul perso CodPlay correspondant, directement dans la story de page afin que
son observation utilise le même `scroll-container`. Lorsqu’une Section exporte
une ancre `data-elce-anchor` dont le `data-bdc-id` désigne ce bdc, le builder lit
sa cible logique puis projette le markup en remplaçant l’ancre d’édition par un
slot de flux inline à largeur nulle. Le perso image ou vidéo est monté dans la
part `data-part` de ce slot et aucun hôte frère n’est ajouté. Le slot porte un
`anchor-name` CSS ; le perso reçoit le même `position-anchor`, une position
absolue, une largeur de `100 %`, son ratio et la marge
`ANCHOR.DEFAULT_BDC_MARGIN_TOP`. La variable CSS du slot conserve le ratio ;
le builder fournit aussi à `layout.initial.flowReservations` cette part et la
hauteur `calc(ratio + marge haute + marge basse)`. Le layout CodPlay déplace la
part après la ligne visuelle et applique cette réserve au montage et au
changement de largeur. La règle inline initiale `margin-inline-end:100%` est
supplantée par ce calcul. Pour une image ancrée, la valeur conservée dans le
padding donne le ratio du cadre et de la réserve ; le perso image utilise
`object-fit:cover`. Il produit un
`SceneDoc` avec :

- un perso `scroll-container` racine, placé sur `@root` ;
- un perso `layout` article, placé dans ce scrollport, dont le markup possède
  des `id` explicites et des parts `data-part` pour chaque Section et pour le
  repère bas ;
- chaque Section consomme le preset `section-basic` déclaré dans la
  configuration. `ElceCardPresetBuilder` instancie son architecture HTML fixe
  avec des `id` et parts propres au BDC ; le texte HTML statique de Tiptap est
  monté dans la zone body, après l’hôte de titre. Le perso titre vise sa part,
  ce qui conserve l’ordre titre puis texte de l’éditeur ;
- l’article occupe au minimum toute la zone de contenu et sa hauteur augmente
  avec le texte, tandis que le scrollport porte le défilement ;
- un perso marqueur observant le scrollport et émettant l’événement public
  `elce:page:finished` avec l’identifiant de page ; la déclaration demande aussi
  `initial: 'enter'` pour qu’un repère déjà visible signale immédiatement la
  fin d’une page courte ;
- une story de page et une story par Section, les stories donnant accès aux
  persos mais ne constituant pas des éléments DOM.

Un BDC Carousel utilise `ElceCarouselSceneBuilder` pour produire le markup du
preset `carousel-basic`, une story dédiée et ses persos média. Le markup reste
à sa place dans l’ordre des BDC de la page. Le builder résout les BDC Carte
enfants à partir des identifiants ordonnés dans le Carousel ; les cartes ne
figurent pas dans `page.bdcIds`. `ElceCardBdcSceneBuilder` projette chaque
enfant avec son layout, ses champs visibles et son média compatible. Les
plages, événements et la navigation sont définis dans la
[spécification du BDC Carousel](./carousel-bdc-spec.md).

Les cibles de montage restent des identifiants de persos/parts CodPlay. La
projection n’ajoute pas de player ou de routeur local. L’émission initiale du
repère est portée par la déclaration `initial: 'enter'` du composant scroll et
suit le même événement public que les transitions de défilement.

`buildFluxScene` accepte explicitement les pages Flux et rejette les pages
Diapo, qui relèvent de leur builder distinct. `ElcePlayerComposition` distribue
les types de page vers ces deux builders ; le contrat Diapo est décrit dans la
[spécification de son builder](./diapo-scene-builder-spec.md). L’exhaustivité
du `switch` Flux force l’ajout d’un cas lorsque `PageType` évolue.

`buildScenario(document, scenes)` construit séparément le graphe Sighty avec
le layout à la racine et ses slots persistants `slot-menu`, `slot-title`,
`slot-content` et `slot-navigation`. À la racine du scénario, une seule
séquence de vues reprend `scenarioEntries` dans son ordre. Chaque page
autonome et chaque chapitre sont des entrées sœurs : une page autonome ouvre
sa scène dans `slot-content`, tandis qu’un chapitre ouvre dans ce slot le
graphe ordonné de ses pages. L’ordre des pages de lecture est dérivé de cette
séquence et des listes internes des chapitres. Un chapitre n’est pas une page
supplémentaire. Les scènes du menu, du titre et de la navigation sont des
scènes CodPlay distinctes. Le sommaire emploie le même ordre racine : il rend
les pages autonomes comme entrées simples et les pages d’un chapitre sous
l’entrée du chapitre. Les pages du catalogue ne sont jamais intégrées au
scénario. Quand aucune page n’est placée, le builder projette une vue vide
explicite afin que le cadre reste montable.

Chaque route de page pointe vers son entrée racine, puis vers la page dans
`slot-content`. Cela permet au menu et au démarrage de viser une page précise
sans changer le document métier. Le builder produit la structure ordonnée et
les routes ; la transmission d’un clic public CodPlay au routeur Sighty reste
un point d’intégration à valider.

Le graphe reprend le circuit de la démo 5 : les boutons émettent des
événements publics, Sighty route les passages `next`/`previous` et les
sélections du menu, et le repère bas d’une page Flux alimente le contexte de
progression. Le titre, l’état du menu et les boutons de navigation sont
actualisés par des événements adressés aux persos de leurs scènes ; le
composant scroll porte aussi la politique déclarative d’émission initiale.

`ElcePlayerComposition` instancie le runtime Sighty avec les définitions
optionnelles `scroll-container`, compile le catalogue de scènes fourni par le
builder et démarre la scène de layout. Aucun gestionnaire de géométrie Elcé ne
réintervient après le montage : le runtime CodPlay place le perso dans le slot
et le composant `layout` recalcule la position de ce slot. Le circuit de navigation Sighty reste
inchangé.

Les contrats de sortie sont isolés dans
[`flux-scene-builder-types.ts`](../src/builders/flux-scene-builder-types.ts) et
[`scenario-builder-types.ts`](../src/builders/scenario-builder-types.ts) ; les
builders ne déclarent que leur comportement d’exécution.

## Preuves

- [`flux-scene-builder.test.ts`](../src/builders/flux-scene-builder.test.ts)
  vérifie les stories, le scrollport, les parts et la compilation avec les
  définitions réelles `scroll-container` de CodPlay, ainsi que le montage
  d’un bdc image simple vers un seul perso `img`, y compris son montage sur la
  part du slot projeté depuis une ancre exportée. Il vérifie aussi la
  projection des BDC Carte identifiés par leur Carousel parent, leurs champs,
  leurs médias selon le layout et les plages automatiques finies.
- [`card-preset-builder.test.ts`](../src/builders/card-preset-builder.test.ts)
  vérifie l’instanciation du preset Section et l’identité des parts utilisées
  par le builder Flux. Les presets Question, image-légende et Message sont
  configurés mais ne sont pas encore projetés dans une page.
- `PlayerPreview` fournit la preuve navigateur dans l’application : le dépôt
  réel depuis `SectionEditor` passe par XState, puis la preview monte le
  builder, Sighty et CodPlay avec le slot projeté.
- Safari confirme le 3 octobre 2026 qu’un MP4 réel déposé dans `SectionEditor`
  passe par XState, survit au rechargement et se monte comme perso `media` dans
  la part du slot d’ancre. Le cadre reste en `16 / 9` avec une réserve de
  `56.25%` ; la source testée mesure `442 × 300 px` pour `5,89 s`. Le cadrage
  diffère actuellement entre l’éditeur (`contain`) et le player (`cover`).
- [`scenario-builder.test.ts`](../src/builders/scenario-builder.test.ts)
  vérifie les scènes persistantes, le graphe Sighty, les routes, l’ordre racine
  mélangé des entrées page/chapitre, le menu correspondant, et l’exclusion des
  pages du catalogue.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie le montage réel du cadre complet, du menu, du titre, de la
  navigation, du slot et de la page Flux par Sighty et CodPlay dans un DOM de
  test, ainsi que
  le montage d’un bdc image simple avec le composant `img` réel, d’une image
  dans une ancre de texte, d’un bdc vidéo avec le composant `media`, et d’un
  média de carte selon son layout dans le player.
