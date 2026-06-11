# Scenario 04 - Story d'attente `eventOnly` en parallele puis reprise

## Intention

Modeliser un flux frequent:

- une story principale avance sur timeline
- un click ouvre une story d'attente sans timeline
- un second click ferme l'attente et reprend la story principale

## Preconditions

- `story-main#1` en `clockMode='timeline'`, etat `playing`
- `story-wait#1` en `clockMode='eventOnly'`, etat `idle`
- tracks de `story-main#1` actives
- des events systeme peuvent continuer (ex: reminder, animations)

## Sequence API recommandee

1. click utilisateur `pointer:click` (target `btn-open-wait`)
2. `scenario.startWait({ fromStory, waitStory, mode: 'parallel' })`
3. story wait visible et active; story main continue
4. click utilisateur `pointer:click` (target `btn-resume`)
5. `scenario.resolveWait({ waitId })`
6. story wait se ferme; story main reste en continuite

## Effets attendus

- progression temporelle continue de `story-main#1` pendant l'attente
- animations/system events possibles pendant la phase d'attente
- aucune operation de rattrapage necessaire a la reprise (mode parallele)

## Traces attendues (extrait)

```text
scenario:wait:start mode=parallel waitId=...
story:started storyRef=story-wait#1
scenario:wait:started waitId=... mode=parallel

scenario:wait:resolve waitId=...
story:ended storyRef=story-wait#1
scenario:wait:resolved waitId=...
```
