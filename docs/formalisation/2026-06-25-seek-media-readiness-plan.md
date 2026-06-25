# Plan : reconstruction seek correcte via readiness media (au lieu d'éviter la réassignation src)

## Statut

Proposé le 2026-06-25. Fait suite au revert du fix « réapplication systématique du src » (qui réintroduisait le flicker). Nouvelle direction donnée par l'auteur.

**Volet A implémenté le 2026-06-25.** `applySplitCellsBefore` conditionne désormais le calcul du rectangle des cellules A à l'image prête (`complete && naturalWidth > 0`) ; sinon cellules provisoires corrigées au `load` (symétrie avec les cellules B). Refactor : `applyRectToCells` factorisée, `applyCellsBRect` l'utilise. Vérifié visuellement par l'auteur : **plus de flick**.

**Volet B (variante B2) tenté puis ANNULÉ le 2026-06-25.** Réappliquer le `src` dans `ImageComponent.render()` — même avec le volet A en place et `applyImageSource` idempotent — **réintroduit le flick et casse le seek** (constat visuel de l'auteur). Le volet A ne suffit donc pas à rendre la réapplication du `src` sûre : la cause du flick n'est pas seulement la lecture prématurée des dimensions, elle est aussi dans la réassignation du `src` elle-même pendant le seek (l'`<img>` repasse par un état non décodé visible / le seek est perturbé). Revert effectué : le gate `existingMediaNode === null` est conservé.

Conclusion : la reconstruction du `src` au seek arrière ne peut PAS se faire par une réapplication dans `render()`.

> **Note 2026-06-25 (final) : le commit différé décrit ci-dessous a été ANNULÉ.** L'auteur l'a jugé masquant, et il révélait un double-clone de transition au seek. La cause structurelle retenue : le `src` a un effet de bord (décodage), donc il ne peut pas se reset/replay comme un style → l'image sortait du cycle reset→replay. **Solution livrée = node-par-src en detach/attach** (cf. `2026-06-25-image-node-per-src-plan.md`, statut implémenté). Le volet A (lecture des dimensions conditionnée à l'image prête) reste livré et utile. La section ci-dessous est conservée pour historique.

**Commit différé (B1) — ANNULÉ (historique).** Règle de reconstruction : `src` au repos à t = dernier `replace` ≤ t, sinon `initial`. Mécanisme, sans churn :
- `ImageComponent.render()` au refresh (seek/rewind) ne réécrit PAS le `src` ; il pose un drapeau `srcReconstructPending = true`.
- `applyImageMediaState` lève le drapeau dès qu'un `src` est appliqué (mount, live, ou replace rejoué).
- Après le replay, le player appelle `renderer.commitSeekReconstruction()` → `orchestrator.commitSeekReconstruction()` → `component.commitSeek?.()`. `ImageComponent.commitSeek()` restaure le `src` initial **uniquement si** le drapeau est resté levé (aucun replace rejoué = région initiale). `setImageSource` étant idempotent, c'est un no-op si le `src` est déjà bon → **zéro réassignation en scrub stable, dans toutes les régions** (vérifié par test). Différence avec la tentative naïve : l'écriture de l'initial se fait APRÈS le replay et seulement si nécessaire, pas AVANT (qui causait la double écriture/frame).
- Câblage : `RuntimeComponent.commitSeek?()` (type), `ImageComponent.commitSeek`, `RuntimeComponentOrchestrator.commitSeekReconstruction`, `RendererFacade.commitSeekReconstruction`, appel dans `create-player.ts` seek() après le replay.

Tests (`tests/v1/seek-image-src.spec.ts`) : seek arrière restaure le `src` initial ; scrub stable région initiale → 0 réassignation ; scrub stable région post-mutation → 0 réassignation. Suite complète : 0 régression, gates 21/21.

**À confirmer visuellement par l'auteur** : seek→t=0 affiche l'image initiale, et toujours pas de flick (y compris en scrub à travers une frontière de mutation, où une seule écriture du `src` a lieu au franchissement).

La **node-par-src** reste l'architecture cible « pure » mais nécessite la réécriture du système de transition (clones/overlays bâtis sur la mutation du `src`, `apply-simple.ts` + 5 points `querySelector('img')`), visuellement risquée → repoussée en post-v1 (cf. `2026-06-25-image-node-per-src-plan.md`).

## Principe directeur (auteur)

> Lors d'un seek, **pas de souci à prendre le temps qu'un media soit prêt avant de l'afficher**, pour que le calcul de position soit exact. Le seek est assumé coûteux. Ce qu'on refuse : un **ordre de calcul prématuré** (lecture de dimensions sur un media non décodé → `naturalWidth=0`) et un **affichage incohérent**, qui casse le contrat **`play@t == seek@t`**.

Conséquence : on **autorise** la réassignation du `src` quand la reconstruction l'exige (seek arrière), et on résout le problème visuel/dimensionnel non pas en évitant la réassignation, mais en **gâtant toute lecture de dimensions et tout affichage dépendant sur la readiness du media**.

## Constat de code

- Le module `replace` a déjà un système de readiness **partiel et correct** :
  - `replace:initial-size` (`index.ts:134-149`) : si l'img n'est pas prête, fige une taille puis nettoie au `load`.
  - `replace:cells-rect-ready` (`index.ts:151-159`) + `applySplitCellsAfter` (`apply-split-cells.ts:215-241`) : B-cells corrigées via `tmpImg.load`.
  - `apply-simple.ts:140` : clone B corrigé au `load`.
  - Ces events sont émis en `persist-only` → matérialisés → rejoués au seek.
- **Trou** : `applySplitCellsBefore` (`apply-split-cells.ts:146-157`) lit `refEl.offsetWidth` et `imgEl.naturalWidth` **synchronement, sans gate de readiness**. Si l'image A n'est pas décodée à cet instant, `aRect` tombe dans le fallback étiré (`computeObjectFitRect:58-60`) et n'est **jamais corrigé** (contrairement aux B-cells). C'est le calcul prématuré.
- `ImageComponent.render()` préserve le `src` au refresh (gate `existingMediaNode === null`) → décodage stable mais **seek arrière ne reconstruit pas le src initial** (bug connu).

## Tension à résoudre

Le seek = reset(render) + replay. Réappliquer le src dans `render()` puis le replay le réécrit → 2 écritures/frame dans une région post-mutation → churn décodage → `naturalWidth=0`. C'est pourquoi le revert a été nécessaire.

## Approche proposée (2 volets)

### Volet A — readiness sur tout read de dimension media (le cœur de la demande)

1. `applySplitCellsBefore` : ne pas lire `naturalWidth` prématurément. Si `imgEl.complete && imgEl.naturalWidth > 0`, lire et construire `aRect` tout de suite ; sinon, construire les A-cells avec un placeholder ET corriger via `imgEl`'s `load`/`decode()` (symétrique aux B-cells), en émettant un event readiness matérialisable. Plus aucun `aRect` figé à 0.
2. Auditer les autres reads (`apply-simple.ts:36-37`, `apply-split-text.ts:44`, `replace/index.ts:54`) : ce sont des `offsetWidth` de layout (pas du décodage media) ; à garder tels quels sauf si dépendants d'un media non prêt.

### Volet B — reconstruction du src au seek, sans churn, ready-gatée

Objectif : `render()` doit aboutir au src reconstruit pour la cible de seek (initial surchargé par les replace ≤ cible), écrit **une seule fois**, puis l'affichage attend la readiness.

Deux implémentations possibles (à trancher) :

- **B1 — commit différé du src** : `render()` et `update()` ne touchent plus le DOM `src` directement pendant un batch de seek ; ils posent `pendingSrc`. Un point de **commit explicite après le replay** (nouveau hook player→renderer→composant, ou flush sur `syncAnimationsToTimeline`) écrit le `src` final une fois (idempotent), puis attend `img.decode()` avant de considérer la vue cohérente. Stable-region scrub → `pendingSrc` constant → 0 réassignation. Seek arrière → src initial restauré.
- **B2 — await decode dans le flux de seek** : garder reset+replay, mais après le replay, pour chaque img dont le `src` a changé, `await img.decode()` avant de finaliser le seek (la vue n'est figée qu'une fois prête). Plus simple à plomber (le seek est déjà async) mais ne supprime pas la double-écriture intra-batch (A puis B) — acceptable si on n'attend le decode qu'une fois, sur la valeur finale.

B1 est plus propre (zéro churn) mais touche l'archi (phase de commit). B2 est plus localisé mais garde une écriture transitoire.

## Invariants / contrats

- `play@t == seek@t` : l'état media affiché après seek('t') doit être identique à l'état atteint en lecture jusqu'à t (même src, mêmes dimensions calculées).
- Le seek reste dans une seule tâche synchrone **jusqu'au** point d'attente readiness explicite (l'attente decode est le seul yield autorisé, et il est volontaire / assumé coûteux).
- Aucune lecture de dimension media sur un node non `complete`.

## Tests

- `tests/v1/seek-image-src.spec.ts` (acceptance déjà écrit, en `it.skip`) : seek arrière restaure le src initial.
- Nouveau : stable-region scrub → 0 réassignation src (déjà couvert par le 2e cas du même fichier).
- Nouveau : A-cells ne tombent jamais dans le fallback étiré quand l'image décode après coup (readiness). Limite : jsdom ne décode pas → tester la logique de gate/branche, pas le décodage réel.
- Suite complète + gates lot7/8/18 obligatoires (chemin seek partagé).

## Point ouvert à valider avant implémentation

- Choix B1 (commit différé) vs B2 (await decode dans le seek).
- Périmètre du volet A : seulement `applySplitCellsBefore`, ou audit complet des reads.
