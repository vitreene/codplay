# Elcé — étude technique de l’extraction Learning

Date : 20 octobre 2026.

Cette étude réunit l’analyse du code actuel, la cartographie des responsabilités,
les pistes de découpage et les exemples de raccords. Les signatures sont des
propositions techniques ; les conclusions et décisions courantes sont dans
le [plan unique du sujet](../plan/2026-10-20-elce-mods-reconfiguration-plan.md).

Le [réexamen du 27 octobre](2026-10-27-learning-reusable-resources-study.md)
étend les candidats au réemploi aux fonctionnalités précédemment attribuées
en bloc à Learning, notamment parcours, profil, progression et Évaluation.
Les attributions exclusives et destinations correspondantes ci-dessous sont
à réviser selon les décisions du plan avant toute extraction concernée.

Le relevé porte sur `a2a8fb09c3a89810bec0e2b7734a12e36ef035fe`.
Les contrats utilisés pour interpréter le code sont :

| Domaine | Contrats actuels utilisés |
| --- | --- |
| Document, commandes, historique | [Modèle documentaire](../../specs/document-model-spec.md), [historique](../../specs/document-history-spec.md). |
| Session, stockage et droits actuels | [Session projet](../../specs/project-session-spec.md), [API projet](../../specs/project-api-spec.md), [accès d’édition](../../specs/editor-window-access-spec.md). |
| Auteur | [Remix SPA](../../specs/remix-spa-spec.md), [organisation auteur](../../specs/organization-editor-spec.md), [Section](../../specs/section-editor-spec.md), [ancres](../../specs/anchor-spec.md). |
| Ressources | [Question](../../specs/question-bdc-spec.md), [Carousel/Carte](../../specs/carousel-bdc-spec.md), [Graphe](../../specs/statistical-graph-spec.md). |
| Lecture | [Flux](../../specs/flux-scene-builder-spec.md), [Diapo](../../specs/diapo-scene-builder-spec.md), [preview](../../specs/player-preview-spec.md), [intégration des ancres](../../specs/codplay-anchor-integration-spec.md). |
| Learning | [Sommaire et profil](../../specs/summary-profile-spec.md), [Évaluation](../../specs/chapter-evaluation-spec.md), [machine d’Évaluation](../../specs/evaluation-machine-spec.md). |
| Orchestration runtime consommée | [Contrat Sighty](../../../sighty/specs/authoring-library-spec.md). |

## Frontières étudiées

### Analyse des frontières sur le code actuel

Inspection statique du 20 octobre, sur la révision `a2a8fb09c3a89810bec0e2b7734a12e36ef035fe` : relevé des
imports de 154 fichiers TS/TSX hors tests, soit 741 liens locaux résolus,
imports de types compris, puis lecture des circuits ci-dessous. Ce relevé
décrit les dépendances actuelles ; il ne prouve pas une exécution de la cible.

Sommaire, profil, parcours et Évaluation sont attribués à Learning. L’analyse
porte sur les appels et contrats à séparer pour que les mécanismes communs
puissent les transporter sans en imposer les règles.

| Circuit inspecté | Constat dans le code actuel | Découpage retenu pour l’extraction |
| --- | --- | --- |
| [Document](../../src/domain/document/document-types.ts), [modèle](../../src/domain/document/document-model.ts) et [placement](../../src/domain/commands/document-command-types.ts) | `ElceDocumentData` impose `summary`, `profile` et `scenarioEntries` ; `scenarioPageIds` déroule ce parcours. `PagePlacement` comporte `scenario`. | Le document complet, son codec, le parcours et `PagePlacement` restent Learning. Le noyau reçoit des vues structurelles et des services ; les ressources possèdent leurs contenus. Un ordre de regroupement ne devient pas automatiquement un ordre de diffusion. |
| [Invariants](../../src/domain/commands/document-commands/document-invariants.ts) et [helpers](../../src/domain/commands/document-commands/command-helpers.ts) | Le contrôle d’emplacement des pages utilise `scenarioPageIds` ; `placePage` modifie `scenarioEntries`. D’autres contrôles vérifient les enfants Carousel/Section et les règles Diapo/Résultat. | Références et unicité communes ; relations et admissibilité propres aux ressources ; exhaustivité du parcours et règles Résultat dans Learning. Les fonctions qui reconstruisent `ElceDocument` restent avec son agrégat. Le contrôle complet reste appelé avant le même commit. |
| [Contrôleur](../../src/app/controller/controller-machine.ts) | La file et l’ordonnancement côtoient `createDefaultPageCommand`, les imports de ressources, le refus d’un fond Sommaire vidéo et la lecture directe de `document.data.summary`. | La machine commune garde admission, attente, annulation et commit. Les classes de ressources fournissent leur métier ; Learning compose événements, transformations et règle du fond Sommaire. La préparation des médias réutilise le circuit existant sous cette même file. |
| [Historique](../../src/app/history/document-history.ts) | `rebaseMediaMergeHistory` importe le dispatcher complet ; celui-ci mène aux invariants puis aux règles de profil. Ce chemin existe même si l’historique n’affiche aucun profil. | L’historique garde empilement, regroupement, limites et rétention média. La fusion d’une révision est fournie par le service de commandes Learning ; sa sémantique reste propre au document traité. |
| [Formats Flux](../../src/builders/flux/flux-scene-builder.ts), [Diapo](../../src/builders/diapo/diapo-scene-builder.ts), [Question](../../src/builders/question/question-bdc-scene-builder.ts) et [Section](../../src/app/editor/section/section-editor-tiptap-adapter.ts) | Flux/Diapo importent le builder Résultat ; Diapo lit le modèle Évaluation ; les réponses de Question proviennent du type d’état Learning ; Section monte directement l’extension profil. | Résultat et profil arrivent comme contributions Learning. Le type de réponse appartient à Question. Le signal de fin du format reste distinct de son interprétation en progression ou en enchaînement. Les contenus et rendus Carte/Carousel/Graphe restent réutilisables. |
| [Interface auteur](../../src/app/remix/workspace/editor-workspace.tsx) et [page editor](../../src/app/remix/workspace/page-editor.tsx) | L’assemblage impose les panneaux Scénario/réglages, connaît les modèles de chapitre et importe chaque éditeur concret. | Cadre, gestes de page et montage des contributions sont communs. L’arbre du parcours, ses réglages, l’offre de BDC et les contributions concrètes sont assemblés par Learning. Les mêmes éditeurs de ressources sont conservés. |
| [Stockage local](../../src/infrastructure/indexed-db/document-store.ts), [client API](../../src/infrastructure/project-api/project-api-client.ts), [session](../../src/app/projects/project-session-coordinator.ts) et [SQLite](../../src/server/projects/sqlite/sqlite-project-persistence.ts) | Chargement/copie appellent `ElceDocument.fromJSON` ; le serveur valide par les invariants complets. SQLite lit/écrit notamment `summary_json`, `profile_json` et les lignes du parcours. | Codec, création/copie et validation sont fournis par Learning ; transactions, transport et synchronisation restent communs. L’adaptateur SQL actuel entier reste Learning. Le transport peut conserver le document complet ; aucun faux document réduit ni nouvelle projection SQL générique n’est requis. |
| [Player](../../src/player/elce-player-composition.ts), [préparation de lecture](../../src/app/player/player-preview.ts) et [arrêt média](../../src/player/media-playback/page-media-playback.ts) | L’initialisation joue le layout Learning et exige les commandes du Sommaire. La préparation choisit collecte du profil, projection et départ avant de construire ce player. L’arrêt média utilise le slot Learning en dur. | Cycle Sighty/CodPlay et arrêt média avec slot fourni dans le noyau ; scénario, layout et menu dans Learning. Préparation du document et du départ dans le lecteur Learning partagé preview/export. La preview ajoute l’exclusion auteur du catalogue, ses commandes et sa synchronisation. |

**Conclusion de découpage.** Le noyau extrait possède les mécanismes d’édition,
de session et d’exécution d’une composition fournie. `ElceDocument` complet
et la conduite du player actuel appartiennent à Learning. Les ressources
possèdent leurs données, leurs règles de contenu et leurs moyens d’édition
et de rendu. Les coupes ci-dessus réutilisent les circuits actuels.

Deux attributions de la cartographie sont corrigées par cette inspection :

- `PAGE_LOCATION`, `PageLocationKind` et `PagePlacement` restent dans
  `mods/learning/organization/`. Leur placement antérieurement proposé dans
  `core/` aurait conservé le vocabulaire du parcours dans le contrat commun.
- Le choix collecte/projection/départ de `createPlayerPreviewComposition`
  rejoint le chemin partagé de `LearningPlayer`. L’attribuer seulement à
  `LearningPreviewService` aurait laissé une préparation métier nécessaire
  à l’export dans le contexte preview.

**Limites à conserver ouvertes.** Le propriétaire Learning de ces règles est
déterminé ; les points suivants demandent encore un cas d’usage ou une décision :

- format du document DGS, répétitions et références entre calendrier, séquences
  et inventaire ; le calendrier et ses décisions appartiendront à DGS ;
- besoins runtime précis pour les changements horaires, interruptions et
  reprises DGS ; leur satisfaction par les ports Sighty actuels n’est pas établie ;
- intérêt d’une extraction ultérieure de certains services de profil ou de
  catalogue ; ils restent chez leur propriétaire actuel tant que cet intérêt
  n’est pas établi ;
- chargement des ressources exportées, raccord LMS/SCORM et pilotage durable
  de l’état de lecture suivi en D8 ; leurs API ne sont pas fixées ici ;
- point de cache des réponses Question signalé dans cette analyse ; sa qualification reste
  distincte des déplacements de code.

### Dépendances autorisées

~~~mermaid
flowchart TD
    Entry[Entrées navigateur et serveur] --> Assembly
    subgraph LearningMod[Mod Learning]
      Assembly[Entrées et assemblages du mod] --> Learning[Services Learning]
    end
    Assembly --> Resources[Ressources BDC et pages]
    Assembly --> Core[Noyau commun]
    Learning --> Resources
    Learning --> Core
    Resources --> Core
    Learning --> Sighty[Sighty]
    Resources --> CodPlay[CodPlay]
    Core --> Runtime[Ports et cycle runtime commun]
~~~

Relations de dépendances étudiées :

- `core/` ne connaît pas `mods/learning/` ni les implémentations de `resources/`.
  Il possède les types structurels et ports communs qu’elles consomment.
- `resources/` peut dépendre du noyau et de ressources qu’elle utilise réellement,
  par exemple Carousel vers Carte/Graphe. Elle n’importe pas Learning.
- `mods/learning/` possède ses services, sa définition et ses assemblages. Ces
  assemblages importent les services Learning, le noyau et les ressources ;
  les classes métier n’importent pas les assemblages qui les instancient.
- `mods/learning/composition/` raccorde les implémentations aux ports. Ses
  entrées auteur, preview, player exporté et serveur restent distinctes.
  Preview et export utilisent le même lecteur dans `mods/learning/reading/` ;
  ce lecteur ne dépend d’aucun de ces deux contextes. Tout assemblage propre
  à un mod appartient au dossier de ce mod.
- Les entrées stables `app/remix/browser-entry.tsx`,
  `server/elce-http-server.ts` et `server/elce-local-server.ts` peuvent rester
  à leur chemin actuel comme points de lancement. Elles choisissent les entrées
  publiques du mod puis utilisent leurs racines et leur fermeture ; elles ne
  construisent ni services, ni façades, ni scénario, ni adaptateur Learning.
- Aucun module navigateur n’importe un adaptateur SQLite, filesystem ou Node.
  Les imports de type sont également soumis aux frontières de responsabilité.

Cette indépendance concerne les dépendances directes et transitives ainsi que
le contrat des données. Une interface commune n’impose aucun champ Sommaire,
profil, Évaluation ou parcours Learning. Le plan conserve la décision de
vérification progressive de ces frontières.

### Arborescence cible

Les noms ci-dessous sont des destinations à préciser lors du lot concerné.
Chaque dossier de fonctionnalité regroupe ses types, classes, raccords et tests.

~~~text
src/
  core/
    document/
    commands/
    controller/
    history/
    projects/
    sync/
    media/
    catalog/
    persistence/
      indexed-db/
      project-api/
    authoring/
      layout/
      context/
      page/
      catalog/
      media/
      icons/
    preview/
    reading/
      media-playback/
      markup-validation/
    presets/
    server/
      projects/
      media/
      http/
  resources/
    bdcs/
      section/
      question/
      card/
      carousel/
      statistical-graph/
    pages/
      flux/
      diapo/
    anchoring/
    revelation/
    viewport-expansion/
  mods/
    learning/
      learning-definition.ts
      composition/
        authoring-composition.ts
        preview-composition.ts
        exported-player-composition.ts  # futur chantier export
        server/
          server-composition.ts
      document/
      commands/
      authoring/
      organization/
      profile/
        domain/
        authoring/
        reading/
      evaluation/
        domain/
        authoring/
        reading/
      reading/
      preview/
      exported-player/                  # futur contexte du player exporté
      persistence/
        server/
          sqlite/
            migrations/
~~~

Learning possède aussi le code qui assemble ses ressources et services. Aucun
dossier de composition global n’accueille de fichier propre à Learning. Aucun
dossier vide d’un autre mod n’est créé.

`mods/learning/learning-definition.ts` conserve l’identité `learning`, le libellé et les
choix de ressources/configuration du mod. Les compositions auteur, preview,
player exporté et serveur instancient seulement leurs implémentations utiles.
Le fichier partagé de définition n’importe pas de vue Remix ni de dépôt Node ;
il ne devient pas un point d’import de toute l’application.

Les trois entrées publiques à extraire du fonctionnement actuel sont :

| Entrée publique | Fichier possédé par Learning | Appelant applicatif |
| --- | --- | --- |
| `createLearningAuthoringComposition` | `mods/learning/composition/authoring-composition.ts` | `app/remix/browser-entry.tsx`, pour l’auteur. |
| `createLearningPreviewComposition` | `mods/learning/composition/preview-composition.ts` | `app/remix/browser-entry.tsx`, pour la preview. |
| `createLearningServerComposition` | `mods/learning/composition/server/server-composition.ts` | `server/elce-http-server.ts`, pour le serveur. |

Le fichier `composition/exported-player-composition.ts` représente l’entrée
future du projet exporté. Sa signature et ses raccords seront précisés dans
le chantier export ; son emplacement dans l’arbre n’engage aucune création
de fichier ou de dossier vide pendant cette refactorisation.

| Propriétaire sous `mods/learning/` | Responsabilité |
| --- | --- |
| `reading/` | Lecteur `LearningPlayer`, scénario, navigation, progression, évaluation et assemblage des vues réutilisés dans les deux contextes. Les médias suivent les mêmes règles de lecture et de nettoyage. |
| `preview/` et `composition/preview-composition.ts` | Contexte auteur : instantanés, échanges avec l’éditeur, commandes de synchronisation et de test, état auteur local/serveur. |
| `exported-player/` et `composition/exported-player-composition.ts` — futurs | Contexte du projet compilé : accès aux contenus et médias exportés, raccord à la destination des données de lecture. Le LMS enregistre apprenants et résultats ; le raccord SCORM reste à définir. |

