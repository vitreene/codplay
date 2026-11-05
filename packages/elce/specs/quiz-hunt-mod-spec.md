# Elcé Quiz Hunt mod — document auteur et persistance

## Responsabilité

Quiz Hunt possède son organisation éditoriale, ses réglages de jeu et ses
compositions de lecture sous `src/mods/quiz-hunt/`. Il réutilise les services
et les tables des ressources partagées pour les Questions, Sections, Cartes et
médias. Sa définition documentaire reste distincte de `LearningDocument`.

## Document et édition

Le document `QuizHuntDocument` étend `ResourceDocumentData` avec des chapitres
de banques `questions` et `finals`, des pages typées, l’ordre des entrées
racines et les réglages propres au jeu. Son codec stocke un enveloppe de
version 1, expose à sa racine `id` et `medias[].id` pour les index partagés du
cache IndexedDB, puis valide ses références avant d’admettre un document.

Un document initial contient un Sommaire racine, les deux banques, une page de
Question dans la banque Questions, quatre groupes de couleurs et deux Cartes
de résultat conservées au catalogue. Chaque page de banque possède une Question
requise ; l’auteur peut ajouter et ordonner des Sections autour de celle-ci.
Renommer une banque conserve son rôle. L’ordre racine peut déplacer le
Sommaire parmi les pages d’accueil sans l’affecter à une banque.

Chaque page porte son groupe couleur et son indicateur obligatoire. Supprimer
un groupe efface son affectation sur les pages concernées et conserve leurs
identités et leur contenu. Le tirage dispose de quatre slots par couleur ; il
retient les quatre premières pages obligatoires dans l’ordre de la banque,
puis remplit les slots restants. Dépasser cette capacité relève de l’auteur et
ne fait pas échouer le tirage.

`QuizHuntDocumentService` possède les opérations d’organisation du document et
délègue le contenu des Questions et des Cartes à leurs services de ressource.
Le contrôleur auteur conserve le document et l’historique dans son acteur
XState ; Annuler et Rétablir restaurent aussi la page sélectionnée.

## Lecture

`createQuizHuntGameCatalog` résout le tirage depuis le seed du document. Un seed
donné reproduit le tirage en édition ; en diffusion, l’option Random fournit un
seed à chaque nouvelle partie, tandis que Random désactivé conserve le seed
édité. Le jeu n’active qu’une couleur avec au moins une épreuve et une finale.
Le Sommaire affiche les slots tirés et les slots vides désactivés ; sans
couleur active, il n’expose aucune action de jeu.

`QuizHuntPlayer` compose les scènes de pages avec les builders Flux et Diapo,
la Question partagée, le Sommaire, le panier/minuteur, le layout et le résultat
dans le graphe Sighty. Les actions et gardes Sighty possèdent l’état de partie,
le verdict et la progression. Elles attendent la fin du feedback Question avant
de retourner au Sommaire. Une erreur à la finale produit l’échec ; Recommencer
recrée le lecteur et reprojette l’état initial selon la politique de seed.

Le panier/minuteur reste monté dans son slot pendant la navigation de contenu.
Le strap du panier planifie l’échéance comme événement public ; Sighty la
redirige vers le strap de minuterie. Une échéance pendant le feedback est
mémorisée et devient un échec après la fin du feedback.

L’extra est offert sur une épreuve choisie par le tirage et collecté par l’action
du layout. Le joueur hôte identifie le jeton par sa classe, lit la tuile sous le
pointeur avec `elementsFromPoint`, puis transmet la cible au graphe Sighty. Une
tuile en échec ne devient une reprise qu’après la sortie animée du jeton ; la
garde n’admet alors que cette épreuve échouée avec un extra disponible.

## Persistance

La persistance Quiz Hunt utilise la base SQLite commune d’Elcé. Elle conserve
les chapitres, pages, ordre racine, identités et placements des BDC dans les
tables relationnelles partagées. Les contenus Section, Question, réponses,
Carte et médias passent par les requêtes et conversions préparées par leurs
ressources. Les réglages Quiz Hunt, groupes et options couleur/obligatoire
restent dans les tables possédées par le mod. `projects.mod_key` filtre les
catalogues sans ajouter le mod au document.

Les contrats d’ouverture de la base, des routes de projet et des ressources
média figurent dans la [spécification API projet](./project-api-spec.md).

## Export SCORM

Quiz Hunt possède une route et un packageur SCORM dédiés. L’export auteur
produit d’abord le package Sighty du mod, avec `quiz-hunt-runtime.json` et les
médias référencés. `POST /api/quiz-hunt/exports/scorm` enveloppe ce package en
un unique SCO monoSCO avec l’assembleur partagé `@codplay/sighty-scorm` ; il
retourne une seule archive.

