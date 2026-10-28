import { describe, expect, it } from 'vitest';
import { freeGameSlots, freeGameWaypoints, jumpWaypoints, type JumpPlan } from '../src/modes/jumper/jumperRoute';

const jump = (patch: Partial<JumpPlan>): JumpPlan => ({
  status: 'in-game',
  lineNumber: 0,
  landingStep: 0,
  visitedSteps: [],
  collisionStep: null,
  ...patch,
});

describe('jumpWaypoints', () => {
  it('is the aimed step for a plain jump', () => {
    expect(jumpWaypoints(jump({ lineNumber: 4, landingStep: 4 }))).toEqual([4]);
  });

  it('runs through every accelerator of the chain to the landing', () => {
    const chain = jump({
      lineNumber: 6,
      landingStep: 12,
      visitedSteps: [{ step: 6, accelerator: 'TRAMPOLINE' }, { step: 8, accelerator: 'JETPACK' }],
    });
    expect(jumpWaypoints(chain)).toEqual([6, 8, 12]);
  });

  it('stops a lost jump where the player fell', () => {
    const lost = jump({
      status: 'lose',
      lineNumber: 10,
      landingStep: 12,
      visitedSteps: [{ step: 10, accelerator: 'TRAMPOLINE' }],
      collisionStep: 10,
    });
    expect(jumpWaypoints(lost)).toEqual([10]);
  });

  it('plays the chain up to a fall after an accelerator', () => {
    const lost = jump({
      status: 'lose',
      lineNumber: 6,
      landingStep: 12,
      visitedSteps: [{ step: 6, accelerator: 'TRAMPOLINE' }, { step: 8, accelerator: 'JETPACK' }],
      collisionStep: 12,
    });
    expect(jumpWaypoints(lost)).toEqual([6, 8, 12]);
  });
});

describe('free games', () => {
  const game = {
    finalStep: 6,
    coefficient: 1.4,
    route: [
      { step: 0, action: 'STEP' as const },
      { step: 1, action: 'TRAMPOLINE' as const },
      { step: 3, action: 'STEP' as const },
      { step: 4, action: 'TRAMPOLINE' as const },
    ],
  };

  it('jumps from every platform of the route to the final step', () => {
    expect(freeGameWaypoints(game)).toEqual([0, 1, 3, 4, 6]);
  });

  it('shows the route accelerators as revealed slots', () => {
    expect(freeGameSlots(game)).toEqual([
      { step: 1, state: 'TRAMPOLINE' },
      { step: 4, state: 'TRAMPOLINE' },
    ]);
  });
});
