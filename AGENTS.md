# Project Working Rules

## Code style and structure

- Never address the user with the formula “Tu as raison :”.
- Write code that is easy to read and extend later.
- Keep authored models, configuration, and CSS readable and easy to enrich.
  Compilation owns compaction and optimization of generated output; preserve
  source semantics and references instead of making developers maintain the
  compact representation by hand.
- In Editor, authored lengths, palette controls, and persisted data use cqw.
  Keep physical pixel measurements confined to transient DOM projection;
  never convert or save authoring values in pixels.
- Apply KISS and DRY: prefer the simplest implementation that satisfies the established contract, reuse existing logic, and avoid speculative abstractions, wrappers, and duplicated circuits.
- Use English for function names and variable names.
- Use kebab-case for file names.
- Isolate each feature in its own dedicated folder.
- Add function comments describing each function role.
- JavaScript classes are allowed when useful.
- Every parent element in authored `markup` must have an explicit `id`; never
  leave an authored parent element anonymous.

## Project vocabulary

- The architectural term `shell` is forbidden in identifiers, class names,
  filenames, comments, documentation, and UI labels. Use a role-specific term
  such as `layout`, `frame`, `stage`, or `host` instead.

## Randomness

- Throughout the project, random behavior means pseudo-random behavior derived
  from an initial seed. Perform an initial draw by default; the seed is editable
  and remains stable during editing, with automatic renewal inactive, so question
  sequences can be reproduced. In distribution mode, the Random option is checked
  by default and renews the seed for each new game, including Restart. With Random
  disabled, retain the fixed seed and its reproducible draw.

## Implementation process

- Ask the user questions when implementation certainty is below 95%.
- Before any analysis or modification, reread the applicable specifications and contracts in the repository; do not rely on conversation summaries or assumptions.
- For every browser validation or other MCP-backed task, inspect both the local MCP server configuration and the complete live tool inventory offered by the current session before starting. Compare configured servers with the tools actually exposed here and review their names and descriptions; do not decide availability from a name-only search for `browser` or `Safari`. Use only the exposed tools, and never infer availability from installed applications, previous sessions, or another machine. If a configured server has no callable tools in this session, report that work as pending instead of launching a different local application or treating it as equivalent.
- During browser validation, bring the configured, already connected browser
  to the foreground and select the intended tab yourself. Do not ask the user
  to focus Safari or make Elcé visible. When Safari Technology Preview is the
  verified connected browser, activate it with
  `osascript -e 'tell application "/Applications/Safari Technology Preview.app" to activate'`
  (using the required execution permission when sandboxed), select its tab
  through Safari MCP, and verify `document.visibilityState` and
  `document.hasFocus()` before editing. Preserve the application's normal
  focus and edit-access rules; never simulate visibility or bypass its locks.
- Do not put working instructions in specifications. Maintain the owning
  internal specification whenever an accepted change implements and verifies
  behavior; keep open or agreed-but-unapplied decisions in the working plan.
- Respect established specs strictly. Do not patch behavior opportunistically when the implementation diverges from the spec.
- If a gap, ambiguity, or design failure is discovered, stop and discuss how to enrich or correct the spec before changing the implementation.
- V2 demos are instruments for advancing CodPlay, not local demo products. They exercise the real project contracts, expose missing or incorrect core behavior, and provide the concrete acceptance path for fixing it. When a demo fails, first investigate and correct the applicable CodPlay contract or runtime; a demo-local change is allowed only to express the authored scenario or to make the fixture observe the agreed behavior, never to hide, compensate for, or replace a missing core capability.
- A demo failure is therefore project evidence, not an isolated presentation problem. Any proposed demo-local correction must state which CodPlay contract it validates, why the runtime is not the responsible boundary, and how the real runtime path remains exercised.
- CodPlay core capabilities are approaching v1. Adding to or modifying `packages/codplay` core requires explicit user authorization and must always be the consequence of an agreed plan. No opportunistic or speculative core patches.
- CodPlay is a shared library used by several projects. Never change its core
  to accommodate Editor-specific circumstances or another caller's local
  implementation choices. A core correction must address a genuine usage bug,
  reproduced independently of the local workaround and assessed against the
  shared contract and other projects' usage. A local symptom or a missing
  convenience for an integration is not sufficient justification. The existing
  explicit-authorization and agreed-plan gates still apply; identifying such
  a bug does not itself authorize a core change.
