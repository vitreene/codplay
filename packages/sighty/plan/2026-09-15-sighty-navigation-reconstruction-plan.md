# Plan — clôture du runtime Sighty

## Statut

**En cours.** Les corrections de surface ci-dessous sont intégrées et vérifiées.
Le CSS auteur des scènes de diffusion est intégré ; plusieurs décisions runtime restent ouvertes.

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
  Le smoke test du navigateur charge les cinq démos ; la démo 3 exécute son action
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
  vers CodPlay. Les actions qui ciblent une scène active transmettent l’événement
  sans sauvegarder ni restaurer le transport ; les actions CodPlay suivent le
  cycle normal de lecture et de présentation. Les tests runtime couvrent
  l’absence de seek automatique et l’effet des événements `entry` après la
  lecture normale.
- `SightyGraphView.replace` choisit le profil du passage vers la sélection
  entrante. S'il est absent, Sighty reprend celui du slot hôte ; il ne le
  transmet à `instances.mount` que si une relation active du même host sort
  dans cette transition. Le test ciblé vérifie l'override `mask-reveal` puis le
  repli `wipe`. La démo `replace-slot` reprend la hiérarchie chapitre de Demo 4 :
  `view-main` mène à `view-chapter`, qui porte le `coupling`, le slot ordonné
  des sept pages et le slot de télécommande. Elle réutilise la scène
  `telcoScene`, les intentions de navigation et de lecture, ainsi que le
  contrôleur telco de Demo 4 ; chaque page entrante déclare son profil
  `replace`. Brave a vérifié la navigation avant/arrière, les sept entrées et
  le bouclage aux deux bornes, ainsi que lecture/pause, seek et retour au début.
  Les typechecks CodPlay, Sighty et démos, le build démos et les deux fixtures
  ciblées passent. La suite complète Sighty passe (52 tests). Deux fixtures qui
  utilisaient `null` pour représenter des actions de tag sans effet ont été
  alignées sur le contrat `TagAction` courant avec `{}` ; aucun changement
  runtime n'était requis.
- La correction et la revalidation de la démo 5 sont terminées :
  `COURSE_PAGES` est l'unique source des entrées de page, le graphe des
  chapitres, les routes du menu et les scènes de page en sont dérivés dans
  `scenario.ts`, et le guard `page-access` du parent `view-course` est la seule
  règle d'admission héritée. La télécommande partagée cible les scènes exposées
  par `scenarioState.current` et ajoute seulement l’occurrence layout résolue
  par `runtime.getInstance`. L’acceptation automatisée est passée : 47 tests
  Sighty, 48 tests component-v2, 711 tests CodPlay, typechecks, build des
  démos et `git diff --check`. Le parcours MCP du navigateur couvre l’initialisation,
  le refus d’une page verrouillée, les repères bas, le quiz du chapitre 1, les
  trois questions finales, les félicitations et la remise à zéro.
- La transition d’image de la démo 5 suit désormais le circuit attendu par
  CodPlay : le cadre porte l’observation, l’image démarre à
  `translateX(-112%)`, puis les events `enter`/`leave` déclenchent sur le perso
  image des tweens `style.translateX` de 520 ms (`outCubic`) et 420 ms
  (`inCubic`). La classe CSS et la `liveAction` qui réappliquaient le même
  état ont été retirées. L’instrumentation DOM vérifie une mutation de style
  par action logique, sans double mise à jour de classe.

## Régression Demo 5 — repères de fin après recommencer — 2026-09-30

**Statut : En cours.** La réinitialisation du signet remet bien à zéro les
pages terminées et les réponses, mais les marqueurs `pageBottom` étaient
déclarés `once: true`. Le contrat scroll précise qu’un tel event ne peut partir
qu’une fois pendant la vie du player ; le retour à la première page conserve
les instances et ne réarme donc pas les marqueurs consommés. La première page
reste alors verrouillée vers la suite après son second défilement au bas.

**Correction appliquée pour le repère de fin :** garder l’observation
`emit.observe` et ses phases normales, retirer `once` des marqueurs de fin de
page et rendre le traitement Sighty idempotent tant que la page est déjà
inscrite dans le signet. Après la nouvelle action de replay, le signet vide
permet à la prochaine entrée du marqueur de réinscrire la page et de reprojeter
les gardes. Le comportement visuel après replay reste à vérifier dans le
parcours navigateur complet.

**Propriété `reset` des actions de relecture : En cours.** Sighty prend en
charge la liste `reset`, la restauration du contexte et les événements
`onReset` pour les occurrences conservées. Demo 5 utilise `reset: ['all']` au
redémarrage ; l’action route d’abord vers la première page, puis le runtime
restaure le signet, réinitialise les quiz conservés et rafraîchit la
présentation. Les pages suivantes reviennent en haut lors de leur réadmission
par leur `showMode: 'reset'`. Le contrat et ses tests figurent dans la
[spécification Sighty](../specs/authoring-library-spec.md) et le [plan dédié](./2026-09-30-sighty-replay-reset-plan.md).

Les étapes restantes et la matrice d’acceptation sont suivies dans le
[plan de la propriété reset par action de relecture](./2026-09-30-sighty-replay-reset-plan.md).
Le contrat runtime est vérifié par tests unitaires ; son intégration visuelle
dans Demo 5 reste à valider. Cette tranche reste côté Sighty et démo de
validation ; toute nécessité de modifier `packages/codplay` exigerait un plan
accepté distinct.

