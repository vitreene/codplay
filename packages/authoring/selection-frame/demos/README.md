# FLIP Demos

Status: En cours  
CodPlay version: V2 foundation

## Reference

`flip` is the preserved Player POC reference demo. It remains unchanged as the
first validated FLIP fixture and keeps its current timeline and debug controls.

## Stress Test

`flip-stress` is an independent FLIP stress-test fixture. It exercises:

- four moving root containers;
- delayed visibility of C and D;
- fixed parent dimensions to isolate FLIP from content-driven reflow;
- cross-container overlay transfers of Q and K;
- Q/K list reflows with all six children captured on each exchange;
- Q/K children are displayed as distinct horizontal color-coded pills;
- nested content transfers in alternating order;
- overlapping transitions with different durations.

The demos are currently separate Vite entry points. Their final navigation and
page architecture remain to be designed separately.

The fixture is intentionally retained but suspended. It must be rewritten as a
declarative V2 scene consumed by a shared HTML/Player runner before it is used as
a validation demo again.
