# Démo position — plan V2

> Statut : En cours — dépend de la migration `move` et de la préparation
> événementielle du core
> Version CodPlay : V2 foundation

La démo reste une fixture de validation. Elle doit exercer le circuit réel du
player et du runner ; elle ne doit pas fournir de condition de présentation ni
de contournement pour compenser une lacune du core. La migration de référence
est [`motion-live-discovery-invalidation-plan.md`](../../codplay/plan/motion-live-discovery-invalidation-plan.md).

## Objet

Créer la démo `position` comme une scène de validation V2 progressive : les
positions, le reparenting, les trajectoires, la capture et les mouvements
imbriqués sont montrés dans six vues réunies par un carousel.

## Décisions retenues

- La démo reste une seule `SceneDoc`, avec une story `main` qui porte le shell
  du carousel et six `StoryDoc` qui portent chacun une étape. Le carousel est
  un `AutoCapsule` de type `carousel`, et ses intervalles sont calculés par
  `CapsulePreset` puis `CapsuleDistribution`.
- Le carousel utilise les noms d'événements `intro` et `outro` produits par
  `AutoCapsule`. Ces noms sont propres à cette démo et n'ont aucune sémantique
  dans CodPlay. Le strap de navigation les émet uniquement après une flèche
  (ou Entrée) et ne les inscrit pas comme changements temporels automatiques.
  La sortie est une coupure (`cut`) : la vue précédente est masquée à la
  frontière, puis la vue entrante glisse horizontalement avec l'événement
  `swipe-left`. Une seule vue peut donc être visible, sans fondu croisé.
- Les cinq premières vues conservent la présentation source / cible / item.
  La sixième est une conclusion visuelle : une constellation de trajectoires
  multiples qui reprend le principe de `flip-stress` avec une direction
  artistique continue et plus travaillée.
- Les événements du clavier sont déclarés sur un perso de la story. Ils
  passent par le circuit `emit` → `listen` → `strap` → événements/actions.
  Le nom d'un événement de démo est local à cette scène et ne devient pas un
  contrat CodPlay.
- Le lancement `demo:v2` passe par `src/v2/main.ts` et le layout partagé. Le
  scan de dépendances du serveur Vite est borné à `index.html`, afin que cette
  entrée ne découvre pas les autres pages du paquet.
- Les règles CSS produites par `AutoCapsule` restent dans le dossier de la
  démo. Le layout partagé ne connaît ni le carousel `position`, ni ses classes
  de projection.
- Chaque story est isolée dans `story-one.ts` à `story-six.ts`. Les trois
  premières sont des objets `StoryDoc` écrits directement ; `main.ts` assemble
  la scène et déclare la story `main`. `constants.ts`, `types.ts` et `shared.ts`
  isolent les éléments transverses.
- Espace produit un comportement de story : le strap bascule l'état, arrête
  les tweens courants par événement et relance la séquence visuelle de la vue
  courante par événement. Il ne pilote ni l'horloge du player ni `telco`.
- L'ordre de validation courant commence par la story 6 ; la story 4 est
  activée ensuite. Dans la story 2, les deux déplacements d'ancre commencent
  à `450 ms`, son item est reparenté à `1 350 ms` pendant `2 000 ms`, et sa
  borne de story arrive à `4 100 ms`. Chaque reparenting d'item utilise cette
  même durée et un `move` explicite. Les mouvements des vues parcourues ensuite
  sont ajoutés par le strap de navigation sur le track de la story. La lecture
  temporelle ne change jamais de vue.
- Chaque plan de story se termine par un eventime ordinaire
  `position:demo:story:end`, positionné à la fin de sa dernière transition.
  Il fixe l'horizon observable utilisé par le seek sans déclencher la borne
  terminale `sequence:end` et sans arrêter la lecture.
- Une occurrence ajoutée par un strap porte son `move` complet dans
  `event.data`. Le listen n'est pas réévalué lorsque l'horloge atteint un
  eventime planifié ; un simple nom d'event ne peut donc pas suffire à lancer
  un mouvement.
- La troisième vue propose quatre boutons de path. Chaque clic est un event de
  sélection traité dans la story, qui prépare le path choisi et émet un unique
  `move` vers l'outlet opposé ; elle ne comporte pas de capture pointer.