- Additional instructions may be added later and should be followed.

## Hard implementation gates

- For every new feature, first verify whether an existing circuit already handles
  the same concern and use that circuit. Do not create a parallel circuit unless
  an imperative architectural reason is established, documented in the accepted
  plan, and covered by an explicit acceptance path.
- Treat verified V2 specifications as authoritative for certified behavior. Keep decisions that are open or agreed but unapplied in the active plan; do not present them as verified contracts or infer replacements from partial code, a failing demo, or a familiar framework pattern.
- When porting a V1 capability to V2, preserve the documented V1 behavior unless an explicit V2 decision changes it. Port the semantics across the V2 boundaries; do not recreate a parallel V1 circuit.
- Before editing code, identify the applicable specification, the accepted plan item, the invariants to preserve, and the acceptance path that will prove the change.
- Do not edit code while the relevant plan is marked `A relire`. Every code change must map to an accepted plan item.
- If the implementation and the specification diverge, stop and report the divergence. Do not hide it with a fallback, a compatibility bridge, a direct final-state patch, or a demo-only shortcut.
- Do not implement a plan item whose plan or decision is marked `A relire`. A plan is not a contract until it has been validated.
- Do not invent missing contracts, APIs, services, event phases, runtime actions, or data paths. Mark the gap and ask for clarification when the specification does not decide it.
- Demos are validation fixtures. They must exercise the real runtime path and must not introduce duplicate catalogs, duplicate remotes, alternate event circuits, or behavior that exists only to make the demo appear functional.
- Tests must own their fixtures and values; they must not depend on demo scenes, timings, assets, or expected values, and behavioral tests must not be added to demos.
- In `packages/demos/src/v2`, `layout/` owns the complete shared page: header, title, selector, remote, journal, engine/instance lifecycle, and scene host. Each `demos/<demo-id>/` module only constructs and returns its scene; it must not render a page or recreate those shared services.
- Any unavoidable temporary bridge must be explicitly named or documented as `temp`, have a stated scope and removal condition, and must not be presented as a V2 contract.
- A passing isolated unit test, typecheck, or build does not validate an integration. For browser-facing behavior, test the actual event, player, materializer, seek, replay, and lifecycle boundaries involved.
- A demo is valid only after the real runtime path has been tested.
- V2 demos are pre-release validation references, not disposable bug fixtures. A fix in a complex component must not be accepted from one visual symptom or one passing scenario.
- Before declaring such a fix stable, record the causal analysis and run the complete relevant validation set: focused regression tests for the failing boundary, non-regression tests for affected parent/child and reparent cases, and the applicable Play, Seek, resize, persistence, lifecycle, typecheck, test, build, and browser checks. Omit categories only when the analysis explicitly proves they are not affected.
- If this evidence is incomplete, keep the implementation `En cours` or `A relire`; do not present it as stabilized and do not modify the demo to hide the defect.
- A `README.md` is a user guide for a feature or package: it explains the purpose in plain language and shows at least one concrete usage example. It is not the authority for internal contracts. Verified, stable contracts belong in the applicable specifications; plans track implementation work, validation status, and decisions that are open or agreed but unapplied. A README must not contain internal contracts, architecture, implementation status, plans, or validation tracking.
- Keep the owning specification, accepted working plan, implementation, and acceptance tests aligned. Never mark a module or tranche complete while a required behavior is only simulated, bypassed, or unverified.

## Documentation and implementation tracking

- Plans must be short, operational, and useful for decision-making. Keep only
  concise decisions to make, their status, ordered actions, and acceptance
  criteria. Name the files or owners to change, what is replaced, and the
  expected result. Keep small concrete examples needed to evaluate the proposal;
  brevity must not turn the plan into an abstract summary. General intentions
  are not decisions. Keep extended discussions, decisions, rationale, research,
  and examples in notes, linked from the plan. Do not write plans as
  conversations or duplicate commentary across documents.
