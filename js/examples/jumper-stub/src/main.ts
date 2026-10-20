/**
 * The dev page without a shell: with `?mock=1` the stub runs against `JumperMockHost` on the same
 * boot path the shell uses.
 */
import { isMockEnabled, JumperMockHost } from '@omega/webbridge-js';
import { jumperStubBoot } from './jumperStubBoot';

const container = document.getElementById('game');
const hint = document.getElementById('hint');
if (container === null || hint === null) throw new Error('[jumper-stub] index.html lacks #game or #hint');

if (isMockEnabled()) {
  const host = new JumperMockHost();
  host.attach(jumperStubBoot(host, container));
  host.bindKeys();
  hint.textContent = 'Tap / Space — play · C — cash out · B — buy bonus · D — difficulty';
} else {
  hint.textContent = 'Open with ?mock=1 to play against JumperMockHost, or load /game.js from the shell (README).';
}