- La quatrième vue utilise des captures de déplacement sur la source et la
  cible. Les déplacements issus de `movementX/Y` sont conservés en pixels
  dans `event.data.style`, puis les rebonds ajoutés à la réception de
  l'événement de navigation portent un `move` complet. Lorsqu'une ancre est
  relâchée, le circuit
  capture → listen → strap émet en plus un rebond immédiat avec un path
  recalculé dans `event.data`.
- La cinquième vue reprend exactement les deux cartes `source` et `cible` des
  vues précédentes et les déplace verticalement en sens opposés par un tween
  `translateY` de `3 650 ms`. K est l'enfant de `source` et Q l'enfant de
  `cible`; chacun est large de `50 %` et haut de `100 %`, puis animé
  horizontalement dans son propre parent par un tween `translateX` ACE avec
  `alternate` et `loop`. Ces actions de style ne contiennent pas de `move` et
  ne créent pas d'overlay. Les départs sont décalés par pas de `500 ms`, du
  premier départ à `+2 000 ms`, afin que source, cible, K, Q et X ne se
  déplacent pas ensemble. X est monté dans K puis transféré quatre fois entre
  K et Q par des `move` `reparent: true` de `2 000 ms`, soit la succession
  K→Q→K→Q→K. Aucun rail, outlet intermédiaire ou path décoratif n'est utilisé.
- La représentation graphique des trajectoires reste une étape séparée. Le
  présent volet valide seulement les destinations, durées, reparentings et
  payloads de `move`.
- La démo ne définit pas l'architecture du core. Elle adopte la forme
  `reparent: true` lorsque l'overlay est explicitement demandé et attend le
  circuit événementiel du plan CodPlay pour les captures ; aucun eventime
  statique ni chemin de secours n'est ajouté pour masquer un défaut du runner.

## Travaux

1. Construire les six `StoryDoc` et leur groupe story-local dans
   `src/v2/demos/position/`.
2. Corriger et tester les `move` déclenchés par les eventimes de chaque vue,
   notamment les payloads dynamiques et les unités du drag de la vue 4.
3. Garder le code lisible pour un auteur : une story par fichier, les fonctions
   mathématiques communes dans `shared.ts`, les constantes dans `constants.ts`,
   et l’assemblage de la `SceneDoc` dans `main.ts`. Les trois premières stories
   doivent exposer directement leurs objets de scène, sans fabrique de
   construction.
4. Déclarer la démo dans le registre V2, documenter son circuit réel et borner
   le scan de démarrage à l'entrée du layout V2.
5. Représenter ensuite les trajectoires réelles, sans changer le circuit de
   mouvement validé au volet précédent.
6. Vérifier compilation, typecheck, transitions cut, captures, journal,
   replay/seek, resize, destruction et comportement clavier dans le runner
   HTML V2.

## Critères d'acceptation

- La lecture temporelle seule ne change jamais de vue ; chaque changement
  vient d'une interaction de navigation, et n'expose jamais deux vues du
  carousel simultanément.
- La vue initiale de validation est la story 6. Lorsque la story 2 est activée,
  son `move` d'item commence à `1 350 ms` et se termine à `3 350 ms`.
- Les six vues montrent réellement les mouvements/reparentings via les actions
  `move` du runtime V2 ; chaque reparenting dure `2 000 ms` et les
  eventimes ajoutés à la volée contiennent leur payload `move` complet.
- Après un seek arrière, le curseur peut revenir à l'eventime
  `position:demo:story:end` de la story parcourue ; cet eventime ne met pas le
  player en état terminal.
- La troisième vue produit un événement de mouvement par clic de bouton, avec
  le path choisi dans `event.data`, sans écriture DOM dans une fonction auteur.
- La quatrième vue applique le déplacement souris en pixels, recalcule
  immédiatement un rebond par strap après le relâchement d'une ancre, et
  exécute quatre rebonds planifiés comme des eventimes `move` complets de
  `2 000 ms`.
- La cinquième vue conserve K dans `source` et Q dans `cible`; leurs mouvements
  sont des translations horizontales locales au parent, pilotées par les
  options ACE `loop` et `alternate`, sans overlay. Seul X est reparenté entre
  K et Q.
- La sixième vue exerce plusieurs trajectoires et plusieurs items par le même
  circuit de materialization que les autres vues.
- Les dessins de trajectoire ne sont pas considérés comme validés par ce
  volet ; leur correction appartient à l'étape suivante.
- Les touches gauche, droite, Entrée et Espace ne créent aucun chemin parallèle
  vers le player ou la télécommande partagée.
- Le statut reste `En cours` tant que la validation navigateur complète n'est
  pas documentée.

## Analyse et validation du volet mouvements

