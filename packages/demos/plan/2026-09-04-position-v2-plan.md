# Démo position — plan V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Objet

Créer la démo `position` comme une scène de validation V2 progressive : les
positions, le reparenting, les trajectoires, la capture et les mouvements
imbriqués sont montrés dans six vues réunies par un carousel.

## Décisions retenues

- La démo reste une seule `SceneDoc` avec une story `main`. Le carousel est un
  `AutoCapsule` de type `carousel`, et ses intervalles sont calculés par
  `CapsulePreset` puis `CapsuleDistribution`.
- Le carousel utilise les événements `intro` et `outro` produits par
  `AutoCapsule`, mais ne les inscrit pas comme changements temporels
  automatiques. Le strap de navigation les émet uniquement après une flèche
  (ou Entrée). La sortie est une coupure (`cut`) : la vue précédente est
  masquée à la frontière, puis la vue entrante glisse horizontalement avec
  l'intro `swipe-left`. Une seule vue peut donc être visible, sans fondu
  croisé.
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
- Chaque vue est isolée dans `story-one.ts` à `story-six.ts`. `story.ts`
  assemble la story, `main.ts` assemble uniquement la scène, et
  `constants.ts`, `types.ts` et `shared.ts` isolent les éléments transverses.
- Espace produit un comportement de story : le strap bascule l'état, arrête
  les tweens courants par événement et relance la séquence visuelle de la vue
  courante par événement. Il ne pilote ni l'horloge du player ni `telco`.
- Le premier `move` est un eventime initial de la story, à `1 000 ms`, avec une
  durée de `2 000 ms`. Chaque reparenting d'item utilise cette même durée et
  un `move` explicite. Les mouvements des vues activées ensuite sont ajoutés
  par le strap de navigation sur le track de la story. La lecture temporelle
  ne change jamais de vue.
- Une occurrence ajoutée par un strap porte son `move` complet dans
  `event.data`. Le listen n'est pas réévalué lorsque l'horloge atteint un
  eventime planifié ; un simple nom d'event ne peut donc pas suffire à lancer
  un mouvement.
- La trajectoire de la troisième vue est une capture simulée. Les points
  capturés sont transportés dans `event.data.captureState`; un listen
  transforme ensuite ces données en événement `move` avec un chemin préparé
  par `prepareSvgPath`, selon la géométrie circulaire propre à la scène.
- La quatrième vue utilise des captures de déplacement sur la source et la
  cible. Les déplacements issus de `movementX/Y` sont conservés en pixels
  dans `event.data.style`, puis les rebonds ajoutés à l'activation portent un
  `move` complet. Lorsqu'une ancre est relâchée, le circuit
  capture → listen → strap émet en plus un rebond immédiat avec un path
  recalculé dans `event.data`.
- La représentation graphique des trajectoires reste une étape séparée. Le
  présent volet valide seulement les destinations, durées, reparentings et
  payloads de `move`.
- Aucun changement de `packages/codplay` n'est prévu pour cette démo.

## Travaux

1. Construire les six vues et leur groupe story-local dans
   `src/v2/demos/position/`.
2. Corriger et tester les `move` déclenchés par les eventimes de chaque vue,
   notamment les payloads dynamiques et les unités du drag de la vue 4.
3. Garder le code lisible pour un auteur : une vue par fichier, les fonctions
   communes dans `shared.ts`, les constantes dans `constants.ts`, et un
   assemblage séparé pour la story et la scène.
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
- La première vue lance son `move` à `1 000 ms` et le termine à `3 000 ms`.
- Les six vues montrent réellement les mouvements/reparentings via les
- actions `move` du runtime V2 ; chaque reparenting dure `2 000 ms` et les
  eventimes ajoutés à la volée contiennent leur payload `move` complet.
- La troisième vue produit un événement de mouvement dont le chemin vient de
  `event.data` après une capture, sans écriture DOM dans une fonction auteur.
- La quatrième vue applique le déplacement souris en pixels, recalcule
  immédiatement un rebond par strap après le relâchement d'une ancre, et
  exécute quatre rebonds planifiés comme des eventimes `move` complets de
  `2 000 ms`.
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
  d'outlet et porte `flipMode: 'overlay-world'` afin que le reparenting soit
  présenté par l'overlay pendant les `2 000 ms` de transition. L'amplitude des
  ancres est limitée à `2` unités numériques CodPlay au lieu de `32`.
- Validation ciblée : le test façade vérifie le payload `move`, le changement
  d'outlet avant/après la transition et la présence des deux conteneurs dans la
  grille de la story 2. La vérification visuelle de l'overlay reste à faire
  dans Safari.
- Défaut d'intégration identifié : lors d'un eventime ajouté live par la
  navigation, `RuntimePlayer` rematérialise bien le nouvel outlet, mais
  `HtmlPlayerRunner` ne recapture ses frontières de motion qu'à `init()` ou
  `resize()`. Le payload `flipMode` reste donc sans représentation overlay
  pour cette occurrence. Ce point appartient à une correction CodPlay dédiée ;
  aucun eventime statique ni contournement n'est ajouté à la démo.

## Reprise CodPlay à planifier

- La story 2 n'envoie pas les détails techniques `traversal` et `pathAnchor`
  dans son payload de `move`. Son mode de path est choisi par le helper de la
  démo ; les autres stories conservent l'ancrage centré nécessaire à leurs
  trajectoires. Une évolution ultérieure de CodPlay devra fournir une surface
  auteur explicite pour choisir ce comportement, sans exposer ces noms
  internes au code auteur.

- Défaut corrigé : un eventime ajouté par un strap était bien journalisé, mais
  son event n'était pas réévalué par `listen` à l'échéance. Avec une action
  `{}`, il ne pouvait donc pas produire de mouvement. Les eventimes de move
  portent maintenant leur payload complet dans `event.data`.
- Défaut corrigé : les nombres issus de `movementX/Y` entraient dans la
  projection des transformations comme des valeurs logiques `cqw`, ce qui
  amplifiait le drag. Les déplacements d'ancre sont désormais émis en chaînes
  `px` et le style DOM vérifié suit exactement le déplacement reçu.
- Décision appliquée : tous les reparentings d'items utilisent le même helper
  `createPositionMoveData` et une durée de `2 000 ms`; les plans des six vues
  transportent le `move` complet dans `event.data` lorsqu'ils sont ajoutés à
  la story.
- Réorganisation appliquée : `main.ts` ne contient plus que l'assemblage de la
  scène ; `story-one.ts` à `story-six.ts` portent les vues et leurs plans, et
  `carousel.ts`, `straps.ts`, `story-animation.ts`, `constants.ts`, `types.ts`
  et `shared.ts` portent les responsabilités transverses.
- Validé par `tests/facade/position-demo.spec.ts` : progression manuelle,
  premier move à `1 000 ms`, capture de la vue 3, quatre rebonds de la vue 4,
  reparenting imbriqué de la vue 5 et huit transferts de la conclusion.
- Validé par la non-régression ciblée façade/capture/motion : 5 fichiers et
  21 tests passent.
- Le serveur de développement V2 démarre sur `127.0.0.1:4173` sans retrouver
  l'entrée V1 dans le scan de dépendances. Le build complet du paquet reste
  bloqué par l'importation préexistante `@codplay/editor/builder/build-scene`
  depuis `src/v1/scenes/ed2-builder-scene.ts`; ce défaut hors périmètre n'est
  pas contourné dans la démo `position`.
- La validation navigateur visuelle, ainsi que la correction des dessins de
  trajectoire, restent à faire au volet suivant.
