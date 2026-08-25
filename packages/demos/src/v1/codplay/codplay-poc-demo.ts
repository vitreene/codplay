import { createPlayerPocScene } from "../scenes";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";
import type { DemoEntry } from "../shared/demo-registry";

/**
 * Mounts the move proof-of-concept demo through the CodPlay public surface.
 */
export async function runCodPlayPocDemo(demoLinks?: DemoEntry[]): Promise<void> {
  await runCodPlaySceneDemo({
    title: "test Flip",
    subtitle: "passage aller-retour d'une liste dans deux conteneurs animés",
    scene: createPlayerPocScene(),
    activeDemo: "codplay-poc",
    demoLinks,
  });
}
