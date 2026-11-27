/**
 * Pure conversions from every CSS Color 4 space to OKLCH, the single color
 * space kept by compiled scenes and ACE. Matrices and transfer functions follow
 * the CSS Color 4 sample code; only the forward direction is needed because
 * colors are rendered as CSS `oklch(...)`.
 */

type Vector = readonly [number, number, number]
type Matrix = readonly [Vector, Vector, Vector]

/** Predefined RGB and XYZ spaces of the CSS `color()` function. */
export type PredefinedColorSpace =
  | 'srgb' | 'srgb-linear' | 'display-p3' | 'a98-rgb' | 'prophoto-rgb' | 'rec2020'
  | 'xyz' | 'xyz-d50' | 'xyz-d65'

const LINEAR_SRGB_TO_XYZ: Matrix = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
]
const LINEAR_P3_TO_XYZ: Matrix = [
  [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
  [35783 / 156275, 247089 / 357200, 198249 / 2500400],
  [0, 32229 / 714400, 5220557 / 5000800],
]
const LINEAR_A98_TO_XYZ: Matrix = [
  [573536 / 994567, 263643 / 1420810, 187206 / 994567],
  [591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
  [53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
]
const LINEAR_REC2020_TO_XYZ: Matrix = [
  [63426534 / 99577255, 20160776 / 139408157, 47086771 / 278816314],
  [26158966 / 99577255, 472592308 / 697040785, 8267143 / 139408157],
  [0, 19567812 / 697040785, 295819943 / 278816314],
]
/** ProPhoto RGB is defined against the D50 white point. */
const LINEAR_PROPHOTO_TO_XYZ_D50: Matrix = [
  [0.7977666449006423, 0.13518129740053308, 0.0313477341283922858],
  [0.2880748288194013, 0.7118352342418731, 0.00008993693872564],
  [0, 0, 0.8251046025104602],
]
/** Bradford chromatic adaptation from D50 to D65. */
const XYZ_D50_TO_D65: Matrix = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
]
const XYZ_TO_LMS: Matrix = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
]
const LMS_TO_OKLAB: Matrix = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
]
const D50_WHITE: Vector = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585]
const LAB_KAPPA = 24389 / 27
const LAB_EPSILON = 216 / 24389

/** Converts gamma-encoded sRGB channels in [0, 1] to OKLCH. */
export function srgbToOklch(rgb: Vector): Vector {
  return xyzD65ToOklch(multiply(LINEAR_SRGB_TO_XYZ, mapVector(rgb, srgbToLinear)))
}

/** Converts one predefined `color()` space to OKLCH. */
export function predefinedToOklch(space: PredefinedColorSpace, coords: Vector): Vector {
  if (space === 'srgb') return srgbToOklch(coords)
  if (space === 'srgb-linear') return xyzD65ToOklch(multiply(LINEAR_SRGB_TO_XYZ, coords))
  if (space === 'display-p3') return xyzD65ToOklch(multiply(LINEAR_P3_TO_XYZ, mapVector(coords, srgbToLinear)))
  if (space === 'a98-rgb') return xyzD65ToOklch(multiply(LINEAR_A98_TO_XYZ, mapVector(coords, a98ToLinear)))
  if (space === 'rec2020') return xyzD65ToOklch(multiply(LINEAR_REC2020_TO_XYZ, mapVector(coords, rec2020ToLinear)))
  if (space === 'prophoto-rgb') {
    return xyzD50ToOklch(multiply(LINEAR_PROPHOTO_TO_XYZ_D50, mapVector(coords, prophotoToLinear)))
  }
  if (space === 'xyz-d50') return xyzD50ToOklch(coords)
  return xyzD65ToOklch(coords)
}

