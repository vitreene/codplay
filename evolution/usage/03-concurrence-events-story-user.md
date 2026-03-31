# Scenario 03 - Concurrence event story et event user au meme tick

## Intention

Verifier l'ordre deterministe quand un event story et un click user tombent au meme `ms`.

## Preconditions

- meme `ms` cible: 5400
- event story present sur track story active
- event user `pointer:click` emis au meme `ms`
- regle d'ordre globale active (`ms`, `track.order`, `index`, user apres story/system a egalite)

## Sequence runtime

1. collect des events dans la fenetre `(prevMs, nowMs + margin]`
2. tri global applique
3. event story est traite en premier (si egalite complete)
4. event user est traite ensuite
5. scenario evalue chaque event dans cet ordre

## Traces attendues (extrait)

```text
QUEUE event=story:... ms=5400 order=10 index=42 source=story
QUEUE event=pointer:click ms=5400 order=10 index=43 source=user
scenario:transition:selected ... status=APPLIED
user-track event=pointer:click status=APPLIED
```

## Resultat attendu

- ordre stable entre runs
- pas d'inversion aleatoire story/user
- comportement reproductible en debug et en player
