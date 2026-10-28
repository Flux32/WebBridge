import { describe, expect, it } from 'vitest';
import { Animator } from '../src/kit/Animator';
import { BackendFeed, describeMessage } from '../src/kit/BackendFeed';
import { MoveQueue } from '../src/kit/MoveQueue';
import { settle } from './recording';

describe('Animator', () => {
  it('resolves a motion only once its time has passed, after its last frame', async () => {
    let now = 0;
    const animator = new Animator(() => now, () => undefined);
    const frames: number[] = [];
    let isPlayed: boolean | null = null;
    void animator.play(100, (progress) => frames.push(progress)).then((value) => (isPlayed = value));

    now = 50;
    animator.tick(now);
    await settle();
    expect(isPlayed).toBeNull();

    now = 120;
    animator.tick(now);
    await settle();
    expect(isPlayed).toBe(true);
    expect(frames).toEqual([0, 0.5, 1]);
    expect(animator.isMoving).toBe(false);
  });

  it('settles a cut-short motion with false', async () => {
    const animator = new Animator(() => 0, () => undefined);
    const motion = animator.play(100, () => undefined);
    animator.cancelAll();
    await expect(motion).resolves.toBe(false);
  });
});

describe('MoveQueue', () => {
  it('plays moves one after another', async () => {
    const queue = new MoveQueue();
    const order: string[] = [];
    let finishFirst: () => void = () => undefined;
    queue.enqueue(() => new Promise<boolean>((resolve) => (finishFirst = () => { order.push('first'); resolve(true); })));
    queue.enqueue(async () => void order.push('second'));

    await settle();
    expect(order).toEqual([]);
    finishFirst();
    await settle();
    expect(order).toEqual(['first', 'second']);
  });

  it('stops for good once a move was cut short', async () => {
    const queue = new MoveQueue();
    const order: string[] = [];
    queue.enqueue(async () => false);
    queue.enqueue(async () => void order.push('after'));
    await settle();
    expect(order).toEqual([]);
  });
});

describe('BackendFeed', () => {
  it('keeps the protocol and drops the host plumbing', () => {
    const feed = new BackendFeed(() => undefined);
    feed.record('in', { type: 'SyncUiVisibility' });
    feed.record('in', { type: 'ApplyStepResult', payload: { isWinMain: true, coinsTriggered: false, coinsCollected: [] } });
    feed.record('out', { type: 'SpinReady' });
    expect(feed.entries.map((line) => line.text)).toEqual([
      'ApplyStepResult {"isWinMain":true,"coinsTriggered":false,"coinsCollected":[]}',
      'SpinReady',
    ]);
  });

  it('keeps only the latest lines', () => {
    const feed = new BackendFeed(() => undefined);
    for (let index = 0; index < 8; index += 1) feed.record('out', { type: 'SpinReady' });
    expect(feed.entries).toHaveLength(5);
  });

  it('describes an event with its raw payload', () => {
    expect(describeMessage({ type: 'BonusProgressSave', raw: '{"completedIterations":1}' })).toBe(
      'BonusProgressSave {"completedIterations":1}',
    );
  });
});
