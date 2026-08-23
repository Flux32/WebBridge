/**
 * Замена C#-шного `event Action<T>`: подписка возвращает функцию отписки,
 * исключение подписчика не роняет остальных.
 */
export type SignalHandler<T> = (value: T) => void;

export class Signal<T = void> {
  private readonly handlers = new Set<SignalHandler<T>>();

  public add(handler: SignalHandler<T>): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  public remove(handler: SignalHandler<T>): void {
    this.handlers.delete(handler);
  }

  public clear(): void {
    this.handlers.clear();
  }

  public invoke(value: T): void {
    this.handlers.forEach((handler) => {
      try {
        handler(value);
      } catch (error) {
        console.error('[WebBridge] Signal handler threw', error);
      }
    });
  }
}
