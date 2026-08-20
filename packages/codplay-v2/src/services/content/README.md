# Content Service

> Status: En cours
> CodPlay version: V2 foundation

## Role

`content-service.ts` currently declares only the validation boundary used by the
runtime capability catalog. `html-content-service.ts` contains the current minimal HTML
materializer adapter, which writes textual content to a node.

This is not the complete content contract. Rich content semantics and the
corresponding materializer behavior remain to be specified and implemented in
this service folder; the current adapter must not be treated as that final
design.
