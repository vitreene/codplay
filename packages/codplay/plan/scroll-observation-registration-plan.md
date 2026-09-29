# Plan — enregistrement des observations de scroll

**Statut : En cours.** `ScrollContainerComponent` possède les observers
`IntersectionObserver` de `emit.observe` et leur cycle de vie. Le comportement
reste enregistré par le composant, le module et la capacité scroll-container.

## Travail

- Déplacer la résolution des cibles, la création et le cycle de vie des
  observers dans `ScrollContainerComponent`.
- Retirer `CodPlayOptions.htmlHost`, `sourceAdapterFactories` et leurs usages.
- Émettre les events et actions live par les circuits player communs existants.
- Couvrir Play, Seek, reset, fin de séquence et destruction.
- Mettre à jour la spécification après implémentation et validations.

## Point technique à résoudre avant le code

Le composant reçoit son node matérialisé, les actions compilées et le port de
capture. Il ne reçoit pas aujourd’hui les ports d’émission d’events ordinaires
et d’actions live. Raccorder le composant aux circuits player existants avant
tout changement de contrat ; aucun chemin parallèle.

## Acceptation

- Aucun champ public `htmlHost` ni factory parallèle dans la façade ou le
  runner.
- Tests du composant et de l’intégration couvrant observations, Play, Seek,
  reset et destruction.
- Parcours navigateur des démos scroll-container et Sighty, typechecks et build.
