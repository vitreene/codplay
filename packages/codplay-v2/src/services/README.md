# Services

> Status: En cours
> CodPlay version: V2 foundation
> Review: component service declaration boundary implemented; host adapters remain injectable

## Role

This folder owns named CodPlay services and their contracts.

A service name is the shared namespace for:

- the data received in `initial` and actions;
- validation and normalization;
- defaults and property rules;
- the runtime update operation.

The component definition consumed by `CompiledScene` and the runtime component
registry carries the same service and module dependency lists. Each service has
its own folder. Its pure declaration and its materializer adapters remain together,
while `RuntimeCapabilityCatalog` assembles the selected adapter at CodPlay
initialization. The materializer consumes the resulting instance; it does not
register services inline.

Core services such as `style`, `className`, `attr`, and `content` belong here.
Their validation declarations are shared with the V2 component definitions.

The current core service surface is deliberately small:

- `style` accepts an open CSS property map. The HTML materializer also consumes
  the V2 transform channels (`x`/`y`/`z`, `translateX/Y/Z`, rotations, scales,
  skews, `perspective`, `translate`, and raw `transform`).
- `className` accepts a complete string or the V1-compatible `{ add, remove }`
  patch.
- `attr` accepts an open attribute map.
- `content` accepts a string in the serializable scene contract and a direct
  `HTMLElement` when a runtime component applies its materializer service.

The `HTMLElement` form is runtime-only: it is not inserted into `CompiledScene`,
whose artifact remains JSON-serializable.
