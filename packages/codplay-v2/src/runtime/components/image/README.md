# Image component V2

> Status: Fini
> CodPlay version: V2 foundation

This folder contains the V1 `img` component port. The component keeps one native
image node per source and never reassigns a source on an existing node. `fitMode`
is intentionally not part of the V2 contract.

`image-types.ts` is the human-readable profile accepted by `ImageComponent`:
`ImageInitial` is the type of `perso.initial`, while `ImageAction` describes a
partial update. `image-validation.ts` owns diagnostics for those profiles.
The component file only projects the compiled state into the HTML substrate;
common fields come from `BaseComponentVisualData`.
