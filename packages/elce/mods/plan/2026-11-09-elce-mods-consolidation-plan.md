# Plan d’exécution — consolidation des mods Elcé

**Statut : En cours.** Plan accepté pour exécution. M0, M1 et M2 sont validés.
Les previews Learning et Quiz Hunt sont exercées dans Safari avec des projets
temporaires supprimés après validation.

**Objectif.** Faire évoluer un comportement commun à Learning et Quiz Hunt
depuis un propriétaire unique, en conservant leurs documents, parcours et
adaptations spécifiques. Le [rapport d’audit](../notes/2026-11-09-mods-code-organisation-audit.md)
contient les constats et leur justification ; ce plan contient les actions.

Tous les chemins de travail ci-dessous sont relatifs à `packages/elce/`.
Le point de départ est la branche `elce`, commit `891aefce`, après l’intégration
de `elce-avatar` et les changements de routage par document. Les décisions de
routage Learning/Quiz Hunt sont maintenant fixes dans le
[plan de routage](../../plan/2026-11-09-elce-document-routing-plan.md). Le plan
de machines à états explicites reste `A relire` ; aucun lot de cette
consolidation ne modifie l’accès inter-fenêtres, la synchronisation ou le cycle
de vie de la preview qu’il couvre. Conserver les modifications locales déjà
présentes.

Commits inclus dans ce relevé : `9f2a7e88` (fusion Avatar), `91af3f67`
(interface et scénario), puis `891aefce` (routage par document). Les mesures M0
ont été recalculées au dernier commit ; le rapport d’audit lié ci-dessus reste
explicitement une photographie de `91af3f67`.

**Contrats à relire avant le lot concerné.**

| Concerné | Références propriétaires |
| --- | --- |
| Frontières et compositions | [Décisions Mods](2026-10-20-elce-mods-reconfiguration-plan.md), [Quiz Hunt](../../specs/quiz-hunt-mod-spec.md), [plan Quiz Hunt](2026-11-04-quiz-hunt-editable-mod-plan.md) |
| Document, BDC et texte enrichi | [Document](../../specs/document-model-spec.md), [Section](../../specs/section-editor-spec.md), [ancrage](../../specs/anchor-spec.md), [Graphe](../../specs/statistical-graph-spec.md) |
| Éditeur | [Organisation](../../specs/organization-editor-spec.md), [SPA Remix](../../specs/remix-spa-spec.md), [Carousel](../../specs/carousel-bdc-spec.md) |
| Écriture et accès | [Historique](../../specs/document-history-spec.md), [session projet](../../specs/project-session-spec.md), [cache](../../specs/document-store-spec.md), [API](../../specs/project-api-spec.md) |
| Lecture et export | [Preview](../../specs/player-preview-spec.md), [export Sighty](../../specs/sighty-export-spec.md), [export SCORM](../../specs/scorm-export-spec.md), [contrat Quiz Hunt](../../specs/quiz-hunt-mod-spec.md) |

**Invariants de tous les lots.** Un acteur documentaire, une file et un
historique par éditeur ; mêmes circuits de commit, média et synchronisation.
Conserver les formats JSON courants, les IDs, les routes, les discriminants
persistés, les statuts HTTP et l’isolation des catalogues par `mod_key`.
Les ressources utilisent le core ; elles ne dépendent d’aucun mod, directement
ou par un ancien point d’import. Chaque mod conserve son agrégat, son parcours
et l’exécution de ses transactions. Le périmètre de code est Elcé ; toute
modification de `packages/codplay` demanderait une autorisation distincte.

L’ordre proposé est M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9.
Chaque lot laisse le projet utilisable et retire le code remplacé. Mettre à
jour la spécification propriétaire après sa validation ; garder ici toute
acceptation inachevée. Une divergence de contrat découverte bloque uniquement
la transformation qui en dépend.

**M0 — Établir le point de comparaison.**

- [x] Relever les versions des codecs et la liste ordonnée des migrations
  réellement présentes. Les anciennes mentions de version dans les guides ne
  doivent pas servir de valeur initiale au refactor.
