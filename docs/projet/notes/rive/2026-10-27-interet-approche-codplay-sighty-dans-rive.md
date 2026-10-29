# Intérêt de l’approche CodPlay / Sighty dans Rive

**27 octobre 2026.** Note exploratoire sur la valeur de l’approche CodPlay
(CP) et Sighty (SY) dans l’environnement Rive. Elle conserve les observations
de faisabilité et recentre leur interprétation sur l’intérêt d’usage. Elle
n’établit ni contrat de portage, ni décision d’implémentation.

## 1. Cadrage : une destination avec ses propres composants

Dans la conception de CodPlay, le DOM est une matérialisation parmi d’autres.
Les composants sont conçus pour une destination : un contexte Rive demanderait
des composants adaptés à sa matérialisation et des composants exploitant les
richesses propres à cet environnement. Conserver une approche de déclaration
et de fonctionnement des scènes n’implique pas de conserver les composants
HTML ou de traduire leurs propriétés CSS.

La séparation entre état logique et présentation est déjà portée par la
[reconstruction logique](../../../../packages/codplay/specs/runtime-reconstruction-v2-spec.md).
La [spécification des composants](../../../../packages/codplay/specs/component-materialization-v2-spec.md)
distingue la base générique de sa spécialisation HTML. La
[note de portabilité](../../../../packages/codplay/projet/notes/2026-07-26-portabilite-contrainte-redaction.md)
explicite le besoin de composants propres à chaque plateforme. Cela ne certifie
pas l’existence actuelle d’un runtime CodPlay autonome dans Rive.

L’absence de DOM dans AnimaScript caractérise donc cette destination ; elle ne
constitue pas une objection de principe au modèle CP. L’intégration existante
où CodPlay héberge un document Rive correspond à un autre sens de composition.

La question étudiée est : **qu’apporterait l’approche CP/SY à un auteur qui
dispose déjà de Rive, et à quel coût de complexité ?**

## 2. Ce que Rive couvre déjà

Les capacités suivantes sont documentées par Rive ; les rapprochements avec
CP/SY sont une analyse, pas des équivalences de contrats.

| Préoccupation explorée par CP/SY | Moyens natifs Rive | Conséquence pour l’intérêt d’un apport |
| --- | --- | --- |
| Décrire une scène en texte | RML décrit les objets, leurs propriétés et leurs relations ; le CLI compile les fichiers. | Le caractère déclaratif, textuel ou accessible aux agents ne suffit plus à différencier CP. |
| Animer et réagir à des interactions | Animations, machines à états et transitions. | Refaire un moteur d’animation ou de transitions ajouterait un recouvrement important. |
| Conduire plusieurs comportements simultanément | Les layers de machines à états permettent plusieurs animations ou interactions parallèles. | Une story CP n’est pas automatiquement un manque de Rive ; sa valeur doit venir de sa sémantique d’écriture. |
| Partager et observer des données | View Models, bindings, listeners et scripts. | Distribuer une valeur vers plusieurs éléments ou réagir à son changement est déjà natif. |
| Composer des éléments réutilisables | Composants issus d’artboards, instances personnalisables, imbrication et changement de source par binding. | Réutilisation, imbrication et remplacement ne suffisent pas à justifier SY. |
| Organiser une interface adaptative | Layouts, listes, grilles et défilement. | Les composants adaptés devraient exploiter ces mécanismes. |
| Exprimer une logique spécifique | AnimaScript et les protocoles de scripts Rive. | La possibilité de coder une logique de parcours ou une séquence existe déjà. |

Sources : [RML][rml], [machines à états][state-machines], [layers][layers],
[data binding][data-binding], [composants][components], [layouts][layouts],
[AnimaScript][animascript].

Rive est ainsi un environnement de composition et de comportement complet.
Il serait réducteur de le traiter comme un simple moteur de dessin à piloter.
Il peut aussi porter une logique globale ; la distinction entre comportement
local et parcours global est un choix d’organisation, pas une limite établie
de ses machines à états.

## 3. Valeur possible de CodPlay : une écriture de la conduite de scène

La piste intéressante est l’expression d’une intention narrative : des acteurs
identifiés exposent des actions, et une conduite de scène les mobilise dans le
temps ou en réaction à des événements. Les composants peuvent alors conserver
leur richesse Rive : animation interne, rig, transitions, bindings et scripts.
Une action métier pourrait demander une expression ou une démonstration sans
redécrire leurs clés d’animation.

Rive permet déjà d’obtenir ces comportements. L’apport éventuel serait une
convention commune qui facilite la lecture, la variation et la réutilisation
de leur conduite entre plusieurs scènes. Il faut comparer ce gain à une
organisation native Rive bien conçue, incluant ses composants et ses scripts.
Remplacer une machine à états claire par une seconde description événementielle
ne produit pas en soi un bénéfice.

