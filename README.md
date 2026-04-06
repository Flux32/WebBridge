# WebBridge

Unity package for React-Unity communication in WebGL builds. Provides a set of singleton bridge components that handle messaging between React frontend and Unity game.

## Installation

Add to `Packages/manifest.json`:

```json
"com.pixi.webbridge": "https://github.com/Flux32/WebBridge.git"
```

Or for a specific version:

```json
"com.pixi.webbridge": "https://github.com/Flux32/WebBridge.git#v1.0.0"
```

**Dependencies**: `com.unity.nuget.newtonsoft-json` (resolved automatically).

## Quick Start

1. In Hierarchy click **+ -> WebBridge** (or drag the prefab from `Packages/WebBridge/Runtime/Prefabs/`)
2. The prefab contains all 4 bridge components with default mock settings
3. Enable mock mode via **Tools -> WebBridge -> Enable Mock**

## Architecture

WebBridge is split into 4 independent singleton components. Each is a pure communication layer between React and Unity with no game-logic dependencies.

```
React (JS)  <──SendMessage──>  WebBridge Components  <──Events──>  Game Code
```

Game objects depend on bridges (subscribe to events), not the other way around.

| Component | Responsibility |
|---|---|
| `GameWebBridge` | Coefficients, bets, cashout, step results, bonus system |
| `LayoutWebBridge` | UI element visibility, bet bars, settings, logo |
| `ScreenOrientationWebBridge` | Screen orientation, aspect ratio |
| `AudioWebBridge` | Sound effects, music |

### Connecting Game Logic

Bridges fire events. Your game code subscribes:

```csharp
void OnEnable()
{
    GameWebBridge.Instance.StepResultActionReady += OnStepResult;
    GameWebBridge.Instance.CoefficientsReceived += OnCoefficients;
    ScreenOrientationWebBridge.Instance.OrientationChanged += OnOrientation;
}

void OnStepResult(StepResultAction action)
{
    // action.IsWin, action.BonusStepTriggered, action.AutoCashoutAmount
}

void OnCoefficients(float[] coefficients)
{
    // Generate road steps from coefficients
}

void OnOrientation(bool isMobileUi)
{
    // Switch layout
}
```

## Mock Mode

Mock mode simulates React responses locally for testing without a web build.

### Enable Mock (Editor only)

**Tools -> WebBridge -> Enable Mock**

Stored in `EditorPrefs`. Active only in Editor Play Mode. No code can override it - the state is read directly from `EditorPrefs` at runtime.

### Enable Mock In Build

**Tools -> WebBridge -> Enable Mock In Build**

Adds the `WEBBRIDGE_MOCK` scripting define symbol. When set, `IsMockEnabled` returns `true` in builds. Toggle it off before production builds.

### Mock Inspector Settings

With mock enabled, `GameWebBridge` reads its serialized fields:

| Field | Description |
|---|---|
| `Mock Coefficients` | Step coefficient values |
| `Mock Bonus Counts` | Difficulty modes with count, price, currency |
| `Mock Lose Chance` | Probability of losing a step (0-1) |
| `Mock Bonus Step Trigger Chance` | Probability of triggering a bonus step (0-1) |
| `Mock Bonus Steps Threshold` | Bonus steps required to activate bonus game |
| `Mock Bet Amount` | Simulated bet amount |
| `Mock Win Decimals` | Decimal places in win amount strings |
| `Mock Bonus Positions` | Default bonus positions array |

`ScreenOrientationWebBridge` has its own mock settings:

| Field | Description |
|---|---|
| `Use Mock Aspect Ratio` | Override real screen aspect ratio |
| `Mock Aspect Ratio` | Simulated aspect ratio value |

## API Reference

### GameWebBridge

**Events:**

| Event | Args | Description |
|---|---|---|
| `GameConfigReceived` | `WebGameConfigPayload` | Game config received from React |
| `GameStateReceived` | `WebGameStatePayload` | Game state updated |
| `StepResultReceived` | `WebGameStatePayload` | Raw step result received |
| `StepResultActionReady` | `StepResultAction` | Processed step result ready for game logic |
| `CoefficientsReceived` | `float[]` | New coefficients to generate road |
| `SpinRequested` | `int` | Non-mock spin request (win=1, lose=0) |
| `CashoutRequested` | `string` | Cashout request with amount |
| `BonusModePurchased` | `string, int` | Bonus purchased (modeId, positionsCount) |
| `BonusModePurchaseFailed` | `string` | Bonus purchase failed (modeId) |
| `BuyBonusButtonClicked` | - | Buy bonus button pressed in bet bar |

**React -> Unity methods** (called via `SendMessage`):

