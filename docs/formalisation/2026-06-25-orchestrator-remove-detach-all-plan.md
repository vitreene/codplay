# Plan : retirer le detach-all du refresh d'orchestrateur (fausse optimisation)

## Statut

Non démarré. Fait suite à l'analyse du 2026-06-25 (cf. `v1-seek-spec.md` — appendice « le detach-all du refresh est une fausse optimisation »). Remplace, sur le volet anti-flicker, le plan `2026-06-23-orchestrator-refresh-diffing-plan.md` (qui reste valable pour son objectif résiduel : sauter le refresh des personas stables).

## Problème

`RuntimeComponentOrchestrator.loadPersos()` détache **tous** les nodes montés du DOM avant de rafraîchir chaque composant, à chaque `seek()`/`rewind()`/`rebuild()` :

- detach global pré-boucle : `runtime-component-orchestrator.ts:413-418`
- detach par perso dans le refresh : `:476` (avant ré-init) et `:485` (après ré-init, avant store)
- detach par perso au mount : `:509`

Ce detach a été justifié comme une protection anti-flicker. **C'est faux.** Le reset→replay d'un `seek()` est atomique : `loadPersos` → reattach → `replayDueTimelineEventsForSeek` (boucle sans `await`, `create-player.ts:1215-1251`) → `syncAnimationsToTimeline`, le tout dans une seule tâche JS synchrone. Le navigateur ne peint qu'en fin de tâche → l'état intermédiaire (node remis à son état initial avant replay) n'est **jamais** peint. Le detach ne masque donc rien.

En revanche il **casse activement** le décodage media : un cycle `removeChild`/`appendChild` sur un `<img>`/`<video>` interrompt le pipeline de décodage. Sous scrubbing (un `seek()` par `pointermove`), `naturalWidth`/`complete` restent à 0 → `apply-split-cells.ts:155` lit 0 → fallback `computeObjectFitRect` (`:58-60`) qui étire l'image → cellules faussées, flick. Observé sur `replace-carousel-demo`.

## Invariant réel à préserver

> **Le reset (`loadPersos`) et le replay (`replayDueTimelineEventsForSeek` + `syncAnimationsToTimeline`) d'un même `seek()`/`rewind()`/`rebuild()` doivent rester dans une seule tâche JS synchrone : aucun `await`, `requestAnimationFrame`, `img.decode()` ou autre yield au navigateur entre le début de `loadPersos` et le `syncAnimationsToTimeline` final.**

C'est cet invariant — « refresh entre deux repaints » — qui remplace le detach. Il est aujourd'hui respecté de fait ; il faut le rendre explicite (commentaire + garde de test) pour qu'une régression future ne le casse pas silencieusement.

## Objectif

Retirer le detach-all (et les detach par perso associés) sans réintroduire de flicker ni casser l'ordre DOM, et rendre l'invariant ci-dessus explicite et testé.

## Ce qui rend le retrait sûr (à vérifier, pas à supposer)

L'ordre DOM est aujourd'hui reconstruit **à chaque** `loadPersos`, indépendamment du detach :
- chaque perso non-entry portant un `move` est ré-`appendChild` dans l'ordre d'itération via `runHook("onInitialPerso")` (`:445-460`) ;
- chaque story entry est ré-`appendChild` via `mountStoryEntriesToStoryHosts` (`:936-964`).

`appendChild` sur un node déjà attaché le **déplace** en fin de parent. Réappliqué dans l'ordre pour tous les enfants, il reproduit l'ordre final correct même sans detach préalable. **Hypothèse à valider en étape 1** : aucun perso monté n'échappe à cette passe de ré-append (sinon son ordre pourrait dériver une fois le detach retiré).

## Étapes

### 1. Vérification préalable (aucune modif)
- Confirmer que tout node monté est ré-`appendChild` à chaque `loadPersos` (move-pass + entries-pass). Lister les cas où un perso monté n'a ni `move` ni statut d'entry → vérifier leur parent.
- Confirmer qu'aucun chemin `seek`/`rewind`/`rebuild` n'insère de yield entre `loadPersos` et `syncAnimationsToTimeline` (grep `await`/`rAF` sur le bloc concerné). Aujourd'hui : OK, à figer par test.

### 2. Retrait du detach-all
- Supprimer la boucle de pré-detach global `:413-418`.
- Dans `refreshLoadedRuntimeComponent` : supprimer le detach `:476` et le detach `:485`. Le node est réutilisé en place ; `resetRuntimeNodeStyleState` + replay suffisent.
- Dans `mountLoadedRuntimeComponent` : le detach `:509` ne concerne qu'un node fraîchement monté (jamais encore dans le DOM) — l'évaluer séparément ; a priori un no-op à retirer aussi, mais sans impact media.
- Remplacer le commentaire `:413-415` par la formulation de l'invariant réel.

### 3. Rendre l'invariant explicite et testé
- Commentaire à la jonction `loadPersos` → replay dans `create-player.ts` : « reset+replay atomiques sur une tâche, ne pas insérer de yield ».
- Test de non-régression : un `seek()` ne doit produire aucune frame intermédiaire — vérifier qu'entre le reset et le replay aucune `await` n'est franchie (test structurel : la boucle de replay reste synchrone ; ou test comportemental : un compteur de paints/`rAF` reste à 0 pendant le batch).

### 4. Test média décodage non interrompu
- Test ciblé `replace-carousel` / split-cells : après une série de `seek()` rapprochés sur un perso `img`, `naturalWidth` du node reste non nul (le node n'est jamais détaché). Vérifier que `computeObjectFitRect` ne tombe pas dans le fallback `:58-60`.
- Filet complémentaire (optionnel, séparé) : corriger aussi l'asymétrie A-cells / B-cells dans `apply-split-cells.ts` (seules les B-cells ont une correction async via `tmpImg.load` `:215-241` ; les A-cells gardent un `aRect` figé). Hors scope strict du detach, à traiter à part si le symptôme subsiste.

### 5. Suite complète
- `loadPersos` est sur le chemin de seek/rewind/rebuild/replay-after-end → tous les gate tests (lot7, lot8, lot18) + majorité des tests v1. **Repasser l'intégralité de la suite**, pas seulement les lots ciblés (`npm run test`).
- Vérifier visuellement les démos `replace-carousel`, `carousel`, et au moins une démo media + une démo layout imbriqué au scrub.

## Risques

- **Ordre DOM** : si l'hypothèse de l'étape 1 est fausse (un perso monté non ré-appendé), retirer le detach peut laisser un node à une position périmée. Mitigation : test d'ordre DOM après seek sur scène à layout imbriqué.
- **Composants à structure interne reconstruite** (list, parts) : vérifier que `buildNode` en mode template réutilise bien le node sans réinsérer d'enfants (`base-component.ts:56-69` : ne touche pas aux enfants). RAS attendu.
- **Invariant fragile** : tout futur `await img.decode()` ou `rAF` ajouté dans le refresh réintroduirait le flicker que le detach prétendait couvrir. D'où la garde de l'étape 3.

## Relation aux autres plans

- `2026-06-23-orchestrator-refresh-diffing-plan.md` : diffing par persona pour **sauter** le refresh des stables. Indépendant et complémentaire ; sa justification anti-flicker est caduque (révisée). Peut être implémenté après, comme optimisation de charge.
- `2026-06-23-declarative-mutation-keys-plan.md` : sans rapport direct.