- Story 2 : les deux conteneurs sont montés dans la même grille que la story 1
  et conservent ses dimensions de carte. Le `move` de l'item change bien
  d'outlet et porte `reparent: true` pour demander à CodPlay une
  présentation par overlay pendant les `2 000 ms` de transition. Le mouvement
  vertical des ancres utilise le canal `translateY`, comme les tweens ordinaires
  des autres démos V2, avec une amplitude de `50` unités numériques CodPlay.
- Validation ciblée : le test façade vérifie le payload `move`, le changement
  d'outlet avant/après la transition et la présence des deux conteneurs dans la
  grille de la story 2. Le parcours Safari sur la vue initiale vérifie le début
  sans saut de l'overlay, son arrivée dans la cible et l'absence d'erreur
  console.
- Le test de parent mis à l'échelle de
  `tests/runtime/runner-html/layout-snapshot.spec.ts` couvre une frontière de
  capture distincte. Il ne valide pas à lui seul la trajectoire de la story 2.
  Le parcours Safari MCP a montré que la trajectoire était spatialement droite,
  mais temporellement non linéaire à cause de l'easing auteur `inOutQuint`.
  Le `move` de la story 2 ne déclare désormais plus d'easing ; les
  déplacements indépendants des ancres restent leurs tweens verticaux séparés.

## Dépendance au plan CodPlay

- La story 2 n'envoie aucun détail de parcours ou d'ancrage dans son payload de
  `move`. Le pipeline applique toujours `arc-length` et `center`; la démo ne
  choisit pas ces conventions et ne les compense pas par une lecture DOM
  supplémentaire du runner.

- Les payloads qui demandent explicitement l'overlay utilisent
  `reparent: true`. `mode` conserve son rôle d'ordre et toutes les propriétés
  de `transition` restent disponibles.
- La migration CodPlay doit faire parvenir au runner l'occurrence `move`
  résolue au moment où l'événement est matérialisé. La démo ne fournit aucune
  information de présentation pour décider d'une capture : la présence d'un
  `move` dans l'occurrence résolue suffit.
- Un événement de navigation sans `move`, et un `move` local de la vue 5, ne
  doivent pas entrer dans le chemin overlay. La démo vérifie leur traitement
  existant en parallèle des reparentings.
- La démo `flip-stress` reste une non-régression obligatoire : son unique story
  possède plusieurs racines visuelles et conserve donc le repli de couche sous
  la racine de scène.

### Éléments déjà validés à conserver

- Défaut corrigé : un eventime ajouté par un strap était bien journalisé, mais
  son event n'était pas réévalué par `listen` à l'échéance. Avec une action
  `{}`, il ne pouvait donc pas produire de mouvement. Les eventimes de move
  portent maintenant leur payload complet dans `event.data`.
- Défaut corrigé : les nombres issus de `movementX/Y` entraient dans la
  projection des transformations comme des valeurs logiques `cqw`, ce qui
  amplifiait le drag. Les déplacements d'ancre sont désormais émis en chaînes
  `px` et le style DOM vérifié suit exactement le déplacement reçu.
- Décision appliquée : tous les reparentings d'items utilisent un `move`
  explicite et une durée de `2 000 ms`; les plans des six stories transportent
  le `move` complet dans `event.data` lorsqu'ils sont ajoutés à la scène.
- Réorganisation appliquée : `main.ts` assemble la scène et la story `main` ;
  `story-one.ts` à `story-six.ts` portent chacune un `StoryDoc`, et
  `carousel.ts`, `straps.ts`, `story-animation.ts`, `constants.ts`, `types.ts`
  et `shared.ts` portent les responsabilités transverses.
- Validé par `tests/facade/position-demo.spec.ts` : progression manuelle,
  story 6 en première position, le move initial de la story 2 à `1 350 ms`, les presets cliquables de la vue 3, quatre rebonds de la vue 4,
  reparenting imbriqué de la vue 5 et la conclusion `flip-stress` avec quatre
  conteneurs, deux cadres en transfert, deux listes et douze échanges d'items.
- La conclusion reprend les constantes de mouvement de `flip-stress` :
  conteneurs à `9 350 ms` / `8 150 ms`, cadres à `7 275 ms`, échanges à
  `875 ms` espacés de `500 ms`, chemins courbes déterministes et easing
  `inOutQuad`. Les trajectoires sont produites uniquement par les `move` du
  runtime ; aucun SVG décoratif n'est utilisé.
