# Rapport — impact des mods sur l’organisation du code Elcé

Rapport demandé le 9 novembre 2026. État examiné : branche `elce`, commit
`91af3f67`. L’analyse porte sur les sources présentes dans le workspace.

**Mon avis : conserver l’organisation par mods, puis consolider les mécanismes
communs que le second mod a permis d’identifier.** Learning et Quiz Hunt ont
des documents et des parcours suffisamment différents pour justifier leurs
propres assemblages. Le partage du contrôleur, des ressources et de la
persistance technique apporte déjà un bénéfice réel. L’éditeur commun reste
cependant incomplet : certains comportements sont réécrits dans chaque mod,
et plusieurs dépendances ramènent les ressources vers Learning.

Le risque principal pour la suite est la multiplication des endroits à corriger
lorsqu’une fonctionnalité commune évolue. Le code contient déjà un exemple
concret avec la fermeture des menus au clic extérieur.

**Périmètre et méthode.** Les contrats du document, du cache, de l’historique,
des sessions projet, de l’API et de Quiz Hunt ont été lus avec les plans Mods.
Un relevé des imports a ensuite été réalisé avec le parseur TypeScript et sa
résolution de modules, en reprenant la méthode de l’audit existant. Les
répétitions de comportement ont été examinées dans les compositions, façades,
vues et dépôts SQLite. Cette analyse statique ne mesure ni le poids du bundle
produit ni les performances d’exécution. Aucun test de fonctionnement ou
parcours navigateur n’a été exécuté pour ce rapport.

Le mot core désigne ici `packages/elce/src/core/`. Sighty et CodPlay restent les
moteurs de lecture auxquels Elcé fournit ses productions.

| Propriétaire actuel | Fichiers TS/TSX | Lignes physiques |
| --- | ---: | ---: |
| `src/core/` | 60 | 6 224 |
| `src/resources/` | 111 | 12 628 |
| `src/mods/learning/` | 127 | 20 406 |
| `src/mods/quiz-hunt/` | 47 | 8 891 |
| Autres dossiers de `src/` | 64 | 5 196 |
| Total | 409 | 53 345 |

Le corpus exclut les fichiers `.test`, `.spec`, `.d.ts` et les helpers nommés
`test-fixture` ou `test-helper`. Les lignes comptent commentaires et espaces ;
les fichiers CSS et SQL ne sont pas inclus. Les styles embarqués dans des
fichiers TypeScript sont inclus. Ces volumes décrivent la répartition du code,
sans constituer un taux de duplication ni une comparaison avant/après.

**Ce qui fonctionne dans cette organisation.**

Les deux mods créent leur acteur à partir du même
[`createControllerMachine`](../../src/core/controller/controller-machine.ts).
Le document, la file de changements et l’historique suivent donc un mécanisme
commun. Chaque composition fournit ses commandes, sa sélection et ses
adaptations. Le contrôleur central n’a aucun import direct vers un mod, et
aucun chemin d’import de valeur du core vers les mods n’a été détecté dans le
corpus.

Le cache [`IndexedDbDocumentStore`](../../src/core/persistence/indexed-db/document-store.ts),
la [`session projet`](../../src/core/projects/project-session-coordinator.ts),
le transport HTTP et la synchronisation sont également partagés. Les codecs
permettent de conserver deux formats documentaires sans reconstruire ces
mécanismes pour Quiz Hunt. C’est un découpage utile et déjà exercé par deux
consommateurs.

Les Questions, Cartes et Sections réutilisent leurs services et leurs éditeurs.
Les deux dépôts utilisent aussi les mêmes requêtes et conversions de lignes
pour les BDC, notamment
[`content-block-queries`](../../src/resources/document/persistence/sqlite/content-block-queries.ts)
et les modules de persistance de chaque ressource. Les projets partagent une
base SQLite ; `projects.mod_key` filtre leurs catalogues. Cette organisation
évite de maintenir un second modèle de Question ou de Carte pour le jeu.

Les différences de parcours restent bien localisées. Les banques, couleurs,
tirages, panier, minuteur et issues de partie appartiennent à Quiz Hunt ;
l’organisation et les règles du parcours Learning appartiennent à sa
composition. Les deux lecteurs utilisent
[`ReadingRuntime`](../../src/core/reading/reading-runtime.ts) et les builders
de ressources. Leurs scénarios Sighty peuvent ainsi exprimer des expériences
distinctes.

