# HTML runner validation demo

Status: En cours  
CodPlay version: V2 foundation

## Scenario

This browser vertical compiles one `SceneDoc` and presents it through
`HtmlPlayerRunner`. The character is mounted once in `character-outlet`; no
timeline action changes its `move`.

- `0 ms`: initial color, opacity and `translate(0px, 0px)`;
- `500-1900 ms`: color, opacity, `x` and `y` interpolate toward their first endpoint;
- `2300-3000 ms`: the same channels interpolate toward a second endpoint;
- `3200 ms`: the final continuous state remains presented.

The runner owns materialization, logical state resolution, CSS service projection
and transport lifecycle. The demo does not implement a second render loop or FLIP
capture logic.

## Manual checks

1. Run `npm run demo:runner` from `packages/codplay-v2`.
2. At `0 ms`, verify the initial color, opacity and translation.
3. Seek to `1200 ms`, then `1900 ms`, and verify the continuous values.
4. Seek to `2650 ms` and verify the second interpolation.
5. Reset, play to the same checkpoints, and compare the displayed CSS values with seek.
6. Resize the viewport and verify the displayed epoch increments without duplicating nodes.
7. Refresh or leave the page and verify no runner-owned nodes remain attached.

The transitions are continuous style interpolations. Visual FLIP remains outside
this validation tranche because it still requires the generic capture builder.
