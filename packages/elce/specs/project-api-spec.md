# Elcé — API locale des projets

## Rôle

Le routeur Fetch Remix expose les opérations du catalogue local des projets.
Un projet correspond à un `ElceDocument` v7 : son identifiant et son nom sont
ceux du document. Le navigateur crée le document initial ; le serveur reçoit
ensuite sa valeur structurée et la persiste. Le routeur ne crée pas un second
document initial.

Cette spécification décrit le contrat HTTP du routeur et du contrôleur. La
frontière `ProjectPersistence` isole le stockage ; ce contrat ne transforme
pas le document complet en colonne JSON de SQLite. Le contenu métier du BDC
Graphe est l’exception : `StatisticalGraphContent` est conservé en
JSON opaque dans `statistical_graphs.content_json`. Les métadonnées communes
d’identité et de placement de ce BDC restent relationnelles.

## Accès direct depuis l’éditeur

L’éditeur appelle l’API depuis le navigateur, sans proxy Vite. L’origine par
défaut est `http://127.0.0.1:5181` ; `VITE_ELCE_API_ORIGIN` permet de la
remplacer pour l’environnement local. En lancement normal, le serveur de
développement écoute sur `127.0.0.1` uniquement.

Pendant le portage Remix, `npm run dev:elce` à la racine démarre ensemble
l’éditeur Vite sur le port `5175` et cette API sur le port `5181`, en réutilisant
les scripts de développement existants. Cette orchestration est temporaire ;
le plan de transposition prévoit son remplacement par les scripts du serveur
Remix quand cette étape sera appliquée. Pour lancer l’API seule :
`npm run dev:api --workspace=@codplay/elce`.

Pour essayer le lecteur sur un téléphone du même réseau local, la commande
racine `npm run dev:elce:network` lance l’interface et l’API sur les ports
`5175` et `5181`, liées aux interfaces réseau de la machine. Le lancement
choisit une IPv4 privée active et imprime les adresses de preview et d’API.
Ce mode est opt-in ; il ne change pas le lancement local habituel.

Pour les requêtes navigateur, le serveur autorise les origines HTTP de boucle
locale (`localhost`, `127.0.0.1` et `[::1]`), quelle que soit leur origine de
port. Le prévol `OPTIONS` autorise les méthodes `GET`, `POST`, `PUT`, `PATCH`,
`DELETE` et les en-têtes `Content-Type`, `If-Match`, `X-Elce-Page-Id` et
`X-Elce-Edit-Grant`. Il expose `ETag` à l’éditeur ainsi que `Content-Disposition`
et `X-Elce-Scorm-Filename` pour l’export SCORM. En mode réseau, l’origine
exacte de la preview peut lire le document et son état test, lire ses médias,
et écrire uniquement l’état test. Les mutations du document et des médias,
l’index des projets et les droits d’édition restent refusés depuis cette
origine. Le prévol réseau autorise `GET` et `HEAD` pour les lectures du
document, et `GET`, `HEAD` et `PUT` pour l’état test.

## Requêtes et réponses

