import type { ResolvedAppearance } from './appearance-resolver'

/** Named color roles consumed by the document and reader stylesheets. */
export interface GeneratedAppearanceColors {
  readonly background: string
  readonly text: string
  readonly title: string
  readonly intertitle: string
  readonly accent: string
  readonly accentSecondary: string
  readonly accentForeground: string
  readonly accentSecondaryForeground: string
  readonly surface: string
  readonly surfaceForeground: string
  readonly muted: string
  readonly border: string
  readonly menuBackground: string
  readonly menuForeground: string
  readonly navigationBackground: string
  readonly navigationForeground: string
}

type Oklch = Readonly<{ lightness: number; chroma: number; hue: number }>
type Rgb = Readonly<{ red: number; green: number; blue: number }>

/**
 * Palette editing guide:
 * 1. Fond and Texte are the resolved author anchors; do not edit them here.
 * 2. Tune the short list of named derivation rules below.
 * 3. Change role relationships in generateAppearanceColors.
 * 4. Keep color-space conversion, gamut mapping and contrast correction pure.
 * 5. Map a new role to CSS in appearance-scene-style-sheet, then consume it in
 *    the reader styles. The project, page and BDC targets share this circuit.
 *
 * Contrast correction changes lightness; gamut mapping reduces chroma. This
 * keeps the rules readable without introducing a separate palette framework.
 */
const COLOR_RULES = {
  neutralHue: 165,
  accentHueOffset: 24,
  accentChromaMinimum: 0.12,
  accentChromaMaximum: 0.18,
  neutralChromaThreshold: 0.025,
  textContrast: 4.5,
  graphicContrast: 3,
  mutedLightnessMix: 0.12,
  mutedChromaScale: 0.65,
  surfaceLightnessShift: 0.035,
  surfaceChromaScale: 0.7,
  menuLightness: 0.28,
  navigationLightness: 0.93,
  interfaceChromaScale: 0.65,
} as const

/** Generates the short semantic palette from the resolved author color anchors. */
export function generateAppearanceColors(
  resolved: ResolvedAppearance,
  contrastBackground = resolved.background.value.color,
): GeneratedAppearanceColors {
  const masterBackground = resolved.background.value.color
  const masterForeground = resolved.textColor.value.color
  const backgroundOklch = hexToOklch(masterBackground)
  const foregroundOklch = hexToOklch(masterForeground)
  const themeHue = themeHueFor(backgroundOklch, foregroundOklch)
  const lightBackground = backgroundOklch.lightness >= 0.6
  const chosenText = resolved.autoContrast.value
    ? adjustLightnessForContrast(masterForeground, contrastBackground, COLOR_RULES.textContrast)
    : masterForeground
  const chosenTextOklch = hexToOklch(chosenText)
  const intertitle = ensureContrast(
    oklchToHex({
      ...chosenTextOklch,
      lightness: mix(chosenTextOklch.lightness, backgroundOklch.lightness, COLOR_RULES.mutedLightnessMix),
      chroma: chosenTextOklch.chroma * COLOR_RULES.mutedChromaScale,
    }),
    contrastBackground,
    COLOR_RULES.textContrast,
  )
  const accentLightness = lightBackground ? 0.43 : 0.76
  const accent = ensureContrast(
    oklchToHex({ lightness: accentLightness, chroma: accentChroma(backgroundOklch), hue: themeHue }),
    contrastBackground,
    COLOR_RULES.textContrast,
  )
  const accentSecondary = ensureContrast(
    oklchToHex({
      lightness: accentLightness,
      chroma: accentChroma(backgroundOklch),
      hue: wrapHue(themeHue + COLOR_RULES.accentHueOffset),
    }),
    contrastBackground,
    COLOR_RULES.textContrast,
  )
  const accentForeground = ensureContrast(chosenText, accent, COLOR_RULES.textContrast)
  const accentSecondaryForeground = ensureContrast(chosenText, accentSecondary, COLOR_RULES.textContrast)
  const surface = oklchToHex({
    ...backgroundOklch,
    lightness: clamp(backgroundOklch.lightness + (lightBackground
      ? COLOR_RULES.surfaceLightnessShift
      : -COLOR_RULES.surfaceLightnessShift), 0, 1),
    chroma: backgroundOklch.chroma * COLOR_RULES.surfaceChromaScale,
  })
  const menuBackground = interfaceTone(
    backgroundOklch,
    themeHue,
    COLOR_RULES.menuLightness,
  )
  const navigationBackground = interfaceTone(
    backgroundOklch,
    themeHue,
    COLOR_RULES.navigationLightness,
  )

  return {
    background: masterBackground,
    text: chosenText,
    title: chosenText,
    intertitle,
    accent,
    accentSecondary,
    accentForeground,
    accentSecondaryForeground,
    surface,
    surfaceForeground: ensureContrast(chosenText, surface, COLOR_RULES.textContrast),
    muted: intertitle,
    border: ensureContrast(
      oklchToHex(mixOklch(backgroundOklch, foregroundOklch, 0.3)),
      contrastBackground,
      COLOR_RULES.graphicContrast,
    ),
    menuBackground,
    menuForeground: ensureContrast(chosenText, menuBackground, COLOR_RULES.textContrast),
    navigationBackground,
    navigationForeground: ensureContrast(chosenText, navigationBackground, COLOR_RULES.textContrast),
  }
}

