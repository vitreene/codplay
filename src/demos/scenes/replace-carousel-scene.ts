import type { SceneDoc } from "../../player/types";

const CONTAINER_ID = "replace-carousel-container";
const IMG_ID = "replace-carousel-img";

const IMAGES = [
  "/assets/35c8ec5a07fc.jpg",
  "/assets/28970388742_2f75d527d6_z.jpg",
  "/assets/28999069391_5893263112_z.jpg",
];

/**
 * Creates a 6-second replace-carousel scene: one image perso whose src
 * changes every 2 seconds via replace-simple (swipe-left transition).
 * Validates the replace module in place of the multi-perso carousel approach.
 */
export function createReplaceCarouselScene(): SceneDoc {
  return {
    id: "replace-carousel-scene",
    rootStories: ["replace-carousel-story"],
    stories: {
      "replace-carousel-story": {
        id: "replace-carousel-story",
        entries: [CONTAINER_ID],
        persos: [
          {
            id: CONTAINER_ID,
            type: "layout",
            initial: {
              markup: '<div></div>',
              style: {
                width: "80%",
                aspectRatio: "1",
                position: "relative",
                margin: "0 auto",
                background: "#1a1a2e",
                borderRadius: "16px",
                overflow: "hidden",
              },
            },
            actions: {},
          },
          {
            id: IMG_ID,
            type: "img",
            initial: {
              src: IMAGES[0],
              move: { parentId: CONTAINER_ID },
              img: {
                style: { objectFit: "cover", width: "100%", height: "100%", display: "block" },
              },
            },
            actions: {
              "replace-img-2": {
                src: IMAGES[1],
                replace: { transition: "swipe-left", duration: 400 },
              },
              "replace-img-3": {
                src: IMAGES[2],
                replace: { transition: "swipe-left", duration: 400 },
              },
            },
          },
        ],
        eventimes: [
          { name: "replace-img-2", startAt: 1000 },
          { name: "replace-img-3", startAt: 2000 },
          { name: "sequence:end", startAt: 6000 },
        ],
      },
    },
    tracks: {},
  } as unknown as SceneDoc;
}
