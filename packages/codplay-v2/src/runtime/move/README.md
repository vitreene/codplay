# Move State

Status: En cours  
CodPlay version: V2 foundation

This folder owns pure placement policy and generic state deltas.

- same-tick move conflict resolution;
- opaque target placement selection;
- `mount`, `unmount`, and `move` deltas between solved scenes;
- no list ordering policy, DOM access, component instance, or FLIP backend.

List capabilities consume the deltas and own their container-specific reorder
policies. Render backends consume later projection requests.
