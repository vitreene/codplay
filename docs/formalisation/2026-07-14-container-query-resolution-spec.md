# Résolution des unités container-query (`cqw`/`cqh`/`cqi`/`cqb`/`cqmin`/`cqmax`) — spec

## Statut

Spec normative. Corrige une violation identifiée dans l'implémentation actuelle
(`packages/codplay/src/runtime/components/lib/container-query-units.ts`), qui résout le
conteneur de requête par `node.closest('.ac-scene-root')` — une traversée DOM directe sans
ancrage dans le modèle perso/story/scene. Réf. délibération antérieure (à corriger) :
`packages/codplay/plan/notes/2026-07-14-container-query-unit-resolution-deliberation.md`,
section « Pourquoi le conteneur de requête n'a pas besoin d'être découvert par un paramètre
injecté ni un parcours DOM générique ».

## Objectif

Fixer comment le runtime `codplay` résout une valeur exprimée en unité container-query
(`cqw`, `cqh`, `cqi`, `cqb`, `cqmin`, `cqmax`) vers un px explicite, sans jamais interroger le
DOM monté pour retrouver une relation structurelle déjà connue par ailleurs.

## Principe directeur

Codplay est un routeur d'events, pas un explorateur DOM. Toute relation structurelle
(parent, conteneur, root) exploitée au runtime doit être connue depuis le modèle perso/story/
scene — jamais redécouverte par une requête DOM (`closest`, `querySelector`, remontée
d'ancêtres) au moment de l'usage.

Ce principe est déjà établi ailleurs dans ce dépôt pour le même problème de fond (conversion
cqw ↔ px) : `2026-07-07-text-auto-size-spec.md` §3.1 et §3.3 imposent qu'une conversion cqw
reçoive sa largeur de référence en paramètre explicite (`referenceWidthPx`), sans jamais la
déduire d'une lecture DOM en direct. Cette spec applique le même principe côté runtime
`codplay`, avec un mécanisme d'obtention différent (voir plus bas) car le contexte d'exécution
diffère (runtime monté vs environnement de mesure hors-écran).

## Règles normatives

1. Le conteneur de requête (l'élément porteur de `container-type`, aujourd'hui matérialisé
   par la classe `.ac-scene-root` posée par `build-grid.ts`) correspond au perso root — celui
   dont le `move` (perso et story) résout à `'@root'`, déjà calculé au build dans
   `CompiledScene.rootNodeIds` (`v1-invariants.md`, « Invariants de diffusion »).
2. Le runtime résout ce conteneur **une seule fois**, à l'initialisation de la story/scene —
   jamais recalculé à chaque appel de résolution d'une valeur cqw. Le résultat (le node, ou sa
   dimension mesurée) est mis à disposition via le registre runtime existant
   (`nodeByPersoId`/`getNodeById`, `packages/codplay/src/runtime/components/runtime-component-orchestrator.ts`)
   — pas redécouvert par traversée DOM à chaque usage.
3. Si l'élément identifié comme conteneur de requête ne porte pas encore `container-type`
   (ex. absence côté CSS auteur), le runtime l'assure lui-même à ce même moment d'init — une
   fois, pas à chaque résolution.
4. `resolveContainerQueryValue` (ou son équivalent renommé) ne fait plus de traversée DOM
   (`closest`) pour retrouver son conteneur : il consulte le résultat déjà résolu à l'étape 2.
5. Le détail d'implémentation exact (comment le persoId courant transite jusqu'au point
   d'appel, où vit le cache de résolution, quelle forme prend l'API interne) n'est pas fixé
   normativement ici — c'est un choix d'implémentation, tant que les règles 1 à 4 sont
   respectées : la source de vérité est le modèle perso/story (root connu au build/init), la
   résolution est faite une fois, jamais par traversée DOM répétée au runtime.

## Ce que cette spec ne couvre pas

- Le calcul arithmétique lui-même (`valeur / 100 × dimensionConteneurPx`) n'est pas remis en
  cause — seule la façon d'obtenir `dimensionConteneurPx` (ou le node dont elle dérive) change.
- La gestion du resize du mount target en cours de lecture reste hors périmètre (cf.
  `v1-hypothese-layout-volatile-resize-minimal.md`, hypothèse non adoptée) — le conteneur de
  requête est aujourd'hui stable pendant une session de lecture active.

## Invariant à retenir

- le moteur ne découvre jamais une relation structurelle (parent, conteneur, root) par une
  requête ou un parcours DOM (`closest`, `querySelector`) ; toute relation de ce type est
  connue depuis le modèle perso/story déjà résolu (`move`, `rootNodeIds`) et exposée via le
  registre runtime (`nodeByPersoId`).
