import { describe, expect, it } from 'vitest';
import type { BridgeBase } from '../src/core/BridgeBase';
import type { BridgeTransport } from '../src/core/BridgeTransport';
import { PlinkoAztecBridge } from '../src/plinko-aztec/PlinkoAztecBridge';
import { PlinkoAztecMockHost } from '../src/plinko-aztec/PlinkoAztecMockHost';
import { PlinkoBridge } from '../src/plinko/PlinkoBridge';
import { PlinkoMockHost } from '../src/plinko/PlinkoMockHost';

/** Мост и мок соединены так же, как их соединяет `createWebBoot`: события — в хост, команды — в мост. */
const connect = <TBridge extends BridgeBase>(
  host: PlinkoMockHost | PlinkoAztecMockHost,
  createBridge: (transport: BridgeTransport) => TBridge,
): TBridge => {
  const bridge = createBridge({ send: (event) => host.emit(event) });
  host.attach({ receive: (command) => bridge.receive(command), destroy: () => {} });
  return bridge;
};

describe('plinko bridges on their mock hosts', () => {
  it('plays a plinko drop through the bridge and frees the bet bar on landing', () => {
    const host = new PlinkoMockHost();
    const bridge = connect(host, (transport) => new PlinkoBridge(transport));
    const drops: unknown[] = [];
    bridge.dropResultReceived.add((result) => drops.push(result));

    host.ready();
    bridge.requestPlay();
    bridge.requestPlay();
    bridge.notifyDropFinished();
    bridge.requestPlay();

    expect(bridge.lastGameConfig).toMatchObject({ currency: 'USD' });
    expect(drops).toHaveLength(2);
  });

  it('syncs the plinko-aztec bet bar and plays the bonus game out by taps', () => {
    const host = new PlinkoAztecMockHost({ random: () => 0, bonusSteps: 2 });
    const bridge = connect(host, (transport) => new PlinkoAztecBridge(transport));
    const steps: unknown[] = [];
    bridge.stepResultReceived.add((result) => steps.push(result));

    host.ready();
    host.drop('bonus-game');
    bridge.notifyDropFinished();
    bridge.requestStep();
    bridge.requestStep();

    expect(bridge.currentBallsAmount).toBe(10);
    expect(bridge.currentBetPerBall).toBe('1');
    expect(steps).toHaveLength(2);
    expect(bridge.lastGameState).toMatchObject({ status: 'win', isFinished: true });
    expect(host.isBonusActive).toBe(false);
  });
});