À document, options et état de lecture équivalents, preview et export doivent
produire les mêmes scènes et appliquer les mêmes règles. Le futur player
exporté utilisera le lecteur partagé, indépendamment de l’éditeur, du protocole
de popup et de la persistance du test auteur. La fabrication du paquet exporté
est une responsabilité distincte de son exécution ; son outil sera défini dans
le chantier export. Aucun second scénario ni fork de builders n’est prévu.

Le choix statique de Learning à ces points d’entrée suffit à cette extraction.
Les appelants ne connaissent que les arguments, racines/routeur et fermetures
exposés par ces fonctions. Les classes et réglages internes du mod sont raccordés
dans son dossier. L’ajout d’un autre mod fera l’objet de son propre assemblage
et de son enregistrement applicatif, sans modifier les mécanismes du noyau.

### Valeur documentaire et services injectés

**Noyau.** `core/document/content-document-types.ts` définit les identifiants
communs et des vues structurelles en lecture : document, chapitre, page, BDC et
média. Elles exposent identité, nom, contenus, regroupements et références
nécessaires aux mécanismes communs. Un chapitre commun ne connaît pas
Standard/Évaluation ; un BDC commun ne connaît pas le Résultat ; l’ordre de
lecture n’est pas une propriété exigée par le noyau.

**Learning.** `mods/learning/document/learning-document.ts` contient la classe
`LearningDocument` issue d’`ElceDocument`. Elle porte la donnée documentaire,
`toJSON()` et la lecture du format courant, initialement v5. Ses évolutions
suivent [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire). Elle satisfait les vues communes
par ses propriétés/getters, sans recopier son contenu. Les types complets,
dont `summary`, `profile`, `scenarioEntries` et les paramètres Évaluation,
sont dans `learning-document-types.ts`.

**Ressources.** Les contenus Section, Question, Carte, Carousel et Graphe sont
possédés par leur ressource. Les types Learning les assemblent avec le BDC
Résultat. Un déplacement de types conserve la forme JSON, y compris les champs
nuls et optionnels ; une modification de représentation est une décision de
format à décrire et valider selon [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire).

**Opérations.** `core/commands/document-services.ts` décrit les besoins réels du
contrôleur, des sessions et des adaptateurs. La composition raccorde les méthodes
de `LearningDocumentService` pour le modèle/codec/création et de
`LearningDocumentCommandService` pour l’application des commandes :

| Opération interne proposée | Classe propriétaire | Sémantique à conserver |
| --- | --- | --- |
| `createInitialDocument()` | `LearningDocumentService` | Construire le document initial actuel ; cette opération ne publie pas un projet. |
| `readDocument(value)` / `writeDocument(document)` | `LearningDocumentService` | Relire/produire le format courant aux frontières existantes, avec les contrôles retenus selon [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire). |
| `withProjectIdentity(document, id, name)` | `LearningDocumentService` | Donner l’identité de projet à une valeur copiée, en conservant tous ses contenus et références. |
| `createPageCommand(document, request)` | `LearningDocumentService` | Appliquer les défauts Learning selon placement, type de page et modèle de chapitre. |
| `applyDocumentCommand(document, command)` | `LearningDocumentCommandService` | Appliquer les transformations pures, puis tous les invariants avant le commit unique. |
| `assertDocumentInvariants(document)` | `LearningDocumentService` | Chaîner contrôles communs, contrôles des ressources et contrôles Learning aux frontières où ils existent déjà. |

Le service de commandes utilise le service documentaire pour ses validations ;
le service documentaire n’importe pas le service de commandes. Les méthodes
sont liées à leurs instances au point de composition ; aucune copie des règles
ou seconde façade de dispatch n’est ajoutée pour fabriquer ce raccord.

Ces noms décrivent les méthodes à réaliser dans ce plan. Ne pas multiplier les
interfaces identiques : séparer seulement les besoins de lecture/écriture,
de commande et de création lorsque leurs consommateurs sont distincts.
Ne pas renforcer silencieusement la validation d’un appel existant : maintenir
ses étapes et refus vérifiés, notamment codec puis invariants côté API.

Le contrôleur est construit par une fabrique typée recevant ces services.
Son document, ses commandes et les variantes de préparation asynchrone sont
déduits de la composition Learning. L’adaptation de types prolonge les unions
actuelles ; aucun `any` ni conversion arbitraire ne remplace leur contrat.
Les signatures XState sont déduites de cette fabrique dans le noyau et
spécialisées au point de composition, sans import Learning dans le noyau.
`PagePlacement` et la demande concrète de création de page sont des types
Learning. Leur transformation est appelée par le raccord de changements ;
le contrôleur commun conserve la mise en file et le commit, sans importer
ce placement ou décider des défauts du chapitre.

### Une seule voie de modification

Préserver l’enchaînement existant :

~~~text
geste auteur
  -> façade
  -> événement du contrôleur
  -> file existante et éventuelle préparation média/Section
  -> services métier et transformation documentaire pure
  -> invariants communs + ressources + Learning
  -> commit XState
  -> historique et persistance/synchronisation existants
~~~

Déplacer vers la classe
`mods/learning/commands/learning-document-change-service.ts` les choix propres
aux événements Section/Carte/Question/Sommaire actuellement mêlés au worker.
`LearningDocumentChangeService` reprend les mappings `documentChangeForEvent`
et `commandForChange`, ainsi que la préparation de ressources appelée par
`persistDocumentChange`. Son contrat d’appel réside dans `core/controller/` ;
les types d’événements et changements concrets sont assemblés dans Learning.
Le contrôleur conserve l’admission, la file, l’attente, l’annulation,
les états d’accès et la publication du résultat. La préparation asynchrone
reste invoquée par sa file ; elle ne part pas directement depuis la vue.

Les façades de ressources reçoivent les fonctions dont elles ont déjà besoin.
Elles n’obtiennent pas l’acteur complet pour modifier le contexte d’une autre
fonctionnalité. Une modification multientité reste une transformation et un
geste d’historique, notamment Carousel avec son enfant, ancre avec son BDC et
import avec son usage.

### Raccords étudiés

Les contrats de cette section fixent ce que le codeur doit raccorder. Ils
ne constituent pas un système de plugins. Les implémentations sont construites
explicitement par les trois compositions Learning.

#### A. Document et stockage

Créer `core/document/document-codec.ts` :

~~~ts
export interface DocumentCodec<TDocument, TData> {
  /** Rehydrates one supported document value or raises the format error. */
  readDocument(value: unknown): TDocument
  /** Produces the structured value used by the existing storage boundaries. */
  writeDocument(document: TDocument): TData
  /** Identifies the format rejection handled by project cache recovery. */
  isUnsupportedFormatError(error: unknown): boolean
}
~~~

`LearningDocumentService` implémente ce contrat. Déplacer vers cette classe
le contrôle actuellement fait par `ElceDocument.fromJSON`, et la reconnaissance
de son erreur actuellement dans `isUnsupportedDocumentCacheError`. Garder les
contrôles JSON supplémentaires de l’API dans une méthode
`readIncomingDocument(value: unknown): LearningDocument` : les lectures locales
et le réseau ne doivent pas acquérir silencieusement les mêmes validations.

Signatures cible, avec les arguments obligatoires en premier :

| Symbole | Signature à réaliser |
| --- | --- |
| `IndexedDbDocumentStore` | `constructor(codec: DocumentCodec<TDocument, TData>, databaseName = DATABASE_NAME, databaseVersion = DATABASE_VERSION)` ; rendre classe et port `ElceDocumentStore<TDocument>` paramétrés par le document. |
| `ElceProjectApiClient` | `constructor(codec: DocumentCodec<TDocument, TData>, transport: ProjectHttpTransport)` ; l’instance garde sa propre map des droits. |
| `ProjectSessionCoordinator` | `constructor(store, api, documentServices, session: Storage \| null = typeof sessionStorage === 'undefined' ? null : sessionStorage)` ; le troisième argument actuel `session` devient le quatrième. |
| `ProjectSyncCoordinator` | `constructor(controllerPort, store, api)` ; supprimer le défaut `new ElceProjectApiClient()` et conserver le reste du constructeur existant. |
| `attachDocumentPersistence` | `(controllerPort, store, options = {})` ; supprimer le défaut `new IndexedDbDocumentStore()`. |
| `ProjectApiController` | `constructor(persistence: ProjectPersistence<TDocument>, readIncomingDocument: (value: unknown) => TDocument)` ; les erreurs de décodage restent converties en `400 invalid_request`. |

Le service documentaire fournit également les méthodes typées
`createInitialDocument()`, `withProjectIdentity(document, id, name)`,
`createPageCommand(document, placement, name?, pageType?)`.
`LearningDocumentCommandService` fournit
`mergeMedia(document, canonicalMediaId, duplicateMediaIds)`, qui appelle son
propre `applyDocumentCommand` avec la commande actuelle `media.merge`.
La composition lie cette méthode au port d’historique ; le service documentaire
n’importe pas le service de commandes.

#### B. Acteur, file et historique

Remplacer l’export singleton `controllerMachine` par une fabrique
`createControllerMachine(services)`. Son `setup(...)`, ses états, transitions,
workers et règles d’admission restent ceux du fichier actuel. Le document
initial est construit à l’initialisation de chaque acteur ; il n’existe plus
de `const initialDocument` au chargement du module.

Les services requis sont :

| Service injecté | Méthodes et données à fournir |
| --- | --- |
| Document | Création initiale, création de commande de page, application de commande et fusion média, définies ci-dessus. |
| Changements | `documentChangeForEvent(event, recordedAt)`, `prepare(change, document, store, signal)`, `commandForChange(change, mediaCreated, document)`, `isImportChange(change)`, `historyMetadata(change, selection)`. |
| Sélection | `initial(document)`, `afterReplace(document, current)`, `afterCommand(document, command, current, selectCreatedPage)`, `selectPage(document, current, pageId)`, `selectChapter(document, current, chapterId)` et traitement de la sélection enfant Carousel. |
| Configuration | Onglet initial et types des événements de ressources à raccorder aux mêmes handlers d’admission et de mise en file. |

Les noms `section.change`, `question.media.file.import`,
`card.media.file.import`, `summary.media.file.import` et `carousel.card.select`
restent ceux des appelants. Learning fournit les raccords de ces événements à
la fabrique ; le noyau ne connaît pas leurs payloads. Le raccord de sélection
Carousel reste immédiat ; les quatre changements documentaires gardent leurs
transitions `ready`/`processingDocumentChange` actuelles.

`prepare` retourne `{ operation, mediaCreated, mediaSource }`, avec
`mediaSource: { mediaId, source } | null`. `historyMetadata` retourne
`{ kind, groupKey, recordHistory, recordedAt, selectCreatedPage, selectionBefore?, selectionAfter? }` :
`kind` vaut `commit`, `undo` ou `redo`. Le noyau choisit la navigation historique
avec ce champ, puis appelle `commandForChange` uniquement pour un commit.
Il n’inspecte pas le `kind` concret des opérations d’ancre ou d’import Learning.
Les sélections facultatives sont du type de sélection de la composition.
Les temps déjà capturés à la mise en file restent ceux du geste ; les autres
opérations gardent leur temps de commit actuel.

Typer la fabrique sur le document, la commande, l’événement de ressource, le
changement en file et la sélection. Les événements techniques projet/historique
restent définis dans le noyau ; Learning compose l’union de ses événements.
Ne pas employer `any`, une assertion vers l’ancienne machine ou un acteur
recréé pour contourner cette séparation.

Pour retirer les payloads Section et Carousel du noyau, regrouper les champs
de sélection actuels dans une valeur `selection` typée par la composition.
Le noyau conserve seulement les identifiants page/chapitre nécessaires à ses
opérations communes. `LearningSelectionService` conserve les quatre champs
actuels (`selectedPageId`, `selectedChapterId`, `selectedCarouselCardBdcId`,
`sectionSelection`) et les règles des helpers du contrôleur. Les sélecteurs
Learning réexposent les champs attendus par les vues. Aucun changement de
format documentaire ne découle de ce déplacement d’état de session.

`DocumentHistoryPosition<TDocument, TSelection>` conserve le document et cette
sélection. Ajouter à `rebaseMediaMergeHistory` le callback
`mergeMedia(document, canonicalMediaId, duplicateMediaIds)` ; retirer son import
direct du dispatcher de commandes. Les autres opérations d’historique gardent
leurs algorithmes, la limite 100 et la fenêtre 500 ms.

Définir `ProjectControllerPort` dans
`core/controller/project-controller-port.ts` avec les signatures suivantes :

~~~ts
export interface ProjectControllerPort<TDocument, TSelection> {
  /** Sends one existing technical project or persistence event. */
  send(event: ProjectControllerEvent<TDocument>): void
  /** Reads the current actor-owned project and persistence state. */
  getSnapshot(): ProjectControllerSnapshot<TDocument, TSelection>
  /** Observes the same actor without keeping a second snapshot store. */
  subscribe(
    listener: (snapshot: ProjectControllerSnapshot<TDocument, TSelection>) => void,
  ): { unsubscribe(): void }
}
~~~

`ProjectControllerSnapshot.context` expose les champs effectivement lus :
`document`, `history`, `mediaSources`, `activeProject`, `projects`, `editAccess`
et `documentChanges` limité à sa propriété `length`. `ProjectControllerEvent`
réunit les variantes techniques déjà présentes : remplacement du document,
statut/fusion sync, source média, résumé/alerte/état de projet, disponibilité
de copie locale et activation/suspension d’accès. Conserver leurs payloads de
`controller-types.ts` en paramétrant seulement le document. Ce port n’envoie
pas de commande métier de ressource. Le véritable acteur XState satisfait ce
port ; aucun adaptateur qui stockerait ou recopierait son document n’est ajouté.

#### C. Rendu des pages et éditeurs

Créer `core/authoring/page/page-editor-contributions.ts`. La page commune reçoit :
une liste ordonnée de commandes d’ajout (`id`, libellés, icône, état disponible,
callback), un rendu de l’en-tête de chapitre, un rendu de BDC, et les callbacks
d’actualisation/destruction des sessions d’éditeur. Les valeurs proviennent du
sélecteur et des services ; les fonctions Remix de rendu sont fournies par la
composition Learning. Aucune vue commune n’importe `LearningEditorFacade` ni
un éditeur concret de ressource.

Dans Section, remplacer `profileProperties` par
`textFeature?: SectionTextFeature`, défini avec la ressource :

~~~ts
export interface SectionTextFeature {
  readonly extensions: Editor['options']['extensions']
  readonly attributes: Readonly<Record<string, string>>
  /** Attaches optional text behavior and returns its exact cleanup. */
  attach(editor: Editor): () => void
}
~~~

