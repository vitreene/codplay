# Runtime Core

Status: Fixe
CodPlay version: V1 reference

Current implementation targets:

- `create-element.ts`
- `mount-elements.ts`
- `components/`
- `wait-flow.ts`
- `list-plugin/`
- `flip-engine/`
- `trace-store.ts`
- `html-render-mutation-resolver.ts`
- `render-mutation-resolver.ts`
- `media-sync.ts`
- `types.ts`

Reference:

- `evolution/lots/lot-04-create-element-minimal.md`
- `evolution/lots/lot-06-wait-flow-runtime.md`
- `evolution/lots/lot-07-list-plugin-diff-flip-fallback.md`
- `evolution/lots/lot-08-flip-engine-etude-spec.md`
- `evolution/lots/lot-09-trace-debug-retention-export.md`
- `evolution/lots/lot-10-conflits-same-tick-runtime.md`
- `evolution/lots/lot-11-media-sync-master-switching.md`

Notes:

- Renderer runtime routes updates through `components/` orchestrator.
- Same-tick conflict resolution lives in `html-render-mutation-resolver.ts` (`resolveHtmlRenderMutations`), exercised directly by `tests/v1/render-mutation-resolver.spec.ts`.
