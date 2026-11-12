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
- Projet initial : Sommaire du jeu, chapitre Questions et chapitre Finales.
  L’éditeur présente le Sommaire comme l’entrée fixe de Learning ; les pages de
  jeu restent dans leur chapitre Questions ou Finales. Renommer un chapitre
  conserve son rôle.
- Épreuve éditable librement, avec Question requise créée par défaut. Couleur
  choisie dans un select alimenté par le Sommaire. Supprimer une couleur conserve
  les contenus et retire leur affectation.
- Réserves de questions et finales distinctes, tirées par couleur. Seed initial
  modifiable et stable en édition ; en diffusion Random le renouvelle à chaque
  nouvelle partie, y compris Recommencer. La grille responsive 4 × 4 affiche
  les épreuves retenues par couleur dans leur ordre global de tirage.
- Obligatoire privilégie la question dans le tirage, sans condition de réponse
  supplémentaire pour la finale. Chaque couleur dispose de quatre slots : si
  plus de quatre questions sont marquées obligatoires, les quatre premières
  dans l’ordre de la banque sont tirées et le dépassement relève de l’auteur.
  Une Finale est obligatoire par couleur. Elle reprend la couleur de sa
  Question de même nom ; si cette affectation manque au chargement ou à sa
  création, le document la rétablit depuis cette Question. Ces règles ne
  bloquent pas le lancement et ne doivent provoquer aucune erreur du tirage.
- Sighty possède progression, accès et verdict. Une réponse est imposée avant
  retour au Sommaire. Panier/minuteur dans une scène persistante, extra dans le
  layout, menu/question/résultat dans le même slot de contenu.
- Deux pages de résultat, Réussite et Échec, chacune avec une Carte éditable,
  un message initial et les actions Retour au Sommaire et Recommencer. Une
  réponse à la Finale ou une expiration du minuteur affiche la page
  correspondante dans le slot de contenu après la fin du feedback en cours,
  sans modale. Les textes des pages de résultat sont centrés.
  Le menu de partie
  reprend la grille 4 × 4 d’origine ; panier, chronomètre, jeton, question et
  verdict reprennent les scènes et styles de la démo Sighty. Panier et minuteur
  restent des stories ressources ; l’extra est une action du layout. Préparer
  les stories pour extraction sans leur imposer l’état du jeu.
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
   renommage, banques et couleurs, sur les types des ressources existantes.
   Vérifier création puis édition d’une Question par le service ressource,
   renommage des banques et suppression de couleur sans perte de contenu.
   Tests avec données propres.
2. [x] `resources/bdcs/*/persistence/` et
   `mods/learning/persistence/server/sqlite/` : placer près de chaque ressource
   la préparation des requêtes et la conversion des lignes de BDC ; adapter le
   dépôt Learning pour appeler ces opérations sans modifier son modèle ou son
   comportement. `mods/quiz-hunt/persistence/` exécute les mêmes opérations
   dans ses propres transactions et persiste séparément ses réglages. Les deux
   catalogues utilisent la base et les tables BDC communes. Vérifier les
   allers-retours Section, Question, Carte et média, puis la sauvegarde et la
   réouverture des deux mods. Ne créer ni base ni projection de BDC parallèle.