Learning construit cette contribution avec `createProfileLabelExtension`,
`PROFILE_TOKEN_INSERT_EVENT`, l’attribut de cible et l’insertion `profileLabel`.
L’adaptateur Section ne lit plus de propriété de profil. Il monte les extensions,
fusionne les attributs et appelle `attach` après montage, puis son cleanup à
la destruction. Sans contribution, l’édition Section et les ancres fonctionnent.

Pour Flux/Diapo, ajouter une option `buildAdditionalBdc(page, bdc)` retournant
`{ mountPartId, mountMarkup, stories } | null`, les trois champs déjà produits
par le builder Résultat. Typer le BDC selon la composition ; conserver les
builders intégrés des ressources communes. Learning fournit cette fonction pour
Résultat et vérifie le chapitre Évaluation. Retirer `chapterType` des options
communes Diapo. Un type supplémentaire sans constructeur fourni reste refusé.

#### D. Lecture et preview

`ReadingRuntime<SceneKey, SlotName>` reçoit un `SightyOptions<SceneKey, SlotName>`
déjà construit et expose l’instance `sighty`, `initialize()` et `destroy()`.
Ce sont les types et méthodes publics actuellement disponibles dans Sighty.
Learning construit scénario, contexte, identités, styles et capacités, puis
pilote le démarrage du layout et le rafraîchissement de présentation.

`PopupPreviewHost` reçoit `readSnapshot()` et le codec au lieu d’un
`Actor<typeof controllerMachine>`. La valeur structurée, les identifiants de
requêtes et les messages de synchronisation restent ceux du protocole actuel.
La fenêtre reçoit une `LearningPreviewSession` par la composition de preview ;
elle s’abonne à sa vue et lui transmet les intentions décrites en L7.
`LearningPlayer` reste indépendant de cette session et du protocole de popup ;
il constitue aussi le lecteur destiné au futur contexte exporté.

## Cartographie des fichiers

Les chemins de cette section sont relatifs à `packages/elce/src/`. Les fichiers
`*.test.*` suivent le propriétaire de la fonctionnalité ; les tests qui
traversent plusieurs propriétaires vont dans l’intégration Learning. Mettre
à jour tous les imports dans la même sous-tranche que le déplacement.
Supprimer l’ancien fichier après reprise de ses consommateurs ; ne pas laisser
de réexport de compatibilité ou de seconde implémentation.

### Document, configuration et commandes

| Source actuelle | Découpage et destination |
| --- | --- |
| `domain/document/document-types.ts` | Identifiants et vues structurelles vers `core/document/content-document-types.ts` ; rich text et `SectionContent` vers Section ; contenus spécifiques vers leur ressource ; modèle v5 complet, chapitre Learning et BDC Résultat vers `mods/learning/document/learning-document-types.ts`. |
| `domain/document/document-model.ts` | `createStableId` vers `core/document/stable-id.ts` ; document riche vide vers Section ; `LearningDocument`, aplatissement `scenarioPageIds`, création initiale et défauts des chapitres vers le document/service Learning. Les règles de noms automatiques deviennent des méthodes de service, avec la même suite de noms. |
| `domain/scenario/scenario-entry-types.ts` | `mods/learning/organization/learning-scenario-entry-types.ts` ; les références page/chapitre réutilisent les identifiants communs, leur séquence de parcours reste Learning. |
| `config/document-config.ts` et `document-config-types.ts` | Placement structurel des BDC, MIME de transport et identité catalogue vers le noyau ; constantes/types Carte, Carousel, Question, Graphe, Section et formats de page vers leur ressource ; placement des pages dans le parcours, modèles de chapitre, Évaluation, Sommaire, profil et navigation vers Learning. Les valeurs littérales restent identiques. |
| `config/feature-flags.ts` | Le flag actuel `summaryProfileEditing` devient une configuration de composition Learning ; conserver son nom et son défaut. Aucun système de droits n’en est déduit. |
| `config/presets.ts` | Séparer les objets de preset par ressource ; `evaluation-result-basic` vers Évaluation Learning. Assembler les presets sélectionnés dans la composition Learning. |
| `config/card-preset-types.ts`, `builders/card/card-preset-builder.ts` et `card-preset-builder-types.ts` | Moteur d’instanciation de markup vers `core/presets/`. La classe reçoit explicitement les presets dont elle doit disposer ; elle n’importe aucun registre incluant Learning. |
| `domain/commands/document-command-types.ts` | `BdcPlacement` et intentions structurelles communes vers `core/commands/` ; `PagePlacement` vers `mods/learning/organization/learning-page-placement.ts` ; contrats des commandes de ressources avec leur ressource ; union concrète `LearningDocumentCommand` dans `mods/learning/commands/learning-document-command-types.ts`. Conserver les noms d’événements. |
| `domain/commands/document-commands/apply-document-command.ts` et `index.ts` | Dispatch concret vers `mods/learning/commands/learning-document-command-service.ts`. Le contrôleur appelle ce service par son port. La composition de commandes ne devient pas un second circuit d’écriture. |
| `command-factories.ts` | Créations de contenu vers les classes de ressources ; `createDefaultPageCommand`, `defaultBdcTypeForPlacement`, création du chapitre Learning et création du Résultat vers `LearningDocumentService`. |
| `page-commands.ts` | Transformations de l’agrégat vers `LearningPageCommandService` ; recherches structurelles communes vers `core/document/content-placement-service.ts`. Modèles, Évaluation, `scenarioEntries` et défauts initiaux restent Learning. |
| `bdc-commands.ts`, `section-commands.ts`, `media-commands.ts`, `anchor-commands.ts`, `revelation-commands.ts` | Les classes Learning de L2.1 reconstruisent l’agrégat concret ; les classes des ressources possèdent les valeurs, calculs et validations des contenus. Les opérations Sommaire et Résultat restent Learning. Aucun service commun ne construit un `LearningDocument`. |
| `document-invariants.ts` | Références communes/placement vers `core/document/content-integrity-service.ts` ; invariants des contenus et conteneurs vers leurs ressources ; ordre du parcours, modèles de chapitre, Résultat et contraintes de profil vers `LearningDocumentService` et les classes Learning. |
| `services.ts` et `command-helpers.ts` | Services/règles vers leur propriétaire ; recherches techniques communes seulement vers le noyau. Aucun service Learning n’est construit dans un fichier commun. |

**Points précis à préserver :** la numérotation des noms, les identifiants
initiaux, la création Flux/Section ou Flux/Question suivant le chapitre,
la création Diapo/Carousel avec son enfant et les contrôles Résultat.
`scenarioEntries` appartient au document Learning, même si les chapitres et
pages restent des contenus communs.

### Ressources communes

| Sources actuelles | Destination et responsabilité |
| --- | --- |
| `domain/card/`, `app/facades/card/`, `app/editor/card/`, `builders/card/card-bdc-scene-builder.ts` | `resources/bdcs/card/{domain,authoring,reading}/` ; garder `ElceCardService` et le partage des champs Carte entre page et Carousel. Le moteur de presets commun est traité séparément dans la cartographie du document. |
| `domain/carousel/`, `app/facades/carousel/`, `app/editor/carousel/`, `builders/carousel/` | `resources/bdcs/carousel/{domain,authoring,reading}/` ; conserver les mêmes enfants Carte/Graphe, durées, répétitions, transitions et contrôles de track. |
| `domain/question/`, `app/facades/question/`, `app/editor/question/`, `builders/question/` | `resources/bdcs/question/{domain,authoring,reading}/` ; le contenu, ses règles de réponse et son rendu sont réutilisables. La progression et le score de chapitre restent Learning. |
| `domain/statistical-graph/`, `app/facades/statistical-graph/`, `app/editor/statistical-graph/`, `builders/statistical-graph/` | `resources/bdcs/statistical-graph/{domain,authoring,reading}/` ; ne pas modifier les données ni les quatre rendus. |
| Section de `domain/document/document-types.ts`, `app/editor/section/` | `resources/bdcs/section/{domain,authoring}/` ; conserver le même adaptateur Tiptap, la sélection, le JSON et le HTML exporté. |
| `domain/anchor/`, `app/facades/anchor/`, `app/editor/anchor/`, `app/anchor/anchor-position.ts` | `resources/anchoring/{domain,authoring,reading}/` selon le rôle. Le calcul de placement utilisé par le builder ne doit plus importer `app/`. |
| `builders/flux/` | `resources/pages/flux/reading/` ; conserver ancrage, réservation de flux, scroll natif, repère bas et identités des stories. |
| `builders/diapo/` | `resources/pages/diapo/reading/` ; conserver story unique du Carousel, slots, racines et montage direct. |
| `builders/revelation/` | `resources/revelation/` ; réemploi du circuit Capsule Automation actuel, sans nouvelle règle de progression. |
| `builders/viewport-expansion/` | `resources/viewport-expansion/` ; classes, styles et événements actuels inchangés. |

**Question.** Déplacer les quatre champs de `TestAnswerState`
(`answerIds`, `selectedAnswerIds`, `expectedAnswerIds`, `isCorrect`) vers un type
`QuestionAnswerState` de la ressource Question. L’état test Learning l’utilise
directement. Flux, Diapo et le builder Question ne doivent plus importer
`domain/summary-profile/test-state-types.ts`. Le comportement actuel de révélation
n’est pas étendu dans cette opération.

Le builder contient aussi `selectQuestionAnswer`, `validateQuestionAnswer`
et `sameQuestionAnswerSet`. Déplacer leurs décisions de sélection/correction
dans des méthodes d’`ElceQuestionService`, puis les appeler depuis les straps.
Les fonctions du builder gardent la traduction des résultats en actions de
présentation et événements CodPlay. Conserver les mêmes choix sélectionnés,
corrections, messages et payloads ; ne pas y ajouter la politique d’Évaluation.

**Section et profil.** `section-editor-tiptap-adapter.ts` importe actuellement
`ProfileProperty`, l’extension `profileLabel` et son événement d’insertion ;
`section-editor-remix-view.tsx` lit `documentModel.data.profile.properties`.
Fournir ces capacités depuis l’intégration Learning :
extensions Tiptap, insertion au caret et données d’étiquettes. La Section
partagée reçoit un raccord optionnel de fonctionnalité textuelle ; elle ne
connaît plus le modèle de profil. Learning fournit ce raccord avec les mêmes
noms de nœuds, attributs et événements. Conserver les marqueurs de champs
compatibles et l’unique contrôle d’insertion. Ne pas créer un second éditeur
Section pour Learning.

**Flux/Diapo et Résultat.** Retirer leurs imports directs du builder Résultat.
La composition Learning fournit un constructeur complémentaire pour
`evaluation-result`. Le résultat de montage exprime markup, persos, stories,
styles et éventuels événements de reset, selon les mêmes structures utilisées
aujourd’hui. Remplacer le champ interne `evaluationResultStories` par une
contribution de stories sans sémantique Learning. Préserver leur ordre.
Le format de page ne décide plus du modèle Évaluation.

### Classes et dispositifs Learning

| Sources ou fonctions actuelles | Destination et découpage prescrit |
| --- | --- |
| `domain/evaluation/` | `mods/learning/evaluation/domain/` ; conserver `ElceChapterEvaluation`, `EvaluationMachine`, paramètres, état sérialisable et service Résultat. |
| `app/editor/evaluation-result/`, `builders/evaluation/` | `mods/learning/evaluation/{authoring,reading}/`, avec leur preset et leurs styles. |
| `domain/summary-profile/summary-profile-types.ts` | `mods/learning/profile/domain/learning-profile-types.ts` pour propriétés/règles ; réglages Sommaire vers `organization/learning-summary-types.ts`. La forme sérialisée reste identique. |
| `profile-rules.ts` | Classe `LearningProfileService` : validation, valeurs, conditions, usages et héritage. Classe `LearningProgressionService` : prérequis et décisions d’accès/fin de page. Réutiliser les mêmes calculs, sans les recopier dans les gardes Sighty. |
| `reader-projection.ts` | Classe `LearningReaderProjectionService` dans `profile/reading/` : projection immuable, filtrage des contenus et résolution des tokens ; le document auteur reste intact. |
| `test-state-types.ts` et `test-state-reconciliation.ts` | `mods/learning/reading/learning-test-state-types.ts` et classe `LearningTestStateService` ; seul `QuestionAnswerState` part dans la ressource Question. |
| `builders/summary-profile/` | `mods/learning/organization/reading/` pour Sommaire ; `profile/reading/` pour Formulaire. |
| `app/editor/profile/` | `mods/learning/profile/authoring/` ; extension Tiptap, événements et insertion contextuelle restent une fonctionnalité Learning. |
| `builders/scenario/scenario-builder.ts` | Classe `LearningScenarioBuilder` dans `mods/learning/reading/` ; détail ci-dessous. |
| `scenario-builder-types.ts` | `mods/learning/reading/learning-scenario-types.ts` ; le noyau ne connaît pas les slots nommés de Learning. |

Répartir le fichier scénario actuel de la façon suivante :

- `createScenarioViews`, `scenarioEntryView`, chemins, ordre, entrée initiale
  et fabriques de slots : méthodes de `LearningScenarioBuilder`.
- `createPageAccessGuard`, `pageProfileConstraintsAllowAccess`,
  `chapterReadingRequirementMet`, `createPageExitGuard`, `isPageComplete` et
  `canLeavePage` : décisions de `LearningProgressionService`. Les handlers
  Sighty restent de minces raccords à ses méthodes.
- `createMarkPageFinished`, `createSaveProfileValues`,
  `createSubmitProfile` et `createRecordQuestionResult` : raccords de la
  classe `LearningScenarioActions`, qui appelle les classes de profil,
  progression et état test, puis utilise les ports Sighty actuels.
- `recordEvaluationAnswer`, `createEvaluationMachine` et le calcul d’issue de
  `createRefreshEvaluationResult` : `LearningEvaluationSessionService`,
  qui utilise les classes Évaluation actuelles. L’envoi de l’issue à la scène
  reste effectué par le raccord Sighty.
- `scenarioContextFromTestState`, `testStateFromScenarioContext` et lectures
  typées de ses valeurs : `LearningTestStateService`.
- `createLayoutScene`, `createTitleScene`, `createNavigationScene`,
  `createEmptyPageScene`, `createProfileCompleteScene` et leurs persos :
  `LearningLayoutSceneBuilder`.
- `createPresentation` et `refreshPresentation` : calcul de présentation dans
  `LearningPresentationService`, puis livraison par `LearningScenarioActions`.

Les classes sont instanciées dans la composition de lecture Learning.
Les fonctions de raccord peuvent rester des fonctions ; leurs règles métier
appellent les classes. Aucune de ces classes n’écrit directement dans le
document auteur ni dans le DOM CodPlay.

### Contrôleur, façades, session et stockage navigateur

