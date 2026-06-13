import * as THREE from "three";
import { TalkingHead } from "@met4citizen/talkinghead";
import { createAvatar3DComponentClass, createTalkingHeadRenderAdapter } from "@codplay/avatar3d";
import type { AvatarHeadApi } from "@codplay/avatar3d";
import { createAvatarPocScene } from "../scenes/avatar-poc-scene";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";

const AVATAR_W = 600;
const AVATAR_H = 600;

// ── Réglages animation bouche ─────────────────────────────────────────────────
// VISEME_WEIGHT : amplitude max des morphes (0–1).
//   Trop haut → bouche déformée. Trop bas → mouvement imperceptible.
const VISEME_WEIGHT = 0.65;

// VISEME_ACC : accélération du lissage TalkingHead (valeur stockée = unités/ms²).
//   Défaut TH : 0.00001 (trop lent). 0.01 ≈ 3 frames pour atteindre la cible.
//   Monter → plus vif / mécanique. Baisser → plus doux / en retard.
const VISEME_ACC = 0.004;

// VISEME_MAXV : vitesse max du lissage (unités/ms).
//   Plafonne la vitesse en fin de course. Monter si l'interpolation semble freiner trop tôt.
const VISEME_MAXV = 1;
// ─────────────────────────────────────────────────────────────────────────────

const VISEME_NAMES = [
  "PP",
  "FF",
  "TH",
  "DD",
  "kk",
  "CH",
  "SS",
  "nn",
  "RR",
  "aa",
  "E",
  "I",
  "O",
  "U",
] as const;

function patchVisemeEasing(th: unknown): void {
  const internal = th as { mtAvatar?: Record<string, { acc: number; maxv: number }> };
  if (!internal.mtAvatar) return;
  for (const v of VISEME_NAMES) {
    const mt = internal.mtAvatar["viseme_" + v];
    if (mt) {
      mt.acc = VISEME_ACC;
      mt.maxv = VISEME_MAXV;
    }
  }
}

export function runAvatarPoc1Demo(): Promise<void> {
  return runCodPlaySceneDemo({
    title: "Avatar POC — CodPlay",
    subtitle:
      "Avatar 3D piloté par CodPlay — audio media, visèmes en eventimes, tick Three.js via renderFrame.",
    scene: createAvatarPocScene(),
    rootNodeIds: ["avatar-stage"],
    activeDemo: "avatar-poc-1",
    async setup() {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.setPixelRatio(globalThis.devicePixelRatio);
      renderer.setSize(AVATAR_W, AVATAR_H);
      renderer.domElement.style.cssText = "width:100%;height:100%;display:block;";

      const threeScene = new THREE.Scene();
      const threeCamera = new THREE.PerspectiveCamera(10, AVATAR_W / AVATAR_H, 0.1, 2000);
      threeScene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
      dirLight.position.set(0, 1, 2);
      threeScene.add(dirLight);

      const head = new TalkingHead(null, {
        ttsEndpoint: null,
        lipsyncModules: ["fr"],
        avatarOnly: true,
        avatarOnlyScene: threeScene,
        avatarOnlyCamera: threeCamera,
      });

      await head.showAvatar({
        url: "/avatars/avatarsdk.glb",
        body: "M",
        avatarMood: "neutral",
        lipsyncLang: "fr",
        retarget: {
          Neck: { z: -0.01, rx: -0.15 },
          Neck1: { z: -0.01, rx: -0.15 },
          Neck2: { z: -0.01, rx: -0.15 },
          LeftShoulder: { rz: -0.3 },
          RightShoulder: { rz: 0.3 },
          scaleToEyesLevel: 1.0,
          origin: { y: -0.1 },
        },
      });

      patchVisemeEasing(head);

      // avatarOnly: TH skips setView(). FOV=10°, half-height at distance Z = tan(5°)*Z.
      // camZ=3, camY=1.5 → visible range [1.24, 1.76] — tête au tronc.
      const camZ = 3;
      const camY = 1.5;
      threeCamera.position.set(0, camY, camZ);
      threeCamera.lookAt(0, camY, 0);

      head.start();

      return {
        components: {
          avatar3d: createAvatar3DComponentClass({
            canvas: renderer.domElement,
            head: head as unknown as AvatarHeadApi,
            visemeWeight: VISEME_WEIGHT,
          }),
        },
        renderAdapters: [
          createTalkingHeadRenderAdapter({
            head: head as unknown as AvatarHeadApi & { animate(deltaMs: number): void },
            render: () => renderer.render(threeScene, threeCamera),
          }),
        ],
      };
    },
  });
}
