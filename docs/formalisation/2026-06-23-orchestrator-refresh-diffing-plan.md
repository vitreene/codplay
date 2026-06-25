# Plan : diffing d'état par persona pour scoper le detach-all du refresh

## Statut

Non démarré. Planifié à la suite de l'investigation des régressions media/carousel du 2026-06-23 (voir `v1-seek-spec.md` — appendice "le detach-all du refresh est une fausse optimisation").

> **Révision 2026-06-25 — la justification anti-flicker du detach est abandonnée.** L'analyse initiale ci-dessous présentait le detach-all comme une protection anti-flicker à *scoper*. C'est faux : le reset→replay d'un `seek()` est atomique (une seule tâche JS synchrone, boucle de replay sans `await`), donc l'état intermédiaire n'est jamais peint et le detach ne masque rien. Le détach est une fausse optimisation qui casse le décodage media. Le fix prioritaire n'est plus de *scoper* le detach mais de le **retirer** (plan dédié : `2026-06-25-orchestrator-remove-detach-all-plan.md`). Ce plan-ci reste valable pour son objectif résiduel : **sauter le refresh des personas stables** (économie de travail), mais sans plus invoquer l'anti-flicker comme motif.

## Problème

`RuntimeComponentOrchestrator.loadPersos()` détache tous les nodes montés avant de rafraîchir chaque composant (`runtime-component-orchestrator.ts:413-418`), sur **chaque** `seek()`/`rewind()`/`rebuild()` — y compris pour les personas dont l'état résolu n'a pas changé depuis le dernier refresh.

Effet de bord confirmé : un scrubbing rapide (drag de slider) envoie un `seek()` par mouvement de pointeur, donc un cycle detach/refresh/reattach complet de **toute** la scène à chaque mouvement. Pour un `<img>`/`<video>` dont le décodage est en cours, des cycles trop rapprochés empêchent le navigateur de terminer le décodage — `naturalWidth`/`complete` restent à zéro même quand `src` n'est pas réassigné. Observé sur `replace-carousel-demo` (transition `replace: { split: 'cells' }`, qui lit `naturalWidth` en direct dans `apply-split-cells.ts`).

## Objectif

Scoper le detach/refresh/reattach aux personas dont l'état résolu (style/content/move/actions appliquées) a réellement changé entre l'ancien et le nouveau `runtimePersos`, en conservant la protection anti-flicker existante pour les personas qui changent réellement.

## Pistes déjà écartées ou déjà appliquées

- `mountRootNodes()` (`player.ts:116-122`) corrigé le 2026-06-23 pour ne plus refaire `replaceChildren()` quand la liste des root nodes n'a pas changé. Insuffisant seul — le detach-all par persona dans l'orchestrateur reste la cause dominante.
- Cache local de `naturalWidth`/`naturalHeight` dans `apply-split-cells.ts` : corrigerait le symptôme observé sans toucher au cycle global, mais ne traite pas la cause. Écarté comme solution définitive, gardé comme filet de sécurité possible si le diffing prend du retard.

## Pistes à explorer

1. **Diffing structurel par perso** : conserver une référence à l'état résolu précédent (`RuntimePersos.persos[id]`) et comparer (deep-equal ou hash) avant de détacher/rafraîchir. Si identique, skip entièrement (pas de detach, pas de refresh, pas de reattach) pour ce perso.
2. **Granularité de la comparaison** : déterminer si comparer `perso.initial`/`perso.actions` suffit, ou s'il faut aussi tenir compte de l'`update()` le plus récent appliqué (état vivant du composant, pas seulement l'état authored).
3. **Risque de régression** : ce chemin est emprunté par seek/rewind/rebuild/replay-after-end — donc par tous les gate tests (lot7, lot8, lot18) et la majorité des tests v1. Toute modification ici doit repasser l'intégralité de la suite, pas seulement les lots ciblés.

## Points ouverts

- Faut-il differ niveau perso entier, ou niveau propriété (style vs content vs move) pour permettre un refresh partiel encore plus fin ?
- Le mécanisme anti-flicker actuel (detach avant boucle) suppose que TOUT changement potentiel est invisible pendant le batch. Un diffing partiel doit préserver cette garantie pour les personas qui changent réellement, sinon on réintroduit le flicker pour eux.
