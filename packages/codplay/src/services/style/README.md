# Style Service

> Status: En cours
> CodPlay version: V2 foundation

The style service validates an open CSS declaration map without reading a
materializer. It does not maintain a global list of CSS properties.

The HTML materializer additionally consumes the V2 transform extras. Qualified
logical lengths, including the current `{ kind: 'length', unit: 'cqw', value }`
form, receive `px` only at that HTML boundary, after the runtime
`numericLengthScale` has been applied. The latter is supplied by the scene host
as its root width divided by 100. CodPlay qualifies structured editor
`unitless` values before this boundary; the adapter does not infer a CSS
property grammar or inspect the DOM to qualify a value. Raw `style.transform`
text remains opaque and keeps its authored order, including matrices.

## Declared colors

The `color`, `backgroundColor`, and `borderColor` properties use the V2 color
contract. Author strings are normalized during scene compilation into ACE
`ColorValue` records; runtime style application receives those records and does
not parse CSS strings on every frame.

OKLCH is supported as a first-class color space with the CSS form
`oklch(L C H / A)`. Its lightness, chroma, hue, and alpha are normalized before
interpolation, while the OKLCH space is preserved for the materializer. HSL and
other color spaces remain outside this contract.

Its HTML materializer adapter is split between `html-style-service.ts` and
`html-transform-service.ts`. The latter owns transform channels, canonical
ordering, raw transforms, and HTML-boundary length conversion.
