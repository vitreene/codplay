# Runtime List Plugin

This feature implements the list plugin pipeline:

- diff (`added`, `removed`, `moved`)
- FLIP move transitions
- performance fallback (drop move transitions only)

Main modules:

- `compute-list-diff.ts`
- `run-list-plugin.ts`
- `create-list-plugin.ts`
