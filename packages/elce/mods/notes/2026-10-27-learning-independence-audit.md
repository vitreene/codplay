# Elcé — audit des dépendances de Learning

Date : 27 octobre 2026. Révision inspectée :
`64e925517e19888dc76d7d872cd4ef79cb5fc88c`.

Cet audit prolonge l’[examen des ressources candidates](2026-10-27-learning-reusable-resources-study.md).
Il distingue les dépendances actuelles, les possibilités de réemploi et les
preuves effectivement obtenues. Les décisions d’extraction restent dans le
[plan Mods](../plan/2026-10-20-elce-mods-reconfiguration-plan.md).
Aucun déplacement ni changement de code de production n’est réalisé.

## Conclusion

Les capacités examinées peuvent fournir du métier réutilisable, mais leur
indépendance n’est pas acquise. Le document, les types transversaux, les
registres globaux et les assemblages de lecture les relient encore à la
composition actuelle. Déplacer leurs fichiers ne suffirait pas.

Le calcul d’Évaluation illustre une frontière déjà étroite ; le formulaire
Profil illustre une signature locale dont les imports chargent pourtant des
modules documentaires. L’historique et le service média présentent aussi des
dépendances à séparer avant de les présenter comme mécanismes indépendants.

Un défaut distinct a été reproduit dans la révision inspectée à la frontière
du cache des scènes Question. Il est corrigé depuis : les spécifications
[Preview](../../specs/player-preview-spec.md),
[Question](../../specs/question-bdc-spec.md) et
[Sommaire/profil](../../specs/summary-profile-spec.md) décrivent le contrat,
les tests et la vérification Safari. Cette note conserve l’analyse causale et
les sondes de référence avant correction.

## Méthode et portée

Les contrats de référence sont les spécifications
[documentaires](../../specs/document-model-spec.md),
[Sommaire/profil](../../specs/summary-profile-spec.md),
[Question](../../specs/question-bdc-spec.md),
[Évaluation](../../specs/evaluation-machine-spec.md) et
[preview](../../specs/player-preview-spec.md).
L’inspection du code cible les dépendances et le défaut que ces contrats ne
permettent pas de qualifier seuls.

Le script [inspect-imports.mjs](learning-independence-audit/inspect-imports.mjs)
parcourt les déclarations littérales d’import/export et les imports dynamiques
littéraux des sources TS/TSX de production sous `src/`, hors tests :

| Mesure | Résultat |
| --- | ---: |
| Fichiers | 196 |
| Déclarations résolues entre ces fichiers | 944 |
| Déclarations exclusivement de types | 483 |
| Autres déclarations internes | 461 |
| Déclarations résolues hors de ce corpus | 156 |
| Déclarations `node:` sans fichier résolu par cette inspection | 22 |

Le graphe complet contient une composante cyclique de six fichiers : les
types Carte, Carousel, Document, Question, Parcours et Sommaire/profil. Le
graphe obtenu en retirant les déclarations exclusivement de types ne contient
aucun cycle dans ce corpus. Un chemin comprenant des types décrit un couplage
de compilation ; il ne prouve pas un chargement à l’exécution.

Cette inspection n’analyse ni les dépendances externes récursivement, ni les
chemins calculés, CSS, assets, migrations ou points de lancement hors `src/`.
Elle ne mesure pas les effets du bundler ni la taille du code effectivement
chargé. Les résultats portent sur des déclarations, pas sur un nombre d’appels.

## Frontières observées

Les chemins ci-dessous sont relatifs à `src/`. Les séparations proposées
expliquent les couplages ; elles ne fixent aucune nouvelle API.

