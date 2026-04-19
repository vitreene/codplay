import { describe, expect, it, vi } from "vitest";

import { createAnimationAdapter } from "../../src/animation/adapter";
import { deriveSimpleTransitions } from "../../src/animation/derive-simple";
import { runAnimationBatch } from "../../src/animation/run-batch";
import type { AnimationResolvedAction, TransitionRequest } from "../../src/animation/types";

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

  it("L3-T5 seek completion applies cleanup markers and removes finished transitions", () => {
    const seekSpy = vi.fn();
    const pauseSpy = vi.fn();
    const animeImplementation = vi.fn(() => ({
      seek: seekSpy,
      pause: pauseSpy,
    }));
    const adapter = createAnimationAdapter(animeImplementation);

    const target = {
      style: {
        width: "120px",
      },
    };

    const transitions: TransitionRequest[] = [
      {
        transitionId: "flip-1-width",
        eventId: "evt-1",
        eventName: "flip:play",
        listenerId: "item-1",
        property: "width",
        target,
        from: "120px",
        to: "160px",
        duration: 100,
        cleanupStyleProperty: "width",
      },
    ];

    adapter.run(transitions);
    adapter.seek?.(250, new Map([["evt-1", 0]]));

    expect(seekSpy).toHaveBeenCalledWith(100);
    expect(pauseSpy).toHaveBeenCalled();
    expect(target.style.width).toBeUndefined();

    seekSpy.mockClear();
    adapter.seek?.(300, new Map([["evt-1", 0]]));
    expect(seekSpy).not.toHaveBeenCalled();
  });

  it("L3-T6 transition finalize hook receives completion and stop reasons", () => {
    const animeImplementation = vi.fn((parameters: Record<string, unknown>) => {
      return {
        pause: vi.fn(),
        revert: vi.fn(),
        seek: vi.fn(),
      };
    });
    const adapter = createAnimationAdapter(animeImplementation);

    const finalizeCompleted = vi.fn();
    const finalizeStopped = vi.fn();

    const completedTransition: TransitionRequest = {
      transitionId: "tr-complete",
      eventId: "evt-complete",
      eventName: "intro",
      listenerId: "item-complete",
      property: "x",
      target: { x: 0 },
      from: 0,
      to: 100,
      duration: 200,
      onFinalize: finalizeCompleted,
    };

    const stoppedTransition: TransitionRequest = {
      transitionId: "tr-stop",
      eventId: "evt-stop",
      eventName: "intro",
      listenerId: "item-stop",
      property: "x",
      target: { x: 0 },
      from: 0,
      to: 100,
      duration: 200,
      onFinalize: finalizeStopped,
    };

    adapter.run([completedTransition]);
    const completedCall = animeImplementation.mock.calls[0]?.[0] as Record<string, unknown>;
    const completeCallback =
      (completedCall.onComplete as (() => void) | undefined) ??
      (completedCall.complete as (() => void) | undefined);
    completeCallback?.();

    expect(finalizeCompleted).toHaveBeenCalledWith("completed");

    const startedHandles = adapter.run([stoppedTransition]);
    startedHandles[0]?.stop();
    expect(finalizeStopped).toHaveBeenCalledWith("stopped");
  });
});
