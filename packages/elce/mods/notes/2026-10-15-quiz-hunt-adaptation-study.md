# Quiz Hunt — étude d’adaptation en mod ELcé

Date : 15 octobre 2026.

Étude préparatoire, sans intégration réalisée. Le concept de mod et la
progression V2 sont regroupés dans l’[étude principale](2026-10-15-elce-mods-study.md).
La présente note conserve les différences, points d’adaptation et limites
propres à Quiz Hunt.

## Appréciation générale

Sighty/CodPlay fournit déjà la composition multi-scènes, les slots persistants,
routes non linéaires, gardes et événements utiles au jeu. Aucun besoin de
nouveau moteur général n’est établi. Le travail principal porte sur le
document, les relations de jeu, l’édition guidée, la composition du lecteur
et l’état de partie. L’adaptation dépasse largement un preset ou un sélecteur.

Le bénéfice serait d’écrire les épreuves avec les vrais outils ELcé et de
retrouver leurs contenus dans le jeu. La difficulté est de conserver ce
socle sans reproduire une application Quiz Hunt complète à côté. Cette
évaluation doit porter sur le développement et la maintenance, et comparer
l’alternative d’un projet distinct partageant des modules.

La [spécification de la démo](../../../demos/specs/sighty-quiz-hunt-spec.md)
établit des comportements vérifiés ; son
[suivi de reconstruction](../../../demos/plan/2026-10-09-quiz-hunt-sighty-reconstruction-plan.md)
conserve les décisions et preuves restantes. La démo n’est pas globalement
stabilisée : branches de finale, expiration concurrente, jeton/dépôt/retry,
replay, Seek et média ont des validations ouvertes. Elle utilise encore
des données, palette et styles V1 et son circuit de quiz de démo.

## Modèle documentaire et règles

Le mod installerait ensemble grille, panier/minuteur persistants, jeton,
épreuves, finales et résultat. L’auteur renseignerait les contenus et
réglages permis, sans construire leurs raccords. Ces widgets n’ont pas à
devenir des BDC autonomes globalement plaçables : ce placement n’existe pas
dans le contrat actuel des BDC.

L’organisation envisagée conserve un modèle de chapitre Quiz Hunt avec des
pages d’épreuve et de finale. Une épreuve associerait mot, groupe/couleur,
page d’indice/Question et page de finale par identifiants stables. Les mots
et relations auraient une seule définition ; grille, tirage et catalogue
Sighty seraient dérivés. La référence comporte quatre groupes, seize
épreuves et seize Questions finales, soit 32 Questions, et non seize.
Ce schéma conceptuel n’est pas encore un format approuvé.

Le tirage de référence est déterministe pour une même seed. Les épreuves
portent les statuts `available`, `success` ou `failed` ; une réussite remplace
le mot courant de sa couleur sans effacer les succès précédents. Une réponse
fausse ne crédite pas le panier et une épreuve résolue ne doit pas être
créditée deux fois. Ces règles relèvent de l’ensemble Quiz Hunt.

Les pages et BDC conservent leur identité et placement unique. Une Section
peut porter l’indice textuel ; les médias restent ceux du catalogue ELcé.
Question peut être enrichi ou donner lieu à des variantes spécialisées,
avec données/éditeur/builder propres si les comportements le justifient.
Le contrat actuel fournit sélection, validation et événement
`elce:question:answered` avec les identités des réponses. Révélation différée,
correction, feedback et reset nécessitent un cadrage explicite.

Le score au seuil de l’[Évaluation actuelle](../../specs/evaluation-machine-spec.md)
ne définit pas une règle universelle. Quiz Hunt recherche un panier complet
puis une finale gagnée ; une victoire peut coexister avec des épreuves
ratées. Le jeton réadmet une épreuve et n’équivaut pas à une tentative de
chapitre. Un modèle propre est donc à définir, sans généraliser d’abord
la machine Évaluation. Les branches et contenus Résultat peuvent être
réemployés, avec raccord du verdict et présentation à préciser.

L’ordre éditorial ne doit pas donner accès à une finale par « Suivant ».
Le graphe de lecture et les gardes suivent les relations du jeu ; le mode
Sommaire `free` ne fournit pas ces règles.

## Réglages et cohérence auteur

