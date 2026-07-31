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

## Documentation and implementation tracking

- Keep plans and implementation tracking up to date until the corresponding work is complete.
- Keep resolved situations that explain the current design; do not keep investigation history merely for its chronology.
- Once a concept is implemented, maintain a focused specification for future agents: its role, contract, invariants, decisions, and how to understand it without rereading the entire implementation.
- At the end of each task, update the relevant specification and implementation tracking before closing temporary notes or provisional guardrails.

## Module status

- Every module README starts with a visible status and the target CodPlay version.
- `En cours` means design or implementation is active; proposals are not contracts.
- `Fixe` means the module contract and decisions are stable, even if implementation remains.
- `A relire` marks a module or decision that requires explicit review before dependent work.
- `Fini` means the module is implemented, tested, documented, and complete for the stated CodPlay version.
- Never mark a module `Fini` to make a prototype appear complete; change the status back when a new gap is found.

## Current workspace note

- The root `src/` currently contains the default Vite demo and may be removed.
