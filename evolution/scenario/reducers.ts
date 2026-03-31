import type { ScenarioContext, UserEvent } from './types';

export function createInitialContext(): ScenarioContext {
  return {
    lang: 'fr',
    score: 0,
    errors: 0,
    inactivityMs: 0,
  };
}

// Reducer pur: meme entree, meme sortie.
export function reduceContext(ctx: ScenarioContext, event: UserEvent): ScenarioContext {
  switch (event.type) {
    case 'ANSWER':
      return {
        ...ctx,
        lastAnswer: event.value,
        score: event.correct ? ctx.score + 1 : ctx.score,
        errors: event.correct ? ctx.errors : ctx.errors + 1,
      };

    case 'TIMEOUT':
      return {
        ...ctx,
        inactivityMs: ctx.inactivityMs + 1,
      };

    default:
      return ctx;
  }
}
