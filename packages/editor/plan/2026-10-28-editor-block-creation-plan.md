# Éditeur — création et décor des blocs

**Statut : En cours.** Périmètre accepté le 28 octobre 2026. Le chantier couvre
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
  contrat accepté dans le
  [plan SQLite](./2026-10-28-editor-sqlite-persistence-plan.md).
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
| 1. Tracé V2 | `packages/authoring/selection-frame/src/v2*` : ajouter l’overlay de création libre/grille, aperçu, émission au relâché et annulation ; documenter le contrat V2 séparément du contrat V1. | 210 tests passent, 1 est ignoré ; le typecheck ciblé strict passe. Le typecheck complet du package reste bloqué par l’erreur TS2306 préexistante dans CodPlay (`typed-om-polyfill/build/index.d.ts`). |
| 2. Raccord Éditeur | Contrôleur/façade, commandes de grille et de zone, `EditorMenuRegion`, `decor-editor-bridge`, `decor-editor` et `builder-v2` : relier le choix de grille et le tracé au mode `creating` existant, créer/sélectionner un bloc, activer son décor et matérialiser ses zones racine via Capsule Automation. | 73 tests ciblés passent ; typecheck et build Éditeur passent. Safari MCP valide avec des `PointerEvent` synthétiques le tracé libre et grille, l’annulation, la palette et l’édition de décor, Undo/Redo et restauration SQLite. Le geste natif reste à valider : l’inventaire Safari MCP expose clics, saisie et touches, sans action de glisser-déposer. La suite complète a un échec de présentation en fin de lecture, reproduit à HEAD propre et suivi au plan Remix. Vérifier que `packages/codplay` n’a aucun changement. |

Les spécifications propriétaires sont mises à jour seulement après validation
du comportement correspondant. Garder ce plan `En cours` tant qu’une porte
d’acceptation reste ouverte.
