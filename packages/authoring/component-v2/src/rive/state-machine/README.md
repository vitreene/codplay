# Rive state machine

Attach `rive-state-machine` to a Rive document host with `rel.host`. Send
named input values or native playback commands through story events.

```ts
{
  id: 'machine',
  type: 'rive-state-machine',
  initial: {
    stateMachine: 'Guide machine',
    rel: { host: 'avatar' },
  },
  actions: {
    start: { broadcast: { type: 'START' } },
    smile: { inputs: { smile: true } },
  },
}
```

Place `start` at the beginning of the scene and `smile` at the authored time.
For exported ViewModel properties, see the separate
[ViewModel component](../view-model/README.md). The shared host and preload
setup are covered in the [Rive core guide](../core/README.md).
