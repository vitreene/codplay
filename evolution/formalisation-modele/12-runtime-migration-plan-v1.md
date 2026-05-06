# Runtime migration plan V1 - objectif 2

## Statut

Plan de travail actif pour preparer la migration code runtime.

Note de lecture V1 actuelle:

- document de transition (non normatif face au corpus `31-38` et `43-50`)
- la terminologie historique `events publics` se lit `events runtime`

Ce document traduit les specs V1 en etapes d'implementation concretes:

- `plan-consolide.md`
- `06-runtime-contract.md`
- `10-api-host-v1.md`
- `11-runtime-context-mapping-v1.md`

## But

Preparer la transformation de l'implementation actuelle vers la cible:

- `Player = Director + Renderer + Timer + Ticker`
- flux principal `Director -> Renderer`
- retour `Renderer -> Director` reserve aux erreurs

Livrables de l'objectif 2:

1. plan de transformation du player actuel vers un `Renderer`
2. contrats internes minimaux entre `Director` et `Renderer` (lean/perf)
3. structure code pour `runtimeConfig` et `policies`

Principe V1 canonique:

- pas de couche de retro-compatibilite
- pas de facade "compat" transitoire a conserver dans l'API cible
- facade formelle imposee uniquement pour l'API publique du `Player`

## Constat code actuel

### Ce qui existe deja

- `src/core/time/clock.ts` et `src/core/time/ticker.ts` couvrent une base `Timer/Ticker`
- `src/core/events/*.ts` fournit tri/dispatch/fenetre d'events reutilisable
- `src/runtime/*` couvre des operations de rendu/action (mount/apply/list/media/trace)

### Gap principal

- `src/player/create-player.ts` melange orchestration eventielle et execution rendu
- la file temporelle runtime repose encore sur des timers legacy pour jouer les events
- les notions `Director`, `Renderer`, `eventSeq`, `commitSeq`, journal canonique ne sont pas encore isolees en composants dedies
- `runtimeConfig` est encore reduit a une policy locale (`allowedRebuildModes`)

## Cible de decoupage code

### 1) Director (nouveau composant)

Role:

- ingerer les events publics
- normaliser et assigner `eventSeq`
- tenir le journal canonique
- maintenir le state story/runtime
- produire des commits ordonnes vers le Renderer

Etat minimal interne:

- `nextEventSeq`
- `nextCommitSeq`
- `publicEventLog`
- `storiesState`
- `activeTracks`

### 2) Renderer (evolution du runtime actuel)

Role:

- recevoir des commits resolus
- bufferiser par `commitSeq`
- appliquer les commits prets au tick
- produire uniquement des erreurs techniques vers le Director

Sources de code a reutiliser en priorite:

- `src/runtime/mount-elements.ts`
- `src/runtime/create-element.ts`
- `src/runtime/apply-actions.ts`
- `src/runtime/list-plugin/*`
- `src/runtime/media-sync.ts`
- `src/runtime/trace-store.ts`

### 3) Timer/Ticker (partage)

Role:

- fournir la reference temporelle commune (`nowMs`)
- piloter deux boucles logiques distinctes:
  - cycle Director (events -> commits)
  - cycle Renderer (flush commits prets)

Note migration:

- la cible finale retire les timers legacy des chemins critiques runtime
- execution cible: `rAF + queue + commit`

## Contrats internes minimaux (orientes performance)

### Contrat interne Director

```ts
type DirectorCore = {
  load: (input: { compiledScene: CompiledScene; config: EffectiveRuntimeConfig }) => Result
  start: () => Result
  pause: () => Result
  resume: () => Result
  stop: (reason?: string) => Result
  emit: (event: PublicEventInput) => Result
  seek: (targetMs: number) => Result
  replayFromZero: (reason?: string) => Result
  tick: (nowMs: number) => RuntimeCommit[]
  reportRendererError?: (error: RendererRuntimeError) => void
  getState: () => DirectorStateSnapshot
}
```

### Contrat interne Renderer

```ts
type RendererCore = {
  load: (input: { compiledScene: CompiledScene; mountTarget: unknown; config: EffectiveRuntimeConfig }) => Result
  start: () => Result
  pause: () => Result
  resume: () => Result
  stop: (reason?: string) => Result
  destroy: () => Result
  applyCommits: (commits: RuntimeCommit[], nowMs: number) => RendererApplyResult
  getState: () => RendererStateSnapshot
}
```

Note:

- pas d'obligation de facade inter-modules uniforme en interne
- sur les hot paths, preferer des appels directs et des structures simples

## Contrat commit minimal (rappel)

```ts
type RuntimeCommit = {
  commitSeq: number
  applyAtMs: number
  target: {
    storyInstanceId: string
    itemId: string
    targetId?: string
  }
  operations: unknown[]
  causeEventId?: string
}
```

## Structure runtimeConfig/policies (code)

Arborescence recommandee:

- `src/config/runtime/types.ts`
- `src/config/runtime/defaults.ts`
- `src/config/runtime/presets/author.ts`
- `src/config/runtime/presets/user.ts`
- `src/config/runtime/resolve-runtime-config.ts`

Regles de merge:

1. defaults framework
2. preset environnement
3. config projet/scene
4. patch runtime host

Sortie unique:

- `effectiveRuntimeConfig` distribue vers `Director`, `Renderer`, `Timer`, `Ticker`

## Plan de transformation par etapes

1. Etape A - extraire Renderer

- creer `src/renderer/create-renderer.ts`
- deplacer la logique appliquee aujourd'hui dans `runTimelineEvent` vers un format `commit`
- introduire la file `pendingCommits` triee par `commitSeq`

2. Etape B - introduire Director

- creer `src/director/create-director.ts`
- reutiliser `core/events` pour normaliser/ordonner puis produire des commits
- introduire `eventSeq`, `commitSeq`, journal canonique

3. Etape C - composer le nouveau Player

- convertir `src/player/create-player.ts` en facade de composition
- brancher `Timer/Ticker` communs sur `Director.tick(...)` puis `Renderer.applyCommits(...)`
- exposer uniquement l'API host V1 canonique

4. Etape D - basculer vers API host V1

- aligner les commandes sur `load/start/pause/resume/stop/emit/replayFromZero/destroy`
- retirer les alias legacy (`play/rewind/rebuild`) du perimetre public

5. Etape E - retirer scheduling a base de timeout

- supprimer le scheduling events par timers legacy cote player/director
- basculer totalement vers traitement a la frame (`rAF + queue + commit`)

6. Etape F - consolider creation des persos par type

- figer le contrat `item.type -> RuntimeElement` dans le `Renderer`
- brancher explicitement le chemin type custom (`ModuleRegistry`) et le noyau (`text`/`img`/`list`)
- garder `FLIP` et logique composee dans le composant `list`, pas dans le pipeline runtime generique

## Criteres de completion objectif 2

- `create-player` ne contient plus de logique metier eventielle directe
- `Director` et `Renderer` sont instancies comme composants distincts
- la communication interne reste simple/performante sans facade obligatoire
- `runtimeConfig` est resolu via une couche dediee et non en inline
- le plan de migration vers l'objectif 3 est executable sans ambiguite

## Preparation objectif 3

Une fois cet objectif pose en code, la suite immediate est:

- brancher `eventSeq`/journal canonique cote Director
- brancher le contrat commit complet cote Renderer
- couvrir par tests smoke separes Director/Renderer/Player
