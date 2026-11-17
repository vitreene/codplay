# Elcé — machine métier d’Évaluation

## Statut

**Machine métier implémentée et vérifiée. Le calcul de l’issue, les actions du
BDC Résultat et la politique de visibilité des réponses sont raccordés au
player ; le parcours navigateur de bout en bout reste à valider.**

## Contrat

`EvaluationMachine` applique les transitions d’une tentative d’Évaluation sans
effet de bord et retourne un état JSON-sérialisable. Elle ne possède ni acteur
autonome ni stockage : le runtime hôte conserve l’état et lui transmet les
événements. Les identifiants de Questions gardent l’ordre du chapitre.

Les paramètres sont le seuil, le nombre maximal de tentatives (première
tentative incluse, `null` sans limite) et la portée de reprise : toutes les
Questions ou seulement celles dont la réponse était fausse ou absente. Une
réponse validée contient les identifiants sélectionnés et attendus, ainsi que
les identifiants des choix présents dans la Question. Ces derniers servent à
réconcilier l’état test avec le document modifié et ne changent pas le calcul
du score. Une Question sans réponse compte comme fausse dans le score global. La machine
réutilise `ElceChapterEvaluation` pour calculer ce score et ne duplique pas sa
règle.

Une réponse peut aussi conserver `description`, `latencyMs` et `timestampMs`
reçus au moment de la validation. `latencyMs` reprend le `timeMs` logique de
l’événement public CodPlay de la scène Question ; `timestampMs` est l’horodatage
epoch de sa validation. Ces métadonnées ne changent ni le score ni les
transitions. `questionType` et les `answerLabels` ordonnés restent également
avec la réponse afin que l’adaptateur puisse produire le type et les valeurs
CMI attendus. Elles suivent la réponse qui la remplace lors d’une nouvelle
tentative. L’état métier sérialisé les conserve pour SCORM 2004, afin de
transmettre les interactions différées après reprise. L’adaptateur SCORM 1.2
les retire de `suspend_data`, qui ne transporte pas d’interactions CMI, tout en
gardant réponses et tentatives. Elles sont facultatives afin de relire les
états suspendus antérieurs à leur ajout.

Après `COMPLETE`, la machine passe à `success` ou `failure` selon le seuil.
Depuis `failure`, seul `RETRY` peut relancer l’Évaluation, si la limite
d’essais le permet. La portée « incorrectes seulement » conserve les réponses
justes pour calculer le score cumulé, mais ne réactive que les Questions fausses
ou absentes. `shouldRevealAnswers` reste faux pendant l’échec et la reprise.

Depuis `success`, `SUCCESS.REPLAY` ouvre `reviewing` avec toutes les Questions
et conserve leurs réponses sélectionnées et attendues. `shouldRevealAnswers`
est vrai uniquement dans cet état. `REPLAY.COMPLETE` revient à `success`.
L’action choisie dans la branche Réussite du BDC Résultat enverra
`SUCCESS.REPLAY` uniquement si l’auteur a choisi la relecture. Aucun événement
de relecture avec réponses n’existe depuis `failure`.

La machine expose ce contrat métier. Dans le player, Sighty conserve les
réponses validées dans son contexte, termine la machine après l’admission de la
page de résultat et envoie l’événement de branche correspondant à la scène ; la
story CodPlay de cette branche monte le BDC à son repère dans l’article. Les
événements publics Recommencer et Relire sont associés aux actions configurées
des branches Échec et Réussite. La vue Sighty accepte ces événements seulement
depuis le BDC Résultat de la page et du chapitre concernés, avec l’état métier
attendu. Elle route vers la première Question, réinitialise les réponses de la
portée active puis applique `RETRY` ou `SUCCESS.REPLAY`. À la fin de la dernière
Question relue, le marqueur de page applique `REPLAY.COMPLETE`.

Le builder Question reçoit le mode Évaluation depuis le type de chapitre. La
validation y publie le résultat à Sighty tout en gardant le retour et les
marqueurs de correction cachés. Lors de la restitution d’une réponse, le player
appelle `shouldRevealAnswers` de la machine pour choisir entre une restauration
verrouillée sans correction et une restauration avec correction. En Quiz
simple, la validation garde la révélation immédiate habituelle.

## Preuves

[`evaluation-machine.test.ts`](../src/domain/evaluation/evaluation-machine.test.ts)
vérifie la reprise globale, la reprise des seules Questions incorrectes, la
visibilité des réponses selon l’issue, le retour après relecture, la limite
d’essais et la restauration depuis un état JSON-sérialisé.
[`learning-player.test.ts`](../src/mods/learning/reading/learning-player.test.ts)
vérifie le parcours intégré Échec → Recommencer → Réussite → Relire dans le
player et la visibilité correspondante des corrections.
Le transfert des métadonnées depuis l’événement Sighty et une Question jouée
par le player réel est vérifié dans
[`scenario-builder.test.ts`](../src/builders/scenario/scenario-builder.test.ts)
et [`elce-player-composition.test.ts`](../src/mods/learning/reading/learning-player.test.ts).