- Validé par la non-régression ciblée façade/capture/motion : 5 fichiers et
  21 tests passent.
- Le serveur de développement V2 démarre sur `127.0.0.1:4173` sans retrouver
  l'entrée V1 dans le scan de dépendances. Le build complet du paquet reste
  bloqué par l'importation préexistante `@codplay/editor/builder/build-scene`
  depuis `src/v1/scenes/ed2-builder-scene.ts`; ce défaut hors périmètre n'est
  pas contourné dans la démo `position`.
- La validation navigateur visuelle, ainsi que la correction des dessins de
  trajectoire, restent à faire au volet suivant.
- La conclusion n'affiche pas les rôles `source` / `cible` : A–D sont les
  seuls repères des conteneurs. Les cadres Q/K ont chacun leur fond, leurs
  outlets restent sans clipping et les deux lignes de chaque liste gardent la
  taille intrinsèque des items. Le frame de transfert est dimensionné pour
  absorber l'item transitoire présent pendant un move, sans décaler les six
  items visibles de la liste source.
- Contrôle Safari Technology Preview ciblé à `t=2 640 ms` : le frame K issu de
  D conserve ses six items visibles dans leurs deux rangées ; le septième item
  transitoire reste masqué dans l'overlay. Le replay ciblé ne produit aucune
  nouvelle erreur console.
- Contrôle Safari Technology Preview du cycle seek : après lecture de la
  conclusion au-delà de `9 650 ms`, un seek à `3 000 ms` conserve `max=9 650`,
  puis un seek à `9 650 ms` revient à `100 %`. Aucun warning ni error n'est
  produit dans la console.

### Reprise d'intégration — 2026-09-08 — identité de story et ordre de validation

- Le carousel conserve un ordre de cases, mais une case ne constitue plus
  l'identité d'une story. `POSITION_VIEW_STORY_IDS` porte l'ordre de
  présentation ; `POSITION_STORY_VIEW_IDS` conserve l'identité stable de la
  racine visuelle ; `CAROUSEL_EVENTS_BY_STORY_ID` résout les événements de la
  case occupée par chaque story.
- `createStoryAnimationPlan` et `planStoryAnimation` sont maintenant indexés
  par `storyId`. Le plan transmis par une navigation est donc ciblé par la
  même identité que le document de story, quelle que soit sa position dans le
  carousel.
- La validation courante place la story 6 en première case, puis la story 4,
  puis la story 2. La story 5 reste la dernière case afin de conserver les
  autres positions de lecture.
  Les plans sont ciblés par l'identité de story ; le plan statique d'une autre
  story n'est plus exécuté en arrière-plan avant son activation.
- Réexamen navigateur sur l'onglet Safari MCP existant de `5173` : la mesure
  précédente a isolé l'easing auteur comme cause du démarrage sans déplacement
  horizontal. La correction conserve le même move, la même durée et le même
  circuit d'overlay, mais ne déclare plus l'easing `inOutQuint` afin que
  l'item commence sa transition horizontale dès son départ. La console Safari
  ne contient ni warning ni erreur. Après correction, les poses relatives
  relevées sont `x=157,219` à `1 350 ms`, `186,794` à `1 400 ms`, `243,697` à
  `1 500 ms` et `323,437` à `1 650 ms` : le déplacement horizontal commence
  bien avec la transition.

### Reprise d'intégration — 2026-09-08 — trajectoire de la story 4

- Lors de la reprise intermédiaire du 2026-09-08,
  `POSITION_VIEW_STORY_IDS` commençait par `position-story-four`. Les
  identités stables des racines restent celles des vues authored ; seul l'ordre
  de présentation du carousel est modifié.
- Les points d'ancrage `sourcePoint` et `targetPoint` gardent leur identité
  propre. Pour chaque mouvement, `firstPoint` désigne le conteneur mesuré en
  FIRST et `lastPoint` celui mesuré en LAST ; `lastRole` conserve cette
  distinction lorsque le mouvement inverse les deux conteneurs et ne dépend
  pas de l'ancre qui vient d'être déplacée.
- La courbure réduite est appliquée uniquement lorsque le conteneur cible est
  LAST. Le placement inverse, où la source est LAST, conserve sa courbure
  existante ; aucune autre trajectoire n'est modifiée par ce correctif.
- Le contrôle Safari MCP confirme dans l'onglet existant de `5173` que la
  première case affiche la story 4 (`01 / 06`) et que la console ne produit
  aucun warning ni error après le changement d'ordre.

