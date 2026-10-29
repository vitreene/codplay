import type {
  ReplacePresetChoice,
  SceneDoc,
  TextReplace,
} from 'codplay'
import { resolveReplacePresetChoice } from 'codplay'

const authorScene = {
  id: 'replace-preset-types',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'headline',
          type: 'text',
          initial: { content: '<strong>Before</strong>' },
          actions: {
            enter: {
              content: '<em>After</em>',
              replace: { transition: resolveReplacePresetChoice('glyph-roll', 'up'), split: 'letter' },
            },
          },
        },
        {
          id: 'image',
          type: 'img',
          initial: { src: '/before.png' },
          actions: {
            replace: {
              src: '/after.png',
              replace: { transition: resolveReplacePresetChoice('tilt', 'right'), split: 'cells' },
            },
          },
        },
      ],
    },
  },
} satisfies SceneDoc

const canonicalGlyphRollName: 'slot-up' = resolveReplacePresetChoice('glyph-roll', 'up')
const glyphRollChoice = {
  type: 'glyph-roll',
  orientation: 'up',
  transition: canonicalGlyphRollName,
} satisfies ReplacePresetChoice

const acceptedTextPreset: TextReplace = 'swipe-soft-left'

// @ts-expect-error The text preset name must come from the JSON-derived catalog.
const rejectedTextPreset: TextReplace = 'text-flythrough'

// @ts-expect-error Glyph-roll has only the up and down orientations.
resolveReplacePresetChoice('glyph-roll', 'left')

// @ts-expect-error A glyph-roll choice cannot use a swipe orientation.
const rejectedChoice: ReplacePresetChoice = { type: 'glyph-roll', orientation: 'left', transition: 'slot-up' }

void authorScene
void glyphRollChoice
void canonicalGlyphRollName
void acceptedTextPreset
void rejectedTextPreset
void rejectedChoice
