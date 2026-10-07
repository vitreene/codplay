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

## Requêtes et réponses

| Méthode et chemin | Requête | Réponse |
| --- | --- | --- |
| `GET /api/projects` | — | `200 { "projects": [{ "id", "name", "revision" }] }` |
| `POST /api/projects` | `ElceDocumentData` v4 en JSON | `201 { "project": { "id", "name", "revision": 0 } }` et `ETag: "0"` |
| `GET /api/projects/:projectId` | — | `200 { "project", "document" }` et l’ETag de la révision courante |
| `PATCH /api/projects/:projectId` | `{ "name": string }` | `200 { "project" }`, avec le nom mis à jour, la révision suivante et son ETag |
| `DELETE /api/projects/:projectId` | — | `204` |
| `PUT /api/projects/:projectId/document` | `ElceDocumentData` v4 et `If-Match: "<revision>"` | `200 { "project" }` et l’ETag de la nouvelle révision |

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
qui restent présents. Les octets ne sont pas encore reçus ni servis par cette
tranche ; le transfert et le stockage des fichiers sont définis à l’étape
suivante du plan local-first.

## Limite du contrat vérifié

`ProjectApiController` délègue les lectures et mutations à `ProjectPersistence`.
Les tests couvrent les opérations API avec le dépôt isolé, puis avec SQLite
Remix en mémoire. Une base fichier est fermée puis rouverte ; les deux projets
restent lisibles et le document v4 conserve ses relations et ordres. La
révision périmée est refusée sans perdre les métadonnées de stockage média.
L’API est encore exercée directement par le routeur Fetch : aucun listener HTTP
local ni route de fichiers n’est inclus dans cette tranche.

La couverture API est dans
[`api-router.test.ts`](../src/server/api-router.test.ts) et la couverture
relationnelle dans
[`sqlite-project-persistence.test.ts`](../src/server/projects/sqlite/sqlite-project-persistence.test.ts).
Les routes sont enregistrées dans
[`api-router.ts`](../src/server/api-router.ts) ; le contrôleur HTTP et sa
frontière de persistance sont dans `src/server/projects/`.
