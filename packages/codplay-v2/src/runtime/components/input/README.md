# Input component V2

> Status: Fini
> CodPlay version: V2 foundation

This folder ports the V1 quiz input semantics to the V2 template/materializer
boundary. The component keeps five internal parts, while the `markup` layout
capability publishes only the two icon parts as mount targets.

`input-types.ts` defines the complete persona profile accepted by the component:
`InputInitial` is the type of `perso.initial` and `InputAction` is its partial
update form. `input-validation.ts` is the sole owner of profile diagnostics and
compile-time defaults; `input-state.ts` derives the runtime visual state. The
component itself remains focused on projecting that compiled state into HTML.