| Circuit existant | Dépendance observée | Séparation à examiner en D10 |
| --- | --- | --- |
| `domain/evaluation/chapter-evaluation.ts`, `evaluation-machine.ts` | Le score reçoit des identifiants, résultats et seuil ; la machine conserve ses transitions pures. Ils importent encore la configuration globale. Les types de la machine atteignent les types documentaires par `QuestionType`. | Conserver ces classes et leurs règles ; distinguer configuration de ressource, types de réponse et raccord au parcours. Aucune raison métier constatée de réserver l’Évaluation à Learning. |
| `domain/question/question-service.ts` | Le service importe `createStableId` depuis `document-model.ts`, outre les défauts globaux et ses types. | Séparer le mécanisme d’identité de la création du document ; garder les validations Question dans leur circuit existant. |
| `domain/summary-profile/profile-rules.ts` | Le module rassemble calculs sur valeurs, résolution des ancêtres, usages et invariants de l’agrégat. Son import du service média mène aussi à `document-model.ts` par `createStableId`. | Distinguer règles sur propriétés/valeurs et adaptation à la hiérarchie, sans recréer les calculs. |
| `builders/summary-profile/profile-form-scene-builder.ts` | Sa signature reçoit propriétés et valeurs, mais `resolveProfileValues` arrive par le module précédent. Le chemin de déclarations de valeurs rejoint le modèle documentaire par le service média. | Ne pas conclure à l’indépendance depuis la seule signature ; conserver le builder et séparer son calcul de profil de la traversée documentaire. |
| `builders/summary-profile/summary-scene-builder.ts` | Le builder reçoit `ElceDocument` et en déduit les entrées ; il dépend aussi des constantes globales. | Séparer présentation du Sommaire, construction des entrées du parcours et décisions d’accès. Le métier du Sommaire reste candidat au réemploi. |
| `reader-projection.ts`, `test-state-reconciliation.ts` | La projection reconstruit `ElceDocument` ; la réconciliation assemble profil, réponses, complétions et Évaluation. | Garder l’adaptation de l’agrégat dans sa composition et identifier les contributions métier de chaque ressource. Ne pas imposer `ProjectTestState` complet à une ressource isolée. |
| `appearance-color-generator.ts`, `appearance-resolver.ts` | Le générateur importe seulement un type depuis le résolveur. Celui-ci reçoit le document et interprète sa hiérarchie ; ses dépendances documentaires relevées sont des types. | Distinguer absence de chargement documentaire et indépendance des types. Le calcul des couleurs et la résolution des ancêtres sont deux responsabilités. |
| `builders/card/card-preset-builder.ts` | Le moteur importe le registre global `config/presets.ts`. | L’injection du registre reste un premier périmètre limité possible, sans clore la structure Mods. |
| `app/history/document-history.ts` | La fusion média des positions appelle le dispatcher documentaire complet. | Garder piles, regroupement et rétention ; fournir la transformation documentaire par le circuit de commandes retenu. |
| `domain/media/media-resource-service.ts` | La déduplication et le MIME voisinent avec l’import de `createStableId` depuis le modèle documentaire. | Préserver le service et la file existants ; examiner ce raccord d’identité avant de certifier le mécanisme commun. |
| Flux, Diapo, Section et `player/elce-player-composition.ts` | Les formats importent des contributions Résultat et des types d’état test ; Section assemble le profil ; le player rassemble l’offre actuelle, la projection, le parcours et l’état. | Conserver les ressources et la génération Sighty/CodPlay ; rendre leurs contributions explicites dans la composition choisie. Aucun lecteur ou catalogue parallèle. |

L’absence de chemin vers le document dans le calcul du score ne certifie pas
une ressource extraite. Inversement, le chemin documentaire du formulaire ne
signifie pas que ses règles nécessitent un document complet : il révèle le
regroupement actuel des modules. Les preuves d’indépendance devront exercer
les vraies classes avec des données propres aux tests et leurs dépendances
utiles, sans construire un faux document Learning.

## Défaut reproduit : réponses Question et cache de scènes

### Cause et frontière responsable

`createElcePlayerScenario` transmet les réponses du test à
`createPageSceneCatalog`. Celui-ci fournit `questionAnswers` aux builders Flux
et Diapo, qui initialisent sélection, état `submitted` et contrôles Question.
Pourtant, la signature du cache contient page, BDC, apparence, médias et
réglages, sans les réponses. Une signature identique retourne la source
précédente avant de rappeler le builder.

