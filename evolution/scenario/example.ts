/*
Exemple pseudo-code (mode reflexion)
------------------------------------
Objectif: montrer comment un orchestrateur combine:
- un flux narratif planifie (graphe scenario)
- des bifurcations pilotees par l'utilisateur (events)

Ce fichier reste volontairement leger et non production.
*/

import { graph } from './graph';
import { createInitialContext } from './reducers';
import { Orchestrator } from './orchestrator';
import type { RuntimeAdapter, UserEvent } from './types';

// 1) Adaptateur minimal (pas d'integration runtime reelle ici)
const pseudoAdapter: RuntimeAdapter = {
  playClip: (clipId) => {
    // En runtime reel: demarrer la sequence/track.
    console.log('[playClip]', clipId);
  },
  stopClip: (clipId) => {
    // En runtime reel: stopper/pause la sequence/track.
    console.log('[stopClip]', clipId);
  },
  runAction: (actionName) => {
    // En runtime reel: declencher des effets de bord (UI/audio/FX).
    console.log('[runAction]', actionName);
  },
};

// 2) Initialiser le contexte de depart
const ctx = createInitialContext();

// 3) Creer l'orchestrateur avec "intro" comme point d'entree
const orchestrator = new Orchestrator(graph, pseudoAdapter, ctx, 'intro');
orchestrator.start();

// 4) Simuler une session utilisateur simple
const session: UserEvent[] = [
  { type: 'CLICK_NEXT' }, // intro -> quiz
  { type: 'ANSWER', value: 'A', correct: false },
  { type: 'ANSWER', value: 'B', correct: false }, // quiz -> remediation (errors >= 2)
  { type: 'CLICK_RETRY' }, // remediation -> quiz
  { type: 'ANSWER', value: 'C', correct: true }, // quiz -> success
];

for (const event of session) {
  orchestrator.dispatch(event);
  console.log('currentSequence=', orchestrator.getCurrentSequenceId(), 'context=', orchestrator.getContext());
}

/*
Parcours attendu (conceptuel):
intro -> quiz -> remediation -> quiz -> success
*/
