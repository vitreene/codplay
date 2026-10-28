# Éditeur — blocs et placement racine

## Rôle

Le flux de création de blocs ajoute un item vide sur la scène. Le décor initial
permet ensuite de modifier son apparence. La création et le placement passent
par le contrôleur, les commandes de document et le Builder Éditeur existants.

## Contrat

- `bloc` est une valeur distincte d’`ItemType`. Un bloc n’a pas de `Content`,
  mais possède un décor initial modifiable.
- Le mode de placement est porté par la grille de `EditorScene.rootCapsule` :
  `1 × 1` (`transform`) place l’item par `Decor.offset` ; `90 rangées × 160
  colonnes` (`fine-grid`) place l’item dans une zone racine.
- En mode `transform`, le tracé libre produit un rectangle local, converti en
  unités `cqw` dans l’offset du décor.
- En mode `fine-grid`, le tracé s’accroche aux pistes et produit une zone racine
  et un bloc lié par `Decor.zoneId`, dans une transaction auteur. La zone porte
  la même géométrie dans ses surfaces portrait et paysage. Le Builder projette
  cette zone dans le champ `placement` de Capsule Automation.
- À la projection V2, le bloc reste un type d’item distinct et devient un perso
  `tag` initialisé comme `div`, sans propriété `content`.
- Le choix du mode racine précède le tracé. Le contrôleur conserve le mode
  choisi pendant le geste. Échap annule le tracé sans mutation ; une création
  réussie sélectionne le bloc et ouvre son décor.
- Le choix du mode racine est enregistré dans le document et survit au
  rechargement SQLite. Le tracé zone + bloc constitue une transaction unique
  dans l’historique existant et son Undo/Redo est vérifié. Une racine contenant
  des zones ne peut pas être remise en mode `1 × 1`.
- La palette du bloc expose Forme, Custom et Presets, sans Typo ni Contenu.

## Portée et preuves

Cette tranche ne crée pas d’items image, vidéo ou son et ne modifie pas CodPlay.
L’attachement de zone par keyframe n’est pas encore projeté par le Builder.

- `tests/block-creation-v2.spec.ts`,
  `tests/commands/root-placement-commands.spec.ts`,
  `tests/builder-v2/build-scene.spec.ts` et
  `tests/decor-editor-bridge-integration-v2.spec.ts` couvrent le flux document,
  le placement et le pont de décor.
- `tests/app/persistence/sqlite-editor-scene-persistence.spec.ts` couvre la
  restauration des documents et des dimensions de grille.
- Safari MCP a vérifié le tracé libre et grille, l’annulation, l’édition de
  décor, Undo/Redo et le rechargement SQLite. Le tracé y utilisait des
  `PointerEvent` synthétiques ; le geste physique reste à valider. Le statut
  global et les portes encore ouvertes sont suivis dans le
  [plan de création](./2026-10-28-editor-block-creation-plan.md).
