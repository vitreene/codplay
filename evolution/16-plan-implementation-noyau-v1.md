# Plan implementation noyau V1 (phase 1)

## 1) Positionnement

Ce document est la vue d'ensemble.

Le detail des lots est maintenant decoupe dans `evolution/lots/`.

Objectif phase 1:

- valider un systeme minimum fonctionnel
- mesurer la progression par tests lot par lot

Lots actifs:

- `evolution/lots/lot-01-timer-ticker.md`
- `evolution/lots/lot-02-events-pipeline.md`
- `evolution/lots/lot-03-animation-bridge.md`
- `evolution/lots/lot-04-create-element-minimal.md`
- `evolution/lots/lot-05-animation-properties-extensibility.md`
- `evolution/lots/lot-06-wait-flow-runtime.md`
- `evolution/lots/lot-07-list-plugin-diff-flip-fallback.md`
- `evolution/lots/lot-08-flip-engine-etude-spec.md`
- suivi progression: `evolution/lots/status.md`

Les lots 1 a 8 ne sont que le debut.
Les lots suivants seront ajoutes dans `evolution/lots/backlog.md`.

Notes post lots 05-08:

- le pipeline animation est agnostique: aucune allowlist de proprietes
- les cibles animees peuvent etre des nodes html-like ou des objets third-party
- le wait flow runtime couvre `parallel` et `suspendSource` avec reprise `fromCursor`/`fromStart`
- le plugin list couvre `diff + FLIP` avec fallback perf qui coupe les `move` en surcharge
- le moteur FLIP generique est implemente avec orchestration anti-flicker (`FIRST/LAST/INVERT/rAF/PLAY`)

## 2) Regles d'avancement

- ordre strict des lots
- chaque lot doit avoir ses tests DoD verts avant passage au suivant
- revue go/no-go a la fin de chaque lot

## 3) Structure de fichiers conseillee (phase 1)

```text
src/
  core/
    clock.ts
    ticker.ts
    events/
      flatten.ts
      sort.ts
      collect-window.ts
      dispatch.ts
  animation/
    adapter.ts
    derive-simple.ts
    run-batch.ts
  runtime/
    create-element.ts
    mount-elements.ts
    apply-actions.ts
  trace/
    trace-store.ts
tests/
  lot1/
    ticker.spec.ts
  lot2/
    events-pipeline.spec.ts
  lot3/
    animation-bridge.spec.ts
  lot4/
    minimal-e2e.spec.ts
  lot5/
    animation-properties-extensibility.spec.ts
  lot6/
    wait-flow-runtime.spec.ts
  lot7/
    list-plugin.spec.ts
  lot8/
    flip-engine.spec.ts
```
