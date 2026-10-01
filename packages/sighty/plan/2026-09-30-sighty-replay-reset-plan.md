# Plan — propriété `reset` des actions de relecture Sighty

## Statut

**En cours — conception validée par l’utilisateur ; runtime Sighty implémenté
et couvert par tests, intégration visuelle Demo 5 encore à valider dans un
navigateur.** Le contrat déjà couvert est inscrit dans la spécification Sighty.

Ce plan détaille la tranche « reset sélectif de relecture » du
[plan de reconstruction de la navigation Sighty](./2026-09-15-sighty-navigation-reconstruction-plan.md).
Il suit les contrats déjà vérifiés dans la
[spécification Sighty](../specs/authoring-library-spec.md) et n’autorise aucune
modification de `packages/codplay`.

## 1. Objectif

Permettre à l’auteur d’indiquer directement sur chaque action de relecture les
états à remettre à zéro ou les options de reprise à envoyer aux scènes. La
forme auteur visée reste une seule propriété `reset` contenant une liste ;
`['all']` est le raccourci explicite pour tous les effets pris en charge.

Cette liste peut demander deux sortes d’action : Sighty remet à zéro son
contexte ; une description de scène peut déclarer `onReset` pour transformer
les clés qui la concernent en événement métier. La scène traite alors son
état propre, par exemple celui d’un quiz, avec son circuit `listen`/`straps`.
La route reste indiquée séparément par `go`. Sighty ne déclenche pas
directement `telco.reset()` pour réinitialiser les réponses métier.

## 2. Revue des solutions Sighty existantes

Les contrats actuels offrent trois mécanismes proches, mais aucun ne couvre à
lui seul la relecture sélective voulue :

- `runtime.reset()` restaure le contexte et la composition initiale et appelle
  `telco.reset()` sur toutes les occurrences conservées. Il est trop large
  pour choisir entre contexte, quiz et solutions.
- `showMode: 'reset'` réinitialise une occurrence lorsqu’elle entre de nouveau
  dans la composition. Il ne remet pas à zéro les scènes quiz restées
  inactives et agit sur l’état CodPlay complet de l’occurrence.
- `SightyActionContext` permet déjà à une action de modifier le contexte et
  d’envoyer un événement, mais `send` exige une scène active. Il ne peut donc
  pas commander directement les quiz conservés hors de la composition.

Le meilleur ajustement minimal est de garder une seule liste `reset` sur
l’action et d’ajouter `onReset` à la description/source Sighty d’une scène.
`onReset` traduit les clés qui concernent cette scène en un `CodPlayEventime` ;
la scène le traite dans son circuit `listen`/`straps`. Sighty réutilise
`RuntimeSceneEventGateway` pour l’émission et les instances déjà conservées
dans son registre. Cela complète le circuit existant sans élargir l’API
publique de `send`, sans appeler `telco.reset()` directement pour l’état
métier et sans ajouter de profil ou de registre de commandes.

Pour la première tranche, le plan recommande aussi de garder les règles
suivantes simples :

- l’absence de `reset` signifie « aucun reset demandé » ; `['all']` doit être
  explicite. La valeur implicite `all` toucherait aussi les actions ordinaires
  qui n’ont pas demandé de reset ;
- commencer avec `context` côté Sighty et des clés de scène comme `quiz` et
  `solutions` ; `go` choisit déjà la destination de navigation ; les guards
  sont des fonctions pures évaluées depuis le contexte, pas un état à reset.
  Dans Demo 5, réinitialiser le contexte remet le `signet` à sa valeur initiale
  et réactive ainsi les guards ; aucune clé `navigation` distincte n’est
  nécessaire à ce parcours ;
- lorsqu’une clé de scène correspond à plusieurs occurrences déjà créées,
  envoyer l’événement à toutes celles de cette `SceneKey`. Ne pas ajouter de
  sélecteur d’occurrence tant qu’un scénario ne demande pas de ne réinitialiser
  qu’un slot ; ne pas créer d’occurrence pour un reset ;
- réutiliser l’envoi d’événements de Sighty. Ne pas ajouter de circuit ni de
  garantie transactionnelle spécifique au reset sans échec observé qui
  l’exige.

