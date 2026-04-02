# Lot 11 - media sync avancee + master switching

## Objectif

Introduire un runtime media dedie qui garantit un master unique actif, applique le basculement de master sans double playback et corrige la derive temporelle au-dela d'un seuil configurable.

## Fonctions noyau

- `createMediaSyncRuntime(options?)`
  - `registerTrack(track)`
  - `registerMedia(media)`
  - `applyTrackStatePatches(patches)`
  - `setPlayerPlaybackState(state)`
  - `syncMasterToTimeline(expectedMediaMs)`
  - `refreshMaster()`
  - `updateMediaSnapshot(runtimeItemId, patch)`
  - `getActiveMasterRuntimeItemId()`
- `appendMediaTraceEntries(store, entries, correlationId?)`
  - mapping des traces media vers le store runtime centralise

## Contrat runtime

- un seul media `master` actif a la fois dans la scene
- la selection du master respecte l'ordre track (`order` ascendant), puis ordre d'enregistrement
- sur switch de master:
  - pause de l'ancien master en premier
  - play du nouveau master ensuite (si intent logique `playing` et player global `playing`)
- correction de derive:
  - trace `media:sync:corrected` uniquement si `abs(driftMs) > thresholdMs`
  - en-dessous du seuil, aucune correction n'est emise
- la commande globale player garde la priorite sur playback media:
  - `paused` force pause master
  - `playing` ne force pas replay d'un media logiquement `ended`

## Scenarios de test (DoD)

- `L11-T1` selection d'un master unique sur track active
- `L11-T2` bascule FR -> EN sans double playback master
- `L11-T3` correction derive > seuil avec trace normative
- `L11-T4` absence de correction derive <= seuil
- `L11-T5` priorite du state player sur playback media + respect `ended`
- `L11-T6` export des traces media via `trace-store`

## Critere de passage

- 6 tests verts (`tests/lot11`)
- non-regression lots 1 a 10
