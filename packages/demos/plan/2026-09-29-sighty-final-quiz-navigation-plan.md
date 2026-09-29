# Plan — navigation du quiz final

## Statut

En cours — guard ajusté ; contrôle navigateur à confirmer.

## Opération

- Faire retourner `file`, `scenes`, `actions` et `guards` par
  `createCourseScenario()` ; `CourseComposition` transmet ce scénario complet à
  Sighty sans lui ajouter les gardes.
- Préfixer les références de guards par `guard:`. Déclarer
  `chapter-2.accessBy: 'guard:course:chapter-2-access'` pour exiger
  `context.signet.chapter1QuizPassed`, puis conserver le contrôle de progression
  des pages du chapitre 2. Le quiz hérite du `exitBy` commun de `view-course`.
- Sur une question finale, `Suivant` dépend de la présence d’une réponse validée
  dans `context.signet.finalAnswers`, vraie ou fausse, sans dépendre du scroll-end.
- Garder le scroll-end requis pour les pages de contenu et le quiz du chapitre 1.
- Au dernier item, une réponse fausse laisse `onDenied` ramener au début ; trois
  réponses justes ouvrent les félicitations.

## Acceptation

Contrôle navigateur dans Demo 5 : le chapitre 2 reste bloqué après l’échec au
quiz 1 et s’ouvre après sa réussite ; valider faux puis juste aux questions
finales 1 et 2 pour débloquer `Suivant` ; vérifier le retour au début après
l’échec à la question 3 et les félicitations après trois réponses justes. Après
validation, mettre à jour la spécification Demo 5 et retirer ce plan.