La proposition d’ordre suit le circuit actuel : résoudre et admettre `go`,
appliquer ensuite `reset`, puis exécuter le handler `action`. Dans Demo 5,
`go` cible la première page du chapitre, qui reste accessible quel que soit le
`signet` ; réinitialiser le contexte après l’admission ne bloque donc pas la
relecture. Les contrôles persistants sont rafraîchis par le handler qui suit.
Si un futur scénario doit évaluer les guards de destination avec le contexte
initial, l’ordre devra être revu sur cette preuve concrète.

`solutions` demande une exposition métier ; ce n’est pas un reset strict. Le
plan le garde dans cette même liste parce que c’est une option de reprise
concrète demandée pour Demo 5. Si d’autres effets de reprise apparaissent,
réévaluer alors le nom de la propriété au lieu d’ajouter dès maintenant un
second objet de configuration.

## 3. Frontières et invariants

- La propriété `reset` appartient à l’action qui déclenche la relecture, et
  non à un réglage global implicite du runtime.
- La forme retenue pour le plan est une liste explicite telle que
  `reset: ['context', 'quiz']` ou `reset: ['all']`. Le mot-clé simple `all` est
  préféré à `@all` et apparaît seul dans la liste ; l’absence de la propriété
  n’exécute aucun reset.
- Sighty possède l’action, les changements de contexte et l’acheminement des
  commandes vers les scènes.
- Chaque scène possède et modifie son état métier. Pour un quiz, cela comprend
  les choix, la validation, les états visuels des réponses et le feedback.
- `reset` est la liste de demandes portée par l’action. Sighty applique
  `context` ; une description de scène peut déclarer `onReset` pour choisir, à
  partir de cette même liste, un événement à retourner pour la scène.
- Le runtime envoie l’événement retourné par `onReset` à la scène par
  `RuntimeSceneEventGateway`. La scène gère son état métier par son circuit
  `listen`/`straps` existant.
- Les événements sortants restent centralisés dans
  `RuntimeSceneEventGateway`. L’extension réutilise cette passerelle ; elle ne
  crée pas un second circuit d’envoi.
- `showMode` garde son rôle de politique d’admission d’une occurrence. Le
  `runtime.reset()` global garde son rôle actuel. Aucun des deux ne remplace
  la propriété `reset` d’une action.
- Les règles des guards continuent de lire le contexte déclaré. Il n’y a pas
  de clé `guard` dans la proposition minimale : changer le contexte change les
  résultats des fonctions de guard sans les modifier.
- La démo 5 exerce le chemin runtime Sighty réel. Elle n’ajoute ni registre,
  ni routeur, ni circuit d’événements local.

## 4. Contrat retenu pour cette tranche

La liste couvre le contexte Sighty et les effets métier choisis par une scène.
Ces clés sont implémentées ainsi :

| Clé candidate | Traitement | Point à préciser |
| --- | --- | --- |
| `context` | Sighty | Restaure tout le contexte initial du runtime ; pas de sélection par champ dans cette tranche. |
| `quiz` | Scène, via l’événement renvoyé par `onReset` | Remet à zéro réponses, validation, corrections et feedback du quiz. |
| `solutions` | Scène, via l’événement renvoyé par `onReset` | Expose les corrections sans effacer les réponses. |

`all` couvre le reset du contexte Sighty et chaque callback de scène ; il est
transmis tel quel, sans catalogue ni expansion préalable. Il signifie le reset
de tous les états pris en charge et ne demande pas une exposition de solutions,
qui reste un effet opt-in. L’absence de `reset` ne fait rien. Une liste vide
est refusée par la validation auteur ; les clés non reconnues sont ignorées
par le runtime dans cette première tranche, sans registre supplémentaire.

Les scènes sont aujourd’hui cataloguées comme `SceneDoc` ou comme un objet
`{ sceneDoc, styleSheet }`. Ajouter `onReset` à cet objet de source réutilise
le descripteur existant ; `styleSheet` devrait rester facultatif pour éviter
de demander du CSS vide aux scènes qui n’en ont pas. Le callback est conservé
avec la source résolue, directe ou différée ; une source lazy sans occurrence
ne doit pas être chargée uniquement pour un reset.

