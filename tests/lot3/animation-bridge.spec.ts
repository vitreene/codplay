import { describe, expect, it, vi } from "vitest";

import { createAnimationAdapter } from "../../src/animation/adapter";
import { deriveSimpleTransitions } from "../../src/animation/derive-simple";
import { runAnimationBatch } from "../../src/animation/run-batch";
import type { AnimationResolvedAction } from "../../src/animation/types";

type NumericTween = {
  target: Record<string, unknown>;
  property: string;
  from: number;
  to: number;
};

/**
 * Creates one controllable anime implementation for interpolation assertions.
 */
function temp__createControllableAnime() {
  const numericTweens: NumericTween[] = [];
  const calls: Array<Record<string, unknown>> = [];

  const animeImplementation = vi.fn((parameters: Record<string, unknown>) => {
    calls.push(parameters);

    const target = parameters.targets;
    if (typeof target === "object" && target !== null) {
      const targetObject = target as Record<string, unknown>;

      for (const [key, value] of Object.entries(parameters)) {
        if (key === "targets" || key === "duration" || key === "delay" || key === "ease") {
          continue;
        }

        if (typeof value !== "object" || value === null || !("to" in value)) {
          continue;
        }

        const tweenValue = value as { from?: unknown; to: unknown };
        if (typeof tweenValue.to !== "number") {
          continue;
        }

        const defaultFrom = targetObject[key];
        const fromValue = tweenValue.from ?? defaultFrom;
        if (typeof fromValue !== "number") {
          continue;
        }

        numericTweens.push({
          target: targetObject,
          property: key,
          from: fromValue,
          to: tweenValue.to,
        });
      }
    }

    return {
      pause: vi.fn(),
    };
  });

  /**
   * Applies one normalized animation progress on captured tweens.
   */
  function tick(progress: number): void {
    for (const tween of numericTweens) {
      tween.target[tween.property] = tween.from + (tween.to - tween.from) * progress;
    }
  }

  return {
    animeImplementation,
    calls,
    tick,
  };
}

/**
 * Creates one resolved action with sensible defaults for animation tests.
 */
function temp__makeResolvedAction(partial: Partial<AnimationResolvedAction>): AnimationResolvedAction {
  return {
    eventId: partial.eventId ?? "evt-1",
    eventName: partial.eventName ?? "intro",
    listenerId: partial.listenerId ?? "item-1",
    actionKey: partial.actionKey ?? "intro",
    action: partial.action ?? {},
  };
}

describe("Lot 03 - animation bridge", () => {
  it("L3-T1 one resolved event creates one anime transition call", () => {
    const animeImplementation = vi.fn(() => ({ pause: vi.fn() }));
    const adapter = createAnimationAdapter(animeImplementation);

    const resolvedActions: AnimationResolvedAction[] = [
      temp__makeResolvedAction({
        action: {
          target: "#item-1",
          style: {
            opacity: { from: 0, to: 1, duration: 500 },
          },
        },
      }),
    ];

    const transitions = deriveSimpleTransitions(resolvedActions);
    const result = runAnimationBatch(transitions, adapter);

    expect(transitions).toHaveLength(1);
    expect(animeImplementation).toHaveBeenCalledTimes(1);
    expect(result.appliedCount).toBe(1);
  });

  it("L3-T2 incomplete style payload is ignored", () => {
    const animeImplementation = vi.fn(() => ({ pause: vi.fn() }));
    const adapter = createAnimationAdapter(animeImplementation);

    const resolvedActions: AnimationResolvedAction[] = [
      temp__makeResolvedAction({
        action: {
          target: "#item-1",
          style: {
            opacity: { from: 0, duration: 500 },
          },
        },
      }),
    ];

    const transitions = deriveSimpleTransitions(resolvedActions);
    const result = runAnimationBatch(transitions, adapter);

    expect(transitions).toHaveLength(0);
    expect(animeImplementation).toHaveBeenCalledTimes(0);
    expect(result.appliedCount).toBe(0);
  });

  it("L3-T3 empty batch is a no-op", () => {
    const animeImplementation = vi.fn(() => ({ pause: vi.fn() }));
    const adapter = createAnimationAdapter(animeImplementation);

    const result = runAnimationBatch([], adapter);

    expect(animeImplementation).toHaveBeenCalledTimes(0);
    expect(result).toEqual({ appliedCount: 0, trace: [] });
  });

  it("L3-T4 batch returns a minimal event-to-transition trace", () => {
    const animeImplementation = vi.fn(() => ({ pause: vi.fn() }));
    const adapter = createAnimationAdapter(animeImplementation);

    const resolvedActions: AnimationResolvedAction[] = [
      temp__makeResolvedAction({
        eventId: "evt-42",
        eventName: "intro",
        listenerId: "item-42",
        action: {
          target: "#item-42",
          style: {
            x: { to: 120, duration: 300 },
          },
        },
      }),
    ];

    const transitions = deriveSimpleTransitions(resolvedActions);
    const result = runAnimationBatch(transitions, adapter);

    expect(result.trace).toHaveLength(1);
    expect(result.trace[0]).toMatchObject({
      eventId: "evt-42",
      eventName: "intro",
      transitionId: "tr-evt-42-x",
      property: "x",
      status: "applied",
    });
  });
});
