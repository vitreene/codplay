# Content Service

> Status: En cours
> CodPlay version: V2 foundation

## Role

`content-service.ts` owns the default content value contract. A serializable
scene carries a string. At runtime, the HTML materializer also accepts a direct
`HTMLElement` and mounts it as the node content.

This service does not define rich HTML-string semantics: a string is assigned as
`textContent`, not parsed as markup. A component that needs richer content owns
that behavior through its own declared service or component implementation.