| Méthode et chemin | Requête | Réponse |
| --- | --- | --- |
| `POST /api/exports/sighty` | `multipart/form-data` : `document` JSON v7 et un fichier `media:<id>` par média référencé | `200 application/zip`, `Content-Disposition: attachment; filename="<nom>.sighty.zip"`, `Cache-Control: no-store` ; aucune persistance |
| `POST /api/exports/scorm` | `multipart/form-data` : `sightyPackage` ZIP, `documentName`, `version` (`1.2`, `2004v3` ou `2004v4`) et `monoSco` (`true` ou `false`) | `200 application/zip`, nom stable dans `Content-Disposition` et `X-Elce-Scorm-Filename`, nombre de packages dans `X-Elce-Scorm-Package-Count`, `Cache-Control: no-store` ; aucune persistance |
| `GET /api/projects` | — | `200 { "projects": [{ "id", "name", "revision" }] }` |
| `POST /api/projects` | `ElceDocumentData` v7 en JSON | `201 { "project": { "id", "name", "revision": 0 } }` et `ETag: "0"` |
| `GET /api/projects/:projectId` | — | `200 { "project", "document" }` et l’ETag de la révision courante |
| `POST /api/projects/:projectId/edit-access` | `{ "pageId": string, "force"?: true }` | `200 { "grantId": string, "recovered": boolean }` ; une répétition normale par la page détentrice retrouve son droit ; `force: true` le remplace |
| `GET /api/projects/:projectId/edit-access` | En-têtes de droit | `200 { "held": boolean }` |
| `PUT /api/projects/:projectId/edit-access` | En-têtes du droit courant | `204` si le bail est renouvelé ; `409 edit_access_lost` sinon |
| `DELETE /api/projects/:projectId/edit-access` | En-têtes de droit | `204` si la paire courante a libéré le droit |
| `PATCH /api/projects/:projectId` | `{ "name": string }` et en-têtes de droit | `200 { "project" }`, avec le nom mis à jour, la révision suivante et son ETag |
| `DELETE /api/projects/:projectId` | En-têtes de droit | `204` |
| `PUT /api/projects/:projectId/document` | `ElceDocumentData` v7, `If-Match: "<revision>"` et en-têtes de droit | `200 { "project" }` et l’ETag de la nouvelle révision |
| `GET /api/projects/:projectId/test-state` | — | `200 { "state" }` et un ETag de révision indépendant |
| `PUT /api/projects/:projectId/test-state` | `{ "state": ProjectTestState }`, `If-Match: "<revision>"` | `200 { "state" }` et l’ETag suivant ; `412` si périmé |
| `PUT /api/projects/:projectId/media/:mediaId` | Octets du média en corps brut et en-têtes de droit | `201 { "media": { "id", "url" } }`, ou `204` si les octets sont déjà enregistrés sous cette ressource |
| `GET /api/projects/:projectId/media/:mediaId` | — | Fichier média avec son type MIME et sa taille |

Le corps JSON transporté est le document v7 structuré produit par
`ElceDocument.toJSON()`. L’adaptateur de persistance le projette vers les
tables ; le JSON riche de Tiptap et le contenu complet du BDC Graphe sont les
deux champs JSON en base. Les autres BDC, dont Question/Réponses, conservent
leurs projections relationnelles.

L’état auteur lu par `GET /test-state` est initialisé à `{ schemaVersion: 1 }`
et à la révision `0` lorsqu’aucune ligne n’existe encore. Son premier `PUT`
crée la ligne. Cette ressource ne demande pas le droit d’édition documentaire
et n’incrémente pas la révision du projet.

Les documents reçus passent par `ElceDocument.fromJSON()` puis
`assertDocumentInvariants()`. Le corps d’un remplacement doit porter le même
identifiant que `:projectId`. Un remplacement n’est appliqué que si la révision
envoyée dans `If-Match` est la révision courante.

Les écritures d’un projet existant (`PATCH`, `DELETE`, `PUT document`, `PUT
media`) et la libération du droit présentent la paire
`X-Elce-Page-Id`/`X-Elce-Edit-Grant`. SQLite garde une seule paire par projet.
L’acquisition d’une autre page renvoie `409 edit_access_occupied` tant que le
bail est actif ; un ancien droit ne peut plus écrire après libération,
expiration ou réacquisition. Le contrôle du droit et la mutation documentaire
se font dans la même transaction. Le `PUT` média revérifie la paire dans la
transaction qui publie sa clé de fichier ; un fichier refusé est retiré. La
création d’un nouveau projet reste libre, pour permettre une copie indépendante.
Une acquisition après expiration ou avec `force: true` retourne un droit neuf
et `recovered: true`; l’éditeur relit alors la dernière révision confirmée
avant d’activer ses commandes.

## Erreurs

Les réponses d’erreur ont la forme `{ "error": "<code>" }`, sauf les
diagnostics documentaires et le doublon de média qui ajoutent leurs champs
spécifiques :

