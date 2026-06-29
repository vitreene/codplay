import type { SceneDoc } from "codplay/player/types";

const IMAGES = [
  "/assets/35c8ec5a07fc.jpg",
  "/assets/28970388742_2f75d527d6_z.jpg",
];

const TEXT_A = "La lumière du matin";
const TEXT_B = "Le silence du soir";

export function createReplaceCarouselScene(): SceneDoc {
  return {
    id: "replace-carousel-scene",
    stories: {
      "replace-carousel-story": {
        id: "replace-carousel-story",
        initial: { move: "@root" },
        persos: [
          // ── Grid container ──────────────────────────────────────────────
          {
            id: "demo-grid",
            type: "layout",
            initial: {
              move: "@root",
              markup: "<div></div>",
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "1fr 1fr",
                gap: "16px",
                padding: "16px",
                background: "#0f0f1a",
                height: "100%",
                boxSizing: "border-box",
              },
            },
            actions: {},
          },

          // ── Cellule 1 : texte simple ─────────────────────────────────
          {
            id: "cell-text-simple",
            type: "layout",
            initial: {
              move: { parentId: "demo-grid" },
              markup: `<div style="display:flex;flex-direction:column;gap:8px;background:#1a1a2e;border-radius:12px;padding:16px;overflow:hidden;">
                <span style="font-size:11px;font-family:monospace;color:#888;text-transform:uppercase;letter-spacing:.08em;">Texte simple</span>
              </div>`,
            },
            actions: {},
          },
          {
            id: "demo-text-simple",
            type: "tag",
            initial: {
              move: { parentId: "cell-text-simple" },
              tag: "p",
              content: TEXT_A,
              style: {
                margin: "0",
                fontSize: "20px",
                fontFamily: "Georgia, serif",
                color: "#e8e8f0",
                lineHeight: "1.4",
              },
            },
            actions: {
              "replace-1": {
                content: TEXT_B,
                replace: { transition: "swipe-left", duration: 500 },
              },
              "replace-2": {
                content: TEXT_A,
                replace: { transition: "swipe-left", duration: 500 },
              },
            },
          },

          // ── Cellule 2 : texte letter ─────────────────────────────────
          {
            id: "cell-text-letter",
            type: "layout",
            initial: {
              move: { parentId: "demo-grid" },
              markup: `<div style="display:flex;flex-direction:column;gap:8px;background:#1a1a2e;border-radius:12px;padding:16px;overflow:hidden;">
                <span style="font-size:11px;font-family:monospace;color:#888;text-transform:uppercase;letter-spacing:.08em;">Texte · slot-up</span>
              </div>`,
            },
            actions: {},
          },
          {
            id: "demo-text-letter",
            type: "text",
            initial: {
              move: { parentId: "cell-text-letter" },
              tag: "p",
              content: TEXT_A,
              style: {
                margin: "0",
                fontSize: "20px",
                fontFamily: "Georgia, serif",
                color: "#e8e8f0",
                lineHeight: "1.4",
              },
            },
            actions: {
              "replace-1": {
                content: TEXT_B,
                replace: { transition: "slot-up", duration: 500, split: "letter" },
              },
              "replace-2": {
                content: TEXT_A,
                replace: { transition: "slot-up", duration: 500, split: "letter" },
              },
            },
          },

          // ── Cellule 3 : image simple ─────────────────────────────────
          {
            id: "cell-img-simple",
            type: "layout",
            initial: {
              move: { parentId: "demo-grid" },
              markup: `<div style="display:flex;flex-direction:column;gap:8px;background:#1a1a2e;border-radius:12px;padding:16px;overflow:hidden;">
                <span style="font-size:11px;font-family:monospace;color:#888;text-transform:uppercase;letter-spacing:.08em;">Image simple</span>
              </div>`,
            },
            actions: {},
          },
          {
            id: "demo-img-simple",
            type: "img",
            initial: {
              move: { parentId: "cell-img-simple" },
              src: IMAGES[0],
              img: {
                style: {
                  objectFit: "cover",
                  width: "100%",
                  aspectRatio: "16/9",
                  display: "block",
                  borderRadius: "6px",
                },
              },
            },
            actions: {
              "replace-1": {
                src: IMAGES[1],
                replace: { transition: "swipe-left", duration: 500 },
              },
              "replace-2": {
                src: IMAGES[0],
                replace: { transition: "swipe-left", duration: 500 },
              },
            },
          },

          // ── Cellule 4 : image split cells ────────────────────────────
          {
            id: "cell-img-cells",
            type: "layout",
            initial: {
              move: { parentId: "demo-grid" },
              markup: `<div style="display:flex;flex-direction:column;gap:8px;background:#1a1a2e;border-radius:12px;padding:16px;overflow:hidden;">
                <span style="font-size:11px;font-family:monospace;color:#888;text-transform:uppercase;letter-spacing:.08em;">Image · split cells</span>
              </div>`,
            },
            actions: {},
          },
          {
            id: "demo-img-cells",
            type: "img",
            initial: {
              move: { parentId: "cell-img-cells" },
              src: IMAGES[0],
              img: {
                style: {
                  objectFit: "cover",
                  width: "100%",
                  aspectRatio: "16/9",
                  display: "block",
                  borderRadius: "6px",
                },
              },
            },
            actions: {
              "replace-1": {
                src: IMAGES[1],
                replace: { transition: "swipe-left", duration: 500, split: "cells", cellX: 16, cellY: 9 },
              },
              "replace-2": {
                src: IMAGES[0],
                replace: { transition: "swipe-left", duration: 500, split: "cells", cellX: 16, cellY: 9 },
              },
            },
          },
        ],

        eventimes: [
          { name: "replace-1", startAt: 1500 },
          { name: "replace-2", startAt: 4000 },
          { name: "sequence:end", startAt: 7000 },
        ],
      },
    },
    tracks: {},
  } as unknown as SceneDoc;
}
