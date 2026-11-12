import { RIVE_ENGINE, RIVE_PRELOAD_STRATEGIES } from "@codplay/component-v2";

export { createScene } from "./scene";

/** Supplies the shared Rive host and attached ViewModel to the V2 engine. */
export const engineCapabilities = RIVE_ENGINE;

/** Loads Rive documents with the existing V2 media preload circuit. */
export const preloadStrategies = RIVE_PRELOAD_STRATEGIES;