| Sources actuelles | Destination et transformation |
| --- | --- |
| `app/controller/controller-machine.ts`, `controller-types.ts`, `document-change-types.ts` | `core/controller/` : fabrique du contrôleur, admission, file et cycle des opérations. Services documentaires et préparation des changements sont injectés. Les variantes liées aux ressources et au fond Sommaire sont assemblées par Learning. |
| `app/controller/document-persistence.ts` | `core/persistence/` ; conserver la file, le flush, la rétention des médias et le moment de `onLocalSave`. |
| `app/history/` | `core/history/` ; document et commandes typés par la composition, mêmes états avant/après et mêmes règles de regroupement. |
| `app/projects/` et `app/sync/` | `core/projects/` et `core/sync/` ; retirer les constructions/imports de document Learning ; injecter codec, création et copie avec identité. Conserver un seul coordinateur de chaque rôle. |
| `app/facades/editor-actions-facade.ts` | Extraire `core/authoring/core-editor-facade.ts` pour projets, accès et historique ; garder les façades de ressources ; composer les intentions Learning dans `mods/learning/authoring/learning-editor-facade.ts`. |
| `app/selectors/editor-view-model.ts` | Projections communes dans `core/authoring/` ; projection spécifique des chapitres, de l’ordre et du profil dans `LearningAuthoringService`. Les sélecteurs lisent le snapshot sans constituer un store. |
| `domain/media/` | `core/media/` ; garder déduplication, MIME et import, dont `ElceMediaResourceService`. |
| `domain/catalog/` | `core/catalog/` ; catalogue du document courant uniquement. |
| `infrastructure/indexed-db/` | `core/persistence/indexed-db/` ; retirer `ElceDocument.fromJSON` direct et recevoir le codec Learning. Préserver transactions et purge ; un simple déplacement conserve base, version et clés. Un changement de schéma/cache suit [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire). |
| `infrastructure/project-api/` | `core/persistence/project-api/` pour HTTP/document/médias ; décodage documentaire injecté. Extraire le typage et les appels d’état test vers `mods/learning/persistence/learning-test-state-api-client.ts`, en réutilisant le transport HTTP existant. |
| `config/api-config.ts` | Configuration technique conservée dans le noyau, avec les mêmes origines, ports et durées de bail. |

**Appels à reprendre impérativement :**

- L’initialisation du contexte de `controllerMachine` appelle aujourd’hui
  `createInitialDocument()` : utiliser le service injecté, sans publication
  implicite d’un projet au démarrage.
- `ProjectSessionCoordinator.createProjectDocument` construit la même valeur
  et lui donne son identité : déléguer au service Learning ; conserver
  le nom `Projet N` et l’attente de création serveur.
- La copie locale et `Enregistrer sous…` réinstancient le document :
  passer par ce même codec, conserver les identités média et leur source.
- Les imports Section/Carte/Question/Sommaire gardent la même file XState.
  Une couche d’interface ne prépare pas un fichier en dehors de cette file.
- `media.merge` reste une normalisation interne sous le même acteur, avec
  réécriture de l’historique et sans nouveau geste auteur.
- `attachDocumentPersistence` possède actuellement un store IndexedDB construit
  par défaut : rendre ce raccord explicite à la composition. Le noyau ne choisit
  pas un adaptateur qui nécessiterait implicitement le codec Learning.

Lors de la séparation de l’état test du client API, extraire seulement le
transport HTTP nécessaire depuis `ElceProjectApiClient` et le partager par
injection. Conserver origine, fonction Fetch, parsing d’ETag et erreurs ; les
droits documentaires restent gérés par leur client actuel. Le client d’état
test ne réimplémente pas un second transport.

### Auteur et présentation commune

| Sources actuelles | Destination et responsabilité |
| --- | --- |
| `app/remix/project-application.tsx` et ses types | Cadre projet dans `core/authoring/layout/` : menu de projet, accès, statut, historique et accueil des surfaces du mod. Les actions sont typées par les besoins du cadre, sans import de `LearningEditorFacade`. |
| `app/remix/editor-context.ts` | `core/authoring/context/` ; références de services et abonnement au même acteur. La spécialisation Learning se fait à la composition, sans second document dans le Context. |
| `app/remix/workspace/editor-workspace.tsx` et types | Séparer la grille, les commandes responsive et l’hôte central dans le cadre commun ; organisation, réglages Sommaire/profil et déplacement d’entrées du scénario dans `mods/learning/authoring/learning-workspace.tsx`. |
| `scenario-panel.tsx`, `scenario-panel-types.ts`, `chapter-settings.tsx` et types, `summary-profile-settings.tsx` | `mods/learning/authoring/` ; ils appartiennent à l’organisation Learning. Les décisions et validations présentes dans leurs handlers sont déléguées aux classes Learning. |
| `page-editor.tsx` | `core/authoring/page/` pour titre de page, séquence, séparateurs, sélection et montage des éditeurs de ressources. Recevoir les actions de création autorisées et les contributions d’éditeur. Le titre/type du chapitre et le bouton Résultat sont fournis par Learning. |
| `page-type-icon.ts` | Avec les ressources de formats de page ; la composition fournit leurs icônes au cadre. |
| `content-catalog-panel.tsx` et `catalog-panel-types.ts` | `core/authoring/catalog/` pour BDC disponibles et médias ; l’onglet Profil et ses déclencheurs sont fournis par Learning. |
| `app/editor/media/` | `core/authoring/media/` ; contrôle partagé par Question et fond du Sommaire sans dépendance de l’un envers l’autre. |
| `lucide-static-icon.tsx` et `remix-render-handle.ts` | Utilitaires de présentation communs dans `core/authoring/`. |
| `summary-profile-access-icon.ts` | `mods/learning/authoring/` ; même référence d’icône fournie aux deux accès Sommaire/Test auteur. |
| `app/layout/app-layout.css` | Séparer règles de grille/contrôles communs, styles de ressources et styles des panneaux Learning ; garder sélecteurs, ordre de cascade et points de rupture. |

Les surfaces sont fournies par la composition : organisation à gauche, outil
central spécifique quand sélectionné, page commune et contributions au catalogue.
Utiliser des props et fonctions de rendu explicites, sans catalogue d’extensions
d’interface ni interprétation de configuration.

Les gestes DOM, brouillons de saisie et états visuels restent dans les vues.
Les décisions de placement, d’admissibilité d’un type ou de validité d’une
valeur sont données par les services/façades. Un titre vide restaure toujours
la valeur précédente selon le contrat actuel.

### Lecture, preview et état test

| Sources actuelles | Découpage et destination |
| --- | --- |
| `player/elce-player-composition.ts` | `core/reading/reading-runtime.ts` pour construction Sighty, initialisation, diagnostics et destruction à partir d’une composition fournie ; `mods/learning/reading/learning-player.ts` pour scénario, démarrage du layout, rafraîchissement de présentation et menu. |
| `createPageSceneCatalog` dans ce fichier | `LearningPageSceneCatalog` reçoit les pages retenues et les contributions de builders ; extraction du cache technique dans `core/reading/`. L’ordre des pages et les options issues de l’Évaluation sont calculés par Learning. Un seul catalogue de scènes Sighty est produit. |
| `player/player-composition-types.ts` | Types du cache et du cycle dans le noyau ; options document, état test et départ Learning dans le mod. |
| `player/media-playback/` | `core/reading/media-playback/` ; conserver `bindPageMediaPlayback` et `withPageMediaStop`, déclenchés par les mêmes frontières Sighty. Remplacer l’import d’`ELCE_SCENARIO.CONTENT_SLOT` et des types de slots/scènes Learning par le slot et les types fournis à l’appel. |
| `builders/markup-validation/` | `core/reading/markup-validation/`, même diagnostic et même moment de validation. |
| `player/elce-player-style.ts` | Styles de layout/menu/navigation/profil/Résultat dans Learning ; styles de BDC/pages dans leurs ressources. Les contributions sont assemblées explicitement, en préservant leur ordre et leurs sélecteurs. |
| `app/player/popup-preview-host.ts` et `popup-preview-messages.ts` | `core/preview/` ; protocole, demandes et instantanés restent inchangés ; sérialisation/décodage par les services fournis. |
| `app/player/popup-player.tsx` et CSS | Surface fenêtre/barre d’actions dans `core/preview/` ; chargement/réconciliation/projection/reset métier vers `mods/learning/preview/learning-preview-session.ts` et classes Learning. |
| `app/player/player-preview.ts` | `isCatalogPage` reste dans `LearningPreviewService` ; collecte du profil, projection et validation du départ rejoignent le chemin partagé `LearningPlayer` et ses classes de profil. La surface commune ne lit plus `data.profile`. |
| `app/player/project-test-state-session.ts` | `mods/learning/preview/` ; garder révision indépendante, file de sauvegarde, conflit et mode local existants. |

`LearningPreviewSession` raccorde les lectures/écritures techniques de l’état
test au lecteur partagé. La composition de preview construit cette session ;
le futur export possède son raccord de contexte. Les actions du scénario
continuent de produire les changements via les ports Sighty actuels. Les classes Learning calculent
projection, réconciliation et resets. La popup déclenche des intentions et
affiche leur état ; elle ne conserve plus ces règles dans ses handlers JSX.

Le document est actuellement v5 et l’état test v1 ; leurs éventuelles évolutions
suivent [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire). Il n’est pas demandé de sérialiser un parcours Sighty générique ni
d’inventer une API de restauration.
Le déplacement d’une responsabilité ne doit pas ajouter une sauvegarde, une
navigation ou une reconstruction supplémentaire.

Le runtime commun reçoit le scénario, son contexte initial, ses identités
d’instances, les capacités CodPlay, les styles et les observations de cycle
nécessaires. Learning fournit ces valeurs avec les identités et options
actuelles. Le runtime commun ne construit pas un scénario par défaut, ne
connaît pas `ElceSceneKey`/`ElceSlotName` et ne décide pas de démarrer le layout
Learning. Le STOP média conserve `elce:page-media:stop` et son émission vers
l’occurrence sortante, même lorsque la page a déjà perdu sa liaison active.

**Cache :** reprendre la signature et les conditions d’invalidation actuelles
avant de les factoriser. Vérifier explicitement contenu, médias, type de page,
contexte Évaluation, styles et état de Question aux frontières utilisées.
Si un défaut antérieur apparaît, le consigner et décider son traitement dans
le plan propriétaire ; ne pas le masquer par une reconstruction systématique.

### Serveur, SQLite et points de lancement

| Sources actuelles | Destination et transformation |
| --- | --- |
| `server/projects/project-persistence.ts` | Port de projet dans `core/server/projects/`, typé par le document fourni ; états et révisions du test Learning dans un port distinct du mod. |
| `server/projects/project-api-controller.ts` | `core/server/projects/` ; recevoir le codec, les invariants et opérations nécessaires. Retirer les imports de version et de document Learning, sans changer les réponses HTTP. |
| `server/projects/project-edit-grant.ts` | `core/server/projects/` ; mêmes règles d’en-têtes et erreurs. |
| `server/projects/project-test-state-api-controller.ts` | `mods/learning/persistence/server/` ; validation métier dans `LearningTestStateService`. Préserver `/test-state`, ETag, erreurs et permissions de preview réseau. |
| `server/projects/sqlite/`, dont migrations | `mods/learning/persistence/server/sqlite/` ; adapter le nom de classe en `LearningSqliteProjectPersistence`. Conserver la connexion et le circuit de migrations ; les changements de schéma suivent [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire). |
| `server/media/` | `core/server/media/` ; réutiliser le port `MediaPersistence`, le stockage de fichiers et les contrôles actuels. |
| `server/api-router.ts` | Routes projet/médias dans `core/server/http/` ; les routes Learning de test sont ajoutées explicitement par `mods/learning/composition/server/server-composition.ts`. Garder l’ordre et les hooks de nettoyage après remplacement/suppression. |
| `server/network-preview-api-policy.ts` | `core/server/http/` ; mêmes restrictions réseau. La présence de `/test-state` est une contribution Learning explicite, avec les autorisations actuelles. |
| `server/elce-http-server.ts` | Point de lancement conservé ; la composition Learning ouvre son dépôt au format courant et fournit les contrôleurs. Le cycle HTTP/fichiers/fermeture reste commun. |
| `server/elce-local-server.ts` | Point de lancement conservé ; mettre à jour entrées et listes CSS, règles d’accès aux sources et chemins après déplacements. |
| `app/remix/browser-entry.tsx` et `remix-spa-router.tsx` | Entrées conservées ; choisir explicitement les compositions auteur/preview Learning. La route lecteur ne crée toujours ni acteur auteur ni store d’édition. |

L’adaptateur SQLite Learning continue d’implémenter les opérations de projet,
média et test sur la connexion actuelle. Il est sélectionné à la composition.
Cette étape retire sa dépendance du noyau ; elle ne construit pas un moteur
de projection SQL extensible. Les services communs d’accès et de média restent
utilisés ; aucune seconde transaction, base ou implémentation de synchronisation
n’est introduite pour la séparation.

Pour un simple déplacement, préserver les noms et l’ordre des migrations
historiques. Mettre à jour `MIGRATIONS_DIRECTORY` sans faire rejouer une migration
déjà appliquée ; le même fichier SQLite doit se rouvrir. Si une évolution de
schéma est acceptée avant la fixation du format, la base d’essai peut être
recréée selon [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire) : son ouverture puis sa réouverture au nouveau schéma sont
requises, sans obligation de reprendre l’ancienne base d’essai.

**Chemins non TypeScript à traiter :** `index.html`, listes de styles et entrée
dans `elce-local-server.ts`, chemins chargés par `scripts/dev-elce.mjs` et
`scripts/dev-api.mjs`, références CSS et tests. Les deux entrées serveur conservées
limitent les changements de scripts ; vérifier néanmoins leurs imports réels.

Le serveur local refuse aujourd’hui `src/server/**` aux clients réseau.
Après déplacement, protéger aussi `src/core/server/**`,
`src/mods/learning/persistence/server/**` et `src/mods/learning/composition/server/**`.
Les modules serveur ne doivent pas devenir accessibles parce qu’ils ont changé
de dossier. Vérifier le chemin HTTP réel et les réponses de refus.

## Pistes techniques de découpage

Ces pistes conservent les correspondances de fonctions, les signatures et les
conséquences de découpage étudiées. Elles sont des hypothèses techniques à
confronter au périmètre retenu. Les repères L1–L8 identifient les sujets ; les
chemins sont relatifs à `packages/elce/src/`, sauf mention contraire.

### L1 — séparer les dépendances de données, configuration et presets

#### L1.1 — éclater `config/document-config.ts` et ses types

Créer les fichiers ci-dessous et déplacer les exports indiqués, sans recopier
les valeurs. Adapter aussitôt tous leurs importeurs.

