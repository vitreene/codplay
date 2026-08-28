/** Narrows one value to a browser element with the geometry API required by V2. */
export function isMeasurableHtmlElement(value: unknown): value is Element {
  return typeof Element !== 'undefined'
    && value instanceof Element
    && value.ownerDocument !== undefined
    && typeof (value as Element & { getBoundingClientRect?: unknown }).getBoundingClientRect === 'function'
}