Une même `SceneKey` peut avoir plusieurs occurrences indépendantes. La règle
simple proposée est d’appeler `onReset` une fois par clé qui possède déjà une
occurrence, puis d’envoyer l’événement retourné à toutes ses occurrences
conservées, actives ou inactives. Si aucune occurrence n’existe, ne rien
créer ni précharger ; il n’y a pas d’état d’instance à réinitialiser.

L’événement passe par la même passerelle Sighty, qui conserve le transport
CodPlay selon son chemin existant. Il n’y a pas de sélecteur d’occurrence ni de
rollback dédié au reset dans la première tranche.

### Exemple précis — recommencer Demo 5 depuis la conclusion

Dans le parcours actuel, `course-congratulations` n’est accessible qu’après les
trois questions finales réussies. L’apprenant a donc déjà parcouru les pages
du cours et créé les quatre occurrences de quiz : `chapter-1-quiz` et
`final-question-1` à `final-question-3`. Le bouton `Recommencer le cours` émet
`COURSE_EVENTS.restart`. La proposition pour cette action est :

```ts
'view-course': {
  showMode: 'reset',
  actions: {
    [COURSE_EVENTS.restart]: {
      go: { path: getCoursePagePath(COURSE_START_PAGE_ID) },
      reset: ['all'],
      action: 'action:course:refresh-presentation',
    },
  },
}
```

Le traitement attendu au clic suit cet ordre :

1. `go` revient à `chapter-1-intro`. Son admission applique
   `showMode: 'reset'` ; la première page commence donc à `scrollTop = 0`.
2. `reset: ['all']` restaure le `signet` initial et notifie les instances quiz
   conservées, y compris les trois quiz finaux inactifs.
3. `action:course:refresh-presentation` recalcule le menu et les boutons avec
   le signet vide. Suivant reste désactivé jusqu’au repère de bas de la
   première page.
4. À mesure que l’apprenant avance, chaque page est réadmise avec
   `showMode: 'reset'` et son scrollport revient alors à zéro via
   `ScrollContainerComponent.onReset()`.

Les pages ne sont donc pas toutes ramenées en haut au même instant que le
clic : la page de départ l’est immédiatement, les autres au moment où la
relecture les atteint. Le parcours complet produit un cours neuf et cohérent
sans ajouter un drapeau de reset à chaque page.

Le catalogue Sighty conserverait un callback par source de quiz. Cet extrait
montre la règle attendue ; le wrapper `sceneDoc` / `onReset` n’est pas encore
implémenté :

```ts
const quizSceneDescription = {
  sceneDoc: createQuizPageScene(page),
  onReset: (keys) =>
    keys.includes('all') || keys.includes('quiz')
      ? { name: `course-quiz:${page.id}:reset` }
      : undefined,
}
```

Dans le `SceneDoc` du quiz, ce nom serait écouté par le circuit existant. La
remise à zéro doit rétablir l’état logique et tous les états visuels :

```ts
straps: {
  'course-quiz-reset': () => ({
    update: { selectedAnswerIds: [], submitted: false },
    events: [
      { name: `${prefix}:selection:empty` },
      ...page.question!.answers.map((answer) => ({
        name: `${prefix}:answer:${answer.id}:reset`,
      })),
      { name: `${prefix}:feedback`, data: { content: '', attr: { hidden: true } } },
    ],
  }),
},
listen: [
  { on: `${prefix}:answer:select`, straps: ['course-quiz-select-answer'] },
  { on: `${prefix}:validate`, straps: ['course-quiz-validate-answer'] },
  { on: `${prefix}:reset`, straps: ['course-quiz-reset'] },
],
```

Chaque perso réponse ajouterait cette action `:reset` :

```ts
actions: {
  [`${prefix}:answer:${answerId}:reset`]: {
    selectedAnswerIds: [],
    checked: false,
    disabled: false,
    correctAnswerIds: [],
    disableAnswers: false,
    showCorrection: false,
    visualState: 'idle',
  },
}
```

