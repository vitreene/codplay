# RPM Gesture Sources And Adaptation Notes

## Context

The current `avatar-poc-1` avatar is a Ready Player Me (`RPM`) GLB. It exposes a humanoid skeleton and ARKit-style morph targets, but its finger rest pose and local bone axes are not guaranteed to match TalkingHead or Mixamo values exactly.

This matters for gestures such as “pointing”: a body/arm gesture can retarget reasonably well, while a convincing hand shape requires finger rotations calibrated for the RPM rig.

## Useful Sources To Explore

- Mixamo: good for body and arm gestures, weaker for precise fingers. Search for `pointing`, `talking`, `gesture`, `arguing`, `standing gesture`.
- Rokoko Motion Library: useful body gestures, export depends on account/tooling.
- ActorCore / Reallusion: many humanoid gestures, often higher quality, often paid.
- VRM / VRMA animation repositories: search GitHub for `vrm animation gesture`, `vrma gestures`, `vrm hand pose`, `three-vrm animation`.
- Sketchfab / Poly Pizza: sometimes useful GLB animated assets, but rig compatibility varies.
- GitHub searches: `Ready Player Me gesture animation`, `RPM animation gestures`, `threejs humanoid gestures`, `mixamo pointing animation`, `glb hand gestures`, `vrm finger pose`.

## Adaptation Strategy

If a good Mixamo gesture is found, it should not be assumed to work “as is” in the current runtime.

There are two practical adaptation paths:

1. Extract a semantic pose/template.
   - Import the animation in a tool such as Blender.
   - Retarget it to the RPM skeleton.
   - Select one or several representative frames.
   - Export calibrated bone rotations into a CodPlay `GestureTemplate` / `Avatar3DMotion` entry.
   - This fits the current deterministic semantic runtime best.

2. Add animation clip playback support.
   - Keep the Mixamo/RPM animation as an actual clip.
   - Load it at runtime and play it through a `THREE.AnimationMixer` or equivalent.
   - Retarget or bake the clip to the RPM skeleton before use.
   - This is heavier and needs a dedicated layer so it composes predictably with gaze, speech, moods, and semantic gestures.

## Recommendation

For v1-style semantic gestures, prefer extracting calibrated pose templates rather than playing arbitrary Mixamo clips directly. This preserves:

- deterministic `play(t) = seek(t)` behavior;
- compatibility with CodPlay timeline replay;
- composition with speech, mood, gaze, blink, breathe, and existing gesture layers;
- inspectable and editable gesture catalog entries.

For a high-quality “pointing” gesture, the ideal asset is:

- a body/arm pointing motion retargeted to RPM;
- a separately calibrated RPM hand pose with index extended and other fingers closed;
- a catalog entry that combines both.

## Key Caveat

Mixamo animations often do not provide reliable finger animation. Even when the body point is correct, the hand shape may still need manual RPM calibration.