- [x] Relever les imports avec le parseur TypeScript et la résolution du
  `tsconfig.json`, selon la méthode de
  `mods/notes/learning-independence-audit/inspect-imports.mjs`. Inclure imports
  de types, réexports, chemins historiques et imports dynamiques littéraux.
- [x] Exécuter la suite du package, le typecheck et le build ; distinguer les
  éventuels échecs initiaux.
- [x] Préparer des projets temporaires Learning et Quiz Hunt pour les parcours
  réels. L’API confirme leur synchronisation et leur rechargement ; les
  documents ont été fermés puis supprimés par le sélecteur. Une lecture SQLite
  confirme qu’aucun document `M1 validation%` ne subsiste. Les données
  personnelles n’ont pas servi de fixture.

Point de comparaison au commit `891aefce` : document Learning version 14 et
enveloppe du codec Quiz Hunt version 1 ; 19 migrations Learning et 4 Quiz Hunt
chargées par le serveur. Une migration
`20261102120000` existe aussi sous `src/server/projects/sqlite/migrations/` ;
ce dossier n’est pas chargé par le serveur et son homonyme Learning doit être
rapproché dans M7. Ses fichiers SQL `up` et `down` sont identiques à ceux du
répertoire Learning. Ordre fusionné effectif par ID :
`20261007143000_create_elce_project_tables`,
`20261008120000_add_question_validation_label`,
`20261009100000_add_statistical_graph_tables`,
`20261011180000_add_project_edit_access`,
`20261012120000_add_project_edit_lease`,
`20261013100000_add-statistical-graph-heading-flags`,
`20261013110000_add-statistical-graph-transposition`,
`20261013120000_store_statistical_graph_json`,
`20261014100000_add_summary_profile_test_state`,
`20261015100000_add_summary_page_continuation_mode`,
`20261024120000_add_appearance_settings`,
`20261024190000_flatten_demo5_local_appearance_presets`,
`20261025120000_rebuild_appearance_class_system`,
`20261102120000_add_page_early_exit_setting`,
`20261103120000_add_card_revelation`,
`20261104120000_add_project_mod_key`,
`20261104130000_create_quiz_hunt_settings`,
`20261105100000_create_quiz_hunt_game_state`,
`20261105120000_add_avatar`,
`20261107120000_add_quiz_hunt_extra_trigger`,
`20261108120000_add_custom_appearance_colors`,
`20261108130000_add_nested_scenario_chapters`,
`20261108140000_add_quiz_hunt_authoring_grid_debug`.

Le graphe contient 411 fichiers de production et 2 137
arêtes internes ; aucune importation relative ne reste non résolue. Deux
dépendances directes resources → Learning subsistent ; 10 fichiers resource
atteignent Learning (8 par des imports de valeur) ; 18 fichiers Quiz Hunt
atteignent Learning (15 par des imports de valeur). Le core atteint un seul
fichier de mod par un chemin de type et aucun par un chemin de valeur.

Depuis `packages/elce/`, `npm run typecheck` et `npm run build` passent. Le
build garde l’avertissement existant sur le chunk `canvas_advanced_single`
(2,66 Mo). `npm test` donne 616 succès et 20 échecs sur 636 tests : attentes de
version 12 alors que le document est version 14, contrats d’export, scénarios
Quiz Hunt, deux tests serveur bloqués par `listen EPERM`, et tests d’éditeur,
Avatar et profil. Ces échecs sont le point de comparaison ; ils ne sont pas
attribués à M1. Le script de graphe classe aussi 37 imports `node:` comme non
résolus ; ce sont des built-ins Node, à exclure du futur diagnostic M8.

Acceptation M0 terminée le 10 novembre 2026 dans Safari Technology Preview.
Depuis `/`, les projets Learning et Quiz Hunt ont été créés par le sélecteur,
ouverts sur `/learning/:documentId` et `/hunt/:documentId`, puis prévisualisés
depuis l’éditeur. Le serveur a créé et relu le document Learning (version 14,
révision 0) ; la preview affichait « Elcé — lecture », Chapitre 1 et Page A.
La preview Quiz Hunt affichait « Elcé — Quiz Hunt » et son lecteur avec le
paramètre `mod=quiz-hunt`. Les deux previews n’ont produit aucune erreur ni
avertissement console. Les deux projets ont ensuite été supprimés via le
sélecteur ; leurs routes API répondent `404 project_not_found` et leurs listes
ne les contiennent plus. L’éditeur affichait « Lecture seule » pendant cette
session MCP ; aucune modification auteur n’a été tentée. Les fenêtres de
contrôle créées pour M0 ont été fermées.