| Destination | Exports source à y attribuer |
| --- | --- |
| `core/document/content-location.ts` | `BDC_LOCATION`, `BDC_ORDER` et placement/transport structurel des BDC. Les admissibilités des types de BDC restent dans les ressources et leur composition. |
| `mods/learning/organization/learning-page-placement.ts` | `PAGE_LOCATION`, `PageLocationKind` et `PagePlacement` ; conserver les littéraux `chapter`, `scenario` et `catalog`, avec les mêmes règles d’organisation du parcours. |
| `core/catalog/catalog-config.ts` | `CATALOG_REFERENCE` et les deux onglets `AVAILABLE_BDCS`/`MEDIA` ; l’entrée `PROFILE` part dans la configuration auteur Learning. |
| `core/media/media-config.ts` | `MEDIA_TYPE`, `MEDIA_MIME_PREFIX`, `MEDIA_FILE_EXTENSIONS`, `MEDIA_FILE_ACCEPT` et types MIME. |
| `resources/anchoring/anchor-config.ts` | `ANCHOR`, `ANCHOR_RETURN`, `ANCHOR_MEDIA_PRESETS`. Les identités de presets Carte sont importées de Carte. |
| `resources/bdcs/section/section-config.ts` | Identité Section de `BDC_TYPE`/`DEFAULT_PRESET_ID`, `SECTION_EDITOR_HEADING_LEVELS`. |
| `resources/bdcs/question/question-config.ts` | Identité Question/preset, `QUESTION_TYPE`, `QUESTION_TYPE_CONFIG`, `QUESTION_TYPE_OPTIONS`, `QUESTION_DEFAULTS`. |
| `resources/bdcs/card/card-config.ts` | Identité Carte/presets, `CARD_LAYOUT_IDS`, `CARD_LAYOUT_OPTIONS`, `CARD_IMAGE_FIT`, `CARD_IMAGE_FIT_OPTIONS`. |
| `resources/bdcs/carousel/carousel-config.ts` | Identité Carousel/preset, modes, ratios, positions et leurs options, `CAROUSEL_CONFIG`. |
| `resources/bdcs/statistical-graph/statistical-graph-config.ts` | Identité Graphe/presets, `STATISTICAL_GRAPH_RENDERING`, `STATISTICAL_GRAPH_LAYOUT_IDS`. |
| `resources/revelation/revelation-config.ts` | Transitions actuellement nommées `CAROUSEL_TRANSITION`, leurs options, `REVELATION_TRANSITION_PAIRS`, `DEFAULT_PROJECT_REVELATION` ; Carousel les importe de cette ressource commune. |
| `resources/pages/flux/flux-config.ts` et `diapo/diapo-config.ts` | Leur identité actuelle issue de `PAGE_TYPE`. |
| `mods/learning/organization/learning-organization-config.ts` | `SCENARIO_ENTRY_KIND`, `CHAPTER_TYPE`, `CHAPTER_TYPE_CONFIG`, `ELCE_SCENARIO`. |
| `mods/learning/evaluation/learning-evaluation-config.ts` | Identité Résultat/preset, branches, actions, options, seuil, tentatives et `EVALUATION_RETRY_SCOPE`. |
| `mods/learning/authoring/learning-authoring-config.ts` | Onglet `PROFILE` et `summaryProfileEditing` provenant de `config/feature-flags.ts`. |
| `mods/learning/reading/learning-reading-events.ts` | Événements de parcours, présentation, profil, menu et Évaluation de `ELCE_EVENTS` ; `ELCE_SCENARIO_HANDLERS`. Les événements Question et fin de page restent possédés par leurs ressources puis importés ici. |

Les objets d’ensemble `BDC_TYPE`, `PAGE_TYPE` et `DEFAULT_PRESET_ID` deviennent
des assemblages Learning dans `mods/learning/learning-definition.ts` ; les ressources
importent leur identité locale et les seules dépendances qu’elles utilisent.
Scinder `document-config-types.ts` selon les mêmes propriétaires ; retirer
les deux anciens fichiers après reprise de tous leurs consommateurs.

**Sortie :** aucune ressource ne dépend d’un objet global contenant Résultat,
profil ou modèles de chapitre ; les chaînes et valeurs restent identiques.

#### L1.2 — scinder `domain/document/document-types.ts`

| Destination | Déclarations et modifications |
| --- | --- |
| `core/document/content-document-types.ts` | `ChapterId`, `PageId`, `BdcId`, `MediaId`, `MediaMetadata` ; vues communes avec identité, nom, références et placement. `type` y est un identifiant fourni par la composition. Aucun payload BDC, profil, Résultat, `scenarioEntries` ou `scenarioPageIds`. |
| `resources/bdcs/section/domain/section-types.ts` | `RichTextAttributeValue`, `RichTextMark`, `RichTextNode`, `RichTextDocument`, `SectionContent`. |
| `resources/revelation/revelation-types.ts` | `RevelationTransitionDefaults` et `RevelationTransitionOverrides`. |
| `resources/document/resource-document-types.ts` | Vue des données communes aux ressources existantes : pages, BDC avec leurs payloads Section/Question/Carte/Carousel/Graphe, médias et catalogues. Les services qui ne font que lire ces données prennent cette vue ; ils ne prennent plus `ElceDocument`. |
| `mods/learning/document/learning-document-types.ts` | `LearningChapter`, `LearningBdc` complété par `evaluationResult`, `LearningDocumentData`, types complets de pages et union sélectionnée des ressources. Les modèles Learning étendent les vues communes sans les dupliquer. |

Déplacer `domain/document/document-model.ts` vers
`mods/learning/document/learning-document.ts`, renommer `ElceDocument` en
`LearningDocument`. Déplacer `createStableId` vers `core/document/stable-id.ts`
et `createEmptyRichTextDocument` vers Section. Les noms automatiques et la
création initiale deviennent des méthodes de `LearningDocumentService`.
Conserver le getter `scenarioPageIds` dans Learning.

Reprendre tous les imports de `Bdc`, `Chapter`, `Page` et `ElceDocument` :
un module commun reçoit une vue ou un payload de sa ressource ; seul Learning
importe les types complets. Ne pas résoudre les erreurs en important un type
Learning depuis un fichier commun.

**Sortie :** le modèle Learning sérialise encore le format de départ ; toute
évolution nécessaire est explicitée selon [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire). Les types communs ne connaissent
pas les champs Learning.

#### L1.3 — rendre le moteur de presets indépendant

1. Déplacer `config/card-preset-types.ts` et les deux fichiers du moteur
   `builders/card/card-preset-builder*.ts` sous `core/presets/`.
2. Ajouter au constructeur de `ElceCardPresetBuilder` l’argument obligatoire
   `presets: Readonly<Record<string, CardPreset>>`. `build(...)` garde sa signature.
   Ajouter `getPreset(presetId: string): CardPreset | undefined` pour l’aperçu
   d’ancre qui lit actuellement directement `CARD_PRESETS[preview.layoutId]`.
3. Scinder les entrées de `CARD_PRESETS` dans un fichier `*-presets.ts` par
   ressource ; `evaluation-result-basic` appartient à Learning.
4. Dans Flux, Question, Carte, Carousel, Résultat et
   `elce-anchor-extension.ts`, supprimer chaque `new ElceCardPresetBuilder()`
   sans argument. Faire recevoir le builder par leurs options/constructeurs.
   La composition fournit un moteur construit avec les presets sélectionnés.
5. Mettre à jour les tests du moteur et de tous ces consommateurs dans ce lot.

Signatures concrètes à reprendre dans cette sous-tranche :

| Appel actuel | Appel cible |
| --- | --- |
| `new ElceCardBdcSceneBuilder()` | `new ElceCardBdcSceneBuilder(presetBuilder)` ; remplacer le singleton interne par ce champ. |
| `new ElceCarouselSceneBuilder()` | `new ElceCarouselSceneBuilder(presetBuilder, cardBdcSceneBuilder)` ; ses builds enfant utilisent cette instance Carte. |
| `buildQuestionCardPreset(rootId, partPrefix, question)` | Ajouter `presetBuilder` comme quatrième argument ; `buildQuestionBdcStory` ne construit pas de preset et garde ses arguments. |
| `buildEvaluationResultBdcScene(page, bdc)` | Ajouter `presetBuilder` comme troisième argument et le transmettre aux fonctions de branches. |
| `buildFluxScene(page, bdcs, options = {})` / Diapo | Rendre `options` obligatoire ; y ajouter `presetBuilder`, `cardBdcSceneBuilder` et `carouselSceneBuilder`. Retirer les singletons correspondants des modules de format. |
| `createElceAnchorExtension(options = {})` | Rendre `options` obligatoire et ajouter `presetBuilder` à `ElceAnchorExtensionOptions`. L’aperçu passe par `getPreset` ; supprimer l’export singleton `ElceAnchorExtension` après reprise de ses consommateurs. |

Les sources de scènes et l’adaptateur Section reçoivent ces instances par leurs
options depuis l’assemblage courant ; elles seront réunies dans les fichiers
de composition à L3/L5/L6. Les tests de construction fournissent explicitement
leurs presets et builders de fixture.

**Sortie :** presets connus/inconnus et IDs générés identiques ; aucun preset
Learning importé par le moteur commun.

### L2 — créer les services documentaires Learning

#### L2.1 — remplacer les fonctions d’agrégat par des classes

Créer sous `mods/learning/commands/` :

| Classe / fichier | Corps source à déplacer |
| --- | --- |
| `LearningDocumentCommandService` / `learning-document-command-service.ts` | `applyCommand`, `applyDocumentCommand` et `canMoveBdcToPage` depuis `apply-document-command.ts` ; le dispatch appelle les classes ci-dessous et les invariants avant retour. |
| `LearningPageCommandService` / `learning-page-command-service.ts` | Toutes les transformations de `page-commands.ts`, notamment création initiale, parcours racine, ordre des chapitres et réglages Évaluation. |
| `LearningBdcCommandService` / `learning-bdc-command-service.ts` | Transformations de `bdc-commands.ts` et adaptation du document concret ; les valeurs et validations des contenus restent dans les classes de ressources. |
| `LearningAnchorCommandService` / `learning-anchor-command-service.ts` | Transformations de `anchor-commands.ts` et `section-commands.ts` ; appeler les services d’ancres et Section partagés. |
| `LearningMediaCommandService` / `learning-media-command-service.ts` | Transformations de `media-commands.ts`, y compris l’écriture du fond Sommaire ; déduplication et règles MIME restent communes. |
| `LearningRevelationCommandService` / `learning-revelation-command-service.ts` | Reconstruction du document depuis `revelation-commands.ts` en utilisant les réglages de la ressource Révélation. |

Les méthodes d’adaptation qui retournent aujourd’hui `new ElceDocument(...)`
retournent `LearningDocument`. Elles restent dans Learning pour cette première
extraction, qui possède le schéma d’agrégat. Les classes de ressources ne
reconstruisent pas un document Learning. Ainsi la logique de contenu réemployable
reste unique sans imposer un protocole de commandes extensible à ce stade.

Retirer `services.ts` : instancier ses classes à la composition et les passer
aux constructeurs concernés. Retirer les anciennes fonctions après reprise
de leurs appelants ; aucun dispatcher historique parallèle ne subsiste.

#### L2.2 — répartir les factories et invariants

1. Déplacer `DocumentCommand` vers `LearningDocumentCommand` ; extraire les
   sous-unions par ressource dans leur dossier `authoring/`. Une façade Carte
   ne dépend que de `CardCommand`, une façade Question de `QuestionCommand`.
   La composition Learning réunit ces unions avec les commandes de parcours.
2. Déplacer les factories `createQuestionBdcCommand`,
   `createSectionBdcCommand`, `createCarouselBdcCommand`,
   `createCardBdcCommand`, `createStandaloneCardBdcCommand` et les deux factories
   Graphe dans leurs classes de ressources. Les noms d’événement restent inchangés.
3. Dans `LearningDocumentService`, placer `createDefaultPageCommand`,
   `defaultBdcTypeForPlacement`, `nextPageName`, `nextChapterName`, création de
   chapitre et création de Résultat. Conserver les identifiants initiaux et la
   suite de noms.
4. Dans `command-helpers.ts` :
   - `insertAt`, `removeValue`, `replaceAt` et bornage vont dans
     `core/document/collection-operations.ts` ;
   - recherches structurelles page/BDC/chapitre vont dans
     `core/document/content-placement-service.ts` ;
   - `removeScenarioPageEntry`, `scenarioEntryIndexForPage`,
     `scenarioEntryIndexForChapter`, `sourceIndexForPlacement`,
     `indexAfterPageRemoval`, `pageIndexForPlacement`,
     `pageBelongsToEvaluationChapter` et l’adaptation `placePage` restent
     dans `LearningPageCommandService` ;
   - `findFluxPage` reste avec le raccord d’ancrage Flux ; `withPage` et
     `withBdc` restent dans les services Learning reconstruisant l’agrégat ;
   - les contrôles Carousel, Section et données des illustrations appellent
     leurs classes de ressources ; les helpers qui reconstruisent l’agrégat
     restent avec les classes Learning qui les consomment.
5. Scinder `assertDocumentInvariants` en appels au contrôle structurel commun,
   aux classes des ressources et aux contrôles Learning. Garder tous les cas
   du fichier source : placement unique, enfants, ancres, catalogues, cardinalité
   Diapo, ordre du parcours, modèles, Résultat, profil et médias.
6. Relier `LearningDocumentService.assertDocumentInvariants` à cette chaîne.
   Le service de commandes l’appelle après sa transformation ; le service
   documentaire n’importe pas le service de commandes en retour.

**Consommateurs à reprendre :** contrôleur, historique, façades, page editor
(pour `canMoveBdcToPage`), client de projet, coordinateur de session et contrôleur
HTTP. Les constructions et appels de domaine précédents passent désormais par
les méthodes correspondantes.

**Acceptation L2 :** `document-commands.test.ts` devient un test d’intégration
Learning. Même création Flux/Section, Flux/Question et Diapo/Carousel/enfant ;
mêmes déplacements/refus, commandes composites et réglages ; aller-retour du
format retenu. Les jeux d’essai peuvent être recréés selon [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire).

### L3 — découpler l’acteur, l’historique et la persistance navigateur

#### L3.1 — faire la fabrique de machine avec les mêmes transitions

1. Déplacer `controller-machine.ts` et `controller-types.ts` vers
   `core/controller/` et réaliser la fabrique de la partie B des raccords étudiés.
2. Créer `mods/learning/authoring/learning-selection-service.ts` ; y déplacer
   `keepSelectedPage`, `keepSelectedChapter`, `selectedCarouselCardAfterCommand`,
   `keepSelectedCarouselCard`, `findCarouselCard` et `keepSectionSelection`.
   Ces méthodes retournent la sélection complète, sans stockage indépendant.
3. Créer `mods/learning/commands/learning-document-change-service.ts` ; y
   déplacer `documentChangeForEvent`, `commandForChange`, `withAnchorMedia`,
   `persistMediaImport` et `isImportChange`. `document-change-types.ts` devient
   `learning-document-change-types.ts` à côté.
4. Déplacer `resolveImportedMedia` et `createObjectUrl` vers
   `core/media/media-import-service.ts`. Le service conserve comparaison des
   octets, sauvegarde, annulation et nettoyage d’erreur. Le contrôle
   « fond Sommaire = image » reste dans le service Learning.