Le modèle temporel CP est un autre candidat : état initial, actions et faits
journalisés participent à une reconstruction partagée par Play et Seek. Il peut
servir à examiner ou rejouer une séquence interactive. La documentation Rive
expose le positionnement temporel d’une animation, mais cela ne démontre pas
une équivalence avec la reconstruction complète de ces faits et de leurs
conséquences. Cette différence reste à examiner sur un usage concret ; elle
ne prouve ni une impossibilité dans Rive, ni un besoin universel de journal.
[Contrat CP de reconstruction](../../../../packages/codplay/specs/runtime-reconstruction-v2-spec.md),
[pipeline événementiel CP](../../../../packages/codplay/specs/event-pipeline-v2-spec.md),
[positionnement des animations Rive][animation].

La bonne frontière d’une telle approche devrait rendre explicite qui décide
d’une propriété : conduite CP ou comportement natif Rive. Deux logiques qui
écrivent le même état sans responsabilité claire annuleraient le gain attendu.
La reconstructibilité d’un état natif interne ne doit pas être présumée.

## 4. Valeur possible de Sighty : un parcours explicite et réutilisable

SY apporte un vocabulaire de scénario : vues, routes, conditions d’accès et de
sortie, contexte, données d’entrée, sélection de scènes et politiques de
réadmission. Son intérêt possible dans Rive serait de rendre ces intentions
lisibles et réutilisables à l’échelle d’un ensemble de contenus.

Cela concerne notamment une formation avec plusieurs chapitres, des exercices
réemployés dans différents parcours, des conditions de progression et des
politiques explicites de conservation ou de remise à zéro. Les composants
Rive garderaient la réalisation de leurs interactions et de leurs transitions
visuelles. Le scénario exprimerait les règles du parcours.

Rive peut également programmer ces règles avec ses propres moyens. La valeur
de SY serait donc l’existence d’une convention de domaine partagée, validable
et indépendante des détails graphiques, lorsqu’elle réduit effectivement la
complexité de fabrication. Une expérience courte, avec quelques écrans et
transitions, peut rester plus simple en Rive natif.

Le [contrat SY actuel](../../../../packages/sighty/specs/authoring-library-spec.md)
décrit cette séparation, mais son runtime délègue aujourd’hui les occurrences,
montages, événements et commandes à CodPlay. Le modèle de parcours peut être
pertinent sans que ce runtime soit réutilisable tel quel. La pertinence de SY
n’oblige pas non plus à reprendre tout le modèle temporel de CP.

## 5. Exemple pour distinguer possibilité et intérêt

Considérer un exercice Rive avec une consigne, un personnage, une manipulation
et un feedback. Les animations, les états d’interaction, la présentation du
feedback et les bindings restent naturellement dans Rive.

Une approche CP pourrait être utile si le même exercice reçoit plusieurs
conduites : démonstration guidée, exploration libre, correction commentée.
Une approche SY pourrait être utile si cet exercice est réutilisé dans
plusieurs parcours, avec des conditions d’accès et des règles de réadmission
différentes. Les deux gains peuvent exister séparément.

Si ces variantes sont déjà claires et faciles à maintenir avec les composants,
View Models, machines à états et scripts Rive, une couche CP/SY peut surtout
ajouter des identités, des conversions et une seconde logique à comprendre.
La qualité du travail dans l’éditeur Rive compte autant que la concision du
fichier de scénario.

## 6. Appréciation et limites de l’observation

**L’intérêt paraît plus net pour une convention de parcours inspirée de SY et,
selon l’usage, pour une écriture narrative inspirée de CP.** Il paraît faible
pour une reprise générale des capacités d’animation, de composition et
d’interaction déjà fournies par Rive.

La faisabilité technique d’une réécriture ne suffit donc pas à justifier un
portage. Un examen utile comparerait la même expérience, avec les mêmes
variantes, réalisée en Rive natif puis avec l’approche proposée : lisibilité,
nombre de règles à dupliquer, facilité de modification, travail du designer
et responsabilités d’exécution. Le résultat peut justifier une simple
convention d’authoring, une génération de contenu natif ou un support runtime
spécifique ; aucune de ces formes n’est arrêtée ici.

Les observations reposent sur les spécifications CP/SY et la documentation
officielle Rive consultées. Aucun prototype de destination Rive ni aucune
validation de ses frontières d’exécution n’ont été réalisés. Les bénéfices
proposés restent des hypothèses d’usage.

[rml]: https://rive.app/docs/runtimes/advanced-topic/rml
[state-machines]: https://rive.app/docs/editor/state-machine/state-machine
[layers]: https://rive.app/docs/editor/state-machine/layers
[data-binding]: https://rive.app/docs/editor/data-binding/overview
[components]: https://rive.app/docs/editor/fundamentals/components
[layouts]: https://rive.app/docs/editor/layouts/layouts-overview
[animascript]: https://rive.app/rasc/docs/introduction.html
[animation]: https://rive.app/docs/scripting/api-reference/artboards/animation
