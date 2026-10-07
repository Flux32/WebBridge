/**
 * Канал «мост → React». Ядро моста знает только его, поэтому не зависит ни от
 * движка, ни от способа доставки: в веб-игре это `host.emit`, под тестами —
 * массив-накопитель.
 */
import type { EngineEvent } from '@omega/webbridge-protocol';

export interface BridgeTransport {
  send(event: EngineEvent): void;
}