- Documentation roles are exclusive and must not be mixed:
  - `notes/` records project elaboration, exploration, and rationale; open decisions for an active feature stay in its plan;
  - `plan/` records actions to perform, their order, gates, status, acceptance path, and decisions that are open or agreed but unapplied;
  - specifications record only behavior that has been implemented and verified;
  - `README.md` records only simple user-facing usage, with an illustrated concrete example; it must not contain internal contracts, architecture, implementation status, plans, or validation tracking.
- A `*-reprise-report.md` is a handoff report, not a living documentation surface. Do not append project elaboration, implementation specification, or user instructions to it. Put each new content in the one appropriate category above; if an action must be retained, record it in the applicable plan, not in the report.
- Keep plans and implementation tracking up to date until the corresponding work is complete.
- Keep resolved situations that explain the current design; do not keep investigation history merely for its chronology.
- Once a concept is implemented, maintain a focused specification for future agents: its role, contract, invariants, decisions, and how to understand it without rereading the entire implementation.
- Specifications are authoritative for interpreting a feature's verified behavior. Plans retain decisions that are open or agreed but unapplied, plus their implementation and acceptance work; notes record exploration and rationale. A plan does not override verified behavior in a specification.
- **Disposition dated 2026-09-26 — spec-first code understanding and maintenance:** For future CodPlay work, use the applicable specification first and canonically to understand verified behavior and identify its established circuit and owner; read the active plan for decisions and work that remain open or unapplied. Do not reread code already covered by a specification merely to rediscover its contract. Consult implementation, callers/adapters, and tests when resolving a gap the specification leaves open, investigating a concrete signal of divergence, or validating an accepted plan item. Extend the identified circuit instead of creating a parallel one. For every accepted improvement, update the owning specification in the same task to reflect the behavior implemented and verified, with links to its evidence; update the plan with any acceptance work that remains. Do not close the task until the specification, implementation, tests, and plan agree. If the specification is incomplete, a decision remains open, or a divergence is found, record the evidence and unresolved point in the owning plan and stop dependent implementation until the contract is clarified. This disposition does not authorize core code changes; the existing authorization and accepted-plan gates still apply.
- Remove preparatory notes when the plan they support is complete. Transfer verified behavior and acceptance evidence into the relevant specification; keep any open or agreed-but-unapplied decision in an active plan before removing the note.
- Remove a completed plan when a specification covers its feature. Before removal, transfer verified behavior and acceptance evidence into the specification and update incoming links and status indexes. A plan with an agreed but unapplied decision is not complete.
- At the end of each task, update the relevant specification and implementation tracking before closing temporary notes or provisional guardrails.
- Before resuming CodPlay V2 work, use the applicable verified specification
  and detailed plan, located through `packages/codplay/plan/codplay-v2-plan.md`.
  Keep stabilization work distinct from the future evolution plans indexed there.
- Internal technical specifications are mandatory maintained references for
  agents. They explain verified project behavior so an agent can understand it
  from the specification before reading implementation code. Keep the owning
  specification current in the same task as each implemented and verified change.
  Consolidate the existing specification; create one only when no existing
  specification owns the concern. Never create a specification per intervention.
- Final project documentation deliverables are retained at the user's explicit
  request. Internal technical specifications remain necessary independently of
  those deliverables. Do not automatically create additional reports, READMEs,
  indexes, or copies for each task, correction, or validation.
- Study notes, working plans, and review drafts are disposable aids. Keep only
  what is necessary for active work and continuity; do not multiply files or
  duplicate content. A draft named `spec` must be reviewed and consolidated into
  the owning specification before it can serve as a verified reference.
- Document roles are exclusive:
  - Study notes collect remarks, questions, observations, research, alternatives,
    reasoning, and decision rationale. They provide the material from which a
    precise, concise plan can be derived. Keep this elaboration out of plans.
  - A plan states the objective, scope, accepted decisions, open decisions,
    ordered actions, affected files or owners, dependencies, and acceptance
    criteria. Update those items rather than appending accounts of interventions.
  - An execution-plan version must let another agent begin implementation from
    that version alone, without reconstructing the conversation or reading the
    study notes. Include the necessary context, applicable contracts, existing
    circuit and owner, changes to perform, invariants, prerequisites, and concrete
    validation steps. Keep the supporting discussion in the study notes.
  - A specification describes the implemented and verified system:
    purpose, responsibilities, mechanisms, contracts, invariants, and limits.
    It contains no progress status, work history, intervention dates, execution
    results, or narrative account of the agent's actions. Useful references to
    implementation or tests may support the description without becoming logs.
