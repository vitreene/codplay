# Machines d'etat et traces - V1

## 1) Pourquoi une machine d'etat

Une machine d'etat impose trois elements clairs:

- un etat courant
- un event d'entree
- une transition vers un nouvel etat

Interet pour l'engine:

- comportement previsible
- rejet explicite des events invalides
- trace lineaire facile a relire

## 2) Regle de base

Chaque event runtime passe par:

1. `canTransition(machine, event)`
2. `computeNextState(machine, event)`
3. `commitTransition(machine, from, to, event)`
4. `appendTrace(row)`

## 3) Machines cibles

### PlayerMachine

Etats:

- `idle`
- `preloading`
- `ready`
- `playing`
- `paused`
- `seeking`
- `rewinding`
- `error`

### ScenarioMachine

Etats:

- `idle`
- `running`
- `waiting`
- `error`

### StoryMachine

Etats:

- `idle`
- `ready`
- `playing`
- `paused`
- `ended`
- `error`

### PlayableMachine

Etats:

- `idle`
- `playing`
- `paused`
- `ended`
- `error`

## 4) Priorite des transitions

Ordre recommande:

1. transitions systeme (sante runtime, preload, erreurs)
2. transitions player globales
3. transitions scenario (story)
4. transitions playables (items/media)

But:

- eviter qu'une transition locale contredise une commande globale

## 5) Refus explicites

Si une transition est impossible:

- l'etat reste stable
- une trace `REJECTED` est ajoutee

Exemple:

- `PLAY` recu sur media `ended` sans commande de rewind

## 6) Trace standard

```ts
type MachineTraceRow = {
  traceMs: number
  machine: 'player' | 'scenario' | 'story' | 'playable'
  id: string
  from: string
  event: string
  to: string
  status: 'APPLIED' | 'REJECTED'
  reason?: string
  payload?: Record<string, unknown>
  eventId?: string
  correlationId?: string
}
```

Note:

- les labels de trace peuvent etre formates en majuscules pour la lisibilite
- le nom canonique d'event reste celui du catalogue `evolution/09-catalogue-events-techniques-v1.md`

## 7) Trace de seek

Un seek produit une sequence de traces lisible:

1. `player:seek:started`
2. `runtime:reset:started` (`mode=state|full`)
3. `runtime:reset:done`
4. `REPLAY_EVENT ...`
5. `APPLY_PLAYABLE_SEEK ...`
6. `player:seek:done`

En echec:

1. `player:seek:started`
2. `player:seek:failed` (`code=...`)

## 8) Trace media

Pour chaque media, tracer:

- `logicalIntent` (`idle|playing|paused|ended`)
- `targetMediaMs`
- `applyCurrentTime` (oui/non)
- `applyPlay` (oui/non)

But:

- comprendre pourquoi un media ne repart pas apres seek

## 9) Cas des enfants infinis

Un enfant `loop: infinite` est non bloquant par defaut.

Trace recommandee:

- `story:child-ignored-for-end` quand cet enfant n'entre pas dans le calcul de fin story

## 10) Recommandation implementation

Isoler la logique machine dans un module unique:

- `machine/player-machine.ts`
- `machine/story-machine.ts`
- `machine/playable-machine.ts`
- `machine/trace-store.ts`

Chaque module expose:

- `can(event)`
- `transition(event)`
- `getState()`

Ce decouplage facilite les tests de determinisme.

## 11) Trace rebuild et type `list`

### Rebuild pilote par l'hote

Trace recommandee:

1. `player:rebuild` (`mode=state|full`, `requestedBy=editor`)
2. `player:rebuild:started`
3. `runtime:reset:started`
4. `runtime:reset:done`
5. si `full`: `player:preload:started` -> `player:preload:ok|player:preload:failed`
6. `player:replay:started` -> `player:replay:done`
7. `player:rebuild:done`

Si le mode rebuild est interdit par policy hote:

- etat stable
- trace `REJECTED` avec `reason=MODE_NOT_ALLOWED_BY_POLICY`

### Type `list`

Pour un conteneur `list`, tracer aussi:

- `list:diff:computed` (`added`, `removed`, `moved`)
- `list:child:enter`
- `list:child:leave:started` / `list:child:leave:done`
- `list:child:move:flip`

But:

- verifier que l'auto-layout n'introduit pas de recreation cachee de nodes en `state`

## 12) Trace wait flow (story d'attente)

Pour un flux `startWait` puis `resolveWait`, tracer:

1. `scenario:wait:start` (`mode=parallel|suspendSource`)
2. `story:started|story:shown` (wait story)
3. si `mode=suspendSource`:
   - `story:paused` (story source)
   - `track:disabled` (tracks source)
4. `scenario:wait:started` (`waitId`, `mode`, `frozenCursorMs?`)

Puis a la reprise:

1. `scenario:wait:resolve`
2. `story:stopped|story:hidden` (wait story)
3. si `mode=suspendSource`:
   - `track:enabled` (tracks source)
   - `story:resumed` (source, `cursor=frozenCursorMs` ou `0` selon policy)
4. `scenario:wait:resolved`

Refus typiques:

- `WAIT_HANDLE_NOT_FOUND`
- `WAIT_ALREADY_ACTIVE_FOR_STORY`
- `WAIT_STORY_INVALID_CLOCK_MODE`

## 13) Trace effet strap asynchrone (form submit)

Pour un submit form pilote par strap:

1. `user-track event=pointer:click` (submit)
2. `strap:effect:requested` (`name=form.submit`, `correlationId`)
3. `strap:effect:started`
4. `strap:effect:succeeded` ou `strap:effect:failed`
5. en succes: `scenario:wait:resolve` puis transition narrative (`scenario:goto-story`)
6. en echec: pas de transition implicite (etat d'attente conserve)

Refus typiques:

- `EFFECT_TIMEOUT`
- `EFFECT_UNAVAILABLE`
- `EFFECT_REJECTED`