| Niveau | Possibilités à examiner |
| --- | --- |
| Ensemble | Titre, consigne, budget de temps, délai d’indice, feedback, correction et jeton. |
| Contenus | Groupes, mots, Questions, indices/médias et relations épreuve/finale. |
| Page | Surcharge éventuelle de certains délais, avec limites explicites. |
| Présentation | Variantes développées du layout et réglages visuels bornés. |
| Règles invariantes | Accès décidé par les gardes, absence de double crédit, panier persistant et reprise locale distincte d’une nouvelle partie. |

Ouvrir le nombre de groupes, rendre le minuteur facultatif ou changer le
remplacement des mots crée des variantes fonctionnelles à valider. Les
dimensions 4/16 de la référence constituent un point de départ à examiner.
La cohérence doit rester contrôlée par les commandes et invariants communs.

Les choix à préciser concernent notamment la suppression d’une finale
référencée, le retour d’une Question obligatoire au catalogue et le changement
de groupe d’un mot. Un document doit pouvoir être construit progressivement
sans accepter des références cassées. Validité structurelle et complétude
pour lancer une partie sont donc distinctes.

## Points d’adaptation concrets

Les [contrats du document](../../specs/document-model-spec.md), de
[Question](../../specs/question-bdc-spec.md), des
[profils](../../specs/summary-profile-spec.md) et de la
[preview](../../specs/player-preview-spec.md) décrivent les circuits actuels.
L’inspection ciblée a relevé les couplages suivants :

| Point | Situation et adaptation à examiner |
| --- | --- |
| [document-types.ts](../../src/domain/document/document-types.ts), [document-config.ts](../../src/config/document-config.ts) | v5 sans mod ; modèles Standard/Évaluation et réglages directement inscrits dans les types/configurations. Séparer données communes, identité du mod et données du modèle de chapitre. |
| [project-session-coordinator.ts](../../src/app/projects/project-session-coordinator.ts) | Création initiale unique et copie documentaire. Conserver le mod dans création, copie, secours et réouverture. |
| [page-commands.ts](../../src/domain/commands/document-commands/page-commands.ts), [document-invariants.ts](../../src/domain/commands/document-commands/document-invariants.ts) | Prolonger le circuit réel pour les relations de jeu et leurs opérations atomiques, sans validation parallèle limitée à l’interface. |
| [scenario-panel.tsx](../../src/app/remix/workspace/scenario-panel.tsx), [chapter-settings.tsx](../../src/app/remix/workspace/chapter-settings.tsx), [page-editor.tsx](../../src/app/remix/workspace/page-editor.tsx) | Exprimer les rôles épreuve/finale et les réglages permis, en réutilisant les éditeurs compatibles. |
| [scenario-builder.ts](../../src/builders/scenario/scenario-builder.ts) | Construit aujourd’hui layout, sommaires, profil, navigation, gardes et Évaluation. Déplacer les politiques Learning avant d’accueillir le parcours Quiz Hunt. |
| [elce-player-composition.ts](../../src/player/elce-player-composition.ts) | Dépend du tiroir Learning, de son CSS et de ses raccords. Conserver un cycle de vie Sighty/CodPlay commun avec une composition choisie par le mod. |
| [question-bdc-scene-builder.ts](../../src/builders/question/question-bdc-scene-builder.ts) | Builder partagé Flux/Diapo, correction immédiate actuelle. Enrichissement ou variante à choisir ; les mécanismes communs restent à réutiliser. |
| [test-state-reconciliation.ts](../../src/domain/summary-profile/test-state-reconciliation.ts) | État typé profil/pages/réponses/Évaluation. Définir les dépendances de partie et leur réconciliation après édition. |
| [sqlite-project-persistence.ts](../../src/server/projects/sqlite/sqlite-project-persistence.ts) | Projection explicite v5 en écriture/lecture. Un champ TypeScript ne suffit pas à conserver les réglages et relations serveur. |

Le cache des scènes doit tenir compte des réglages du mod qui influencent
leur construction. Tester une page isolée et jouer une partie doivent avoir
un sens explicite, sans fabriquer de progression pour ouvrir une finale.
Importer directement `QuizHuntComposition` ou la fabrique de quiz de la démo
ne constitue pas une intégration documentaire et applicative suffisante.

## Limites runtime et preuves manquantes

Les questions générales de séquencement et de neutralisation sont regroupées
dans l’étude principale. Les contraintes particulières à éprouver sont :

