import type { CardPreset } from './card-preset-types'

/** Explicit preset configuration kept ready for a later preset editor. */
export const CARD_PRESETS: Readonly<Record<string, CardPreset>> = {
  'section-basic': {
    id: 'section-basic',
    label: 'Section',
    allowedContent: ['text', 'bdc'],
    zones: [
      { id: 'title', label: 'Titre', required: false, content: 'text' },
      { id: 'body', label: 'Texte', required: true, content: 'text' },
    ],
  },
  'question-basic': {
    id: 'question-basic',
    label: 'Question',
    allowedContent: ['text', 'media', 'bdc'],
    zones: [
      { id: 'title', label: 'Titre', required: false, content: 'text' },
      { id: 'illustration', label: 'Illustration', required: false, content: 'media' },
      { id: 'question', label: 'Question', required: true, content: 'text' },
      { id: 'answers', label: 'Réponses', required: true, content: 'bdc' },
      { id: 'validation', label: 'Validation', required: true, content: 'bdc' },
    ],
  },
  'image-caption': {
    id: 'image-caption',
    label: 'Image avec légende',
    allowedContent: ['text', 'media'],
    zones: [
      { id: 'image', label: 'Image', required: true, content: 'media' },
      { id: 'caption', label: 'Légende', required: false, content: 'text' },
    ],
  },
  'message-basic': {
    id: 'message-basic',
    label: 'Message',
    allowedContent: ['text', 'media'],
    zones: [
      { id: 'overline', label: 'Sur-titre', required: false, content: 'text' },
      { id: 'title', label: 'Titre', required: false, content: 'text' },
      { id: 'subtitle', label: 'Sous-titre', required: false, content: 'text' },
      { id: 'body', label: 'Message', required: false, content: 'text' },
      { id: 'footer', label: 'Note', required: false, content: 'text' },
    ],
  },
} as const
