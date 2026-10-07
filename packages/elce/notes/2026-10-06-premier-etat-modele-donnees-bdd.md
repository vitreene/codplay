# Elcé — première proposition de tables SQLite

## Objet

Cette note propose un premier schéma relationnel pour enregistrer plusieurs
projets Elcé dans SQLite. Elle prend pour base le modèle documentaire v4
implémenté : une Carte est le BDC qui porte une référence média, qu’elle soit
placée directement dans une page ou dans un conteneur autorisé. Le modèle ne
crée pas de BDC `image`/`video` séparé et ne stocke pas de catégorie média
séparée. La proposition ne contient pas de colonne pour le document complet
sous forme de JSON.

Le seul JSON opaque du schéma est `content_json`, produit et relu par Tiptap
pour le contenu riche d’un BDC Section. Le HTML statique exporté par Tiptap est
stocké séparément dans `markup_html`, car le builder de scène l’utilise déjà.
Les fichiers image et vidéo restent sur le système de fichiers ; SQLite garde
leur registre et leurs références.

Cette proposition SQLite sert l’étape initiale du serveur local ; SQLite n’est
pas fixé comme moteur de la base finale de la V1 aboutie, qui sera probablement
différent. Le modèle documentaire cible est v4 ; aucune conversion automatique
des enregistrements v3 n’est prévue. Le stockage temporaire du navigateur
n’est pas modélisé ici.

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
  updated_at TEXT NOT NULL,
  default_intro_transition_ref TEXT NOT NULL,
  default_outro_transition_ref TEXT NOT NULL
);

