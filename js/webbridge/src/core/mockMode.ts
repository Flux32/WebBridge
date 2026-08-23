/**
 * Аналог WebBridgeUtils.IsMockEnabled / IsCheatsEnabled. В Unity источник —
 * дефайны сборки и EditorPrefs; в вебе достаточно URL-параметров, как это уже
 * сделано во фронтенде (`?mock=1`, `?engine=phaser`).
 */
const hasFlag = (name: string): boolean => {
  const raw = new URLSearchParams(window.location.search).get(name);
  return raw === '1' || raw === 'true';
};

export const isMockEnabled = (): boolean => hasFlag('mock');
export const isCheatsEnabled = (): boolean => hasFlag('cheats');
