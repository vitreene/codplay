# Sighty View Transitions proof of concept

## Role

`src/sighty/view-transitions/` is an isolated browser experiment for applying
the same-document View Transition API to Sighty page changes. It demonstrates
the visual effect through the shared Sighty demo page and does not define a
Sighty runtime or CodPlay core capability.

## Composition

The scenario keeps the menu, selected page, and scene telco in one active
Sighty view. The menu and telco use the event and control scenes from Demo 4;
page B and C are copied from their existing scene documents with event times
scaled to a four-second run. Page A uses an image from
`packages/demos/public/assets`. The copied telco progress input has a 0–4000 ms
range.

The layout has distinct menu, page, and telco slots. The browser transition is
named on the page slot alone, so the menu and playback controls remain outside
the animated snapshot. Its `::view-transition-group` clips to the page slot's
bounds. The page menu changes the page slot through the scenario event actions.
Previous and next use the same slot's ordered page graph.

## Transition flow

`connectViewTransitions` observes the public menu and page navigation events
that can change this scenario's `slot-scene`. It calls
`document.startViewTransition` with an update promise before Sighty processes
the queued event. The matching `runtime.onSlotChange` callback resolves that
promise after the page slot changes. CSS selects the old/new page animations
through the transition type passed for the selected menu page or navigation
direction.

The observer ignores navigation directions that have no adjacent page in this
scenario and ignores `sequence:end`. It also ignores a menu intent targeting
the currently mounted page, since that selection does not produce a slot
change. These events do not provide a reliable slot-change completion signal
for this experiment.

The observer keeps every update resolver until the page slot changes, then
resolves and clears all pending callbacks together. Several public navigation
events can arrive before Sighty commits a slot change, so a new event must not
replace an earlier callback. On teardown, both observers are removed, every
pending update is released, and the original inline `viewTransitionName` value
is restored.

## Fallback and limits

When `document.startViewTransition` is unavailable or
`prefers-reduced-motion: reduce` is active, the observer does not start a
browser transition. Sighty continues to route the event normally. CSS also
shortens transition animations under reduced motion.

This event/slot pairing is local to this deterministic demo. The public event
observer is not a general notification that arbitrary Sighty routing has
finished: rejected events, failed actions, external `runtime.dispatch` calls,
and events without a slot change have no completion signal in this experiment.
The approach must not be copied to another scenario without checking that its
observed events always correspond to the observed slot change.

## References

- [Scenario and shortened scene copies](../src/sighty/view-transitions/scenario.ts)
- [Browser transition lifecycle](../src/sighty/view-transitions/view-transitions.ts)
- [View and page slots](../src/sighty/view-transitions/scenes/layout-scene.ts)
- [Transition styles](../src/sighty/view-transitions/style.css)
- [Shared Sighty demo registry](../src/sighty/registry.ts)
