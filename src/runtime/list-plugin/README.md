# Runtime List Plugin

Deprecated status:

- this folder belongs to one legacy runtime path
- the current component-based `ListComponent` does not use it
- keep only until the player POC/demo confirms it can be removed safely

This feature implements the list plugin pipeline:

- diff (`added`, `removed`, `moved`)
- FLIP move transitions
- performance fallback (drop move transitions only)

Main modules:

- `compute-list-diff.ts`
- `run-list-plugin.ts`
- `create-list-plugin.ts`
