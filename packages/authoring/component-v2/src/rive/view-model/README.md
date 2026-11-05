# Rive ViewModel

Attach `rive-view-model` to a Rive host and name the exported state machine,
ViewModel, and instance. Send root number or boolean property values in the
story's events.

```ts
{
  id: 'expression',
  type: 'rive-view-model',
  initial: {
    rel: { host: 'avatar' },
    stateMachine: 'Matt_Visemes_SM',
    viewModel: 'VisemesVM',
    instance: 'Instance',
    blendSpeed: 18,
    values: { v100: 100, v102: 0, isTalking: false },
  },
  actions: {
    speak: { values: { v100: 0, v102: 100, isTalking: true } },
    rest: { values: { v100: 100, v102: 0, isTalking: false } },
  },
}
```

`blendSpeed` smooths numeric values over player time; booleans such as
`isTalking` change immediately. See the
[Rive core guide](../core/README.md) for host and preload setup.
