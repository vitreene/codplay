# Éditeur — création et décor des blocs

**Statut : En cours.** Périmètre accepté le 28 octobre 2026. Au 31 octobre,
les tests, typechecks ciblés et build Editor sont verts ; le geste natif reste
la dernière preuve d’interaction de cette tranche. Le chantier couvre
le tracé V2 puis son raccord à l’Éditeur. Il ne modifie pas
`packages/codplay` et ne crée pas d’items image, vidéo ou son.

## Décisions applicables

- Le type `bloc` reste un item vide sans contenu ; il peut recevoir un décor.
- Le mode de placement est un réglage explicite de la capsule racine, dans
  `EditorScene.rootCapsule.grid` : `1 × 1` utilise les transforms du décor ;
  `90 rangées × 160 colonnes` utilise une zone dont les pistes déterminent la
  position et les spans déterminent les dimensions. Le choix du mode est une
  commande auteur distincte ; il précède le tracé et laisse au player le temps
  d’actualiser le rapport de scène. Le mode racine et les zones suivent le
  contrat décrit dans la
  [spécification SQLite](./2026-10-28-editor-sqlite-persistence-spec.md).
- Le tracé V2 rend des coordonnées locales de la surface. Les rectangles libres
  sont convertis en `cqw` avant écriture ; aucune mesure par
  `getBoundingClientRect()` n’est ajoutée.
- Une création sur grille écrit ensemble la zone racine, l’item et son attache
  `Decor.zoneId`, dans une transaction d’historique. Un mode racine qui a déjà
  des zones ne peut pas être réduit à `1 × 1`, car cela réinterpréterait leurs
  spans.
- Le Builder Éditeur transmet les coordonnées de cette zone au champ
  `placement` existant de Capsule Automation. Aucun circuit de placement
  parallèle n’est créé.
- La palette d’un bloc montre Forme, Custom et Presets ; elle ne montre ni Typo
  ni Contenu.

## Actions ordonnées

| Étape | Propriétaires et remplacement | Porte d’acceptation |
|---|---|---|
| 1. Tracé V2 | `packages/authoring/selection-frame/src/v2*` : ajouter l’overlay de création libre/grille, aperçu, émission au relâché et annulation ; documenter le contrat V2 séparément du contrat V1. | 210 tests passent, 1 est ignoré ; le typecheck strict ciblé `src/v2.ts` passe. Le typecheck complet du package échoue sur TS2306 dans `codplay-v1/src/runtime/components/lib/container-query-units.ts`, qui importe `typed-om-polyfill/build/index.d.ts`. Aucun changement CodPlay n’est autorisé pour contourner ce problème de typecheck hérité. |
| 2. Raccord Éditeur | Contrôleur/façade, commandes de grille et de zone, `EditorMenuRegion`, `decor-editor-bridge`, `decor-editor` et `builder-v2` : relier le choix de grille et le tracé au mode `creating` existant, créer/sélectionner un bloc, activer son décor et matérialiser ses zones racine via Capsule Automation. | 533 tests sur 50 fichiers, typecheck et build Éditeur passent. La fixture [`tests/browser/block-creation.html`](../tests/browser/block-creation.html) compose l’acteur, les bridges et le player V2 dans un document mémoire, sans adaptateur SQLite ; son typecheck strict passe. Le geste physique libre/grille reste à effectuer dans Safari : l’inventaire MCP expose clics, saisie et touches, sans glisser-déposer natif. Les preuves SQLite déjà acquises restent séparées. Vérifier qu’aucun fichier `packages/codplay` n’a changé. |

Les spécifications propriétaires sont mises à jour seulement après validation
du comportement correspondant. Garder ce plan `En cours` tant qu’une porte
d’acceptation reste ouverte.