- [x] Dans `src/core/preview/{popup-preview-host.ts,popup-preview-messages.ts}`,
  `src/app/remix/browser-entry.tsx` et
  `src/mods/quiz-hunt/authoring/quiz-hunt-project-application.tsx`, faire
  transmettre `mod=quiz-hunt` au popup local Quiz Hunt. La preview Learning
  garde son choix par défaut ; le chemin réseau conserve son paramètre actuel.
  Valider le clic réel, le chargement du scénario Quiz Hunt et la preview
  Learning dans Safari Technology Preview.

**M1 — Partager les comportements des menus et panneaux.**

Fichiers : `src/core/authoring/page/page-editor-view.tsx`,
`src/core/authoring/layout/{project-application.tsx,editor-panel-state.ts}`,
un helper partagé sous `src/core/authoring/menus/`,
`src/mods/learning/authoring/{learning-page-editor.tsx,learning-project-application.tsx,learning-workspace.tsx,scenario-panel.tsx,workspace-panel-state.ts}`,
`src/mods/quiz-hunt/authoring/{quiz-hunt-project-application.tsx,quiz-hunt-workspace.tsx}`,
`src/resources/bdcs/carousel/authoring/remix-carousel-editor.tsx` et leurs tests.

État vérifié après `891aefce` : le menu Projet est rendu par le
`CoreProjectApplication` partagé, mais sa fermeture hors-menu est encore
raccordée par un listener Learning seulement. Le menu d’ajout du rail de page
est rendu par `PageEditorView`, mais son listener est propre à Learning. Le
Carousel a un troisième listener local. Les panneaux partagent déjà les
calculs `editor-panel-state.ts` ; `workspace-panel-state.ts` n’est qu’un
réexport Learning, pas une seconde implémentation. Les transitions de
visibilité restent locales aux deux applications et dupliquent le retour de
focus, Échap et le raccord resize. Centraliser ces comportements sans
introduire un bus ni déplacer l’état documentaire.

- [x] Placer la fermeture hors-menu dans un helper réutilisable sous
  `src/core/authoring/menus/`. Brancher le menu du rail partagé dans les deux
  mods, le menu Projet commun, le menu Scénario Learning et chaque menu d’ajout
  de vues Carousel. Utiliser les racines déjà nommées, conserver les commandes,
  les noms accessibles et les ancrages visuels ; supporter le clic clavier des
  disclosures natifs et nettoyer les listeners au démontage.
- [x] Garantir : clic extérieur ferme ; clic dans le menu permet l’action ;
  ouvrir un autre menu par clic referme le précédent. Préserver la fermeture
  après action propre à chaque mod : Learning ferme après une création ; Quiz
  Hunt laisse le menu ouvert après la création d’un bloc Texte. Retirer les
  listeners remplacés et nettoyer ceux du comportement partagé au
  démontage/changement de page.
- [x] Garder `editor-panel-state.ts` comme propriétaire des calculs communs,
  retirer le réexport Learning devenu inutile et centraliser dans
  `core/authoring/layout/` le raccord partagé de visibilité, resize, Échap et
  restitution du focus. Les applications gardent leurs contenus et l’état de
  panneau local. Conserver les seuils 800/1200 px et les cibles de focus.

Acceptation : dans les deux mods, ouvrir un menu puis cliquer dans le contenu,
dans un autre menu et sur une commande intérieure ; vérifier les créations et
le comportement après changement de page et remontage. Aux largeurs 800, 801,
1200 et 1201 px, vérifier panneaux, Échap et retour du focus. Le correctif
commun ne nécessite plus deux implémentations de fermeture.

