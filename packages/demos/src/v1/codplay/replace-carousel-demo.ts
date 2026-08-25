import { createReplaceCarouselScene } from "../scenes/replace-carousel-scene";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";

/**
 * Replace-carousel demo: one image perso whose src transitions every 2 seconds
 * using replace-simple (swipe-left). Validates the replace module.
 */
export async function runReplaceCarouselDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: "Replace Carousel",
    subtitle: "4 cas : texte simple · texte letter · image simple · image cells",
    scene: createReplaceCarouselScene(),
    activeDemo: "replace-carousel",
    onReady: ({ player }) => {
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
