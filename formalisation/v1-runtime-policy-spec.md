# Runtime policy events V1 - garde-fous execution

## Statut

Spec normative V1 pour les policies runtime de validation et de limitation des events.

## Objectif

Poser un cadre minimal de garde-fous runtime, volontairement succinct en V1, puis affiner apres mises en pratique et tests reels.

## Domaine

Cette policy s'applique aux events:

- entrants (`Player.emit`, `Perso.emit`)
- produits par `listen.transform[]`
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
  masterClock?: {
    unique?: boolean
    previousMasterAction?: "pause" | "stop"
    fallbackToTicker?: boolean
  }
  rejectUnknownPersoTarget?: boolean
  rejectInvalidPayload?: boolean
}
```

## Regles normatives

1. Niveau V1

- la policy runtime events est minimale en V1.
- les seuils par defaut V1 sont imposes pour proteger le runtime contre les emballements.

2. Comportement par defaut V1

- cible perso inconnue: warning par defaut.
- payload invalide: warning par defaut.
- erreur strap: `continue-with-warning` par defaut.
- les modes "rejet strict" restent activables via policy.
- `maxEventsPerTick` vaut `1000` par defaut.
- `maxCascadeDepth` vaut `16` par defaut.
- quand une limite est atteinte, le runtime coupe la propagation excedentaire du tick ou du chemin courant et emet un warning trace.

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
- les coupures dues aux garde-fous sont tracees avec `decision=ignored`.

6. Codes

- `AUTHOR_*`: erreurs de structure auteur a la compilation
- `RUNTIME_*`: rejets ou degradations d'execution
- `HOST_*`: erreurs d'appel facade publique

7. Master clock

- `masterClock.unique` est `true` par defaut en V1.
- un seul master actif est autorise a un instant donne.
- quand un nouveau master devient actif, le precedent est traite via `masterClock.previousMasterAction`.
- `masterClock.previousMasterAction` vaut `pause` par defaut.
- `masterClock.previousMasterAction=stop` est autorise pour des flows non resumables.
- le dernier master active prend la priorite de reference temporelle runtime.
- si aucun master n'est actif, ou si le master actif est indisponible/desactive/termine, le runtime revient immediatement au ticker standard.
- `fallbackToTicker` est `true` par defaut.

8. Separation synchro / etat media

- la source temporelle runtime (master ou ticker) est distincte de l'etat lecture d'un composant media.
- une pause/reprise globale player ne doit pas ecraser un etat media force par sequence (`broadcast` START/PAUSE/STOP).
- un composant media conserve son etat interne sequence-level lors des transitions play/pause utilisateur du player.

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