### Reprise d'intégration — 2026-09-08 — régression du déplacement live

- Le symptôme « l'item ne se déplace plus et les conteneurs reviennent à leur
  position initiale » venait d'une erreur de résolution de la transition de la
  racine du carousel. Le canal `x` est une longueur logique : ses deux bornes
  doivent rester numériques et être qualifiées ensemble. Une borne authored en
  CSS (`320px`) mélangée à la borne numérique `0` déclenche
  `RUNTIME_STYLE_LENGTH_INCOMPATIBLE`, ce qui interrompait le traitement de
  l'événement avant la conservation du drag.
- `CAROUSEL_SLIDE_OFFSET_PX` reste donc numérique (`320`) afin que `from` et
  `to` suivent le même contrat de longueur. Aucun contournement n'a été ajouté
  au runner ni au circuit de capture.
- Validation effectuée : les 9 tests ciblés position/layout passent, le
  typecheck CodPlay passe, le typecheck V2 des démos passe, le build V2 passe,
  et l'onglet Safari MCP existant confirme que les translations relâchées de
  `source` (`34,-18`) et `cible` (`18,18`) sont conservées et que l'item reste
  dans la cible. Le plan global reste `En cours` pour les volets non validés.

### Reprise d'intégration — 2026-09-08 — distinction source / cible dans la trajectoire

- Pour le déplacement `source → cible`, la cible est le conteneur `LAST` et
  possède désormais une forme de trajectoire mémorisée dans l'état de la
  story (`liveTargetControlY`). Le relâchement de la source met à jour sa
  position mais conserve cette forme ; il ne modifie donc pas le trajet vers
  la cible.
- Le relâchement de la cible recalcule au contraire cette forme à partir des
  deux positions, puis la transmet aux prochains `move`. Le calcul dépend
  ainsi du conteneur placé en `LAST`, et non de l'ancre qui vient d'être
  déplacée.
- Le test façade vérifie sur le circuit runtime réel que le prochain move
  vers `position:view-four:target` conserve son rayon après un déplacement de
  la source. Le libellé de la story décrit maintenant cette distinction.

### Reprise d'intégration — 2026-09-09 — repositionnement du conteneur source

- Le saut observé après un déplacement de la cible ne venait pas de la pose de
  l'item ni de sa nouvelle trajectoire. Le snapshot logique montrait déjà le
  conteneur `source` revenu à `0px,0px` avant la présentation motion.
- La cause était déclarative : les événements internes de relâchement de la
  source et de la cible portaient `active: true`. Selon le contrat d'isolation,
  cette propriété ouvre une nouvelle période, y compris si la même story est
  déjà active ; la période précédente et son état de story ne sont alors plus
  projetés. Les relâchements ne sont pas des événements d'activation : ils ne
  portent plus `active`. L'activation reste portée par l'entrée et
  l'initialisation de la story.
- La régression façade `keeps the source anchor pose when the target is
  repositioned` vérifie sur le circuit réel que `translate(34px, -18px)` est
  conservé après le relâchement de la cible. Aucun filtrage spécial du
  conteneur `source` n'a été ajouté au graphe motion.

### Reprise d'intégration — 2026-09-09 — identités physiques A/B et direction du move

Les lignes précédentes décrivent l'ancienne hypothèse de la fixture ; elles ne
sont plus le modèle courant de la story 4. Les deux conteneurs sont désormais
`A` et `B`. `source` et `target` sont des rôles transitoires du move courant :
le premier rebond est A→B, le suivant B→A, puis l'alternance continue.

- L'état de story mémorise les poses de A et B ainsi que l'identifiant de la
  cible du dernier move exécuté. Les payloads `move` portent également cette
  cible physique afin que le suivi reste attaché à l'occurrence réelle, sans
  déduire une destination du nom du geste ou du conteneur relâché.
- Le relâchement de la source physique courante ne produit que son événement
  de pose et sa mise à jour d'état. Il ne réémet pas de `move` et ne modifie
  pas la trajectoire en cours vers la cible.
- Le relâchement de la cible physique courante produit un nouveau `move` vers
  cette même cible. Le runner CodPlay prend alors la pose visible de l'item
  comme FIRST et la projection de la cible déplacée comme LAST ; le segment
  conserve la fin et la durée totale prévues par le contrat de retarget.
- L'initialisation et les plans de story 4 restent dans le track story. Les
  occurrences futures mettent à jour la cible courante dans ce même scope,
  ce qui permet de traiter correctement le rebond inverse B→A après une
  lecture réelle.
