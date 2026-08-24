# Shared

> Status: Fixe
> CodPlay version: V2 foundation

This folder contains small pure utilities shared by multiple V2 domains.
The utilities are grouped by contract instead of by a generic `utils` bucket:

- `values/` — recursive cloning of arrays and plain records;
- `ordering/` — deterministic comparison of numeric declaration paths;
- `numbers/` — finite-number type guards.

Domain-specific helpers remain beside their owning module. In particular,
pointer event decoding and HTML matrix parsing stay with their adapters while
their behavioral contracts are still different.
