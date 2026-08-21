# Materializer

> Status: En cours
> CodPlay version: V2 foundation

This folder defines the single runtime materializer boundary. The
`RuntimeMaterializer` exposes both operations needed by the player:

- `materializeComponent()` receives one component render result and its selected
  services;
- `materializeScene()` applies the solved parentage and order to the same
  materialization host.

The component and scene operations therefore use one substrate interface. They
must not be implemented through separate component and structural catalogs or
through a demo-only route.

The current HTML implementation is in `runtime/runner` and the HTML service
adapters are kept beside their service declarations under `src/services`.

For HTML template strings, one root remains one real node. Multiple roots remain
an ordered fragment of real nodes; the materializer never creates a wrapper
element. Structural mount, detach, seek persistence and HTML capture operate on
those retained roots. A fragment itself is not a service target.