/** Selects the hue source while keeping neutral author choices neutral where possible. */
function themeHueFor(background: Oklch, foreground: Oklch): number {
  if (background.chroma >= COLOR_RULES.neutralChromaThreshold) return background.hue
  if (foreground.chroma >= COLOR_RULES.neutralChromaThreshold) return foreground.hue
  return COLOR_RULES.neutralHue
}

/** Keeps accents visible when a master hue is neutral and caps their chroma. */
function accentChroma(background: Oklch): number {
  return clamp(background.chroma, COLOR_RULES.accentChromaMinimum, COLOR_RULES.accentChromaMaximum)
}

/** Creates one interface tint from the project hue and a named lightness choice. */
function interfaceTone(background: Oklch, hue: number, lightness: number): string {
  return oklchToHex({
    lightness,
    chroma: Math.min(background.chroma * COLOR_RULES.interfaceChromaScale, 0.12),
    hue,
  })
}

/** Adjusts only OKLCH lightness until the requested WCAG contrast is reached. */
function ensureContrast(color: string, background: string, ratio: number): string {
  if (contrastRatio(color, background) >= ratio) return color
  return adjustLightnessForContrast(color, background, ratio)
}

/** Finds the nearest lighter or darker color that reaches the contrast target. */
function adjustLightnessForContrast(color: string, background: string, ratio: number): string {
  const source = hexToOklch(color)
  const candidates = [0, 1].flatMap((edge) => {
    const direction = edge - source.lightness
    return Array.from({ length: 101 }, (_, index) => {
      const lightness = clamp(source.lightness + direction * index / 100, 0, 1)
      const candidate = oklchToHex({ ...source, lightness })
      return { candidate, distance: Math.abs(lightness - source.lightness), contrast: contrastRatio(candidate, background) }
    }).filter((entry) => entry.contrast >= ratio)
  })
  const nearest = candidates.sort((left, right) => left.distance - right.distance)[0]
  if (nearest !== undefined) return nearest.candidate
  return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background) ? '#000000' : '#ffffff'
}

/** Calculates the WCAG contrast ratio from two validated sRGB hex colors. */
function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(hexToRgb(foreground))
  const second = relativeLuminance(hexToRgb(background))
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

/** Converts an sRGB hex color into its OKLCH representation. */
function hexToOklch(hex: string): Oklch {
  const { red, green, blue } = hexToRgb(hex)
  const linearRed = srgbToLinear(red)
  const linearGreen = srgbToLinear(green)
  const linearBlue = srgbToLinear(blue)
  const l = Math.cbrt(0.4122214708 * linearRed + 0.5363325363 * linearGreen + 0.0514459929 * linearBlue)
  const m = Math.cbrt(0.2119034982 * linearRed + 0.6806995451 * linearGreen + 0.1073969566 * linearBlue)
  const s = Math.cbrt(0.0883024619 * linearRed + 0.2817188376 * linearGreen + 0.6299787005 * linearBlue)
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { lightness, chroma: Math.hypot(a, b), hue: wrapHue(Math.atan2(b, a) * 180 / Math.PI) }
}

