# Scene model and event flow

Read the [scene contract](../../../../packages/codplay/specs/scene-authoring-spec.md)
and [facade contract](../../../../packages/codplay/specs/facade-v2-spec.md)
for the verified authoring and instance boundaries. This guide explains their
relationship through a complete example. [Scene authoring](scene-authoring.md)
details placement and the other component profiles.

## Naming is not an execution mechanism

In CodPlay's design, a name is an identity or reference. It does not carry an
action through its spelling. A prefix, suffix, English verb or `:` separator
does not route an event, activate a story, call a function or change rendering.
Different conventions are admissible within accepted identifier formats, as
long as explicit references and configurations remain consistent.

| Named element | What gives it behavior |
| --- | --- |
| Scene/story/perso ID | The declared object and references targeting that identity |
| Event name | Matching action keys, exact `listen.on` rules and any explicitly registered control handling |
| Strap name | The function registered under that key in the selected scene/story collection |
| Component/service/library type or ID | The definition registered under that ID and the dependencies that reference it |
| Event scope | Explicit target and `visibility`; not words like `scene:` in an event name |

Thus `welcome:confirm`, `confirm-request` or `confirmation` can identify the
same authored decision when all corresponding declarations are renamed
together. None of those strings confirms anything by itself. Names containing
`finish`, `reset` or `next` are not implicit transport commands.

The convention of domain-prefixed event names and descriptive kebab-case role
names improves readability; it is not an event grammar that the player parses
to discover behavior. Exact matching still matters: an arbitrary rename at one
call site breaks a reference, even though an alternative convention is valid.

Consult the actual configuration/definition owners rather than guessing from
labels:

| File | Explicitly defined identities or role |
| --- | --- |
| [`scene/config/scene-build.ts`](../../../../packages/codplay/src/scene/config/scene-build.ts) | Root/detach tokens, compiled schema identity, logical unit and resource-type mapping |
| [`runtime/config/track.ts`](../../../../packages/codplay/src/runtime/config/track.ts) | Global track ID and generated strap-track prefix |
| [`runtime/config/track-events.ts`](../../../../packages/codplay/src/runtime/config/track-events.ts) | Explicit track-control and journal state-update event identities |
| [`runtime/config/strap-scope.ts`](../../../../packages/codplay/src/runtime/config/strap-scope.ts) | Scene/story strap ownership values |
| [`runtime/config/event-insertion.ts`](../../../../packages/codplay/src/runtime/config/event-insertion.ts) | Insertion-policy values, independent of event naming |
| [`sequence-end.ts`](../../../../packages/codplay/src/runtime/player/runtime-player/sequence-end.ts) | Exact terminal event identity consumed by player lifecycle |

API properties such as `onStart`, registered type names, native source keys
such as the pointer adapter's `pointerdown`, and protocol symbols such as
`sequence:end` have explicit consumers. Their roles come from those bindings,
not from a general naming convention. They cannot be replaced at one site
like a free author label. Configuration constants are source definitions;
this does not promise a public runtime API that changes every convention.
The [scene contract](../../../../packages/codplay/specs/scene-authoring-spec.md)
and capability-specific specifications remain authoritative.

## Complete scene example

Save this declaration as `welcome-scene.ts`. It contains two stories, several
persos sharing the `tag` component, local and global events, two straps and the
three scene lifecycle callbacks. The event names beginning with `welcome:` are
authored scenario names, not built-in transport commands.

