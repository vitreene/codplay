# Sighty — démo de cours scrollable et gardes de navigation

## Statut

**Fixe.** La définition unique du scénario et la correction structurelle de la
démo sont intégrées. Le parcours complet est validé par les tests automatisés,
Firefox headless et une session Safari MCP : gardes, repères bas, quiz,
félicitations et remise à zéro suivent le même circuit Sighty.

## Rôle

La démo `?demo=demo5` vérifie le parcours d’un cours à pages scrollables avec
le graphe et les conditions de navigation publics de Sighty. Elle sert de
preuve d’intégration ; elle ne remplace ni `accessBy`, ni `exitBy`, ni
`onDenied` par un état visuel ou une navigation parallèle.

Le scénario comporte trois chapitres : trois pages de contenu puis un quiz
dans le premier, trois pages de contenu dans le deuxième, et trois pages de
question dans l’évaluation finale. Une page de félicitations conclut une
évaluation entièrement réussie.

## Admission et sortie des pages

Le parent `view-course` déclare une fois `accessBy`, `exitBy` et `onDenied` dans
le scénario Sighty ; les pages des trois chapitres héritent de ces guards. Les
actions `next`, `previous`, `pageBottom` et `quizAnswered` sont également
déclarées à ce niveau. `showMode: 'reset'` y réinitialise l’état logique d’une
page lorsqu’elle est relue ; les pages quiz n’ajoutent pas de guard local.

[`scenario.ts`](../src/sighty/demo5/scenario.ts) déclare ensemble le graphe,
les fonctions `scenario.guards` et `scenario.actions` et le catalogue des
scènes. [`CourseComposition`](../src/sighty/demo5/course-composition.ts)
configure uniquement l’exécution de ce scénario.

`COURSE_PAGES` est l’unique catalogue des entrées de page : le scénario en
dérive les vues de chapitre, les routes du menu et les scènes de contenu. Les
`COURSE_CHAPTERS` fournit l’ordre et les libellés des chapitres ; l’appartenance
des pages et leurs identifiants viennent de `COURSE_PAGES`. Aucun identifiant de
page ou de scène n’est recopié dans le graphe.

- `accessBy` appelle `canAccessCoursePage` avec `context.signet`. Il impose
  l’ordre des pages, déverrouille le chapitre 2 après le quiz réussi, le
  chapitre final après la synthèse du chapitre 2, puis chaque question finale
  après une réponse à la question précédente. Il admet la page de félicitations
  seulement si les trois réponses finales sont justes.
- `exitBy` appelle `canExitCoursePage` avec l’événement et `context.signet`.
  Précédent est refusé sur la première page du cours et reste utilisable depuis
  les pages suivantes ; le menu reste utilisable. Suivant exige le repère de
  fin pour les pages de contenu ; sur le quiz du chapitre 1, une réponse juste
  suffit à l’activer immédiatement, tandis qu’une réponse fausse le laisse
  désactivé.
- `onDenied` ramène au début du cours. Un essai d’accès interdit ou une
  évaluation finale insuffisante ne sélectionne donc pas la cible refusée.
- La page de félicitations expose le bouton `Recommencer le cours`. Son
  événement public est traité par `view-course` : la transition revient à la
  première page, puis `action:course:reset-progress` restaure le signet initial
  et republie la présentation. Les instances de scènes restent conservées et
  les vues réadmises avec `showMode: 'reset'` retrouvent leur état initial.

Les commandes du menu et de la navigation sont émises par les scènes CodPlay
comme événements publics puis résolues par les actions du graphe Sighty. Les
sélections de menu et les actions Précédent/Suivant portent à la fois `go` et
`action: 'action:course:refresh-presentation'` : Sighty termine la transition, puis
l’action calcule et transmet la présentation aux scènes persistantes. À
l’initialisation, l’hôte démarre la scène layout avec
`runtime.play('scene-layout')` ; Sighty joue alors les scènes de la composition
active sous cette vue. L’hôte envoie une seule fois
`course:presentation:refresh` par `runtime.dispatch` pour initialiser le titre
et les contrôles. Il ne s’abonne pas aux changements de slot et ne projette pas
lui-même la sélection courante. Après un résultat de quiz ou un repère de fin,
l’action met d’abord à jour le signet, puis envoie la même projection explicite.
`course-presentation.ts` lit la page courante dans `runtime.scenarioState.active`
et interroge `canAccess` pour les pages du menu et `canExit` pour
Précédent/Suivant. Il ne déduit donc pas la page courante en recherchant dans
`current`, qui reste la liste de toutes les sélections de slots. Il ne recalcule
pas la logique métier des guards : `canAccessCoursePage` et
`canExitCoursePage` sont appelés par `scenario.guards`, puis évalués par le
runtime pour les pages du cours. Les envois `context.send` empruntent la
passerelle Sighty unique ; elle restaure la position CodPlay courante après
l’émission et reprend la lecture si nécessaire, afin que chaque patch de
présentation soit matérialisé immédiatement.