3. [ ] `mods/quiz-hunt/reading/` et composants dédiés : générer le tirage et les
   scènes depuis le document, raccorder actions/gardes et reprendre les règles
   Sighty existantes sans importer la démo comme moteur du mod. Vérifier seed,
   grille 4 × 4, réponses, finale, expiration, extra et reset. Vérifier qu’un
   dépassement de questions obligatoires conserve les quatre premières sans
   faire échouer le tirage. Vérifier aussi que le choix auteur de l’épreuve
   déclencheuse reste dans le tirage quand le seed change, sans remplacer les
   quatre premières questions obligatoires. Le rendu de jeu doit aussi respecter
   la décision de fidélité visuelle ci-dessous avant que cette action soit
   terminée.
   - [x] Choix du déclencheur dans l’Aperçu du Sommaire, persistance et maintien
     dans le tirage entre seeds vérifiés.
   - [ ] Lecture des anciens réglages : effacer toute cible hors banque
     Questions ; n’exposer que des Questions garanties dans la grille jouée.
   - [ ] Parcours extra à valider sur le jeu : apparition, collecte avec
     déplacement vers l’inventaire du panier, glisser-déposer sur une épreuve
     échouée, retour du jeton après un dépôt invalide ou annulé, puis reprise
     après l’animation de sortie. Le dépôt accepté demande au circuit de reset
     Sighty de remettre à zéro la Question ciblée ; le `onReset` de sa scène
     transmet l’événement de reset à la ressource Question avant la reprise.
   - [ ] Réponse à la Finale et expiration immédiate ou différée du minuteur :
     arrêter définitivement le chrono, afficher la vue Réussite ou Échec avec
     le temps passé et, en Échec, les nombres de Questions répondues et
     correctes ; vérifier les actions Retour au Sommaire et Recommencer. Après
     le retour, le Sommaire propose Recommencer et les tuiles restent bloquées
     jusqu’au démarrage d’une nouvelle partie. Une reprise SCORM terminale
     continue de commencer au Sommaire avec cette commande disponible.
   - [ ] Parcours des transitions du `slot-content` : fondu vers les vues
     Question et Finale, masque SVG en grille de cercles 8 × 8 à l’arrivée au
     Sommaire, puis volet vertical vers Réussite ou Échec. L’arrivée au
     Sommaire depuis une page de résultat garde son masque cercle.
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
   - [x] Typecheck, suite Elcé (601 tests) et build depuis `packages/elce`.
   - [x] Auteur, preview vidéo HTTP et affichage sans débordement à 390 px.
   - [x] Composition auteur Quiz Hunt et démarrage Learning.
   - [ ] Scénario auteur : Sommaire fixe comme Learning avec tous les réglages
     du jeu ; chapitre Introduction et page de contenu normale facultative ;
     dossier Résultat ouvrant ses deux pages auteur ; chapitres de banques avec
     leurs pages imbriquées, sans glisser-déposer ni commandes de
     réordonnancement. Les pastilles de couleur apparaissent dans Scénario pour
     les Questions et Finales ; les listes de tirage sont absentes des réglages
     Sommaire. Les deux résultats réutilisent leurs Cartes existantes.
     Le choix de la Question déclencheuse exclut les Finales et reste dans la
     grille réellement jouée. Un toggle de debug dans le Sommaire révèle, en
     prévisualisation auteur uniquement, le nom de chaque Question au bas de sa
     tuile et un « • » sur la tuile de l’extra activé. L’export release ne rend
     pas ces repères. `authoringGridDebug` est sauvegardé avec les réglages du
     document, ajouté à SQLite avec une valeur par défaut désactivée pour les
     projets existants, puis transmis uniquement par la session de
     prévisualisation. Vérifier le placement déterministe, le marqueur extra,
     l’aller-retour sauvegarde/relecture et l’absence des repères dans les
     scénarios Sighty et SCORM de diffusion. Panneaux responsives conservés.
   - [ ] Parcours complet diffusion/SCORM et média jusqu’à la sortie de page.

## Décisions acceptées pour l’interface auteur

Quiz Hunt reprend le cadre auteur partagé `renderEditorFrame`, ses panneaux
adaptatifs, ses commandes communes de prévisualisation et ses statuts d’export,
ainsi que les classes de panneau et de commandes déjà utilisées par Learning.
La grille et la zone centrale reprennent sans surcharge Quiz Hunt les règles
partagées par Learning : mêmes largeurs de panneaux, même host d’éditeur de
page et mêmes surfaces de travail. Les réglages de jeu restent propres au mod,
mais leurs conteneurs suivent ces surfaces communes et ne réduisent pas la
largeur de l’éditeur.
Le panneau Scénario reprend la hiérarchie de Learning : une entrée Sommaire fixe
à la racine, puis les chapitres Questions et Finales avec les pages affichées
dans leur chapitre respectif. Le document conserve l’identifiant de Sommaire
utilisé par le runtime, mais l’éditeur le présente comme son entrée Sommaire et
ouvre son espace au centre. La sélection d’un chapitre ou d’une page ferme
l’espace central courant. Le panneau Réglages expose l’inspecteur contextuel de
la sélection.

