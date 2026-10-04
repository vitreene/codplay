# Elcé — machine métier d’Évaluation

## Statut

**Machine métier implémentée et vérifiée. Le raccord des actions des BDC de
résultat et de l’affichage des Questions dans le player reste à réaliser.**

## Contrat

`EvaluationMachine` applique les transitions d’une tentative d’Évaluation sans
effet de bord et retourne un état JSON-sérialisable. Elle ne possède ni acteur
autonome ni stockage : le runtime hôte conserve l’état et lui transmet les
événements. Les identifiants de Questions gardent l’ordre du chapitre.

Les paramètres sont le seuil, le nombre maximal de tentatives (première
tentative incluse, `null` sans limite) et la portée de reprise : toutes les
Questions ou seulement celles dont la réponse était fausse ou absente. Une
réponse validée contient les identifiants sélectionnés et attendus. Une
Question sans réponse compte comme fausse dans le score global. La machine
réutilise `ElceChapterEvaluation` pour calculer ce score et ne duplique pas sa
règle.

Après `COMPLETE`, la machine passe à `success` ou `failure` selon le seuil.
Depuis `failure`, seul `RETRY` peut relancer l’Évaluation, si la limite
d’essais le permet. La portée « incorrectes seulement » conserve les réponses
justes pour calculer le score cumulé, mais ne réactive que les Questions fausses
ou absentes. `shouldRevealAnswers` reste faux pendant l’échec et la reprise.

Depuis `success`, `SUCCESS.REPLAY` ouvre `reviewing` avec toutes les Questions
et conserve leurs réponses sélectionnées et attendues. `shouldRevealAnswers`
est vrai uniquement dans cet état. `REPLAY.COMPLETE` revient à `success`.
L’action du BDC Succès enverra `SUCCESS.REPLAY` uniquement si l’auteur a choisi
la relecture. Aucun événement de relecture avec réponses n’existe depuis
`failure`.

La machine expose ce contrat métier ; le player n’est pas encore relié à son
signal de visibilité. Les Questions, les réponses visibles et les commandes
des BDC Succès/Échec devront être raccordés au même état lors de l’intégration.

## Preuves

[`evaluation-machine.test.ts`](../src/domain/evaluation/evaluation-machine.test.ts)
vérifie la reprise globale, la reprise des seules Questions incorrectes, la
visibilité des réponses selon l’issue, le retour après relecture, la limite
d’essais et la restauration depuis un état JSON-sérialisé.
