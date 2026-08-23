/**
 * Аналог WebBridgeUtils.*LocalStorage. В Unity это три функции в .jslib с
 * ручным маршалингом строк; здесь — прямой localStorage.
 */
import { BridgeLogger } from './BridgeLogger';

export const BridgeStorage = {
  save(key: string, value: string): void {
    BridgeLogger.log(`[BridgeStorage] Save '${key}': ${value}`);
    localStorage.setItem(key, value);
  },

  load(key: string): string | null {
    const value = localStorage.getItem(key);
    BridgeLogger.log(`[BridgeStorage] Load '${key}': ${value ?? 'null'}`);
    return value;
  },

  remove(key: string): void {
    BridgeLogger.log(`[BridgeStorage] Remove '${key}'`);
    localStorage.removeItem(key);
  },
};
