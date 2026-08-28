# Attribute Service

> Status: En cours
> CodPlay version: V2 foundation

The attr service validates an open `Record<string, unknown>` attribute map
without depending on DOM objects. The HTML adapter applies the same map to HTML
and SVG elements: `false`, `null`, and `undefined` remove an attribute; `true`
creates a valueless attribute; other values are stringified.
