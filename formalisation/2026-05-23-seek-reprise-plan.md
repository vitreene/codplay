# Seek Reprise Plan

Date: 2026-05-23

## Goal

- Make `seek` replay only already materialized track events.
- Prevent any new event emission during `seek`.
- Recompute `progressEndMs` at seek start so already-read non-master events stay seekable.

## Constraints

- Keep the existing horizon names.
- Do not introduce new conceptual names.
- `playedEndMs` remains the boundary for what has already been read.
- `progressEndMs` is the seek-time visibility horizon.

## Plan

1. Add a hard rule in the seek spec: no new event emission during `seek`.
2. Update the seek replay path so it only replays already stored track events.
3. Recompute `progressEndMs` when entering `seek` using what has already been read.
4. Keep `playedEndMs` as the boundary that limits non-master future access.
5. Add one focused regression test that proves:
   - no emission happens during `seek`
   - already-read non-master events remain seekable
   - unread non-master future events do not become seekable

## Verification

- Run the focused regression test first.
- Then run the player regression suites.
- Finish with `npm run build`.
