# Elcé — Mods : conclusions et décisions

Les études et leurs arguments sont réunis dans [les notes du sujet](../index.md).
Ce document conserve les décisions d’exécution et leur état. Les pistes
techniques détaillées restent dans les notes liées ; leur adoption n’est pas
une preuve d’implémentation.

## Périmètre convenu

**Fixe pour l’objectif, les principes et les tranches L1–L8 de l’application actuelle sous Learning.**

Créer la structure des mods et y faire fonctionner l’application actuelle sous
Learning, à fonctionnalités constantes. La création d’autres mods, dont DGS,
interviendra plus tard. L’extraction limitée des presets constitue le lot pilote,
pas le résultat final.

Une ressource porte l’essentiel de son métier dans une ou plusieurs classes
TypeScript indépendantes des mods. Un mod sélectionne et configure les
ressources et fournit les adaptations nécessaires à son document, son parcours
et ses contextes d’usage. Être le premier utilisateur d’une ressource n’en donne
pas la propriété métier au mod.

Le Sommaire suit ce principe dès l’extraction actuelle : distinguer son métier
réutilisable des adaptations Learning. Le scheduler devra suivre le même
principe lors de sa conception future, même si son premier usage est DGS.
Ses règles fonctionnelles et ses interfaces restent à définir.

Learning constitue la composition de base : ses capacités métier réutilisables
sont extraites des adaptations de son document et de son parcours. D’autres
mods pourront choisir leurs propres assemblages ; ils ne sont pas construits ici.

## Orientations retenues

- Elcé reste une application auteur unique avec des interfaces cohérentes entre mods.
- Le principe des mods est retenu. Learning est le nom du mod actuel et constitue la première mise en service de cette structure. DGS reste un usage futur prioritaire ; les autres exemples restent secondaires, sans engagement de réalisation.
- Les entrées actuelles choisissent explicitement Learning ; le format v7 ne reçoit pas de champ `modId`. L’identité persistée et la résolution multi-mod seront ajoutées avec le premier second mod.
- Le réemploi auteur consiste à copier les contenus et BDC, puis à adapter leur présentation. Le partage éventuel des fichiers image reste à décider.
- Chaque mod possède sa définition et ses assemblages dans son dossier. Les entrées applicatives utilisent ses fonctions publiques.
- Le métier des ressources appartient à des classes TypeScript indépendantes des mods ; machines et façades coordonnent leurs appels ; les interfaces présentent les valeurs et émettent les intentions. Les adaptateurs portent les raccords propres à un mod. Le scheduler et l’affichage emploieront les mêmes classes métier concernées.
- Tous les mods suivent la même chaîne : document auteur persisté, puis génération Elcé du scénario Sighty, des scènes CodPlay, actions et guards. Le schéma BDD et les productions de lecture sont distincts ; preview et player exporté partagent cette génération.
- La composition directe en TypeScript constitue l’approche actuelle. Un mod réduit à une composition de modules reste un cap ; les interactions entièrement déclaratives sont exclues de cette étude.

## Conclusions du découpage étudié