| Statut | Code | Sens |
| --- | --- | --- |
| `400` | `invalid_request` | JSON, document v7, identifiant ou nom de type invalide ; un `PUT /document` ajoute le diagnostic décrit ci-dessous |
| `404` | `project_not_found` | Le projet demandé n’existe pas |
| `409` | `project_already_exists` | L’identifiant du document existe déjà |
| `409` | `edit_access_occupied` / `edit_access_lost` | Une autre page détient le projet, ou la paire envoyée n’est plus courante |
| `428` | `edit_access_required` | Une mutation n’a pas présenté les deux en-têtes de droit |
| `412` | `revision_mismatch` | La révision de `If-Match` est périmée ; aucune écriture n’est faite |
| `428` | `if_match_required` | Un remplacement de document doit fournir sa révision |
| `400` | `invalid_media_body` / `media_size_mismatch` | Le corps fichier manque ou sa taille ne correspond pas aux métadonnées SQLite |
| `400` | `invalid_export_body` / `invalid_export_document` / `unknown_export_media` / `invalid_export_media` / `invalid_export_media_size` | Le formulaire d’export, son document ou ses fichiers sont invalides |
| `422` | `sighty_export_failed` | Le document ou ses ressources ne peuvent pas produire un paquet Sighty complet |
| `400` | `invalid_scorm_export_body` / `invalid_scorm_export_package` / `invalid_scorm_export_version` / `invalid_scorm_export_mono_sco` / `invalid_scorm_export_document_name` | Le formulaire, le ZIP Sighty, l’édition, l’option monoSCO ou le nom du projet est invalide |
| `422` | `scorm_export_failed` | L’assemblage SCORM du paquet Sighty a échoué |
| `404` | `media_not_found` | La ressource ou son fichier serveur est absent |
| `409` | `media_changed` / `media_already_has_file` | Les métadonnées ont changé pendant l’upload ou la ressource possède déjà un autre contenu |
| `409` | `media_already_exists` | Les octets appartiennent déjà à une autre ressource du projet ; la réponse inclut son `mediaId` canonique |
| `415` | `unsupported_media_type` | Le type MIME du média ne fait pas partie des types pris en charge par le modèle |

Un rejet de validation par `PUT /api/projects/:projectId/document` retourne
`{ "error": "invalid_request", "diagnosticId": "<uuid>",
"diagnosticReason": "<reason>" }`. Les raisons distinguent
`invalid_if_match`, `invalid_json`, `invalid_document_shape`,
`document_rehydration_rejected`, `document_invariants_rejected` et
`document_id_mismatch`. L’API journalise le même identifiant, le projet, la
route et la raison ; lorsque la reconstitution ou les invariants échouent, le
log conserve au plus huit frames d’appel, sans le message dynamique de
l’erreur. Ni le corps, ni le nom, ni le contenu éditorial du document ne sont
journalisés. Le client garde l’identifiant et la raison dans
`ElceProjectApiError`, affichés avec l’erreur de synchronisation, et ne
réessaie pas un `invalid_request` déterministe. La copie locale reste en
attente afin de pouvoir l’inspecter ou la récupérer.

## Persistance SQLite vérifiée

`SqliteProjectPersistence` implémente `ProjectPersistence` avec
`remix/data-table/sqlite`. À l’ouverture, `openProjectDatabase()` applique les
migrations SQL chargées avec `loadMigrations()` de Remix. Les migrations créent
les tables relationnelles du modèle v7 ; aucune table ne contient le document
Elcé entier en JSON. `sections.content_json` garde le JSON Tiptap et
`sections.markup_html` son export HTML. `statistical_graphs` garde le contenu
complet du Graphe dans `content_json` ; les tables `graph_categories`,
`graph_series` et `graph_values` sont supprimées. Question/Réponses conserve
les tables `questions` et `question_answers`. Les colonnes `summary_json` et
`profile_json` enregistrent les réglages du Sommaire et du profil. La table
`project_test_states` conserve séparément le JSON de test auteur et sa révision.
Les colonnes `appearance_json` de `projects`, `pages` et `content_blocks`
enregistrent les réglages d’apparence facultatifs correspondants. La migration
`20261024190000_flatten_demo5_local_appearance_presets` convertit les presets
locaux uniquement pour Demo5 ; le contrat complet figure dans la
[spécification d’apparence](./appearance-spec.md).
La migration `20261025120000_rebuild_appearance_class_system` convertit le
document Demo5 du format 6 au format 7 : les références de duo deviennent des
choix distincts pour titre et corps, et Transparent devient `density: "none"`.
Elle ne convertit pas les autres projets. Son application à la base locale a
été vérifiée : `GET /api/projects/demo5-elce-comparison` retourne le document
v7 et l’éditeur l’ouvre sans erreur de version.
La migration `20261015100000_add_summary_page_continuation_mode` complète les
réglages existants avec `pageContinuationMode: "endpage"` seulement quand cette
clé manque ; elle préserve une valeur déjà enregistrée.

