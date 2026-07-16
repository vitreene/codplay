# Avatar3D Session Handoff

## Current Status

The Avatar3D semantic runtime migration is largely implemented and validated. The runtime now routes semantic avatar events through dedicated controllers, keeps `play(t) = seek(t)` deterministic, and integrates the MotionEngine/TalkingHead-inspired catalogue with support tracking.

Recent validations passed:

- `npm test` in `packages/authoring/components/avatar-engine`: 9 passed.
- `npm run typecheck` in `packages/authoring/components/avatar-engine`: passed.
- `npm test` in `packages/authoring/components/avatar3d`: 66 passed.
- `npm run typecheck` in `packages/authoring/components/avatar3d`: passed.
- `npm run build` in `packages/demos`: passed, with the usual large chunk warning.

## Main Implemented Pieces

- Runtime contract carries `eventMs` and `isSeekReplay`.
- `Avatar3DBaseComponent` delegates semantic behavior to `Avatar3DSemanticRuntime`.
- Semantic runtime controllers are split by concern:
  - speech / visemes;
  - mood;
  - MotionEngine-style motions;
  - automatic blink, breathe, head drift;
  - direct morphs;
  - skeletal pose and gesture evaluation.
- MotionEngine catalogue coverage is complete for the known remote names: 98/98.
- Support matrix reports `supported`, `partial`, or `unsupported` channels.
- `avatar-poc-1` is the reference demo and must keep revealing real runtime issues.
- Gaze, mood transitions, visemes, skeletal pose ordering, gesture transitions, camera action, and frustum-culling issues have been addressed.
- `avatar:camera` exists for deterministic camera transitions.
- `modelRotationY` exists for model-side three-quarter framing.

## Important Decisions

- Do not import `lhupyn/motion-engine` as a dependency; adapt/copy behavior with MIT attribution where relevant.
- CodPlay is responsible for deterministic event/timeline semantics, not for inventing a separate avatar behavior model.
- `vs` remains an import/test/regression format, not the long-term domain model.
- Core `packages/codplay` changes require explicit user authorization and an agreed plan.
- Do not hide demo issues by changing `avatar-poc-1`; fix the runtime or document the real limitation.
- Camera standard framing in `avatar-poc-1` should not be changed unless explicitly requested.
- Button labels should describe actions, not states.
- Missing gestures should not be faked silently.

## Open Problem

The true “pointing with index finger” gesture is not resolved.

Current state:

- MotionEngine remote `point` maps to `gesture: [["index", null, true], null]`.
- The local runtime maps `point` to a dedicated `point` template.
- Visually, the Ready Player Me avatar still does not produce a convincing pointing handshape.
- The likely problem is finger-pose incompatibility between TalkingHead/MotionEngine-style values and the RPM skeleton/local bone axes.

Conclusion:

- Do not keep tweaking finger rotations blindly.
- A real RPM-compatible hand pose, a compatible GLB/FBX animation, or a calibration/debug tool is needed.

## Reference Note Added

See:

`docs/formalisation/2026-07-16-rpm-gesture-sources-and-adaptation.md`

It records possible sources for RPM/Mixamo/VRM gestures and the preferred adaptation strategy.

## Recommended Next Step

When work resumes, start with the pointing gesture.

Preferred path:

1. Find or import a Mixamo/RPM/GLB/FBX pointing gesture with a correct index handshape.
2. Retarget or inspect it against the Ready Player Me skeleton.
3. Extract calibrated rotations into a deterministic `GestureTemplate` / `Avatar3DMotion` entry.
4. Add a visual regression/demo check in `avatar-poc-1` and a small unit test for the catalog mapping.

Alternative path:

1. Build a small local calibration/debug tool for RPM finger bones.
2. Adjust `LeftHandIndex*`, `Middle*`, `Ring*`, `Pinky*`, and `Thumb*` interactively.
3. Export the validated rotations into the `point` template.

## Key Files

- `docs/formalisation/2026-07-15-avatar3d-semantic-motion-plan.md`
- `docs/formalisation/2026-07-16-rpm-gesture-sources-and-adaptation.md`
- `packages/authoring/components/avatar3d/src/avatar3d-base-component.ts`
- `packages/authoring/components/avatar3d/src/semantic-runtime/`
- `packages/authoring/components/avatar3d/src/semantic-motion/avatar3d-motion-catalog.ts`
- `packages/authoring/components/avatar-engine/src/gesture-engine.ts`
- `packages/authoring/components/avatar-engine/src/gaze-service.ts`
- `packages/authoring/components/avatar-engine/src/model-loader.ts`
- `packages/demos/src/scenes/avatar-poc-scene.ts`

## Demo Entry Points

- Main reference demo: `http://localhost:5173/?demo=avatar-poc-1`
- Mood transition diagnostic demo: `http://localhost:5173/?demo=avatar-mood-transition`
- Start demos with: `npm run dev:demos`
