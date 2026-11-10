# Acceptation restante — Engine et Player V2

> Status: En cours — les comportements vérifiés sont dans la
> [spécification Engine/Player](../specs/engine-player-v2-spec.md). Le Seek
> groupé et le cycle de base sont couverts ; la réutilisation de l'état logique,
> le contrat complet de `schedule`, la politique de `rate` et certaines
> frontières de reprise restent à décider ou à certifier.
> CodPlay version: V2 foundation

Les surfaces façade, le cycle Engine/Player, `sequence:end`, le Seek groupé et
`RenderSync` ne sont plus décrits ici comme contrats. Ce plan conserve les
questions non résolues et les validations encore manquantes.

## Travail restant

- [ ] Définir puis vérifier le comportement de `SceneLifecycleOptions.schedule`
      en V2. Les callbacks reçoivent une fonction appelable, mais les tests ne
      certifient pas encore si elle doit rester sans effet ou programmer des
      occurrences.
- [ ] Tester directement `RuntimePlayer.play()` depuis l'état terminal
      `sequence:end`, sans appeler `reset()` au préalable, et vérifier le temps,
      le journal, les modules et les callbacks de cycle après redémarrage. Le
      chemin public `instance.telco.play()` après une fin d'inactivité est déjà
      exercé par `idle-config.spec.ts` ; il ne ferme pas cette gate du player.
- [ ] Préciser puis vérifier les effets terminaux sur les captures ouvertes et
      les modules actifs, ainsi que leur ordre par rapport à `onSequenceEnd`.
      N'étendre la spécification qu'après cette acceptation.
- [ ] Compléter les preuves de réutilisation logique et de présentation :
      endpoint d'action temporelle, changement d'état, morph possédé par un
      composant, Seek avant/arrière et parcours Play/Seek.
- [ ] Fixer et vérifier la politique du rate positif existant, avec RenderSync,
      les modules et les médias. La lecture arrière est une évolution séparée.
- [ ] Terminer l'acceptation transactionnelle du Seek lorsque la préparation
      motion par occurrence est finalisée dans le
      [plan de découverte motion](./motion-live-discovery-invalidation-plan.md)
      et le [plan d'intégration runner](./runner-flip-integration-study.md).

## Parcours de validation

Les cas player utilisent les tests existants
[`runtime-player.spec.ts`](../tests/runtime/player/runtime-player.spec.ts),
[`runtime-engine.spec.ts`](../tests/runtime/engine/runtime-engine.spec.ts) et
[`render-sync.spec.ts`](../tests/runtime/player/render-sync.spec.ts). Toute
validation de présentation doit ensuite passer par le runner réel et le chemin
Play/Seek concerné ; le test logique isolé ne clôt pas une intégration HTML.

Ne pas marquer ce plan `Fini` tant que tous les points ci-dessus ne sont pas
résolus ou explicitement retirés du périmètre V2.

Les nouveaux transports, la politique après Seek arrière et le live sans
journal sont séparés dans les [évolutions à affecter](./evolutions/evolution-backlog.md#extensions-du-transport-et-du-journal).
