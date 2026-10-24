import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const PACKAGE_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..')
const PALETTE_DIRECTORY = resolve(PACKAGE_DIRECTORY, 'src/config/appearance/css/palettes')
const OUTPUT_FILE = resolve(PACKAGE_DIRECTORY, 'src/config/appearance/appearance-palette-colors.generated.ts')
const PALETTE_IDS = ['classic', 'ocean', 'forest', 'plum', 'slate']
const COLOR_ROLES = ['background', 'surface', 'text', 'muted', 'accent', 'border']

/** Reads the six semantic role colors from one authored palette stylesheet. */
async function readPaletteColors(paletteId) {
  const css = await readFile(resolve(PALETTE_DIRECTORY, `${paletteId}.css`), 'utf8')
  const colors = Object.fromEntries([...css.matchAll(/--elce-palette-(background|surface|text|muted|accent|border):\s*(#[\da-f]{6})\s*;/gi)]
    .map((match) => [match[1], match[2].toLowerCase()]))
  if (Object.keys(colors).length !== COLOR_ROLES.length
    || COLOR_ROLES.some((role) => colors[role] === undefined)) {
    throw new Error(`Palette CSS ${paletteId} doit définir exactement les six rôles attendus.`)
  }
  return colors
}

/** Writes TypeScript picker metadata derived from the canonical palette CSS files. */
async function generatePaletteMetadata() {
  const palettes = Object.fromEntries(await Promise.all(PALETTE_IDS.map(async (paletteId) => [
    paletteId,
    await readPaletteColors(paletteId),
  ])))
  const source = [
    '// Generated from src/config/appearance/css/palettes/*.css; do not edit.',
    `export const APPEARANCE_PALETTE_COLORS = ${JSON.stringify(palettes, null, 2)} as const`,
    '',
  ].join('\n')
  await writeFile(OUTPUT_FILE, source)
}

await generatePaletteMetadata()
