let nextId = 1

/** Allocates one unique identifier for a temporary replace presentation node. */
export function nextReplacePresentationId(): number {
  const id = nextId
  nextId += 1
  return id
}