Le dépôt restitue le document à partir des lignes `projects`, `chapters`,
`pages`, `scenario_entries`, `catalog_pages`, `media_resources`,
`content_blocks`, `content_block_placements`, `statistical_graphs.content_json`
et des tables de détail des BDC relationnels. L’ordre des entrées de scénario,
des pages de chapitre, des BDC et des médias est conservé par les positions
relationnelles. Les réglages Évaluation sont des colonnes facultatives du
chapitre. Les Cartes et les Questions portent
leurs références média distinctes ; la ressource garde le type MIME, la clé
de fichier serveur et l’empreinte optionnelle.

La création, le renommage, la suppression et le remplacement du document se
font dans une transaction. Le remplacement incrémente la révision uniquement
si `If-Match` correspond à la révision courante. Une sauvegarde du document
préserve la clé de stockage et l’empreinte déjà enregistrées pour les médias
qui restent présents.
La migration `20261011180000_add_project_edit_access` conserve le détenteur et
l’identifiant du droit dans `projects`, y compris après réouverture de SQLite.
La migration `20261012120000_add_project_edit_lease` ajoute son échéance. Le
serveur accorde un bail de 12 secondes ; la page détentrice le renouvelle toutes
les 3 secondes. Après expiration, toute autre page peut acquérir un droit neuf.
`force: true` remplace aussi immédiatement un bail encore actif. Les requêtes
présentant l’ancien droit restent refusées.

La migration `20261013120000_store_statistical_graph_json` convertit les lignes
relationnelles des Graphes existants en `StatisticalGraphContent` JSON puis
supprime leurs trois tables de détail. Sa migration inverse recrée les lignes
relationnelles. Les lignes Question/Réponses ne sont pas touchées.

## Fichiers média

L’éditeur crée d’abord la ligne `media_resources` avec son nom, son type MIME
et sa taille. `PUT /api/projects/:projectId/media/:mediaId` reçoit ensuite le
fichier en corps HTTP brut. Le serveur écrit le flux dans un fichier temporaire
et calcule son SHA-256 pendant cette écriture. La taille reçue doit être
identique à celle déclarée dans SQLite. Le fichier fini est copié dans le
FileStorage filesystem de Remix ; la transaction SQLite publie ensuite sa
`storage_key` et son empreinte. Une interruption avant publication laisse un
fichier sans référence, nettoyé au prochain démarrage.

Le stockage est immuable par ressource média. Répéter le même upload pour le
même `mediaId` renvoie `204`. Envoyer un contenu différent pour une ressource
déjà enregistrée renvoie `409 media_already_has_file`. Si les mêmes octets sont
envoyés sous un autre `mediaId` du même projet, l’API renvoie `409
media_already_exists` avec l’identifiant canonique ; aucun second fichier ni
référence n’est publié. Le document peut ensuite consolider les références par
sa commande métier `media.merge`. Cette réponse est l’exception au format
d’erreur simple : elle inclut aussi `mediaId`.

`GET` sert le fichier via `createFileResponse()` de Remix, à partir de sa clé
FileStorage. La réponse déclare `Cache-Control: public, max-age=31536000,
immutable`. L’aide Remix fournit les réponses conditionnelles et les requêtes
`Range` pour les types média non compressibles ; Elcé n’implémente pas de
gestionnaire `Range` parallèle. Le test HTTP vérifie une réponse `206` et son
`Content-Range` pour une vidéo.

La suppression d’une ressource du document ou du projet supprime aussi les
fichiers qui ne sont plus référencés. Le nettoyage protège les clés d’uploads
en cours ; à leur finalisation, il retire également les fichiers rendus
orphelins par une suppression concurrente. Le démarrage supprime les
temporaires interrompus et les fichiers sans référence.

Le contrat de disponibilité à la lecture reste celui de Sighty/CodPlay : si un
builder fournit une URL serveur à la scène, le preload déjà en place assure la
disponibilité du média avant le montage. Cette API ne crée aucun préchargeur
ni circuit de lecture Elcé.

