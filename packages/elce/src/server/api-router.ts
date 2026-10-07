import { createRouter } from 'remix/router'

/** Creates the server Fetch router; project and media endpoints are added with their storage work. */
export function createElceApiRouter() {
  return createRouter({
    defaultHandler() {
      return new Response(null, { status: 404 })
    },
  })
}
