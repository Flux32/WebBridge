/**
 * The bundle entry the shell loads: `localBuildServer` serves it as `/game.js`, and the shell's
 * `?localBuild=` picks it up exactly like a configurator build.
 */
import { registerWebBoot } from '@omega/webbridge-js';
import { jumperStubBoot } from './jumperStubBoot';

registerWebBoot(jumperStubBoot);
