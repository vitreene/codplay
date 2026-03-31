import type { RuntimeAdapter } from './types';

interface LegacyTelcoLike {
  play?: () => void;
  pause?: () => void;
  seek?: (ms: number, trackName: string) => void;
}

interface LegacyBridgeOptions {
  telco: LegacyTelcoLike;
  defaultTrack?: string;
  runLegacyAction?: (actionName: string) => void;
}

// Pont minimal entre l'orchestrateur et un runtime legacy.
// Remplacer les logs par des appels runtime reels.
export function createLegacyAdapter(options: LegacyBridgeOptions): RuntimeAdapter {
  const { telco, runLegacyAction } = options;

  return {
    playClip: (clipId: string) => {
      console.log('[legacy-adapter] playClip', clipId);
      telco.play?.();
    },

    stopClip: (clipId: string) => {
      console.log('[legacy-adapter] stopClip', clipId);
      telco.pause?.();
    },

    runAction: (actionName: string) => {
      console.log('[legacy-adapter] runAction', actionName);
      runLegacyAction?.(actionName);
    },
  };
}
