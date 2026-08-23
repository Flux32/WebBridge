/**
 * Аналог C#-шного WebBridgeLogger: в сборке логи выключены, включаются командой
 * SetLoggingEnabled (её шлёт чит-панель).
 */
export const BridgeLogger = {
  isEnabled: false,

  log(message: string): void {
    if (this.isEnabled) console.log(message);
  },

  warn(message: string): void {
    if (this.isEnabled) console.warn(message);
  },

  error(message: string): void {
    console.error(message);
  },
};