État M1 : le helper de fermeture est raccordé aux menus Page des deux mods,
Projet des deux applications, Scénario Learning et Carousel. Le contrôleur de
panneaux partagé a remplacé les transitions dupliquées et le réexport
Learning est retiré. Les tests ciblés du helper, du contrôleur et du parcours
Page→Carousel passent (5 tests) ; `npm run typecheck` et `npm run build`
passent. Safari Technology Preview vérifie les deux mods : clic extérieur,
action intérieure, menu concurrent, changement de page et rechargement. Quiz
Hunt ajoute bien le bloc Texte ; son menu reste ouvert, conformément à son
comportement existant. À 800/801/1200/1201 px, les panneaux ont les états
attendus ; Échap ferme le panneau étroit et rend le focus à son bouton.

- [x] Tester fermeture intérieure/extérieure, clic clavier natif, nettoyage
  des listeners, passage Page→Carousel et seuils 800/801, 1200/1201 px.
- [x] Vérifier les menus Projet/Scénario et le raccord app-level Quiz Hunt,
  puis le changement de page et le remontage.
- [x] Vérifier dans Safari Technology Preview les deux mods, les commandes,
  Échap et le retour du focus aux quatre largeurs d’acceptation.

M1 est `Fini` : comportement, code, tests et spécifications propriétaires sont
alignés.

**M2 — Rendre les styles communs indépendants de Learning.**

Fichiers : `src/mods/learning/authoring/learning-workspace.css`,
`src/mods/quiz-hunt/authoring/quiz-hunt-authoring.css`,
`src/core/authoring/layout/*.css`, `src/server/elce-local-server.ts`.

- [x] Déplacer les règles communes du rail, des cadres et du menu de page dans
  `src/core/authoring/page/page-editor-view.css` ; celles de l’arborescence
  commune dans `src/core/authoring/layout/scenario-tree.css`.
- [x] Garder dans chaque mod les règles de ses contenus et les adaptations
  propres à son parcours. Conserver les déclarations et leurs priorités utiles
  pendant le déplacement ; retirer les doublons et ajuster les styles par route
  dans `STYLE_FILES`, y compris le panneau d’apparence Learning.
- [x] Vérifier que les contrôles communs de Quiz Hunt gardent leur présentation
  sans les feuilles Learning ; qualifier séparément ses réglages propres, hors
  de ce contrôle du cadre commun.

Acceptation : mêmes dimensions de contrôles, espacements, cadres, superpositions
et largeurs responsives dans les deux mods ; aucun sélecteur commun nécessaire
au rail ou à l’arborescence Quiz Hunt n’est possédé par Learning.

État M2 : `scenario-tree.css` possède le Scénario partagé ;
`page-editor-view.css` possède les titres, le rail BDC, ses cadres et son menu.
Learning conserve `learning-workspace.css` et `learning-appearance-panel.css` ;
Quiz Hunt conserve `quiz-hunt-authoring.css`. Une requête HTML documentaire
directe ne charge que les styles du mod courant ; `/` et `/new` chargent les
deux jeux pour le choix client du mod. Les adaptations de lignes propres à
Quiz Hunt restent dans sa feuille. Aucun des sélecteurs communs déplacés ne
reste dans `learning-workspace.css`.

Validation : `npm run typecheck`, les deux tests de composition des feuilles
dans `src/server/elce-local-server.test.ts` et `npm run build` passent. Le build
garde l’avertissement existant sur le chunk Rive de 2,66 Mo. Safari Technology
Preview vérifie les routes Learning et Quiz Hunt sur des documents temporaires
isolés, les styles calculés du cadre/rail communs, les adaptations Quiz Hunt et
les seuils 800/801, 1200/1201 px. Une requête directe finale Quiz Hunt confirme
l’absence des deux feuilles Learning. Les projets, l’instance 5176/5182 et sa
base temporaire sont supprimés. Le serveur utilisateur 5175, qui sert encore
son ancienne liste de feuilles, n’a pas été redémarré ; il prendra ces styles à
son prochain redémarrage.

M2 est `Fini` : styles, routage, tests, validation navigateur et spécifications
propriétaires sont alignés.

**M3 — Retirer les dépendances des ressources vers Learning.**