Le panneau Scénario ajoute un dossier Résultat avec deux pages auteur, Réussite
et Échec, qui éditent les deux Cartes déjà référencées dans les réglages du jeu.
Ces entrées réutilisent les BDC existants et ne créent ni pages de document ni
copies de Carte. Les pages de résultat affichent leur Carte et leurs actions
Retour au Sommaire et Recommencer dans le slot de contenu en fin de partie ; la
Carte Réussite est préremplie avec « Bravo ! » et « Vous avez remporté la
partie. », et la Carte Échec avec « Partie terminée » et « Vous pouvez
recommencer pour tenter de gagner, ou revenir au sommaire. ». Elles remplacent
la page active sans ouvrir de modale. Le dossier Introduction apparaît même lorsque son contenu est
absent ; le premier ajout crée son chapitre et une page Flux facultative,
éditée par les composants de page partagés et placée avant le Sommaire dans le
parcours du joueur. Cette page ne contient aucun réglage de l’application. Tous
les réglages du jeu, dont durée, délais, extra, couleurs, seed et cible du
jeton, se trouvent dans la page Sommaire. Sa section Aperçu regroupe le seed,
le tirage aléatoire et les réglages de l’extra ; la case Activer l’extra est
placée à côté du choix de la Question qui déclenche le jeton. Cette section
n’affiche pas les listes de tirage. Les durées et délais sont affichés et saisis
en secondes dans la Configuration du jeu ; le document et le runtime les
conservent en millisecondes. Le Sommaire propose également un toggle auteur de
debug de placement. Activé, il affiche dans la prévisualisation auteur le nom
de chaque Question au bas de sa tuile dans la grille réellement tirée et marque
par « • » la tuile de l’extra si celui-ci est activé. Les scénarios release ne
rendent pas ces repères. La colonne Scénario affiche une pastille de couleur à
côté de chaque Question et Finale qui en possède une.
Sans choix explicite, le tirage seedé choisit une Question réellement présente
dans la grille. Un choix explicite ne peut désigner qu’une page du chapitre
Questions, jamais une Finale ; il est conservé dans la grille en remplaçant une
Question aléatoire de la même couleur. Les quatre premières Questions
obligatoires restent prioritaires. Les choix proposés sont limités aux
Questions compatibles avec une Finale de leur couleur et avec cette capacité.
Si une modification éditoriale rend le choix incompatible, le réglage est
effacé et le tirage seedé reprend.
Aucun champ de présentation joueur n’est ajouté au modèle.

Le Scénario ne propose ni glisser-déposer, ni poignée, ni séparateur, ni flèche
de réordonnancement. Les listes reflètent l’ordre déjà porté par le document ;
les pages de jeu ne sont pas créées à la racine. Aucun changement n’est apporté
au cœur CodPlay.

Les actions auteur de Quiz Hunt qui ont le même nom ou rôle que celles de
Learning reprennent leur icône fonctionnelle et leur traitement accessible :
ajout avec Plus, suppression avec Corbeille. Les commandes d’ajout et de
suppression des couleurs suivent cette convention ; celles des pages et BDC
continuent d’utiliser les commandes partagées de Learning.

Les composants auteur appartenant à Elcé sont nommés selon leur rôle métier,
sans reprendre le nom d’un framework tiers. Le rendu partagé d’une Question
porte le nom `renderQuestionEditor` dans `question-editor.tsx`.

Dans la liste des pages du Scénario, le statut obligatoire est montré par une
icône d’exclamation accessible à la place du texte. La même icône apparaît à
côté de la case « Obligatoire » dans les réglages de la page éditée.
Quand une page a une couleur, l’icône d’exclamation précède la pastille dans la
ligne du Scénario.
La liste de premier niveau du Scénario utilise un espacement vertical un peu
plus grand que les listes imbriquées, qui conservent l’espacement de Learning.
La page active reçoit un fond légèrement teinté sur sa ligne afin de se
distinguer clairement sans modifier la géométrie de la liste.

Pour l’édition d’une page, Quiz Hunt reprend le layout commun de Learning
(`renderPageEditorView`, `elce-page-editor-layout` et `elce-work-area`) et les
éditeurs de ressources partagés. Les contrôles qui n’ont pas de comportement
pris en charge par le document Quiz Hunt ne sont pas affichés. La séquence des
BDC d’une page est réordonnable ; les Sections peuvent être supprimées et la
Question requise reste protégée. Le menu d’ajout reprend celui de Learning et
propose les Sections disponibles dans Quiz Hunt. Le Sommaire et les chapitres
utilisent le même host central, avec leurs réglages propres au mod à l’intérieur
de la surface de travail Learning. Dans l’éditeur Question partagé, l’illustration
occupe un tiers de la largeur du bloc et la liste de réponses s’étend sur toute
sa largeur.

