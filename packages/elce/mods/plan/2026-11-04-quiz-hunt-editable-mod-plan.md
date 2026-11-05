# Quiz Hunt — plan d’exécution du mod éditable

Statut : En cours. Implémentation demandée ; les décisions de la
[note d’étude](../notes/2026-10-15-quiz-hunt-adaptation-study.md) sont acceptées.

## Résultat et périmètre

Créer le mod sous `src/mods/quiz-hunt/`, depuis son édition jusqu’à la lecture
réelle Sighty/CodPlay et à la reprise d’une partie. Réutiliser les ressources
Section, Question et Carte, le contrôleur XState, l’historique, la persistance,
les médias et la synchronisation communs. Les entrées et listes de projets
restent séparées pour le moment ; Learning reste le défaut. Ces choix ne créent
ni une base SQLite séparée ni une projection différente des BDC.
Le correctif général du Sommaire Learning reste dans son
[plan propriétaire](../../plan/2026-10-14-elce-sommaire-profils-plan.md#position-du-sommaire-dans-la-racine).

## Contrats et invariants

- Références : [document et ressources](../../specs/document-model-spec.md),
  [historique](../../specs/document-history-spec.md),
  [session](../../specs/project-session-spec.md),
  [API](../../specs/project-api-spec.md),
  [Question](../../specs/question-bdc-spec.md),
  [contrat du mod](../../specs/quiz-hunt-mod-spec.md),
  [Sighty](../../../sighty/specs/authoring-library-spec.md) et
  [jeu existant](../../../demos/specs/sighty-quiz-hunt-spec.md).
- Un propriétaire du document, une file et un historique. Les services du mod
  fournissent ses opérations ; les ressources n’importent pas son agrégat.
- Projet initial : page Sommaire racine déplaçable, chapitre Questions et
  chapitre Finales. Renommer un chapitre conserve son rôle. Les pages d’accueil
  peuvent précéder le Sommaire ; celui-ci n’entre pas dans un chapitre.
- Épreuve éditable librement, avec Question requise créée par défaut. Couleur
  choisie dans un select alimenté par le Sommaire. Supprimer une couleur conserve
  les contenus et retire leur affectation.
- Réserves de questions et finales distinctes, tirées par couleur. Seed initial
  modifiable et stable en édition ; en diffusion Random le renouvelle à chaque
  nouvelle partie, y compris Recommencer. Slots vides visibles et désactivés,
  même capacité par couleur, réglage du nombre de cases reporté.
- Obligatoire privilégie la question dans le tirage, sans condition de réponse
  pour la finale. Chaque couleur dispose de quatre slots : si plus de quatre
  questions sont marquées obligatoires, les quatre premières dans l’ordre de
  la banque sont tirées et le dépassement relève de l’auteur. Il ne bloque pas
  le lancement et ne doit provoquer aucune erreur du tirage.
- Sighty possède progression, accès et verdict. Une réponse est imposée avant
  retour au Sommaire. Panier/minuteur dans une scène persistante, extra dans le
  layout, menu/question dans le même slot, résultat au-dessus du menu.
- Deux animations de résultat préconçues, avec une Carte éditable chacune.
  La grille, la Diapo et ces présentations de résultat sont les stories du
  Sommaire auteur. Panier et minuteur restent des stories ressources ; l’extra
  est une action du layout. Préparer les stories pour extraction sans leur
  imposer l’état du jeu.
- Réouverture en diffusion : reprendre seed, réponses, panier et temps restant
  depuis une table `quiz_hunt_game_state` possédée par Quiz Hunt dans la SQLite
  commune. Les actions Sighty du mod pilotent sa lecture et son écriture ; elle
  ne modifie pas les tables BDC. Recommencer crée une nouvelle partie et
  renouvelle le seed en diffusion quand Random est activé.
- SCORM Quiz Hunt : son exporteur dédié produit un unique package monoSCO pour
  toute la partie, car banques, panier, minuteur et verdict forment un seul jeu.
  `suspend_data` conserve un état versionné reprenant seed, réponses, panier et
  temps ; l’adaptateur du mod réutilise `QuizHuntGameStatePersistence` et la
  session `@codplay/sighty-scorm`. Le verdict terminal devient `completed` et
  `passed`/`failed` selon l’issue ; aucun score numérique n’est envoyé. Une
  reprise terminale revient au Sommaire, reprojette les statuts, verrouille les
  cases et la finale, et garde l’issue sauvegardée et le verdict LMS.
  Recommencer efface l’état et le verdict LMS, puis suit la règle de seed de la
  diffusion. L’assemblage réutilise le package partagé, sans emprunter le flux
  Learning par chapitres.
- Une couleur n’est active que si le tirage lui fournit au moins une épreuve
  et une finale. Ses épreuves seules sont jouables ; les autres couleurs restent
  inactives. Le tirage final se fait parmi les finales des couleurs actives ;
  une réponse fausse produit un échec comme dans la démo. Sans couleur active,
  la partie ne démarre pas et l’auteur reste dans la construction.
- Entrées séparées pour le moment : Learning reste le défaut. Quiz Hunt possède
  une entrée explicite et son catalogue séparé dans l’interface. Les projets
  restent dans une base SQLite commune ; `projects.mod_key` filtre les listes
  (`learning` par défaut, `quiz-hunt` pour les projets du mod). Cette métadonnée
  reste hors du document et n’ajoute pas de registre applicatif.
- Les BDC communs utilisent exactement la projection relationnelle existante
  (`sections`, `questions`, `question_answers`, `cards`, `media_resources` et
  leurs tables de placement). Aucun document complet JSON ni aucune seconde
  représentation des BDC pour Quiz Hunt. Seules les données de jeu propres au
  mod peuvent avoir des tables dédiées référencées par les mêmes IDs.
- La ressource BDC prépare les requêtes SQL et convertit les lignes vers son
  contenu métier. La persistance de chaque mod conserve l’accès à la base, les
  transactions, l’organisation documentaire et l’exécution des requêtes.
  Learning et Quiz Hunt appellent le même code de persistance pour chaque BDC.
- Une évolution commune du BDC rejoint sa ressource et sa migration ; un réglage
  propre à un seul mod reste dans ce mod. Toute extension du BDC se décide selon
  sa portée, sans spécialiser son contenu partagé.
- Quiz Hunt sert de parcours d’acceptation pour révéler les limites de ces
  frontières. Le partage ultérieur de Questions entre Learning et Quiz Hunt
  reste une possibilité de conception, hors de l’implémentation présente.

## Actions et acceptation

1. [x] `mods/quiz-hunt/document/` : modèle auteur et opérations de création,
   renommage, ordre racine, banques et couleurs, sur les types des ressources
   existantes. Vérifier création puis édition d’une Question par le service
   ressource, renommage des banques, déplacement du Sommaire et suppression
   de couleur sans perte de contenu. Tests avec données propres.
2. [x] `resources/bdcs/*/persistence/` et
   `mods/learning/persistence/server/sqlite/` : placer près de chaque ressource
   la préparation des requêtes et la conversion des lignes de BDC ; adapter le
   dépôt Learning pour appeler ces opérations sans modifier son modèle ou son
   comportement. `mods/quiz-hunt/persistence/` exécute les mêmes opérations
   dans ses propres transactions et persiste séparément ses réglages. Les deux
   catalogues utilisent la base et les tables BDC communes. Vérifier les
   allers-retours Section, Question, Carte et média, puis la sauvegarde et la
   réouverture des deux mods. Ne créer ni base ni projection de BDC parallèle.
3. [x] `mods/quiz-hunt/reading/` et composants dédiés : générer le tirage et les
   scènes depuis le document, raccorder actions/gardes et reprendre les règles
   Sighty existantes sans importer la démo comme moteur du mod. Vérifier seed,
   slots vides, réponses, finale, expiration, extra et reset. Vérifier qu’un
   dépassement de questions obligatoires conserve les quatre premières sans
   faire échouer le tirage.
4. [ ] `mods/quiz-hunt/preview/`, `persistence/server/`, runtime SCORM et
   composition de diffusion : le projet chargé depuis le serveur démarre en
   mode release ; enregistrer et restaurer son état dans la table Quiz Hunt,
   puis vérifier Recommencer, absence de double crédit et conservation du
   temps. L’exporteur produit le paquet compact Sighty avec ses callbacks liés
   par identité ; l’exporteur SCORM Quiz Hunt dédié assemble ce paquet en un
   unique monoSCO avec l’assembleur partagé. Le runtime SCORM relance le vrai
   `QuizHuntPlayer` avec l’adaptateur du mod et
   l’état validé de `suspend_data`. Valider le ZIP, ses médias, la reprise LMS,
   le Sommaire et les commandes verrouillées à la reprise terminale avec le
   verdict conservé, le verdict sans score et Recommencer.
5. [ ] Valider les compositions publiques auteur, preview et diffusion, les
   cycles réels Sighty/CodPlay, les médias et le responsive ; typecheck, tests
   Elcé et build depuis le package. Mettre à jour la spécification interne avec
   les seuls mécanismes vérifiés ; conserver ici les acceptations restantes.

## Décision vidéo acceptée

Les vidéos d’une Question Quiz Hunt utilisent le composant `media` CodPlay par
le builder Flux partagé. Le builder reçoit les sources résolues du document et
projette `sync: 'independent'` avec les broadcasts de visibilité existants.
Quiz Hunt ne crée pas de balise vidéo `tag`, de préchargeur ni de commandes
média parallèles. Cette adaptation ne modifie pas CodPlay.

Pour certifier la tranche, valider une Question Quiz Hunt avec une vidéo dans
les parcours preview et release : source et composant dans le player réel,
commandes de visibilité, lecture/reprise, fin de page et responsive. L’action
4 reste ouverte jusqu’à cette preuve et aux autres critères SCORM ; l’action 5
reste ouverte jusqu’à la validation complète des compositions.
