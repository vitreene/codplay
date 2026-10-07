# Elcé — première proposition de tables SQLite

## Objet

Cette note propose un premier schéma relationnel pour enregistrer plusieurs
projets Elcé dans SQLite. Elle décrit les lignes et leurs relations à partir du
modèle Elcé v3 existant ; elle ne propose pas de colonne contenant le document
complet sous forme de JSON.

Le seul JSON opaque du schéma est `content_json`, produit et relu par Tiptap
pour le contenu riche d’un BDC Section. Le HTML statique exporté par Tiptap est
stocké séparément dans `markup_html`, car le builder de scène l’utilise déjà.
Les fichiers image et vidéo restent sur le système de fichiers ; SQLite garde
leur registre et leurs références.

Cette proposition SQLite sert l’étape initiale du serveur local ; SQLite n’est
pas fixé comme moteur de la base finale de la V1 aboutie, qui sera probablement
différent. Le stockage temporaire du navigateur n’est pas modélisé ici.

## Schéma proposé

Les identifiants de domaine sont conservés avec `project_id` dans les clés
primaires et étrangères. Cela rend explicites les appartenances et empêche une
référence de relier par erreur deux projets. Les chaînes de type et de preset
restent les valeurs déclarées en configuration et validées par les classes
métier ; la base ne crée pas de tables de valeurs concurrentes.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  format_version INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE chapters (
  project_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  name TEXT NOT NULL,
  chapter_type TEXT NOT NULL,
  PRIMARY KEY (project_id, chapter_id),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE chapter_evaluation_settings (
  project_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  evaluation_threshold REAL NOT NULL,
  evaluation_attempt_limit INTEGER,
  evaluation_retry_scope TEXT NOT NULL,
  PRIMARY KEY (project_id, chapter_id),
  FOREIGN KEY (project_id, chapter_id)
    REFERENCES chapters(project_id, chapter_id) ON DELETE CASCADE
);

CREATE TABLE pages (
  project_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  name TEXT NOT NULL,
  page_type TEXT NOT NULL,
  PRIMARY KEY (project_id, page_id),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

-- Une séquence unique contient les entrées racine page/chapitre et les pages
-- ordonnées de chaque chapitre. Un chapitre n’est pas une page.
CREATE TABLE scenario_entries (
  entry_row_id INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_chapter_id TEXT,
  page_id TEXT,
  chapter_id TEXT,
  position INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, parent_chapter_id)
    REFERENCES chapters(project_id, chapter_id) ON DELETE NO ACTION,
  FOREIGN KEY (project_id, page_id)
    REFERENCES pages(project_id, page_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, chapter_id)
    REFERENCES chapters(project_id, chapter_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX scenario_root_order
  ON scenario_entries(project_id, position)
  WHERE parent_chapter_id IS NULL;
CREATE UNIQUE INDEX scenario_chapter_page_order
  ON scenario_entries(project_id, parent_chapter_id, position)
  WHERE parent_chapter_id IS NOT NULL;
CREATE UNIQUE INDEX scenario_page_once
  ON scenario_entries(project_id, page_id)
  WHERE page_id IS NOT NULL;
CREATE UNIQUE INDEX scenario_chapter_once
  ON scenario_entries(project_id, chapter_id)
  WHERE chapter_id IS NOT NULL;

-- Pages inutilisées, conservées hors du scénario.
CREATE TABLE catalog_pages (
  project_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (project_id, page_id),
  UNIQUE (project_id, position),
  FOREIGN KEY (project_id, page_id)
    REFERENCES pages(project_id, page_id) ON DELETE CASCADE
);

CREATE TABLE media_resources (
  project_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  media_caption TEXT,
  content_sha256 TEXT,
  storage_key TEXT NOT NULL,
  PRIMARY KEY (project_id, media_id),
  UNIQUE (project_id, storage_key),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX media_content_identity
  ON media_resources(project_id, media_type, size_bytes, content_sha256)
  WHERE content_sha256 IS NOT NULL;

CREATE TABLE content_blocks (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  content_block_type TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  media_id TEXT,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, media_id)
    REFERENCES media_resources(project_id, media_id) ON DELETE RESTRICT
);

-- Un emplacement par BDC : page, catalogue des blocs disponibles ou enfant
-- d’un conteneur Carousel. duration_ms est utilisé pour une carte Carousel.
CREATE TABLE content_block_placements (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  page_id TEXT,
  parent_content_block_id TEXT,
  position INTEGER NOT NULL,
  duration_ms INTEGER,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, page_id)
    REFERENCES pages(project_id, page_id) ON DELETE NO ACTION,
  FOREIGN KEY (project_id, parent_content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE NO ACTION
);

CREATE UNIQUE INDEX content_block_page_order
  ON content_block_placements(project_id, page_id, position)
  WHERE page_id IS NOT NULL;
CREATE UNIQUE INDEX content_block_catalog_order
  ON content_block_placements(project_id, position)
  WHERE page_id IS NULL AND parent_content_block_id IS NULL;
CREATE UNIQUE INDEX content_block_child_order
  ON content_block_placements(project_id, parent_content_block_id, position)
  WHERE parent_content_block_id IS NOT NULL;

CREATE TABLE sections (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  title TEXT,
  content_json TEXT NOT NULL,
  markup_html TEXT NOT NULL,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE questions (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  question_type TEXT NOT NULL,
  title TEXT,
  prompt TEXT NOT NULL,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE question_answers (
  project_id TEXT NOT NULL,
  question_content_block_id TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  PRIMARY KEY (project_id, question_content_block_id, answer_id),
  UNIQUE (project_id, question_content_block_id, position),
  FOREIGN KEY (project_id, question_content_block_id)
    REFERENCES questions(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE evaluation_result_branches (
  project_id TEXT NOT NULL,
  result_content_block_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  message TEXT,
  action TEXT,
  PRIMARY KEY (project_id, result_content_block_id, branch),
  FOREIGN KEY (project_id, result_content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE carousels (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  default_view_duration_ms INTEGER NOT NULL,
  playback_mode TEXT NOT NULL,
  repeat_count INTEGER,
  aspect_ratio_width INTEGER NOT NULL,
  aspect_ratio_height INTEGER NOT NULL,
  transition TEXT NOT NULL,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE cards (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  overline TEXT,
  title TEXT,
  description TEXT,
  message TEXT,
  note TEXT,
  caption TEXT,
  image_position TEXT NOT NULL,
  image_fit TEXT NOT NULL,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);
```

`PRAGMA user_version` porte la version du schéma SQLite et évolue par
migrations SQL explicites. `projects.format_version` décrit la version du
modèle documentaire Elcé ; ce sont deux versions distinctes. Le schéma est
proposé pour le modèle v3 actuel, sans migration des anciens documents v1/v2.

## Correspondance modèle → tables

| Modèle Elcé | Tables | Représentation |
| --- | --- | --- |
| Document / projet | `projects` | Identifiant, nom, version de format, révision, dates ; aucune colonne document JSON |
| Chapitre | `chapters`, `chapter_evaluation_settings` | Identité, nom et type du chapitre ; réglages dans la table dédiée aux chapitres Évaluation |
| Pages et hiérarchie du scénario | `pages`, `scenario_entries` | Les entrées racine mélangent pages et chapitres ; les pages d’un chapitre sont ordonnées sous ce chapitre |
| Pages inutilisées | `catalog_pages` | Références ordonnées aux pages hors scénario |
| Ressources média | `media_resources` | Métadonnées et localisation du fichier ; aucun octet média dans SQLite |
| BDC Elcé et média réutilisable | `content_blocks`, `content_block_placements`, `media_resources` | Chaque placement a un `content_block` unique ; plusieurs blocs peuvent référencer le même média |
| Section | `sections` | JSON généré par Tiptap et export HTML statique |
| Question et réponses | `questions`, `question_answers` | Question normalisée ; réponses ordonnées et correction booléenne |
| Résultat d’évaluation | `evaluation_result_branches` | Branches Réussite et Échec liées au BDC commun |
| Carousel et vues Carte | `carousels`, `cards`, `content_block_placements` | Réglages du Carousel ; chaque carte est un bloc enfant ordonné, avec sa durée éventuelle dans son placement |

Dans `cards`, les zones de texte et la légende sont facultatives : elles sont
stockées en `NULL` lorsqu’elles sont absentes. Lors du chargement du modèle
Elcé actuel, la couche de persistance les reconstruit en chaînes vides, car
`CardContent` représente aujourd’hui ces champs par des chaînes requises.
`image_position` et `image_fit` restent requis comme options du preset. Le
même aller-retour `NULL` / chaîne vide s’applique au titre d’une Section, au
titre d’une Question, au message d’une branche de résultat et à la légende
globale d’un média. `repeat_count IS NULL` signifie que le défaut configuré du
Carousel s’applique.

Dans les noms SQL, `content_blocks` désigne la table des BDC Elcé, et
`content_block_id` référence cette entité depuis ses placements et ses tables
de détail. Les tables spécialisées portent seulement le nom du détail :
`sections`, `questions`, `evaluation_result_branches`, `carousels` ou `cards`.
Le code métier et l’interface peuvent continuer à employer « BDC ».

Les réglages d’évaluation appartiennent au chapitre de type Évaluation, et
non à ses pages ou à ses BDC Question. `chapters` garde le discriminant du
chapitre ; `chapter_evaluation_settings` contient ses réglages (seuil, limite
d’essais et portée de reprise). Pour le modèle actuel, le seuil y est enregistré
à `0.8` ; la limite peut rester `NULL` pour signifier les essais illimités.

### Empreinte de fichier `content_sha256`

`content_sha256` est facultatif. Quand elle est renseignée, c’est l’empreinte
SHA-256 des octets du fichier, encodée en 64 caractères hexadécimaux. Deux
fichiers aux mêmes octets produisent la même empreinte, même si leurs noms
diffèrent ; elle aide alors à reconnaître le réimport d’un média. L’index
d’unicité ne s’applique qu’aux lignes où l’empreinte est renseignée, et associe
projet, type, taille et empreinte.

Cette empreinte n’est ni un nom de fichier ni un chemin de stockage, ne contient
pas les octets et ne permet pas de reconstruire le média. `storage_key` sert à
retrouver le fichier enregistré sur le serveur ; `content_sha256` sert à
comparer son contenu à celui d’un fichier importé quand cette valeur est
disponible. Si elle est absente en base, l’index ne dédoublonne pas cette ligne.

Le placement d’un BDC ancré dans le texte reste porté par le JSON Tiptap de la
Section et par son export HTML. Les identifiants d’ancres doivent désigner des
BDC média du même projet et de la même page ; cette cohérence relève de la
validation métier, car SQLite ne peut pas vérifier les références encodées
dans `content_json`.

Dans `content_block_placements`, l’emplacement se déduit des références : un
`page_id` désigne une page, un `parent_content_block_id` désigne un parent, et
deux valeurs `NULL` désignent le catalogue. Il n’y a pas de colonne
`placement_kind` redondante. Le DDL ne met aucun `CHECK` sur cette table : la
persistance et les commandes valident la cible exclusive, la position et les
règles de durée dans leur transaction. Les index uniques imposent l’ordre sans
doublon dans chaque liste. Les suppressions de page et de parent BDC sont
`NO ACTION` dans cette table : la commande doit d’abord supprimer ou déplacer
les BDC affectés, afin d’éviter qu’une cascade efface seulement leur placement
et laisse les blocs orphelins.

Les BDC Image et Vidéo n’ont pas de table de contenu dédiée : leur type est
porté par `content_blocks.content_block_type`, leur ressource par
`content_blocks.media_id`, et leur emplacement par `content_block_placements`.
La ressource média n’est donc pas confondue avec le BDC transport qui l’insère ;
un dépôt répété peut créer un nouveau BDC pointant vers la même ligne
`media_resources`.

## Relecture table par table

| Tables | Nullabilité et rôle | Contraintes retenues ou vérification métier |
| --- | --- | --- |
| `projects` | Identifiant, nom et version requis ; révision initialisée à zéro ; dates requises côté serveur. | La validation des noms non vides appartient aux commandes métier. |
| `chapters`, `chapter_evaluation_settings` | Les réglages sont dans une extension 0/1 ; limite `NULL` = essais illimités. | La présence de l’extension selon `chapter_type`, la plage du seuil et la limite d’essais sont vérifiées par le domaine. |
| `pages` | Nom et type requis ; rattachement au scénario stocké séparément. | Les types et les noms sont validés par la configuration et les commandes métier. |
| `scenario_entries` | Un ordre représente les pages et chapitres racine ou les pages d’un chapitre. | La cible unique et l’absence de chapitre imbriqué dans le POC sont validées par le domaine. Les index uniques imposent ordre et présence uniques. Le lien vers un chapitre parent est `NO ACTION`, afin de refuser la suppression d’un chapitre qui contient encore des pages. |
| `catalog_pages` | Une ligne signifie page disponible hors scénario. | L’ordre est unique ; l’exclusivité avec `scenario_entries` est validée dans la transaction métier. |
| `media_resources` | Métadonnées de fichier et clé serveur requises ; légende et SHA-256 facultatifs. | Taille et format des métadonnées validés par le domaine ; clé de stockage unique par projet ; l’empreinte présente identifie un contenu de même type et taille. Aucun octet n’est stocké ici. |
| `content_blocks` | Type et preset requis ; référence média facultative. | La clé étrangère interdit un média d’un autre projet. Type et preset autorisés viennent de la configuration et du domaine. |
| `content_block_placements` | Une ligne par bloc ; cible page, parent, ou aucune des deux pour le catalogue. | Le domaine valide la cible unique, la position et les règles de durée. Les index uniques garantissent un ordre sans doublon. Les liens page/parent sont `NO ACTION` : le nettoyage métier doit précéder la suppression de la cible. |
| `sections` | Titre facultatif ; JSON Tiptap et HTML projeté requis, y compris pour une Section vide. | La validité du JSON Tiptap et les références d’ancre sont vérifiées par l’application. |
| `questions`, `question_answers` | Titre facultatif ; type, énoncé, libellés et correction requis. | Position unique par question ; le type et la valeur de correction sont validés par le domaine. Le nombre de réponses et le nombre de bonnes réponses sont également vérifiés par le domaine. |
| `evaluation_result_branches` | Message et action facultatifs ; branche requise. | Clé primaire empêche deux lignes pour la même branche ; la présence des deux branches et la validité de l’action sont vérifiées par le domaine. |
| `carousels` | Réglages actifs requis ; `repeat_count NULL` reprend le défaut de configuration. | Durée, ratio, nombre de répétitions et valeurs d’énumération sont validés par la configuration et le domaine. |
| `cards` | Champs texte et légende facultatifs ; position d’image et ajustement requis. | Les limites de longueur et la compatibilité avec le preset sont validées par le domaine. |

Dans ce premier état, les contraintes `CHECK` sont écartées temporairement,
pas rejetées pour la base finale. Les clés primaires, les clés étrangères et
les index `UNIQUE` gardent leurs rôles relationnels ; les règles de valeur et
de compatibilité sont validées par les commandes métier et la persistance dans
la transaction. Les index `UNIQUE` imposent aussi l’unicité des ordres et le
dédoublonnage média indiqués. À la consolidation de la V1, il faudra revoir
prudemment les contraintes adaptées au moteur de base finalement retenu, sans
supposer que les choix propres à SQLite s’y transposent tels quels.

## Invariants à appliquer dans une transaction

Les clés et index SQL ci-dessus couvrent les références, l’unicité d’un
placement de BDC, les ordres et les suppressions en cascade des lignes de
détail. Les classes métier et la couche de persistance vérifient, avant
validation de la transaction, les règles de valeur et les invariants suivants :

- chaque page apparaît soit dans `scenario_entries`, soit dans
  `catalog_pages`, jamais dans les deux ; chaque chapitre apparaît une fois à
  la racine ;
- les positions sont valides, les tailles média non négatives, les durées et
  dimensions positives, le seuil dans sa plage, la limite d’essais et le
  nombre de répétitions conformes aux règles du domaine ; les valeurs de
  correction sont des booléens ;
- un chapitre de type Évaluation possède une ligne dans
  `chapter_evaluation_settings` ; un chapitre standard n’en possède pas. La
  correspondance entre `chapter_type` et présence de cette ligne est vérifiée
  par le domaine dans la transaction ;
- `content_blocks.content_block_type` correspond exactement à ses données de
  détail (`sections`, `questions`, `evaluation_result_branches`, `carousels` ou
  `cards`) ;
- un BDC avec `parent_content_block_id` est une Carte dont le parent est un
  Carousel ;
  une Carte ne peut pas être placée sur une page ou au catalogue ; un Carousel
  garde au moins une Carte ;
- une Question possède ses réponses requises et respecte la règle de correction
  de son type : une réponse juste pour Choix et Vrai/Faux, au moins une pour
  Choix multiple ;
- un BDC Résultat possède exactement les branches configurées Réussite et
  Échec ; les valeurs `action` appartiennent aux options déclarées ;
- les cartes respectent les invariants des presets : longueur maximale du
  message, zones et médias autorisés ;
- une Section référence seulement des BDC image/vidéo placés dans la même page,
  sans référence répétée ;
- une clé média correspond au nom de fichier stocké, tandis que le SHA-256
  identifie le contenu réutilisable du même type dans un projet.

Les écritures d’une commande métier complète — création, déplacement ou
suppression d’un ensemble de lignes — se font dans une transaction SQLite.
Pour une sauvegarde basée sur une révision lue auparavant, l’API peut incrémenter
`projects.revision` par comparaison atomique :

```sql
UPDATE projects
SET revision = revision + 1, updated_at = :updated_at
WHERE project_id = :project_id AND revision = :expected_revision;
```

Zéro ligne modifiée signifie que la révision attendue est périmée ; la
transaction métier n’est alors pas validée. Cette règle ne remplace pas les
commandes XState et classes métier côté éditeur : elle protège l’écriture de la
version SQLite.

## Décisions à relire avant les migrations

1. **Identifiant et nom** — la proposition prend l’identifiant et le nom du
   projet comme ceux du document Elcé (`ElceDocument.id` et `.name`). Si
   l’application distingue ultérieurement plusieurs projets d’un document,
   cette relation devra être décomposée avant le DDL.
2. **Placement des pages** — `scenario_entries` et `catalog_pages` remplacent
   les tableaux d’ordre et d’affectation du modèle en mémoire par des lignes
   relationnelles. Le dépôt doit lire ces lignes pour reconstruire les
   commandes et l’ordre du document.
3. **Réglages du chapitre Évaluation** — la proposition utilise une table
   `chapter_evaluation_settings` liée 0/1 au chapitre. Une autre forme simple
   serait de garder ces champs comme colonnes nullables de `chapters`. Ce choix
   relationnel reste à relire ; la règle métier reste que les réglages
   appartiennent au chapitre Évaluation.
4. **Détails de contenu** — `sections`, `questions`, `carousels` et `cards`
   sont liées à `content_blocks` par clé étrangère. Les branches de résultat
   sont directement liées au BDC commun. La concordance avec le discriminateur
   `content_block_type` reste validée par le domaine dans la transaction ;
   ajouter des triggers SQLite n’est pas proposé à ce stade.
5. **Légendes** — `media_resources.media_caption` et `cards.caption` sont deux
   propriétés distinctes dans le modèle actuel : la première est la métadonnée
   du média, la seconde la légende du preset de carte.
6. **Diapo** — la table `pages` accepte le discriminateur `diapo`, mais les
   règles de BDC et le comportement de ce format ne sont pas définis par ce
   schéma. Aucune contrainte de contenu Diapo n’est inventée ici.

Avant de coder le dépôt SQLite, il reste à relire ces choix et à fixer la forme
de l’API de persistance (chargement des lignes vers `ElceDocument`, écriture
transactionnelle des commandes, et frontière de validation du document reçu).
La proposition ne modifie ni le modèle Elcé en mémoire ni le format exporté par
`ElceDocument.toJSON()` ; elle remplace uniquement l’idée d’utiliser ce JSON
comme enregistrement SQLite opaque.

## Références consultées

- [Modèle de document Elcé](../specs/document-model-spec.md)
- [Édition d’une Section](../specs/section-editor-spec.md)
- [Bloc de contenu Question](../specs/question-bdc-spec.md)
- [BDC Carousel et BDC Carte](../specs/carousel-bdc-spec.md)
- [Évaluation d’un chapitre](../specs/chapter-evaluation-spec.md)
- [Plan de stockage local et synchronisation](../plan/2026-10-06-elce-local-first-synchronisation-plan.md)
