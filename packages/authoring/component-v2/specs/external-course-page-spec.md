# External Course Page Component

## Purpose

`external-course-page` presents one page owned and rendered by an external
course reader inside a CodPlay V2 scene. The reader keeps its own route,
audio clock, animation systems, and page content. The component does not
translate source XML or recreate source visuals.

The capability is optional. The scene host registers
`EXTERNAL_COURSE_PAGE_DEFINITION` and `EXTERNAL_COURSE_PAGE_LIBRARY`; the
shared V2 layout continues to own the engine, player controls, logs, and scene
host. The implementation follows the existing foreign component, runtime
library, and HTML source-adapter contracts.

## Authored profile

The component initial value contains:

- `sourceUrl`: an absolute HTTP or HTTPS launch document URL;
- `chapterId` and `pageId`: the source reader’s page identity;
- `config`: a plain object whose values are strings, finite numbers, or
  booleans, serialized into the reader’s `config` query parameter;
- optional `title`, plus the inherited `className` and `style` presentation
  fields for the iframe root.

The launch helper overwrites `chapterParameter` and `pageParameter` in the
serialized config and builds the reader’s `#/lesson/<chapter>/<page>` route.
Session identifiers and the host origin are added only when a playback
session opens; they are not scene data. The fixed iframe root rejects
`tag`, `content`, and `attr`; actions may update only its class and style.

## Session and message contract

`ExternalCoursePageComponent` materializes an unloaded iframe and records its
prepared launch URL. The HTML source adapter resolves that iframe through the
runner’s canonical `storyId:persoId` key and requires exactly one such perso
in the scene. It refuses to attach when the reader and host origins match.

The first host Play opens a fresh session. The bridge confirms the expected
chapter and page, the native transport methods, and the body page marker
before sending `ready`. It waits 100 ms after the marker and rechecks the
identity so the reader’s initial sequence has started before a queued Pause
is applied. The parent accepts messages only from the active iframe, expected
origin, protocol version, and session ID.

The parent sends `play` or `pause`; the reader calls its native resume or
pause method and returns the resulting native status. The bridge samples the
active sequence sound position and duration one second after each command.
Each accepted fact is emitted through `commands.emit` as a public
`external-course:ready`, `external-course:playing`, or
`external-course:paused` event at the host player’s current time. Event data
includes the page, session, request freshness, sequence, and sampled source
sound values. A delayed result is kept as a historical fact and marked stale
when a newer request is active.

Page progress follows a separate transport path. Once the reader page is ready,
the bridge samples its native page timeline every 100 ms and posts a versioned
`progress` message only when position, duration, or playback status changes.
The adapter validates the active session and updates the component-owned
playback store. It does not emit these samples into the CodPlay event journal.
The shared layout reads this transport for the existing remote's progress bar.

If the bridge reports a bootstrap error before `ready`, the adapter forwards
the diagnostic, cancels its longer host timeout, and closes the failed
session. This prevents a second timeout diagnostic for the same unavailable
page and lets a later host Play retry with a fresh session.

When the runner delivers a public host `sequence:end` to the source adapter,
the adapter marks the session terminal, invalidates queued facts, ignores late
command results, and requests a native Pause. If the reader is still opening,
the Pause remains the desired state and is sent after `ready`. The iframe is
left mounted at its current rendering. Reset clears the terminal state and
closes the session; destruction closes it as well.

Player Play and Pause continue through the host telco lifecycle; the host clock
does not follow source audio. The shared remote reads position and duration
from this component's source transport, so its progress range remains enabled
while the reader is playing. Seek and rewind are sent through the active,
origin-checked session and applied through the reader's native page timeline
slider callbacks. The bridge explicitly pauses the reader after those
callbacks, then returns the authoritative source position and status. Reset and
component destruction close the session, navigate the owned iframe to
`about:blank`, and invalidate late messages. A later Play opens a new session.
The source reader's playback speed remains outside this POC.

## Reader-specific bridge

`tools/external-course-page/embedded-reader-bridge.js` implements protocol
version 1 for the tested RISQUE CHIMIQUE 6.2.1 distribution. It reads the
reader’s global lesson object, verifies `currentPage.id`, and calls `goResume`
or `goPause`. These names and the object path are compatibility details of
that reader version, not a generic CodPlay contract. Another reader or
distribution version needs its own qualification and bridge.

The preparation tool creates a disposable fixture from a source distribution:
it links source assets and XML, writes a reduced summary for the selected
chapter and page, and adds an embedded entry document with the bridge loaded
before the reader application. The generated bridge script URL carries a
12-character SHA-256 version query so a browser cannot keep using a stale copy
after the bridge changes. The tool leaves the source distribution untouched.

## Limits

The bridge does not emit `external-course:finished`. In the tested reader,
`Lesson.endOfPage()` sets internal `currentPage.isEnded` and
`currentPage.isCompleted` fields, but the intact reader did not provide a
verified parent-facing completion event. These fields are not promoted into
the message contract. A stable reader finish signal is required before this
component can report completion to Elcé. Audio duration alone does not prove
that the full page, including any required interactions, has ended.

The component supports one external page declaration per scene in this POC.
It does not import a chapter, media, styles, or internal navigation into
CodPlay, and it does not change Elcé’s page model.

## Implementation references

- [Component and registration](../src/external-course-page/external-course-page-definition.ts)
- [HTML source adapter](../src/external-course-page/external-course-source-adapter.ts)
- [Reader compatibility bridge](../tools/external-course-page/embedded-reader-bridge.js)
- [Fixture preparation](../tools/external-course-page/prepare-poc-fixture.py)
- [Bridge regression test](../tests/external-course-page-bridge.spec.js)
- [Playback transport test](../tests/external-course-page-playback.spec.ts)
- [V2 scene](../../../demos/src/v2/demos/external-course-page/main.ts)
- [POC plan and acceptance evidence](../../../elce/plan/external-course-adapter-poc-plan.md)
