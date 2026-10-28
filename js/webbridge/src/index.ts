export { BridgeBase } from './core/BridgeBase';
export { BridgeLogger } from './core/BridgeLogger';
export { BridgeStorage } from './core/BridgeStorage';
export { Signal } from './core/Signal';
export type { SignalHandler } from './core/Signal';
export type { BridgeTransport } from './core/BridgeTransport';
export { isCheatsEnabled, isMockEnabled } from './core/mockMode';

export { CrushBridge } from './crush/CrushBridge';
export type { RestartRequest } from './crush/CrushBridge';

export { PlinkoBridge } from './plinko/PlinkoBridge';
export { PlinkoMockHost } from './plinko/PlinkoMockHost';
export type { PlinkoMockHostOptions, PlinkoMockScenario, PlinkoRisk } from './plinko/PlinkoMockHost';

export { PlinkoAztecBridge } from './plinko-aztec/PlinkoAztecBridge';
export type {
  BallsAmountChange,
  BetPerBallChange,
  SelectionDirection,
} from './plinko-aztec/PlinkoAztecBridge';
export { PlinkoAztecMockHost } from './plinko-aztec/PlinkoAztecMockHost';
export type {
  PlinkoAztecMockHostOptions,
  PlinkoAztecMockScenario,
  PlinkoAztecOptionStep,
} from './plinko-aztec/PlinkoAztecMockHost';

export { JumperBridge } from './jumper/JumperBridge';
export { JumperMockHost } from './jumper/JumperMockHost';
export type { JumperMockHostOptions, JumperMockRange, JumperSlotContent } from './jumper/JumperMockHost';

export { TwistBridge } from './twist/TwistBridge';
export type { TwistBonusSeries } from './twist/TwistBridge';

export { WheelBridge } from './wheel/WheelBridge';

export { MineSlotBridge } from './mine-slot/MineSlotBridge';
export { MineSlotMockHost } from './mine-slot/MineSlotMockHost';
export type { MineSlotMockHostOptions } from './mine-slot/MineSlotMockHost';

export { SlotCoinBridge } from './slot-coin/SlotCoinBridge';
export { SlotCoinMockHost } from './slot-coin/SlotCoinMockHost';
export type { SlotCoinMockHostOptions } from './slot-coin/SlotCoinMockHost';
export { SlotBridge, SlotMockHost } from './slot-coin/legacySlotNames';
export type { SlotMockHostOptions } from './slot-coin/legacySlotNames';

export { MockHost } from './mock/MockHost';
export { MockPanel } from './mock/MockPanel';
export type { MockPanelAction } from './mock/MockPanel';
export type { MockHostOptions } from './mock/MockHost';

export { createWebBoot, registerWebBoot } from './web/createWebBoot';
export type { WebBootConfig } from './web/createWebBoot';
export { createPhaserBoot } from './web/legacyPhaserNames';
export type { PhaserBootConfig } from './web/legacyPhaserNames';

// Форма JSON, что приходит строкой в `*BetBarViewportMetricsReceived`: игре — чтобы
// разбирать её по контракту, а не по памяти.
export type {
  BetBarViewportMetricsPayload,
  ViewportPoint,
  ViewportRect,
} from '@omega/webbridge-protocol';
