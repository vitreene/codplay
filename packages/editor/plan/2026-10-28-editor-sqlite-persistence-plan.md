# Éditeur — persistance SQLite locale

**Statut : Terminé et vérifié (2026-10-31).** Les six étapes sont réalisées.
Le round-trip SQLite, le parcours navigateur, les cues fixes de leur source,
le snap commun cues/marqueurs, les tests, le typecheck et le build sont vérifiés.
La [spécification](./2026-10-28-editor-sqlite-persistence-spec.md) décrit le
stockage livré ; le contrat temporel est dans la
[spécification Sequence Editor V2](../specs/sequence-editor-v2-cues-markers-spec.md).
Ce chantier remplace le stockage provisoire `localStorage` après sauvegarde du
modèle auteur courant. Il reste séparé de la reconstruction Remix et ne modifie
aucun fichier de `packages/codplay`.

## Décisions applicables

- SQLite conserve l’`EditorScene` auteur, jamais le résultat compilé, l’état du
  player ou la pile Undo/Redo. L’acteur XState reste le cache de travail ; la
  base reçoit les documents aux commits existants, pas les échantillons d’un
  geste continu.
- Pas de migration depuis `codplay.editor.temp-scenes.v1` : une seule scène de
  test y est présente et elle est abandonnée au basculement.
- Les items et capsules sont relationnels. Une capsule contient ses items
  enfants et ses zones. La capsule racine est implicite dans le document auteur ;
  ses réglages sont portés par `EditorScene.rootCapsule`. En base, une capsule
  parente `NULL` désigne cette racine, sans lui inventer un item ou un id.
- La racine supporte une grille `1 rangée × 1 colonne` avec transforms d’item
  ou `90 rangées × 160 colonnes` (grille écran `160 × 90`). En `1 × 1`, `x/y`
  restent des transforms dans le décor. En `160 × 90`, le décor de l’item
  référence une zone de sa capsule ; la zone porte les coordonnées et
  `rowSpan`/`colSpan`, donc les dimensions. `capsule_items` ne duplique pas ces
  valeurs. Le mode de grille et le placement suivent les entrées réelles de
  Capsule Automation.
- Chaque décor est une valeur JSON complète indexée uniquement par son id. Pas
  de colonnes ou requêtes sur ses propriétés.
- Les contenus et ressources média sont séparés. Les octets média résident
  dans Remix FileStorage ; SQLite conserve les métadonnées et les références.
  Un import hors scène crée une ressource seule ; le dépôt sur la scène crée un
  item qui la référence. `Content.mediaId` identifie une ressource locale ;
  `Content.source` reste la source externe éventuelle. Un contenu ne porte
  qu’une ressource média courante, donc la FK est sur `contents` sans table de
  jointure redondante.
- Le son reste après Capsule comme chantier fonctionnel. La persistance garde
  les champs son déjà présents dans le modèle courant. Aucun schéma de piste
  audio dédié n’est ajouté ici ; un son pourra être un item de timeline avec
  élagage et placement.
- Les cues et marqueurs ont le même rôle de repérage et d’ancrage. Les
  timestamps d’une source restent avec cette source ; les repères de timeline
  correspondants en sont dérivés. Le stockage conserve aussi le payload
  `markerTracks` déjà présent dans le document, sans table de marqueurs ni
  normalisation supplémentaire dans ce chantier. Leur fonctionnement pourra
  être affiné avec l’usage.

## Modèle relationnel proposé

- `editor_scenes` : identité, métadonnées de scène, réglages `rootCapsule`,
  `root_decor_id`, `master_item_id`, payload `markerTracks`, révision et mise à
  jour.
- `items` : id stable, type, libellé, visibilité, contenu et décor initial.
- `capsules` : capsule liée à un item, type, distribution, grille, transitions
  par défaut et comportement.
- `capsule_items` : appartenance, ordre et identifiants enfant/parente ; une
  capsule parente `NULL` indique l’implicite racine. Pas de coordonnées de
  placement dupliquées ici.
- `keyframes` : item, ordre, temps, canal, décor, transitions, nom et marqueur.
- `contents` : type, texte, source externe, `media_id`, langue, waveform et
  timestamps propres à la source.
- `media_resources` : catalogue local partagé des fichiers (`media_id`, nom,
  MIME, taille, empreinte, clé de stockage) ; les octets sont hors SQLite.
- `decors` : `scene_id`, `decor_id`, `decor_json` complet.
- `zones` : `scene_id`, `capsule_id` nullable (`NULL` = racine), `zone_id`, nom
  et géométrie de zone. La
  capsule du parent de l’item doit être celle de sa zone sélectionnée ; cette
  cohérence est vérifiée au niveau Editeur à partir du `Decor` entier.
- `editor_state` : scène active.