**Les répétitions qui coûtent déjà de la maintenance.**

| Sujet | Constat | Effet sur le développement |
| --- | --- | --- |
| Comportements d’éditeur | Gestion locale des menus, panneaux et focus, animations de suppression, préparation des previews et état des exports dans les applications des deux mods. | Une correction commune doit être reportée manuellement. |
| Actions Question et Carte | Quiz Hunt réécrit des adaptations d’actions déjà présentes dans les façades des ressources. | Les règles et capacités d’un même BDC peuvent évoluer différemment selon le mod. |
| Persistance technique | Les deux dépôts SQLite réécrivent l’acquisition, le contrôle, le renouvellement et la libération des baux, ainsi que les accès aux fichiers média. | Une correction du protocole technique exige plusieurs modifications concordantes. |
| Préparation des exports | Les clients Sighty reproduisent la préparation du formulaire, la lecture des médias et plusieurs contrôles HTTP. | Les améliorations de transport et de diagnostic ont plusieurs propriétaires. |

Le cas des menus est révélateur. Leur présentation est partagée dans
[`page-editor-view.tsx`](../../src/core/authoring/page/page-editor-view.tsx).
Learning raccorde le clic extérieur dans
[`LearningPageEditor`](../../src/mods/learning/authoring/learning-page-editor.tsx).
Quiz Hunt possède son propre `isAddContentMenuOpen` dans
[`QuizHuntProjectApplication`](../../src/mods/quiz-hunt/authoring/quiz-hunt-project-application.tsx),
sans raccord équivalent au clic extérieur dans le code inspecté. Les deux
mods partagent donc le rendu du contrôle, alors que son comportement complet
reste à entretenir séparément. C’est une divergence constatée dans les sources ;
son effet à l’écran n’a pas été revérifié pendant cet audit.

Dans [`QuizHuntEditorFacade`](../../src/mods/quiz-hunt/authoring/quiz-hunt-editor-facade.ts),
`createQuestionEditorActions` et `createCardEditorActions` appellent directement
les services de ressource et reconstruisent les commandes. Les façades
[`ElceQuestionFacade`](../../src/resources/bdcs/question/authoring/question-facade.ts)
et [`ElceCardFacade`](../../src/resources/bdcs/card/authoring/card-facade.ts)
portent déjà ces adaptations. La règle `canRemoveAnswer`, par exemple, est
réécrite dans Quiz Hunt. Le vocabulaire des commandes diffère aussi :
`question.update` dans Quiz Hunt et `bdc.question.update` dans la ressource.
Les services métier sont partagés, mais une partie du raccord auteur est
dupliquée.

Les dépôts
[`LearningSqliteProjectPersistence`](../../src/mods/learning/persistence/server/sqlite/learning-sqlite-project-persistence.ts)
et [`QuizHuntSqliteProjectPersistence`](../../src/mods/quiz-hunt/persistence/server/sqlite/quiz-hunt-sqlite-project-persistence.ts)
contiennent notamment la même logique de bail : vérifier le propriétaire et
l’expiration, renouveler le bail de la même page, refuser un autre propriétaire,
ou générer un nouveau droit. La reconstruction de chaque agrégat justifie un
adaptateur propre au mod ; ce protocole technique offre un candidat précis au
partage.

Les petites fonctions de composition sont une répétition acceptable. Par
exemple, les deux factories Preview ont le même corps après remplacement du
nom du mod, sur 18 lignes. Leurs sessions restent distinctes. Leur extraction
apporterait peu par rapport au regroupement des comportements d’éditeur et des
protocoles techniques.

**Les couplages qui empêchent encore une véritable indépendance.**

Le graphe contient 2 127 liens internes d’import ou de réexport. Aucun import
direct entre Learning et Quiz Hunt n’a été détecté. Les dépendances indirectes
révèlent cependant plusieurs raccords à corriger.

Deux ressources importent directement `plainTextFromValue` depuis Learning :
[`elce-anchor-extension.ts`](../../src/resources/anchoring/authoring/elce-anchor-extension.ts)
et [`remix-statistical-graph-editor.tsx`](../../src/resources/bdcs/statistical-graph/authoring/remix-statistical-graph-editor.tsx).
Cela contredit la frontière annoncée dans les contrats : une ressource
réutilisable ne devrait pas dépendre d’un mod. Ces imports propagent cette
dépendance à la Section et au Carousel qui utilisent ces éditeurs.

