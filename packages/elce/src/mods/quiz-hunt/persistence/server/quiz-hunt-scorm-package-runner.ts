import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ScormVersion } from '@codplay/sighty-scorm'

const QUIZ_HUNT_SCORM_CLI = fileURLToPath(new URL('../../../../../scripts/package-quiz-hunt-scorm.mjs', import.meta.url))

/** Packages one exported Quiz Hunt Sighty ZIP as exactly one SCORM archive. */
export async function runQuizHuntScormPackage(
  sightyPackage: Uint8Array,
  version: ScormVersion,
): Promise<Uint8Array> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'quiz-hunt-scorm-export-'))
  try {
    const inputPath = join(temporaryDirectory, 'quiz-hunt.sighty.zip')
    const outputPath = join(temporaryDirectory, 'quiz-hunt-scorm.zip')
    await writeFile(inputPath, sightyPackage)
    await runScormCli(inputPath, outputPath, version)
    return new Uint8Array(await readFile(outputPath))
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

/** Runs the mod-owned SCORM packager and captures its diagnostics. */
function runScormCli(inputPath: string, outputPath: string, version: ScormVersion): Promise<void> {
  return new Promise<void>((resolveProcess, rejectProcess) => {
    const child = spawn(process.execPath, [QUIZ_HUNT_SCORM_CLI, inputPath, outputPath, `--version=${version}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
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
      rejectProcess(new Error(output.trim() || `L’export SCORM Quiz Hunt s’est arrêté (${signal ?? code}).`))
    })
  })
}