Fichiers : `src/resources/anchoring/authoring/{elce-anchor-extension.ts,anchor-types.ts}`,
`src/resources/bdcs/statistical-graph/authoring/remix-statistical-graph-editor.tsx`,
`src/core/authoring/resource-text-field-feature.ts`,
`src/mods/learning/inline-text/{learning-inline-text-field.tsx,learning-inline-text-value.ts}`,
les raccords Section/ancres, `src/domain/anchor/anchor-position.ts` et
`src/core/authoring/layout/project-application.tsx`.

- [x] Ajouter aux contributions auteur existantes une projection texte
  injectable : la ressource emploie le helper neutre
  `core/document/rich-text-utils.ts` par défaut ; Learning fournit sa projection
  par `ResourceTextFieldFeature` et les options d’ancre. Propager ce raccord
  dans la session/adaptation Section existante. Retirer les deux imports
  directs de `plainTextFromValue` depuis les ressources.
- [x] Préserver les sorties Learning pour `profileLabel`, `pageLinkLabel`,
  `localDateLabel`, les paragraphes et retours à la ligne. Les conversions
  de Learning restent inchangées ; le Graphe et les aperçus Card lui délèguent
  leur projection. Les tests ciblés des valeurs enrichies restent à exécuter.
- [x] Déplacer `domain/anchor/anchor-position.ts` dans
  `resources/anchoring/domain/anchor-position.ts`, utiliser `CARD_PRESET_ID`
  depuis la ressource Carte et migrer ses importateurs. Retirer l’ancien point
  d’import après migration.
- [x] Importer le type commun `ScormVersion` depuis `@codplay/sighty-scorm`
  dans le core et les consommateurs communs. Les types d’état Learning restent
  dans leur propriétaire métier.

Acceptation : aucune source core/ressources n’atteint un mod par un chemin
d’import, types compris. Éprouver les projections texte, l’édition du Graphe
et les aperçus d’ancres ; vérifier une Section et une Carte ancrée dans le vrai
lecteur pour les contextes des deux mods qui les proposent.

État M3 : les adaptations de projection, le déplacement d’ancre et les imports
`ScormVersion` sont implémentés. `npm run typecheck` passe. L’inspection AST du
graphe de production ne trouve plus de chemin `core/ressources → mods`. Safari
Technology Preview a affiché le Graphe auteur puis sa lecture réelle, ainsi
qu’une page Learning contenant une Section et des Cartes ancrées, sur des
documents existants ouverts sans modification. La console signale un 404 d’une
ressource image déjà référencée ; aucun autre avertissement ou erreur n’est
relevé. La preview Quiz Hunt réelle échoue actuellement avec « Version de
document Elcé non supportée : 1 » : le popup local omettait le paramètre de mod
attendu par la sélection du lecteur. Ce circuit est corrigé et vérifié dans
Safari : le clic Preview transmet le mod et charge le jeu Quiz Hunt ; la preview
Learning conserve le lecteur Learning. La preuve navigateur ne qualifie pas
encore les valeurs enrichies Learning. Restent les tests ciblés des projections
neutre et Learning, le contrôle de Sections/cartes ancrées dans les contextes
Quiz Hunt pertinents, puis l’acceptation complète du lot.

**M4 — Partager le transport et le téléchargement des exports.**

Fichiers : `src/core/export/{browser-download.ts,export-transport.ts}`,
`src/mods/learning/persistence/{learning-sighty-export-client.ts,learning-scorm-export-client.ts,learning-scenario-export-media.ts,server/learning-scenario-exporter.ts}`,
`src/mods/quiz-hunt/persistence/{quiz-hunt-sighty-export-client.ts,quiz-hunt-scorm-export-client.ts}`,
les applications auteur et le contrôleur API Learning.

- [x] Extraire le téléchargement de Blob, le nommage technique et la durée de
  vie de l’Object URL dans `src/core/export/`. Les deux mods doivent l’importer
  sans charger un module de projection Learning.
- [x] Partager dans ce dossier la préparation multipart et les contrôles de
  transport identiques : lecture des fichiers, taille, réponse ZIP et nom
  retourné par le serveur. Endpoint, document sérialisé et sélection des médias
  sont fournis par le mod ; la sélection des médias continue d’employer son
  véritable scénario de lecture.