Les clés étrangères sont limitées aux identités et liens documentaires. La
cohérence entre un `Decor.zoneId` opaque et une zone de la capsule parente est
validée par le modèle Editeur au chargement et au commit.

## Actions ordonnées

| Étape | Propriétaires | Résultat et porte d’acceptation | État |
| --- | --- | --- | --- |
| 1. Aligner le modèle auteur | `app/commands/types.ts`, builder V2, dépôt SQLite | `Zone.capsuleId`, `EditorScene.rootCapsule` et `Content.mediaId` représentent les propriétaires et références décidés ; les valeurs de décor restent opaques. | Réalisée ; round-trip vérifié. |
| 2. Créer le stockage relationnel | migration SQLite Remix sous `src/server/projects/sqlite/migrations/` | Schéma relationnel et clés étrangères pour scènes, items, capsules, KFs, contenus et zones ; aucune table `markers` ou `audio_tracks`, aucune colonne de décor par propriété. | Réalisée ; migration testée. |
| 3. Ajouter le dépôt de documents | `sqlite-editor-scene-persistence.ts` | Chargement complet et sauvegarde transactionnelle ; la révision attendue empêche d’écraser une version plus récente. | Réalisée ; round-trip et conflit testés. |
| 4. Ajouter le serveur local | API, `editor-http-server.ts`, script Editor et proxy Vite | Routes catalogue/chargement/sauvegarde et démarrage local. Le stockage de fichiers et les routes d’import/lecture média suivent avec le chantier import, sur le circuit Elcé. | Réalisée ; parcours local vérifié. |
| 5. Remplacer le provisoire | `browser-entry.tsx`, routeur, layout/menu et façade de persistance | L’application charge et sauvegarde via SQLite et le cache XState ; l’adaptateur `localStorage` et sa clé sont retirés, sans migration. | Réalisée ; Undo/Redo et rechargement vérifiés. |
| 6. Valider et documenter | tests existants, build/typecheck, specs Editor | Round-trip exact des scènes, capsules, zones référencées par décor, contenus, KFs et historique ; aucun changement CodPlay. Documenter seulement les comportements vérifiés. | Réalisée le 31 octobre : suite Editor 533/533, typecheck/build et round-trip vérifiés. La timeline partage le snap ; la cue reste fixe avec sa source, le marqueur auteur reste mobile et seul lui porte l’attache persistante `markerId`. Voir la [specification temporelle V2](../specs/sequence-editor-v2-cues-markers-spec.md). |

## Critères d’acceptation

- Une scène auteur complète se charge depuis SQLite et conserve ses IDs,
  contenu, décors opaques, capsules, zones, placements, KFs et réglages.
- La capsule racine restitue les modes de grille `1 × 1` et `90 × 160`
  (grille écran `160 × 90`) ; les zones conservent leurs spans et appartiennent
  à une capsule.
- Les cues restent attachées au contenu source ; les repères de timeline sont
  dérivés sans copie des timestamps ni tables de marqueurs.
- `Content.mediaId` et `Content.source` sont conservés sans URL `blob:` dans le
  parcours à valider ; FileStorage et résolution média sont acceptés dans le
  chantier d’import suivant.
- Undo/Redo sauvegarde uniquement les documents restaurés aux frontières déjà
  définies. Aucun historique n’est écrit dans SQLite.
- Le démarrage, l’arrêt et la fermeture SQLite sont vérifiés. Le parcours local
  a été validé dans l’application réelle ; consigner les validations restantes
  avant de déclarer le chantier terminé.
- Aucun fichier de `packages/codplay` n’est modifié.

## Dépendances et écarts à résoudre

- L’alignement auteur ajoute `Zone.capsuleId` (`null` pour la racine),
  `EditorScene.rootCapsule` et `Content.mediaId`. L’assignation de zone reste
  portée par `Decor.zoneId`; les spans restent dans la zone. Le round-trip
  modèle/SQLite est couvert par `tests/app/persistence/sqlite-editor-scene-persistence.spec.ts`.
- `MarkerTrack` et `Cue` gardent leurs propriétaires et structures distincts.
  Les deux types alimentent le même snap grid ; la cue est un point fixe issu
  du `Content`, tandis que le marqueur peut être déplacé et entraîner les KFs
  qui lui sont attachés. Les tests du chemin de drag et de `moveMarker` couvrent
  cette distinction dans la [spécification temporelle V2](../specs/sequence-editor-v2-cues-markers-spec.md).
- Le catalogue média est partagé par la collection de scènes locale ; les
  octets FileStorage, l’API d’import/lecture et la résolution d’URL stable sont
  dans le chantier import suivant. Il n’existe pas encore de modèle `Project`.

Le stockage de fichiers et la résolution des médias restent au chantier
d’import suivant, comme défini dans la spécification ; ils ne font pas partie
de cette tranche de persistance documentaire.