```ts
import type { SceneDoc } from 'codplay'

export const scene: SceneDoc = {
  id: 'welcome-model',
  state: { acknowledged: false },
  // Observes scene initialization; this is not an emitted scenario event.
  init: (scene) => console.info('Initialized', scene.id),
  // Observes playback starting from the ready state.
  onStart: (scene) => console.info('Started', scene.id),
  // Observes terminal completion, rather than a seek across the end boundary.
  onSequenceEnd: (scene) => console.info('Ended', scene.id),
  listen: [{ on: 'welcome:confirmed', straps: ['publish-confirmation'] }],
  straps: {
    // Records the story's confirmation and publishes one scene-level result.
    'publish-confirmation': (input) => ({
      update: { acknowledged: true },
      events: [{
        name: 'welcome:acknowledged',
        visibility: 'public',
        data: { request: input.event.name },
      }],
    }),
  },
  stories: {
    interaction: {
      id: 'interaction',
      state: { confirmations: 0 },
      listen: [{ on: 'welcome:confirm', straps: ['confirm'] }],
      straps: {
        // Records the decision and schedules one finite follow-up occurrence.
        confirm: (input) => {
          const count = Number(input.state.confirmations) + 1
          return [
            {
              update: { confirmations: count },
              events: [{ name: 'welcome:confirmed', data: { count } }],
            },
            input.context.planned.wait(250, {
              event: { name: 'welcome:continue' },
            }),
          ]
        },
      },
      persos: [
        {
          id: 'message',
          type: 'tag',
          initial: { tag: 'p', attr: { id: 'welcome-message' }, content: 'Waiting', move: '@root' },
          actions: {
            'welcome:prompt': { content: 'Press Confirm' },
            'welcome:confirmed': { content: 'Confirmed' },
            'welcome:continue': { content: 'Ready to continue' },
            'welcome:finish': { content: 'Finished' },
          },
        },
        {
          id: 'confirm-button',
          type: 'tag',
          initial: { tag: 'button', attr: { id: 'welcome-confirm' }, content: 'Confirm', move: '@root' },
          emit: {
            click: { event: { name: 'welcome:confirm', visibility: 'story' } },
          },
        },
      ],
      eventimes: [{ name: 'welcome:prompt', startAt: 1_000 }],
    },
    status: {
      id: 'status',
      persos: [{
        id: 'status-label',
        type: 'tag',
        initial: { tag: 'p', attr: { id: 'welcome-status' }, content: 'Preparing', move: '@root' },
        actions: {
          'welcome:ready': { content: 'Ready' },
          'welcome:acknowledged': { content: 'Confirmation received' },
          'welcome:finish': { content: 'Finished' },
        },
      }],
    },
  },
  eventimes: [
    { name: 'welcome:ready', startAt: 500 },
    { name: 'sequence:end', startAt: 10_000, visibility: 'public' },
  ],
}
```

The click enters the interaction story's live listener and its `confirm` strap.
`welcome:confirmed` immediately changes the message; `welcome:continue` applies
250 ms later as a journaled planned occurrence. The two state updates are
scoped separately: `confirmations` belongs to `interaction`, while
`acknowledged` belongs to the scene. The immediate `welcome:confirmed` output
has no matching story listener, so it reaches the scene's `publish-confirmation`
strap. Its public `welcome:acknowledged` updates the status label and is eligible
for outside observation when playback reaches it. The ordinary ready/prompt
eventimes do not call these straps.

An outside scene-targeted `welcome:finish` below is a separate journaled
occurrence that updates both matching perso actions at the next presentation.
It is not a call to the scene strap. The terminal `sequence:end` at ten seconds
is also separate: the authored `welcome:finish` name is not a built-in stop
command.
Export this `SceneDoc` and load its package using
[single-scene playback](single-scene-playback.md). The external-control
functions below receive that already created occurrence.

## Scene, stories and perso-component pairs

`SceneDoc` is the authored description. A running occurrence is an instance,
with one player, journal and logical time. Stories organize that description
inside the instance; they do not create additional players or engines.

| Element | Responsibility |
| --- | --- |
| Scene | Groups stories and owns scene-level state, listeners, straps, common eventimes and lifecycle callbacks |
| Story | Groups persos and owns its local state, eventimes, listeners and straps |
| Perso | Gives an authored role its ID, component type, initial state, named actions and optional input declarations |
| Component | Implements the registered type, validates its profile and projects each perso's resolved state through its services/native representation |
| Strap | Computes a reaction from a live event and scoped state, returning events, updates or finite planned outputs |

A perso such as `message` can use component type `tag`; another perso may use
that same type with different initial data and actions. Runtime component
instances are separate for the different persos. The component implements a
capability; the perso declares its role in this scenario. A perso need not be
a human character, and a component need not produce HTML. Read
[component materialization](../../../../packages/codplay/specs/component-materialization-v2-spec.md)
for that boundary.

An action entry is selected by its event name, not by calling an arbitrary
component method. A payload such as `greet: { content: 'Ready' }` describes the
resolved change that the component will project. The component does not own a
parallel story state or journal.

A story's `listen` declares how its live events are processed. A strap named
there is resolved in that story's strap collection; scene-owned straps use the
scene collection instead. A strap computes outputs rather than manipulating
rendered nodes. Immediate outputs can enter other listeners; finite planned
outputs become future journal facts. Seek reconstructs those facts without
rerunning the strap. Read the
[strap guide](straps.md) for inputs, return forms and planned helpers.

Story activation/isolation, reset and visual placement are separate concerns.
A `story.listen` rule with `active` controls an isolation period; `reset: true`
projects that story from its initial state at an event boundary. Neither is
an implicit DOM hide/show or an additional scene instance. The
[isolation contract](../../../../packages/codplay/specs/story-isolation-spec.md)
defines their exact limits.

## Event scope and scene-level declarations

For event organization, track properties and dynamic insertion, read
[event tracks](event-tracks.md).

Targeting and visibility are separate. [Event scopes](event-scopes.md)
explains story/scene/public routing, listener ownership, outside addressing,
capture state and live-action recipients, with a two-story example.

