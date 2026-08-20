# Class Name Service

> Status: En cours
> CodPlay version: V2 foundation

The className service accepts either a complete class string or the V1-compatible
patch form:

```ts
type ClassNameValue = string | { add?: string; remove?: string }
```

The HTML adapter applies both forms to HTML and SVG elements.