Le bouton de validation reçoit `selection:empty`, et le feedback redevient
vide et masqué. Ce strap ne publie pas `COURSE_EVENTS.quizAnswered` : le
redémarrage ne doit pas réécrire le signet avec un faux résultat de quiz.

Il n’y a pas besoin d’une trace supplémentaire par scène pour ce reset :
Sighty connaît les occurrences conservées, le signet est dans le contexte
Sighty, et chaque quiz garde son état CodPlay. `showMode` dit déjà quand
réinitialiser une page à sa réadmission ; `reset` commande les effets
supplémentaires de cette action de replay.

La liste `reset` ne peut cependant pas neutraliser `showMode: 'reset'`. Dans
Demo 5, une action `reset: ['context']` ne notifierait pas immédiatement les
quiz, mais leur état serait tout de même réinitialisé lorsqu’ils seraient
réadmis. Pour conserver leurs réponses pendant toute la relecture, il faudrait
une configuration de replay persistante, détenue par Sighty et consultée à
l’admission des pages. Cette configuration globale constitue une décision
distincte ; elle n’est pas simulée par un statut recopié dans chaque scène.

## 5. Étapes d’implémentation

1. **[Fait] Ajouter le contrat minimal.** Ajouter `reset` à `SightyViewAction` ;
   valider qu’une liste vide est invalide, que son absence ne fait rien, que
   `['all']` est explicite, que `context` restaure le contexte initial et que
   la route reste portée par `go`. Appliquer `reset` après `go` et avant le
   handler `action`.
2. **[Fait] Étendre la description de source scène.** Ajouter un `onReset` facultatif
   au wrapper Sighty existant, avec `styleSheet` facultatif. Le callback reçoit
   la liste telle qu’écrite et renvoie un événement ou `undefined`.
3. **[Fait] Étendre la passerelle unique.** Pour chaque `SceneKey` qui a un
   `onReset` et des occurrences existantes, appeler le callback une fois puis
   envoyer son événement à toutes les occurrences retenues, par la même
   passerelle. Ne pas créer ni précharger de scène inactive.
4. **[Fait] Appliquer les resets Sighty et scènes dans l’ordre retenu.** Restaurer le
   contexte initial pour `context` ou `all`; traiter les notifications de
   scènes sans appeler `telco.reset()`.
5. **[Implémenté, parcours navigateur à valider] Exprimer `reset` dans Demo 5.** Utiliser `['all']` pour recommencer,
   `['quiz']` pour notifier immédiatement les quiz tout en conservant le
   signet et `['solutions']` pour exposer les corrections. Documenter que
   `showMode: 'reset'` réinitialise malgré tout un quiz lors de sa prochaine
   admission ; préserver son état sur plusieurs admissions exige la décision
   séparée sur une configuration de replay persistante. Rafraîchir les
   contrôles après la mise à jour du contexte.
6. **[Implémenté, parcours navigateur à valider] Faire traiter l’ordre par les scènes quiz.** Ajouter à `quiz-page-scene`
   un handler `listen`/`straps` qui applique ensemble les options reçues. Le
   reset `quiz` remet en cohérence état logique, réponses, bouton et feedback ;
   `solutions` expose les corrections sans publier une réponse du participant.
7. **[Documentation et vérifications runtime faites ; parcours navigateur restant] Valider le parcours réel et mettre les documents en accord.** Le contrat
   runtime est maintenant couvert par les tests Sighty, le typecheck et le
   build des démos, et décrit dans la spécification. Garder la validation
   d’intégration Demo 5 ouverte jusqu’à preuve du parcours réel.

## 6. Parcours et preuves d’acceptation

### Sighty runtime

- L’absence de `reset` préserve le comportement de toutes les actions actuelles ;
  `['all']` reste une demande explicite.
- Une scène quiz inactive mais conservée reçoit son événement sans création
  d’occurrence ni appel à `telco.reset()`.
- Une source directe et une source différée déjà résolue gardent le même
  comportement ; un reset seul ne déclenche pas une source différée.
- Si une `SceneKey` possède plusieurs occurrences, chacune reçoit son
  événement ; une occurrence détruite ou remplacée ne le reçoit pas.
- Les événements actifs conservent la position et l’état de lecture selon le
  contrat actuel de `RuntimeSceneEventGateway`.
