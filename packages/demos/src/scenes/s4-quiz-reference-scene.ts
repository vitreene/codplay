import type { StrapCollection } from "codplay/player";
import type { SceneDoc } from "codplay/player/types";

/**
 * Creates one business-oriented reference scene with persistent decor and quiz branching.
 */
export function createS4QuizReferenceScene(): SceneDoc {
  return {
    id: "s4-quiz-reference-scene",
    rootStories: ["s4-quiz-layout-story"],
    stories: {
      "s4-quiz-layout-story": {
        id: "s4-quiz-layout-story",
        entries: ["quiz-layout"],
        persos: [
          {
            id: "quiz-layout",
            type: "layout",
            initial: {
              markup: `
                <section class="quiz-layout-shell">
                  <div data-part="quiz-layout:decor" style="grid-column: 1/-1; grid-row: 1/-1; position: relative;"></div>
                  <div data-part="quiz-layout:intro" style="grid-area: intro; position: relative;"></div>
                  <div data-part="quiz-layout:question" style="grid-area: question; position: relative;"></div>
                  <div data-part="quiz-layout:count" style="grid-area: count; position: relative; justify-self: end;"></div>
                  <div data-part="quiz-layout:success" style="grid-area: result; position: relative;"></div>
                  <div data-part="quiz-layout:failure" style="grid-area: result; position: relative;"></div>
                </section>
              `,
              style: {
                width: "100%",

                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gridTemplateRows: "1fr 3fr 1fr",
                gridTemplateAreas: ' "intro intro" "question count" "result result" ',
                gap: "16px",
                alignItems: "center",
                padding: "24px",
                position: "relative",
                overflow: "hidden",
                backgroundColor: "#0f172a",
                borderRadius: "24px",
                maxHeight: "100%",
              },
            },
            actions: {},
          },
        ],
      },
      "s4-quiz-decor-story": {
        id: "s4-quiz-decor-story",
        entries: [
          "quiz-decor-layer",
          "quiz-decor-circle-a",
          "quiz-decor-circle-b",
          "quiz-decor-circle-c",
          "quiz-decor-media",
        ],
        persos: [
          {
            id: "quiz-decor-layer",
            type: "list",
            initial: {
              className: "quiz-decor-layer",
              move: {
                parentId: "quiz-layout:decor",
              },
              style: {
                minHeight: "100%",
              },
            },
            actions: {},
          },
          {
            id: "quiz-decor-circle-a",
            type: "tag",
            initial: {
              tag: "div",
              content: "a",
              move: {
                parentId: "quiz-decor-layer",
              },
              style: {
                width: "120px",
                height: "120px",
                borderRadius: "999px",
                backgroundColor: "rgba(56, 189, 248, 0.24)",
                color: "white",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              },
            },
            actions: {
              "quiz:decor:drift": {
                style: {
                  x: {
                    from: "70%",
                    to: 70,
                    duration: 6000,
                    ease: "inOutSine",
                    alternate: true,
                    loop: true,
                    ignoreDuration: true,
                  },
                  y: {
                    from: "50%",

                    to: 24,
                    duration: 6000,
                    ease: "inOutSine",
                    alternate: true,
                    loop: true,
                    ignoreDuration: true,
                  },
                },
              },
            },
          },
          {
            id: "quiz-decor-circle-b",
            type: "tag",
            initial: {
              tag: "div",
              content: "",
              move: {
                parentId: "quiz-decor-layer",
              },
              style: {
                width: "88px",
                height: "88px",
                borderRadius: "999px",
                backgroundColor: "rgba(129, 140, 248, 0.22)",
                x: "20%",
                y: "20%",
              },
            },
            actions: {
              "quiz:decor:drift": {
                style: {
                  x: {
                    to: 180,
                    duration: 6000,
                    ease: "inOutSine",
                    alternate: true,
                    loop: true,
                    ignoreDuration: true,
                  },
                  y: {
                    to: 54,
                    duration: 6000,
                    ease: "inOutSine",
                    alternate: true,
                    loop: true,
                    ignoreDuration: true,
                  },
                },
              },
            },
          },
          {
            id: "quiz-decor-circle-c",
            type: "tag",
            initial: {
              tag: "div",
              content: "",
              move: {
                parentId: "quiz-decor-layer",
              },
              style: {
                width: "160px",
                height: "160px",
                borderRadius: "999px",
                backgroundColor: "rgba(34, 197, 94, 0.14)",
                x: "50%",
                y: "40%",
              },
            },
            actions: {
              "quiz:decor:drift": {
                style: {
                  x: {
                    to: 380,
                    duration: 6000,
                    ease: "inOutSine",
                    alternate: true,
                    loop: true,
                    ignoreDuration: true,
                  },
                  y: {
                    to: 16,
                    duration: 6000,
                    ease: "inOutSine",
                    alternate: true,
                    loop: true,
                    ignoreDuration: true,
                  },
                },
              },
            },
          },
          {
            id: "quiz-decor-media",
            type: "media",
            initial: {
              tag: "video",
              src: "/assets/1_7b_e.mp3",
              master: false,
              move: {
                parentId: "quiz-decor-layer",
              },
              style: {
                position: "absolute",
                left: "0",
                top: "0",
                width: "1px",
                height: "1px",
                opacity: 0,
                pointerEvents: "none",
              },
            },
            actions: {
              "quiz:decor:media:start": {
                broadcast: {
                  type: "START",
                },
              },
            },
          },
        ],
        eventimes: [
          {
            name: "quiz:decor:drift",
            startAt: 0,
          },
          {
            name: "quiz:decor:media:start",
            startAt: 1000,
          },
        ],
      },
      "s4-quiz-intro-story": {
        id: "s4-quiz-intro-story",
        entries: ["quiz-intro-title"],
        persos: [
          {
            id: "quiz-intro-title",
            type: "tag",
            initial: {
              tag: "h1",
              content: "Quiz",
              move: {
                parentId: "quiz-layout:intro",
              },
              style: {
                width: "280px",
                minHeight: "96px",
                padding: "20px",
                backgroundColor: "#f8fafc",
                borderRadius: "18px",
                color: "#0f172a",
                opacity: 0,
              },
            },
            actions: {
              "quiz:intro:show": {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 250,
                  },
                  x: {
                    from: -160,
                    to: 0,
                    duration: 250,
                  },
                },
              },
              "quiz:intro:hide": {
                style: {
                  opacity: {
                    from: 1,
                    to: 0,
                    duration: 250,
                  },
                  x: {
                    from: 0,
                    to: 180,
                    duration: 250,
                  },
                },
              },
            },
          },
        ],
        eventimes: [
          {
            name: "quiz:intro:show",
            startAt: 0,
          },
          {
            name: "quiz:intro:hide",
            startAt: 2000,
          },
        ],
      },
      "s4-quiz-question-story": {
        id: "s4-quiz-question-story",
        entries: ["quiz-question-panel"],
        persos: [
          {
            id: "quiz-question-panel",
            type: "list",
            initial: {
              className: "quiz-question-panel",
              move: {
                parentId: "quiz-layout:question",
              },
              style: {
                width: "420px",
                minHeight: "160px",
                padding: "20px",
                backgroundColor: "#ffffff",
                borderRadius: "18px",
                opacity: 0,
              },
            },
            actions: {
              "quiz:question:show": {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 250,
                  },
                  x: {
                    from: 120,
                    to: 0,
                    duration: 250,
                  },
                },
              },
              "quiz:question:hide": {
                style: {
                  opacity: {
                    from: 1,
                    to: 0,
                    duration: 200,
                  },
                  x: {
                    from: 0,
                    to: -80,
                    duration: 200,
                  },
                },
              },
            },
          },
          {
            id: "quiz-question-title",
            type: "tag",
            initial: {
              tag: "p",
              content: "La V1 est-elle prete ? ",
              move: {
                parentId: "quiz-question-panel",
              },
              style: {
                color: "#0f172a",
              },
            },
            actions: {},
          },
          {
            id: "quiz-answer-yes",
            type: "tag",
            initial: {
              tag: "button",
              content: "Oui",
              move: {
                parentId: "quiz-question-panel",
              },
              style: {
                display: "inline-block",
                marginRight: "12px",
                marginTop: "16px",
                padding: "10px 16px",
                border: "1px solid #166534",
                borderRadius: "999px",
                backgroundColor: "#dcfce7",
                color: "#166534",
                fontWeight: 700,
                cursor: "pointer",
              },
            },
            emit: {
              click: {
                event: {
                  name: "quiz:answer:yes",
                },
              },
            },
            actions: {},
          },
          {
            id: "quiz-answer-no",
            type: "tag",
            initial: {
              tag: "button",
              content: "Non",
              move: {
                parentId: "quiz-question-panel",
              },
              style: {
                display: "inline-block",
                marginTop: "16px",
                padding: "10px 16px",
                border: "1px solid #991b1b",
                borderRadius: "999px",
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                fontWeight: 700,
                cursor: "pointer",
              },
            },
            emit: {
              click: {
                event: {
                  name: "quiz:answer:no",
                },
              },
            },
            actions: {},
          },
        ],
        listen: [
          {
            on: "quiz:question:show",
            straps: ["quiz-countdown-start"],
          },
          {
            on: "quiz:answer:yes",
            straps: ["quiz-answer"],
            emit: [{ name: "quiz:question:hide" }],
          },
          {
            on: "quiz:answer:no",
            straps: ["quiz-answer"],
            emit: [{ name: "quiz:question:hide" }],
          },
          {
            on: "perdu",
            emit: [{ name: "quiz:answer:no" }],
          },
        ],
        eventimes: [
          {
            name: "quiz:question:show",
            startAt: 2300,
          },
        ],
      },
      "s4-quiz-count-story": {
        id: "s4-quiz-count-story",
        entries: ["quiz-count-value"],
        persos: [
          {
            id: "quiz-count-value",
            type: "tag",
            initial: {
              tag: "strong",
              content: "10",
              move: {
                parentId: "quiz-layout:count",
              },
              style: {
                width: "72px",
                minHeight: "72px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(15, 23, 42, 0.84)",
                border: "1px solid rgba(248, 250, 252, 0.24)",
                borderRadius: "18px",
                boxShadow: "0 16px 40px rgba(15, 23, 42, 0.28)",
                color: "#f8fafc",
                fontSize: "30px",
                fontWeight: 800,
                lineHeight: "1",
                opacity: 0,
              },
            },
            actions: {
              "quiz:count:show": {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 180,
                  },
                  scale: {
                    from: 0.92,
                    to: 1,
                    duration: 180,
                  },
                },
              },
              "quiz:answer:yes": {
                style: {
                  opacity: {
                    from: 1,
                    to: 0,
                    duration: 180,
                  },
                  scale: {
                    from: 1,
                    to: 0.92,
                    duration: 180,
                  },
                },
              },
              "quiz:answer:no": {
                style: {
                  opacity: {
                    from: 1,
                    to: 0,
                    duration: 180,
                  },
                  scale: {
                    from: 1,
                    to: 0.92,
                    duration: 180,
                  },
                },
              },
              "quiz-count": {},
            },
          },
        ],
      },
      "s4-quiz-success-story": {
        id: "s4-quiz-success-story",
        entries: ["quiz-success-panel"],
        persos: [
          {
            id: "quiz-success-panel",
            type: "tag",
            initial: {
              tag: "div",
              content: "Gagne",
              move: {
                parentId: "quiz-layout:success",
              },
              style: {
                padding: "18px",
                borderRadius: "16px",
                backgroundColor: "#dcfce7",
                color: "#166534",
                opacity: 0,
              },
            },
            actions: {
              "quiz:answer:yes": {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 220,
                  },
                  x: {
                    from: 100,
                    to: 0,
                    duration: 220,
                  },
                },
              },
            },
          },
        ],
      },
      "s4-quiz-failure-story": {
        id: "s4-quiz-failure-story",
        entries: ["quiz-failure-panel"],
        persos: [
          {
            id: "quiz-failure-panel",
            type: "tag",
            initial: {
              tag: "div",
              content: "Helas...",
              move: {
                parentId: "quiz-layout:failure",
              },
              style: {
                padding: "18px",
                borderRadius: "16px",
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                opacity: 0,
              },
            },
            actions: {
              "quiz:answer:no": {
                style: {
                  opacity: {
                    from: 0,
                    to: 1,
                    duration: 220,
                  },
                  x: {
                    from: 100,
                    to: 0,
                    duration: 220,
                  },
                },
              },
            },
          },
        ],
      },
    },
    tracks: {
      "s4-quiz-intro-story": {
        role: "master",
      },
      "s4-quiz-question-story": {
        role: "master",
      },
    },
  } as unknown as SceneDoc;
}

export const s4QuizStraps: StrapCollection = {
  "quiz-countdown-start": ({ context }) => {
    void context.live.loop(
      {
        eachMs: 1000,
        until: [
          { type: "times", max: 11 },
          { type: "event", name: "counter:stop" },
        ],
      },
      ({ index }) => {
        const countStep = {
          event: {
            name: "quiz-count",
            data: { content: String(Math.max(0, 10 - index)) },
            cascade: true,
          },
        };
        if (index === 10) return [countStep, { event: { name: "perdu" } }];
        return countStep;
      }
    );

    return {
      events: [
        {
          name: "quiz:count:show",
          cascade: true,
        },
      ],
    };
  },
  "quiz-answer": ({ event, context }) => {
    return [
      context.planned.delay(1000, {
        event: {
          name: "sequence:end",
          cascade: true,
        },
      }),
      {
        events: [
          {
            name: "counter:stop",
            cascade: true,
          },
          {
            name: event.name,
            cascade: true,
          },
        ],
      },
    ];
  },
};