CREATE TABLE chapters (
  project_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  name TEXT NOT NULL,
  chapter_type TEXT NOT NULL,
  evaluation_threshold REAL,
  evaluation_attempt_limit INTEGER,
  evaluation_retry_scope TEXT,
  PRIMARY KEY (project_id, chapter_id),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
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
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  media_caption TEXT,
  content_sha256 TEXT,
  storage_key TEXT,
  position INTEGER NOT NULL,
  PRIMARY KEY (project_id, media_id),
  UNIQUE (project_id, position),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX media_storage_key
  ON media_resources(project_id, storage_key)
  WHERE storage_key IS NOT NULL;

CREATE UNIQUE INDEX media_content_identity
  ON media_resources(project_id, size_bytes, content_sha256)
  WHERE content_sha256 IS NOT NULL;

CREATE TABLE content_blocks (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  content_block_type TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

-- Un emplacement par BDC : page, catalogue des blocs disponibles ou enfant
-- d’une Section ou d’un Carousel. Une Carte peut aussi être directement dans
-- une page. La position dans le texte reste portée par le JSON Tiptap ;
-- duration_ms et les transitions propres à une Carte sont des options de
-- placement.
CREATE TABLE content_block_placements (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  page_id TEXT,
  parent_content_block_id TEXT,
  position INTEGER,
  duration_ms INTEGER,
  intro_transition_ref TEXT,
  outro_transition_ref TEXT,
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
  default_intro_transition_ref TEXT,
  default_outro_transition_ref TEXT,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE questions (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  media_id TEXT,
  question_type TEXT NOT NULL,
  title TEXT,
  prompt TEXT NOT NULL,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, media_id)
    REFERENCES media_resources(project_id, media_id) ON DELETE RESTRICT
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
  aspect_ratio_width REAL NOT NULL,
  aspect_ratio_height REAL NOT NULL,
  default_intro_transition_ref TEXT,
  default_outro_transition_ref TEXT,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE cards (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  media_id TEXT,
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
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, media_id)
    REFERENCES media_resources(project_id, media_id) ON DELETE RESTRICT
);
```

Le registre de migrations Remix versionne le schéma SQLite au moyen des
migrations SQL explicites du serveur. `projects.format_version` décrit la
version du modèle documentaire Elcé ; les deux versions sont distinctes. Le
document v4 est requis par cette première migration ; aucune conversion
implicite des documents v1, v2 ou v3 n’est proposée ici.

## Correspondance modèle → tables

Les tables communes décrivent l’identité de chaque BDC et son emplacement. Les
tables de détail décrivent son contenu ; la whitelist de l’interface choisit
ensuite les types et layouts proposés dans chaque contexte. La base ne crée
pas une structure distincte pour chaque couple type/emplacement.

| Modèle Elcé | Tables | Description | Emplacements proposés à l’auteur |
| --- | --- | --- | --- |
| Document / projet | `projects` | Identifiant, nom, version de format, révision, dates et valeurs par défaut d’entrée/sortie des Cartes. Aucune colonne document JSON. | Une base peut contenir plusieurs projets ; les Cartes sans parent BDC héritent des défauts du projet. |
| Chapitre | `chapters` | Identité, nom, type et colonnes facultatives de réglage Évaluation. Les trois colonnes restent `NULL` pour un chapitre standard. | Entrée racine du scénario ; un chapitre n’est pas une page. |
| Pages et hiérarchie du scénario | `pages`, `scenario_entries` | Les entrées racine mélangent pages et chapitres ; les pages d’un chapitre sont ordonnées sous ce chapitre. Le type de page est `flux` ou `diapo`. | Les pages inutilisées sont hors du scénario et référencées par `catalog_pages`. |
| Ressource média | `media_resources` | Métadonnées réutilisables, MIME, ordre de catalogue et clé serveur facultative ; les octets restent dans un fichier. Ce n’est pas un BDC ; aucun champ `media_type` séparé n’est stocké. | Peut être référencée par plusieurs Cartes ou Questions ; `storage_key` reste `NULL` avant le transfert serveur. |
| BDC Texte / Section | `content_blocks`, `content_block_placements`, `sections` | Contenu riche produit par Tiptap et HTML statique exporté ; valeurs par défaut de révélation des Cartes ancrées. | Placement direct dans une page Flux. La whitelist ne propose pas le BDC Texte dans une Diapo. La Section peut recevoir des BDC Carte ou Carousel comme enfants inline ; Tiptap garde leur position exacte dans le texte. |
| BDC Quiz / Question | `content_blocks`, `content_block_placements`, `questions`, `question_answers`, `media_resources` | Type de quiz, question, réponses ordonnées et correction ; `questions.media_id` facultatif référence son illustration réutilisable. | Placement direct dans Flux ou comme unique BDC direct d’une Diapo ; une seule Question par page. La whitelist n’offre pas son ajout au catalogue ni comme enfant d’un autre BDC. |
| BDC Résultat | `content_blocks`, `content_block_placements`, `evaluation_result_branches` | Un BDC avec ses branches Réussite et Échec. | Placement direct dans une page Flux ou comme unique BDC direct d’une Diapo, seulement dans un chapitre Évaluation. Le type de chapitre commande le suivi et l’accès au BDC Résultat ; le type de page commande le format de lecture. |
| BDC Carousel | `content_blocks`, `content_block_placements`, `carousels` | Réglages du Carousel, valeurs par défaut d’entrée/sortie et ordre de ses BDC Carte enfants. | Placement direct dans Flux ou comme unique BDC direct d’une Diapo ; il peut aussi être enfant inline d’une Section. Il ne peut pas être enfant d’un Carousel. L’insertion inline est prévue dans le modèle cible mais n’est pas implémentée dans le POC. |
| BDC Carte | `content_blocks`, `content_block_placements`, `cards`, `media_resources` | Un BDC unique portant son layout, ses champs et, si nécessaire, `cards.media_id`. Les présentations image ou vidéo sont des layouts Carte, pas des types de BDC distincts. | Peut être placé directement dans Flux ou Diapo, dans le catalogue, ou comme enfant d’une Section ou d’un Carousel. La whitelist propose les layouts permis selon le contexte ; elle ne crée pas des types BDC séparés. La durée et les éventuels réglages de révélation propres à une Carte Carousel appartiennent à son placement. |

Les associations de placement se lisent ainsi : un BDC a exactement une ligne
dans `content_block_placements`. `page_id` le rattache directement à une page ;
`parent_content_block_id` le rattache à son BDC parent ; les deux valeurs
`NULL` désignent un BDC disponible au catalogue. Cette représentation reste
générique ; la whitelist d’interface règle les combinaisons présentées à
l’auteur. Pour un BDC enfant d’une Section, le JSON Tiptap porte son identifiant
et sa position inline exacte ; la ligne de placement ne duplique pas cet ordre
(`position` y reste `NULL`). Pour une Carte enfant de Carousel, `position`
porte l’ordre de la séquence, `duration_ms` sa durée propre et les références
`intro_transition_ref` / `outro_transition_ref` ses éventuelles transitions
personnalisées. Pour un enfant Carousel, un `NULL` de transition signifie que
le réglage par défaut du Carousel s’applique. Les valeurs par défaut du projet
sont dans `projects` ; `sections` et `carousels` peuvent les remplacer pour
leurs enfants. Une Carte placée directement dans une page n’a pas de réglage
propre à la page à ce stade : elle hérite du projet. L’animation de scroll des
Cartes enfants d’une Section reste celle de la Section, sans remplacement
individuel dans le périmètre fixé. Aucune animation n’est stockée sur `cards`,
car la révélation dépend du contexte de placement. Le type et le layout du BDC
ne changent pas selon qu’il est placé dans une page, un texte, un Carousel ou
le catalogue.

Une Diapo propose un seul BDC direct parmi Carousel, Carte et Question. Dans un
chapitre Évaluation, la whitelist propose également le BDC Résultat comme son
unique contenu direct. Une page Flux propose une séquence de Sections,
Questions, Cartes, Résultats et Carousels ; le BDC Résultat y est également
réservé aux chapitres Évaluation. Le format de page et le mode du chapitre sont
deux dimensions indépendantes : une Évaluation peut donc ne contenir que des
pages Diapo. Les restrictions d’ajout par type de page, parent et layout
restent une whitelist de l’interface auteur, pas des tables ou types BDC
parallèles.

**Correspondance avec le modèle v4.** Le document et les commandes créent une
Carte pour un média présenté comme contenu. `cards.media_id` porte la référence
réutilisable, le placement rattache une Carte ancrée à sa Section et le JSON
Tiptap en fixe la position. `questions.media_id` porte l’illustration d’un Quiz.
La table `media_resources` ne conserve que le MIME pour déterminer le rendu ;
aucune table ou colonne ne modélise un BDC image ou vidéo distinct.

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
non à ses pages ou à ses BDC Question. Ils restent dans `chapters`, car ils
forment trois propriétés facultatives du même objet métier et ne justifient
pas une relation 1:1 supplémentaire. Pour un chapitre standard, les trois
colonnes sont `NULL`. Pour un chapitre Évaluation, l’absence d’un seuil ou
d’une portée dans le document est normalisée aux défauts du domaine (`0.8` et
`all-questions`) lors de l’écriture ; `evaluation_attempt_limit = NULL` signifie qu’il
n’y a pas de limite. Le type de chapitre distingue ce dernier `NULL` de ceux
d’un chapitre standard.

### Empreinte de fichier `content_sha256`

`content_sha256` est facultatif. Quand elle est renseignée, c’est l’empreinte
SHA-256 des octets du fichier, encodée en 64 caractères hexadécimaux. Deux
fichiers aux mêmes octets produisent la même empreinte, même si leurs noms
diffèrent ; elle aide alors à reconnaître le réimport d’un média. L’index
d’unicité ne s’applique qu’aux lignes où l’empreinte est renseignée, et associe
projet, taille et empreinte. L’image ou la vidéo se déduit du `mime_type` ; le
type n’est pas répété dans la ressource ni dans le BDC.

Cette empreinte n’est ni un nom de fichier ni un chemin de stockage, ne contient
pas les octets et ne permet pas de reconstruire le média. `storage_key`, quand
elle est renseignée, sert à retrouver le fichier enregistré sur le serveur ;
`content_sha256` sert à
comparer son contenu à celui d’un fichier importé quand cette valeur est
disponible. Si elle est absente en base, l’index ne dédoublonne pas cette ligne.

Le placement inline d’un BDC dans le texte est porté par le JSON Tiptap de la
Section et par son export HTML. La ligne de placement rattache ce même BDC
Carte à sa Section par `parent_content_block_id` ; l’ancre Tiptap conserve sa
position entre les fragments de texte et référence seulement le BDC. La ligne
`cards.media_id` relie cette Carte à la ressource réutilisable. L’application
vérifie que l’identifiant de l’ancre, le parent Section et le BDC Carte
désignent le même projet et que le layout autorise le média ; SQLite ne peut
pas vérifier une référence encodée dans `content_json`.

Dans `content_block_placements`, l’emplacement se déduit des références : un
`page_id` désigne une page, un `parent_content_block_id` désigne un parent, et
deux valeurs `NULL` désignent le catalogue. Il n’y a pas de colonne
`placement_kind` redondante. Le DDL ne met aucun `CHECK` sur cette table : la
persistance et les commandes valident la cible exclusive, la position et les
règles de durée dans leur transaction. Les index uniques imposent l’ordre sans
doublon pour les listes ordonnées de pages, de catalogue et de Carousels. Pour
un BDC inline sous Section, `position` reste `NULL` : le JSON Tiptap est la
source unique de son emplacement dans le texte. Les suppressions de page et de
parent BDC sont `NO ACTION` dans cette table : la commande doit d’abord
supprimer ou déplacer les BDC affectés, afin d’éviter qu’une cascade efface
seulement leur placement et laisse les blocs orphelins.

Image et vidéo ne sont pas des types de BDC ni un champ séparé de la ressource.
La Carte porte le layout de présentation et sa référence média ; `mime_type`
permet de choisir le rendu image ou vidéo. `media_resources` porte les
métadonnées et la clé du fichier ; les octets restent dans le répertoire de
fichiers. Chaque Carte est une instance BDC unique, tandis que plusieurs Cartes
ou Questions peuvent référencer la même ressource.

## Relecture table par table

| Tables | Nullabilité et rôle | Contraintes retenues ou vérification métier |
| --- | --- | --- |
| `projects` | Identifiant, nom et version requis ; révision initialisée à zéro ; dates requises côté serveur ; références globales d’entrée/sortie requises et initialisées depuis la configuration. | La validation des noms non vides et des références de transition appartient aux commandes métier. |
| `chapters` | Les trois colonnes d’évaluation sont facultatives ; elles sont `NULL` pour un chapitre standard. Une limite `NULL` sur un chapitre Évaluation signifie essais illimités. | Le domaine vérifie que les réglages ne s’appliquent qu’au chapitre Évaluation et qu’ils respectent les valeurs autorisées. |
| `pages` | Nom et type requis ; rattachement au scénario stocké séparément. | Les types et les noms sont validés par la configuration et les commandes métier. |
| `scenario_entries` | Un ordre représente les pages et chapitres racine ou les pages d’un chapitre. | La cible unique et l’absence de chapitre imbriqué dans le POC sont validées par le domaine. Les index uniques imposent ordre et présence uniques. Le lien vers un chapitre parent est `NO ACTION`, afin de refuser la suppression d’un chapitre qui contient encore des pages. |
| `catalog_pages` | Une ligne signifie page disponible hors scénario. | L’ordre est unique ; l’exclusivité avec `scenario_entries` est validée dans la transaction métier. |
| `media_resources` | Nom, MIME et taille requis ; légende, SHA-256 et clé serveur facultatifs. Aucun `media_type` distinct. | Le domaine déduit image/vidéo depuis le MIME ; clé de stockage unique par projet quand elle existe ; l’empreinte identifie le contenu et la taille. Aucun octet n’est stocké ici. |
| `content_blocks` | Type et preset requis ; aucune référence média générique. | Type et preset autorisés viennent de la configuration et du domaine. |
| `content_block_placements` | Une ligne par bloc ; cible page, parent, ou aucune des deux pour le catalogue. `position` est facultative pour un enfant inline dont la position exacte est dans Tiptap. `duration_ms` et les références d’entrée/sortie sont des options de placement. | Le domaine valide la cible unique, la position requise selon le parent et les règles de durée. Il autorise un BDC Résultat sur une page Flux ou comme contenu unique d’une Diapo seulement si cette page appartient à un chapitre Évaluation. Pour une Carte Carousel, les références de transition nulles héritent du Carousel. Les index uniques garantissent l’ordre des séquences. Les liens page/parent sont `NO ACTION` : le nettoyage métier doit précéder la suppression de la cible. |
| `sections` | Titre facultatif ; JSON Tiptap et HTML projeté requis, y compris pour une Section vide ; références d’entrée/sortie facultatives pour ses Cartes enfants. | La validité du JSON Tiptap et les références d’ancre sont vérifiées par l’application. La Section déclare le contexte scroll ; aucune durée de lecture n’est stockée pour ses Cartes enfants. Les références nulles héritent du projet. |
| `questions`, `question_answers` | Titre et `media_id` d’illustration facultatifs ; type, énoncé, libellés et correction requis. | La clé étrangère interdit une illustration d’un autre projet. Le type et la valeur de correction sont validés par le domaine. Le nombre de réponses et le nombre de bonnes réponses sont également vérifiés par le domaine. |
| `evaluation_result_branches` | Message et action facultatifs ; branche requise. | Clé primaire empêche deux lignes pour la même branche ; la présence des deux branches et la validité de l’action sont vérifiées par le domaine. |
| `carousels` | Réglages actifs requis ; `repeat_count NULL` reprend le défaut de configuration ; références d’entrée/sortie facultatives. | Durée, ratio, nombre de répétitions et références de transition sont validés par la configuration et le domaine. Les références nulles héritent du projet. |
| `cards` | `media_id`, champs texte et légende facultatifs ; position d’image et ajustement requis. | La clé étrangère interdit un média d’un autre projet. Les limites de longueur et la compatibilité entre média et preset sont validées par le domaine. L’animation n’est pas stockée sur la Carte : elle dépend de son placement. |

Dans ce premier état, les contraintes `CHECK` sont écartées temporairement,
pas rejetées pour la base finale. Les clés primaires, les clés étrangères et
les index `UNIQUE` gardent leurs rôles relationnels ; les règles de valeur et
de cohérence référentielle sont validées par les commandes métier et la
persistance dans la transaction. Les emplacements autorisés selon le type de
BDC restent une whitelist d’interface, pas une contrainte SQL. Les index
`UNIQUE` imposent les ordres relationnels et le dédoublonnage média indiqués.
À la consolidation de la V1, il faudra revoir prudemment les contraintes
adaptées au moteur de base finalement retenu, sans supposer que les choix
propres à SQLite s’y transposent tels quels.

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
- un chapitre standard ne possède aucun réglage d’évaluation. Pour un chapitre
  Évaluation, les valeurs absentes sont remplacées par les défauts du domaine
  à l’écriture ; une limite `NULL` signifie essais illimités ;
- `content_blocks.content_block_type` correspond exactement à ses données de
  détail (`sections`, `questions`, `evaluation_result_branches`, `carousels` ou
  `cards`) ; image et vidéo ne sont pas des `content_block_type` ni une
  colonne `media_type`. La Carte ou la Question porte sa référence au média ;
  `mime_type` détermine son rendu ;
- chaque BDC a un seul emplacement relationnel : page, parent, ou catalogue.
  Pour un placement sous Section, le parent et l’ancre Tiptap désignent le même
  BDC ; la position dans le texte est portée par Tiptap. Pour un placement sous
  Carousel, `position` porte l’ordre des Cartes ;
- la whitelist auteur détermine les types et layouts proposés dans chaque
  contexte : ajout direct dans Flux ou Diapo, ajout inline dans une Section,
  ajout comme enfant d’un Carousel ou disponibilité au catalogue. La base ne
  duplique pas cette whitelist en types ou tables spécifiques ; la Diapo garde
  sa règle d’une seule entrée BDC directe ;
- une Question possède ses réponses requises et respecte la règle de correction
  de son type : une réponse juste pour Choix et Vrai/Faux, au moins une pour
  Choix multiple ;
- un BDC Résultat possède exactement les branches configurées Réussite et
  Échec ; les valeurs `action` appartiennent aux options déclarées ;
- les cartes respectent les invariants des presets : longueur maximale du
  message, zones et médias autorisés ;
- une Carte média conserve un seul BDC Carte, quel que soit son parent. Les
  réglages de révélation sont contextuels : les valeurs par défaut viennent du
  parent Section ou Carousel, et un éventuel remplacement de Carte est porté
  par son placement, jamais par la ressource média ;
- une Section référence seulement des BDC Carte affectés à cette Section comme
  parent, avec un layout et un média compatibles ; une Carte n’est ancrée qu’une
  fois dans le document riche ;
- une clé média correspond au nom de fichier stocké, tandis que le SHA-256 et
  la taille identifient le contenu réutilisable dans un projet ; le MIME
  conservé sur la ressource détermine le rendu image ou vidéo.

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

## Décisions retenues pour la première migration

1. **Identifiant et nom — décision pour le serveur local :** un projet est un
   `ElceDocument` v4 ; `project_id` et `name` correspondent à `ElceDocument.id`
   et `.name`. Le navigateur crée le document initial et `POST /api/projects`
   transmet sa valeur v4 au serveur. Le serveur ne possède pas de second
   constructeur de document. Cette correspondance reste simple tant que le
   modèle n’introduit pas d’entité Projet distincte.
2. **Placement des pages — fixé :** `scenario_entries` et `catalog_pages`
   remplacent les tableaux d’ordre et d’affectation du modèle en mémoire par
   des lignes relationnelles. Le dépôt reconstruit les ordres racine, les pages
   de chapitre et le catalogue à partir de ces lignes.
3. **Réglages du chapitre Évaluation — fixé :** seuil, limite d’essais et
   portée de reprise sont des colonnes facultatives de `chapters`. Une table
   1:1 ajouterait une jointure sans représenter un objet métier indépendant.
   Les réglages restent `NULL` pour les chapitres standards ; la limite `NULL`
   d’un chapitre Évaluation signifie essais illimités.
4. **Détails de contenu** — `sections`, `questions`, `carousels` et `cards`
   sont liées à `content_blocks` par clé étrangère. Les branches de résultat
   sont directement liées au BDC commun. La concordance avec le discriminateur
   `content_block_type` reste validée par le domaine dans la transaction ;
   ajouter des triggers SQLite n’est pas proposé à ce stade.
5. **Légendes** — `media_resources.media_caption` et `cards.caption` sont deux
   propriétés distinctes dans le modèle actuel : la première est la métadonnée
   du média, la seconde la légende du preset de carte.
6. **Diapo** — le modèle et le builder acceptent au plus un BDC direct parmi
   Carousel, Carte et Question, ainsi qu’un BDC Résultat dans un chapitre
   Évaluation. Le Carousel est proposé par défaut ; `page_type` distingue Flux
   et Diapo tandis que le type de chapitre porte le suivi d’évaluation. La
   spécification Diapo et ses tests couvrent cette représentation. L’intégration
   complète des issues au player reste un sujet séparé ; elle ne change pas la
   relation entre page, placement et BDC dans ce schéma. Le schéma garde un
   placement générique et n’encode pas la whitelist dans un `CHECK` ou un
   trigger.
7. **Révélation des Cartes — modèle fixé :** le dépôt
   d’une image ou vidéo crée une BDC Carte au layout « Photo ou vidéo plein
   cadre ». La durée de vue est sans objet pour une Carte placée seule dans un
   flux ; elle reste une propriété de l’entrée Carousel quand la Carte en est
   enfant. L’animation de révélation dépend du contexte : observation de
   visibilité au scroll dans une Section, transition d’entrée/sortie dans un
   Carousel. Les valeurs par défaut du projet sont les valeurs de repli ; un
   BDC parent peut les remplacer et un remplacement propre à une vue Carousel
   est porté par son placement. Une
   Carte déjà visible au chargement, notamment la première vue du Carousel,
   n’exécute pas l’animation d’entrée. Les valeurs restent des références vers
   des transitions déclarées en configuration, pas du CSS ou du JavaScript
   stocké en base. Le registre Capsule Automation, notamment
   `DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS`, fournit les références de transition
   du Carousel et du scroll ; le Carousel reprend son preset `fade`. La démo 5
   fournit le déclenchement de visibilité au scroll.
   L’icône superposée à l’image ouvre l’édition du layout et de ses
   paramètres. Les réglages d’animation individuels restent hérités ou pilotés
   par les presets du POC ; leur exposition dans l’interface est reportée.

Les décisions relationnelles et la frontière API sont fixées. L’API HTTP
accepte le document v4 structuré ; le dépôt SQLite le projette en tables
relationnelles dans une transaction. `ElceDocument.toJSON()` n’est jamais
stocké comme objet opaque ; seul le contenu riche généré par Tiptap est
conservé en JSON.

## Références consultées

- [Modèle de document Elcé](../specs/document-model-spec.md)
- [Édition d’une Section](../specs/section-editor-spec.md)
- [Bloc de contenu Question](../specs/question-bdc-spec.md)
- [BDC Carousel et BDC Carte](../specs/carousel-bdc-spec.md)
- [Évaluation d’un chapitre](../specs/chapter-evaluation-spec.md)
- [Plan de stockage local et synchronisation](../plan/2026-10-06-elce-local-first-synchronisation-plan.md)
