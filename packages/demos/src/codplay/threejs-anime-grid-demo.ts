import { createThreejsBinding } from "@codplay/threejs";
import { threejsAnimeGridScene } from "../scenes/threejs-anime-grid-scene";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";

export function runThreejsAnimeGridDemo(): Promise<void> {
  return runCodPlaySceneDemo({
    title: "demo 3D",
    subtitle:
      "Composant threejs generique pilotée par CodPlay, scene procedurale et animations animejs declarees dans le perso.",
    scene: threejsAnimeGridScene,
    activeDemo: "threejs-anime-grid",
    bindings: [createThreejsBinding()],
  });
}