5. Le worker `persistDocumentChange` de la machine appelle
   `changes.prepare(...)` avec le même `AbortSignal`. Le résultat comprend
   l’opération préparée, `mediaCreated` et l’ajout éventuel
   `{ mediaId, source }` ; le noyau n’inspecte plus le payload d’un import.
6. `commitCommand` appelle le service de commandes fourni ; le calcul de
   sélection appelle `LearningSelectionService` ; le commit et l’enregistrement
   historique restent dans ce même `assign`.
7. Reprendre `document.replace` et le résultat de `project.operation` pour
   installer la sélection fournie et vider l’historique aux mêmes moments.
8. Conserver la priorité `nextDocumentChange` : vider la file, traiter
   l’opération projet en attente, puis retrouver l’état d’accès correspondant.

**Contrôle de source :** aucun import d’ancres, Question, Carte, Sommaire ou
modèle Learning dans la machine commune. Aucun état XState supplémentaire
n’est requis pour cette extraction.

#### L3.2 — retirer `Actor<typeof controllerMachine>` des services communs

Déplacer l’historique vers `core/history/` et réaliser son paramétrage de la partie B des raccords étudiés.
Créer `ProjectControllerPort` sur les usages réels suivants :

| Consommateur | Lectures et opérations à conserver |
| --- | --- |
| `document-persistence.ts` | Document, historique, sources média ; abonnement aux commits ; envoi de remplacement, statut sync et source média. |
| `project-sync-coordinator.ts` | Projet actif, document et médias retenus par l’historique ; statut sync et fusion canonique ; abonnement existant. |
| `project-session-coordinator.ts` | Document, liste des projets, projet actif, accès et longueur de file pour attendre la quiescence ; événements projet/accès/remplacement/sync. |

Le snapshot du port inclut `context`. Le helper actuel
`waitForControllerQuiescence` attend exactement `editAccess === 'waiting'` et
`documentChanges.length === 0` ; conserver ces deux conditions, sans déduire
la quiescence du seul nom d’un état. `subscribe` retourne le même objet doté
de `unsubscribe()`. N’ajouter aucun état miroir.

Reprendre ensemble les signatures de `attach`, `requireController`,
`waitForControllerQuiescence`, `installServerDocument`,
`restoreMediaSources` et `revokeRegisteredMediaSources`, ainsi que les
constructeurs de `ProjectSyncCoordinator` et `ProjectSessionCoordinator`.

#### L3.3 — injecter codec, création et copie

1. Déplacer `infrastructure/indexed-db/` vers `core/persistence/indexed-db/`.
   `loadDocument` appelle le codec ; retirer son `switch` sur la version du
   document. Conserver les transactions et la lecture brute des références
   média utilisées par `deleteDocument` et `deleteOrphanedMedia`.
2. Déplacer `config/api-config.ts` sous `core/persistence/project-api/`.
3. Extraire `ProjectHttpTransport` depuis `ElceProjectApiClient` :
   constructeur `(origin = elceApiOrigin(), request = fetch)` ; méthodes
   `url(path)`, `request(path, init?)`, `readResponseJson<T>(response)` et
   `revisionFrom(response)`. Déplacer le code existant, dont
   `ElceProjectApiError`, sans second Fetch ni nouveau format d’erreur.
4. Paramétrer `ElceProjectApiClient` par document/valeur sérialisée. Sa lecture
   appelle le codec ; son écriture appelle `writeDocument`. Ses droits restent
   dans l’instance de client projet.
5. Sortir `readTestState`/`saveTestState` et leur type de réponse vers
   `mods/learning/persistence/learning-test-state-api-client.ts`. Ce client reçoit
   la même instance de transport. Les révisions projet et état test restent
   indépendantes.
6. Dans `ProjectSessionCoordinator`, remplacer :
   - `createProjectDocument` par le service documentaire, avec le même
     calcul de `Projet N` à partir des projets existants ;
   - les réinstanciations `fromJSON` des copies par
     `withProjectIdentity(document, id, name)` ;
   - la reconnaissance de l’erreur de version par
     `documentServices.isUnsupportedFormatError(error)`.
7. Dans l’historique, fournir le callback `mergeMedia` de Learning ; dans la
   synchronisation, l’événement `document.sync.merge` garde sa portée et son
   absence de geste auteur supplémentaire.
8. Dans `browser-entry.tsx`, remplacer l’assemblage en place par
   l’appel de `createLearningAuthoringComposition` décrit en L5.4. Ce raccord
   est écrit dans ce lot avec les services déjà disponibles ; les vues seront
   extraites ensuite. Aucun défaut constructeur ne recrée un store ou un client.

**Acceptation L3 :** tests contrôleur, historique, persistance, session, sync,
IndexedDB et client API ; Section → page → Section dans le même ordre,
Undo/Redo, import interrompu/refusé/dédupliqué, fusion sans geste supplémentaire,
flush avant transfert, copie hors ligne, perte de bail et récupération du cache.
Ne pas poursuivre l’extraction de l’interface si ces circuits divergent.

### L4 — déplacer les ressources et enlever leurs dépendances Learning

#### L4.1 — réunir les fichiers par fonctionnalité

Pour chaque ligne, déplacer les fichiers, reprendre leurs imports et déplacer
leurs tests avant la ligne suivante :

| Ressource | Sources à réunir | Destination |
| --- | --- | --- |
| Carte | `domain/card/`, `app/facades/card/`, `app/editor/card/`, builder Carte | `resources/bdcs/card/{domain,authoring,reading}/` |
| Graphe | `domain/statistical-graph/`, sa façade, son éditeur et son builder | `resources/bdcs/statistical-graph/{domain,authoring,reading}/` |
| Question | `domain/question/`, sa façade, son éditeur et son builder | `resources/bdcs/question/{domain,authoring,reading}/` |
| Carousel | `domain/carousel/`, sa façade, son éditeur et ses builders | `resources/bdcs/carousel/{domain,authoring,reading}/` |
| Ancres | `domain/anchor/`, `app/facades/anchor/`, `app/editor/anchor/`, `app/anchor/anchor-position.ts` | `resources/anchoring/{domain,authoring,reading}/` ; calculs de position partagés dans `domain/` |
| Section | `app/editor/section/`, types et factory sortis du modèle | `resources/bdcs/section/{domain,authoring}/` |
| Formats | `builders/flux/` et `builders/diapo/` | `resources/pages/flux/` et `resources/pages/diapo/` |
| Effets | `builders/revelation/` et `builders/viewport-expansion/` | `resources/revelation/` et `resources/viewport-expansion/` |

Les services Carte/Carousel/Question gardent leurs classes existantes.
Créer `ElceStatisticalGraphService` pour les fonctions métier Graphe actuellement
libres : création par défaut, cellules, libellés, ajout/retrait de lignes et
séries, rendu, transposition, choix camembert, remplacement de table et
`assertStatisticalGraphContent`. `parseStatisticalGraphNumber` devient une
méthode de cette même classe. Les façades reçoivent les sous-unions de commandes
de L2 et les callbacks d’import existants ; elles ne reçoivent pas l’acteur.
Quand un CSS est déplacé, reprendre immédiatement son lien dans `index.html`,
ses imports et `STYLE_FILES` du serveur local.

#### L4.2 — défaire les trois raccords actuellement liés à Learning

**Question :**

- `TestAnswerState` devient `QuestionAnswerState` dans la ressource Question,
  avec exactement `answerIds`, `selectedAnswerIds`, `expectedAnswerIds` et
  `isCorrect`. L’état test Learning importe ce type.
- Dans `question-bdc-scene-builder.ts`, déplacer `selectQuestionAnswer`,
  `validateQuestionAnswer` et `sameQuestionAnswerSet` dans
  `ElceQuestionService`. Les straps les appellent puis publient le même événement.
- Remplacer les types dérivés de `ElceDocument['data']['bdcs']` par
  `QuestionContent`. La méthode `create` de la façade lit la vue de ressources,
  conserve l’unicité par page et produit sa sous-union de commandes.

**Section et profil :**

- Réaliser `SectionTextFeature` de la partie C des raccords étudiés ; retirer les imports profil de
  `section-editor-tiptap-adapter.ts`.
- Déplacer `onProfileTokenInsert` et `insertProfileLabel` dans
  `mods/learning/profile/authoring/learning-section-text-feature.ts`.
- Dans `section-editor-remix-view.tsx`, recevoir cette contribution ; retirer
  la lecture `current.view.documentModel.data.profile.properties`.
- Créer `SectionEditorSession` avec les maps d’adaptateurs/barres actuellement
  dans `RemixPageEditor`. Lui confier mise à jour des Sections, restauration du
  caret et destruction. Les NodeViews continuent de se rafraîchir en place.

**Flux/Diapo et Résultat :**

- Déplacer le builder Résultat vers `mods/learning/evaluation/reading/`.
- Ajouter `buildAdditionalBdc` aux options et supprimer les imports Résultat
  dans les deux formats. La contribution Learning résout le BDC complet,
  vérifie le chapitre et appelle le builder déplacé.
- Remplacer `evaluationResultStories` par `additionalStories` dans le type
  de montage Flux et dans l’assemblage des stories ; conserver leur ordre.
- Supprimer `chapterType` des options Diapo communes ; son contrôle actuel
  se trouve dans la contribution Résultat Learning.
- Pour un type sans constructeur intégré ni contribution, conserver un refus
  explicite ; aucune omission silencieuse n’est introduite.

#### L4.3 — retirer les dépendances moins visibles des ressources

1. Dans `domain/catalog/catalog-types.ts`, paramétrer `ElceCatalogBdcEntry`
   et `ElceCatalogContents` par `TBdcType extends string` ; supprimer l’import
   de l’union globale des BDC. Déplacer ces types sous `core/catalog/`.
2. Dans `ElceAnchorDropService.catalogContents`, injecter le callback de nommage
   actuellement codé par `catalogBdcName`. Les noms Section/Carte/Question/
   Carousel/Graphe viennent des ressources ; Learning complète le cas Résultat.
   Le service d’ancres ne connaît plus `EVALUATION_RESULT`. Son
   `createDocumentCommand` retourne la sous-union `AnchorCommand` de L2.
3. Dans `question-editor-types.ts`, retirer `ProfileProperty` et le champ
   `profileProperties`, qui n’est pas lu par l’éditeur Question actuel. Reprendre
   la fourniture de cette prop dans `renderBdcEditor` et ses tests.
4. Pour les champs simples Question, Carte, Section et Graphe, remplacer
   l’attribut Learning `data-elce-profile-token-target` écrit en dur par une
   option `textFieldAttributes: Readonly<Record<string, string>>`, vide sans
   contribution. Learning fournit exactement l’attribut actuel. Le profil
   continue d’identifier les mêmes champs ; les ressources ne définissent pas
   ce mécanisme. Dans Tiptap, cette option est portée par `SectionTextFeature`.
5. `renderRemixCardEditor(bdc, view, cardActions, onDelete)` utilise seulement
   `view.mediaById` : remplacer son deuxième argument par `mediaById` typé
   localement. Retirer l’import `EditorViewModel`. Dans Section, remplacer le
   view model et la façade globaux par les seules données/actions déjà utilisées :
   BDC/médias, sélection/restauration, imports, ancres et commandes de Section.
6. Extraire `builders/flux/page-bottom-marker.ts` vers
   `resources/pages/page-completion/page-bottom-marker.ts`, avec le nom actuel
   de fin de page dans `page-completion-events.ts`. Flux, Diapo et Carousel
   importent ce helper ; Carousel ne dépend plus du dossier Flux pour ce marqueur.
7. `getPageTypeIcon` ne décide pas des formats installés : déplacer chaque icône
   avec Flux/Diapo et assembler la fonction de sélection dans Learning.

**Acceptation L4 :** éditeurs et builders avec leurs vrais services ;
Cartes/Graphes directs, en Carousel et ancrés ; Question Flux/Diapo ; Résultat
avec contribution Learning ; Section avec/sans contribution profil. Vérifier
la conservation de l’instance Tiptap lors des changements de sources média.

### L5 — séparer les vues communes et l’auteur Learning

#### L5.1 — répartir la façade actuelle, méthode par méthode

Depuis `app/facades/editor-actions-facade.ts` :

| Destination | Méthodes à y placer |
| --- | --- |
| `core/authoring/core-editor-facade.ts` | `manageProjects`, `undo`, `redo`, `cancelImport`, `bootstrapProjects`, `refreshProjects`, `createProject`, `saveAs`, `saveLocalAs`, accès, ouverture/fermeture/suppression et renommage du projet actif. |
| Façades de ressources | Création/édition/suppression des BDC, création des actions d’éditeurs, sélection Carte, imports média et changements d’ancre. Prolonger les façades existantes avant d’en ajouter. |
| `mods/learning/authoring/learning-editor-facade.ts` | Création/déplacement/suppression/renommage de chapitre, création de page selon les défauts Learning, réglages Évaluation, Sommaire, profil et Résultat. Composer les façades de ressources et les opérations communes par délégation. |

La façade Learning reste le point d’entrée des vues Learning. Les vues
communes et éditeurs reçoivent les méthodes dont ils ont besoin, typées par
leurs propres interfaces ; ils n’importent pas la façade concrète.

#### L5.2 — extraire le sélecteur et les décisions des handlers

1. `selectEditorViewModel` devient
   `LearningAuthoringService.selectEditorViewModel(snapshot)` ; il complète
   les projections communes page/médias/sélection avec chapitre, profil et
   règles Learning. Conserver `editorViewModelEqual` sur les mêmes références.
2. Déplacer les calculs `canCreateQuestion`, `canCreateSection`,
   `canCreateEvaluationResult`, `canCreateCarousel`, `canCreateStandaloneCard`
   et `canCreateStatisticalGraph` de `page-editor.tsx` vers les services
   compétents. `LearningAuthoringService` compose les disponibilités de la barre.
3. Remplacer `pageAllowsQuestion`, `pageAllowsSection` et
   `pageAllowsEvaluationResult` par ces résultats. L’interface ne choisit pas
   les règles du modèle.
4. Les refus de déplacement de BDC passent toujours par
   `LearningDocumentCommandService.canMoveBdcToPage`, méthode injectée au
   composant. Ne pas réécrire un contrôle concurrent dans le drag-and-drop.

#### L5.3 — scinder les fichiers de vues

