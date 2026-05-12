import { spawn } from 'node:child_process'

const LOT_NUMBERS = Array.from({ length: 18 }, (_, index) => index + 1)

/**
 * Builds one vitest command line for the requested suite.
 */
function createSuiteCommand(suiteName, extraArgs) {
  if (suiteName === 'all') {
    return [['vitest', ['run', ...extraArgs]]]
  }

  if (suiteName === 'watch') {
    return [['vitest', [...extraArgs]]]
  }

  if (suiteName === 'gates') {
    return ['lot7', 'lot8', 'lot18'].flatMap((nestedSuiteName) =>
      createSuiteCommand(nestedSuiteName, extraArgs)
    )
  }

  if (/^lot\d+$/.test(suiteName)) {
    return [['vitest', ['run', `tests/${suiteName}/`, ...extraArgs]]]
  }

  throw new Error(`Unknown test suite '${suiteName}'`)
}

/**
 * Splits CLI args into suite names and vitest passthrough arguments.
 */
function parseCliArgs(argv) {
  const suiteNames = []
  const extraArgs = []
  let forwardOnly = false

  for (const arg of argv) {
    if (arg === '--') {
      forwardOnly = true
      continue
    }

    if (forwardOnly || arg.startsWith('--')) {
      extraArgs.push(arg)
      continue
    }

    suiteNames.push(arg)
  }

  return { suiteNames, extraArgs }
}

/**
 * Prints one short CLI usage guide.
 */
function printUsage() {
  const lotNames = LOT_NUMBERS.map((lotNumber) => `lot${lotNumber}`).join(', ')
  console.error('Usage: node scripts/run-tests.mjs <suite...> [-- <vitest args...>]')
  console.error(`Available suites: all, watch, gates, ${lotNames}`)
}

/**
 * Executes one command and resolves when it exits successfully.
 */
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited because of signal ${signal}`))
        return
      }

      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`))
        return
      }

      resolve()
    })
  })
}

const { suiteNames, extraArgs } = parseCliArgs(process.argv.slice(2))

if (suiteNames.length === 0) {
  printUsage()
  process.exit(1)
}

let commandPlan

try {
  commandPlan = suiteNames.flatMap((suiteName) => createSuiteCommand(suiteName, extraArgs))
} catch (error) {
  printUsage()
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

for (const [command, args] of commandPlan) {
  // Keep execution sequential so the first failure stops the gate immediately.
  // eslint-disable-next-line no-await-in-loop
  await runCommand(command, args)
}