/** Converts an OKLCH color to hex, reducing chroma until it fits sRGB gamut. */
function oklchToHex(color: Oklch): string {
  let lowChroma = 0
  let highChroma = color.chroma
  let rgb = oklchToRgb({ ...color, chroma: highChroma })
  if (!isInSrgbGamut(rgb)) {
    for (let iteration = 0; iteration < 16; iteration += 1) {
      const candidateChroma = (lowChroma + highChroma) / 2
      const candidate = oklchToRgb({ ...color, chroma: candidateChroma })
      if (isInSrgbGamut(candidate)) {
        lowChroma = candidateChroma
        rgb = candidate
      } else {
        highChroma = candidateChroma
      }
    }
  }
  return rgbToHex(rgb)
}

/** Converts one OKLCH value to unclamped gamma-encoded sRGB channels. */
function oklchToRgb(color: Oklch): Rgb {
  const radians = color.hue * Math.PI / 180
  const a = color.chroma * Math.cos(radians)
  const b = color.chroma * Math.sin(radians)
  const l = color.lightness + 0.3963377774 * a + 0.2158037573 * b
  const m = color.lightness - 0.1055613458 * a - 0.0638541728 * b
  const s = color.lightness - 0.0894841775 * a - 1.291485548 * b
  const linearRed = 4.0767416621 * l ** 3 - 3.3077115913 * m ** 3 + 0.2309699292 * s ** 3
  const linearGreen = -1.2684380046 * l ** 3 + 2.6097574011 * m ** 3 - 0.3413193965 * s ** 3
  const linearBlue = -0.0041960863 * l ** 3 - 0.7034186147 * m ** 3 + 1.707614701 * s ** 3
  return {
    red: linearToSrgb(linearRed),
    green: linearToSrgb(linearGreen),
    blue: linearToSrgb(linearBlue),
  }
}

/** Converts a six-digit hexadecimal color to normalized sRGB channels. */
function hexToRgb(hex: string): Rgb {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16) / 255,
    green: Number.parseInt(hex.slice(3, 5), 16) / 255,
    blue: Number.parseInt(hex.slice(5, 7), 16) / 255,
  }
}

/** Encodes normalized RGB channels as one stable uppercase hexadecimal color. */
function rgbToHex(rgb: Rgb): string {
  return `#${[rgb.red, rgb.green, rgb.blue]
    .map((channel) => Math.round(clamp(channel, 0, 1) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

/** Converts encoded sRGB to linear light for color-space calculations. */
function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/** Converts linear light to encoded sRGB. */
function linearToSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.max(0, channel) ** (1 / 2.4) - 0.055
}

/** Calculates relative luminance using the WCAG sRGB coefficients. */
function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * srgbToLinear(rgb.red) + 0.7152 * srgbToLinear(rgb.green) + 0.0722 * srgbToLinear(rgb.blue)
}

/** Tests whether unclamped RGB channels are inside the sRGB display gamut. */
function isInSrgbGamut(rgb: Rgb): boolean {
  return [rgb.red, rgb.green, rgb.blue].every((channel) => channel >= -0.000001 && channel <= 1.000001)
}

/** Mixes two OKLCH lightness values in a direct, readable proportion. */
function mix(first: number, second: number, amount: number): number {
  return first + (second - first) * amount
}

/** Mixes two colors in OKLCH while following the shorter path around hue. */
function mixOklch(first: Oklch, second: Oklch, amount: number): Oklch {
  const hueDifference = ((second.hue - first.hue + 540) % 360) - 180
  return {
    lightness: mix(first.lightness, second.lightness, amount),
    chroma: mix(first.chroma, second.chroma, amount),
    hue: wrapHue(first.hue + hueDifference * amount),
  }
}

/** Restricts a numeric color component to its supported interval. */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** Normalizes a hue to the circular interval from zero to 360 degrees. */
function wrapHue(hue: number): number {
  return (hue + 360) % 360
}