**Acceptation du repère :** rejouer le parcours Demo 5 jusqu’aux félicitations,
choisir « Recommencer le cours », vérifier que les accès et Suivant sont remis
à zéro, puis descendre au bas de la première page et vérifier que `pageBottom`
est de nouveau émis et active Suivant. Repasser par le même marqueur sans
réinitialiser le cours ne doit pas republier une progression déjà inscrite. Le
parcours navigateur complet reste à valider.

## Travail restant

- Valider l’action de portée héritée : une action de vue complète les actions
  événementielles descendantes qui n’en déclarent pas ; une action locale reste
  prioritaire. L’utiliser pour les routes de Demo 5. Acceptation : tests de
  résolution et parcours navigateur de la navigation du cours.
- Décider si une mutation peut remplacer `view.scene` sur la vue de départ ;
  la scène hôte doit alors être recréée, ou le patch refusé.
- Définir comment l’application reçoit le résultat de preload lorsque Sighty
  lance lui-même `preload.load()` ; ne pas réintroduire un callback Sighty.

## Dernière validation de la tranche `replace-slot`

- `npm run typecheck --workspace=codplay` — réussi.
- `npm run typecheck --workspace=@codplay/sighty` — réussi.
- `npm run typecheck --workspace=@codplay/demos` — réussi.
- `npm run build --workspace=@codplay/demos` — réussi ; l'outil de build
  signale aussi un chunk existant supérieur à 500 kB.
- `npx vitest run tests/replace-presentation.spec.ts` dans `packages/sighty` —
  1 test réussi.
- `npx vitest run tests/scene/authoring/slot-manifest.spec.ts` dans
  `packages/codplay` — 3 tests réussis.
- Le parcours MCP Brave précédent a vérifié la navigation avant/arrière, les
  sept pages, le bouclage `G → A → G`, pause/lecture, seek, rewind et projection
  de progression avec la télécommande Demo 4. La page F remplace
  `slide-over` (« Superposition ») par `mask-reveal` cercle en grille. Le profil
  arrive dans `replace-slot` avec `cellSize: 8`, direction centrée et stagger.
  Dans la même session Brave, la navigation réelle E→F a montré une seule vue
  sortante, un masque SVG de 65 cellules circulaires dont le scale est animé,
  sans canvas ; à la fin, la vue et le masque sont retirés et F persiste. Le seul
  message console reste le 404 favicon connu. Les tests d'intégration Sighty et
  CodPlay ciblés ainsi que les typechecks touchés passent.
- `npm run test --workspace=@codplay/sighty` — 52 tests réussis ; les deux
  fixtures de tag héritées qui déclaraient une action sans effet avec `null`
  utilisent désormais `{}` conformément au contrat.
- Le 2026-10-29, le même défaut a été corrigé dans la scène A partagée par
  Demo 1 et Demo 4 : `scene-a:set-content` et `scene-a:set-color` utilisent
  `{}` pour leurs actions sans effet, comme l'exige `TagAction`. Le parcours MCP
  Brave affiche le menu Demo 4 puis la scène A, son image chargée et ses quatre
  commandes ; aucune erreur de console. Le typecheck démos et `git diff --check`
  passent. Aucun changement runtime n'a été nécessaire.
- Le 2026-10-29, la démo `replace-slot` a été réalignée sur la structure de
  chapitre Demo 4 après constat que la navigation ne quittait pas la première
  page. Le graphe expose `view-main → view-chapter → slot-scene / slot-telco`,
  utilise les routes explicites par page et reprend la scène de télécommande
  existante ; le contrôleur ne relance plus l'entrante en parallèle de la
  transition Sighty. Une première lecture a aussi révélé que le défaut
  d'inactivité à 30 s terminait la séquence pendant que la telco projetait son
  état ; `idle: false`, comme dans Demo 4, supprime ce signal parasite. Brave
  vérifie maintenant `A → B → C → D → E → F → G → A` puis `A → G`, ainsi que
  pause/lecture, seek à 4000, rewind à 0 et les commandes globales. Après 32 s,
  aucune erreur Sighty/CodPlay n'apparaît ; le seul 404 console concerne
  `/favicon.ico`. Le modificateur CSS des fonds utilise la clé de scène
  (`page-a`…`page-g`), distincte de l'id Sighty (`view-page-a`…). Brave confirme
  les dégradés des pages A et B et l'absence du seek dans cette démo. La règle
  masque uniquement `.demo4-telco__seek` et conserve les quatre commandes.
  `npm run typecheck --workspace=@codplay/demos` et `git diff --check` passent.
- Le 2026-10-29, la page C de `replace-slot` présente aussi le split média SVG
  dans le parcours Sighty–CodPlay. Le profil d'entrée étoile reste porté par la
  vue Sighty ; la timeline de la scène CodPlay remplace une image avec des
  cellules étoile et une vidéo avec un chemin SVG auteur. Dans le navigateur
  Brave déjà ouvert, les deux remplacements ont parcouru le vrai player : 28
  cellules par grille image, 24 par grille vidéo, aucun canvas, clone vidéo
  sortant figé et vidéo cible en lecture. Le typecheck et le build des démos
  passent. La démonstration V2 `replace-carousel` garde le cercle par défaut et
  un chemin auteur. La revue visuelle utilisateur relève cependant que les
  étoiles se recouvrent sur l'image très large de la scène C ; la démonstration
  intégrée a été acceptée après adaptation du dimensionnement des formes à la
  surface média ; le contrat partagé est décrit dans la [spécification replace
  CodPlay](../../codplay/specs/replace-media-v2-spec.md).
