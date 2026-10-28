/** The bundle entry the shell loads as `game.js`. */
import { registerWebBoot } from '@omega/webbridge-js';
import { createDemoBoot } from '../../kit/demoBoot';
import { twistMode } from '.';

registerWebBoot(createDemoBoot(twistMode));