```
ApplyGameConfig(string json)
ApplyGameState(string json)
ApplyStepResult(string json)
ApplyBonusPurchaseResult(string json)
UpdateCoeffs(string csv)
DoSpin(int win)
DoCashout(string amount)
OnBuyBonusButtonClicked()
```

**Properties:**

| Property | Type | Description |
|---|---|---|
| `LastGameConfig` | `WebGameConfigPayload` | Last received game config |
| `LastGameState` | `WebGameStatePayload` | Last game state |
| `LastStepResult` | `WebGameStatePayload` | Last step result |
| `CanProcessMockSpin` | `Func<bool>` | Optional guard for mock spins |

### LayoutWebBridge

**Events:**

| Event | Args | Description |
|---|---|---|
| `MobileBetBarViewportChanged` | `WebMobileBetBarViewportPayload` | Mobile bet bar dimensions changed |
| `BetBarHideStateChanged` | `WebBetBarHideStatePayload` | Bet bar visibility changed |

**Methods:**

```csharp
SetHideDesktopBetBar(bool isHidden)
SetHideMobileBetBar(bool isHidden)
SetHideMobileLastWin(bool isHidden)
SetHideSettingsMenuButton(bool isHidden)
SetHideLogo(bool isHidden)
SetBetBarInteractable(bool isInteractable)
SetMobileBetBarInteractable(bool isInteractable)
SyncUiVisibility()
```

**Properties:** `IsDesktopBetBarHidden`, `IsMobileBetBarHidden`, `IsMobileLastWinHidden`, `IsSettingsMenuButtonHidden`, `IsLogoHidden`, `MobileBetBarViewportWidth`, `MobileBetBarViewportHeightEnd`

### ScreenOrientationWebBridge

**Events:**

| Event | Args | Description |
|---|---|---|
| `OrientationChanged` | `bool` | isMobileUi flag changed |
| `OrientationRawChanged` | `int` | Raw orientation value from React |

**Methods:**

```csharp
ChangeOrientation(int orientation)  // React -> Unity
SetUseMockAspectRatio(bool use)
SetMockAspectRatio(float ratio)
```

**Properties:** `IsMobileUi`, `CurrentAspectRatio`, `UseMockAspectRatio`, `MockAspectRatio`

### AudioWebBridge

```csharp
PlaySound(Sounds sound)  // Sends PlaySound_{id} to React
PlayMusic(Sounds sound)  // Sends PlayMusic_{id} to React
```

### WebBridgeUtils

```csharp
static bool IsMockEnabled { get; }                    // Read-only mock state
static void Send(string message)                       // Send message to React
static T DeserializePayload<T>(string json, string name)  // Parse JSON payload
```

## Payload Types

### StepResultAction

Processed step result emitted via `StepResultActionReady`:

```csharp
class StepResultAction
{
    bool IsWin;
    bool BonusStepTriggered;
    string AutoCashoutAmount;  // null if no auto-cashout
}
```

### WebGameConfigPayload

```csharp
class WebGameConfigPayload
{
    float[] Coefficients;
    Dictionary<string, int> BonusCounts;
    JToken BonusModes;
    string Currency;
    float? MinBetAmount;
    float? MaxBetAmount;
}
```

### WebGameStatePayload

```csharp
class WebGameStatePayload
{
    string Status;           // "in-game", "win", "lose"
    int[] BonusStepsCollected;
    bool? BonusStepTriggered;
    WebBonusGamePayload BonusGame;
    bool? IsWinMain;
}
```

### WebBonusGamePayload

```csharp
class WebBonusGamePayload
{
    float BonusTotalCoefficient;
    string BonusTotalWin;
    int[] BonusPositions;
}
```

## Sounds Enum

```csharp
public enum Sounds : uint
{
    Cashout = 1,
    Flowers = 2,
    Jump = 4,
    Sign = 5,
    JumpFail = 6,
    FishJump = 7,
    FishDrop = 8,
    Win = 9,
    Bg = 11,
    BonusWin = 12,
    BonusMusic = 13,
}
```

## React Integration

In WebGL builds, bridges communicate via `SendToReact(string)` (DllImport) and receive calls via Unity's `SendMessage`.

Messages sent to React:

| Message | Source |
|---|---|
| `PlaySound_{id}` | `AudioWebBridge.PlaySound` |
| `PlayMusic_{id}` | `AudioWebBridge.PlayMusic` |
| `UiVisibility_{json}` | `LayoutWebBridge.SyncUiVisibility` |
| `RequestGameConfig` | `GameWebBridge.RequestGameConfig` |
| `RequestGameState` | `GameWebBridge.RequestGameState` |
| `{"action":"play","payload":{...}}` | `GameWebBridge.PurchaseBonusMode` |

## License

Internal use.
