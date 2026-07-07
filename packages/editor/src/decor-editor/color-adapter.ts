import Color from 'color'

/**
 * Le picker natif du navigateur (<input type="color">) ne parle que hex/rgb. On
 * construit la chaîne CSS `oklch(L C H)` à partir du hex choisi, via `color` pour
 * la conversion — jamais pour reparser une chaîne oklch existante : celle-ci est
 * écrite telle quelle dans le décor et c'est le NAVIGATEUR qui l'interprète au
 * rendu (aucun moteur de vérité côté editeur pour le format de stockage).
 *
 * `color-convert` (dépendance de `color`) travaille en interne sur l/a/b et l/c/h
 * à l'échelle standard × 100 (vérifié sur le code source : oklab = [l*100, a*100,
 * b*100] où l,a,b sont les valeurs OKLab non mises à l'échelle) — d'où le simple
 * /100 uniforme sur L et C ; H (degrés) ne change pas d'échelle. Les méthodes
 * oklab/oklch existent au runtime (vérifié) mais manquent des types de `color`
 * @5.0.3 — d'où les casts ci-dessous, confinés à ce fichier.
 */
interface ColorInstanceWithOklch {
  oklch(): { color: [number, number, number] }
}

export function hexToCssOklch(hex: string): string {
  const instance = new Color(hex) as unknown as ColorInstanceWithOklch
  const [l, c, h] = instance.oklch().color
  return `oklch(${(l / 100).toFixed(4)} ${(c / 100).toFixed(4)} ${h.toFixed(1)})`
}

/** Approximation hex pour l'affichage dans un <input type="color"> (aucune reparse du CSS oklch). */
export function cssOklchComponentsToHex(l: number, c: number, h: number): string {
  const ColorCtor = Color as unknown as (input: Record<string, number>, model: string) => { hex(): string }
  return ColorCtor({ okl: l * 100, okc: c * 100, okh: h }, 'oklch').hex()
}
