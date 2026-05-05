# Runtime policy events V1 - garde-fous execution

## Statut

Spec normative V1 pour les policies runtime de validation et de limitation des events.

## Objectif

Poser un cadre minimal de garde-fous runtime, volontairement succinct en V1, puis affiner apres mises en pratique et tests reels.

## Domaine

Cette policy s'applique aux events:

- entrants (`Player.emit`, `Perso.emit`)
- produits par `listen.emit[]`
- produits par `Strap` (immediat ou helper)
- produits par `player.schedule.*`

## Contrat de policy

```ts
type RuntimeEventPolicy = {
  maxEventsPerTick?: number
  maxCascadeDepth?: number
  sameTickHandling?: {
    mode: "keep-all" | "coalesce-last" | "defer-next-tick"
    key?: "name" | "name+data"
    eventNames?: string[]
  }
  strapErrorHandling?: {
    mode: "continue-with-warning" | "stop-chain"
  }
  rejectUnknownPersoTarget?: boolean
  rejectInvalidPayload?: boolean
}
```

## Regles normatives

1. Niveau V1

- la policy runtime events est minimale en V1.
- aucun seuil chiffre n'est impose en V1.
- les seuils et limites precis seront figes apres premiers usages et tests.

2. Comportement par defaut V1

- cible perso inconnue: warning par defaut.
- payload invalide: warning par defaut.
- erreur strap: `continue-with-warning` par defaut.
- les modes "rejet strict" restent activables via policy.

3. Evenements repetes meme tick

- mode par defaut V1: `keep-all`.
- le runtime preserve tous les events, y compris repetitions meme tick.
- les repetitions meme tick sont tracees en warning d'observabilite.
- `coalesce-last` et `defer-next-tick` sont des modes opt-in explicites.
- l'opt-in se fait par policy, idealement ciblee par `eventNames`.
- cette regle couvre aussi les collisions entre events produits par `straps` et `emit` dans un meme tick.

4. Determinisme

- les garde-fous ne cassent pas l'ordre canonique runtime.
- les decisions policy restent deterministes a entree identique.

5. Observabilite minimale

- chaque decision policy trace: `eventId`, `eventSeq`, `decision`, `code`.
- `decision` prend une des valeurs: `applied` | `rejected` | `ignored`.

6. Codes

- `AUTHOR_*`: erreurs de structure auteur a la compilation
- `RUNTIME_*`: rejets ou degradations d'execution
- `HOST_*`: erreurs d'appel facade publique

## Invariants policy V1

- policy minimale en V1, sans sur-anticipation de seuils.
- warnings privilegies par defaut sur les cas invalides runtime.
- toute evolution des seuils se base sur tests et usages reels.

## Piste post-V1 - mode optimum events utilisateur

- les events utilisateur a haute frequence (ex: `mousemove`) pourront activer un mode runtime optimise.
- ce mode reste hors perimetre V1 et sera defini apres demonstrations et mesures reelles.
- objectifs cibles:
  - preserver la reactivite percue
  - eviter la saturation du pipeline runtime
  - conserver le determinisme et la tracabilite des decisions de reduction/coalescence
