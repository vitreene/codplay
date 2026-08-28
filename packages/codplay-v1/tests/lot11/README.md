# Lot 11 tests

Status: Fixe
CodPlay version: V1 reference

This folder contains the tests for:

- `L11-T1` one active master is selected from active tracks
- `L11-T2` master switching pauses old master before playing new one
- `L11-T3` sync correction is emitted only when drift exceeds threshold
- `L11-T4` no correction trace is emitted within threshold
- `L11-T5` global player state drives master playback and respects ended intent
- `L11-T6` media traces map into runtime trace store exports

Reference:

- `evolution/lots/lot-11-media-sync-master-switching.md`