- Analyse de portée : la sélection des cibles lit le registre des occurrences
  (`instanceSceneKeys` et `instances`) par `SceneKey`, sans consulter l’adresse
  du slot ou le parent. Un reparent ne change donc pas ce chemin de ciblage ;
  la destruction retire la cible du registre avant tout reset suivant. Les
  tests de deux occurrences d’une même clé couvrent la sélection par registre.
- Les tests Sighty utilisent leurs propres scènes et valeurs de fixture ; ils
  ne dépendent pas des scènes, assets ou temporisations de Demo 5.
- Preuves obtenues : 51 tests Sighty, typecheck Sighty, typecheck démos et
  build démos réussis ; `git diff --check` passe pour les fichiers suivis.

### Scènes quiz et Demo 5

- Depuis `course-congratulations`, `reset: ['all']` ramène immédiatement
  `chapter-1-intro` en haut, vide le signet et réinitialise les quatre quiz
  conservés ; les autres pages retrouvent leur scroll initial lorsqu’elles
  sont réadmises pendant la relecture.
- La remise à zéro d’un quiz efface réponses, validation, corrections et
  feedback, désactive le bouton de validation et ne publie pas de nouvel
  événement `quizAnswered`.
- Avec `showMode: 'reset'`, omettre `quiz` de la liste n’empêche pas le reset
  du quiz lors de sa prochaine admission. Préserver un quiz pendant la
  relecture exige donc une politique d’admission Sighty persistante à décider
  séparément.
- Après sélection et validation, une commande avec l’option quiz active remet
  en cohérence la réponse sélectionnée, les corrections, l’état validé, le
  bouton et le feedback.
- Les options de solution et de remise à zéro du quiz sont vérifiées
  indépendamment, y compris pour une commande reçue par une scène inactive.
- Des actions de relecture distinctes peuvent porter des listes `reset`
  différentes, dont `['all']` et une sélection partielle.
- Le parcours navigateur réel va jusqu’à la fin des quiz, déclenche chaque
  action de relecture concernée, puis vérifie navigation, guards, contexte,
  questions, feedback et solutions selon les clés `reset` de l’action.
- Cette preuve n’est pas encore obtenue : le MCP du navigateur n’était pas
  exposé dans les capacités de cette session.

### Matrice de validation

- **Play :** vérifier la relecture depuis la conclusion et la reprise normale
  des scènes concernées.
- **Seek :** vérifier qu’une commande n’altère pas la progression ou le
  transport d’une occurrence active ; vérifier qu’une occurrence inactive ne
  démarre pas.
- **Resize :** vérifier l’affichage des réponses, feedback et solutions après
  redimensionnement du viewport.
- **Cycle de vie :** les tests couvrent les occurrences inactives conservées,
  les occurrences multiples et les sources différées résolues/non résolues.
  Reparent et destruction ne modifient pas le circuit de cible : il utilise le
  registre actuel d’instances et de `SceneKey`, indépendamment des adresses de
  vue ; aucune mutation parent/enfant n’est ajoutée par cette tranche.
- **Tests, typecheck et build :** exécuter les suites Sighty pertinentes, les
  vérifications TypeScript des packages Sighty et démos, puis le build des
  démos.
- **Navigateur :** refaire le parcours complet de Demo 5 sur le chemin runtime
  réel avec le MCP du navigateur de cet appareil.
- **Statut navigateur :** le parcours reste à exécuter avec le MCP du
  navigateur lorsqu’il sera exposé à cette session.
- **Persistance :** hors périmètre ; la spécification Sighty ne définit pas de
  persistance sérialisée du parcours, et cette tranche n’en introduit pas.
- **Cœur CodPlay :** aucune modification prévue. Si l’API publique CodPlay ne
  permet pas le chemin requis, arrêter cette étape et ouvrir un plan séparé
  avant toute modification de `packages/codplay`.

## 7. État documentaire

La spécification Sighty décrit maintenant la propriété `reset`, l’ordre
d’exécution, `onReset` et l’envoi aux occurrences conservées. Le parcours
navigateur Demo 5 reste la preuve manquante avant de fermer ce plan.