| Source et symboles | Travail à effectuer |
| --- | --- |
| `project-application.tsx` | Garder menu projet, accès, historique, commandes de titre et état réseau dans `core/authoring/layout/project-application.tsx`. Recevoir le workspace construit par Learning ; sortir les états `summarySettingsOpen`, `profileTokenTargetId` et `DraggedScenarioEntry` vers `LearningWorkspace`. |
| `editor-workspace.tsx` | `renderWorkspaceAccess`, `renderPreviewButton`, `renderPanelToggle` et grille responsive vers le cadre commun ; `beginPageDrag`, `finishPageDrag`, `dragOverRoot`, `dragOverPage`, `dropScenarioEntry` et `dropPageEntry` vers `mods/learning/authoring/learning-workspace.tsx`. |
| `scenario-panel.tsx`, `chapter-settings.tsx`, `summary-profile-settings.tsx` et leurs types | Déplacer vers `mods/learning/authoring/`. Les décisions métier de leurs handlers appellent les classes de L2/L6. |
| `page-editor.tsx` | Titre de page, liste de BDC, séparateurs et hôte de rendu vers `core/authoring/page/` ; `renderPageChapterTitle`, `renderChapterTypeMark` et commande Résultat vers les contributions Learning. `renderBdcEditor` est fourni par la composition. |
| `content-catalog-panel.tsx` | Liste BDC/médias vers `core/authoring/catalog/` ; rendu et insertion Profil fournis par Learning. |
| `editor-context.ts` | Contexte de services/abonnement commun paramétré par les vues et actions exposées ; la spécialisation Learning reste dans la composition. Aucun import de la machine concrète. |
| `app/editor/media/` | `core/authoring/media/` ; conserver le contrôle existant utilisé par Question et fond Sommaire. |
| `app-layout.css` | Extraire grille/commandes communes, styles de ressources et panneaux Learning ; garder sélecteurs et ordre de cascade. |

Les sessions Section/ancres retirées du page editor sont instanciées par la
contribution de ressource et reçoivent les mêmes callbacks de montage,
d’actualisation et de destruction. Les objets DOM, brouillons et états de
panneaux restent des états de vue.

#### L5.4 — terminer l’assemblage auteur

Dans `mods/learning/composition/authoring-composition.ts`, compléter la fonction
`createLearningAuthoringComposition` introduite en L3 :

1. Construire une instance de chaque service métier et l’ensemble des presets.
2. Construire le codec, le transport, le client projet et le store. Appeler
   `deleteOrphanedMedia()` avant le démarrage de l’acteur, avec le même traitement
   d’erreur que l’entrée actuelle.
3. Construire la session avec ces instances.
4. Construire la machine Learning depuis la fabrique commune et ses services ;
   créer un acteur avec ce store et cette session.
5. Construire les façades, le sélecteur et les contributions de vues.
6. Démarrer l’acteur, attacher la session, puis demander `bootstrapProjects`
   comme dans `startRemixEditor`.
7. Fournir ces objets au routeur ; conserver `pagehide` et l’ordre de fermeture
   session → acteur → runtime Remix.

La fonction est asynchrone et retourne `{ root: RemixNode, dispose(): Promise<void> }`.
`root` assemble le Context et les vues ; `dispose` ferme la session puis l’acteur.
Le runtime Remix reste détenu par l’entrée navigateur, qui le ferme ensuite.

Dans `remix-spa-router.tsx`, remplacer les arguments `(controller, actions)` par
`{ authoringRoot: RemixNode | null, previewRoot: RemixNode | null }`. Retirer
les imports de machine, façade, `ProjectApplication` et `PopupPlayer`. La
composition construit les racines avec leurs services, puis le routeur rend
la bonne racine en gardant ses chemins, son conteneur et sa réponse 404 actuels.

`browser-entry.tsx` conserve la détection des paramètres preview et appelle
l’assemblage `createLearningPreviewComposition`. Une entrée preview n’instancie
ni acteur auteur ni session d’édition.

**Acceptation L5 :** tests workspace/page editor/project application/façades,
création et renommage, champs natifs, Tiptap, déplacements et catalogue ;
responsive 800/801/1200/1201 px, raccourcis, focus et preview.

### L6 — extraire le scénario et le player Learning

#### L6.1 — constituer les classes métier de lecture

| Destination | Fonctions source à convertir en méthodes |
| --- | --- |
| `LearningProfileService` | `assertSummaryProfileInvariants`, `resolveProfileValues`, `profilePropertyUsages`, `validateProfileValues`, comparaisons/visibilités et détection des cycles de `profile-rules.ts` ; `shouldCollectProfile` et le même prédicat de `player-preview.ts`. Le scénario et la préparation de lecture utilisent la même règle. |
| `LearningReaderProjectionService` | `projectReaderDocument` et ses helpers de `reader-projection.ts` ; projection immuable, texte et ancres. |
| `LearningTestStateService` | `reconcileProjectTestState` ; conversions `scenarioContextFromTestState`/`testStateFromScenarioContext` et lectures typées du contexte. |
| `LearningProgressionService` | `pageProfileConstraintsAllowAccess`, `chapterReadingRequirementMet`, `isPageComplete`, `canLeavePage` et décisions des gardes d’accès/sortie. |
| `LearningEvaluationSessionService` | `recordEvaluationAnswer`, `evaluationQuestionPageIds`, `createEvaluationMachine` et calcul de l’issue ; réutiliser `EvaluationMachine` et `ElceChapterEvaluation`. |
| `LearningPresentationService` | Calcul des valeurs de `createPresentation` et du patch de `createMenuClassPatch`. Les envois runtime restent dans les raccords d’actions. |

Ces classes vont sous `mods/learning/{profile,evaluation,reading}/` selon leur
rôle. Déplacer aussi les classes Évaluation actuelles et leurs tests ; ne pas
leur ajouter de nouvel acteur.

#### L6.2 — décomposer `builders/scenario/scenario-builder.ts`

| Fichier cible sous `mods/learning/reading/` | Symboles source à y placer |
| --- | --- |
| `learning-scenario-builder.ts` | `buildScenario` devient `LearningScenarioBuilder.build` ; `scenarioPageIds`, `createScenarioViews`, `scenarioEntryView`, `scenarioEntryViewId`, `scenarioEntryViewIdForPage`, `resolveStartPageId`, `resolveAccessibleStartPageId`, `createPagePaths`, `createPageViews`, `createPageNavigationActions` et `navigationBlockActions`. La collecte du profil appelle `LearningProfileService`. |
| `learning-scenario-actions.ts` | `createScenarioActions`, factories de gardes et handlers `createMarkPageFinished`, `createSaveProfileValues`, `createSubmitProfile`, `createRecordQuestionResult`, `createRefreshEvaluationResult` ; appeler les classes L6.1 puis les ports Sighty existants. `refreshPresentation` y livre les calculs de présentation. |
| `learning-layout-scene-builder.ts` | `createLayoutScene`, `createLayoutSlot`, `createMenuTogglePerso`, `createTitleScene`, `createNavigationScene`, `createEmptyPageScene`, `createProfileCompleteScene` ; méthodes de `LearningLayoutSceneBuilder`. |
| `learning-scenario-paths.ts` | `pagePath`, `contentScenePath`, `pagePathFromTable`, `menuEvent`, `menuPresentationEvent`, `pageIdFromSceneKey` ; helpers de traduction des identités existantes. |
| `learning-scenario-types.ts` | `scenario-builder-types.ts` et types locaux de présentation/progression. |
| `learning-scenario-actions.ts` / layout builder | `openMenuDrawer`, `closeMenuDrawer` et `createPersistentSceneSlot`/`createMenuSceneSlot` restent avec les raccords du layout Learning. |

Les fonctions `readPageIds`, `readPageNames`, `readPagePaths`,
`readFinishedPages`, `readQuestionResults`, `readEvaluationStates`,
`readQuestionAnswers`, `readProfileValues` et `readQuestionBdcIds` deviennent
les méthodes de lecture de `LearningTestStateService`. Les recherches
`findPage`/`findChapter` sont reprises par le service de document ou les helpers
structurels déjà extraits. Aucun symbole du fichier source ne reste sans
propriétaire ; retirer ce fichier après reprise des tests et du player.

#### L6.3 — scinder `ElcePlayerComposition`

1. Créer `core/reading/reading-runtime.ts` selon la partie D des raccords étudiés : reprendre
   `new Sighty(...)`, initialisation et destruction techniques. Les options
   Sighty sont fournies ; aucun scénario Learning n’est construit dans ce fichier.
2. Créer `mods/learning/reading/learning-player.ts` avec `LearningPlayer`.
   Y reprendre : options Learning, construction du catalogue/scénario,
   contexte, IDs `elce-…-instance`, préparation des capacités scroll-container,
   ordre des styles et diagnostics.
   Y intégrer la préparation actuellement dans `createPlayerPreviewComposition` :
   état initial, choix de collecte du profil, projection via
   `LearningReaderProjectionService` et validation de la page de départ.
   Le catalogue et le scénario reçoivent le même document préparé qu’aujourd’hui.
   La règle `shouldCollectProfile` est fournie par `LearningProfileService`.
   Ce lecteur est partagé par les contextes preview et exporté ; il n’importe
   ni `preview/`, ni `exported-player/`, ni les compositions de ces contextes.
3. `LearningPlayer.initialize` appelle exactement : initialisation runtime,
   liaison STOP média, lecture du layout, liaison du menu, puis événement de
   rafraîchissement de présentation. `destroy` retire les deux liaisons avant
   la destruction runtime, de façon idempotente.
4. Déplacer `bindMenuDrawer` et son code de focus dans
   `learning-menu-drawer.ts`. Ce code reste une liaison de présentation ;
   les décisions de parcours continuent de passer par Sighty.
5. `createPageSceneCatalog` devient `LearningPageSceneCatalog.build` dans
   `learning-page-scene-catalog.ts`. Conserver sa sélection de pages et ses
   options de chapitre ; le cache technique et ses types vont dans
   `core/reading/page-scene-cache.ts`. Le point de signature relevé dans l’analyse des frontières doit
   être qualifié avant tout changement de sa sémantique.
6. Déplacer `player/media-playback/` vers `core/reading/media-playback/` ;
   fournir le slot de contenu en argument à `bindPageMediaPlayback`. Conserver
   `withPageMediaStop` et le signal `elce:page-media:stop` vers l’occurrence sortante.
7. Déplacer `builders/markup-validation/` sous `core/reading/`.
   Répartir `elce-player-style.ts` par ressource/layout ; reconstruire la même
   feuille de style à la composition Learning.

**Acceptation L6 :** tests scénario, player et builders ; ordre mixte, gardes,
profil, modes `endpage/free`, Questions et issue Résultat actuelle ; vrai cycle
Sighty/CodPlay, A → B → A, arrêt vidéo, resets et destruction. Les actions
Recommencer/Relire encore non raccordées restent ouvertes dans leurs plans.

### L7 — extraire la session de preview de son composant Remix

1. Déplacer `popup-preview-messages.ts` vers `core/preview/` ; paramétrer les
   payloads documentaires sans modifier les noms des messages ni les paramètres URL.
2. Modifier `PopupPreviewHost` avec le callback de snapshot et le codec de
   la partie D des raccords étudiés ; déplacer le protocole technique sous `core/preview/`. Le callback
   Learning lit toujours l’acteur auteur courant.
3. Créer `LearningPreviewService` depuis `player-preview.ts` pour
   `isCatalogPage` et les choix propres au départ auteur. Sa création de player
   appelle `LearningPlayer` avec le document source et l’état de lecture.
   Collecte, projection et validation du départ passent par le chemin partagé
   de L6.3. Le message auteur de page exclue par le profil utilise les mêmes
   classes de projection, comme `presentSnapshot` le fait actuellement.
4. Créer `mods/learning/preview/learning-preview-session.ts` avec les méthodes :
   `presentDocument`, `presentSnapshot`, `saveTestState`, `resetTestProfile`,
   `resetTestProgress`, `toggleProfileMode` et `destroy`, en reprenant leurs
   corps depuis `PopupPlayer` et en appelant les classes L6.1.
5. `LearningPreviewSession` possède le snapshot lecteur, le cache de scènes,
   la composition en cours, la session d’état test et le traitement métier
   du conflit. Elle expose une vue en lecture et un abonnement ; elle ne
   détient aucun document auteur mutable.
6. La surface commune `PopupPlayer` conserve le stage, la barre, les états
   d’ouverture visuels, les messages à l’opener et leurs timeouts. Elle reçoit
   la session construite par `createLearningPreviewComposition` et lui
   transmet les intentions.
   `createLearningPreviewComposition({ sessionId, projectId, startPageId })`
   retourne la racine Remix de preview et sa méthode `dispose()`, sur le même
   modèle de propriété que l’assemblage auteur. Sa session n’instancie pas de
   contrôleur auteur.
7. `loadMediaSources`/`loadServerMediaSources` vont dans
   `core/preview/preview-media-sources.ts` ; conserver URL/Blob, rétention et
   révocation actuelles, en utilisant le store/client injectés.
8. Déplacer `ProjectTestStateSession` vers Learning ; remplacer sa dépendance
   au client projet par `LearningTestStateApiClient` du lot L3.3.

**Ordre à préserver :** obtenir les médias, ouvrir l’état test, réconcilier
avec le document, enregistrer si nécessaire, détruire l’ancienne composition,
construire et initialiser la nouvelle. Les deux resets gardent leurs portées
distinctes. La preview réseau autorise seulement ses opérations actuelles.

**Acceptation L7 :** tests popup/host/session/API, deux commandes de
synchronisation, route réseau sans acteur auteur, médias serveur sans Blob
local, conflit `412`, mode local autorisé et destruction pendant une requête.
Vérifier aussi que `reading/` ne dépend pas du contexte preview. Lorsque le
player exporté sera réalisé, la comparaison preview/export utilisera les mêmes
documents, options et états de lecture ; cette validation relève du chantier
export et ne peut pas être déclarée acquise par l’extraction.

### L8 — composer le serveur et ses routes Learning

1. Paramétrer `ProjectPersistence` et `StoredProject` par le document. Déplacer
   `readTestState`/`saveTestState` et leurs résultats dans
   `mods/learning/persistence/server/learning-test-state-persistence.ts`.
2. Déplacer `project-api-controller.ts` et `project-edit-grant.ts` vers
   `core/server/projects/` ; injecter `readIncomingDocument`. Retirer les imports
   `ELCE_DOCUMENT_VERSION`, `ElceDocument` et invariants Learning ; le codec
   Learning garde le contrôle actuel de forme puis des invariants.
3. Déplacer tout `server/projects/sqlite/` sous
   `mods/learning/persistence/server/sqlite/`, migrations incluses.
   `SqliteProjectPersistence` devient `LearningSqliteProjectPersistence`,
   implémentant les ports projet, média et état test sur la même connexion.
4. Déplacer `project-test-state-api-controller.ts` vers ce module Learning ;
   ses validations utilisent `LearningTestStateService`.
5. Déplacer `server/media/` sous `core/server/media/` sans modifier l’upload,
   FileStorage, SHA-256, Range ou nettoyage.
6. Scinder `createElceApiRouter` :
   - `core/server/http/project-api-router.ts` exporte la fabrique du routeur
     avec les contrôleurs projet/média fournis ;
   - `mods/learning/persistence/server/learning-test-state-routes.ts` exporte
     `registerLearningTestStateRoutes(router, controller)`, reprenant les deux
     routes `GET`/`PUT /api/projects/:projectId/test-state` ;
   - la composition serveur appelle cette fonction sur le même routeur,
     avant l’enregistrement média comme actuellement.