- Les tests façade couvrent maintenant le markup A/B, le trajet A→B après le
  déplacement de A, la conservation de la pose de A lorsque B est déplacé,
  et le retarget vers A lorsque la série est passée à B→A.

### Reprise d'intégration — 2026-09-09 — aucun repeat parasite au relâchement

- Le `repeat` de la story 4 est créé une seule fois par son événement
  d'initialisation. Le strap de relâchement ne replanifie jamais cette série.
- Le relâchement de la source physique émet uniquement son événement de pose.
  Le relâchement de la cible émet son événement de pose et un seul `move`
  ordinaire, que CodPlay retargete selon le plan de dépendance de cible.
- Plusieurs relâchements successifs ne créent donc pas de nouvelles
  occurrences futures. La fixture mesure ce chemin réel ; elle ne compense pas
  un défaut du runtime par un cache ou une logique locale.
- Contrôle Safari MCP : cinq relâchements successifs de B à `700 ms` ont
  produit chacun 33 lectures de géométrie/styles ; les seeks à `30 000` et
  `40 000 ms` sont restés à 90 lectures, sans croissance correspondant à cinq
  séries supplémentaires. La console est restée sans warning ni erreur.

### Reprise d'intégration — 2026-09-09 — mouvement horizontal local de la story 5

- La story 5 reste disponible en dernière case de validation. Son parentage
  physique est stable : K reste enfant de `source` et Q reste enfant de `cible`.
- K et Q se déplacent horizontalement dans leur parent par leurs propres
  tweens `style.translateX`. Leur action ne contient aucun `move`; le graphe
  géométrique ne les capture donc pas et aucun overlay ne les contient.
- L'aller-retour est porté par ACE (`loop: 39`, `alternate: true`) sur une
  seule occurrence d'animation par conteneur. La démo ne recrée pas cette
  oscillation avec `planned.repeat`.
- X conserve le seul changement de parent de cette story : ses quatre
  transferts K→Q→K→Q→K demandent explicitement `reparent: true`. L'overlay
  éventuel concerne donc X uniquement, jamais K ou Q.
- Vérification Safari MCP sur l'onglet existant de `5173` : à `2 500 ms`,
  `translateX` vaut environ `17,5 %` pour K et `-53,9 %` pour Q; chacun reste
  entièrement dans son parent. Le seul calque de présentation contient X et
  ne contient ni K ni Q. À `16 000 ms`, K et Q sont toujours dans `source` et
  `cible`, et X est revenu dans K. Aucun warning ni error Safari n'a été relevé.

Le statut reste `En cours` : cette correction est implémentée, testée sur le
circuit réel et documentée, mais la validation CodPlay d'acceptation complète
reste ouverte.

### Reprise d'intégration — 2026-09-09 — premier Play direct de la story 5

- La capture Safari MCP de la première transition à `2 450 ms` mesure K côté
  source au FIRST et Q côté cible au `afterStart`/LAST ; la cible est donc déjà
  montée dans cette fixture au moment du premier calcul.
- À `2 800 ms`, le premier Play présente l'overlay dans le sens K→Q. Un seek au
  même temps produit la même pose à moins d'un pixel (`x≈134,6`, `y≈460,3`),
  et la console Safari reste sans warning ni erreur.
- Le test façade `story-five-motion.spec.ts` verrouille en plus les identités
  de cible (`K` puis `Q`), le mode `reparent`, la durée et l'absence de
  retarget parasite. Le cas général d'une cible absente au FIRST puis montée
  au LAST est couvert séparément par la story 6 et le graphe motion.

Le diagnostic initial « cible absente au FIRST » n'est pas reproduit dans la
story 5 actuelle ; le garde runtime correspondant reste validé par la story 6.
Le statut global reste `En cours` jusqu'à la matrice complète Play, Seek,
replay, resize, persistence et lifecycle.

### Reprise d’intégration — 2026-09-09 — saut de Q vers B à l’endpoint

- Le second bug confirmé concerne la story 6 : entre `t=9 180` et `t=9 300`,
  Q rejoint B et sautait de position aussi bien au Play qu’au Seek. La story 6
  est désormais la première lecture de la démo afin que cette reproduction
  commence directement sur son premier Play.
- La cause n’était pas une simple différence de taille de l’overlay. Lors des
  frontières de reflow du contenu de B, le graphe comparait `before` à un
  `after` capturé à l’endpoint. Comme B poursuivait son propre mouvement dans
  cet intervalle, cette pose avancée était interprétée comme une modification
  structurelle de B ; Q était alors retargeté plusieurs fois avec une pose
  intermédiaire périmée.
