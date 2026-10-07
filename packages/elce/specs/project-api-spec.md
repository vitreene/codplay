# Elcé — API locale des projets

## Rôle

Le routeur Fetch Remix expose les opérations du catalogue local des projets.
Un projet correspond à un `ElceDocument` v4 : son identifiant et son nom sont
ceux du document. Le navigateur crée le document initial ; le serveur reçoit
ensuite sa valeur structurée et la persiste. Le routeur ne crée pas un second
document initial.

Cette spécification décrit le contrat HTTP du routeur et du contrôleur. La
frontière `ProjectPersistence` isole le stockage ; ce contrat ne transforme pas
le document complet en colonne JSON de SQLite.

## Accès direct depuis l’éditeur

L’éditeur appelle l’API depuis le navigateur, sans proxy Vite. L’origine par
défaut est `http://127.0.0.1:5181` ; `VITE_ELCE_API_ORIGIN` permet de la
remplacer pour l’environnement local. Le serveur de développement écoute sur
`127.0.0.1` uniquement.

Pour les requêtes navigateur, le serveur autorise les origines HTTP de boucle
locale (`localhost`, `127.0.0.1` et `[::1]`), quelle que soit leur origine de
port. Le prévol `OPTIONS` autorise les méthodes `GET`, `POST`, `PUT`, `PATCH`,
`DELETE` et les en-têtes `Content-Type` et `If-Match`. Il expose `ETag` à
l’éditeur. Un prévol d’une origine hors boucle locale est refusé.

## Requêtes et réponses

| Méthode et chemin | Requête | Réponse |
| --- | --- | --- |
| `GET /api/projects` | — | `200 { "projects": [{ "id", "name", "revision" }] }` |
| `POST /api/projects` | `ElceDocumentData` v4 en JSON | `201 { "project": { "id", "name", "revision": 0 } }` et `ETag: "0"` |
| `GET /api/projects/:projectId` | — | `200 { "project", "document" }` et l’ETag de la révision courante |
| `PATCH /api/projects/:projectId` | `{ "name": string }` | `200 { "project" }`, avec le nom mis à jour, la révision suivante et son ETag |
| `DELETE /api/projects/:projectId` | — | `204` |
| `PUT /api/projects/:projectId/document` | `ElceDocumentData` v4 et `If-Match: "<revision>"` | `200 { "project" }` et l’ETag de la nouvelle révision |
| `PUT /api/projects/:projectId/media/:mediaId` | Octets du média en corps brut | `201 { "media": { "id", "url" } }`, ou `204` si les octets sont déjà enregistrés sous cette ressource |
| `GET /api/projects/:projectId/media/:mediaId` | — | Fichier média avec son type MIME et sa taille |

Le corps JSON transporté est le document v4 structuré produit par
`ElceDocument.toJSON()`. L’adaptateur de persistance le projette vers les
tables ; seul le JSON riche de Tiptap reste un champ JSON en base.

Les documents reçus passent par `ElceDocument.fromJSON()` puis
`assertDocumentInvariants()`. Le corps d’un remplacement doit porter le même
identifiant que `:projectId`. Un remplacement n’est appliqué que si la révision
envoyée dans `If-Match` est la révision courante.

## Erreurs

Les réponses d’erreur ont la forme `{ "error": "<code>" }` :

| Statut | Code | Sens |
| --- | --- | --- |
| `400` | `invalid_request` | JSON, document v4, identifiant ou nom de type invalide |
| `404` | `project_not_found` | Le projet demandé n’existe pas |
| `409` | `project_already_exists` | L’identifiant du document existe déjà |
| `412` | `revision_mismatch` | La révision de `If-Match` est périmée ; aucune écriture n’est faite |
| `428` | `if_match_required` | Un remplacement de document doit fournir sa révision |
| `400` | `invalid_media_body` / `media_size_mismatch` | Le corps fichier manque ou sa taille ne correspond pas aux métadonnées SQLite |
| `404` | `media_not_found` | La ressource ou son fichier serveur est absent |
| `409` | `media_changed` / `media_already_has_file` | Les métadonnées ont changé pendant l’upload ou la ressource possède déjà un autre contenu |
| `409` | `media_already_exists` | Les octets appartiennent déjà à une autre ressource du projet ; la réponse inclut son `mediaId` canonique |
| `415` | `unsupported_media_type` | Le type MIME du média ne fait pas partie des types pris en charge par le modèle |

## Persistance SQLite vérifiée

`SqliteProjectPersistence` implémente `ProjectPersistence` avec
`remix/data-table/sqlite`. À l’ouverture, `openProjectDatabase()` applique les
migrations SQL chargées avec `loadMigrations()` de Remix. Les migrations créent
les tables relationnelles du modèle v4 ; aucune table ne contient le document
Elcé entier en JSON. Seuls `sections.content_json` et `sections.markup_html`
gardent respectivement le JSON Tiptap et son export HTML.

Le dépôt restitue le document à partir des lignes `projects`, `chapters`,
`pages`, `scenario_entries`, `catalog_pages`, `media_resources`,
`content_blocks`, `content_block_placements` et de leurs tables de détail.
L’ordre des entrées de scénario, des pages de chapitre, des BDC et des médias
est conservé par les positions relationnelles. Les réglages Évaluation sont
des colonnes facultatives du chapitre. Les Cartes et les Questions portent
leurs références média distinctes ; la ressource garde le type MIME, la clé
de fichier serveur et l’empreinte optionnelle.

La création, le renommage, la suppression et le remplacement du document se
font dans une transaction. Le remplacement incrémente la révision uniquement
si `If-Match` correspond à la révision courante. Une sauvegarde du document
préserve la clé de stockage et l’empreinte déjà enregistrées pour les médias
qui restent présents.

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

## Vérification

`ProjectApiController` délègue les lectures et mutations à `ProjectPersistence`.
Les tests couvrent les opérations API avec le dépôt isolé, puis avec SQLite
Remix en mémoire. Une base fichier est fermée puis rouverte ; les projets
restent lisibles et le document v4 conserve ses relations et ordres. La
révision périmée est refusée sans perdre les métadonnées de stockage média.

`createElceHttpServer()` assemble le listener Node, le routeur Fetch Remix,
SQLite et FileStorage. Le test intégré envoie un vrai `POST`, des `PUT` média
et des `GET` au serveur en écoute ; il vérifie les octets, la déduplication,
le cache HTTP, la lecture partielle vidéo, le nettoyage après fusion de médias
et la suppression du projet. Il vérifie aussi le prévol depuis l’origine
éditeur `http://localhost:5175` et le refus d’une origine distante.

La couverture API est dans
[`api-router.test.ts`](../src/server/api-router.test.ts) et la couverture
relationnelle dans
[`sqlite-project-persistence.test.ts`](../src/server/projects/sqlite/sqlite-project-persistence.test.ts).
Les routes sont enregistrées dans
[`api-router.ts`](../src/server/api-router.ts) ; les contrôleurs média et leur
frontière de persistance sont dans `src/server/media/`.
