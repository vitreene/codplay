import { createS4QuizReferenceScene } from "../scenes";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";

/**
 * Mounts the quiz business reference demo through the CodPlay surface.
 */
export async function runQuizReferenceDemo(): Promise<void> {
  await runCodPlaySceneDemo({
    title: "Quiz Compteur",
    subtitle: "Events placés et interactifs memorisés ",
    scene: createS4QuizReferenceScene(),
    activeDemo: "quiz",
  });
}
