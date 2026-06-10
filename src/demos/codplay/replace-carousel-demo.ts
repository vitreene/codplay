import { createReplaceCarouselScene } from "../scenes/replace-carousel-scene";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";

/**
 * Replace-carousel demo: one image perso whose src transitions every 2 seconds
 * using replace-simple (swipe-left). Validates the replace module.
 */
export async function runReplaceCarouselDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: "Replace Carousel",
    subtitle: "1 image, src remplacé toutes les 2s via replace-simple (swipe-left).",
    scene: createReplaceCarouselScene(),
    rootNodeIds: ["replace-carousel-container"],
    activeDemo: "replace-carousel",
    onReady: ({ player, telco }) => {
      let paused = false;
      player.onTrace((row) => {
        if (
          !paused &&
          row.eventName === "player:event:applied" &&
          row.payload?.["eventName"] === "replace-img-2"
        ) {
          paused = true;
          // void telco.pause()
        }
      });
    },
  });
}
