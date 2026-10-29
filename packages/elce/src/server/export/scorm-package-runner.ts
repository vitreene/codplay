import { spawn } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'
import type { ScormVersion } from '@codplay/sighty-scorm'

/** Identifies the edition and CLI mono-SCO branch requested by Elcé's export form. */
export interface ElceScormPackageOptions {
  readonly version: ScormVersion
  readonly monoSco: boolean
}

/** Describes the downloadable SCORM archive and any individual packages it contains. */
export interface ElceScormPackageResult {
  readonly archive: Uint8Array
  readonly packageCount: number
}

const SCORM_CLI = fileURLToPath(new URL('../../../scripts/package-scorm.mjs', import.meta.url))

/** Packages an existing Sighty ZIP by invoking Elcé's established SCORM CLI. */
export async function runElceScormPackage(
  sightyPackage: Uint8Array,
  options: ElceScormPackageOptions,
): Promise<ElceScormPackageResult> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'elce-scorm-export-'))
  try {
    const inputPath = join(temporaryDirectory, 'scenario.sighty.zip')
    await writeFile(inputPath, sightyPackage)
    await runScormCli(inputPath, options)

    const outputDirectory = join(temporaryDirectory, '-=scorm_packages=-')
    const packageNames = (await readdir(outputDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.zip'))
      .map((entry) => entry.name)
      .sort()
    if (packageNames.length === 0) throw new Error('La génération SCORM n’a produit aucune archive.')

    if (packageNames.length === 1) {
      const filename = packageNames[0]!
      return {
        archive: new Uint8Array(await readFile(join(outputDirectory, filename))),
        packageCount: 1,
      }
    }

    const packages: Record<string, Uint8Array> = Object.create(null) as Record<string, Uint8Array>
    for (const filename of packageNames) packages[filename] = new Uint8Array(await readFile(join(outputDirectory, filename)))
    return {
      archive: zipSync(packages, { level: 0 }),
      packageCount: packageNames.length,
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

/** Runs the SCORM CLI against a temporary Sighty archive and captures diagnostics. */
function runScormCli(inputPath: string, options: ElceScormPackageOptions): Promise<void> {
  const argumentsList = [SCORM_CLI, inputPath, `--version=${options.version}`, '--zip=true']
  if (options.monoSco) argumentsList.push('--monoSco')

  return new Promise<void>((resolveProcess, rejectProcess) => {
    const child = spawn(process.execPath, argumentsList, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const collectOutput = (chunk: string | Buffer): void => {
      output = `${output}${chunk.toString()}`.slice(-16_000)
    }
    child.stdout.setEncoding('utf8').on('data', collectOutput)
    child.stderr.setEncoding('utf8').on('data', collectOutput)
    child.once('error', rejectProcess)
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolveProcess()
        return
      }
      rejectProcess(new Error(output.trim() || `La génération SCORM s’est arrêtée (${signal ?? code}).`))
    })
  })
}