Distinguish three scene-level surfaces:

- `scene.eventimes` declares timed occurrences common to the stories.
  `story.eventimes` is local. Ordinary compiled eventimes apply matching actions
  without executing live listeners or straps.
- `scene.listen` and `scene.straps` describe reactions on the live scene path.
  An event's scene-wide scope is not a transport to another instance or an
  implicit story-activation request.
- `init`, `onStart` and `onSequenceEnd` are lifecycle callbacks, not event names
  that automatically reach `listen`. The special event `sequence:end` marks a
  terminal playback boundary and has its verified dispatch behavior; Seek
  across that boundary reconstructs without triggering terminal completion.

An authored event name has only the meaning assigned by the scene. For example,
`greet` or `question:next` is not a built-in transport command.

## Control an occurrence from outside

For an already created or package-loaded `instance`, the public facade exposes
three complementary channels:

| Outside intent | Public channel |
| --- | --- |
| Play, pause, seek, reset, change rate | [`instance.telco`](telco.md), documented separately |
| Inject a discrete scenario event | `instance.events.emit(eventime, target)` |
| Observe public scenario output | `instance.events.onEvent(listener)` |

For this example, emitting `welcome:confirm` with target
`{ scope: 'story', storyId: 'interaction' }` addresses the interaction story;
it does not require reading or changing its DOM. A scene-targeted input uses
`{ scope: 'scene' }`. The address is not
hidden inside event `data`. An event changes behavior only through the actions
and rules declared for it; `telco.pause()` is a transport command regardless
of scenario naming.

The [telco guide](telco.md) owns transport commands, state/progress
subscriptions and their example. Diagnostic traces are a separate observation
surface and are not public scenario output. Event
subscriptions return an unsubscribe function to release at teardown. See the
[facade contract](../../../../packages/codplay/specs/facade-v2-spec.md).
Explicit shared-engine management is for multi-instance orchestration; normal
control of one occurrence stays on its instance.

## Role of each declaration and function

Scene/story/perso declarations are data objects. Their field names do not all
represent callable functions:

| Owner and member | Role in this example |
| --- | --- |
| Scene `id` | Identifies the authored scenario; it is not an instance ID |
| Scene `state` | Initial scene-level logical state, including `acknowledged` |
| Scene `stories` | Named story declarations in this one scenario |
| Scene `eventimes` | Common authored times: ready at 500 ms and terminal end at 10 seconds |
| Scene `listen` | Selects the scene-owned reaction to the story strap's immediate `welcome:confirmed` output |
| Scene `straps` | Contains the named scene functions, here `publish-confirmation` |
| Story `state` | Initial local state, here `interaction.confirmations` |
| Story `persos` | Declares the roles implemented by registered components |
| Story `eventimes` | Local timed occurrences, here the prompt at 1 second |
| Story `listen` / `straps` | Selects and implements that story's live reactions |
| Perso `id` / `type` | Identifies the role and chooses its component implementation |
| Perso `initial` | Initial component profile and placement |
| Perso `actions` | Named component action declarations; see [accepted forms, recipients and calculated values](perso-actions.md) |
| Perso `emit` | Declarative input binding; the button's `click` enters the player as a story event |
| Listener `on` | Exact source-event name to match |
| Listener `straps` | Ordered names of functions to execute in that listener's scope |

A listener can also declare `transform` functions or declarative `emit`
outputs. A transform receives an event descriptor and returns an ordered array
of descriptors or no output. Transforms receive the source event independently;
they are not an output-to-input chain. Declarative `emit` outputs follow the
straps; that field is not a continuous callback. Story-only `active` and `reset`
rules follow the isolation and reset contracts, not an invented story method.

### Scene lifecycle functions

| Function | Called for | Input and effect |
| --- | --- | --- |
| `scene.init(scene)` | Scene initialization | Receives scene data; the example logs its identity |
| `scene.onStart(scene)` | Playback starting from the ready state | Observes that start; it is not the callback for every frame or every resume |
| `scene.onSequenceEnd(scene)` | Terminal sequence completion | Observes completion; a Seek crossing the terminal boundary does not call it as a playback end |

These callbacks have a `void` result; they are not strap outputs and do not
become public scenario events automatically. Keep lifecycle observations on
the scene. Use [listen and straps](straps.md) for discrete reactions and
finite future outputs, and [event insertion](event-tracks.md) for external
commands. Those operations have their own explicit entry boundaries.

### Strap functions in this example

`confirm` reads the story confirmation count and returns an immediate update/
event plus a planned occurrence. `publish-confirmation` reads the triggering
name and returns a scene state update plus a public event. Neither mutates
input state or the DOM. The [strap guide](straps.md) owns their common complete
argument, output forms and each planned helper's role.

