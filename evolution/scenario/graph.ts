import { minErrors, onCorrectAnswer, onEvent } from './guards';
import type { ScenarioGraph } from './types';

// Graphe d'exemple: sequence planifiee + bifurcations utilisateur.
export const graph: ScenarioGraph = {
  intro: {
    id: 'intro',
    label: 'Introduction',
    clip: 'track_intro',
    onEnter: ['show_title'],
    transitions: [
      // Une action utilisateur explicite est prioritaire.
      { to: 'quiz', priority: 100, when: onEvent('CLICK_NEXT') },
      // Repli automatique a la fin de sequence.
      { to: 'quiz', priority: 10, when: onEvent('SEQUENCE_ENDED') },
    ],
  },

  quiz: {
    id: 'quiz',
    label: 'Quiz',
    clip: 'track_quiz',
    timeoutMs: 20000,
    transitions: [
      { to: 'success', priority: 100, when: onCorrectAnswer },
      { to: 'remediation', priority: 90, when: minErrors(2) },
      { to: 'hint', priority: 80, when: onEvent('TIMEOUT') },
    ],
  },

  hint: {
    id: 'hint',
    label: 'Hint',
    clip: 'track_hint',
    transitions: [{ to: 'quiz', priority: 10, when: onEvent('CLICK_NEXT') }],
  },

  remediation: {
    id: 'remediation',
    label: 'Remediation',
    clip: 'track_remediation',
    transitions: [{ to: 'quiz', priority: 10, when: onEvent('CLICK_RETRY') }],
  },

  success: {
    id: 'success',
    label: 'Success',
    clip: 'track_success',
    transitions: [],
  },
};
