import { createRiveBinding, preloadRiveResource } from "@codplay/rive";
import { createRiveCoachScene } from "../scenes/rive-coach-scene";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";

const RIV_SRC = "/avatars/coach.riv";

export function runRiveCoachDemo(): Promise<void> {
  return runCodPlaySceneDemo({
    title: "Rive lip-sync",
    subtitle: "sur la base d’un composant Rive",
    scene: createRiveCoachScene(),
    activeDemo: "rive-coach",

    async setup() {
      await preloadRiveResource(RIV_SRC);
      const binding = createRiveBinding();
      return {
        components: binding.components,
        renderAdapters: binding.renderAdapter ? [binding.renderAdapter] : [],
      };
    },
  });
}
