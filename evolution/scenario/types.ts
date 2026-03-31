export type SeqId = string;

export type UserEvent =
  | { type: 'CLICK_NEXT' }
  | { type: 'CLICK_RETRY' }
  | { type: 'ANSWER'; value: string; correct: boolean }
  | { type: 'TIMEOUT' }
  | { type: 'SEQUENCE_ENDED' };

export interface ScenarioContext {
  lang: 'fr' | 'en';
  score: number;
  errors: number;
  lastAnswer?: string;
  inactivityMs: number;
}

export type TransitionGuard = (ctx: ScenarioContext, event?: UserEvent) => boolean;

export interface Transition {
  to: SeqId;
  priority: number;
  when: TransitionGuard;
}

export interface SequenceDef {
  id: SeqId;
  label: string;
  clip: string;
  timeoutMs?: number;
  transitions: Transition[];
  onEnter?: string[];
  onExit?: string[];
}

export type ScenarioGraph = Record<SeqId, SequenceDef>;

export interface RuntimeAdapter {
  playClip: (clipId: string) => void;
  stopClip: (clipId: string) => void;
  runAction: (actionName: string) => void;
}
