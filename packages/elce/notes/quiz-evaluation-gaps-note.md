# Points restant à raccorder dans l’évaluation par chapitre

Cette note consigne les deux écarts relevés dans le parcours de quiz Learning.
Elle complète les contrats détaillés dans les spécifications Question et
Évaluation ; elle ne décrit pas le contenu auteur destiné à `llms.txt`.

## Écarts relevés

- **Actions Recommencer et Relire :** les choix d’action des branches du BDC
  Résultat sont éditables et leur branche Réussite/Échec est montée dans le
  player. Les actions Recommencer/Relire ne sont pas encore raccordées aux
  transitions de la machine d’Évaluation.
- **Visibilité des corrections :** le rendu Question ne consomme pas encore
  `shouldRevealAnswers`. La politique propre à l’Évaluation — garder les
  corrections cachées après un échec et pendant la reprise, puis les révéler
  lors d’une relecture après réussite — n’est donc pas appliquée par le player.

## Références

- [Spécification Question](../specs/question-bdc-spec.md)
- [Spécification du chapitre Évaluation](../specs/chapter-evaluation-spec.md)
- [Spécification de la machine d’Évaluation](../specs/evaluation-machine-spec.md)
- [Plan de construction Elcé, critères des tranches Quiz et Évaluation](../plan/2026-10-01-elce-construction-plan.md)