Un autre chemin passe par
[`domain/anchor/anchor-position.ts`](../../src/domain/anchor/anchor-position.ts),
qui importe les presets depuis `learning-definition.ts`. Le builder Flux
utilise ce module. La lecture Quiz Hunt rejoint donc elle aussi Learning par
un utilitaire d’ancrage.

Au total, 10 sources de `resources/` ont un chemin vers Learning dans le graphe,
dont 8 par des imports de valeur. Ces nombres décrivent les dépendances
possibles des modules ; ils ne mesurent pas l’exécution de chaque fonction.

Le client d’export Quiz Hunt réutilise
`downloadElceSightyPackage` depuis
[`export/elce-sighty-export-client.ts`](../../src/export/elce-sighty-export-client.ts).
Ce fichier importe aussi `scenarioExportMediaIds`, lequel importe le lecteur
Learning. Une fonction technique de téléchargement partage ainsi son module
avec la projection du parcours Learning. Le graphe source de Quiz Hunt rejoint
le lecteur Learning par ce chemin, même si le téléchargement n’appelle pas
l’export Learning. La composition du bundle n’a pas été mesurée ici.

En cumulant ces chemins, 15 des 47 sources Quiz Hunt peuvent atteindre Learning
par des imports de valeur. L’absence d’import direct entre mods ne suffit donc
pas à démontrer leur indépendance.

Le core conserve un couplage plus limité, uniquement de types :
[`core/authoring/layout/project-application.tsx`](../../src/core/authoring/layout/project-application.tsx)
importe `ScormVersion` depuis
[`scorm/scorm-types.ts`](../../src/scorm/scorm-types.ts),
qui rassemble également des types d’évaluation et d’état Learning. La version
SCORM est pourtant exportée par la bibliothèque commune. Cette dépendance ne
constitue pas un chargement du métier Learning à l’exécution.

**Le partage des styles et du schéma doit aussi avoir un propriétaire clair.**

Le serveur charge les feuilles des deux mods dans la même page depuis
[`STYLE_FILES`](../../src/server/elce-local-server.ts).
Les règles communes `.elce-page-bdc-*` et plusieurs styles d’arborescence
utilisés par Quiz Hunt restent dans
[`learning-workspace.css`](../../src/mods/learning/authoring/learning-workspace.css).
Quiz Hunt dépend ainsi de la feuille Learning pour une partie de son interface.
Cette dépendance échappe au graphe d’imports TypeScript. Les règles visuelles
du cadre, des contrôles et du rail communs devraient être possédées avec leurs
composants communs ; les personnalisations du parcours restent dans le mod.

Les migrations créant les tables communes de projets, médias, identités et BDC
sont physiquement rangées sous Learning. Le
[`lanceur de base commun`](../../src/server/elce-project-database.ts)
charge explicitement les migrations des deux mods. Quiz Hunt utilise donc un
socle SQL dont l’historique est encore possédé par le dossier Learning. C’est
compatible avec une application unique ; ce rangement limite la possibilité
de faire évoluer ou retirer un mod isolément. Toute réorganisation ultérieure
doit conserver les identifiants et l’ordre des migrations ainsi que les bases
existantes.

Les mods sont aujourd’hui des variantes métier d’une application Elcé commune.
Ils ne constituent pas des unités de déploiement indépendantes. Le choix de
composition directe est cohérent avec ce périmètre.

**Répartition recommandée des responsabilités.**

| Propriétaire | Responsabilités à lui confier |
| --- | --- |
| Core Elcé | Projet actif, droits et baux, file et commit documentaires, historique, cache et synchronisation, transport, fichiers média, cadre éditeur et comportement des contrôles communs, cycle technique de lecture. |
| Ressource | Contrat et règles de son contenu, commandes et façade réutilisables, éditeur, builder de lecture, styles propres et projection SQL. |
| Mod | Son document et ses invariants d’organisation, choix des ressources, adaptations documentaires, parcours, règles spécifiques, génération du scénario et compositions auteur/preview/serveur. |
| Entrées produit | Sélection du mod, assemblage des routes et migrations, lancement et fermeture des services. |

Les règles d’un BDC partagé doivent évoluer une seule fois dans la ressource.
Le mod fournit son adaptation au document et son dispatch vers l’acteur
existant. La même règle s’applique aux gestes d’interface communs : leur
comportement doit accompagner leur rendu partagé.