Précédent, l’état de page et Suivant sont trois persos de `scene-navigation`,
montée une seule fois dans `slot-navigation`. L’action Sighty transmet leurs
trois événements de présentation à cette même scène.

Les directions `next` et `previous` utilisent le pointeur interne Sighty, sans
`sourceSceneKey` ni route par identifiant de scène. À la dernière page du
chapitre 1, le guard de sortie vérifie la réponse au quiz ; après réussite,
`Suivant` franchit la borne du graphe enfant et entre dans le chapitre 2. Le
comportement de borne remonte au graphe parent par défaut. Les routes `path`
restent réservées aux choix explicites du menu.

Chaque perso destinataire déclare dans `actions[eventName]` le patch CodPlay
(`className`, `content` ou `attr`) qu’il applique. L’événement explicite porte
ses valeurs dans `event.data`. `data` auteur
reste statique pour les gardes et actions Sighty ; `updateContext` ne provoque
pas de transmission implicite aux scènes.

## Signet et repère de lecture

`context.signet` est la source lue par les gardes. Il contient les pages
terminées, le résultat du quiz du chapitre 1 et les résultats des trois
questions finales. Le repère situé au bas de chaque page utilise le
`scroll-container` et `emit.observe` de CodPlay ; son événement public est
traité par une action Sighty qui publie le nouveau signet avec le
`context.updateContext` fourni à cette action.

Après un échec, le résultat reste dans `context.signet` jusqu’à une nouvelle
réponse. Quand l’apprenant quitte puis relit la page du quiz, le `showMode`
hérité remet sa sélection, son feedback et `submitted` à leur état initial ;
il peut donc répondre de nouveau sans que la scène efface le signet.

Le contenu des pages, les questions et les règles de progression sont dans
[`course-data.ts`](../src/sighty/demo5/course-data.ts). Le graphe, les routes,
les guards et les actions Sighty sont dans
[`scenario.ts`](../src/sighty/demo5/scenario.ts). Les projections de menu
et de navigation utilisent les mêmes conditions dans
[`course-presentation.ts`](../src/sighty/demo5/course-presentation.ts). Les scènes de
contenu, de scroll et de quiz sont dans
[`content-page-scene.ts`](../src/sighty/demo5/scenes/content-page-scene.ts),
[`page-support.ts`](../src/sighty/demo5/scenes/page-support.ts) et
[`quiz-page-scene.ts`](../src/sighty/demo5/scenes/quiz-page-scene.ts).

## Présentation

Le layout partagé possède le menu à gauche, le titre de la page courante en
haut, la scène au centre, la navigation Précédent/Suivant en bas dans un seul
slot, et la télécommande Sighty commune ; son cadre suit le [contrat du layout partagé
Sighty](./sighty-demo-layout-spec.md). La lecture des scènes concernées démarre
à l’initialisation par la commande Sighty sur le layout ; les transitions
démarrent leurs sélections entrantes par le coordinateur Sighty. Le chapitre
courant apparaît en gras ; les chapitres et
pages sans accès apparaissent en italique ; les liens de page verrouillés ont
aussi une couleur atténuée (`#9baaba`) et reprennent le style de couleur normal
quand leur accès est accordé. Précédent est désactivé au début du cours ;
Suivant devient actif après l’observation du bas pour les pages de contenu, et
après la bonne réponse sur le quiz du chapitre 1. La page « Suivre le regard »
contient la vidéo de démonstration fournie dans les assets existants.

Les paragraphes des pages de contenu font de 182 à 229 mots (moyenne : 206),
pour produire plusieurs transitions d’observation au cours du scroll. Les
titres de section sont des persos `tag` sticky ; leur `liveAction` lit
`input.data.ratio` et interpole la couleur, avec des observations aux seuils
`0`, `0.2`, `0.4`, `0.6`, `0.8` et `1`. Chaque image est un perso `img` placé
dans un cadre `tag` observé depuis le scrollport. L’observation commence au bord
du viewport (`rootMargin: '0px'`). Comme le premier callback de l’observateur
synchronise la phase sans émettre `enter`, l’image materialisée démarre à
`translateX(0%)` : une image déjà dans le viewport est donc visible au
chargement. L’entrée d’une image dont la première mesure était hors viewport et
la sortie du cadre émettent chacune un event normal vers une action
`style.translateX` du perso image. Les bornes explicites de ces actions restent
`-112% → 0%` pendant 1000 ms avec `outCubic`, puis `0% → -112%` pendant 820 ms
avec `inCubic`. La durée laisse le mouvement visible pendant le défilement
jusqu’à environ la moitié du viewport. La transition est portée par l’action
CodPlay de l’image, sans classe CSS d’état ni `liveAction` redondante.

