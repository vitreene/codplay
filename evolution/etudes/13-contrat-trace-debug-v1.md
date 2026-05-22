# Contrat trace et debug V1

## 1) Portee

Ce document formalise le schema de trace et les filtres debug.

References:

- `evolution/06-machines-et-traces-v1.md`
- `evolution/09-catalogue-events-techniques-v1.md`

## 2) Schema de trace canonique

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

Regles V1:

- `traceMs`, `machine`, `id`, `from`, `event`, `to`, `status` obligatoires
- `reason` obligatoire quand `status='REJECTED'`
- `eventId` recommande pour relier trace et timeline event

## 3) Filtres debug

```ts
type TraceFilter = {
  machine?: 'player' | 'scenario' | 'story' | 'playable'
  id?: string
  status?: 'APPLIED' | 'REJECTED'
  eventPrefix?: string
  reason?: string
  fromMs?: number
  toMs?: number
  correlationId?: string
  limit?: number
}
```

Regles V1:

- filtres combines en `AND`
- tri resultat: `traceMs` ascendant
- `limit` applique en fin de filtrage

## 4) API debug attendue

```ts
type DebugApi = {
  getTick: () => { nowMs: number; prevMs: number }
  getQueue: () => TimelineEvent[]
  getTrace: (filter?: TraceFilter) => MachineTraceRow[]
  clearTrace: () => void
}
```

## 5) Exigences de retention

- mode `player`: retention minimale (taille bornee)
- mode `debug`: retention etendue (export possible)
- depassement de buffer: eviction FIFO + compteur d'evictions

## 6) Exigences de coherence

- toute commande API critique doit produire au moins une trace
- tout rejet doit etre tracable avec `reason`
- les noms d'events de trace doivent correspondre au catalogue `09`
