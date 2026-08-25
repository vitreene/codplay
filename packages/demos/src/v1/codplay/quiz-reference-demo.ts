import { createS4QuizReferenceScene } from "../scenes";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";
import type { DemoEntry } from "../shared/demo-registry";

/**
 * Mounts the quiz business reference demo through the CodPlay surface.
 */
export async function runQuizReferenceDemo(demoLinks?: DemoEntry[]): Promise<void> {
  await runCodPlaySceneDemo({
    title: "Quiz Compteur",
    subtitle: "Events placés et interactifs memorisés ",
    scene: createS4QuizReferenceScene(),
    activeDemo: "quiz",
    demoLinks,
  });
}