/** Converts HSL (hue in degrees, saturation and lightness in [0, 1]) to sRGB. */
export function hslToSrgb(hue: number, saturation: number, lightness: number): Vector {
  const channel = (offset: number): number => {
    const k = (offset + hue / 30) % 12
    const amount = saturation * Math.min(lightness, 1 - lightness)
    return lightness - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [channel(0), channel(8), channel(4)]
}

/** Converts HWB (hue in degrees, whiteness and blackness in [0, 1]) to sRGB. */
export function hwbToSrgb(hue: number, whiteness: number, blackness: number): Vector {
  if (whiteness + blackness >= 1) {
    const gray = whiteness / (whiteness + blackness)
    return [gray, gray, gray]
  }
  return mapVector(hslToSrgb(hue, 1, 0.5), (channel) => channel * (1 - whiteness - blackness) + whiteness)
}

/** Converts CIE Lab (D50) to OKLCH. */
export function labToOklch(lightness: number, a: number, b: number): Vector {
  const f1 = (lightness + 16) / 116
  const f0 = a / 500 + f1
  const f2 = f1 - b / 200
  const x = f0 ** 3 > LAB_EPSILON ? f0 ** 3 : (116 * f0 - 16) / LAB_KAPPA
  const y = lightness > LAB_KAPPA * LAB_EPSILON ? f1 ** 3 : lightness / LAB_KAPPA
  const z = f2 ** 3 > LAB_EPSILON ? f2 ** 3 : (116 * f2 - 16) / LAB_KAPPA
  return xyzD50ToOklch([x * D50_WHITE[0], y * D50_WHITE[1], z * D50_WHITE[2]])
}

/** Converts a polar color (lightness, chroma, hue in degrees) to its rectangular a/b form. */
export function polarToRectangular(lightness: number, chroma: number, hue: number): Vector {
  const radians = hue * Math.PI / 180
  return [lightness, chroma * Math.cos(radians), chroma * Math.sin(radians)]
}

/** Converts OKLab to OKLCH, with the hue wrapped into [0, 360). */
export function oklabToOklch(lab: Vector): Vector {
  const chroma = Math.hypot(lab[1], lab[2])
  const hue = Math.atan2(lab[2], lab[1]) * 180 / Math.PI
  return [lab[0], chroma, hue < 0 ? hue + 360 : hue]
}

/** Adapts CIE XYZ from the D50 to the D65 white point, then converts it to OKLCH. */
function xyzD50ToOklch(xyz: Vector): Vector {
  return xyzD65ToOklch(multiply(XYZ_D50_TO_D65, xyz))
}

/** Converts CIE XYZ (D65) to OKLCH through the OKLab LMS cone response. */
function xyzD65ToOklch(xyz: Vector): Vector {
  return oklabToOklch(multiply(LMS_TO_OKLAB, mapVector(multiply(XYZ_TO_LMS, xyz), Math.cbrt)))
}

/** Removes the sRGB (and Display P3) transfer function from one channel. */
function srgbToLinear(channel: number): number {
  const magnitude = Math.abs(channel)
  return magnitude <= 0.04045 ? channel / 12.92 : Math.sign(channel) * ((magnitude + 0.055) / 1.055) ** 2.4
}

/** Removes the Adobe RGB (1998) transfer function from one channel. */
function a98ToLinear(channel: number): number {
  return Math.sign(channel) * Math.abs(channel) ** (563 / 256)
}

/** Removes the ProPhoto RGB transfer function from one channel. */
function prophotoToLinear(channel: number): number {
  const magnitude = Math.abs(channel)
  return magnitude <= 16 / 512 ? channel / 16 : Math.sign(channel) * magnitude ** 1.8
}

/** Removes the Rec. 2020 transfer function from one channel. */
function rec2020ToLinear(channel: number): number {
  const alpha = 1.09929682680944
  const beta = 0.018053968510807
  const magnitude = Math.abs(channel)
  return magnitude < beta * 4.5 ? channel / 4.5 : Math.sign(channel) * ((magnitude + alpha - 1) / alpha) ** (1 / 0.45)
}

/** Multiplies one 3×3 matrix by one vector. */
function multiply(matrix: Matrix, vector: Vector): Vector {
  return mapVector([0, 1, 2], (row) =>
    matrix[row][0] * vector[0] + matrix[row][1] * vector[1] + matrix[row][2] * vector[2])
}

/** Applies one function to each component of a vector. */
function mapVector(vector: Vector, map: (value: number) => number): Vector {
  return [map(vector[0]), map(vector[1]), map(vector[2])]
}
