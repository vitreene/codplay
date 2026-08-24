# Polygon component V2

> Status: Fini
> CodPlay version: V2 foundation

This folder ports the tested V1 polygon geometry and projects it through the V2
SVG materializer. Morphing is evaluated from absolute runtime time so Play and
Seek share one deterministic result.

`polygon-types.ts` is the public persona profile: `PolygonInitial` is the type
accepted as `perso.initial`, and `PolygonAction` is the partial update shape.
`polygon-validation.ts` validates and sanitizes those profiles at compilation.
`polygon-geometry.ts` contains only pure operations on the resulting complete
numeric geometry state; `polygon-component.ts` performs the SVG projection and
temporal orchestration without reintroducing author-data validation.
