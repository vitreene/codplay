---
name: course-import-visual-interactions
description: Interpret source XML activities where learners select one or more regions on an illustration, separating hit geometry, reveal media, and quiz semantics before proposing CodPlay import behavior.
---

# Interpreting visual interactions in course imports

Use this skill when a source page lets learners click one or more areas of an
illustration. It helps establish what the XML and its reader actually do. It is
an interpretation guide, not a verified `course-import` conversion contract.

## Read the owning contracts

Before proposing implementation, read the active
[course-import plan](../../../packages/authoring/course-import/plan/course-import-plan.md)
and [engine specification](../../../packages/authoring/course-import/specs/course-import-engine-spec.md).
Use the CodPlay [`input` component](../../../packages/codplay/specs/component-materialization-v2-spec.md),
[`Perso.emit`](../../../packages/codplay/specs/perso-emit-v2-spec.md), and
[event pipeline](../../../packages/codplay/specs/event-pipeline-v2-spec.md)
specifications for the output path. Preserve the existing `input` and event
circuits; do not add a parallel interaction mechanism or change CodPlay core.

## Separate the source evidence

For each page, report these concerns independently:

1. **Illustration and coordinate frame:** identify the displayed image, its
   source dimensions, parent container, position, scale, and any viewport or
   zoom behavior. Resolve a choice's position against the actual target frame;
   do not assume the choice label's `x/y` describes the mask frame.
2. **Hit geometry:** establish which DOM element receives the click and what
   limits its hit area. It may be a rectangle, SVG clip path, or another form.
   Inspect the source reader and CSS when the XML alone does not establish
   this. An image's transparent pixels, a low `alpha`, `noPointer`, or an SVG
   filename do not prove shape-aware hit testing.
3. **Reveal and feedback media:** follow `itemToShow`, image references, and
   later sequence content. A revealed silhouette can be separate from the
   clickable region.
4. **Question semantics:** record correctness, groups, repeated selection,
   one-click behavior, validation, and success/failure/incomplete actions.
   Keep these facts separate from the geometry conversion.

Use the corpus dictionary to locate the complete XML and its referenced
resources. If the mask path is supplied by a demo or project adapter rather
than the source document, say so explicitly; do not claim it was extracted
automatically.

## CodPlay mapping candidate

When the source evidence is complete, map each selectable answer to the
existing `input` component, place its hit area in the resolved image frame,
and route selection through `emit.change` and the ordinary story event path.
Use a supplied SVG shape for shape-aware hit testing. Map reveal targets and
one-click behavior only when their source semantics are resolved. Leave quiz
scoring, validation, and pedagogical feedback to their owning quiz model unless
an accepted plan item explicitly includes them.

If geometry, mask provenance, answer grouping, or event timing is ambiguous,
return the evidence and unresolved decision to the active plan. Do not infer a
generic conversion rule from one visually similar example. Keep implementation
and browser acceptance pending until the mapping has been accepted.

## Known reading examples

These examples illustrate different source structures; neither defines a
universal format rule.

- `02_circulation.xml/page2/p2_2` references image `zone1` and its selection
  with `itemToShow="zone1"`. The SVG clip path used by the current demo is a
  demo asset; it is not embedded in that XML excerpt. This case can exercise
  SVG hit testing only when the adapter supplies the path explicitly.
- `AS BTP-INDUSTRIE-LOGISTIQUE/.../xml/07_evaluation.xml/page_7102` declares
  five correct `prop` choices with `x/y`, `oneClick="Y"`, and
  `itemToShow="zoneN"`. Five PNGs are revealed in the next sequence. The
  source QCM attaches clicks to the choice container; its `clicArea` styling
  fills that box, so the case establishes multiple choices and reveals but
  does not establish SVG masking or hit testing by PNG transparency. Its
  `panZoom` container is a separate presentation behavior.

For a conversion proposal, summarize the evidence in a compact table with
columns for source fact, verified behavior, CodPlay mapping candidate, and
unresolved decision. Keep examples and corpus observations out of the
`course-import` engine specification until the behavior is implemented and
verified.
