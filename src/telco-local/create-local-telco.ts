import type { PlayerApi, PlayerCommandResult } from '../player/types'
import type {
  CreateLocalTelcoInput,
  LocalTelcoApi,
  LocalTelcoCommand,
  LocalTelcoCommandExecutor,
  LocalTelcoCommandResult,
  LocalTelcoResultListener,
  LocalTelcoStateListener
} from './types'

/**
 * Creates one invalid-payload command result.
 */
function toInvalidPayloadResult(commandName: LocalTelcoCommand['name']): PlayerCommandResult {
  return {
    ok: false,
    error: {
      code: 'INVALID_TELCO_COMMAND_PAYLOAD',
      message: `Invalid payload for command ${commandName}`
    }
  }
}

/**
 * Executes one telco command against the player API.
 */
async function executeCommand(command: LocalTelcoCommand, player: PlayerApi): Promise<PlayerCommandResult> {
  switch (command.name) {
    case 'play': {
      return player.play()
    }

    case 'pause': {
      return player.pause()
    }

    case 'seek': {
      if (typeof command.payload?.targetTimelineMs !== 'number' || Number.isNaN(command.payload.targetTimelineMs)) {
        return toInvalidPayloadResult('seek')
      }

      return player.seek(command.payload.targetTimelineMs)
    }

    case 'rewind': {
      return player.rewind()
    }

    case 'rebuild': {
      return player.rebuild(command.payload?.mode)
    }

    case 'destroy': {
      return player.destroy()
    }

    default: {
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_TELCO_COMMAND',
          message: 'Command is not supported by local telco'
        }
      }
    }
  }
}

/**
 * Creates one local telco adapter that controls a player in-process.
 */
export function createLocalTelco(input: CreateLocalTelcoInput): LocalTelcoApi {
  const player = input.player
  const requestIdFactory = input.options?.requestIdFactory
  const resultListeners = new Set<LocalTelcoResultListener>()
  const stateListeners = new Set<LocalTelcoStateListener>()
  let nextRequestIndex = 1

  const commandExecutor: LocalTelcoCommandExecutor = executeCommand

  /**
   * Creates one deterministic telco request identifier.
   */
  function createRequestId(): string {
    if (requestIdFactory) {
      return requestIdFactory()
    }

    const requestId = `telco-request-${nextRequestIndex}`
    nextRequestIndex += 1
    return requestId
  }

  player.onStateChange((state) => {
    for (const listener of stateListeners) {
      listener(state)
    }
  })

  /**
   * Dispatches one telco command and emits the resulting response.
   */
  async function dispatch(command: LocalTelcoCommand): Promise<LocalTelcoCommandResult> {
    const requestId = createRequestId()
    const commandResult = await commandExecutor(command, player)
    const result: LocalTelcoCommandResult = {
      requestId,
      commandName: command.name,
      ok: commandResult.ok,
      error: commandResult.ok ? undefined : commandResult.error,
      playerState: player.getState()
    }

    for (const listener of resultListeners) {
      listener(result)
    }

    return result
  }

  /**
   * Reads current player state snapshot.
   */
  function getState() {
    return player.getState()
  }

  /**
   * Subscribes to local telco command results.
   */
  function onCommandResult(listener: LocalTelcoResultListener): () => void {
    resultListeners.add(listener)
    return () => {
      resultListeners.delete(listener)
    }
  }

  /**
   * Subscribes to player state changes mirrored by local telco.
   */
  function onStateChange(listener: LocalTelcoStateListener): () => void {
    stateListeners.add(listener)
    return () => {
      stateListeners.delete(listener)
    }
  }

  return {
    dispatch,
    getState,
    onCommandResult,
    onStateChange
  }
}
