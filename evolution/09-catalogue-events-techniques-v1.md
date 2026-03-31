# Catalogue d'events techniques V1

## 1) Portee

Ce document fixe les events techniques du moteur (plan controle runtime).

Rappel:

- les events de contenu sequence restent libres (metier)
- les prefixes techniques sont reserves

Reference:

- separation des plans: `evolution/02-specifications-engine-v1.md` (section 20)

## 2) Envelope commune

```ts
type RuntimeControlEvent = {
  name: string
  source: 'system' | 'story' | 'user'
  ms: number
  payload?: Record<string, unknown>
  correlationId?: string
}
```

Alias de payload:

```ts
type StoryRefPayload = { storyId: string; instanceId?: string }
type RebuildModePayload = 'state' | 'full'
type WaitModePayload = 'parallel' | 'suspendSource'
```

Validation V1:

- `name` obligatoire
- `payload` valide selon le type d'event
- si payload invalide: trace `REJECTED` avec `reason=INVALID_EVENT_PAYLOAD`

Reference reasons/codes:

- `evolution/15-registre-erreurs-v1.md`

## 3) Prefixes reserves

- `player:`
- `scenario:`
- `story:`
- `track:`
- `media:`
- `list:`
- `strap:`
- `runtime:`
- `system:`

Les events de sequence auteur ne doivent pas utiliser ces prefixes.

Regles de nommage V1:

- noms en kebab-case, segments separes par `:`
- format recommande: `namespace:action[:detail]`

## 4) Catalogue canonique V1

## 4.1 `player:*`

- `player:init` payload `{ sceneId: string }`
- `player:destroy` payload optionnel
- `player:revert` payload optionnel
- `player:play` payload optionnel
- `player:pause` payload optionnel
- `player:stop` payload optionnel
- `player:seek` payload `{ targetTimelineMs: number, rebuild?: RebuildModePayload }`
- `player:rewind` payload `{ rebuild?: RebuildModePayload }`
- `player:rebuild` payload `{ mode: RebuildModePayload, reason?: string, requestedBy?: 'editor' | 'system' }`
- `player:set-rate` payload `{ rate: number }`

Lifecycle:

- `player:preload:started`
- `player:preload:ok` payload `{ loaded: number }`
- `player:preload:failed` payload `{ code: string, message: string }`
- `player:seek:started` payload `{ targetTimelineMs: number, rebuild: RebuildModePayload }`
- `player:seek:done` payload `{ targetTimelineMs: number }`
- `player:seek:failed` payload `{ targetTimelineMs: number, code: string }`
- `player:rewind:started` payload `{ rebuild: RebuildModePayload }`
- `player:rewind:done` payload `{ rebuild: RebuildModePayload }`
- `player:rewind:failed` payload `{ rebuild: RebuildModePayload, code: string }`
- `player:rebuild:started` payload `{ mode: RebuildModePayload }`
- `player:rebuild:done` payload `{ mode: RebuildModePayload }`
- `player:rebuild:failed` payload `{ mode: RebuildModePayload, code: string }`
- `player:replay:started` payload `{ fromMs: number, toMs: number }`
- `player:replay:done` payload `{ appliedEvents: number }`

## 4.2 `scenario:*`

Commands:

- `scenario:start-story` payload `{ storyRef: StoryRefPayload }`
- `scenario:stop-story` payload `{ storyRef: StoryRefPayload }`
- `scenario:show-story` payload `{ storyRef: StoryRefPayload }`
- `scenario:hide-story` payload `{ storyRef: StoryRefPayload }`
- `scenario:goto-story` payload `{ storyRef: StoryRefPayload }`

Wait flow:

- `scenario:wait:start` payload `{ waitId: string, mode: WaitModePayload, waitStory: StoryRefPayload, fromStory?: StoryRefPayload, reason?: string }`
- `scenario:wait:started` payload `{ waitId: string, mode: WaitModePayload, waitStory: StoryRefPayload, fromStory?: StoryRefPayload, frozenCursorMs?: number, disabledTrackIds: string[] }`
- `scenario:wait:resolve` payload `{ waitId: string, resumePolicy?: 'fromCursor' | 'fromStart' }`
- `scenario:wait:resolved` payload `{ waitId: string }`
- `scenario:wait:failed` payload `{ waitId?: string, code: string, message: string }`

Transitions:

- `scenario:transition:selected` payload `{ fromNodeId: string, toNodeId: string, eventName: string, priority: number }`
- `scenario:transition:none` payload `{ nodeId: string, eventName: string }`

Validation payload scenario (obligatoire):

- `storyRef.storyId` obligatoire pour `scenario:*story`
- `waitId`, `mode`, `waitStory.storyId` obligatoires pour `scenario:wait:start`
- `waitId` obligatoire pour `scenario:wait:resolve`
- payload invalide -> `REJECTED` avec `reason=INVALID_EVENT_PAYLOAD`

## 4.3 `story:*`

