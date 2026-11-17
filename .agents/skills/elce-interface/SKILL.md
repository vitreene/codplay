---
name: elce-interface
description: Apply and extend Elcé-specific interface consistency rules when changing authoring or editor UI. Do not use for unrelated CodPlay UI or non-interface Elcé work.
---

# Elcé interface consistency

Use this skill for Elcé authoring and editor interface changes. It is an
initial, extendable set of product rules; add a rule only when it captures a
reusable Elcé decision, not a one-off component fix.

## Stable interface rules

- Inspect the owning Elcé specification and active plan, then find the closest
  existing control pattern and shared CSS before choosing a size, spacing,
  label position, icon scale, or layout. Reuse that pattern; do not invent a
  local variation to make one screenshot fit.
- Labels with the same role use the same typographic scale, weight, and
  alignment. Align related controls from those labels using the established
  flex or grid pattern. Do not assign fixed width shares to input regions when
  the existing layout distributes them with flex.
- Keep visible labels short and specific; put fuller instructions in the
  accessible name or tooltip. For visual choices such as list markers, show an
  example in the option instead of relying on a technical definition.
- Keep a related settings group on one flex row when that is its established
  layout. Use `flex-wrap: nowrap` and horizontal overflow when needed; do not
  force widths to make every option fit.
- Equivalent icon buttons share their outer shape and size, icon scale, stroke,
  and inset. Their rendered SVG width and height stay identical when the
  surrounding font size differs; set icon dimensions explicitly instead of
  relying on inherited `cap` or `em` sizing. Keep related actions together in
  the existing semantic toolbar group and order; do not position equivalent
  icons independently.
- Use the established spacing mechanism between components. Keep external
  separation as margin or layout gap instead of using internal padding to move
  a neighboring component.
- Before changing a repeated control, inspect its other Elcé uses and preserve
  their visual contract. Apply a justified variation consistently to the whole
  equivalent group.
- When no existing Elcé pattern or shared token resolves a requested choice,
  ask the user instead of choosing new dimensions or positions arbitrarily.

## Applying and extending the rules

- Validate changed layouts in the connected browser at the affected widths
  when browser validation is part of the task. Follow the repository MCP
  configuration and `AGENTS.md` browser-validation requirements.
- Update the owning Elcé specification only after the behavior is implemented
  and verified; keep unapplied decisions and remaining acceptance work in the
  active plan.
- Add future user-approved Elcé interface decisions to this skill so later
  Elcé UI work can apply them without changing repository-wide instructions.
