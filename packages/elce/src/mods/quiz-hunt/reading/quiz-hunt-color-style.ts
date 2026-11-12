type QuizHuntColorStyle = Readonly<{ solid: string; gradient: string }>

const ORIGINAL_COLOR_STYLES: Readonly<Record<string, QuizHuntColorStyle>> = {
  rouge: {
    solid: '#dc2626',
    gradient: 'linear-gradient(135deg, oklch(72% 0.22 25), oklch(56% 0.24 28) 58%, oklch(44% 0.2 30))',
  },
  bleu: {
    solid: '#2563eb',
    gradient: 'linear-gradient(135deg, oklch(75% 0.16 245), oklch(58% 0.2 258) 55%, oklch(44% 0.18 265))',
  },
  vert: {
    solid: '#16a34a',
    gradient: 'linear-gradient(135deg, oklch(78% 0.18 145), oklch(61% 0.18 150) 56%, oklch(44% 0.14 155))',
  },
  jaune: {
    solid: '#ca8a04',
    gradient: 'linear-gradient(135deg, oklch(88% 0.18 90), oklch(74% 0.18 80) 54%, oklch(58% 0.16 68))',
  },
}

/** Resolves the original game palette for one authored color group. */
export function resolveQuizHuntColorStyle(name: string, color: string): QuizHuntColorStyle {
  return ORIGINAL_COLOR_STYLES[name.trim().toLocaleLowerCase('fr')]
    ?? { solid: color, gradient: `linear-gradient(135deg, ${color}, ${color})` }
}
