# Plan — clôture du runtime Sighty

## Statut

**En cours.** Les corrections de surface ci-dessous sont intégrées et vérifiées.
Le CSS auteur des scènes de diffusion est intégré ; deux décisions runtime restent ouvertes.

## Intégration vérifiée

- La vue de départ du graphe racine désigne la scène hôte par `view.scene` ;
  `runtime.layout` et `storyId` ont disparu.
- `scenario.actions` et `scenario.guards` portent les fonctions référencées par
  les vues. Les clés enregistrées suivent respectivement les formes lisibles
  `action:<domaine>:<verbe>` et `guard:<domaine>:<prédicat>`, distinctes des
  identifiants de scène ; les vues acceptent aussi les fonctions inline, qui ne
  passent par aucun registre.
- `scenario` est la définition unique du parcours, sur le modèle d’une
  machine : il porte directement `id`, `version`, `format`, `showMode`,
  `data`, `views`, `scenes`, `sceneSources`, `guards` et `actions`. La propriété
  intermédiaire `file`, le type public `SightyFile`, le doublon
  `resources.scenes`, la normalisation de placements anciens, l’alias
  `view.graph`, les copies runtime des registres et `getViewGraph()` ont été
  retirés. L’index est dérivé de `scenario.views` et reconstruit sur mutation.
  La migration couvre les démos Sighty 1 à 5, dont la démo 5 qui construit
  désormais son scénario complet dans un seul module. Acceptation : 47 tests
  Sighty, typechecks Sighty et démos, build démos et `git diff --check`.
  Le smoke test Safari charge les cinq démos ; la démo 3 exécute son action
  d’injection, la démo 4 navigue vers la scène A et la démo 5 parcourt les dix
  pages, refuse une page verrouillée, affiche les félicitations après les trois
  réponses finales et restaure la première page et son titre après reset. La
  matrice générale de Play, Seek, resize et cycle de vie reste ouverte pour les
  autres tranches ; la démo 5 est stabilisée pour son parcours déclaré.
- `showMode` est défini dans le scénario ; le défaut runtime est `rewind`.
- `onPreloadWarning` a disparu de Sighty. Les erreurs runtime non bloquantes
  vont à `console.warn` ; les avertissements de preload restent dans le résultat
  du service preload.
- `runtime.styles` reçoit le CSS fourni par l’application et le transmet à
  `CodPlay.preload.css.set()` ; son application et son nettoyage sont testés.
- Une ressource de scène peut associer `{ sceneDoc, styleSheet }`. Sighty
  compile le document et installe le CSS sur `runtime.root` via le canal `@scope`
  existant, avant le montage ; une scène retirée libère son slot.

- La passerelle `RuntimeSceneEventGateway` est l’unique sortie d’événements
  vers CodPlay. Les actions qui ciblent une scène active conservent la position
  courante, réappliquent immédiatement l’état après l’émission et reprennent la
  lecture si elle était active ; le test runtime de matérialisation couvre ce
  contrat.
- La correction et la revalidation de la démo 5 sont terminées :
  `COURSE_PAGES` est l'unique source des entrées de page, le graphe des
  chapitres, les routes du menu et les scènes de page en sont dérivés dans
  `scenario.ts`, et le guard `page-access` du parent `view-course` est la seule
  règle d'admission héritée. La télécommande partagée cible les scènes exposées
  par `scenarioState.current` et ajoute seulement l’occurrence layout résolue
  par `runtime.getInstance`. L’acceptation automatisée est passée : 47 tests
  Sighty, 48 tests component-v2, 711 tests CodPlay, typechecks, build des
  démos et `git diff --check`. Le parcours Safari MCP couvre l’initialisation,
  le refus d’une page verrouillée, les repères bas, le quiz du chapitre 1, les
  trois questions finales, les félicitations et la remise à zéro.
- La transition d’image de la démo 5 suit désormais le circuit attendu par
  CodPlay : le cadre porte l’observation, l’image démarre à
  `translateX(-112%)`, puis les events `enter`/`leave` déclenchent sur le perso
  image des tweens `style.translateX` de 520 ms (`outCubic`) et 420 ms
  (`inCubic`). La classe CSS et la `liveAction` qui réappliquaient le même
  état ont été retirées. L’instrumentation DOM vérifie une mutation de style
  par action logique, sans double mise à jour de classe.

## Travail restant

- Valider l’action de portée héritée : une action de vue complète les actions
  événementielles descendantes qui n’en déclarent pas ; une action locale reste
  prioritaire. L’utiliser pour les routes de Demo 5. Acceptation : tests de
  résolution et parcours navigateur de la navigation du cours.
- Décider si une mutation peut remplacer `view.scene` sur la vue de départ ;
  la scène hôte doit alors être recréée, ou le patch refusé.
- Définir comment l’application reçoit le résultat de preload lorsque Sighty
  lance lui-même `preload.load()` ; ne pas réintroduire un callback Sighty.

## Acceptation réalisée

- `npm run typecheck --workspace=@codplay/sighty`
- `npm run typecheck --workspace=@codplay/demos`
- `npm run test --workspace=@codplay/sighty`