Fichiers propriétaires : `src/mods/quiz-hunt/authoring/` et
`src/mods/quiz-hunt/document/quiz-hunt-document-service.ts`. L’acceptation
couvre l’éditeur public Quiz Hunt, le démarrage de Learning, la hiérarchie du
Scénario avec le Sommaire fixe et les pages imbriquées, et l’affichage mobile
responsive sans débordement. À dimensions identiques, la grille, les hosts
centraux, le cadre de page et les surfaces de travail doivent employer les
mêmes composants et règles CSS que Learning ; seuls le contenu métier et les
réglages propres au jeu diffèrent.

## Décision acceptée : fidélité visuelle du jeu

La lecture Elcé reprend exactement la présentation de la démo Sighty Quiz
Hunt. Les sources de référence sont ses scènes dans
`packages/demos/src/sighty/quiz-hunt/`, sa feuille
`responsive.css` et la feuille V1 `packages/demos/src/v1/scenes/quiz-hunt/quiz-hunt.css`
qu’elle importe. Cela couvre le layout, le Sommaire et ses tuiles, les panneaux
Question et Finale, le panier, le chronomètre, l’extra, le verdict et leurs
états et dispositions responsive. Les données et interactions restent celles
du mod Elcé et des ressources partagées ; aucune nouvelle présentation n’est
introduite dans cette adaptation.
Dans le panneau Question, l’instruction du type de réponse occupe toute la
largeur au-dessus de la grille à deux colonnes ; le premier choix commence dans
la colonne de gauche, comme dans la démo.

L’acceptation compare le jeu Sighty et la preview publique Elcé aux mêmes
dimensions, en portrait et paysage, sur le Sommaire, une Question, une Finale,
le panier/minuteur, l’extra et le verdict. L’action 3 reste ouverte jusqu’à
cette parité.

## Décision acceptée : transitions de pages

Les vues entrantes du `slot-content` portent les profils Sighty `replace` :
fondu (`fade`) pour les vues Question, leurs reprises et la Finale ; masque
`mask-reveal` en forme cercle, répété sur une grille 8 × 8 (`split: 'cells'`,
`cellX: 8`, `cellY: 8`), pour toute arrivée au Sommaire ; volet vertical
(`curtain`) vers les pages Réussite et Échec. Les profils et durées par défaut
du contrat CodPlay sont conservés.
La génération commune applique ces transitions en preview et en release ; ce
choix ne modifie pas le core ni le modèle auteur.

## Décision vidéo acceptée

Les vidéos d’une Question Quiz Hunt utilisent le composant `media` CodPlay par
le builder Flux partagé. Le builder reçoit les sources résolues du document et
projette `sync: 'independent'` avec les broadcasts de visibilité existants.
Quiz Hunt ne crée pas de balise vidéo `tag`, de préchargeur ni de commandes
média parallèles. Dans l’épreuve NOSTROMO, le média reste dans la zone d’indice
d’origine : la vidéo native est contenue dans son hôte, conserve son ratio et
reste entièrement visible. À l’ouverture de l’épreuve, le composant média
démarre la vidéo en muet et en lecture inline. Le timer reste suspendu pendant
la lecture native ; il reprend après la pause ou la fin de la vidéo, une fois
la question révélée. Le player Quiz Hunt transmet les événements natifs
`play`, `pause` et `ended` au graphe Sighty, qui reste propriétaire du timer.
La réponse arrête la vidéo par `STOP`. Cette adaptation ne modifie pas CodPlay.

Pour certifier la tranche, valider une Question Quiz Hunt avec une vidéo dans
les parcours preview et release : source et composant dans le player réel,
commandes de visibilité, lecture/reprise, fin de page et responsive. L’action
4 reste ouverte jusqu’à cette preuve et aux autres critères SCORM ; l’action 5
reste ouverte jusqu’à la validation complète des compositions.

- [x] Preview média : upload `video/webm`, lecture et plage HTTP, source projet
  dans le player réel, Question visible et aucun débordement horizontal à
  390 px.
- [ ] Ouverture d’une épreuve vidéo : lecture automatique sans clic, chrono
  suspendu jusqu’à la pause ou à la fin native après révélation de la Question,
  puis arrêt de la vidéo à la réponse.
- [ ] Release média : archive et source locale dans le player SCORM, puis
  commandes de visibilité, reprise de lecture et sortie de page.
