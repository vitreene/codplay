# Style Service

> Status: En cours
> CodPlay version: V2 foundation

The style service validates the transposable style namespace without reading a
materializer.

Its HTML materializer adapter is split between `html-style-service.ts` and
`html-transform-service.ts`. The latter owns transform channels, canonical
ordering, raw transforms, and HTML-boundary length conversion.