- Le runtime distingue maintenant les intentions directes des changements
  indirects : les premiers invalident explicitement, tandis que les seconds
  ne comparent que `before` et `afterStart`. L’endpoint `after` ne peut plus
  retargeter Q simplement parce que son ancêtre a avancé dans le temps.
- Le test de graphe
  `does not retarget a child when an ancestor only advances during an unrelated
  reflow` verrouille cette causalité sans modifier la fixture. Les tests
  façade de la story 6 continuent d’exercer le parcours réel.
- Safari MCP sur `5173` confirme au Seek l’alignement de Q à `t=9 274`, puis
  `t=9 275`, avec un écart inférieur au pixel avant disparition de l’overlay.
  Un premier Play réel traverse la zone `t≈9 190`–`t≈9 310` sans discontinuité
  visible et sans warning ni erreur de console.

Le statut reste `En cours` : le correctif est implémenté, testé sur le runtime
réel et documenté, mais la matrice complète Play, Seek, replay, resize,
persistence et lifecycle reste ouverte.

### Reprise d'intégration — 2026-09-09 — première lecture de la démo 06

- Correction de numérotation : la démo concernée par le bug de premier Play est
  la story 6, et non la story 5.
- `POSITION_VIEW_STORY_IDS` commence maintenant par
  `position-story-six`, puis conserve l'ordre des autres cases (`4, 2, 1, 3,
  5`).
- `POSITION_INITIAL_EVENTS` émet directement l'entrée et l'initialisation de
  la story 6. Le premier écran est donc la démo 06 dès `t=0`, sans navigation
  préalable ; la story 5 reste testable directement par son parcours dédié.
- Safari MCP sur une navigation fraîche de `5173` confirme `01 / 06`, le
  caption `06` et la story 6 visible à `0 ms`. Le premier Play est lancé sur
  cet état, sans seek ni navigation préalable ; le passage observé place
  ensuite `Qa` dans la liste `K`, dans le sens attendu `Q → K`.
- Cette observation confirme le point d'entrée de la reproduction, mais ne
  clôt pas la correction du bug du premier Play : la matrice de validation
  navigateur complète reste ouverte.

### Régression du premier calcul de `Qa` — 2026-09-09

Le premier bug est une régression de la feature FIRST/LAST, et non une
correction de fixture. Dans la story 6, `Qa` part à `1 200 ms` vers une cible
dont le dernier parent effectif est le cadre `K`. `K` n’est monté qu’à
`1 500 ms` et son propre transfert vers `C` commence à `2 000 ms`. La capture
par occurrence préparait `Qa` sans la boundary future de `K` ; sa position LAST
était donc construite sur la branche statique de `C`. Un seek ultérieur pouvait
masquer la régression en ayant déjà préparé cette boundary.

Le runtime restaure la fermeture de dépendance existante : la capture de `Qa`
ajoute uniquement les moves résolus sur la chaîne d’ancêtres de sa destination
et compris dans l’intervalle de `Qa`. La boundary de `K` est ainsi présente dès
le premier calcul (`2 000 → 9 275 ms`), sans scan global ni logique locale dans
la démo. Le test façade verrouille cette préparation au premier passage.

Validation du 2026-09-09 : 94 fichiers et 602 tests CodPlay passent, ainsi que
le typecheck CodPlay. Une navigation fraîche dans Safari MCP suivie d’un
premier seek à `1 500 ms` place l’overlay `Qa` à `x≈298,9`, dans la direction
de `D/K`, au lieu de la pose erronée observée précédemment vers `C` (`x≈141`).
Le seek suivant à `2 500 ms`, puis retour à `1 500 ms`, conserve exactement
la même pose ; la console Safari ne contient ni warning ni erreur.

Le statut reste `En cours` : le premier Play est couvert par le runner et la
façade, mais la matrice navigateur complète Play, Seek, replay, reset, resize,
persistence et lifecycle n’est pas encore close.

### Mesure du freeze aux bornes FIRST/LAST — 2026-09-09

Une instrumentation temporaire dans Safari MCP a séparé les frames ordinaires
des transactions de capture. Les frames ordinaires ne lisent ni
`getBoundingClientRect` ni le style calculé et restent autour de `1–2 ms`.
Le freeze est donc ponctuel, au moment où une occurrence ouvre sa capture.

Sur le premier Play, les mesures observées sont :

| Boundary | Durée JS | Rectangles | Styles | Mutations DOM |
|---|---:|---:|---:|---:|
| `Qa` à `1 200 ms` | `≈12–16 ms` | `72` | `73` | `111` |
| `Ka` à `1 700 ms` | `≈9–11 ms` | `78` | `79` | `62` |
| `Qb` à `2 200 ms` | `≈14–17 ms` | `72` | `75` | `59` |
| `Kb` à `2 700 ms` | `≈18 ms` | `72` | `75` | `64` |
| `Qd/Kd` à `4 200–4 700 ms` | `≈33–38 ms` | `72` | `75` | `59–64` |
| `Qe/Ke` à `5 200–5 700 ms` | `≈50–51 ms` | `72` | `75` | `59–64` |
| `Qf/Kf` à `6 200–6 700 ms` | `≈58–61 ms` | `72` | `75` | `46–64` |

Un move de contenu relit donc environ trois fois la fermeture Q/K : la
sélection contient les frères concernés par le reflow, puis la capture mesure
`before`, `afterStart` et `after`. Elle matérialise aussi plusieurs états DOM,
ce qui explique les dizaines de `appendChild`/`insertBefore`/`removeChild`.
Le nombre de mesures reste stable tandis que la durée augmente avec les
boundaries déjà engagées ; le recalcul excessif semble donc venir du coût
combiné de la capture DOM et de la reconstruction/présentation du graphe
historique, plutôt que d’une lecture géométrique à chaque frame.

Cette mesure n’a pas modifié le runtime. L’optimisation éventuelle doit être
traitée comme une tâche distincte et conserver les trois bornes FIRST,
`afterStart` et LAST ainsi que la composition Q/K.

### Reprise d’intégration — 2026-09-09 — presets de trajectoire de la story 3

La story 3 expose désormais quatre boutons déclaratifs, dans l’ordre suivant :

- `droit` : path segmenté `M 0 0 L 1 0` ;
- `quadratique` : path ACE quadratique préparé avec le contrôle normalisé
  `0.5, -0.82` ;
- `brisée` : path segmenté à cinq lignes, avec une amplitude encore réduite de moitié ;
- `boucle` : path segmenté composé de deux arcs formant une boucle puis d’une
  sortie vers la cible.

Les quatre tracés SVG reprennent leurs géométries normalisées respectives, avec
une transformation d’affichage commune `translate(8 55) scale(84)`. La brisée
reprend les coordonnées quantifiées à deux décimales par `prepareSvgPath`.
Aucun marqueur directionnel ni path décoratif supplémentaire n’est ajouté : les
trajectoires peuvent être parcourues dans les deux sens et le dessin ne montre
que le path sélectionné.

Chaque bouton est un perso `tag` de la story et passe par
`POSITION_PATH_SELECT_STRAP`. La story mémorise le côté courant de l'item dans
`pathItemPosition`, puis le strap choisit l'outlet opposé avant d'émettre un
unique `move` complet avec `reparent: true`, la durée commune de `2 000 ms` et
le path déjà préparé. L'initialisation de la story est elle-même planifiée dans
le scope de la story et enregistre l'arrivée initiale en cible ; les clics
suivants alternent donc cible → source → cible, sans reset ni second move
parasite. Le runtime capture ainsi la position courante comme départ de chaque
nouveau move. La sélection est également reflétée par le bouton actif et par
le tracé affiché dans la vue. L'ancien contrôle et la capture du point médian
ne font pas partie de cette story : les quatre boutons sont son unique
interface de path.

Cette extension reste dans la fixture : aucun chemin DOM parallèle ni aucune
modification du core n’a été ajoutée. Les paths SVG segmentés sont normalisés
par `prepareSvgPath`, tandis que la courbe quadratique utilise
`preparePath`, conformément au contrat `move.transition.path`.

Validation du 2026-09-09 : le test façade de la démo vérifie les quatre clics,
les quatre formes préparées, le payload `move` réel, l’alternance des outlets
cible/source et le remplacement d’une trajectoire en cours par deux clics
successifs (`14` tests passent). Le typecheck CodPlay et le typecheck V2 des
démos passent. Dans Safari MCP, une navigation fraîche sur `5173`, puis deux
clics successifs sur `droit` et `quadratique`, active bien les boutons et
présente l’item dans le circuit d’overlay vers les outlets opposés. La console
ne contient ni warning ni erreur.