7. `mods/learning/composition/server/server-composition.ts` expose
   `createLearningServerComposition` : elle ouvre la base, construit
   l’adaptateur, les services et contrôleurs, puis le routeur. Elle retourne
   routeur, service média et fermeture de la base à `createElceHttpServer`.
   Le listener Node et son arrêt restent dans le point de lancement actuel.
8. Déplacer `network-preview-api-policy.ts` sous `core/server/http/` ;
   les autorisations des routes d’état test sont fournies explicitement par
   Learning, avec les méthodes actuelles.
9. Adapter `MIGRATIONS_DIRECTORY` à son nouveau dossier. Pour un simple
   déplacement, les migrations existantes ne sont ni renommées ni rejouées.
   Une modification acceptée du schéma peut recréer la base d’essai selon [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire).
10. Contrôler à nouveau tous les chemins externes au graphe d’import TS,
    actualisés à chaque déplacement :
    - `packages/elce/index.html` : quatre liens CSS et entrée navigateur ;
    - `server/elce-local-server.ts` : `BROWSER_ENTRY`, les cinq `STYLE_FILES` ;
    - le refus `denyFiles`, avec `core/server/**`,
      `mods/learning/persistence/server/**` et `mods/learning/composition/server/**` ajoutés ;
    - `scripts/dev-elce.mjs` et `scripts/dev-api.mjs`, dont les chemins
      `ssrLoadModule` restent valides puisque les entrées serveur sont conservées ;
    - les imports CSS, chemins de tests et éventuelles références dans
      `vite.config.ts`/`tsconfig.json`.
11. Retirer `server/api-router.ts` après migration de ses appelants ; aucun
    second routeur ni seconde base n’est créé.

**Acceptation L8 :** tests API/SQLite/serveur réels ; création, sauvegarde et
réouverture au schéma retenu, droits et ETag, médias/déduplication/Range/nettoyage.
Vérifier le refus HTTP des sources serveur à leurs nouvelles adresses.

## Repères de couverture

| Réf. | Frontière et cas requis | Points de départ existants |
| --- | --- | --- |
| V1 | Format retenu aller-retour : tous types, contenus nuls/optionnels, ordres, ancres, médias, Sommaire/profil/Évaluation ; refus des formats non pris en charge ; fixtures recréées si nécessaire selon [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire). | `document-commands.test.ts`, tests SQLite et client API. |
| V2 | Transformations et refus : placement unique, Diapo, conteneurs, suppression, retour catalogue, contraintes et cycles. | Tests de commandes, ancres, Carousel, Graphe et profil. |
| V3 | Même acteur/file/historique : ordre asynchrone, regroupement, Undo/Redo, refus, annulation d’import et rétention des octets. | Tests contrôleur, historique, persistance et store. |
| V4 | Projets et accès : bootstrap, création, copie, ouverture/fermeture, conflit, flush avant transfert, perte de bail, retour de focus et sélection de fichier native. | Tests session/sync/locks ; parcours réels des plans propriétaires. |
| V5 | Édition réelle : BDC directs/enfants/ancrés, champs, dépôt, collage déjà pris en charge, conservation Tiptap et sélection. | Tests `page-editor`, `remix-section-production` et façades. |
| V6 | Auteur Learning : ordre mixte, modèles, Sommaire/profil, valeurs sauvegardées, onglet contextuel et configuration du flag actuel. | Tests workspace, chapter-settings, summary-profile-settings, project-application. |
| V7 | Lecture réelle : acteurs/scénario/scènes, entrée à la page courante, navigation, gardes, fin fonctionnelle, résultats actuels, interinstances et retour A → B → A. | Tests scenario-builder, builders Flux/Diapo et player-composition. |
| V8 | Médias : déduplication, URL/Blob, préchargement existant, vidéo indépendante, STOP à la sortie, retour et destruction sans fuite. | Tests médias, builders, composition, API et parcours navigateur. |
| V9 | État test : round-trip séparé, révision indépendante, réconciliation de choix modifiés, deux resets, conflit et mode hors ligne existant. | Tests test-state-reconciliation, project-test-state-session, popup-player et API. |
| V10 | SQL et HTTP : format retenu complet, ordres relationnels, médias/clés de fichiers conservés, droits dans la transaction, ouverture/réouverture et migrations. Ancienne base à reprendre pour un simple déplacement ; base d’essai recréable si le schéma change avant fixation, selon [le cadre documentaire](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#format-documentaire). | `sqlite-project-persistence.test.ts`, `api-router.test.ts`. |
| V11 | Présentation et cycle : desktop/mobile, 800/801/1200/1201 px, focus/Échap, Play/Seek/replay/resize, montage/démontage et destruction. | Tests UI/lecture et vrais parcours navigateur sur fixtures dédiées. |
| V12 | Architecture et livraison : communs indépendants de Learning, définition et assemblages possédés par le mod, entrées applicatives limitées à ses fonctions publiques, métier en classes, pas de store/file/routeur doublé, séparation navigateur/serveur, lancement/build. | Tests de dépendances ciblés, typecheck, suite, build et contrôle réseau réel. |

Les tests conservent leurs propres données ; aucune fixture ne dépend d’une
démo. Les tests purs de ressource restent avec la ressource. Les scénarios combinant
Learning, le noyau et les ressources vont sous
`mods/learning/integration/` lorsqu’ils ne relèvent plus d’un propriétaire unique.

Pour les cas parent/enfant, couvrir le déplacement entre Carousels,
le refus de vider un Carousel, le passage catalogue/page et les ancres Section.
Ne pas déduire ces propriétés d’un seul rendu visuel réussi.

Toute catégorie omise — notamment Seek, reparent, resize, persistance ou cycle
de vie — exige une justification causale dans le suivi de la tranche. Un test
unitaire ou un build réussi ne valide pas ces intégrations.

### Destination des 51 fichiers de tests existants

Les chemins ci-dessous sont relatifs à `packages/elce/src/`. Les tests qui
assemblent document, acteur ou services Learning vont dans l’intégration du mod ;
leurs fixtures ne créent ainsi aucune dépendance Learning dans les dossiers
communs. Les tests purs suivent leur ressource. Ce tableau prescrit les
déplacements ; il ne rapporte aucune exécution.

| Source | Destination | Lot du déplacement |
| --- | --- | --- |
| `app/controller/controller-machine.test.ts` | `mods/learning/integration/controller-machine.test.ts` | L3 |
| `app/controller/document-persistence.test.ts` | `mods/learning/integration/document-persistence.test.ts` | L3 |
| `app/controller/project-operations.test.ts` | `mods/learning/integration/project-operations.test.ts` | L3 |
| `app/editor/anchor/elce-anchor-extension.test.ts` | `resources/anchoring/authoring/elce-anchor-extension.test.ts` | L4 |
| `app/editor/card/card-editor-rules.test.ts` | `resources/bdcs/card/authoring/card-editor-rules.test.ts` | L4 |
| `app/editor/profile/profile-label-extension.test.ts` | `mods/learning/profile/authoring/profile-label-extension.test.ts` | L4 |
| `app/editor/profile/profile-token-insertion.test.tsx` | `mods/learning/profile/authoring/profile-token-insertion.test.tsx` | L4 |
| `app/editor/section/remix-section-production.test.tsx` | `mods/learning/integration/remix-section-production.test.tsx` | L4 |
| `app/editor/statistical-graph/remix-statistical-graph-editor.test.tsx` | `mods/learning/integration/remix-statistical-graph-editor.test.tsx` | L4 |
| `app/facades/anchor/anchor-drop-facade.test.ts` | `resources/anchoring/authoring/anchor-drop-facade.test.ts` | L4 |
| `app/facades/editor-actions-facade.test.ts` | `mods/learning/integration/editor-actions-facade.test.ts` | L5 |
| `app/history/document-history.test.ts` | `mods/learning/integration/document-history.test.ts` | L3 |
| `app/player/popup-player.test.tsx` | `mods/learning/integration/popup-player.test.tsx` | L7 |
| `app/player/popup-preview-host.test.ts` | `mods/learning/integration/popup-preview-host.test.ts` | L7 |
| `app/player/project-test-state-session.test.ts` | `mods/learning/preview/project-test-state-session.test.ts` | L7 |
| `app/projects/project-session-coordinator.test.ts` | `mods/learning/integration/project-session-coordinator.test.ts` | L3 |
| `app/remix/project-application.test.tsx` | `mods/learning/integration/project-application.test.tsx` | L5 |
| `app/remix/remix-spa-router.test.ts` | `mods/learning/integration/remix-spa-router.test.ts` | L5 |
| `app/remix/workspace/chapter-settings.test.tsx` | `mods/learning/integration/chapter-settings.test.tsx` | L5 |
| `app/remix/workspace/editor-workspace.test.tsx` | `mods/learning/integration/editor-workspace.test.tsx` | L5 |
| `app/remix/workspace/page-editor.test.tsx` | `mods/learning/integration/page-editor.test.tsx` | L5 |
| `app/remix/workspace/summary-profile-settings.test.tsx` | `mods/learning/integration/summary-profile-settings.test.tsx` | L5 |
| `app/selectors/editor-view-model.test.ts` | `mods/learning/integration/editor-view-model.test.ts` | L5 |
| `app/sync/project-editor-lock.test.ts` | `core/sync/project-editor-lock.test.ts` | L3 |
| `app/sync/project-sync-coordinator.test.ts` | `mods/learning/integration/project-sync-coordinator.test.ts` | L3 |
| `builders/card/card-preset-builder.test.ts` | `mods/learning/integration/card-preset-builder.test.ts` | L1 |
| `builders/diapo/diapo-scene-builder.test.ts` | `mods/learning/integration/diapo-scene-builder.test.ts` | L4 |
| `builders/flux/flux-anchor-player-markup.test.ts` | `resources/pages/flux/flux-anchor-player-markup.test.ts` | L4 |
| `builders/flux/flux-scene-builder.test.ts` | `mods/learning/integration/flux-scene-builder.test.ts` | L4 |
| `builders/markup-validation/html-element-method-validation.test.ts` | `core/reading/markup-validation/html-element-method-validation.test.ts` | L6 |
| `builders/revelation/revelation-action.test.ts` | `resources/revelation/revelation-action.test.ts` | L4 |
| `builders/scenario/scenario-builder.test.ts` | `mods/learning/reading/learning-scenario-builder.test.ts` | L6 |
| `builders/statistical-graph/statistical-graph-placements.test.ts` | `mods/learning/integration/statistical-graph-placements.test.ts` | L4 |
| `builders/statistical-graph/statistical-graph-scene-builder.test.ts` | `resources/bdcs/statistical-graph/reading/statistical-graph-scene-builder.test.ts` | L4 |
| `domain/anchor/anchor-drop-service.test.ts` | `mods/learning/integration/anchor-drop-service.test.ts` | L4 |
| `domain/carousel/carousel-service.test.ts` | `resources/bdcs/carousel/domain/carousel-service.test.ts` | L4 |
| `domain/commands/document-commands.test.ts` | `mods/learning/integration/document-commands.test.ts` | L2 |
| `domain/evaluation/chapter-evaluation.test.ts` | `mods/learning/evaluation/domain/chapter-evaluation.test.ts` | L6 |
| `domain/evaluation/evaluation-machine.test.ts` | `mods/learning/evaluation/domain/evaluation-machine.test.ts` | L6 |
| `domain/media/media-resource-service.test.ts` | `core/media/media-resource-service.test.ts` | L3 |
| `domain/question/question-service.test.ts` | `resources/bdcs/question/domain/question-service.test.ts` | L4 |
| `domain/statistical-graph/statistical-graph-service.test.ts` | `resources/bdcs/statistical-graph/domain/statistical-graph-service.test.ts` | L4 |
| `domain/summary-profile/profile-rules.test.ts` | `mods/learning/profile/domain/learning-profile-service.test.ts` | L6 |
| `domain/summary-profile/reader-projection.test.ts` | `mods/learning/profile/reading/learning-reader-projection-service.test.ts` | L6 |
| `domain/summary-profile/test-state-reconciliation.test.ts` | `mods/learning/reading/learning-test-state-service.test.ts` | L6 |
| `infrastructure/indexed-db/document-store.test.ts` | `mods/learning/integration/document-store.test.ts` | L3 |
| `infrastructure/project-api/project-api-client.test.ts` | `mods/learning/integration/project-api-client.test.ts` | L3 |
| `player/elce-player-composition.test.ts` | `mods/learning/reading/learning-player.test.ts` | L6 |
| `server/api-router.test.ts` | `mods/learning/integration/api-router.test.ts` | L8 |
| `server/network-preview-api-policy.test.ts` | `mods/learning/integration/network-preview-api-policy.test.ts` | L8 |
| `server/projects/sqlite/sqlite-project-persistence.test.ts` | `mods/learning/persistence/server/sqlite/learning-sqlite-project-persistence.test.ts` | L8 |

À chaque déplacement, reprendre imports, mocks, constructeurs injectés et
fixtures dans le même lot. Garder les scénarios métier et leurs assertions.
Lorsqu’un sous-cas doit vérifier un mécanisme commun indépendamment de Learning,
l’écrire avec ses propres services de fixture selon les critères d’indépendance retenus au plan.

## Exemple d’extraction limitée du moteur de presets

**Contrat :** [document et presets](../../specs/document-model-spec.md).
**But :** le moteur devient indépendant du registre global ; ses résultats restent
identiques.

**Périmètre envisagé :**

1. Déplacer `config/card-preset-types.ts`,
   `builders/card/card-preset-builder.ts` et
   `builders/card/card-preset-builder-types.ts` sous `core/presets/`.
2. Donner à `ElceCardPresetBuilder` le constructeur obligatoire
   `constructor(presets: Readonly<Record<string, CardPreset>>)`.
   Sa méthode `build(...)` conserve ses paramètres et son algorithme.
3. Remplacer la lecture du registre importé par celle du registre reçu.
4. Reprendre les six instanciations actuelles dans Flux, Question, Carte,
   Carousel, Résultat et `app/editor/anchor/elce-anchor-extension.ts` :
   elles fournissent le même `CARD_PRESETS`, avec les mêmes valeurs.
5. Reprendre tous les imports et les constructions dans les tests.
   La répartition du registre par ressource sera traitée dans un lot ultérieur.

**Effets à comparer :**

- `build` retourne les mêmes `markup`, `rootClassName`, `zonePartIds` et
  `zoneClassNames` ; mêmes cas optionnels et même refus de preset inconnu.
- Les scènes Flux/Diapo, Carte/Carousel, Question/Résultat et l’aperçu d’ancre
  conservent leurs constructions et leurs comportements concernés.
- Typecheck, suite et build ; vérification du vrai rendu d’ancre/Section si
  cette frontière est affectée, avec les mêmes fixtures.
- Inspection de dépendances : le moteur commun n’importe plus
  `config/presets.ts`. Les consommateurs utilisent le moteur réellement déplacé.
- Preuve d’indépendance : instancier le moteur avec un preset propre au test,
  sans charger le registre applicatif, et vérifier le markup et les identités
  produits par le vrai `build`.
