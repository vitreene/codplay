# Plan — builder Decor vers persos CodPlay

**Statut : A relire**
**Cible :** builder de l’éditeur vers CodPlay V2
**Dépendance :** ce chantier commence après la passe de correctifs et de stress-test du plan
[`2026-09-02-motion-editor-v2-plan.md`](./2026-09-02-motion-editor-v2-plan.md).

Ce document ouvre le chantier structurel demandé. Il ne modifie pas le builder actuel et ne
change pas le contrat des correctifs en cours.

## 1. Intention et limites

Le builder doit transformer certaines capacités de `Decor` en propriétés, actions ou services
portés par les persos CodPlay. Une spécification de capacité doit donc avoir un équivalent de
résolution au builder : par exemple la future résolution de `zone`, la résolution de `offset` pour
la pose, ou la résolution du `path` local au segment.

La granularité est celle des capacités du décor, pas celle d’une longue suite de conditions
propriété par propriété. `Decor.style` reste une carte ouverte : le builder ne doit pas maintenir
une whitelist CSS pour que `border` ou une propriété future puisse passer.

Hors périmètre de cette ouverture :

- modifier `packages/codplay` sans plan et autorisation dédiés ;
- créer une timeline par propriété ;
- matérialiser `zone` avant que sa spécification de projection soit validée ;
- déduire silencieusement un champ CodPlay lorsqu’aucune définition de capacité ne l’explique.

## 2. Architecture de référence à reprendre

L’architecture CodPlay existante fournit le patron à étudier, sans copier ses détails dans
l’éditeur :

1. `SceneBuilder.build()` normalise l’entrée ;
2. les gardes et le catalogue de capacités valident le document ;
3. la compilation dérive les artefacts et extrait les fonctions ;
4. les validateurs sémantiques vérifient le résultat compilé ;
5. l’artefact est gelé avant d’être remis au runtime.

Le futur builder Decor doit reprendre cette séparation des phases et la responsabilité des
définitions/catalogues de capacités de CodPlay. La résolution du décor reste côté éditeur tant
que l’éditeur possède `EditorScene`; la sortie doit être un `SceneDoc` V2 natif, puis passer par
`CodPlay.build()`.

## 3. Structure à valider

Le modèle à soumettre à relecture devra fournir :

- un catalogue ordonné de définitions de capacités Decor ;
- pour chaque définition : son identifiant de spécification, son canal (`pose`, `decor` ou
  segment-local), sa source dans `Decor`, son résolveur pur, son résultat projeté et ses règles de
  diagnostic ;
- une phase de résolution qui compose les contributions sans connaître les propriétés CSS une
  par une ;
- une phase de compilation qui transforme les contributions en `initial`, `actions`, `move` ou
  autre champ natif CodPlay selon le contrat de la capacité ;
- une validation qui signale une capacité déclarée mais non projetée, au lieu de la supprimer ;
- une sortie déterministe, indépendante du DOM et réutilisable pour Play, Seek et preview.

Les définitions initialement à instruire sont :

| Capacité | Canal | Sortie attendue | État dans le correctif actuel |
| --- | --- | --- | --- |
| carte `style` ouverte | décor | style/action CodPlay, sans whitelist CSS | déjà transportée ; `border` couvert par le stress-test |
| `classes` | décor | valeur initiale et delta `add/remove` | déjà transportée |
| `offset` | pose | valeurs de pose et interpolation | déjà transportée pour les champs exposés |
| `custom` | décor | déclarations CSS résolues selon sa spécification | déjà transportée vers le style |
| `path` | segment-local | `move.transition.path` cible, sans cascade | déjà transportée |
| `zone` | décor/placement | résolution définie par la spécification zone | différée et diagnostiquée |
| future capacité racine | selon sa spécification | sortie définie par sa propre résolution | conservée au bridge, pas encore projetée |

Ce tableau ne devient pas une whitelist : il décrit les capacités connues et les chantiers de
spécification. Une nouvelle capacité devra ajouter sa définition et ses tests, sans ajouter un cas
isolé dans chaque boucle du builder.

## 4. Découpage proposé

| Étape | Statut | Porte |
| --- | --- | --- |
| B0 — Inventaire et contrats | A relire | arrêter, pour chaque capacité, source, canal, valeur résolue, sortie CodPlay et comportement en absence |
| B1 — Modèle de définition | À faire | valider les types de définition, le catalogue, les diagnostics et les règles de composition |
| B2 — Résolutions par capacité | À faire | migrer une capacité à la fois, avec parité prouvée contre le builder actuel |
| B3 — Compilation temporelle | À faire | relier les contributions aux chaînes `pose`/`decor`, aux transitions et aux données segment-locales |
| B4 — Frontière CodPlay | À faire | passer la sortie par `CodPlay.build()`, ses validations et ses artefacts immuables |
| B5 — Stress et intégration | À faire | toutes les propriétés actuelles, propriétés CSS futures, Seek/Play, rebuild, persistance et diagnostics |

La première relecture porte sur B0/B1. Aucun refactoring du builder ne doit commencer tant que le
modèle de définition et la règle d’absence de projection ne sont pas acceptés.

## 5. Critères d’acceptation du chantier

- chaque capacité documentée possède une résolution identifiable et un test de sortie ;
- une nouvelle clé CSS n’exige pas de modifier une liste de propriétés ;
- une capacité racine future ne peut pas disparaître silencieusement : elle est projetée par sa
  définition ou produit un diagnostic explicite ;
- les canaux `pose`, `decor` et segment-local conservent leurs invariants temporels ;
- le résultat passe par le builder CodPlay réel et produit un artefact compilé accepté ;
- la résolution est pure, déterministe, testable sans DOM, et la preuve d’intégration couvre le
  chemin réel `build → runtime → seek/play → snapshot`.
