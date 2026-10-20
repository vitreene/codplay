# Quest — note exploratoire de récit découverte

Date : 15 octobre 2026.

Première idée de mod, sans cahier des charges ni réalisation décidée.
Le cadre commun et la progression ELcé V2 sont dans l’[étude des mods](2026-10-15-elce-mods-study.md) ;
le cas concret de comparaison est l’[adaptation Quiz Hunt](2026-10-15-quiz-hunt-adaptation-study.md).

## Intention

L’histoire avance par découverte et collecte d’indices, validation d’étapes
et choix qui font bifurquer le récit. Des contraintes issues de la logique
de profil permettraient de dévoiler progressivement le propos. Les boutons
de choix de chemin se trouvent directement dans les pages. Un délai local
ou une durée globale de jeu peuvent influencer les possibilités.

Chapitres, pages et BDC restent les objets éditoriaux ELcé. Les liens de
parcours se distinguent du regroupement et de l’ordre auteur : plusieurs
branches peuvent rejoindre une même page sans dupliquer son contenu. Une
représentation en graphe serait adaptée au non-linéaire. Le graphe auteur
et une éventuelle carte lecteur ont des rôles différents ; les passages
inconnus ou neutralisés ne doivent pas être révélés par simple automatisme
de représentation. Les gestes d’édition restent à préciser.

## Quelques décisions servant de passage

Ces exemples sont des possibilités à examiner, pas un périmètre fonctionnel
retenu. Une classe métier pourrait ramener une interprétation complexe à des
faits et décisions utilisés par les gardes du parcours.

| Mécanique envisagée | Exemple de passage vers une autre partie du récit |
| --- | --- |
| Rôle ou savoir | Un personnage capable de lire un symbole obtient le choix d’explorer une archive. |
| Dialogue et confiance | Aider un témoin rend une confidence accessible ; cette information ouvre une nouvelle piste. |
| Rapprochement d’indices | Une lettre et un registre permettent de valider une hypothèse et d’accéder à une confrontation. |
| Ressource et arbitrage | Dépenser une faveur ou utiliser un outil ouvre un passage, avec une conséquence sur d’autres possibilités. |
| Détour et objectif secondaire | Une rencontre facultative donne une connaissance utilisée plus loin, sans rendre toutes les pages obligatoires. |
| Mémoire du monde | Après un événement, revenir dans un lieu propose d’autres textes ou choix. |
| Conséquence différée | Un choix passé ouvre une issue différente lorsque plusieurs branches se rejoignent. |
| Échéance manquée | Un accès se ferme mais un détour devient possible, plutôt qu’une fin systématique du jeu. |

Un choix narratif n’est pas nécessairement une réponse juste ou fausse. Son
expression en BDC spécialisé ou en relation de scénario reste à déterminer.
La collecte n’impose pas non plus un inventaire universel : il faut préciser
si les indices sont conservés, consommés, combinés ou seulement découverts.
Le panier à remplacement par couleur de Quiz Hunt n’est pas ce contrat.

## Raccord aux capacités existantes

Sighty accepte déjà routes explicites, maps de vues, contexte, actions et
gardes. Les [conditions de profil ELcé](../../specs/summary-profile-spec.md)
offrent propriétés typées et ET/OU ; elles ne définissent pas encore les
événements d’acquisition et de choix de Quest.

Un exemple compatible avec les ports actuels serait une collecte émise par
la page active. Un handler sans `go` appelle la logique métier et actualise
le contexte ; la garde d’un passage lit ces faits. Le handler consulte cette
garde avec `scenarioState.canAccess`, puis envoie à la page active un événement
qui révèle le bouton. Le clic ultérieur demande la route déclarée, dont
Sighty réévalue l’accès. Une source différée déclarée peut produire la scène
à l’admission. L’écriture auteur de ces contenus et règles reste à réaliser.

Pour « valider et poursuivre » en une seule interaction, l’ordre actuel
`go` puis handler doit être examiné. Pour faire apparaître une nouvelle vue,
le raccord de mutation doit être précisé. Pour neutraliser un passage, il
faut décider ce qui subsiste de la scène et de son exécution. Ces questions
Sighty sont regroupées dans l’étude principale ; aucun contournement local
Quest n’est défini.

## Questions ouvertes

Les questions propres à Quest sont la représentation auteur des passages,
choix et conséquences ; la définition des indices et de leurs acquisitions ;
les effets des délais et expirations ; les informations visibles sur la
carte lecteur ; les retours sur un passage, le reset et une éventuelle reprise.

Temps d’animation, budget local/global et temps hors session ont des sens
différents. Leur présence ne demande pas automatiquement plusieurs systèmes
de minuterie. Un Seek local ne reconstitue pas tout l’historique du récit.
Sighty ne garantit pas une restauration sérialisée du parcours.

Quest sert de contrepoint pour éprouver les frontières communes : faits
acquis, conditions et conséquences peuvent être réutilisables, tandis que
leur sens appartient au récit. La comparaison ne décide ni API universelle
ni programme de développement. Aucun code ou validation d’intégration n’a
été réalisé pour cette piste.
