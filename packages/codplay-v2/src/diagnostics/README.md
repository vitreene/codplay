# Diagnostics

> Status: Fixe
> CodPlay version: V2 foundation

The diagnostics contract is fixed, but its consumers will grow with the V2 layers.

## Role

`DiagnosticCollector` collects structured warnings and errors, deduplicates them, and
uses `console.log` as its default output. Output adapters can be added later without
changing validation rules.
