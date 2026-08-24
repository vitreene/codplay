# Materializer

> Status: Fixe — HTML/SVG DOM tranche
> CodPlay version: V2 foundation

This folder defines the single runtime materializer boundary. The
`RuntimeMaterializer` exposes both operations needed by the player:

- `materializeComponent()` receives one component render result and its selected
  services;
- `materializeScene()` applies the solved parentage and order to the same
  materialization host.
- `invalidateStructure()` is an optional boundary for a materializer-specific
  transient presentation that has released or moved author roots. It marks the
  next scene commit for one structural reconciliation; it is not a second
  materialization path.

The component and scene operations therefore use one substrate interface. They
must not be implemented through separate component and structural catalogs or
through a demo-only route.

The current HTML and SVG DOM implementations are in `runtime/runner` and the
shared HTML/SVG service adapters are kept beside their service declarations
under `src/services`.

`BaseComponent` is substrate-neutral. The HTML implementation consumes
`BaseHTMLComponent`; other materializers must define their own projection
contract instead of requiring `render(): string`, DOM nodes or HTML services from
every component.

For HTML template strings, one root remains one real node. Multiple roots remain
an ordered fragment of real nodes; the materializer never creates a wrapper
element. Structural mount, detach, seek persistence and HTML capture operate on
those retained roots. A fragment itself is not a service target.
