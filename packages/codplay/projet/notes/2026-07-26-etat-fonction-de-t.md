# L'état de scène comme fonction du temps — rationale V2

> Rationale mise à jour le 2026-09-26. Les contrats sont dans les
> spécifications liées ci-dessous ; les décisions de transport non prises sont
> suivies par le [plan Player](../../plan/player-engine-plan.md).

## Modèle

Pour une scène et un temps logique donnés, CodPlay cherche à produire le même
état sans dépendre du chemin de lecture qui a mené à ce temps :

```text
état = f(scène, temps logique)
```

Les faits temporels journalisés font partie de l'entrée de cette évaluation.
Les événements et sorties de straps sont des données à reconstruire ; le Seek
ne relance pas le code des straps. Les valeurs continues sont résolues depuis
le temps demandé. Les placements discrets sont déterminés par leurs frontières
temporelles. Les captures persistantes deviennent des faits journalisés après
leur production live. Un effet externe n'est pas relancé par sa seule
reconstruction.

Ce modèle explique pourquoi Play et Seek partagent le pipeline logique et
pourquoi la présentation ne doit pas devenir une source de vérité. Il ne
prescrit ni un store mutable global, ni un type d'action auteur nouveau.

## Contrats actuels

- Le dispatch, la journalisation, les sorties des straps et le reset logique
  sont définis dans la [spécification événementielle](../../specs/event-pipeline-v2-spec.md).
- Le passage des faits journalisés à l'état logique et la séparation avec la
  présentation sont décrits par la
  [spécification de reconstruction](../../specs/runtime-reconstruction-v2-spec.md).
- Les calculs ACE vérifiés et les possibilités d'exposition auteur restent
  séparés dans la [spécification ACE](../../specs/ace-calculation-v2-spec.md)
  et le [plan ActionSequence/TweenAction](../../plan/action-sequence-tween-plan.md).

## Questions encore ouvertes

La note explorait aussi une lecture bornée `[t1, t2]` et une politique de
conservation ou d'effacement des événements utilisateur situés après un Seek
arrière. Aucune forme d'API ni sémantique n'est adoptée. Ces deux décisions et
leur parcours d'acceptation sont maintenant suivis dans le
[plan Player](../../plan/player-engine-plan.md).