- `story:started` payload `{ storyRef: { storyId: string, instanceId?: string } }`
- `story:stopped` payload `{ storyRef: { storyId: string, instanceId?: string } }`
- `story:shown` payload `{ storyRef: { storyId: string, instanceId?: string } }`
- `story:hidden` payload `{ storyRef: { storyId: string, instanceId?: string } }`
- `story:paused` payload `{ storyRef: { storyId: string, instanceId?: string } }`
- `story:resumed` payload `{ storyRef: { storyId: string, instanceId?: string }, cursorMs?: number }`
- `story:ended` payload `{ storyRef: { storyId: string, instanceId?: string } }`
- `story:error` payload `{ storyRef: { storyId: string, instanceId?: string }, code: string, message: string }`
- `story:child-ignored-for-end` payload `{ storyRef: { storyId: string, instanceId?: string }, childId: string }`

## 4.4 `track:*`

- `track:added` payload `{ trackId: string, source: 'story' | 'user' | 'system', order: number, active: boolean, ownerStoryId?: string }`
- `track:removed` payload `{ trackId: string }`
- `track:enabled` payload `{ trackId: string }`
- `track:disabled` payload `{ trackId: string }`
- `track:order:set` payload `{ trackId: string, order: number }`

## 4.5 `media:*`

- `media:play` payload `{ runtimeItemId: string, startMediaMs?: number }`
- `media:pause` payload `{ runtimeItemId: string }`
- `media:seek` payload `{ runtimeItemId: string, targetMediaMs: number }`
- `media:rewind` payload `{ runtimeItemId: string }`
- `media:ended` payload `{ runtimeItemId: string }`
- `media:sync:corrected` payload `{ runtimeItemId: string, driftMs: number }`

## 4.6 `strap:*`

- `strap:effect:requested` payload `{ name: string, correlationId: string }`
- `strap:effect:started` payload `{ name: string, correlationId: string }`
- `strap:effect:succeeded` payload `{ name: string, correlationId: string }`
- `strap:effect:failed` payload `{ name: string, correlationId: string, code: string }`

## 4.7 `list:*`

- `list:diff:computed` payload `{ runtimeListId: string, added: string[], removed: string[], moved: string[] }`
- `list:child:enter` payload `{ runtimeListId: string, childId: string }`
- `list:child:leave:started` payload `{ runtimeListId: string, childId: string }`
- `list:child:leave:done` payload `{ runtimeListId: string, childId: string }`
- `list:child:move:flip` payload `{ runtimeListId: string, childId: string }`
- `list:perf:fallback` payload `{ runtimeListId: string, strategy: string }`

## 4.8 `runtime:*` et `system:*`

- `runtime:reset:started` payload `{ mode: RebuildModePayload }`
- `runtime:reset:done` payload `{ mode: RebuildModePayload }`
- `system:error` payload `{ code: string, message: string, details?: unknown }`
- `system:warning` payload `{ code: string, message: string }`

## 5) Mapping API -> events techniques

- `player.init(...)` -> `player:init`
- `player.destroy()` -> `player:destroy`
- `player.revert()` -> `player:revert`
- `player.play()` -> `player:play`
- `player.pause()` -> `player:pause`
- `player.stop()` -> `player:stop`
- `player.seek(...)` -> `player:seek`
- `player.rewind(...)` -> `player:rewind`
- `player.rebuild(...)` -> `player:rebuild`
- `player.setRate(...)` -> `player:set-rate`
- `scenario.startStory(...)` -> `scenario:start-story`
- `scenario.stopStory(...)` -> `scenario:stop-story`
- `scenario.showStory(...)` -> `scenario:show-story`
- `scenario.hideStory(...)` -> `scenario:hide-story`
- `scenario.gotoStory(...)` -> `scenario:goto-story`
- `scenario.startWait(...)` -> `scenario:wait:start`
- `scenario.startWait(...)` -> lifecycle `scenario:wait:started | scenario:wait:failed`
- `scenario.resolveWait(...)` -> `scenario:wait:resolve`
- `scenario.resolveWait(...)` -> lifecycle `scenario:wait:resolved | scenario:wait:failed`
- `track.add(...)` -> `track:added`
- `track.remove(...)` -> `track:removed`
- `track.enable(...)` -> `track:enabled`
- `track.disable(...)` -> `track:disabled`
- `track.setOrder(...)` -> `track:order:set`
- `effect.run(...)` -> `strap:effect:*`
- `list plugin diff/animation` -> `list:*`

Ce mapping est normatif pour la trace et le debug.

## 6) Champs payload obligatoires (minimum V1)

- `player:init`: `sceneId`
- `player:seek`: `targetTimelineMs`
- `player:set-rate`: `rate`
- `player:rebuild`: `mode`
- `scenario:*story`: `storyRef.storyId`
- `scenario:wait:start`: `waitId`, `mode`, `waitStory.storyId`
- `scenario:wait:resolve`: `waitId`
- `story:error`: `storyRef.storyId`, `code`, `message`
- `track:order:set`: `trackId`, `order`
- `media:play`: `runtimeItemId`
- `media:seek`: `runtimeItemId`, `targetMediaMs`
- `media:rewind`: `runtimeItemId`
- `strap:effect:*`: `name`, `correlationId`
- `runtime:reset:*`: `mode`
- `system:error`: `code`, `message`

Regle de rejet:

- si un champ obligatoire manque: `REJECTED` avec `reason=INVALID_EVENT_PAYLOAD`