La vidéo reste un perso `media`. Deux persos `tag` enfants partagent son repère
central : l’observer de lecture utilise une zone rétrécie de 136 px sur les
bords haut et bas ; la vidéo est limitée à 272 px de haut, donc son centre
n’entre dans cette zone que lorsqu’elle tient entièrement dans le scrollport.
L’entrée déclenche l’action `broadcast: START` du média. Le second observer
utilise le scrollport entier et déclenche `broadcast: PAUSE` lorsque le centre
sort de la zone, ce qui correspond à environ la moitié de la vidéo masquée.
Les deux règles passent par `emit.observe` et les actions `media-sync` normales.

Les titres, paragraphes, cadres image et vidéos sont montés aux ancres
commentaire `<!-- data-part="…" -->` des sections. Ces points n’ont pas besoin
d’une boîte de layout auteur : les persos montés portent leur propre balisage
et leur propre présentation. Le seul outlet `div` conservé dans l’article est
celui du repère de fin, dont `min-height` et `margin-top: auto` règlent la
position basse dans la colonne flex.

Le quiz est indépendant de la démo Quiz Series. Il emploie les composants
`input` de CodPlay et le circuit `listen`/straps de la scène, puis transmet son
résultat par événement public à l’action déclarée dans Sighty.

## Vérification

Firefox 156.0.1 headless, viewport `1366 × 683`, sur `sighty.html?demo=demo5` :

- le bouton Suivant des pages de contenu s’active après le repère bas ; le quiz
  du chapitre 1 l’active dès la réponse correcte. Le titre, le compteur et le
  menu suivent les transitions `go` + action Sighty ; Précédent est désactivé à
  la première page ;
- le quiz 1 faux garde le chapitre 2 verrouillé et bloque Suivant ; une réponse
  juste active immédiatement Suivant et ouvre le chapitre 2 ; une cible
  verrouillée reste en italique, atténuée (`rgb(155, 170, 186)`) et refusée par
  le guard ;
- trois réponses finales justes affichent les félicitations ; une évaluation
  incomplète renvoie au début par `onDenied` ; le bouton de félicitations revient
  à « Repérer les grandes formes » et reverrouille les chapitres 2 et final ;
- les titres sticky et les transitions `translateX` des images sont vérifiés
  avec les observers et les actions CodPlay `enter`/`leave` ; une image déjà
  dans le viewport est visible dès la première présentation, une entrée
  ultérieure démarre au bord du viewport et reste visible jusqu’à environ son
  milieu ;
  la vidéo est chargée (`readyState = 4`), joue entièrement visible et s’arrête
  quand son centre quitte le scrollport (49,2 % de sa hauteur visible).

## Vérifications automatisées

47 tests Sighty, 48 tests component-v2 et 711 tests CodPlay réussis ;
typechecks Sighty, component-v2, CodPlay et démos réussis ; build Vite et
`git diff --check` réussis.

La visite Safari MCP du 2026-09-30 sur le build de prévisualisation charge le
cours et son menu, refuse une cible verrouillée, puis parcourt les dix pages.
Après un rechargement avec la première image déjà dans le scrollport, son
wrapper est à `translateX(0%)` et l’image est visible dès la première
présentation ; aucun `enter` initial n’est requis. Le repère bas active chaque
transition. Une image sortie puis réintroduite dans le scrollport est observée
à `-86%` après 100 ms, puis atteint `0%` après la durée du tween. Pour le quiz
du chapitre 1, une réponse fausse laisse `Suivant` désactivé ; après retour au
quiz, une réponse correcte l’active immédiatement, et son clic ouvre « Observer
la lumière ». Les trois réponses finales affichent les félicitations ; le
bouton de la conclusion revient à la première page et réinitialise les
verrouillages. Le parcours a été rejoué dans une session Safari MCP visible
afin que les observers et les événements publics soient livrés au runtime.

Les contrats généraux des conditions Sighty sont décrits dans
[`authoring-library-spec.md`](../../sighty/specs/authoring-library-spec.md).
Le contrat du repère scrollable et de son reset est décrit dans
[`scroll-container-spec.md`](../../codplay/specs/scroll-container-spec.md).