Dans la révision inspectée, `PopupPlayer` conservait la même `Map` entre deux
compositions. Son reset de progression vidait les réponses et demandait une
reconstruction ; la présentation d’un état rechargé après conflit empruntait
aussi ce chemin. Le défaut observé porte sur le réemploi d’une source construite
avec un état de réponse antérieur. La preview actuelle ne sauvegarde pas son
état sur le serveur, donc le chemin de conflit ne fait pas partie de son cycle.
L’observation ne prescrit pas d’ajouter cet état à la signature : la séparation
entre source réutilisable et état courant est implémentée et précisée dans la
[note de raccords](../../notes/2026-10-14-sommaire-profils-etude-raccords.md#cache-preview-et-état-de-consultation).
Aucun manque de capacité CodPlay ni besoin de second circuit de restauration
n’est établi par cette observation.

### Observations contrôlées

La [sonde catalogue](learning-independence-audit/probe-question-scene-cache.mjs)
utilise les commandes et builders actuels. La
[sonde de preview](learning-independence-audit/probe-question-preview.probe.ts)
monte et détruit la vraie composition Sighty/CodPlay sous jsdom, avec le même
document et deux choix dont le premier est correct :

| État initial du cache → état demandé | Source ou état rendu avec le cache conservé | Comparaison avec un cache neuf |
| --- | --- | --- |
| Sans réponse → réponse validée | Même source ; `submitted: false` ; choix non cochés et actifs. | Premier choix coché ; contrôles désactivés ; `submitted: true`. |
| Réponse validée → aucune réponse | Même source ; `submitted: true` ; premier choix toujours coché et contrôles désactivés. | Aucun choix coché ; contrôles actifs. |

Ces sondes décrivent la révision de référence, avant correction. Elles font
varier explicitement l’état d’entrée ; elles ne jouent ni le clic de reset de
la popup ni un conflit HTTP réel. Le test d’intégration ajouté depuis exerce le
reset et la reconstruction dans la vraie popup avec Sighty/CodPlay.

La correction conserve le circuit existant : scènes neutres, restitution de
l’état courant par Sighty, page active restaurée après reconstruction et page
de l’éditeur utilisée par « Synchroniser ». L’état de preview reste local ;
aucune réponse, progression ou navigation n’est écrite sur le serveur.

## Vérifications effectuées et limites

Les deux sondes ont été réexécutées et donnent les observations ci-dessus.
Leur rôle est diagnostique : le succès du test de sonde DOM vérifie notamment
la présence des deux contrôles, pas la conformité du comportement périmé.

La sélection de tests existants réexécutée comprend 16 fichiers : score,
machine d’Évaluation, Question, Carousel, Graphe, règles de profil, projection,
réconciliation, médias, presets, historique, scénario, composition, popup,
host et session d’état test. Résultat : **127 succès et 1 échec sur 128 tests**.
L’échec concerne `repeats an automatic Carousel by the configured number of
additional passes`, à `elce-player-composition.test.ts:1109`, après une attente
de 50 ms. Rejoué seul sans changement de code, ce test passe ; cela signale une
sensibilité aux conditions d’exécution, sans établir sa cause ni une stabilité
globale. Le relevé antérieur `2026-10-27-observations.json` annonce 132 tests
sans leur sélection détaillée ; ce chiffre n’est pas repris pour cette exécution.

Reproduction depuis la racine pour les sondes Node, puis depuis le package
pour Vitest :

```sh
node packages/elce/mods/notes/learning-independence-audit/inspect-imports.mjs /private/tmp/elce-learning-audit-imports.json
node packages/elce/mods/notes/learning-independence-audit/probe-question-scene-cache.mjs /private/tmp/elce-learning-audit-cache.json
cd packages/elce
../../node_modules/.bin/vitest run --config mods/notes/learning-independence-audit/preview-probe.config.mjs
```

La validation de la correction passe 504 tests sur 505 en suite complète ; le
test SQLite bloqué par `listen EPERM` passe seul avec accès à la boucle locale
(16/16). Typecheck et build passent. Le test d’intégration popup utilise la
composition actuelle et vérifie l’absence d’écriture API. Safari sur une base
temporaire confirme qu’une réponse validée disparaît à la réouverture, que
l’état test serveur reste vide à la révision 0 et que le prévol réseau `PUT`
est refusé (`403`). Ces preuves sont détaillées dans les spécifications
liées ci-dessus. Elles n’établissent pas l’indépendance de ressources qui
seraient extraites sous Mods ; D10–D13 restent **A relire**.
