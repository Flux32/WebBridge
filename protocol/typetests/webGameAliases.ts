/**
 * The legacy Phaser names are the very same types as the web ones: a game built on
 * the old names and a shell on the new ones speak one contract.
 */
import type {
  PhaserBootFn,
  PhaserBootOptions,
  PhaserGameBridge,
  PhaserHostBridge,
  WebBootFn,
  WebBootOptions,
  WebGameBridge,
  WebHostBridge,
} from '../src';
import type { Equal, Expect } from './typeEqual';

type _hostAlias = Expect<Equal<PhaserHostBridge, WebHostBridge>>;
type _gameAlias = Expect<Equal<PhaserGameBridge, WebGameBridge>>;
type _optionsAlias = Expect<Equal<PhaserBootOptions, WebBootOptions>>;
type _bootAlias = Expect<Equal<PhaserBootFn, WebBootFn>>;
type _legacyGlobals = Expect<Equal<Window['__PHASER_BOOT__'], Window['__WEB_GAME_BOOT__']>>;