- [x] Déplacer les fonctions qui interprètent le document Learning depuis
  `src/export/` vers `src/mods/learning/persistence/`, y compris le calcul
  des médias du scénario et l’exporteur serveur. Migrer les appels et conserver
  les wrappers propres à chaque endpoint et leurs messages.

Acceptation : l’import de téléchargement Quiz Hunt ne rejoint plus le lecteur
Learning. Tester média absent, taille incorrecte, erreur HTTP, réponse non ZIP
et libération de l’Object URL. Télécharger et ouvrir un export Sighty et SCORM
de chaque mod ; préserver le monoSCO Quiz Hunt et les options SCORM Learning.

État M4 : le téléchargement, le nommage, la lecture des octets média et la
validation des archives sont partagés sous `core/export`. Les clients et
l’exporteur serveur Learning sont désormais sous `mods/learning/persistence` ;
Quiz Hunt conserve ses endpoints, son codec, ses messages et son calcul média
fondé sur son propre scénario. Le typecheck passe. Les contrôles de transport,
les deux exports réels de chaque mod et l’ouverture de leurs archives restent
à valider ; M4 reste `En cours`.

**M5 — Réutiliser les adaptations d’édition des ressources.**

Fichiers : `src/resources/bdcs/{question,card}/authoring/*facade*.ts`, leurs
unions de commandes, `src/mods/learning/authoring/learning-editor-facade.ts`,
`src/mods/quiz-hunt/authoring/{quiz-hunt-editor-facade.ts,quiz-hunt-controller.ts}`.

- [x] Faire posséder aux façades des ressources les callbacks d’édition et
  règles aujourd’hui répétés dans Quiz Hunt, notamment `canRemoveAnswer`,
  texte, type, ordre des réponses, cadrage, transitions et références média.
- [x] Fournir un getter du contenu courant et les callbacks typés de dispatch
  et d’import. Remplacer les implémentations du mod par ces raccords, sans
  retenir un ancien snapshot pendant plusieurs éditions successives.
- [x] Composer les sous-unions de commandes d’édition des ressources dans
  Quiz Hunt. Distinguer explicitement ces opérations de la création et du
  placement, qui restent adaptés aux invariants du mod. Ne pas ajouter une
  opération fictive pour satisfaire un type de façade trop large.

Acceptation : une seule implémentation des règles d’édition concernées. Dans
chaque mod, effectuer deux éditions successives, changer le type de Question,
ajouter/réordonner/retirer une réponse autorisée, importer puis retirer un
média, et Annuler/Rétablir. Vérifier aussi la Carte résultat Quiz Hunt, la Carte
directe Learning et la Carte enfant de Carousel. Préserver la Question requise
des pages de banque et les commandes de création propres à chaque mod.

État M5 : les façades Question et Carte reçoivent un getter du contenu courant ;
leurs callbacks d’édition, règles de réponses, champs, transitions et médias
sont réutilisés par Learning et Quiz Hunt. Quiz Hunt compose les sous-unions de
commandes d’édition ressource ; Learning et Quiz Hunt gardent leurs commandes
de création et leurs règles documentaires propres. Le typecheck et le build
passent. L’acceptation des éditions successives, médias, Annuler/Rétablir et des
trois contextes Carte reste à effectuer ; M5 demeure `En cours`.

**M6 — Partager les protocoles SQLite de bail et de fichier média.**

Fichiers : `src/mods/learning/persistence/server/sqlite/learning-sqlite-project-persistence.ts`,
son homologue Quiz Hunt, `src/core/server/{projects,media}/`,
`src/core/persistence/sqlite/sqlite-query-types.ts`.

Règle acceptée : l’expiration autorise une autre page à reprendre le projet,
mais ne révoque pas le droit courant. Tant qu’aucune page ne l’a remplacé, son
titulaire peut encore renouveler ou écrire ; les transactions SQLite arbitrent
une reprise concurrente et refusent ensuite l’ancien droit.

