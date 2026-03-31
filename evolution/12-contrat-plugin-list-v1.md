# Contrat plugin list V1

## 1) Portee

Ce document formalise le contrat I/O du plugin `list`.

References:

- spec list: `evolution/02-specifications-engine-v1.md` (sections 19 et 22)
- trace list: `evolution/06-machines-et-traces-v1.md` (section 11)

## 2) Points d'integration

- instanciation dans `createElement` pour tout item `type='list'`
- hooks autorises: `onAction`, `onTransition`, `onCommit`
- interdit: emettre de nouveaux events runtime

## 3) Entrees plugin (minimum)

```ts
type ListPluginInput = {
  runtimeListId: string
  nodeRef: unknown
  prevChildrenIds: string[]
  nextChildrenIds: string[]
  autoAnimate?: {
    insert?: boolean
    remove?: boolean
    move?: boolean
    durationMs?: number
    easing?: string
    staggerMs?: number
  }
  nowMs: number
}
```

## 4) Sortie plugin (minimum)

```ts
type ListPluginOutput = {
  diff: {
    added: string[]
    removed: string[]
    moved: string[]
  }
  transitions: TransitionDef[]
  commitPlan: {
    leaving: string[]
    detachAfterAnimation: string[]
  }
}
```

## 5) Regles de calcul diff

- `added`: id present dans `next` et absent dans `prev`
- `removed`: id present dans `prev` et absent dans `next`
- `moved`: id present dans les deux, mais position differente
- ordre stable base sur `nextChildrenIds`

## 6) Strategie d'animation V1

### `remove`

- passer l'enfant en etat `leaving`
- jouer animation de sortie
- detach physique en fin d'animation

### `move`

- snapshot `before` puis `after`
- appliquer FLIP pour eviter les sauts visuels

### `add`

- animation d'entree (opacity/transform) selon config `autoAnimate`

## 7) Regles media dans list

- le plugin list ne modifie jamais l'intent logique media
- en conflit, la commande globale player reste prioritaire
- un move visuel ne doit pas changer l'etat playable

## 8) Performance / fallback

- si trop d'elements a animer au meme tick, fallback degrade autorise
- fallback recommande: limiter animations `move`, conserver `add/remove`
- tracer la degradation: `list:perf:fallback`

## 9) Traces minimales obligatoires

- `list:diff:computed` (`added`, `removed`, `moved`)
- `list:child:enter`
- `list:child:leave:started` / `list:child:leave:done`
- `list:child:move:flip`

## 10) Rebuild et identite

- `rebuild=state`: plugin conserve son identite et son `nodeRef`
- `rebuild=full`: plugin recree avec la nouvelle instance runtime
