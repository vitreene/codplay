import { createRouter } from 'remix/router'
import { isEditorScene } from '../../app/persistence/editor-scene-guard'
import type { SqliteEditorScenePersistence } from './sqlite/sqlite-editor-scene-persistence'

/** Creates the local scene catalogue and document routes. */
export function createEditorSceneApiRouter(persistence: SqliteEditorScenePersistence) {
  const router = createRouter({
    defaultHandler() {
      return Response.json({ error: 'Route introuvable.' }, { status: 404 })
    },
  })

  router.get('/api/scenes', async () => Response.json({
    scenes: await persistence.listScenes(),
    activeSceneId: await persistence.findActiveSceneId(),
  }))

  router.get('/api/scenes/:sceneId', async ({ params }) => {
    const stored = await persistence.findScene(params.sceneId!)
    if (stored === null) return errorResponse('Scène introuvable.', 404)
    return Response.json(stored)
  })

  router.put('/api/scenes/:sceneId', async ({ params, request }) => {
    const body = await readJsonBody(request)
    if (body === null || !isRecord(body) || !isEditorScene(body.scene)
      || body.scene.id !== params.sceneId
      || !(body.expectedRevision === null
        || typeof body.expectedRevision === 'number' && Number.isInteger(body.expectedRevision) && body.expectedRevision >= 0)) {
      return errorResponse('La scène ou sa révision attendue est invalide.', 400)
    }

    const result = await persistence.saveScene(body.scene, body.expectedRevision)
    if (result.kind === 'conflict') {
      return Response.json({ error: 'La scène a été modifiée depuis son dernier chargement.', ...result }, { status: 409 })
    }
    return Response.json(result)
  })

  router.put('/api/active-scene', async ({ request }) => {
    const body = await readJsonBody(request)
    if (body === null || !isRecord(body)
      || !(body.sceneId === null || typeof body.sceneId === 'string')) {
      return errorResponse('L’identifiant de scène active est invalide.', 400)
    }
    const stored = await persistence.setActiveSceneId(body.sceneId)
    return stored ? new Response(null, { status: 204 }) : errorResponse('Scène introuvable.', 404)
  })

  return router
}

/** Reads a request JSON body, returning null for malformed JSON. */
async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** Creates a compact JSON error response for local API callers. */
function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

/** Narrows unknown request objects without accepting arrays. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
