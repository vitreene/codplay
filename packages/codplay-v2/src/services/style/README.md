# Style Service

> Status: En cours
> CodPlay version: V2 foundation

The style service validates an open CSS declaration map without reading a
materializer. It does not maintain a global list of CSS properties.

The HTML materializer additionally consumes the V2 transform extras. Numeric
lengths receive `px` only at that HTML boundary, after the runtime
`numericLengthScale` has been applied. Raw `style.transform` text remains opaque
and keeps its authored order, including matrices.

Its HTML materializer adapter is split between `html-style-service.ts` and
`html-transform-service.ts`. The latter owns transform channels, canonical
ordering, raw transforms, and HTML-boundary length conversion.