L’[analyse du code actuel](../notes/2026-10-20-learning-extraction-study.md#analyse-des-frontières-sur-le-code-actuel)
étaye la répartition suivante. Les signatures détaillées sont appliquées dans
les lots L1–L8 au seul mod Learning actuel.

| Propriétaire | Responsabilités |
| --- | --- |
| Noyau | Structures communes, références, admission et file de changements, commit, historique, sessions, synchronisation, transport, gestion technique des médias et cycle Sighty/CodPlay d’une composition fournie. |
| Ressources | Classes métier indépendantes des mods et contributions réutilisables : contenus et formats, règles de progression/navigation, Sommaire, profil/formulaire, conditions/prérequis, Évaluation/Résultat, personnalisation des textes, état de lecture et apparence. Le document et l’organisation de parcours restent des adaptations Learning. |
| Learning | Définition, sélection, configuration et assemblage des ressources actuelles ; création initiale et raccords à l’agrégat v7, son codec, ses invariants, `scenarioEntries`, `PagePlacement` et son adaptateur SQLite. |
| Assemblages du mod | Contributions des ressources, services, façades et machines sous `src/mods/learning/`. Aucun fichier Learning dans un dossier global de composition. |
| Lecture Learning | Même préparation par profil, mêmes builders et mêmes règles pour preview et player exporté. Entrées et raccords de contexte distincts ; le lecteur partagé est indépendant des services auteur. |
| Interface auteur | Cadre et gestes communs ; organisation du parcours, réglages et choix des contributions possédés par le mod. |

Le stockage commun peut transporter le document complet : son codec et les
services qui interprètent les données Learning restent fournis par ce mod.
L’historique reçoit la transformation de fusion média du service de commandes.
La préparation de lecture par profil appartient au lecteur partagé preview/export.
La cartographie des études doit être réévaluée selon cette séparation : une
fonctionnalité actuellement rangée dans Learning peut fournir une ressource
autonome et un adaptateur Learning, sans dupliquer son métier.

L’[examen des candidats](../notes/2026-10-27-learning-reusable-resources-study.md)
précise les capacités, leurs circuits actuels et les couplages à séparer.
Cette analyse remplace l’attribution exclusive à Learning des fonctionnalités
dans la cartographie du 20 octobre ; elle ne certifie pas leur indépendance.

L’[audit du 27 octobre](../notes/2026-10-27-learning-independence-audit.md)
actualise ce constat sur 196 sources : les règles de profil, le formulaire,
les identités et l’historique conservent notamment des chemins vers l’agrégat.
Il distingue les couplages de types des dépendances de valeurs. L1–L8 sont
adoptés et finis. Leurs preuves figurent dans les spécifications propriétaires,
notamment Preview, Sommaire et profils, et API.

## Décisions de refactorisation

- Extraire Learning à fonctionnalités constantes : comportements, limitations connues et contrats vérifiés sont conservés.
- Préserver un seul acteur propriétaire du document, une seule file, un historique et les circuits existants de persistance, médias et synchronisation.
- Procéder par petits périmètres, avec comparaison avant/après. Chaque partie commune extraite doit aussi fonctionner avec des données et services indépendants de Learning, sans champs Learning factices.
- Démontrer l’indépendance pendant l’extraction Learning. DGS validera ensuite ses besoins particuliers.
- Vérifier les intégrations affectées et les consommateurs réels d’une évolution commune. Le partage du code et les tests isolés ne suffisent pas à démontrer cette équivalence.
- Pour chaque lot, après les tests ciblés, le typecheck et le build, exécuter un parcours MCP dans l’application réelle sur un projet temporaire. Le parcours couvre le geste concerné par le lot et constate son résultat dans l’éditeur ; un simple chargement de page ne suffit pas. Consigner le parcours et son résultat ici. Un lot dont le parcours MCP n’est pas achevé reste en cours.
- Conserver le format dans un lot de refactorisation pour permettre sa comparaison ; toute évolution de format constitue une décision distincte.
- L’isolation du moteur de presets par injection du registre est le premier découpage limité retenu ; le lot accepté ci-dessous n’inclut pas la répartition des registres par ressource.

## Lot pilote — moteur de presets

**Décision acceptée, code appliqué et vérifié le 27 octobre 2026.**
Le moteur de markup et ses types ont été déplacés vers `src/core/presets/` ;
le registre lui est fourni par constructeur. Les consommateurs actuels
continuent d’utiliser le même `CARD_PRESETS` et produisent les mêmes valeurs.

Fichiers : déplacer `src/config/card-preset-types.ts`,
`src/builders/card/card-preset-builder.ts` et
`src/builders/card/card-preset-builder-types.ts` ; reprendre les constructions
dans les builders Carte, Carousel, Question, Évaluation, Flux et l’extension
d’ancre. Garder `src/config/presets.ts` et ses entrées inchangés dans ce lot.
Ne pas scinder les presets par ressource ni élargir la composition Elcé/Learning.

Acceptation : le moteur commun n’importe aucun registre applicatif ; un test
utilise un preset défini par sa fixture, sans charger `config/presets.ts`.
Les constructions `markup`, classes et identifiants restent identiques ; les
tests réels des consommateurs, typecheck et build passent. Preuves :
[`document-model-spec.md`](../../specs/document-model-spec.md),
les deux tests `card-preset-builder.test.ts` (moteur et consommateurs), les
tests Carte/Flux/Diapo/Ancre/Remix/player (102 assertions sur 7 fichiers),
`npm run typecheck` et `npm run build` passent. L’acceptation MCP (Carte
ancrée dans une Section avec son preset) est vérifiée plus bas.

## Lot 2 — vocabulaire commun de placement des BDC

**Décision retenue, code appliqué et vérifié le 27 octobre 2026.**
Déplacer
`BDC_LOCATION`, `BDC_ORDER` et `BdcLocationKind` vers
`src/core/document/content-location.ts`. Conserver leurs valeurs et leurs
signatures ; cette tranche ne déplace pas les types de BDC ni la configuration
des pages et des ressources.

Fichiers : reprendre les imports de `src/config/document-config.ts` et
`src/config/document-config-types.ts`, notamment dans les commandes de
document, l’éditeur et son protocole de glisser-déposer. Le transfert
`application/x-elce-bdc-order+json` et les placements `page`, `parent`,
`catalog` gardent leur comportement.

Acceptation : tests commandes, contrôleur et réordonnancement de l’éditeur,
typecheck et build passent. Mettre à jour la
[spécification du document](../../specs/document-model-spec.md) avec le
nouveau propriétaire des constantes et les preuves. Résultat : 61 tests
réussis sur les trois fichiers ciblés ; `npm run typecheck` et `npm run build`
passent. L’acceptation MCP (réordonnancement d’un BDC et constat de sa position)
est vérifiée plus bas.

## Lot 3 — configuration média commune

**Décision retenue, code appliqué et vérifié le 27 octobre 2026.**
Déplacer
`MEDIA_TYPE`, `MEDIA_MIME_PREFIX`, `MEDIA_FILE_EXTENSIONS`,
`MEDIA_FILE_ACCEPT` et le type `MediaType` vers
`src/core/media/media-config.ts`. Conserver toutes les valeurs, y compris le
type `audio` ; la restriction image/vidéo de `SupportedMediaType` reste portée
par le service d’import actuel.

Fichiers : reprendre les imports des services média, builders Carte/Flux/Diapo,
sélecteurs, éditeurs et tests. `src/config/document-config.ts` peut importer
`MEDIA_TYPE` depuis le noyau pour ses réglages restants ; cette tranche ne
déplace pas les réglages d’ancre ni les décisions d’admission des ressources.

Acceptation : conserver les résultats MIME, les filtres de fichiers et les
types remis aux builders ; tests média, éditeur Carte, Question et ancre,
typecheck et build passent. Mettre à jour les spécifications média avec le
nouveau propriétaire et les preuves. Résultat : 58 tests réussis sur six
fichiers ciblés ; `npm run typecheck` et `npm run build` passent. L’acceptation
MCP (import PNG, type et rattachement à une Carte) est vérifiée plus bas.

## Lot 4 — référence de transport du catalogue

**Décision retenue, code appliqué et vérifié le 27 octobre 2026.**
Déplacer
`CATALOG_REFERENCE` vers `src/core/catalog/catalog-config.ts` en conservant
son MIME, ses discriminants `bdc`/`media` et son format JSON.
`CATALOG_TAB` reste dans la configuration actuelle : il contient aussi
l’onglet Profil Learning, dont le raccord de composition n’est pas dans ce lot.

Fichiers : reprendre les imports des types de catalogue, services de dépôt,
éditeurs, panneau Remix et tests de glisser-déposer. Acceptation : les références
BDC et média gardent leur sérialisation et leurs parcours actuels ; tests du
catalogue, de l’ancre, de l’éditeur Carte, typecheck et build passent. Mettre à
jour la spécification du document avec le nouveau propriétaire et les preuves.
Résultat : 31 tests réussis sur quatre fichiers ciblés ; `npm run typecheck` et
`npm run build` passent. L’acceptation MCP (référence du catalogue ancrée dans
une Section en conservant le BDC) est vérifiée plus bas.

### Correction du démarrage, des médias CORS et des erreurs d’accès — acceptée le 27 octobre 2026

**Fini après correction et vérification le 27 octobre 2026, suivi du cycle d’accès.**
`elce-local-server.ts` monte `packages/elce/node_modules` sous `elceVendor`, ce
qui permet au serveur d’assets de résoudre `remix/spa`. L’API répond avec CORS
et `Vary: Origin` sur les médias ; si `5181` est occupé, le serveur de
développement ne réutilise l’API qu’après vérification du même contrat sur
`GET /api/projects`. Une ancienne API incompatible fait échouer le démarrage
avec un diagnostic explicite, au lieu de laisser l’éditeur afficher un faux
échec réseau. Le coordinateur ne signale pas une erreur de transport pendant
que la page est masquée ou sans focus. Les erreurs visibles indiquent l’échec
de communication sans conseiller « Enregistrer sous… ».
Le contrôleur conserve la provenance du message : au début d’une nouvelle
demande d’accès, seule l’erreur de transport transitoire est effacée et le
projet revient à l’état actif en lecture seule. Un `409` ordinaire ne garde pas
l’ancienne alerte ; les avertissements de synchronisation et les messages de
récupération restent visibles.

Fichiers : `src/server/elce-local-server.ts`, `src/server/elce-local-server.test.ts`,
`src/app/projects/project-session-coordinator.ts`,
`src/app/projects/project-session-coordinator.test.ts`,
`src/app/controller/controller-types.ts`, `src/app/controller/controller-machine.ts`,
`src/app/controller/controller-machine.test.ts`,
`src/mods/learning/persistence/server/sqlite/learning-sqlite-project-persistence.test.ts`,
`specs/editor-window-access-spec.md`, `specs/project-api-spec.md` et
`specs/remix-spa-spec.md`. Les 42 tests ciblés passent, dont le refus d’une API
locale sans CORS et la réutilisation d’une API conforme ; `npm run typecheck`
et `npm run build` passent. Le navigateur confirme `200` sur l’entrée Remix et
sur un média API après nettoyage des anciens journaux, sans nouvelle erreur
console ni ancienne alerte. Les tests de démarrage chargent aussi `remix/spa`
depuis le mount `elceVendor`.
Le suivi du cycle d’accès passe ses 40 tests ciblés sur les deux fichiers du
contrôleur et du coordinateur, ainsi que `npm run typecheck` et `npm run build`.
Sur Safari MCP, la copie temporaire ouverte sur `http://localhost:5175/` a
traversé des réponses d’accès `409`, puis repris son bail sur `200` et affiché
« Synchronisé » sans alerte. L’inventaire MCP n’offre pas d’interception réseau
pour produire un `TypeError` dans Safari ; ce segment précis est couvert par le
test d’intégration qui enchaîne le `TypeError` puis `409 edit_access_occupied`.
Le 28 octobre, un contrôle Safari MCP confirme qu’un onglet en arrière-plan
reste en « Lecture seule » avec une région `role=alert` vide. Après une édition
MCP sous signal de focus/visibilité de test, l’API renvoie `200` et l’état est
« Synchronisé » ; après retrait de ce signal, l’onglet revient en lecture seule
et ne montre toujours aucune alerte. L’override de test a été supprimé.
Le suivi du cycle d’accès ne modifie pas le document auteur. Les quatre
acceptations gestuelles ont été exécutées ensuite sur la copie temporaire
« MCP Mods pilote presets 2026-10-27 » ; Démo 5 n’a pas été modifiée.

### Contrôle MCP du 27 octobre — partiel

Safari MCP a chargé `http://localhost:5175/` et ouvert le projet réel « Démo 5 —
comparaison Elcé ». La navigation vers « Distinguer les plans » puis « Suivre le
regard » a bien remplacé le contenu affiché. Le catalogue montre ses images et
sa vidéo ; le chargement API de la vidéo répond `206`. Le précédent contrôle a
également chargé une image API en 640 × 421. La console ne rapporte aucune
erreur ni aucun avertissement.

Quand Safari est visible sans focus, la page reste en lecture seule sans alerte.
L’activation de Safari rend `document.hasFocus()` vrai et l’éditeur revient à
« Synchronisé ». Des réponses `409` sur `POST /edit-access` ont précédé cette
reprise ; la vérification n’a observé aucune réponse `5xx`. La comparaison
SQLite avec `HEAD` confirme que les seules différences de données concernent la
libération de l’ancien bail expiré de Demo5 ; les 17 tables sont identiques
hors ces champs.

Une copie temporaire « MCP Mods temporaire 2026-10-27 » a été créée pour préparer
le test, puis son document et son checkpoint IndexedDB ont été supprimés ; ses
médias partagés ont été conservés. Le projet Demo5 est de nouveau ouvert en
consultation, sans modification éditoriale.

Le chargement, la navigation et le rendu des contenus sont vérifiés. Le MCP
Safari exposé ne fournit pas d’action dédiée de glisser-déposer ou de sélection
de fichier. Pour les acceptations ci-dessous, `evaluate_javascript` a envoyé des
événements `DragEvent` et un `File` dans les éléments de l’interface ; les
gestionnaires Remix/Tiptap réels, les façades, XState et l’API sont restés le
chemin exécuté. Ce parcours valide les gestionnaires applicatifs, pas le geste
physique de souris.

### Acceptation gestuelle Safari MCP des lots 1–4 — 27 octobre

Sur `http://localhost:5175/`, projet temporaire « MCP Mods pilote presets
2026-10-27 » :

- **Lot 1 — preset :** création d’une Carte depuis l’éditeur, déplacement vers
  « Blocs disponibles », puis dépôt dans une Section Flux. La Section rend le
  même BDC `bdc-card-ec3337df-4da5-41b5-8b92-5f28700e2abc` avec
  `data-card-layout="text-short-basic"` et la classe
  `elce-anchor-card-preview`.
- **Lot 2 — placement :** déplacement du Graphe
  `bdc-statistical-graph-718b8074-61d7-43f5-8bfa-812aecb3b707` avant la Section.
  La liste auteur expose ensuite le Graphe puis la Section ; le transfert utilise
  toujours `application/x-elce-bdc-order+json`.
- **Lot 3 — média :** passage de la Carte de test au preset `photo-basic`, puis
  dépôt d’un PNG de 68 octets dans son sélecteur. L’API renvoie `201` avec une
  métadonnée média ; la requête envoie `Content-Type: image/png`, l’aperçu
  affiche l’image de 1 × 1 pixel et l’éditeur revient à « Synchronisé » sans
  alerte.
- **Lot 4 — référence catalogue :** transfert `CATALOG_REFERENCE` de la Carte
  disponible vers la Section. Le JSON conserve son `bdcId` ; la Section ancre
  ce même BDC et le retire du catalogue.

Les lots 1 à 4 sont acceptés par leurs parcours MCP sur le projet temporaire.
Les appels persistants de document répondent `200`, l’import média `201` ; les
404 antérieurs concernent deux médias absents du fixture avant ce parcours.

## Actions acceptées — réalisation terminée le 28 octobre 2026

1. Appliquer les lots L1–L8 de l’[étude d’extraction](../notes/2026-10-20-learning-extraction-study.md) selon les frontières actualisées par l’[examen des ressources candidates](../notes/2026-10-27-learning-reusable-resources-study.md) et l’[audit des dépendances](../notes/2026-10-27-learning-independence-audit.md).
2. Garder les entrées applicatives stables et leur faire choisir explicitement les compositions publiques Learning auteur, Preview et serveur. Conserver un seul acteur, une seule file de commandes, un historique et les circuits de commit, média et synchronisation.
3. Après chaque lot : tests ciblés, typecheck, build et parcours MCP de l’intégration concernée sur `5175`. Nommer les fichiers et consigner les résultats avant le lot suivant.
4. Mettre à jour les spécifications propriétaires avec le comportement vérifié ; garder dans ce plan tout travail d’acceptation restant.

Acceptation : Learning fonctionne par ses compositions dans la structure mods,
avec les comportements et limitations actuels. Les ressources extraites
n’importent pas Learning et leurs classes métier sont éprouvées avec des données
propres aux tests, sans champs Learning factices. Les raccords réels concernés
sont validés en complément des tests métier, du typecheck et du build. Aucun
autre mod ni scheduler n’est à construire pour obtenir cette acceptation.

### Lots d’extraction adoptés

Les correspondances de fichiers et signatures sont détaillées sous [L1–L8 dans
l’étude d’extraction](../notes/2026-10-20-learning-extraction-study.md#pistes-techniques-de-découpage).

| Lot | Propriétaire et résultat | État |
| --- | --- | --- |
| L1 | `core/`, `resources/`, `mods/learning/` : config, types de données et presets sans dépendances croisées. | **Fini le 28 octobre 2026.** Configurations et types séparés, registres de presets répartis par propriétaire puis assemblés par Learning ; l’ancre, l’apparence et les réglages de lecture consomment les vues de ressources. 231 tests ciblés sur 18 fichiers, typecheck et build passent. Sur Safari MCP (`5175`), titre de Section et preset de Carte modifiés puis rétablis via l’éditeur ; `PUT /document` répond `200`, état « Synchronisé ». En arrière-plan, l’état redevient « Lecture seule » sans alerte. Voir les spécifications Document, Ancre, Apparence et Réglages de lecture. |
| L2 | `mods/learning/document/` et `mods/learning/commands/` : modèle v7, factories et invariants Learning. | **Fini le 28 octobre 2026.** `LearningDocumentCommandService` compose les services Page, BDC, Ancrage, Média et Révélation avec les services métier injectés ; `LearningPageCommandService` possède les opérations page/chapitre et le parcours. Types/factories ressource, factories Learning, placement et recherches structurelles communes, puis invariants communs et Learning sont alignés dans la [spécification Document](../../specs/document-model-spec.md). 139 tests d’intégration ciblés + 16 SQLite/API, typecheck et build passent. Sur Safari MCP (`5175`), chapitre ajouté puis supprimé dans le projet temporaire ; les deux `PUT /document` répondent `200`, l’état final est en lecture seule sans alerte. |
| L3 | `core/controller/`, `history/`, `projects/`, `sync/`, `persistence/` : acteur, historique et stockage communs par injection. | **Fini le 28 octobre 2026.** Acteur, historique, store IndexedDB, transport/client HTTP et coordinateurs génériques ; composition, codecs et services Learning injectés. Les tests d’intégration sont rangés sous `mods/learning/integration/`, ceux de verrou et média sous `core/`; aucun fichier `core/` n’importe Learning. 16 fichiers ciblés, 106 tests, typecheck et build passent. Safari MCP sur `5175` a modifié un titre, exercé Undo/Redo, vérifié `PUT`/`GET 200` après rechargement et supprimé le projet temporaire ; un codec IndexedDB indépendant a aussi validé checkpoint, médias partagés et nettoyage d’orphelins, puis sa base a été supprimée. Contrats mis à jour : [historique](../../specs/document-history-spec.md), [cache IndexedDB](../../specs/document-store-spec.md), [session](../../specs/project-session-spec.md), [API](../../specs/project-api-spec.md), [accès éditeur](../../specs/editor-window-access-spec.md), [SPA Remix](../../specs/remix-spa-spec.md). |
| L4 | `resources/` : modèles, services, éditeurs et builders des BDC/formats sans import Learning. | **Fini le 28 octobre 2026.** Le dépôt fichier dans l’éditeur Section intercepte maintenant l’événement avant la navigation navigateur. Sur l’image d’une Carte ancrée, l’action d’import Card remplace le média du même BDC ; sans position valide, le dépôt est annulé sans mutation. Les tests ciblés après correction passent (57 tests sur sept fichiers), avec typecheck et build. Sur Page D MCP (`5175`), Safari valide le même identifiant de Carte, `PUT /document` `200`, upload média `201`, puis un Undo restaure l’ancien média et un Redo le nouveau en un geste chacun. Un dépôt sur le fond de la page est aussi annulé après propagation, sans navigation ni sauvegarde. L’image originale est restaurée et vérifiée après rechargement. La validation de séparation avait déjà couvert 117 tests ciblés. Contrats mis à jour : [Ancre](../../specs/anchor-spec.md), [Section](../../specs/section-editor-spec.md) et [Historique](../../specs/document-history-spec.md). Le contrôle post-correction MCP utilise un `File` synthétique ; le glisser Finder post-correction reste hors des outils exposés. |
| L5 | `core/authoring/` et `mods/learning/authoring/` : cadre commun et contributions auteur Learning. | **Fini le 28 octobre 2026.** `CoreEditorFacade`, façade/service Learning, vues et composition navigateur séparés ; neuf fichiers de tests (39 tests), typecheck et build passent. La composition Learning annule au niveau document les dépôts de fichiers non revendiqués, après propagation aux cibles auteur. Safari MCP (`5175`) confirme création/renommage d’une page, Undo/Redo clavier, réordonnancement du scénario via les handlers applicatifs et persistance de l’ordre au GET API ; la preview ouvre sa racine de lecture séparée et n’émet aucune requête API pendant l’observation. Le test Section confirme aussi qu’un dépôt hors page est consommé sans navigation, tandis qu’un dépôt sur l’image atteint le handler d’import. Responsive vérifié à 800/801/1200/1201 px sans débordement. Le contrôle utilise des `DragEvent` synthétiques ; il ne prétend pas valider un geste physique. Preuves : [SPA Remix](../../specs/remix-spa-spec.md), [Section](../../specs/section-editor-spec.md). |
| L6 | `core/reading/` et `mods/learning/reading/` : runtime partagé et scénario/player Learning. | **Fini le 28 octobre 2026.** `LearningPlayer` transmet l’injection publique `CodPlayOptions.frameScheduler` ; le scheduler de production reste inchangé. Deux parcours MCP dans des onglets frais, sans instrumentation, utilisent le vrai player, Sighty/CodPlay et l’`IntersectionObserver` natif : profil et Question validés, marqueur bas atteint, navigation Page A → Page B → Page A, état conservé en mémoire, image locale chargée, puis destruction du player. Aucun appel réseau `/test-state`. 114 tests ciblés sur 9 fichiers, typecheck et build passent ; aucun fichier de `packages/codplay` n’a été modifié. Preuves : [Preview](../../specs/player-preview-spec.md) et [Question](../../specs/question-bdc-spec.md). |
| L7 | `core/preview/` et `mods/learning/preview/` : session de consultation distincte de la composition React/Remix. | **Fini le 28 octobre 2026.** `LearningPreviewSession` garde navigation, réponses, progression, profil et évaluations en mémoire ; la preview réseau ne lit l’état test initial qu’en `GET` et son transport refuse toute écriture. 67 tests sur 8 fichiers, typecheck et build passent. Safari MCP a validé l’affichage d’une réponse et constaté zéro `PUT /test-state` après validation ; la fermeture de la popup détruit la session mémoire. Contrat et preuves : [Preview](../../specs/player-preview-spec.md), [Sommaire et profils](../../specs/summary-profile-spec.md) et [API](../../specs/project-api-spec.md). |
| L8 | `core/server/` et `mods/learning/persistence/` : transport commun et serveur/SQLite Learning. | **Fini le 28 octobre 2026.** Routeur, contrôleurs et politique réseau communs ; routes d’état test et persistance SQLite composées par Learning. 41 tests ciblés, typecheck et build passent. Safari MCP a vérifié création/lecture, bail d’édition, sauvegarde et relecture, suppression/404 et refus des ressources hors frontière ; le projet temporaire a été supprimé. Contrat et preuves : [API](../../specs/project-api-spec.md). |

Chaque lot est clos uniquement avec son parcours MCP réel, ses tests ciblés,
le typecheck, le build et la spécification propriétaire à jour. L’inventaire
MCP de Safari permet des `DragEvent`/`File` synthétiques ; il ne certifie pas un
geste physique à la souris.

## Format documentaire

Le v7 reste inchangé. Les entrées actuelles choisissent Learning explicitement ;
aucun champ `modId` ou format de données propre à un mod n’est ajouté pendant
L1–L8. Leur persistance et le traitement de formats inconnus attendront un
second mod et une décision de format.

## Décisions d’exécution et périmètre reporté

La demande d’implémentation adopte les actions L1–L8 et les frontières
actualisées par les études liées. Ces décisions guident l’extraction sans
modifier le format documentaire.

| Réf. | Décision pour le chantier |
| --- | --- |
| D1/D3 | Garder les projets en v7, sans champ `modId` ajouté. Les points d’entrée actuels sélectionnent Learning explicitement ; l’identification persistée, les formats propres aux mods et le refus d’un mod inconnu attendront un second mod et un format de référence. |
| D2/D7 | `learning-definition.ts` déclare l’identité, le nom et les contributions actuelles. Les compositions auteur, preview et serveur sont les entrées publiques Learning ; elles choisissent les services, éditeurs et capacités existants. Pas de registre générique de plugins. |
| D4/D5/D6 | Le transfert entre mods, les références de copie entre formats et le partage média entre projets sont reportés à un cas d’usage multi-mod. Cette extraction conserve les opérations actuelles au sein de Learning. |
| D8 | L’état de consultation Preview reste dans sa session et n’est pas écrit sur le serveur, selon la spécification Preview. Le stockage durable d’un état de lecture destiné à l’export ou à DGS est reporté. |
| D9 | DGS, séquence/scheduler et leurs besoins runtime restent hors chantier. |
| D10 | Adopter les frontières mises à jour par les études : le document complet et `PagePlacement` restent Learning ; le contenu métier des BDC et les formats de page sont extraits dans `resources/` sans dépendre de Learning. |
| D11 | Learning conserve les capacités et réglages existants. Les interfaces restent configurables par composition, sans inventer des variantes inutilisées ni rendre obligatoire une composition complète pour une ressource autonome. |
| D12 | Appliquer L1 à L8 dans l’ordre documenté, à fonctionnalités constantes, puis vérifier édition, historique, média, stockage/synchronisation, Preview et serveur. |
| D13 | Utiliser les échanges du circuit existant : intentions typées vers le contrôleur, commandes et vues spécialisées au point de composition, un acteur propriétaire du document. Aucun nouvel acteur ou second circuit d’écriture. |

Cache preview : état de consultation, navigation comprise, séparé du contenu
édité et du cache des ressources. **Appliqué et vérifié sur `develop`, puis
intégré à `elce-mods`.** La preview garde cet état dans sa session, ne l’écrit
pas sur le serveur et restitue la page active lors d’une reconstruction ;
« Synchroniser » utilise la page sélectionnée dans l’éditeur. Le contrat et
les preuves sont dans la [spécification Preview](../../specs/player-preview-spec.md).
D8 est limité à l’état de consultation Preview déjà spécifié. Le pilotage
durable de lecture pour l’export ou DGS reste hors de ce chantier.

Le comportement actuel de Sighty n’établit pas encore toutes les possibilités
de reprise, d’interruption et de concurrence envisagées pour DGS.

## Démarrage d’un mod

**Statut : En cours — README et skill préparés ; le dossier copiable reste
bloqué par son contrat d’intégration.** Ce lot outille la création d’un mod à
partir des compositions Learning sans lancer la réalisation de DGS.

- [x] Ajouter un README développeur : parties d’Elcé, édition, persistance,
  génération du lecteur, compositions et exemple Learning de renommage d’une
  page ; les contrats détaillés restent dans les spécifications liées.
- [x] Fournir le [README développeur](../../src/mods/docs/README.md) et le
  [skill Elcé Mod](../../src/mods/docs/SKILL.md) dans
  `packages/elce/src/mods/docs/`. Ce dossier persisté contient uniquement ces
  deux guides ; le plan, l’index et les notes restent dans `packages/elce/mods/`.
  `.agents/skills/elce-mod` pointe vers les guides pour la découverte locale
  par Codex.
- [ ] Définir le raccord minimal d’un mod généré au noyau et à ses entrées
  d’application. Les entrées actuelles choisissent Learning ; D1/D3 reportent
  l’identité persistée et sa résolution multi-mod. Ne pas inventer de champ ou
  registre pour le gabarit.
- [ ] Créer `packages/elce/src/mods/template/` avec les seuls raccords au noyau dont
  le contrat est vérifié. La composition reste directe en TypeScript (D2/D7),
  sans registre générique ni acteur documentaire supplémentaire. Chaque mod
  issu du gabarit embarque son `README.md` et son `SKILL.md`, avec des liens
  adaptés à son dossier.
- [ ] Vérifier qu’un mod issu du gabarit compile et suit au moins un vrai
  parcours de son entrée publique dans le noyau ; consigner les comportements
  stables dans une spécification après vérification.

Le gabarit exécutable dépend de la décision sur le point d’entrée du second mod
et sur les raccords minimaux à exposer. Le plan reste ouvert jusqu’à cette
acceptation. Sa copie doit conserver le guide et le skill utilisables sans le
dossier local `.agents`.

## Sequence et scheduler

Le point de départ de l’[étude dédiée](../notes/2026-10-20-sequence-scheduler-study.md)
distingue les enchaînements locaux de `sequence` et leur programmation temporelle
par `scheduler`. Le métier de ces ressources doit pouvoir être employé par
plusieurs mods ; leurs adaptations DGS appartiendront à ce mod. La possibilité
d’utiliser `sequence` sans scheduler reste ouverte. Leur réalisation est hors
du chantier actuel.

Les séquences et calendriers sont des données auteur à persister. Les builders
et contributions du mod les transforment en scénario, scènes, actions et guards.
La lecture suit ce scénario Sighty ; le format documentaire ne devient pas un
second langage d’exécution interprété par un lecteur DGS.

Une séquence peut présenter des scènes en parallèle dans les zones d’un même
layout. Sa fin naturelle exige la fin de chacune des occurrences attendues.
Cette condition collective appartient aux règles de `sequence` ; le raccord
aux signaux de lecture et aux transitions Sighty reste à préciser.

La diffusion est définie en heure locale du récepteur. La variante serveur
étudiée calcule les occurrences adaptées à son contexte et lui fournit les
données de diffusion à exécuter.

Un projet DGS peut associer ses récepteurs à des adresses de schedulers
distinctes pour diffuser, sur un réseau local, des parties complémentaires
d’un même propos. L’étude reste dans un mod DGS ; « diffusion uniforme » et
« diffusion par destination » restent des déclinaisons commerciales possibles.

L’affectation demande une interface pour nommer les diffuseurs, leur attribuer
un programme et connaître leur présence observée. Le formulaire local,
l’association depuis l’administration et la préparation avant installation
sont des pistes étudiées ; aucun parcours n’est encore retenu.

| Réf. | Décision ouverte |
| --- | --- |
| SQ1 | Usage de `sequence` sans calendrier et découpage physique du métier réutilisable et des adaptations propres aux mods. |
| SQ2 | Format documentaire et projection BDD des séquences ; génération distincte des passages successifs et compositions par zones en vues et scènes Sighty/CodPlay, avec correspondance des identités. |
| SQ3 | Durées, contrat des signaux de fin et raccord de la fin collective, cas des chapitres, transitions, chargement et dépassement. |
| SQ4 | Projection temporelle des passages successifs et scènes parallèles : durée finie, inconnue ou boucle. |
| SQ5 | Contexte local du récepteur, calendriers, récurrences datées, plages traversant minuit et choix du calendrier actif ; protocole de la projection serveur et retour des fins constatées si une décision serveur en dépend. |
| SQ6 | Arrivée tardive, reprise, horloge corrigée, chevauchement, interruptions, interludes et comportement hors plage. |
| SQ7 | Génération des routes, actions et guards ; admission Sighty, confirmation/refus et arbitrage entre échéance et fin locale. |
| SQ8 | Document auteur, productions de lecture et état de diffusion distincts ; conservation éventuelle des artefacts et réconciliation après modification auteur. |
| SQ9 | Contributions des modules, intégrité des références et suppression d’un contenu ou d’une séquence utilisée. |
| SQ10 | Identification durable et nommage des diffuseurs ; installation locale, déclaration/appairage ou préparation préalable ; conservation des affectations aux programmes, présence et confirmation de lecture, réassociation après remplacement ; éventuel besoin de découverte réseau ou de destinations logiques. |
| SQ11 | Identification des programmations servies et besoin éventuel de coordination temporelle entre les récepteurs. |

## Limites du chantier

DGS reste une diffusion TV collective et autonome, sans interaction directe
du public. Les mods hors DGS visent un player exporté pour LMS ; le LMS
conserve apprenants et résultats. La fabrication de l’export, SCORM et le
déploiement relèvent d’un chantier distinct.

Le diffuseur web est supposé lancé dans un environnement kiosque déjà configuré.
La configuration du mode kiosque et de l’équipement est un prérequis extérieur
au périmètre de cette étude.

Utilisateurs, catalogues personnels ou partagés, ACL et commercialisation
restent hors de cette étude. Les BDC intégrant des composants externes ou des
scènes préconçues restent deux exemples d’extensions à concevoir, sans réalisation
engagée. Les évolutions CodPlay/Sighty nécessaires gardent leurs décisions
et autorisations chez leurs propriétaires.
