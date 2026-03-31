import { reduceContext } from './reducers';
import type { RuntimeAdapter, ScenarioContext, ScenarioGraph, SeqId, UserEvent } from './types';

export class Orchestrator {
  private currentId: SeqId;
  private timeoutRef?: number;

  constructor(
    private graph: ScenarioGraph,
    private adapter: RuntimeAdapter,
    private context: ScenarioContext,
    startId: SeqId
  ) {
    if (!graph[startId]) {
      throw new Error(`Unknown start sequence: ${startId}`);
    }
    this.currentId = startId;
  }

  start() {
    this.enter(this.currentId);
  }

  stop() {
    if (this.timeoutRef) {
      window.clearTimeout(this.timeoutRef);
      this.timeoutRef = undefined;
    }
    const seq = this.graph[this.currentId];
    this.adapter.stopClip(seq.clip);
  }

  getCurrentSequenceId() {
    return this.currentId;
  }

  getContext() {
    return this.context;
  }

  // Point d'entree unique des events UI et runtime.
  dispatch(event: UserEvent) {
    this.context = reduceContext(this.context, event);
    this.tryTransition(event);
  }

  private enter(id: SeqId) {
    const seq = this.graph[id];
    this.currentId = id;

    seq.onEnter?.forEach((action) => this.adapter.runAction(action));
    this.adapter.playClip(seq.clip);

    if (this.timeoutRef) {
      window.clearTimeout(this.timeoutRef);
      this.timeoutRef = undefined;
    }

    if (seq.timeoutMs) {
      this.timeoutRef = window.setTimeout(() => {
        this.dispatch({ type: 'TIMEOUT' });
      }, seq.timeoutMs);
    }
  }

  private leave(id: SeqId) {
    const seq = this.graph[id];
    seq.onExit?.forEach((action) => this.adapter.runAction(action));
    this.adapter.stopClip(seq.clip);
  }

  private tryTransition(event?: UserEvent) {
    const seq = this.graph[this.currentId];
    const transitions = [...seq.transitions].sort((a, b) => b.priority - a.priority);
    const next = transitions.find((transition) => transition.when(this.context, event));

    if (!next) return;
    if (!this.graph[next.to]) {
      throw new Error(`Unknown target sequence: ${next.to}`);
    }

    this.leave(this.currentId);
    this.enter(next.to);
  }
}
