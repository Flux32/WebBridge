/**
 * Собственные события игры для аналитики (ADR-0011) — зеркало C#-шного `Analytics`. Игра называет
 * событие и кладёт плоские параметры, а контекст (игра, сессия, релиз, устройство) добавляет шелл.
 *
 * Метод синхронный, ничего не возвращает и не бросает: аналитика не должна ронять игру. Мост проверяет
 * событие по правилам протокола только для предупреждения в лог и всё равно отправляет его — решение об
 * отказе принимает шелл, правило одно.
 */
import type { GameEventParams } from '@omega/webbridge-protocol';
import { BridgeLogger } from './BridgeLogger';
import type { BridgeTransport } from './BridgeTransport';
import { findGameEventRejection } from './gameEventRules';

/** Свои параметры поверх стандартных: в пределах 20 на событие. */
export type LevelStartParams = { readonly attempt?: number } & GameEventParams;
export type LevelCompleteParams = { readonly duration_ms?: number; readonly score?: number } & GameEventParams;
export type LevelFailParams = { readonly duration_ms?: number; readonly reason?: string } & GameEventParams;
export type ResourceSourceParams = {
  readonly currency: string;
  readonly amount: number;
  readonly source: string;
} & GameEventParams;
export type ResourceSinkParams = {
  readonly currency: string;
  readonly amount: number;
  readonly sink: string;
} & GameEventParams;

export class BridgeAnalytics {
  public constructor(private readonly transport: BridgeTransport) {}

  /**
   * Своё событие. Имя — `a-z`, цифры и `_`, до 64 символов; параметры — строки, конечные числа и флаги.
   * Без персональных данных и денег: ставка, выигрыш и баланс приходят с бэкенда.
   */
  public track(name: string, params?: GameEventParams): void {
    const rejection = findGameEventRejection(name, params);
    if (rejection !== null) {
      BridgeLogger.warn(`[WebBridge] TrackEvent "${String(name)}" will be rejected by the shell: ${rejection}`);
    }

    // Копия: игра не должна менять объект, пока он лежит во входном буфере шелла.
    this.transport.send({ type: 'TrackEvent', name, ...(params === undefined ? {} : { params: { ...params } }) });
  }

  /** `level_start`: уровень — этап бонуса, ступень лестницы, стадия; число приводится к строке. */
  public levelStart(level: string | number, params?: LevelStartParams): void {
    this.track('level_start', { ...params, level: String(level) });
  }

  public levelComplete(level: string | number, params?: LevelCompleteParams): void {
    this.track('level_complete', { ...params, level: String(level) });
  }

  public levelFail(level: string | number, params?: LevelFailParams): void {
    this.track('level_fail', { ...params, level: String(level) });
  }

  /** Внутриигровой ресурс пришёл (сундук, награда). Деньги игрока сюда не относятся. */
  public resourceSource(params: ResourceSourceParams): void {
    this.track('resource_source', params);
  }

  /** Внутриигровой ресурс потрачен. */
  public resourceSink(params: ResourceSinkParams): void {
    this.track('resource_sink', params);
  }
}
