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
