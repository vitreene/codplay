# Scenario 02 - Click utilisateur sans transition valide

## Intention

Un click est bien recu mais ne correspond a aucune transition scenario.

Le moteur doit rester stable et tracer le non-changement explicitement.

## Preconditions

- scenario node courant: `intro`
- transition disponible: uniquement `pointer:click` avec `targetId='btn-next'`
- click recu: `targetId='btn-help'`

## Sequence runtime

1. UI emet `event.emitUser('pointer:click', { targetId: 'btn-help' })`
2. runtime enregistre l'event utilisateur (si policy recordable)
3. scenario evalue les transitions du node courant
4. aucune condition `when` ne matche
5. pas de changement de story, pas de changement de node scenario

## Traces attendues

```text
user-track event=pointer:click                          status=APPLIED
scenario:transition:none nodeId=intro eventName=pointer:click status=APPLIED
```

## Resultat attendu

- story courante inchangee
- etat player inchange
- runtime deterministe (aucun side-effect cache)
