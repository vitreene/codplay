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

L'étude exploratoire d'une construction live sans journal n'est pas retenue
comme décision ni comme tâche d'acceptation V2 dans ce plan. La règle V2 reste
la reconstruction depuis le journal ; l'étude est conservée dans la
[note dédiée](./notes/2026-09-23-construction-live-non-reconstructible.md)
pour un arbitrage ultérieur. Elle ne rouvre pas le contrat scroll.

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
- [ ] Décider si le transport V2 doit proposer une lecture bornée d'un intervalle
      `[t1, t2]`. Aucune API, règle de fin, synchronisation média ou politique
      pour les effets antérieurs à `t1` n'est arrêtée ; préciser le périmètre et
      son acceptance path avant toute implémentation.
- [ ] Décider du sort des événements d'origine utilisateur déjà journalisés
      après un Seek arrière : les conserver pour le prochain Play, les retirer,
      ou définir une autre règle d'auteur. Aucun champ de piste tel que
      `onSeekBack` n'est adopté. L'acceptation devra couvrir une interaction
      future sur une track story et sur une track scène, puis Seek arrière,
      Play et nouvelle interaction.
- [ ] Fixer le contrat du `rate` de lecture et décider si la lecture arrière
      fait partie de V2. Le code actuel refuse les valeurs non positives, mais
      la spécification Engine/Player ne certifie pas encore cette politique ni
      son interaction avec `RenderSync`, les modules et les médias ; la
      présence de `setRate()` ne suffit pas à définir le contrat.
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