Le contrôleur commun expose actuellement 11 paramètres de type et conserve un
vocabulaire de pages et chapitres. Il répond aux deux mods présents. L’arrivée
d’un usage comme DGS devra éprouver cette frontière avec ses besoins concrets ;
elle ne justifie pas aujourd’hui d’élargir préventivement toutes ces interfaces.

**Ordre de correction que je recommande.** Ces propositions constituent les
conclusions de l’audit ; elles n’ont pas été implémentées dans cette tâche.

1. Regrouper les comportements d’éditeur déjà communs, en commençant par les
   menus et le focus. Une correction du menu de page doit s’appliquer à Learning
   et Quiz Hunt au même endroit. Préserver les callbacks d’actions propres à
   chaque mod et vérifier le geste dans les deux éditeurs.
2. Retirer les dépendances des ressources vers Learning et isoler les fonctions
   techniques de téléchargement. Pour les projections de texte, conserver les
   différences de sémantique des étiquettes : `plainTextFromValue` et le helper
   neutre du core ne traitent pas tous les atomes de la même façon. Une simple
   substitution de nom ne constitue pas une correction suffisante.
3. Réutiliser les façades de Question et Carte dans les adaptations Quiz Hunt.
   Conserver un dispatch documentaire et le même acteur par éditeur. Vérifier
   édition, limites des réponses, média et Annuler/Rétablir dans les deux mods.
4. Partager les requêtes et règles techniques des baux et fichiers média.
   Chaque mod conserve ses transactions et sa reconstruction documentaire.
   Vérifier l’isolation par `mod_key`, les droits périmés et les ressources
   communes avant toute modification du socle SQL.
5. Rendre cohérents les propriétaires des styles et du schéma commun, puis les
   points d’import et les guides. Ajouter un contrôle des frontières d’import
   aux vérifications du projet afin qu’une nouvelle dépendance vers un mod soit
   détectée dès son introduction.

Le raccord explicite des deux mods dans les entrées navigateur, serveur,
migrations et styles reste compréhensible. Un registre dynamique de plugins
ajouterait un mécanisme sans résoudre les répétitions observées. La priorité
est de consolider ces propriétaires avec les deux consommateurs réels.

**Points de lisibilité à traiter au fil de cette consolidation.**

Les 64 sources hors core, resources et mods regroupent des entrées légitimes,
des capacités partagées encore dans `domain/`, `builders/`, `player/` ou
`export/`, ainsi que 16 fichiers composés uniquement de réexports. Ces derniers
créent des chemins d’import supplémentaires, sans dupliquer l’implémentation.
Une navigation par propriétaire gagnerait à converger progressivement vers
les chemins canoniques.

Le guide et le skill embarqués dans `src/mods/docs/` décrivent encore une
sélection explicite Learning et reportent plusieurs choix au second mod,
alors que Quiz Hunt est présent. Le plan Mods comporte les décisions plus
récentes. Cette divergence documentaire peut orienter un développement vers
un ancien propriétaire.

Deux fichiers Quiz Hunt dépassent mille lignes : le workspace auteur et le
builder de scénario. Le premier concentre des comportements communs et des
vues du jeu ; il bénéficiera directement de la consolidation du cadre auteur.
Le second porte principalement le parcours du jeu. Son découpage doit suivre
les responsabilités du jeu, avec des preuves sur les transitions concernées.
La taille d’un fichier seule ne suffit pas à décider une extraction.

Je poursuivrais le développement avec les mods, en consolidant ces frontières
avant de prendre Learning ou Quiz Hunt comme gabarit d’un troisième mod. Le
gain attendu est précis : une évolution de contrôle, de Question, de média ou
de droit projet doit avoir un propriétaire commun identifiable, et chaque mod
doit conserver les adaptations que son document et son parcours exigent.

Références de contrat : [modèle documentaire](../../specs/document-model-spec.md),
[cache](../../specs/document-store-spec.md),
[historique](../../specs/document-history-spec.md),
[session](../../specs/project-session-spec.md),
[API](../../specs/project-api-spec.md),
[Quiz Hunt](../../specs/quiz-hunt-mod-spec.md),
[décisions Mods](../plan/2026-10-20-elce-mods-reconfiguration-plan.md) et
[plan Quiz Hunt](../plan/2026-11-04-quiz-hunt-editable-mod-plan.md).