- [x] Déplacer les primitives SQL neutres nécessaires vers
  `src/core/persistence/sqlite/` et migrer les ressources qui les utilisent.
  Garder les requêtes de contenu BDC dans leurs ressources.
- [x] Extraire sous `core/server/projects/` le protocole partagé des quatre
  opérations de bail et le contrôle du droit courant. Le contexte de mod est
  explicite ; les dépôts exécutent ces opérations dans leurs transactions.
- [x] Extraire sous `core/server/media/` la lecture des références de fichier
  avec filtre explicite `mod_key`.
- [x] Extraire la publication transactionnelle des fichiers. Préserver
  vérification de taille, empreinte, contenu déjà publié, déduplication dans
  le projet et renouvellement du bail, après clarification de la règle de bail.
- [x] Conserver `listMediaStorageKeys()` comme lecture globale des clés de la
  base pour le nettoyage du stockage physique partagé. Les autres lectures
  et mutations projet/média restent filtrées par le mod.

État M6 : les primitives SQLite, le protocole de bail, son contrôle dans les
mutations et la publication média transactionnelle sont partagés sous `core/`.
Les deux dépôts fournissent explicitement leur `mod_key` et gardent la
transaction qui encadre chaque opération. Le renouvellement après échéance
préserve le droit tant qu’aucune autre page ne l’a repris. Le typecheck, le
build et le contrôle d’architecture passent. L’acceptation des transitions
d’accès et des résultats média reste à effectuer ; M6 demeure `En cours`.

Acceptation : projets des deux mods dans une même base ; vérifier acquisition
répétée par la même page, refus d’une autre page, expiration, forçage, ancien
droit remplacé, renouvellement et libération. Vérifier tous les résultats de
`StoreMediaFileResult`, le refus d’un projet d’un autre mod et la conservation
des fichiers référencés par les deux mods pendant le nettoyage global.

**M7 — Donner un propriétaire produit à l’historique SQL commun.**

Fichiers : `src/server/elce-project-database.ts`, le dossier de migrations
actuel Learning, `src/server/projects/sqlite/migrations/` et les tests qui
appellent `loadMigrations('./migrations/')`.

- [x] Déplacer en bloc les migrations historiques actuellement sous Learning
  vers `src/server/sqlite/migrations/legacy-learning/`. Cet historique mélange
  socle commun et anciennes évolutions Learning ; conserver chaque ID et
  chaque fichier `up.sql`/`down.sql` octet pour octet.
- [x] Examiner la migration homonyme `20261102120000_add_page_early_exit_setting`
  déjà présente sous `src/server/projects/sqlite/migrations/`, vérifier ses
  empreintes et son absence du chargeur courant, puis conserver un seul
  propriétaire effectif sans rejouer l’ID.
- [x] Ajuster uniquement leurs chemins de chargement et les tests concernés.
  Garder les migrations propres à Quiz Hunt dans le mod. Le dossier historique
  déplacé est clos aux nouvelles évolutions ; les migrations futures rejoignent
  la capacité core/ressource ou le mod propriétaire et sont composées
  explicitement par le produit.
- [x] Comparer la liste ordonnée des 23 IDs composés et les empreintes des 38
  fichiers SQL historiques avant/après le déplacement. L’ID doublon de la copie
  non chargée ne subsiste que dans le nouvel emplacement canonique.
- [ ] Vérifier une base vierge, les fixtures des anciennes versions et la
  réouverture d’une copie de base contenant les deux mods.

État M7 : les 19 migrations historiques Learning ont été déplacées sous le
propriétaire partagé sans modifier leurs 38 fichiers SQL ; leurs empreintes
SHA-256 correspondent au commit de départ. Le doublon homonyme qui n’était pas
chargé a été retiré. Le chargeur Elcé compose toujours ces migrations avec
celles de Quiz Hunt et les trie par ID ; les chargeurs et références des
fixtures Learning pointent vers l’emplacement canonique. Le typecheck et le
build passent. L’application des migrations sur base vierge, anciennes
fixtures et copie mixte reste à valider ; M7 demeure `En cours`.

