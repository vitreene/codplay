# Scenario 01 - Changement de story sur click utilisateur

## Intention

Un click utilisateur provoque un changement de story via le scenario.

Exemple: passage de `story-intro` vers `story-quiz` apres click sur un bouton `next`.

## Preconditions

- story courante visible: `story-intro#1`
- player global en etat `playing`
- scenario node courant: `intro`
- transition scenario definie:

```ts
{
  id: "intro",
  storyId: "story-intro",
  transitions: [
    {
      toNodeId: "quiz",
      priority: 100,
      when: { event: "pointer:click", where: { targetId: "btn-next" } }
    }
  ]
}
```

## Sequence runtime

1. UI emet `event.emitUser('pointer:click', { targetId: 'btn-next' })`
2. runtime cree un `TimelineEvent` source `user` (recordable selon policy)
3. PlayerMachine valide l'event (etat global stable)
4. Scenario evale les transitions du node `intro` (priority desc)
5. transition `intro -> quiz` est selectionnee
6. runtime execute `onExit` du node `intro` (si present)
7. runtime execute commandes de changement de story:
   - `stopStory(story-intro#1)`
   - `startStory(story-quiz#1)`
   - `showStory(story-quiz#1)` si necessaire
   - `hideStory(story-intro#1)` si necessaire
8. runtime execute `onEnter` du node `quiz` (si present)
9. node scenario courant devient `quiz`

## Traces attendues (ordre logique)

```text
user-track event=pointer:click                               status=APPLIED
scenario:transition:selected fromNodeId=intro toNodeId=quiz  status=APPLIED
scenario:stop-story storyRef=story-intro#1                  status=APPLIED
story:stopped storyRef=story-intro#1                        status=APPLIED
scenario:start-story storyRef=story-quiz#1                  status=APPLIED
story:started storyRef=story-quiz#1                         status=APPLIED
```

## Variante utile

Si le player est `paused`, le changement de story reste autorise (transition scenario),
mais les medias de la nouvelle story restent logiquement en `paused` tant que `play`
global n'est pas rejoue.

## Points de vigilance

- ne pas recreer de nodes en `rebuild=state`
- conserver la priorite des commandes globales player sur les medias
- garder les noms d'events metier libres (pas de prefixes reserves runtime)