- Pre-delivery review is an action, not another document. Before closing the
  task, check the owning specification against implementation and evidence,
  remove work-report content, and consolidate the verified description.
- Report changes, validation results, and remaining difficulties in the final
  task response. Do not copy that report into project documentation unless the
  user explicitly requests a retained report.
- Reuse and consolidate existing working material instead of creating parallel
  versions, per-task reports, or additional tracking files. Do not create a file
  merely to record that a rule was followed or an action was performed.
- At project completion, retain internal reference specifications and the
  documentation deliverables requested by the user. Remove disposable working
  material once it is no longer needed. Preserve unresolved work needed for
  continuity; never remove existing project references merely because they have
  not yet been reviewed under these rules.
- Existing verified specifications remain authoritative for established behavior.
  Read the applicable specification first to identify the contract, circuit, and
  owner, then the active plan for open or unapplied decisions. Consult code and
  tests to resolve gaps, investigate a concrete divergence, or implement accepted
  work. Extend the established circuit. Stop dependent implementation when a
  contract is missing or a divergence requires a decision. These rules do not
  authorize CodPlay core changes or bypass accepted-plan gates.
- A handoff report is a snapshot for transfer, not an accumulating journal or
  a substitute for study notes, an execution plan, or a delivered specification.
- Before resuming CodPlay V2 work, read [`packages/codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md`](packages/codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md) after identifying the applicable detailed plan.

## Module status

- Module status belongs in the applicable plans and implementation tracking, not in README files.
- `En cours` means design or implementation is active; proposals are not contracts.
- `Fixe` means design decisions are accepted and stable. Any part not yet applied stays in the plan; the specification records it only after implementation and verification.
- `A relire` marks a module or decision that requires explicit review before dependent work.
- `Fini` means the module is implemented, tested, documented, and complete for the stated CodPlay version.
- Never mark a module `Fini` to make a prototype appear complete; change the status back when a new gap is found.

## Current workspace note

- The root `src/` currently contains the default Vite demo and may be removed.

# Style Guide

## General Principles

- Keep things in one function unless composable or reusable
- Validate unknown values once at the boundary that owns them. Pass typed values inward instead of repeating typeof value === "object" and property-existence checks. Do not defensively revalidate values already guaranteed by a schema, constructor, or internal type.
- Do not extract single-use helpers preemptively. Inline the logic at the call site unless the helper is reused, hides a genuinely complex boundary, or has a clear independent name that improves the caller.
- Before adding complexity for a speculative or vanishingly unlikely race or security edge case, explain the concrete failure mode, likelihood, and complexity cost to the user and get their buy-in. Do not silently expand scope for theoretical robustness.
- Avoid try/catch where possible
- Avoid using the any type
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream
- In Effect generators, bind services to named variables before calling methods. Do not use nested service yields such as yield* (yield* Foo.Service).bar().

## Imports

- Prefer dynamic imports for heavy modules that are only needed in selected code paths, especially in startup-sensitive entrypoints. Destructure dynamic import bindings near the top of the narrowest scope that needs them so they read like normal imports. Avoid inline chains such as await import("./module").then((mod) => mod.value()) or (await import("./module")).value(). Keep branch-specific imports inside the branch that needs them to preserve lazy loading.

## Variables

Prefer const over let. Use ternaries or early returns instead of reassignment.

```js
// Good
const foo = condition ? 1 : 2;

// Bad
let foo;
if (condition) foo = 1;
else foo = 2;
```

## Control Flow

Avoid else statements. Prefer early returns.

```js
// Good
function foo() {
	if (condition) return 1;
	return 2;
}

// Bad
function foo() {
	if (condition) return 1;
	else return 2;
}
```

## Testing

- Avoid mocks as much as possible, you shouldn't be using globalThis.\* at all unless it's the only option.
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: do-not-run-tests-from-root); run from package directories such as packages/core.
