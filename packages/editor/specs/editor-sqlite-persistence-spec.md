# Éditeur — persistance SQLite locale

Spécification du stockage local de documents auteur `EditorScene`, vérifié le
1 novembre 2026. Le stockage conserve les types documentaires sous leurs
propriétaires actuels. Le comportement de leur snap dans la timeline est décrit
par la [spécification Sequence Editor V2](../specs/sequence-editor-v2-cues-markers-spec.md).

## Contrat

- SQLite conserve le document auteur complet. Le résultat compilé, l'état du
  player et l'historique Undo/Redo n'y sont pas stockés.
- Le cache de l'application conserve la scène chargée. La persistance observe
  les chargements, commits documentaires et remplacements de scène ; elle écrit
  les snapshots aux frontières de commit existantes. Les changements de
  sélection seuls ne déclenchent pas d'écriture. Par scène, une seule requête
  SQLite est en vol ; les snapshots arrivant pendant cette requête sont remplacés
  par le plus récent, puis écrit avec la nouvelle révision.
- `flush()` attend chaque écriture en vol et le dernier snapshot en attente.
  Chaque sauvegarde transporte la révision attendue ; une révision périmée est
  refusée, sans écraser la version plus récente.
- Undo et Redo passent par le remplacement normal du document et enregistrent
  le snapshot restauré. SQLite ne reçoit aucune entrée d'historique.
- Au démarrage, l'application charge la scène active et sa révision. Le choix
  de scène active est conservé séparément du document.
- La validation JSON stricte s'applique aux documents avant l'écriture ; les
  valeurs non sérialisables font échouer la sauvegarde avec leur chemin. Les
  références relationnelles et la cohérence des zones sont vérifiées au
  chargement et à la sauvegarde.

## Stockage relationnel

| Table | Données persistées |
| --- | --- |
| `editor_scenes` | Identité, durée, réglages de scène, état/hooks facultatifs, réglages de capsule racine, références de décor/master, `markerTracks`, révision et dates. |
| `items` | Type, libellé, visibilité, référence de contenu et décor initial. |
| `capsules` | Réglages statiques de capsule associés à l'item : type, distribution, grille, transitions par défaut et comportement. |
| `capsule_items` | Parent capsule et clé d'ordre des enfants. Un parent SQL `NULL` désigne un enfant direct de la racine implicite. |
| `keyframes` | Ordre, instant, canal, décor référencé, transitions, nom et marqueur. |
| `contents` | Type, source, texte et options de texte, langue, waveform, cues et `mediaId`. Les cues restent avec le contenu qui porte ces timestamps. |
| `decors` | Le `Decor` complet en JSON, indexé par son id. Ses propriétés ne sont ni éclatées en colonnes ni interrogées par SQLite. |
| `zones` | Identité, capsule propriétaire nullable, nom, géométrie paysage/portrait et éventuelle configuration du conteneur. |
| `media_resources` | Catalogue local des métadonnées de ressource et clé de stockage ; `contents.media_id` référence ce catalogue. |
| `editor_state` | Identité de la scène active. |

Les clés étrangères protègent les identités et liens relationnels. Le dépôt
vérifie aussi qu'un décor qui référence un `zoneId` pointe vers une zone de la
capsule parente correspondante. Le JSON complet du décor reste la valeur
d'auteur faisant foi.

Les cues et `markerTracks` sont conservés à leur emplacement documentaire ; la
persistance ne crée pas de tables supplémentaires ni de projection de marqueurs.
Dans la timeline V2, une cue reste fixe avec son contenu source, tandis qu’un
marqueur auteur peut bouger ; leur snap commun est détaillé dans la
[spécification de timeline](../specs/sequence-editor-v2-cues-markers-spec.md).

## Serveur local et API

Le script `npm run dev` de `packages/editor` démarre Vite sur le port `5174` et
l'API locale sur `127.0.0.1:5182`. Par défaut, SQLite utilise
`packages/editor/.editor-data/editor.sqlite`. `EDITOR_DATA_DIRECTORY` change le
dossier de données et `EDITOR_API_PORT` le port de l'API.

- `GET /api/scenes` retourne le catalogue et la scène active.
- `GET /api/scenes/:sceneId` retourne le document complet et sa révision.
- `PUT /api/scenes/:sceneId` sauvegarde le document avec `expectedRevision` ;
  une révision périmée produit HTTP `409`.
- `PUT /api/active-scene` met à jour la scène active.

Le démarrage applique les migrations Remix `remix/data-table` à la base SQLite.
Le serveur ferme la connexion lors de son arrêt.

## Limites actuelles

- Il n'y a pas de migration depuis l'ancien `localStorage` provisoire : son
  unique document de test a été abandonné au basculement.
- La table `media_resources` et la référence `Content.mediaId` sont présentes,
  mais l'import, le stockage des octets, la gestion API du catalogue et la
  résolution d'URL stable appartiennent au chantier médias suivant. Une source
  `blob:` ne survit pas au rechargement ; l'application le signale.
- Aucun backend distant n'est ajouté par ce stockage local.

## Preuves

- `tests/app/persistence/sqlite-editor-scene-persistence.spec.ts` vérifie la
  migration, le round-trip de documents complets (capsules imbriquées, zones,
  géométries, contenus, cues, `markerTracks`, décor opaque et réglages), les
  deux tailles de grille testées et le rejet d'une sauvegarde périmée.
- [`tests/app/persistence/editor-scene-persistence.spec.ts`](../tests/app/persistence/editor-scene-persistence.spec.ts)
  exerce la file réelle contre SQLite : les changements faits pendant une
  requête sont coalescés et `flush()` sauvegarde le dernier snapshot avec la
  révision attendue suivante.
- `tests/commands/base-commands.spec.ts` vérifie la création d'IDs après
  restauration d'un document contenant déjà des IDs.
- Parcours navigateur sur l'application réelle : chargement depuis SQLite,
  création, Undo/Redo persistés, retour à la scène d'origine par Undo, puis
  rechargement depuis SQLite sans erreur console.
- La suite complète de `packages/editor` passe (**533 tests sur 50 fichiers**) ;
  typecheck et build réussis. Le build émet uniquement son avertissement de
  taille de bundle.