Le lanceur charge les données du sidecar et le bundle runtime Quiz Hunt. Celui-ci
valide le document, résout les URL médias depuis l’archive et démarre le vrai
`QuizHuntPlayer` en mode release. Il réutilise `QuizHuntGameStatePersistence`
avec `ScormSession` comme transport LMS.

L’adaptateur écrit dans `cmi.suspend_data` une enveloppe JSON versionnée de la
forme `{ schemaVersion: 1, documentId, savedGameState }`. Le run sauvegardé
conserve le seed et l’état de jeu, dont les réponses, le panier et le minuteur.
L’identifiant de page courant est le signet LMS. Une partie active est écrite
comme incomplète ; une issue terminale écrit `completed` et `passed` ou `failed`
selon le verdict, sans score numérique. Recommencer efface le run et le signet
LMS, puis remet l’état de progression à incomplet/inconnu avant de lancer la
nouvelle partie selon la politique de seed de diffusion. À la reprise d’un run
terminal, le lecteur revient au Sommaire sans réafficher la scène de résultat.
Le Sommaire reprojette les statuts sauvegardés, verrouille les cases et la
finale, et conserve l’issue ainsi que le verdict LMS terminal.

Le format générique de session SCORM est défini dans la
[spécification Sighty SCORM](../../sighty-scorm/specs/scorm-session-spec.md) ;
l’enveloppe générique des packages figure dans sa
[spécification d’assemblage](../../sighty-scorm/specs/scorm-package-assembler-spec.md).

## Références d’implémentation et tests

- [`quiz-hunt-document-service.ts`](../src/mods/quiz-hunt/document/quiz-hunt-document-service.ts)
  porte les opérations documentaires ;
  [`quiz-hunt-document-service.test.ts`](../src/mods/quiz-hunt/document/quiz-hunt-document-service.test.ts)
  vérifie la création et l’édition des Questions, l’ordre racine, les banques,
  les groupes et la conservation du contenu.
- [`quiz-hunt-game-draw.ts`](../src/mods/quiz-hunt/reading/quiz-hunt-game-draw.ts)
  dérive les slots et le seed de partie ;
  [`quiz-hunt-game-draw.test.ts`](../src/mods/quiz-hunt/reading/quiz-hunt-game-draw.test.ts)
  couvre la reproductibilité du seed, la politique de seed et les quatre
  premières questions obligatoires.
- [`quiz-hunt-player.ts`](../src/mods/quiz-hunt/reading/quiz-hunt-player.ts),
  [`quiz-hunt-scenario-builder.ts`](../src/mods/quiz-hunt/reading/quiz-hunt-scenario-builder.ts)
  et [`quiz-hunt-player.test.ts`](../src/mods/quiz-hunt/reading/quiz-hunt-player.test.ts)
  définissent et exercent la lecture réelle Sighty/CodPlay, dont réponse,
  finale, expiration pendant feedback, extra, reprise et redémarrage. La reprise
  terminale au Sommaire reprojette les statuts et garde les commandes
  verrouillées pour les issues succès et échec.
- [`quiz-hunt-sqlite-project-persistence.ts`](../src/mods/quiz-hunt/persistence/server/sqlite/quiz-hunt-sqlite-project-persistence.ts)
  conserve l’organisation Quiz Hunt et délègue les contenus BDC aux ressources.
  Son test SQLite vérifie la sauvegarde et la réouverture des BDC et médias
  dans la base partagée avec Learning.
- [`quiz-hunt-document-codec.ts`](../src/mods/quiz-hunt/persistence/quiz-hunt-document-codec.ts)
  conserve l’enveloppe versionnée et les index `id`/`medias` du cache partagé ;
  son test vérifie le round-trip du document.
- [`quiz-hunt-scorm-adapter.ts`](../src/mods/quiz-hunt/scorm/quiz-hunt-scorm-adapter.ts)
  adapte le run et le signet à la session LMS ;
  [`quiz-hunt-scorm-adapter.test.ts`](../src/mods/quiz-hunt/scorm/quiz-hunt-scorm-adapter.test.ts)
  vérifie la reprise, l’absence de score et la remise à incomplet au redémarrage.
- [`quiz-hunt-scorm-package-runtime.ts`](../src/mods/quiz-hunt/scorm/quiz-hunt-scorm-package-runtime.ts)
  lance le joueur réel depuis le package ;
  [`quiz-hunt-scorm-package.test.ts`](../src/mods/quiz-hunt/scorm/quiz-hunt-scorm-package.test.ts)
  vérifie le package monoSCO, le runtime et les médias.
- [`quiz-hunt-scorm-export-api-controller.ts`](../src/mods/quiz-hunt/persistence/server/quiz-hunt-scorm-export-api-controller.ts)
  expose la route dédiée et une archive unique ;
  son test vérifie le résultat monoSCO.
