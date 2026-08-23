using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Road
{
    [Preserve]
    public class RoadWebBridge : WebBridgeBase<RoadWebBridge>
    {
        [Serializable]
        private struct MockBonusCount
        {
            public string Difficult;
            public int Count;
            public string Price;
            public string Currency;
        }

        private const string DefaultBetCurrency = "USD";

        private static readonly char[] CoeffSeparator = { ',' };

        [Header("Mock")]
        [SerializeField] private MockBonusCount[] _mockBonusCounts =
        {
            new MockBonusCount { Difficult = "easy", Count = 10, Price = "100", Currency = "USD" },
            new MockBonusCount { Difficult = "medium", Count = 8, Price = "200", Currency = "USD" },
            new MockBonusCount { Difficult = "hard", Count = 6, Price = "300", Currency = "USD" },
        };
        [SerializeField, Range(0f, 1f)] private float _mockLoseChance = 0.3f;
        [SerializeField, Range(0f, 1f)] private float _mockBonusStepTriggerChance = 0.45f;
        [SerializeField, Min(1)] private int _mockBonusStepsThreshold = 3;
        [SerializeField, Min(0f)] private float _mockBetAmount = 10f;
        [SerializeField, Min(0)] private int _mockWinDecimals = 2;
        [SerializeField] private int[] _mockBonusPositions = { 2, 3, 4 };
        [Tooltip("Mock value returned for RequestWhiteLabel in the editor (no React).")]
        [SerializeField] private bool _mockIsWhiteLabel = false;

        private readonly List<int> _mockBonusStepsCollected = new List<int>();
        private System.Random _mockRandom;
        private int _mockMoveIndex;
        private string _currentMockDifficulty;
        private bool _mockInitialized;
        private float[] _lastRaisedCoefficients;

        public event Action<WebGameConfigPayload> GameConfigReceived;
        public event Action<WebGameStatePayload> GameStateReceived;
        public event Action<WebGameStatePayload> StepResultReceived;
        public event Action<StepResultAction> StepResultActionReady;
        public event Action<float[]> CoefficientsReceived;
        public event Action<int> SpinRequested;
        // Fires when React asks to restart the round (e.g. CashoutModal closed, or a loss/win
        // resolved). Carries the reason and an optional win amount string so the game can
        // decide what to show (e.g. a win table on cashout/win) before re-arming.
        public event Action<RestartReason, string> RestartRequested;
        public event Action<string, int> BonusModePurchased;
        public event Action<string> BonusModePurchaseFailed;
        // Unified bonus entry point. Fires from `StartBonus(payload)` — used by
        // both fresh purchase (completedIterations=0, accumulated*=0) and F5
        // restore (values populated from React-owned localStorage). SpinsBonus
        // subscribes to this and runs a single setup path (no separate restore
        // vs purchase branches).
        public event Action<WebBonusStartPayload> BonusStartRequested;
        public event Action<string> MockDifficultyChanged;
        public event Action<float> BalanceReceived;

        public Func<bool> CanProcessMockSpin { get; set; }

        private void SetMockDifficulty(string difficulty)
        {
            if (!IsMockEnabled || string.IsNullOrWhiteSpace(difficulty))
                return;

            _currentMockDifficulty = difficulty;
            WebBridgeLogger.Log($"[RoadWebBridge] Mock difficulty changed to: {_currentMockDifficulty}");
            ApplyGameConfig(BuildMockGameConfig(), true);
            MockDifficultyChanged?.Invoke(_currentMockDifficulty);
        }

        public WebGameConfigPayload LastGameConfig { get; private set; }
        public WebGameStatePayload LastGameState { get; private set; }
        public WebGameStatePayload LastStepResult { get; private set; }
        public float? LastBalance { get; private set; }
        public string CurrentMockDifficulty => _currentMockDifficulty;
        
        public bool SuppressCoefficientUpdates { get; set; }

        private float MockLoseChance
        {
            get => _mockLoseChance;
            set => _mockLoseChance = Mathf.Clamp01(value);
        }

        private float MockBonusStepTriggerChance
        {
            get => _mockBonusStepTriggerChance;
            set => _mockBonusStepTriggerChance = Mathf.Clamp01(value);
        }

        private void Start()
        {
            HasReceivedInitialConfig = IsMockEnabled;

            if (IsMockEnabled)
            {
                InitializeMockIfNeeded();

                if (GetComponent<MockDebugIMGUI>() == null)
                    gameObject.AddComponent<MockDebugIMGUI>();
            }
            else
            {
                BeginInitialWebSyncAfterSceneLoad();
            }

            if (IsCheatsEnabled && GetComponent<CheatDebugIMGUI>() == null)
                gameObject.AddComponent<CheatDebugIMGUI>();
        }

        private void Update()
        {
            if (!IsMockEnabled)
                return;

            if (Input.GetKeyDown(KeyCode.D))
                CycleMockDifficulty();
        }

#if UNITY_EDITOR
        // Editor-only debug entry: triggers a spin without going through the
        // React→backend→`ApplyStepResult` pipeline. In mock-режиме делает
        // фейковый степ локально, в обычном — fires `SpinRequested` для
        // подписчиков (PepeRoad's `WebBridgeGameConnector` subscribed). Все
        // call sites (MegaGrabBridge / PepeRoad RoadController на KeyCode.Space)
        // тоже `#if UNITY_EDITOR`, поэтому в билд этот путь не попадает.
        public void DoSpin(int win)
        {
            if (IsMockEnabled)
            {
                InitializeMockIfNeeded();

                if (CanProcessMockSpin != null && !CanProcessMockSpin())
                    return;

                ApplyStepResult(CreateMockStepResult());
                return;
            }

            SpinRequested?.Invoke(win);
        }
#endif
        
        // React entry point. Payload is "<reason>|<amount>" (e.g. "cashout|$5.00", "lose|").
        // Empty/null payload -> RestartReason.None.
        public void RestartRound(string payload)
        {
            ParseRestartPayload(payload, out RestartReason reason, out string amount);
            RestartRequested?.Invoke(reason, amount);
        }

        private static void ParseRestartPayload(string payload, out RestartReason reason, out string amount)
        {
            reason = RestartReason.None;
            amount = null;

            if (string.IsNullOrWhiteSpace(payload))
                return;

            string reasonToken = payload;
            int sep = payload.IndexOf('|');
            if (sep >= 0)
            {
                reasonToken = payload.Substring(0, sep);
                amount = payload.Substring(sep + 1);
            }

            switch (reasonToken.Trim().ToLowerInvariant())
            {
                case "win": reason = RestartReason.Win; break;
                case "cashout": reason = RestartReason.Cashout; break;
                case "lose": reason = RestartReason.Lose; break;
                default: reason = RestartReason.None; break;
            }
        }

        public void UpdateCoeffs(string payload)
        {
            if (IsMockEnabled)
                return;

            if (string.IsNullOrWhiteSpace(payload))
                return;

            HasReceivedInitialConfig = true;

            string[] tokens = payload.Split(CoeffSeparator, StringSplitOptions.RemoveEmptyEntries);
            if (tokens.Length == 0)
                return;

            List<float> coefficients = new List<float>(tokens.Length);
            foreach (string token in tokens)
            {
                if (float.TryParse(token, NumberStyles.Float, CultureInfo.InvariantCulture, out float value))
                    coefficients.Add(value);
            }

            float[] coeffArray = coefficients.ToArray();
            if (SuppressCoefficientUpdates)
                return;

            RaiseCoefficientsIfChanged(coeffArray);
        }

        public void ApplyGameConfig(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyGameConfig raw: {payload}");
            WebGameConfigPayload config =
                WebBridgeUtils.DeserializePayload<WebGameConfigPayload>(payload, nameof(ApplyGameConfig));
            if (config == null)
                return;

            HasReceivedInitialConfig = true;
            ApplyGameConfig(config, true);
        }

        public void ApplyGameState(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyGameState raw: {payload}");
            WebGameStatePayload state =
                WebBridgeUtils.DeserializePayload<WebGameStatePayload>(payload, nameof(ApplyGameState));
            if (state == null)
                return;

            ApplyGameState(state);
        }

        public void CreateStep(string payload)
        {
            if (IsMockEnabled)
            {
                InitializeMockIfNeeded();

                if (CanProcessMockSpin != null && !CanProcessMockSpin())
                    return;

                ApplyStepResult(CreateMockStepResult());
                return;
            }

            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] CreateStep raw: {payload}");
            WebGameStatePayload state =
                WebBridgeUtils.DeserializePayload<WebGameStatePayload>(payload, nameof(CreateStep));
            if (state == null)
                return;

            ApplyStepResult(state);
        }

        public void ApplyStepResult(string payload)
        {
            if (IsMockEnabled)
            {
                InitializeMockIfNeeded();

                if (CanProcessMockSpin != null && !CanProcessMockSpin())
                    return;

                ApplyStepResult(CreateMockStepResult());
                return;
            }

            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyStepResult raw: {payload}");
            WebGameStatePayload stepResult =
                WebBridgeUtils.DeserializePayload<WebGameStatePayload>(payload, nameof(ApplyStepResult));
            if (stepResult == null)
                return;

            ApplyStepResult(stepResult);
        }

        public override void RequestGameState()
        {
            if (IsMockEnabled)
            {
                InitializeMockIfNeeded();
                ApplyGameState(CreateMockGameStatePayload());
                return;
            }

            WebBridgeUtils.Send("RequestGameState");
        }

        public override void RequestGameConfig()
        {
            if (IsMockEnabled)
            {
                InitializeMockIfNeeded();
                ApplyGameConfig(BuildMockGameConfig(), true);
                return;
            }

            WebBridgeUtils.Send("RequestGameConfig");
        }
        
        // In the editor (no React) the serialized mock value is delivered immediately so editor
        // play still drives the white-label swap. Otherwise defers to the base handshake.
        public override void RequestWhiteLabel()
        {
            if (IsMockEnabled)
            {
                ApplyWhiteLabel(_mockIsWhiteLabel ? 1 : 0);
                return;
            }

            base.RequestWhiteLabel();
        }

        // Единая точка входа в бонус с React-стороны. Используется и при свежей
        // покупке (после showYouWinFreeGames+открытия TransitionScreen), и при
        // F5-восстановлении (после того же UX). payload содержит всё нужное
        // SpinsBonus для запуска: positions, completedIterations, accumulated*,
        // bet, currency, difficulty, bonusCoefficients, bonusTotalCoefficient,
        // bonusTotalWin, modeId.
        public void StartBonus(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] StartBonus raw: {payload}");
            WebBonusStartPayload parsed =
                WebBridgeUtils.DeserializePayload<WebBonusStartPayload>(payload, nameof(StartBonus));
            if (parsed == null)
            {
                WebBridgeLogger.LogWarning("[RoadWebBridge] StartBonus payload parse failed.");
                return;
            }
            BonusStartRequested?.Invoke(parsed);
        }

        public void ApplyBonusPurchaseResult(string payload)
        {
            WebBonusPurchasePayload purchaseResult =
                WebBridgeUtils.DeserializePayload<WebBonusPurchasePayload>(payload, nameof(ApplyBonusPurchaseResult));
            if (purchaseResult == null)
                return;

            HandleBonusPurchaseResult(purchaseResult);
        }

        public int[] ResolveBonusPositionsForAutoPlay()
        {
            int[] bonusPositions = LastStepResult?.BonusGame?.BonusPositions;
            if (bonusPositions != null && bonusPositions.Length > 0)
                return bonusPositions.ToArray();

            if (IsMockEnabled && _mockBonusPositions != null && _mockBonusPositions.Length > 0)
                return _mockBonusPositions.ToArray();

            return Array.Empty<int>();
        }
        
        private const string BonusProgressSaveMessagePrefix = "BonusProgressSave_";
        private const string BonusProgressClearMessage = "BonusProgressClear";

        public void SaveBonusAutoPlayProgress(WebBonusAutoPlayProgress progress)
        {
            if (progress == null)
                return;

            try
            {
                string json = Json.Serialize(progress);
                WebBridgeUtils.Send($"{BonusProgressSaveMessagePrefix}{json}");
                WebBridgeLogger.Log($"[RoadWebBridge] Bonus progress sent to React: iteration {progress.CompletedIterations}/{progress.TotalIterations}");
            }
            catch (Exception e)
            {
                WebBridgeLogger.LogWarning($"[RoadWebBridge] Failed to send bonus progress: {e.Message}");
            }
        }

        public void ClearBonusAutoPlayProgress()
        {
            WebBridgeUtils.Send(BonusProgressClearMessage);
            WebBridgeLogger.Log("[RoadWebBridge] Bonus progress clear sent to React");
        }

        public void NotifyBonusActive()
        {
            WebBridgeUtils.Send("BonusActive");
        }

        public void NotifyBonusEnded()
        {
            // React opens the TransitionScreen on this signal (bonus end
            // gates close → midpoint UI restore → game state revert →
            // gates open).
            WebBridgeUtils.Send("BonusEnded");
        }

        public void NotifyBonusCleared()
        {
            WebBridgeUtils.Send("BonusCleared");
        }

        public IReadOnlyList<WebBonusShopModePayload> ResolveBonusModesForShop() =>
            RoadBonusModeReader.ReadShopModes(LastGameConfig);

        public void ResetMockRound()
        {
            _mockMoveIndex = 0;
            _mockBonusStepsCollected.Clear();
            ApplyGameState(CreateMockGameStatePayload());
        }

        private void ApplyGameConfig(WebGameConfigPayload config, bool updateCoefficients)
        {
            if (config == null)
                return;

            WebBridgeLogger.Log($"[BridgeDebug][Unity] Parsed game config: {RoadBridgeDebug.BuildConfigDebugInfo(config)}");
            LastGameConfig = config;
            GameConfigReceived?.Invoke(config);

            if (config.Balance.HasValue)
            {
                LastBalance = config.Balance.Value;
                BalanceReceived?.Invoke(config.Balance.Value);
            }

            if (updateCoefficients && config.Coefficients != null && !SuppressCoefficientUpdates)
                RaiseCoefficientsIfChanged(config.Coefficients);
        }

        private void RaiseCoefficientsIfChanged(float[] coefficients)
        {
            if (coefficients == null)
                return;

            if (CoefficientsEqual(_lastRaisedCoefficients, coefficients))
                return;

            _lastRaisedCoefficients = (float[])coefficients.Clone();
            CoefficientsReceived?.Invoke(coefficients);
        }

        private static bool CoefficientsEqual(float[] a, float[] b)
        {
            if (a == null || b == null)
                return false;
            if (a.Length != b.Length)
                return false;
            for (int i = 0; i < a.Length; i++)
            {
                if (!Mathf.Approximately(a[i], b[i]))
                    return false;
            }
            return true;
        }

        // Состояние сессии: «приведи сцену к этому», в отличие от ApplyStepResult
        // («шаг случился, проиграй его»). Тот же контракт, что и у plinko-моста.
        private void ApplyGameState(WebGameStatePayload state)
        {
            WebBridgeLogger.Log($"[BridgeDebug][Unity] Parsed game state: {RoadBridgeDebug.BuildStateDebugInfo(state)}");

            LastGameState = state;
            // Дельты бонусных шагов следующий ход считает от этого состояния.
            LastStepResult = state;
            GameStateReceived?.Invoke(state);
        }

        private void ApplyStepResult(WebGameStatePayload stepResult)
        {
            int previousBonusStepsCount = LastStepResult?.BonusStepsCollected?.Length
                                          ?? LastGameState?.BonusStepsCollected?.Length
                                          ?? 0;
            int currentBonusStepsCount = stepResult.BonusStepsCollected?.Length ?? 0;
            bool resolvedByDelta = currentBonusStepsCount > previousBonusStepsCount;
            bool hasExplicitBonusTrigger = stepResult.BonusStepTriggered.HasValue;
            bool bonusStepTriggered = hasExplicitBonusTrigger
                ? stepResult.BonusStepTriggered.Value
                : resolvedByDelta;
            bool? isWinMain = ResolveStepResultWinState(stepResult);
            if (isWinMain.HasValue)
                stepResult.IsWinMain = isWinMain;

            WebBridgeLogger.Log(
                $"[BridgeDebug][Unity] Parsed step result before resolve: {RoadBridgeDebug.BuildStateDebugInfo(stepResult)}; " +
                $"previousCoinsCount={previousBonusStepsCount}; currentCoinsCount={currentBonusStepsCount}; " +
                $"resolvedByDelta={resolvedByDelta}; hasExplicitBonusFlag={hasExplicitBonusTrigger}; " +
                $"initialBonusStepTriggered={bonusStepTriggered}");

            LastStepResult = stepResult;
            LastGameState = stepResult;
            StepResultReceived?.Invoke(stepResult);
            GameStateReceived?.Invoke(stepResult);

            if (!isWinMain.HasValue)
            {
                WebBridgeLogger.LogWarning(
                    $"[RoadWebBridge] Step result does not contain a resolvable win state. status='{stepResult.Status ?? "null"}'.");
                return;
            }

            if (!isWinMain.Value && stepResult.BonusGame == null && !hasExplicitBonusTrigger)
                bonusStepTriggered = false;

            WebBridgeLogger.Log(
                $"[BridgeDebug][Unity] Step resolved for DoSpin: isWinMain={isWinMain.Value}; " +
                $"finalBonusStepTriggered={bonusStepTriggered}; hasBonusGame={stepResult.BonusGame != null}");

            StepResultActionReady?.Invoke(new StepResultAction
            {
                IsWin = isWinMain.Value,
                BonusStepTriggered = bonusStepTriggered
            });

            if (ShouldAutoCashoutOnMockFinish(stepResult))
            {
                // Mock auto-cashout flow: signal restart with the cashout reason + amount
                // (matches the real React path of cashout → RestartRound). Subscribers settle
                // the win from RestartRequested when reason == RestartReason.Cashout.
                string mockAmount = BuildMockAutoCashoutAmount();
                RestartRequested?.Invoke(RestartReason.Cashout, mockAmount);
            }
        }

        private static bool? ResolveStepResultWinState(WebGameStatePayload stepResult)
        {
            if (stepResult == null)
                return null;

            if (stepResult.IsWinMain.HasValue)
                return stepResult.IsWinMain;

            if (string.IsNullOrWhiteSpace(stepResult.Status))
                return null;

            switch (stepResult.Status.Trim().ToLowerInvariant())
            {
                case "in-game":
                case "win":
                    return true;
                case "lose":
                    return false;
                default:
                    return null;
            }
        }

        private void HandleBonusPurchaseResult(WebBonusPurchasePayload purchaseResult)
        {
            if (purchaseResult == null)
                return;

            string modeId = string.IsNullOrWhiteSpace(purchaseResult.ModeId) ? "easy" : purchaseResult.ModeId;
            if (!purchaseResult.IsPurchased)
            {
                string error = string.IsNullOrWhiteSpace(purchaseResult.Error) ? "unknown" : purchaseResult.Error;
                WebBridgeLogger.Log($"[RoadWebBridge] Bonus purchase rejected for mode '{modeId}'. Error: {error}");
                BonusModePurchaseFailed?.Invoke(modeId);
                return;
            }

            WebBonusGamePayload bonusGame = BuildBonusGamePayloadForPurchase(purchaseResult.BonusGame);
            if (bonusGame == null)
            {
                WebBridgeLogger.LogWarning($"[RoadWebBridge] Bonus purchase payload is invalid for mode '{modeId}'.");
                BonusModePurchaseFailed?.Invoke(modeId);
                return;
            }

            LastStepResult = new WebGameStatePayload
            {
                BonusStepsCollected = Array.Empty<int>(),
                BonusStepTriggered = false,
                BonusGame = bonusGame,
                IsWinMain = null
            };
            LastGameState = LastStepResult;

            // Bonus actual entry happens via the unified `StartBonus(payload)`
            // channel — React sends it after showing YouWinFreeGames and
            // opening the TransitionScreen. We only persist LastStepResult
            // here so the rest of the bridge sees the bonus baseline.
        }

        private static WebBonusGamePayload BuildBonusGamePayloadForPurchase(WebBonusGamePayload source)
        {
            if (source?.BonusPositions == null || source.BonusPositions.Length == 0)
                return null;

            if (source.BonusTotalCoefficient <= 0f)
                return null;

            if (string.IsNullOrWhiteSpace(source.BonusTotalWin))
                return null;

            return new WebBonusGamePayload
            {
                BonusPositions = source.BonusPositions.ToArray(),
                BonusTotalCoefficient = source.BonusTotalCoefficient,
                BonusTotalWin = source.BonusTotalWin,
                BonusCoefficients = source.BonusCoefficients
            };
        }

        private void InitializeMockIfNeeded()
        {
            if (_mockInitialized)
                return;

            _mockInitialized = true;
            _mockRandom = new System.Random();
            _currentMockDifficulty = MockConfig.Instance.DefaultDifficulty;

            WebGameConfigPayload mockConfig = BuildMockGameConfig();
            ApplyGameConfig(mockConfig, true);
            ApplyGameState(CreateMockGameStatePayload());
        }

        private void CycleMockDifficulty()
        {
            _currentMockDifficulty = MockConfig.Instance.GetNextDifficulty(_currentMockDifficulty);
            WebBridgeLogger.Log($"[RoadWebBridge] Mock difficulty changed to: {_currentMockDifficulty}");
            ApplyGameConfig(BuildMockGameConfig(), true);
            MockDifficultyChanged?.Invoke(_currentMockDifficulty);
        }

        private WebGameConfigPayload BuildMockGameConfig()
        {
            return new WebGameConfigPayload
            {
                Coefficients = ResolveMockCoefficients(),
                BonusCounts = BuildMockBonusCounts(),
                BonusModes = BuildMockBonusModes()
            };
        }

        private float[] ResolveMockCoefficients()
        {
            return MockConfig.Instance.GetCoefficients(_currentMockDifficulty);
        }

        private Dictionary<string, int> BuildMockBonusCounts()
        {
            Dictionary<string, int> result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            if (_mockBonusCounts != null)
            {
                for (int i = 0; i < _mockBonusCounts.Length; i++)
                {
                    MockBonusCount bonusCount = _mockBonusCounts[i];
                    if (string.IsNullOrWhiteSpace(bonusCount.Difficult))
                        continue;

                    result[bonusCount.Difficult] = Mathf.Max(0, bonusCount.Count);
                }
            }

            if (result.Count > 0)
                return result;

            return new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                { "easy", 10 },
                { "medium", 8 },
                { "hard", 6 },
            };
        }

        private JsonValue BuildMockBonusModes()
        {
            JsonValue result = JsonValue.NewObject();
            if (_mockBonusCounts != null)
            {
                for (int i = 0; i < _mockBonusCounts.Length; i++)
                {
                    MockBonusCount bonusCount = _mockBonusCounts[i];
                    if (string.IsNullOrWhiteSpace(bonusCount.Difficult))
                        continue;

                    result[bonusCount.Difficult] = new JsonValue
                    {
                        ["price"] = string.IsNullOrWhiteSpace(bonusCount.Price) ? "0" : bonusCount.Price,
                        ["currency"] = string.IsNullOrWhiteSpace(bonusCount.Currency) ? DefaultBetCurrency : bonusCount.Currency,
                        ["count"] = Mathf.Max(0, bonusCount.Count)
                    };
                }
            }

            if (!result.HasValues)
            {
                result["easy"] = new JsonValue
                {
                    ["price"] = "100",
                    ["currency"] = DefaultBetCurrency,
                    ["count"] = 10
                };
                result["medium"] = new JsonValue
                {
                    ["price"] = "200",
                    ["currency"] = DefaultBetCurrency,
                    ["count"] = 8
                };
                result["hard"] = new JsonValue
                {
                    ["price"] = "300",
                    ["currency"] = DefaultBetCurrency,
                    ["count"] = 6
                };
            }

            return result;
        }

        private WebGameStatePayload CreateMockStepResult()
        {
            _mockMoveIndex++;
            bool canTriggerBonusStep = _mockBonusStepsCollected.Count < _mockBonusStepsThreshold;
            bool bonusStepTriggered = canTriggerBonusStep && _mockRandom.NextDouble() <= _mockBonusStepTriggerChance;
            if (bonusStepTriggered && !_mockBonusStepsCollected.Contains(_mockMoveIndex))
                _mockBonusStepsCollected.Add(_mockMoveIndex);

            bool isWinMain = _mockRandom.NextDouble() > _mockLoseChance;
            WebBonusGamePayload bonusGame = null;
            if (!isWinMain && _mockBonusStepsCollected.Count >= _mockBonusStepsThreshold)
                bonusGame = CreateMockBonusGamePayload();

            return new WebGameStatePayload
            {
                BonusStepsCollected = _mockBonusStepsCollected.ToArray(),
                BonusStepTriggered = bonusStepTriggered,
                BonusGame = bonusGame,
                IsWinMain = isWinMain
            };
        }

        private bool ShouldAutoCashoutOnMockFinish(WebGameStatePayload stepResult)
        {
            if (!IsMockEnabled || stepResult?.IsWinMain != true)
                return false;

            int movesToReachFinish = ResolveMockMovesToReachFinish();
            if (movesToReachFinish <= 0)
                return false;

            return _mockMoveIndex >= movesToReachFinish;
        }

        private int ResolveMockMovesToReachFinish()
        {
            float[] coefficients = LastGameConfig?.Coefficients;
            if (coefficients == null || coefficients.Length == 0)
                coefficients = ResolveMockCoefficients();

            return coefficients?.Length ?? 0;
        }

        private string BuildMockAutoCashoutAmount()
        {
            float[] coefficients = LastGameConfig?.Coefficients;
            if (coefficients == null || coefficients.Length == 0)
                coefficients = ResolveMockCoefficients();

            float amount = _mockBetAmount;
            if (coefficients != null && coefficients.Length > 0)
            {
                int coefficientIndex = Mathf.Clamp(_mockMoveIndex - 1, 0, coefficients.Length - 1);
                amount = Mathf.Max(0f, coefficients[coefficientIndex]) * _mockBetAmount;
            }

            int decimals = Mathf.Max(0, _mockWinDecimals);
            return $"${amount.ToString($"F{decimals}", CultureInfo.InvariantCulture)}";
        }

        private WebGameStatePayload CreateMockGameStatePayload()
        {
            return new WebGameStatePayload
            {
                BonusStepsCollected = _mockBonusStepsCollected.ToArray(),
                BonusStepTriggered = false,
                BonusGame = null,
                IsWinMain = null
            };
        }

        private WebBonusGamePayload CreateMockBonusGamePayload(string modeId = null)
        {
            int modeCount = ResolveMockBonusCount(modeId);
            int[] bonusPositions = modeCount > 0
                ? GenerateMockBonusPositions(modeCount)
                : _mockBonusPositions != null && _mockBonusPositions.Length > 0
                    ? _mockBonusPositions.ToArray()
                    : new[] { 2, 3, 4 };

            float totalBonusCoefficient = CalculateBonusTotalCoefficient(bonusPositions);
            float totalBonusWin = totalBonusCoefficient * _mockBetAmount;
            string bonusTotalWin =
                totalBonusWin.ToString($"F{Mathf.Max(0, _mockWinDecimals)}", CultureInfo.InvariantCulture);

            return new WebBonusGamePayload
            {
                BonusTotalCoefficient = totalBonusCoefficient,
                BonusTotalWin = bonusTotalWin,
                BonusPositions = bonusPositions
            };
        }

        private int ResolveMockBonusCount(string modeId)
        {
            if (string.IsNullOrWhiteSpace(modeId) || _mockBonusCounts == null)
                return 0;

            for (int i = 0; i < _mockBonusCounts.Length; i++)
            {
                if (string.Equals(_mockBonusCounts[i].Difficult, modeId, StringComparison.OrdinalIgnoreCase))
                    return Mathf.Max(0, _mockBonusCounts[i].Count);
            }

            return 0;
        }

        private int[] GenerateMockBonusPositions(int count)
        {
            float[] coefficients = ResolveMockCoefficients();
            int maxPosition = coefficients != null && coefficients.Length > 0 ? coefficients.Length - 1 : 4;
            int[] positions = new int[count];
            for (int i = 0; i < count; i++)
                positions[i] = UnityEngine.Random.Range(0, maxPosition + 1);
            return positions;
        }

        private float CalculateBonusTotalCoefficient(IReadOnlyList<int> bonusPositions)
        {
            float[] coefficients = ResolveMockCoefficients();
            if (coefficients == null || coefficients.Length == 0 || bonusPositions == null || bonusPositions.Count == 0)
                return 0f;

            float total = 0f;
            for (int i = 0; i < bonusPositions.Count; i++)
            {
                int position = bonusPositions[i];
                if (position < 0 || position >= coefficients.Length)
                    continue;

                total += coefficients[position];
            }

            return total;
        }

    }
}
