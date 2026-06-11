# Lot 06 tests

This folder contains the tests for:

- `L6-T1` `startWait` parallel keeps source running
- `L6-T2` `startWait` suspendSource freezes cursor and disables tracks
- `L6-T3` `resolveWait` resumes from frozen cursor and restores tracks
- `L6-T4` `resolveWait` supports `resumePolicy='fromStart'`
- `L6-T5` reject suspendSource without source story
- `L6-T6` reject resolve on unknown waitId

Reference:

- `evolution/lots/lot-06-wait-flow-runtime.md`