| Frontière | Point à conserver dans l’adaptation |
| --- | --- |
| Panier et temps | La référence garde panier/minuteur dans une même scène persistante. Suspendre le décompte ne doit pas mettre en pause toute la scène ni créer une seconde horloge métier. |
| Événements | Une réponse sortie ne reçoit pas de `send` ordinaire. Mettre les faits à jour et présenter l’état à l’admission des scènes concernées. |
| Expiration | Une transition concurrente pendant `changing` est rejetée. Exercer expiration/feedback/finale, sans file locale ou polling de compensation. |
| Jeton | L’intégration actuelle identifie ponctuellement une tuile dans le DOM partagé, puis transmet l’intention à Sighty. Cela ne certifie pas un DnD inter-scènes générique. |
| Reset et replay | Distinguer remise à zéro de Question, nouvelle tentative, nouvelle partie et Seek local. Sighty n’a pas d’historique temporel global ni de restauration sérialisée automatique. |
| Volume | La référence construit 32 scènes de Questions et conserve les occurrences visitées. Aucun seuil de performance n’est certifié ; démarrage, mémoire et médias restent à mesurer si les dimensions évoluent. |
| Capacités et export | Les capacités CodPlay se préparent avant le premier build/création. L’export portable des fonctions Sighty reste incomplet ; document sauvegardé et jeu autonome ne sont pas équivalents. |

**Vidéo Nostromo : divergence à conserver visible.** La spécification de la
démo décrit encore le handoff `media` vérifié, tandis que G5 et
[question-scene.ts](../../../demos/src/sighty/quiz-hunt/scenes/question-scene.ts)
utilisent un `tag` vidéo natif. Les preuves du premier chemin ne certifient
pas le second. ELcé utilise `media` indépendant avec STOP à la sortie ; le
cycle d’un indice vidéo doit être choisi et validé explicitement.

La découverte de `initial.attr.src` d’un `tag` est suivie dans
[CompiledScene](../../../codplay/plan/compiled-scene-plan.md#correctif-à-prévoir--src-dun-perso-tag),
et le reset du glyph dans le
[suivi Input](../../../codplay/plan/components-image-input-polygon-svg-plan.md).
Ces limites n’autorisent aucun correctif opportuniste du cœur.

## Sauvegarde, profil et reprise

Réglages et relations du jeu appartiennent au document ; tirage, statuts,
panier, jeton, temps et verdict appartiennent à l’état de lecture. Le contexte
Sighty ne les persiste pas automatiquement. La frontière d’état test existante,
ses ETags et ses conflits sont à réutiliser si une reprise est retenue.

Une nouvelle partie à l’ouverture et une reprise intersessions sont des
options à décider. Un checkpoint au menu est plus simple qu’une reprise au
milieu d’un indice, feedback ou glissement ; le temps restant seul ne
reconstitue pas ces phases. Temps hors session, contenu modifié et lecteurs
concurrents demandent leurs règles. Même sans reprise, reset du test,
changement de profil et synchronisation doivent avoir un effet défini.

La projection de profil actuelle peut retirer pages et chapitres. Retirer
une finale ou la dernière épreuve d’une couleur peut rendre la partie
impossible. La jouabilité après projection, l’ordre filtrage/tirage et les
messages auteur sont à décider ; aucune question de remplacement implicite
n’est proposée.

## Appréciation du coût et acceptation envisagée

Les difficultés fortes portent sur les relations documentaires, les commandes,
la composition du lecteur et la validation de l’ensemble. La reprise
intersessions ajoute un coût significatif. Aucun calendrier fiable n’est
établi. Un sélecteur de mod et des formulaires ne représentent qu’une part
limitée de l’adaptation.

Un parcours probant relierait création de page Question, édition et import
média, rattachement d’épreuve, sauvegarde/réouverture puis jeu jusqu’au
verdict. Il faudrait aussi exercer modification structurelle/Undo/Redo,
absence de double crédit, toutes les issues, expiration, pause métier,
retry pristine, profils, responsive, capture, média et nettoyage. Les tests
possèdent leurs fixtures ; la démo exerce le même runtime et les mêmes
circuits de production.

Cette étude conserve les constats documentaires et inspections déjà faits.
Aucun code, test comportemental, build ou parcours navigateur n’a été
réalisé pour certifier l’adaptation ELcé.
