/** Seuil de lisibilité par défaut (§4 de la spec) — limite physiologique en px réels. */
export const DEFAULT_MIN_READABLE_SIZE_PX = 9

/** Line-height forcé tant que `textAutoSize.enabled` (§5.1) — constante, non éditable. */
export const FORCED_LINE_HEIGHT = 1.2 as const

/**
 * Seuil de longueur (§2) au-delà duquel le mono-ligne n'est même pas tenté, quelle que
 * soit la largeur du bloc — le texte passe directement en multi-ligne. Valeur arbitraire
 * de départ, à ajuster empiriquement selon la pertinence perçue.
 */
export const DEFAULT_SINGLE_LINE_MAX_CHARS = 30

/**
 * Marge de sécurité (§3.2) appliquée aux dimensions du bloc avant recherche du clamp —
 * absorbe l'écart structurel entre la mesure hors-écran (canvas, moteur de shaping propre)
 * et le rendu réel du DOM, qui ne produisent jamais une largeur/hauteur rigoureusement
 * identique pour un même texte à une même taille. Sans marge, la recherche s'arrête pile à
 * la frontière mesurée, que le rendu réel peut déborder de quelques pixels. Fraction de la
 * largeur/hauteur du bloc (0.02 = 2 %) — valeur arbitraire de départ, à ajuster
 * empiriquement.
 */
export const DEFAULT_FIT_SAFETY_MARGIN = 0.02

/**
 * Paliers `font-stretch` testés dans le sens expansif, une fois la taille de police
 * choisie (§2.3) — pour une police variable à axe `wdth` (ex. Advent Pro), élargir permet
 * d'occuper davantage l'espace disponible en largeur sans changer la taille. Seuls ces
 * mots-clés sont mesurables de façon fiable par le canvas (vérifié directement : pas de
 * pourcentage libre, cf `FontStretchKeyword`). Ordre croissant, `normal` en premier —
 * l'élargissement s'arrête au premier palier qui ne tient plus.
 */
export const FONT_STRETCH_STEPS = ['normal', 'semi-expanded', 'expanded', 'extra-expanded', 'ultra-expanded'] as const
