# Lot 09 - trace/debug retention + export

## Objectif

Ajouter un stockage de traces runtime centralise avec retention et export.

## Fonctions noyau

- `createRuntimeTraceStore(options?)`
  - `append(row)` / `appendMany(rows)`
  - `list(filters?)`
  - `clear()` / `size()`
  - `exportJson(filters?)` / `exportNdjson(filters?)`
- adaptateurs de mapping:
  - `appendAnimationTraceEntries(store, entries, correlationId?)`
  - `appendWaitTraceEntries(store, entries, correlationId?)`
  - `appendListTraceEntries(store, entries, correlationId?)`

## Contrat runtime

- retention FIFO: quand la capacite est depassee, les plus anciennes traces sont supprimees
- filtrage deterministic par `scope`, `eventName`, `status`, `sourceId`, `correlationId`, bornes temporelles
- export lisible:
  - JSON array
  - NDJSON (une ligne par trace)

## Scenarios de test (DoD)

- `L9-T1` retention supprime les traces les plus anciennes
- `L9-T2` list applique les filtres et limites
- `L9-T3` export JSON/NDJSON respecte les filtres
- `L9-T4` mapping trace animation -> trace runtime
- `L9-T5` mapping wait/list -> trace runtime avec `sourceId`

## Critere de passage

- 5 tests verts (`tests/lot9`)
- aucun impact regressif sur lots 1 a 8
