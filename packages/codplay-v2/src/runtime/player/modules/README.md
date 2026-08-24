# Player modules internals

> Status: Fixe
> CodPlay version: V2 foundation

This folder owns the typed delegation boundary between `RuntimePlayer` and its
player-scoped module services. It routes notifications, native-clock
delegation, structural-order policies, move deltas, and staged seek aborts.
It never creates a competing module registry or player lifecycle.
