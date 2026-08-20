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
