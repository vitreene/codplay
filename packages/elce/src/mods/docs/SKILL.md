---
name: elce-mod
description: Create a new Elcé mod or change mod-level composition, definition, or selection. Use for work that changes how an Elcé mod connects to shared core capabilities; not for an isolated feature change inside Learning.
---

# Elcé mod work

Use this skill to create or evolve an Elcé mod while preserving the accepted core, resource, and mod boundaries.

## Before changing code

- Read the repository `AGENTS.md`, the active [Mods plan](../../../mods/plan/2026-10-20-elce-mods-reconfiguration-plan.md), and the specifications that own the affected behavior.
- Decide whether the request changes Learning or introduces another mod. Treat Learning as the current working example, not as a universal API to copy unchanged.
- Map each responsibility to `core/`, `resources/`, or `mods/<id>/`. Reuse the existing actor, command, commit, persistence, and synchronization circuits.
- The accepted Mods plan uses direct TypeScript composition and no generic plugin registry. The current browser and server entrypoints select Learning explicitly; project identity and multi-mod resolution are deferred until a second mod. Do not invent `modId`, dispatch, or core ports. If the requested work depends on one of these decisions, record the exact gap in the Mods plan and stop only the dependent implementation.

## Implement and validate

- Before editing, identify the accepted plan item, verified contract, invariants, files, and real acceptance path. Do not modify `packages/codplay` core without explicit authorization and an accepted plan item.
- Keep mod-specific definitions, document behavior, and compositions under `packages/elce/src/mods/<id>/`. Place reusable business behavior in its owning resource; extend core only for a verified cross-mod capability.
- Include `README.md` and `SKILL.md` in the mod folder. Keep their examples and resource links relative to that folder, adapting them when the mod is copied. A local Codex discovery entry may link to this bundled skill.
- Validate the actual public composition path for the requested contexts. A typecheck or build alone does not prove that a mod reaches core correctly. Run tests from the owning package, not the repository root; use browser MCP only when its live tools and configured server have been checked.
- Update the owning specification only for behavior that has been implemented and verified. Keep unresolved choices and remaining acceptance in the Mods plan. Write README files for developers: briefly explain the parts, mechanisms, and a concrete example, linking the owning specifications for detailed contracts.
