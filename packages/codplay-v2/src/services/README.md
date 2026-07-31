# Services

> Status: En cours
> CodPlay version: V2 foundation
> Review: service declaration boundary still to fix

## Role

This folder owns named CodPlay services and their contracts.

A service name is the shared namespace for:

- the data received in `initial` and actions;
- validation and normalization;
- defaults and property rules;
- the runtime update operation.

The service catalog consumed by `CompiledScene` must be built from the same
declarations used by the runtime component registry. It must not duplicate a
component's service list.

Core services such as `style`, `className`, and `attr` belong here. Their current
validation implementation remains `En cours` until the single declaration
boundary is fixed.
