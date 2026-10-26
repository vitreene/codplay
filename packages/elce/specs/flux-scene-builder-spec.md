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

Les vidéos sont projetées comme `media` avec `sync: 'independent'` et leurs
contrôles/broadcasts existants. Le temps CodPlay ne conduit pas leur lecture.
Le `STOP` de sortie de page appartient à la composition du lecteur, décrit
dans la [spécification preview](./player-preview-spec.md#lecture-des-vidéos-et-sortie-de-page).

`buildFluxScene(page, bdcs)` accepte une page Elcé de type `flux` et sa séquence
ordonnée de BDC Section, Question, Résultat, Carte, Graphe ou
Carousel, selon les contextes autorisés. Une Carte porte sa référence média dans `card.mediaId` ;
son rendu image ou vidéo vient du MIME de cette ressource. Les Cartes peuvent
être des BDC directs de la page ou des enfants d’une Section ou d’un Carousel.
Une Carte ancrée appartient à sa Section et n’est pas un BDC direct de page.
Dans le Flux, les BDC de premier niveau sont séparés par un `gap` de `2.5rem`.
Ce rythme extérieur ne change pas les espacements typographiques à l’intérieur
des BDC.
Une source média optionnelle peut être fournie séparément par `mediaSources` ;
le builder projette la Carte par son preset et monte son perso média dans la
cible correspondante. Dans le markup de layout, les points d’insertion CodPlay
utilisent des commentaires `<!-- data-part="…" -->`. Les conteneurs qui portent
une fonction visuelle ou sémantique restent autour du commentaire. Lorsqu’une
Section exporte une ancre `data-elce-anchor`
dont le `data-bdc-id` désigne cette Carte, le builder lit
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

Les racines absolues des Cartes et Graphes ancrés ont `z-index: 1`. Le média
reste ainsi la cible du pointeur dans son cadre, même si la boîte du bloc de
texte suivant recouvre géométriquement la réserve du slot. La Section conserve
le placement et le flux du texte ; aucun écouteur DOM local n’est ajouté.

Un Graphe ancré utilise ce même slot et cette réservation Flux. Le
mode Tableau garde sa hauteur naturelle et réserve `100%` de la largeur du
slot ; les rendus SVG réservent `56.25%`. Aucun hôte parallèle n’est ajouté.

Une Carte Photo plein cadre partage le même builder média en placement direct,
ancré ou enfant de Carousel. Pour une vidéo, le perso CodPlay porte la classe
`elce-carousel-media` sur son conteneur ; la feuille player dimensionne la
vidéo native à `100%` de largeur et de hauteur avec `object-fit:cover`. Elle
remplit ainsi le logement responsive de la Carte au lieu de conserver sa taille
intrinsèque. La règle CSS est incluse dans le package exporté via la feuille du
layout Sighty.

Avant la projection d’une page, `ElceEditorSettingsResolver` résout les valeurs
effectives à partir des défauts enregistrés au projet et des réglages portés par
les BDC parents et les placements Carousel. Une valeur `null` hérite du parent,
indépendamment pour l’entrée et la sortie. La même résolution est utilisée par
la preview et l’export de scénario. Les valeurs système non exposées et les
valeurs initiales de projet sont regroupées dans
[`editor-settings.ts`](../src/config/editor-settings.ts) ; la résolution est
regroupée dans
[`editor-settings-resolver.ts`](../src/domain/editor-settings/editor-settings-resolver.ts).
Les builders reçoivent `ElceResolvedPageSettings` et ne choisissent pas de
défaut ni de priorité. Les autres réglages cachés du player suivent le même
contrat décrit dans la [spécification de résolution](./editor-settings-spec.md).

Les racines de Carte observent le scrollport dans la zone résolue
`threshold: 0`, comme la révélation d’image de
la démo scroll-container. La première mesure synchronise la phase sans lancer
d’animation ; une Carte déjà visible au chargement reste donc dans son état
stable. Pour une Carte avec média, la racine observée garde une géométrie fixe ;
le perso image ou vidéo enfant porte le style de repos et les actions Capsule
d’entrée/sortie. L’observer ne mesure donc pas un élément que sa propre
translation déplacerait. Chaque passage ultérieur vers l’intérieur ou
l’extérieur rejoue l’action correspondante, y compris après un aller-retour ;
aucun événement `once` n’est déclaré. Une Carte sans média conserve ses actions
sur sa racine. Le défaut des nouveaux projets est la paire Capsule `swipe-right` ; les
remplacements enregistrés sur le parent ou le placement restent prioritaires.
Les racines de Graphe ancré gardent
`initial: 'enter'` pour signaler un graphe déjà visible.

- un perso `scroll-container` racine, placé sur `@root` ;
- un perso `layout` article, placé dans ce scrollport, dont le markup possède
  des `id` explicites et des commentaires d’insertion pour chaque Section et le
  repère bas ;
- chaque Section consomme le preset `section-basic` déclaré dans la
  configuration. `ElceCardPresetBuilder` instancie son architecture HTML fixe
  avec des `id` propres au BDC. Le titre est inséré comme un vrai `h2` par son
  commentaire, avant le conteneur body qui porte le HTML statique de Tiptap ;
  le conteneur body reste une zone de contenu, pas un hôte pour un second
  paragraphe ;
- l’article occupe au minimum toute la zone de contenu et sa hauteur augmente
  avec le texte, tandis que le scrollport porte le défilement ;
- le scrollport n’impose pas de snap CSS. Le défilement des BDC reste natif et
  libre, notamment lorsqu’un BDC dépasse la hauteur du viewport. Aucun
  `scroll-snap-type`, `scroll-snap-align` ou gestionnaire de snap JavaScript
  n’est ajouté au Flux. Le scrollport contient aussi le chaînage vertical aux
  limites avec `overscroll-behavior-y: contain` : atteindre le début ou le bas
  du contenu ne fait pas défiler le document qui héberge le player ;
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
figurent pas dans `page.bdcIds`. Le Carousel monte capsule, cartes et
navigation sur des commentaires d’insertion. `ElceCardBdcSceneBuilder` projette
chaque enfant avec son layout, ses champs visibles et son média compatible.
Les champs texte sont insérés directement comme `h2`, paragraphe ou `footer` ;
leurs classes de style sont fournies par le preset, sans élément texte vide qui
les enveloppe. Les conteneurs média restent lorsqu’ils définissent le cadrage
ou la zone de grille. Les plages, événements et la navigation sont définis dans la
[spécification du BDC Carousel](./carousel-bdc-spec.md).

Les champs facultatifs vides ne créent pas de perso ni de balise. Les ancres
des champs restent des commentaires ; le titre vide d’une Section ne produit
pas de `h2`. La racine Carousel contient directement son hôte Capsule et la
navigation : le commentaire `frame` n’est pas une boîte de mise en page.

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

Les régions de layout, le tiroir du menu, ses lignes et la navigation gardent
leurs conteneurs utiles et exposent leurs cibles par commentaires CodPlay. Les
anciens éléments vides réservés aux boutons, titres, pages et statuts ne sont
pas ajoutés.

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
[`flux-scene-builder-types.ts`](../src/builders/flux/flux-scene-builder-types.ts) et
[`scenario-builder-types.ts`](../src/builders/scenario/scenario-builder-types.ts) ; les
builders ne déclarent que leur comportement d’exécution.

## Preuves

- [`flux-scene-builder.test.ts`](../src/builders/flux/flux-scene-builder.test.ts)
  vérifie les stories, le scrollport, les commentaires d’insertion et la compilation avec les
  définitions réelles `scroll-container` de CodPlay, ainsi que le montage
  d’une Carte directe vers son perso image ou vidéo, ainsi que le montage d’une
  Carte enfant dans le slot projeté depuis une ancre exportée. Il vérifie aussi la
  priorité de ciblage du média ancré (`z-index: 1`), la projection des BDC Carte identifiés par leur Carousel parent, leurs champs,
  leurs médias selon le layout et les plages automatiques finies.
- [`statistical-graph-placements.test.ts`](../src/builders/statistical-graph/statistical-graph-placements.test.ts)
  vérifie les placements Graphe direct Flux et ancré en Section par les
  builders réels, le `z-index` de sa racine ancrée, ainsi que l’état initial
  `enter` du Graphe ancré.
- [`flux-scene-builder.test.ts`](../src/builders/flux/flux-scene-builder.test.ts)
  vérifie la zone de révélation de la Carte et ses événements d’entrée/sortie ;
  il vérifie aussi la déclaration d’entrée de l’image.
- [`editor-settings-resolver.test.ts`](../src/domain/editor-settings/editor-settings-resolver.test.ts)
  vérifie l’héritage champ par champ du projet vers le parent Carousel et son
  entrée.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  exerce le chemin de composition existant entre l’événement du perso média,
  le strap et le déplacement. Ce test ne couvre pas la cible native choisie par
  le navigateur dans le slot ; le relevé Brave ci-dessous vérifie ce point.
- Brave DevTools, le 23 octobre 2026, vérifie dans la preview Elcé qu’avant le
  `z-index`, le centre du média ancré était ciblé par le `h2` suivant, dont la
  boîte recouvrait la réserve visuelle. Après correction, `elementFromPoint`
  cible l’image ; un clic réel ouvre le host et déplace l’image dans le
  viewport. Le clic de fermeture puis Échap ramènent le host à l’état fermé.
  Cette preuve porte sur une image ancrée dans une page Flux.

La validation ciblée du correctif le 23 octobre 2026 passe les deux suites de
builder (18 tests), la composition player (48 tests), le typecheck et le build
Elcé.
- [`card-preset-builder.test.ts`](../src/builders/card/card-preset-builder.test.ts)
  vérifie les presets, les identifiants des éléments parents, les commentaires
  d’insertion, l’identité des zones et l’omission des textes facultatifs vides.
- [`flux-scene-builder.test.ts`](../src/builders/flux/flux-scene-builder.test.ts)
  vérifie qu’une Section sans titre ne crée pas de `h2` et qu’un Résultat sans
  message ne crée pas de paragraphe vide ; les tests Flux et player couvrent les
  presets projetés dans ces parcours.
- `PlayerPreview` fournit la preuve navigateur dans l’application : le dépôt
  réel depuis `SectionEditor` passe par XState, puis la preview monte le
  builder, Sighty et CodPlay avec le slot projeté.
- Safari confirme le 3 octobre 2026 qu’un MP4 réel déposé dans `SectionEditor`
  passe par XState, survit au rechargement et se monte comme perso `media` dans
  la part du slot d’ancre. Le cadre reste en `16 / 9` avec une réserve de
  `56.25%` ; la source testée mesure `442 × 300 px` pour `5,89 s`. Le cadrage
  diffère actuellement entre l’éditeur (`contain`) et le player (`cover`).
- [`scenario-builder.test.ts`](../src/builders/scenario/scenario-builder.test.ts)
  vérifie les scènes persistantes, le graphe Sighty, les routes, l’ordre racine
  mélangé des entrées page/chapitre, le menu correspondant, et l’exclusion des
  pages du catalogue.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie le montage réel du cadre complet, du menu, du titre, de la
  navigation, du slot et de la page Flux par Sighty et CodPlay dans un DOM de
  test, ainsi que
  le montage de Cartes avec les composants `img` et `media`, d’une Carte dans
  une ancre de texte et d’un média selon le layout de Carte. Les tests de
  révélation pilotent l’observateur réel et vérifient que la racine reste fixe
  tandis que le média enfant reçoit l’opacité et la translation Capsule.
- Le 15 octobre 2026, le style Flux a été dépouillé des déclarations de snap.
  Les 41 tests de composition, le typecheck et le build passent. La vérification
  navigateur d’un BDC plus haut que le viewport restait ouverte dans le
  [plan de construction](../plan/2026-10-01-elce-construction-plan.md).
- Brave DevTools, le 26 octobre 2026, a reproduit puis corrigé le chaînage de
  fin de page dans la preview : PageDown fait défiler un long scrollport Flux ;
  une fois en bas, un autre PageDown ne déplace ni le scrollport ni le document
  parent, et le cadre de lecture reste en place. Le repère de fin active
  « Suivant ». `elce-player-composition.test.ts` vérifie la règle du scrollport ;
  ses 47 tests, le typecheck et le build passent.

Le 26 octobre 2026, après résolution de fusion, les 481 tests Elcé dans
73 fichiers passent, ainsi que le typecheck et le build. Les tests Flux et
Graphe vérifient aussi la priorité `z-index: 1` dans les classes de géométrie ;
les tests player exercent les transitions Capsule sur le média avec une
racine observée fixe. La validation navigateur après fusion reste dans le
[plan Style](../plan/2026-10-22-elce-style-tab-plan.md).
