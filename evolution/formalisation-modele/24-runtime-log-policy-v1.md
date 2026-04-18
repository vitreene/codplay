# Runtime log policy V1

## Statut

Spec-cadre V1 pour la politique de logs/traces runtime.

## Preambule - intention

Le systeme de log doit aider le debug sans coupler fortement le code metier.

Objectifs:

- logs minimaux et utiles
- faible couplage avec les composants
- desactivation simple et peu couteuse

## Principes directeurs

- ne pas "mettre des logs partout"
- privilegier des points de trace aux frontieres d'etapes
- conserver des payloads compacts
- garder le flux metier lisible

## Couplage minimal

Regle V1:

- les composants recoivent un hook de trace optionnel (injecte)
- en absence de hook, le cout runtime doit etre quasi nul

Contrat recommande:

```ts
type TraceLevel = 'off' | 'warn' | 'info' | 'debug'

type TraceRecord = {
  level: Exclude<TraceLevel, 'off'>
  code: string
  eventId?: string
  eventSeq?: number
  persoId?: string
  details?: Record<string, unknown>
}

type TraceReporter = (record: TraceRecord) => void
```

## Activation / desactivation

- `off`: aucun log
- `warn`: warnings auteur uniquement (defaut recommande)
- `info`: etapes majeures
- `debug`: detail de calcul

Regle:

- le filtrage de niveau doit se faire avant construction de payload couteux

## Points de trace recommandes

Tracer seulement les etapes critiques:

- reception action (`eventId`, `eventSeq`, `persoId`)
- resolution move (source/cible/detach)
- creation trigger FLIP
- interruption/reprise animation
- warnings auteur

Ne pas tracer:

- chaque operation triviale de mutation DOM
- chaque ligne de calcul intermediaire non critique

## Dedoublonnage

Regle V1:

- dedoublonnage minimal par cle `{eventSeq, code, persoId?}`

Objectif:

- eviter le bruit de repetition massive sur un meme tick

## Norme warning codes V0.1

Objectif:

- fournir une convention simple de depart, ajustable a l'usage

Convention de nommage:

- `AUTHOR_<DOMAIN>_<DETAIL>` pour problemes de declaration/auteur
- `RUNTIME_<DOMAIN>_<DETAIL>` pour problemes recuperables d'execution

Exemples:

- `AUTHOR_MOVE_TARGET_INVALID`
- `AUTHOR_EMIT_EVENTS_EMPTY`
- `RUNTIME_LIST_CHILD_NODE_NOT_FOUND`
- `RUNTIME_FLIP_MATRIX_NON_INVERTIBLE`

Format minimal d'un warning:

```ts
type WarningRecord = {
  code: string
  level: 'warn'
  eventId?: string
  eventSeq?: number
  persoId?: string
  componentType?: string
  details?: Record<string, unknown>
}
```

Regles V0.1:

- un warning = une anomalie logique (pas de spam)
- dedoublonnage obligatoire par cle `{eventSeq, code, persoId?}`
- comportement runtime non bloquant par defaut

## Vocabulaire technique

Regle semantique:

- utiliser `touched` (ou `touched set`) pour designer les elements impliques
- ne pas utiliser `dirty` dans les specs runtime

## FLIP et traces

Pour FLIP, tracer en priorite:

- id du move
- `touched` entries
- type de transition (`local-move`, `transfer-in`, `transfer-out`, `detach`)
- interruption/reprise

Option debug:

- details FIRST/LAST uniquement quand le niveau est `debug`

## Erreurs

Regles:

- erreurs locales capturees, converties en warning trace auteur
- pas de throw bloquant pour le runtime global

## Liens

- `16-base-component-v1.md`
- `23-list-component-v1.md`
- `21-text-micro-animations-v1.md`