For source-event mappings and listener fields, read [transforms](transforms.md)
and [listen](listen.md). Continuous input uses [capture mode](capture.md).

### Functions implemented by the component

The persos in the example use the existing `tag` implementation. They do not
implement these methods themselves. A genuine custom component has the
following responsibilities, illustrated separately in
[component creation](component-extension.md):

| Component function | Role |
| --- | --- |
| Constructor | Receives validated/prepared dependencies and declares consumed services |
| `render()` on an HTML component | Supplies the template; the materializer creates its nodes |
| `initialize()` | Initializes owned state/sources after materialization and before the first logical update |
| `update(input)` | Projects the resolved state at `timeMs`; consumes optional target/action/animation inputs when applicable |
| `beforeSeek()` | Suspends owned sources before reconstruction |
| `afterSeek()` | Reconciles or resumes them after reconstruction |
| `onSequenceEnd()` | Handles transient resources at terminal completion |
| `onReset()` | Reconciles sources when the player resets |
| `destroy()` | Removes listeners and releases component-owned resources |

Services are provided to the component: `services.declare(names)` selects its
consumed services, `services.apply(node, patch)` projects those service values,
and `services.get(name)` obtains a declared service's `apply` operation. Native
components have no fake `render`; their presentation uses player-time samples
and the host's final commit. A component has no independent event clock.

## External-control example and method roles

These are application example functions, not new CodPlay methods or a required
wrapper. They receive an occurrence already created by the existing integration
or loaded from an exported package. The host calls the commands in response to
its own discrete UI decisions; observations are registered for its lifetime:

```ts
import type { CodPlayInstance } from 'codplay'

/** Observes the occurrence and returns cleanup for these subscriptions only. */
export function observeScene(instance: CodPlayInstance) {
  // Receives only events explicitly published to the outside during playback.
  const stopEvents = instance.events.onEvent((event) => {
    console.info('Public event', event.name, event.data)
  })
  // Releases this application's public-event observer only.
  return () => {
    stopEvents()
  }
}

/** Sends the immediate story command handled by the declared confirm listener. */
export async function confirmFromOutside(instance: CodPlayInstance) {
  await instance.events.emit(
    { name: 'welcome:confirm', visibility: 'story' },
    { scope: 'story', storyId: 'interaction' },
  )
}

/** Inserts a public scene occurrence; its actions/output are reached on a frame. */
export async function finishFromOutside(instance: CodPlayInstance) {
  await instance.events.emit(
    { name: 'welcome:finish', visibility: 'public' },
    { scope: 'scene' },
  )
}

```

`observeScene`'s callback receives a public scenario event. Its logging is
application work, not scene state or journal insertion. The returned cleanup
removes that event subscription. `confirmFromOutside` and `finishFromOutside`
both return promises and carry the target separately from event data. Transport
observation and the `inspectAtTime` example are in the [telco guide](telco.md).

The public injection boundary is important: a story-targeted command like
`welcome:confirm`, with matching listener, omitted/zero `startAt`, no nested
eventimes and story/omitted visibility, is dispatched live. An
ordinary scene-targeted injection is an eventime inserted into the journal;
it does not directly execute `scene.listen` and becomes visible/observable at
its next playback presentation. In this example the scene strap is reached
through the immediate output of the story strap, not through the outside
`welcome:finish` occurrence. A Seek can reconstruct recorded actions but does
not run those listeners or replay public observations. Do not promise the same
live-dispatch semantics for all `events.emit` targets.

For example: play to 1,000 ms and call `confirmFromOutside`; let playback
present the confirmation and the follow-up at 1,250 ms, then call
`finishFromOutside` at 1,300 ms. The two final changes have distinct logical
dates; this example does not depend on same-instant action priority. The next frame presents both Finished labels and the
public finish occurrence; the declared terminal event ends playback later.
The host releases observers when no longer needed and keeps occurrence/owner
teardown separate.

| Application example function | Role |
| --- | --- |
| `observeScene(instance)` | Installs public scenario-event observation and returns its cleanup |
| `confirmFromOutside(instance)` | Injects the story command that selects the local confirm strap |
| `finishFromOutside(instance)` | Inserts the public scene occurrence matching both Finished actions |

| Public function | Role |
| --- | --- |
| `events.emit(eventime, target)` | Inserts an eventime with separate addressing; matching immediate story commands dispatch live, ordinary scene inputs follow the journal/next-frame path |
| `events.onEvent(listener)` | Subscribes to public scenario output and returns unsubscribe |
| `stopEvents()` | Removes this public-event observer registration |
| Returned cleanup function | Calls the event unsubscriber; it does not destroy the player |

The instance also has diagnostic, snapshot, projection and presentation ports.
Their roles are described in [engine and instances](engine-and-instances.md)
and the facade specification; they do not add scenario events to the journal.
