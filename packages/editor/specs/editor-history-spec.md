# Éditeur — historique documentaire

## Rôle

L'historique de session appartient à l'application Editor et porte les
snapshots `EditorScene` avant/après des commits documentaires. Il n'est stocké
ni dans SQLite, ni dans Elcé, ni dans CodPlay.

## Contrat

- `EditorActionsFacade` observe uniquement `documentCommitted` pour enregistrer
  une entrée. Un document inchangé, y compris un wrapper neuf de même valeur,
  ne crée pas d'étape.
- Une entrée conserve l'identité et le contenu des scènes avant/après, ainsi
  que les sélections associées. Les sélections sont copiées à l'enregistrement
  puis nettoyées à la restauration si un item ou un KF n'existe plus dans le
  document restauré.
- Une nouvelle édition après Undo vide la branche Redo. La session conserve au
  plus 100 commits.
- Le chargement ou remplacement documentaire remet l'historique de session à
  zéro. Une restauration Undo/Redo passe par `RESTORE_DOCUMENT` et le rebuild
  normal ; elle n'est pas enregistrée comme une nouvelle étape.
- Avant Undo ou Redo, `HISTORY_BOUNDARY` demande aux modules d'appliquer ou
  d'abandonner leur état en attente selon leur frontière existante. L'historique
  ne redéfinit pas leur cadence et n'ajoute pas de regroupement temporel.
- Sélection, seek, lecture, pause, preview, resize sans commit et no-op n'ajoutent
  pas d'étape. SQLite persiste le document restauré via son observation normale
  des changements documentaires ; elle ne conserve pas la pile Undo/Redo.
- Les commandes Undo/Redo, les raccourcis clavier et les boutons de menu
  utilisent la même façade applicative.

## Preuves

- [`tests/app/document-history.spec.ts`](../tests/app/document-history.spec.ts)
  couvre les snapshots avant/après, les no-op, la branche Redo, la limite de
  100 entrées, la copie et le nettoyage des sélections, et le reset.
- [`tests/decor-editor-bridge-integration-v2.spec.ts`](../tests/decor-editor-bridge-integration-v2.spec.ts)
  et [`tests/block-creation-v2.spec.ts`](../tests/block-creation-v2.spec.ts)
  vérifient Undo/Redo à travers les commandes et bridges réels de l'éditeur.
- [`tests/app/persistence/sqlite-editor-scene-persistence.spec.ts`](../tests/app/persistence/sqlite-editor-scene-persistence.spec.ts)
  vérifie la persistance des documents restaurés sans sérialiser la pile
  d'historique.
