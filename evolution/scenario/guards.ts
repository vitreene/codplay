import type { TransitionGuard, UserEvent } from './types';

export const onEvent = (type: UserEvent['type']): TransitionGuard => {
  return (_ctx, event) => event?.type === type;
};

export const onCorrectAnswer: TransitionGuard = (_ctx, event) => {
  return event?.type === 'ANSWER' && event.correct;
};

export const minErrors = (value: number): TransitionGuard => {
  return (ctx) => ctx.errors >= value;
};

export const minScore = (value: number): TransitionGuard => {
  return (ctx) => ctx.score >= value;
};

export const always: TransitionGuard = () => true;