L’export Sighty reçoit un instantané documentaire par formulaire multipart.
Le navigateur envoie uniquement les médias référencés par les scènes directes
du scénario ; le serveur transmet le ZIP sans enregistrer ce document ou ces
octets. Le contrat d’assemblage et de téléchargement figure dans la
[spécification d’export Sighty Elcé](./sighty-export-spec.md).

## Vérification

`ProjectApiController` délègue les lectures et mutations documentaires à
`ProjectPersistence`; `ProjectTestStateApiController` traite l’état test séparé.
Les tests couvrent les opérations API avec le dépôt isolé, puis avec SQLite
Remix en mémoire. Une base fichier est fermée puis rouverte ; les projets
restent lisibles et le document v7 conserve ses relations et ordres. La
révision périmée est refusée sans perdre les métadonnées de stockage média.

`createElceHttpServer()` assemble le listener Node, le routeur Fetch Remix,
SQLite et FileStorage. Le test intégré envoie un vrai `POST`, des `PUT` média
et des `GET` au serveur en écoute ; il vérifie les octets, la déduplication,
le cache HTTP, la lecture partielle vidéo, le nettoyage après fusion de médias
et la suppression du projet. Il vérifie aussi le prévol depuis l’origine
éditeur `http://localhost:5175` et le refus d’une origine distante.

`ElceProjectApiClient` adapte les opérations de catalogue et de document
utilisées par l’application : lister, créer, lire, renommer, supprimer,
enregistrer le document et transférer un média. Ses tests vérifient les chemins
HTTP, les méthodes, les corps, les ETags, la remontée de l’identifiant média
canonique en cas de doublon et la propagation du diagnostic documentaire.
Ils vérifient aussi le renouvellement du bail et l’envoi du forçage. Les tests
API vérifient les catégories de rejet `PUT /document`, la corrélation entre la
réponse et le log, ainsi que l’absence de contenu documentaire dans ce log ;
le coordinateur vérifie que l’identifiant et la catégorie remontent dans
l’erreur de projet, qu’un rejet n’est pas réessayé et que la copie locale reste
en attente. Les tests SQLite couvrent le renouvellement, l’expiration, la
reprise forcée et le refus d’une écriture de l’ancienne paire.

Le 8 octobre, `npm run dev:elce` a démarré ensemble l’entrée Vite et le listener
API. Le port `5175` étant occupé, Vite a servi l’entrée sur `5176` ; les requêtes
HTTP vers `http://localhost:5176/` et
`http://127.0.0.1:5181/api/projects` ont répondu avec la page Elcé et la liste
vide attendue. L’arrêt du lanceur a libéré les deux ports.

La migration Graphe et son aller-retour, y compris la conservation de
Question/Réponses, sont vérifiés par
[`sqlite-project-persistence.test.ts`](../src/server/projects/sqlite/sqlite-project-persistence.test.ts).
La couverture API est dans
[`api-router.test.ts`](../src/server/api-router.test.ts) et la couverture
relationnelle dans
[`sqlite-project-persistence.test.ts`](../src/server/projects/sqlite/sqlite-project-persistence.test.ts).
La couverture de l’adaptateur navigateur est dans
[`project-api-client.test.ts`](../src/infrastructure/project-api/project-api-client.test.ts).
Les routes sont enregistrées dans
[`api-router.ts`](../src/server/api-router.ts) ; les contrôleurs média et leur
frontière de persistance sont dans `src/server/media/`.

Le test SQLite vérifie qu’une deuxième page reçoit `409`, qu’un ancien droit
ne peut plus enregistrer après transfert, et que le droit persiste après
redémarrage. Il simule aussi la perte de la première réponse d’acquisition
après commit : une nouvelle demande de la même page retrouve le droit initial.
Le test HTTP complet, exécuté avec un port local autorisé, vérifie
également les uploads avec les en-têtes requis et le prévol CORS. Le parcours
Safari d’octobre 2026 a confirmé qu’une page lectrice ne prend pas le droit
détenu par une autre page et qu’une copie obtient son propre droit.

Le 13 octobre 2026, Brave a vérifié depuis l’origine LAN de la preview que la
lecture de `GET /api/projects/elce-document` répond `200`, tandis que
`GET /api/projects` et le prévol `PUT` du document répondent `403`.
