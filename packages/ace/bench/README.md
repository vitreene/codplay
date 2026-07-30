# ACE benchmarks

Run `npm run bench --workspace=@codplay/ace` from the repository root.

The benchmark resolves prepared tweens only. It deliberately excludes DOM work, rendering,
CSS parsing and clock scheduling so that it measures the ACE hot path in isolation.
