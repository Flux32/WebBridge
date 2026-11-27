import type { EngineEvent } from '@omega/webbridge-protocol';
import { BridgeLogger } from '../core/BridgeLogger';

/**
 * Мок-хост — не шелл: собственное событие игры никуда не уходит, его видно только в логе моста
 * (`BridgeLogger.isEnabled`), чтобы разработчик сверил имя и параметры.
 */
export const logTrackEvent = (event: Extract<EngineEvent, { type: 'TrackEvent' }>): void => {
  BridgeLogger.log(`[WebBridge] TrackEvent: ${event.name} ${JSON.stringify(event.params ?? {})}`);
};
