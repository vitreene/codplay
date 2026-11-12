---
name: elce-mod
description: Create an Elcé mod or change how a mod composes shared capabilities. Use for mod definitions, selection, or composition; not for an isolated feature inside one mod.
---

# Elcé mod work

Use this skill to evolve Learning or Quiz Hunt, or add a mod under an accepted
plan while preserving the documented boundaries.

## Before changing code

- Read the repository `AGENTS.md`, the active [mods consolidation plan](../../../packages/elce/mods/plan/2026-11-09-elce-mods-consolidation-plan.md), the stable [mods decisions](../../../packages/elce/mods/plan/2026-10-20-elce-mods-reconfiguration-plan.md), and the specifications that own the affected behavior. Do not implement a plan item marked `A relire`.
- Decide whether the change belongs to Learning, Quiz Hunt, a shared resource, or Elcé `core/`. Reuse the existing document actor, command, commit, persistence, and synchronization circuits.
- Keep reusable business behavior in its owning resource or shared core capability. Each mod owns its document rules, content creation, game or learning flow, and explicit compositions.
- The authoring route selects the mod: `/learning/:documentId` selects Learning and `/hunt/:documentId` selects Quiz Hunt. `/` and `/new` use the common chooser, with Learning as the initial selection and Quiz Hunt under « Autre… ». `?mod=quiz-hunt` identifies the Quiz Hunt preview; it does not select authoring.
- Composition is direct TypeScript. Do not introduce a generic plugin registry, cross-mod import, alternate persistence or event path, or a second document discriminator. `projects.mod_key` scopes the shared server catalog; the document formats and codecs remain owned by their mods.
- Before editing, identify the accepted plan item, verified contract, invariants, files, and real acceptance path. Do not modify `packages/codplay` without explicit authorization and an accepted plan item.

## Composition entry points

| Context | Learning | Quiz Hunt |
| --- | --- | --- |
| Authoring | [`authoring-composition.tsx`](../../../packages/elce/src/mods/learning/composition/authoring-composition.tsx) | [`quiz-hunt-authoring-composition.tsx`](../../../packages/elce/src/mods/quiz-hunt/composition/quiz-hunt-authoring-composition.tsx) |
| Preview | [`preview-composition.tsx`](../../../packages/elce/src/mods/learning/composition/preview-composition.tsx) | [`quiz-hunt-preview-composition.tsx`](../../../packages/elce/src/mods/quiz-hunt/composition/quiz-hunt-preview-composition.tsx) |
| Server API | [`server-composition.ts`](../../../packages/elce/src/mods/learning/composition/server/server-composition.ts) | [`quiz-hunt-server-composition.ts`](../../../packages/elce/src/mods/quiz-hunt/composition/server/quiz-hunt-server-composition.ts) |

[`browser-entry.tsx`](../../../packages/elce/src/app/remix/browser-entry.tsx) selects browser compositions from the route. The local server composes both API routes and selects shared plus mod-owned stylesheets. The shared SQLite database loader is [`elce-project-database.ts`](../../../packages/elce/src/server/elce-project-database.ts): historical Learning migrations remain in `src/server/sqlite/migrations/legacy-learning/`, and Quiz Hunt migrations remain with Quiz Hunt persistence.

## Implement and validate

- Put new mod-specific definitions, document behavior, and composition under `packages/elce/src/mods/<id>/`. Keep resource business rules in `packages/elce/src/resources/`; extend Elcé `src/core/` only for a verified behavior shared by multiple owners.
- Keep adapters explicit at the boundary. Do not make `core/` or a resource import a mod, and do not let one mod import another.
- Preserve IDs, JSON formats, routes, database discriminants, command semantics, and status codes unless the accepted plan explicitly changes them. Place a new migration with the owner of the changed capability; the historical Learning directory is not a destination for new migrations.
- Run `npm run check:architecture`, `npm run typecheck`, `npm test`, and `npm run build` from `packages/elce/`, not the repository root. Add focused coverage for the affected boundary and use the real browser composition for integration checks; a typecheck or build alone does not prove that path.
- Update the owning specification in the same task only after the behavior is implemented and verified. Keep open acceptance and unverified behavior in the active mods plan. Write package READMEs as user guides with a concrete usage example; keep internal contracts in specifications.
