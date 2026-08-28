# Project Working Rules

## Code style and structure

- Write code that is easy to read and extend later.
- Use English for function names and variable names.
- Use kebab-case for file names.
- Isolate each feature in its own dedicated folder.
- Add function comments describing each function role.
- JavaScript classes are allowed when useful.

## Implementation process

- Ask the user questions when implementation certainty is below 95%.
- Respect established specs strictly. Do not patch behavior opportunistically when the implementation diverges from the spec.
- If a gap, ambiguity, or design failure is discovered, stop and discuss how to enrich or correct the spec before changing the implementation.
- Demos exist to validate the project and reveal missing pieces; they must not hide gaps or be made to work at all costs.
- CodPlay core capabilities are approaching v1. Adding to or modifying `packages/codplay` core requires explicit user authorization and must always be the consequence of an agreed plan. No opportunistic or speculative core patches.
- Additional instructions may be added later and should be followed.

## Hard implementation gates

- Treat the established V2 specifications and accepted decisions as authoritative. Do not replace them with an interpretation inferred from partial code, a failing demo, or a familiar framework pattern.
- When porting a V1 capability to V2, preserve the documented V1 behavior unless an explicit V2 decision changes it. Port the semantics across the V2 boundaries; do not recreate a parallel V1 circuit.
- Before editing code, identify the applicable specification, the accepted plan item, the invariants to preserve, and the acceptance path that will prove the change.
- Do not edit code while the relevant plan is marked `A relire`. Every code change must map to an accepted plan item.
- If the implementation and the specification diverge, stop and report the divergence. Do not hide it with a fallback, a compatibility bridge, a direct final-state patch, or a demo-only shortcut.
- Do not implement a plan item whose plan or decision is marked `A relire`. A plan is not a contract until it has been validated.
- Do not invent missing contracts, APIs, services, event phases, runtime actions, or data paths. Mark the gap and ask for clarification when the specification does not decide it.
- Demos are validation fixtures. They must exercise the real runtime path and must not introduce duplicate catalogs, duplicate remotes, alternate event circuits, or behavior that exists only to make the demo appear functional.
- In `packages/demos/src/v2`, `layout/` owns the complete shared page: header, title, selector, remote, journal, engine/instance lifecycle, and scene host. Each `demos/<demo-id>/` module only constructs and returns its scene; it must not render a page or recreate those shared services.
- Any unavoidable temporary bridge must be explicitly named or documented as `temp`, have a stated scope and removal condition, and must not be presented as a V2 contract.
- A passing isolated unit test, typecheck, or build does not validate an integration. For browser-facing behavior, test the actual event, player, materializer, seek, replay, and lifecycle boundaries involved.
- A demo is valid only after the real runtime path has been tested.
- V2 demos are pre-release validation references, not disposable bug fixtures. A fix in a complex component must not be accepted from one visual symptom or one passing scenario.
- Before declaring such a fix stable, record the causal analysis and run the complete relevant validation set: focused regression tests for the failing boundary, non-regression tests for affected parent/child and reparent cases, and the applicable Play, Seek, resize, persistence, lifecycle, typecheck, test, build, and Safari checks. Omit categories only when the analysis explicitly proves they are not affected.
- If this evidence is incomplete, keep the implementation `En cours` or `A relire`; do not present it as stabilized and do not modify the demo to hide the defect.
- `README.md` files document usage. They are not the authority for internal contracts. Stable contracts belong in the applicable specifications; plans track implementation work and validation status.
- Keep the specification, plan, implementation status, and acceptance tests aligned. Never mark a module or tranche complete while a required behavior is only simulated, bypassed, or unverified.

## Documentation and implementation tracking

- Keep plans and implementation tracking up to date until the corresponding work is complete.
- Keep resolved situations that explain the current design; do not keep investigation history merely for its chronology.
- Once a concept is implemented, maintain a focused specification for future agents: its role, contract, invariants, decisions, and how to understand it without rereading the entire implementation.
- At the end of each task, update the relevant specification and implementation tracking before closing temporary notes or provisional guardrails.
- Before resuming CodPlay V2 work, read [`packages/codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md`](packages/codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md) after identifying the applicable detailed plan.

## Module status

- Every module README starts with a visible status and the target CodPlay version.
- `En cours` means design or implementation is active; proposals are not contracts.
- `Fixe` means the module contract and decisions are stable, even if implementation remains.
- `A relire` marks a module or decision that requires explicit review before dependent work.
- `Fini` means the module is implemented, tested, documented, and complete for the stated CodPlay version.
- Never mark a module `Fini` to make a prototype appear complete; change the status back when a new gap is found.

## Current workspace note

- The root `src/` currently contains the default Vite demo and may be removed.
