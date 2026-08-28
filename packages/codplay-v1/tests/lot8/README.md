# Lot 08 tests

Status: Fixe
CodPlay version: V1 reference

This folder contains the tests for:

- `L8-T1` FLIP capture reads real geometry/transform inputs
- `L8-T2` FLIP plan computes x/y/width/height interpolation
- `L8-T3` FLIP run enforces anti-flicker frame orchestration (`FIRST/LAST/INVERT/rAF/PLAY`)
- `L8-T4` FLIP plan maps world delta into local delta with transformed parent
- `L8-T5` FLIP emits additive anime channels with `composition=merge`
- `L8-T6` real animejs integration animates intermediate values
- `L8-T7` optional mode skips pre-invert transform and keeps `from/to` channels
- `L8-T8` FLIP plan accounts for target pre-transform matrix orientation
- `L8-T9` base transform is preserved when pre-invert is disabled
- `L8-T10` repeated reorder runs do not accumulate drift

Reference:

- `evolution/lots/lot-08-flip-engine-etude-spec.md`