Acceptation : même schéma et mêmes valeurs documentaires, aucune migration
rejouée du fait du déplacement et mêmes tests de migration descendante. Ce lot
est un déplacement d’historique ; une transformation de schéma supplémentaire
requiert un lot distinct.

**M8 — Verrouiller les frontières et supprimer les chemins remplacés.**

- [x] Créer `scripts/check-mod-boundaries.mjs` à partir de la méthode du relevé
  existant et ajouter `npm run check:architecture`. Analyser les modules de
  production avec la résolution TypeScript, y compris réexports et chemins
  intermédiaires. Le diagnostic donne le chemin complet responsable.
- [x] Refuser tout chemin core/ressource → mod et tout chemin d’un mod vers un
  autre mod, pour les valeurs comme pour les types. Les entrées produit peuvent
  composer plusieurs mods. Signaler les imports dynamiques non résolus plutôt
  que certifier un graphe incomplet.
- [ ] Qualifier le contrôle avec des fixtures autonomes montrant dépendance
  directe, réexport, type et chemin indirect.
- [x] Migrer les importateurs encore signalés vers leurs propriétaires
  canoniques et retirer uniquement les réexports devenus inutiles. Le graphe
  courant ne contient aucun chemin interdit ; conserver les points d’entrée
  réellement publics dont les consommateurs subsistent.

État M8 : `npm run check:architecture` analyse les 415 sources de production
avec 2 143 imports internes résolus. Il ne détecte aucun chemin interdit entre
core/ressources et mods, aucun import entre mods et aucun import non résolu
hors built-ins Node. Les diagnostics incluent chaque fichier, ligne et
spécificateur du chemin responsable. La qualification par fixtures directes,
réexportées, typées et indirectes reste à faire ; M8 demeure `En cours`.

Acceptation : zéro chemin interdit, avec un contrôle reproductible depuis le
package. Une réintroduction des imports vers Learning signalés par l’audit
fait échouer ce contrôle, sans règle d’exemption propre à Learning.

**M9 — Fermer l’acceptation et actualiser les guides.**

- [ ] Actualiser les seules spécifications propriétaires concernées avec les
  comportements implémentés et vérifiés. Mettre à jour
  `src/mods/docs/{README.md,SKILL.md}` et le point de découverte
  `../../.agents/skills/elce-mod/SKILL.md` selon son mode de raccord réel : deux mods,
  routes `/learning/:documentId` et `/hunt/:documentId`, choix `/` et `/new`,
  rôles communs, compositions publiques, conventions de migration et contrôle
  des dépendances. Retirer les indications devenues fausses sur le second mod
  et le routage `?mod=quiz-hunt`.
- [ ] Conserver les compositions directes et petites factories actuelles ;
  le plan ne demande ni registre dynamique, ni classe de base Learning, ni
  réécriture du moteur de lecture. Les découpages internes supplémentaires des
  grands fichiers doivent découler des responsabilités extraites ci-dessus.
- [ ] Passer les contrôles finaux et compléter les cases de chaque lot avec
  leur acceptation réelle. Conserver tout échec non résolu dans le suivi actif.

Depuis `packages/elce/`, après les suites ciblées de chaque lot :

```sh
npm run check:architecture
npm run typecheck
npm test
npm run build
```

Parcours finaux : `http://localhost:5175/`, puis les routes Learning
`/learning/:documentId` et Quiz Hunt `/hunt/:documentId` via leurs projets
temporaires. Dans chacun, vérifier
création/ouverture du projet temporaire, édition des BDC concernés,
Annuler/Rétablir, sauvegarde/rechargement et réouverture ; menus et responsive
de M1/M2 ; preview et export du vrai lecteur. En Learning, inclure une Diapo
Avatar/Carousel et ses associations ; en Quiz Hunt, une épreuve, sa finale et
Recommencer. Appliquer les règles MCP et d’activation du navigateur d’AGENTS.

**Critère de clôture.** Tous les lots doivent être validés dans les deux
compositions concernées, les anciens circuits remplacés retirés et le contrôle
de frontières actif. Consolider les contrats vérifiés avant de retirer ce plan achevé. Le
rapport demandé reste la référence d’audit ; il ne devient pas une spécification.
