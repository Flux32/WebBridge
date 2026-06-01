using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    public class GameWebBridge : MonoBehaviour
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
        private const int InitialWebSyncAttempts = 10;
        private const float InitialWebSyncRetryIntervalSeconds = 0.5f;

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
        private bool _hasExternalGameConfigReceived;
        private Coroutine _initialWebSyncCoroutine;
        private float[] _lastRaisedCoefficients;

        public static GameWebBridge Instance { get; private set; }

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
        public event Action<WebGameStatePayload> GameRestored;
        // Unified bonus entry point. Fires from `StartBonus(payload)` — used by
        // both fresh purchase (completedIterations=0, accumulated*=0) and F5
        // restore (values populated from React-owned localStorage). SpinsBonus
        // subscribes to this and runs a single setup path (no separate restore
        // vs purchase branches).
        public event Action<WebBonusStartPayload> BonusStartRequested;
        public event Action<string> MockDifficultyChanged;
        public event Action<float> BalanceReceived;
        public event Action<float> ShopBetSizeChanged;
        // Fires with the white-label flag React reports (from its runtime manifest) in response
        // to RequestWhiteLabel. true = white-label (no branding), false = branded. The game can
        // swap branded art (e.g. the base block logo) accordingly. Cached in CurrentIsWhiteLabel
        // so a subscriber that wires up after the reply can still read the last value.
        public event Action<bool> WhiteLabelReceived;

        public Func<bool> CanProcessMockSpin { get; set; }

        private void SetMockDifficulty(string difficulty)
        {
            if (!IsMockEnabled || string.IsNullOrWhiteSpace(difficulty))
                return;

            _currentMockDifficulty = difficulty;
            Debug.Log($"[GameWebBridge] Mock difficulty changed to: {_currentMockDifficulty}");
            ApplyGameConfig(BuildMockGameConfig(), true);
            MockDifficultyChanged?.Invoke(_currentMockDifficulty);
        }

        public bool IsRestoring { get; private set; }
        public WebGameConfigPayload LastGameConfig { get; private set; }
        public WebGameStatePayload LastGameState { get; private set; }
        public WebGameStatePayload LastStepResult { get; private set; }
        public float? LastBalance { get; private set; }
        public float? LastShopBetSize { get; private set; }
        public bool? CurrentIsWhiteLabel { get; private set; }
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

        private bool IsMockEnabled => WebBridgeUtils.IsMockEnabled;
        private bool IsCheatsEnabled => WebBridgeUtils.IsCheatsEnabled;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogError($"Instance {nameof(GameWebBridge)} already exists.");
                Destroy(gameObject);
                return;
            }

            Instance = this;
        }

        private void Start()
        {
            _hasExternalGameConfigReceived = IsMockEnabled;

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

        private void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        private void BeginInitialWebSyncAfterSceneLoad()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            if (_initialWebSyncCoroutine != null)
                StopCoroutine(_initialWebSyncCoroutine);

            _initialWebSyncCoroutine = StartCoroutine(InitialWebSyncAfterSceneLoadRoutine());
#endif
        }

        private IEnumerator InitialWebSyncAfterSceneLoadRoutine()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            yield return null;
            yield return new WaitForEndOfFrame();

            int attempts = 0;
            while (!IsMockEnabled && !_hasExternalGameConfigReceived && attempts < InitialWebSyncAttempts)
            {
                attempts++;
                RequestGameConfig();
                RequestGameState();

                if (_hasExternalGameConfigReceived)
                    break;

                yield return new WaitForSecondsRealtime(InitialWebSyncRetryIntervalSeconds);
            }

            _initialWebSyncCoroutine = null;
            yield break;
#else
            _initialWebSyncCoroutine = null;
            yield break;
#endif
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

            _hasExternalGameConfigReceived = true;

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
            Debug.Log($"[BridgeDebug][React->Unity] ApplyGameConfig raw: {payload}");
            WebGameConfigPayload config =
                WebBridgeUtils.DeserializePayload<WebGameConfigPayload>(payload, nameof(ApplyGameConfig));
            if (config == null)
                return;

            _hasExternalGameConfigReceived = true;
            ApplyGameConfig(config, true);
        }

        public void ApplyGameState(string payload)
        {
            Debug.Log($"[BridgeDebug][React->Unity] ApplyGameState raw: {payload}");
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

            Debug.Log($"[BridgeDebug][React->Unity] CreateStep raw: {payload}");
            WebGameStatePayload state =
                WebBridgeUtils.DeserializePayload<WebGameStatePayload>(payload, nameof(CreateStep));
            if (state == null)
                return;

            if (ShouldRestore(state))
            {
                ApplyRestore(LastGameConfig, state);
                return;
            }

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

            Debug.Log($"[BridgeDebug][React->Unity] ApplyStepResult raw: {payload}");
            WebGameStatePayload stepResult =
                WebBridgeUtils.DeserializePayload<WebGameStatePayload>(payload, nameof(ApplyStepResult));
            if (stepResult == null)
                return;

            ApplyStepResult(stepResult);
        }

        public void RestoreGame(string payload)
        {
            if (IsMockEnabled)
            {
                RestoreMockGame();
                return;
            }

            Debug.Log($"[BridgeDebug][React->Unity] RestoreGame raw: {payload}");
            WebGameRestorePayload restorePayload =
                WebBridgeUtils.DeserializePayload<WebGameRestorePayload>(payload, nameof(RestoreGame));
            if (restorePayload == null)
                return;

            ApplyRestore(restorePayload.Config, restorePayload.State);
        }

        public void RequestGameState()
        {
            if (IsMockEnabled)
            {
                InitializeMockIfNeeded();
                ApplyGameState(CreateMockGameStatePayload());
                return;
            }

            WebBridgeUtils.Send("RequestGameState");
        }

        public void RequestGameConfig()
        {
            if (IsMockEnabled)
            {
                InitializeMockIfNeeded();
                ApplyGameConfig(BuildMockGameConfig(), true);
                return;
            }

            WebBridgeUtils.Send("RequestGameConfig");
        }
        
        public void RequestActiveGameState()
        {
            if (IsMockEnabled)
            {
                InitializeMockIfNeeded();
                return;
            }

            WebBridgeUtils.Send("RequestActiveGameState");
        }

        // Asks React for the white-label flag (read from its runtime manifest). React replies
        // by calling ApplyWhiteLabel. In the editor (no React) the serialized mock value is
        // delivered immediately so editor play still drives the swap.
        public void RequestWhiteLabel()
        {
            if (IsMockEnabled)
            {
                ApplyWhiteLabel(_mockIsWhiteLabel ? 1 : 0);
                return;
            }

            WebBridgeUtils.Send("RequestWhiteLabel");
        }

        // React entry point (SendMessage): 1 = white-label, 0 = branded.
        public void ApplyWhiteLabel(int value)
        {
            bool isWhiteLabel = value != 0;
            CurrentIsWhiteLabel = isWhiteLabel;
            Debug.Log($"[GameWebBridge] ApplyWhiteLabel: {isWhiteLabel}");
            WhiteLabelReceived?.Invoke(isWhiteLabel);
        }

        // Единая точка входа в бонус с React-стороны. Используется и при свежей
        // покупке (после showYouWinFreeGames+открытия TransitionScreen), и при
        // F5-восстановлении (после того же UX). payload содержит всё нужное
        // SpinsBonus для запуска: positions, completedIterations, accumulated*,
        // bet, currency, difficulty, bonusCoefficients, bonusTotalCoefficient,
        // bonusTotalWin, modeId.
        public void StartBonus(string payload)
        {
            Debug.Log($"[BridgeDebug][React->Unity] StartBonus raw: {payload}");
            WebBonusStartPayload parsed =
                WebBridgeUtils.DeserializePayload<WebBonusStartPayload>(payload, nameof(StartBonus));
            if (parsed == null)
            {
                Debug.LogWarning("[GameWebBridge] StartBonus payload parse failed.");
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
                string json = JsonConvert.SerializeObject(progress);
                WebBridgeUtils.Send($"{BonusProgressSaveMessagePrefix}{json}");
                Debug.Log($"[GameWebBridge] Bonus progress sent to React: iteration {progress.CompletedIterations}/{progress.TotalIterations}");
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[GameWebBridge] Failed to send bonus progress: {e.Message}");
            }
        }

        public void ClearBonusAutoPlayProgress()
        {
            WebBridgeUtils.Send(BonusProgressClearMessage);
            Debug.Log("[GameWebBridge] Bonus progress clear sent to React");
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

        public void UpdateShopBetSize(string payload)
        {
            if (string.IsNullOrWhiteSpace(payload))
                return;

            if (!float.TryParse(payload.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out float value))
            {
                Debug.LogWarning($"[GameWebBridge] UpdateShopBetSize: failed to parse '{payload}'");
                return;
            }

            if (float.IsNaN(value) || float.IsInfinity(value) || value < 0f)
                return;

            LastShopBetSize = value;
            ShopBetSizeChanged?.Invoke(value);
        }

        public IReadOnlyList<WebBonusShopModePayload> ResolveBonusModesForShop()
        {
            List<WebBonusShopModePayload> result = new List<WebBonusShopModePayload>();
            HashSet<string> usedModes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            string defaultCurrency = ResolveBonusCurrency(LastGameConfig);

            JToken bonusModesToken = LastGameConfig?.BonusModes;
            if (bonusModesToken != null)
                CollectBonusModesFromToken(bonusModesToken, result, usedModes, defaultCurrency);

            if (result.Count == 0 && LastGameConfig?.BonusCounts != null)
            {
                foreach (KeyValuePair<string, int> mode in LastGameConfig.BonusCounts)
                {
                    if (string.IsNullOrWhiteSpace(mode.Key) || !usedModes.Add(mode.Key))
                        continue;

                    result.Add(new WebBonusShopModePayload
                    {
                        ModeName = mode.Key,
                        Price = "0",
                        Currency = defaultCurrency,
                        BonusAmount = Mathf.Max(0, mode.Value)
                    });
                }
            }

            return result;
        }

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

            Debug.Log($"[BridgeDebug][Unity] Parsed game config: {WebBridgeUtils.BuildConfigDebugInfo(config)}");
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

        private void ApplyGameState(WebGameStatePayload state)
        {
            Debug.Log($"[BridgeDebug][Unity] Parsed game state: {WebBridgeUtils.BuildStateDebugInfo(state)}");

            if (ShouldRestore(state))
            {
                ApplyRestore(LastGameConfig, state);
                return;
            }

            LastGameState = state;
            GameStateReceived?.Invoke(state);
        }

        private bool ShouldRestore(WebGameStatePayload state)
        {
            if (IsRestoring || state == null || LastStepResult != null)
                return false;

            if (!state.Step.HasValue || state.Step.Value <= 0)
                return false;

            if (string.IsNullOrWhiteSpace(state.Status))
                return false;

            string status = state.Status.Trim().ToLowerInvariant();
            return status == "in-game";
        }

        private void ApplyRestore(WebGameConfigPayload config, WebGameStatePayload state)
        {
            IsRestoring = true;
            _hasExternalGameConfigReceived = true;

            if (config != null)
            {
                _lastRaisedCoefficients = null;
                ApplyGameConfig(config, true);
            }

            if (state != null)
            {
                LastStepResult = state;
                ApplyGameState(state);
            }

            Debug.Log($"[BridgeDebug][Unity] Game restored. Config={config != null}, State={WebBridgeUtils.BuildStateDebugInfo(state)}");
            GameRestored?.Invoke(state);

            // Bonus auto-play start is NOT triggered from here anymore. React
            // owns the F5-bonus UX (regular game first → YouWinFreeGames →
            // TransitionScreen) and explicitly calls `StartBonus(payload)`
            // when it's time to enter the bonus. The state.BonusGame fields
            // are still useful for re-hydrating `LastStepResult` above.

            IsRestoring = false;
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

            Debug.Log(
                $"[BridgeDebug][Unity] Parsed step result before resolve: {WebBridgeUtils.BuildStateDebugInfo(stepResult)}; " +
                $"previousCoinsCount={previousBonusStepsCount}; currentCoinsCount={currentBonusStepsCount}; " +
                $"resolvedByDelta={resolvedByDelta}; hasExplicitBonusFlag={hasExplicitBonusTrigger}; " +
                $"initialBonusStepTriggered={bonusStepTriggered}");

            LastStepResult = stepResult;
            LastGameState = stepResult;
            StepResultReceived?.Invoke(stepResult);
            GameStateReceived?.Invoke(stepResult);

            if (!isWinMain.HasValue)
            {
                Debug.LogWarning(
                    $"[GameWebBridge] Step result does not contain a resolvable win state. status='{stepResult.Status ?? "null"}'.");
                return;
            }

            if (!isWinMain.Value && stepResult.BonusGame == null && !hasExplicitBonusTrigger)
                bonusStepTriggered = false;

            Debug.Log(
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
                Debug.Log($"[GameWebBridge] Bonus purchase rejected for mode '{modeId}'. Error: {error}");
                BonusModePurchaseFailed?.Invoke(modeId);
                return;
            }

            WebBonusGamePayload bonusGame = BuildBonusGamePayloadForPurchase(purchaseResult.BonusGame);
            if (bonusGame == null)
            {
                Debug.LogWarning($"[GameWebBridge] Bonus purchase payload is invalid for mode '{modeId}'.");
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

        private static void CollectBonusModesFromToken(
            JToken token,
            ICollection<WebBonusShopModePayload> result,
            ISet<string> usedModes,
            string defaultCurrency)
        {
            if (token == null || token.Type == JTokenType.Null)
                return;

            if (token.Type == JTokenType.Object)
            {
                JObject modesObject = (JObject)token;
                foreach (JProperty modeProperty in modesObject.Properties())
                {
                    if (IsCurrencyPropertyName(modeProperty.Name))
                        continue;

                    AddBonusMode(result, usedModes, modeProperty.Name, modeProperty.Value, defaultCurrency);
                }

                return;
            }

            if (token.Type != JTokenType.Array)
                return;

            JArray modesArray = (JArray)token;
            for (int i = 0; i < modesArray.Count; i++)
            {
                if (modesArray[i] is not JObject modeObject)
                    continue;

                string modeName = WebBridgeUtils.ReadString(modeObject, "modeId", "modeName", "mode", "name", "key");
                AddBonusMode(result, usedModes, modeName, modeObject, defaultCurrency);
            }
        }

        private static void AddBonusMode(
            ICollection<WebBonusShopModePayload> result,
            ISet<string> usedModes,
            string modeName,
            JToken modeToken,
            string defaultCurrency)
        {
            if (string.IsNullOrWhiteSpace(modeName) || !usedModes.Add(modeName))
                return;

            result.Add(new WebBonusShopModePayload
            {
                ModeName = modeName,
                Price = ResolveModePrice(modeToken),
                Currency = ResolveModeCurrency(modeToken, defaultCurrency),
                BonusAmount = ResolveModeBonusAmount(modeToken)
            });
        }

        private static string ResolveModeCurrency(JToken modeToken, string defaultCurrency)
        {
            if (modeToken is JObject modeObject)
            {
                string modeCurrency = WebBridgeUtils.ReadString(modeObject, "currency", "currencyCode", "currencySymbol", "symbol");
                if (!string.IsNullOrWhiteSpace(modeCurrency))
                    return modeCurrency;
            }

            return string.IsNullOrWhiteSpace(defaultCurrency) ? DefaultBetCurrency : defaultCurrency;
        }

        private static string ResolveBonusCurrency(WebGameConfigPayload config)
        {
            if (!string.IsNullOrWhiteSpace(config?.Currency))
                return config.Currency;

            if (config?.BonusModes is JObject modesObject)
            {
                string modesCurrency = WebBridgeUtils.ReadString(modesObject, "currency", "currencyCode", "currencySymbol", "symbol");
                if (!string.IsNullOrWhiteSpace(modesCurrency))
                    return modesCurrency;
            }

            return DefaultBetCurrency;
        }

        private static bool IsCurrencyPropertyName(string propertyName)
        {
            if (string.IsNullOrWhiteSpace(propertyName))
                return false;

            return propertyName.Equals("currency", StringComparison.OrdinalIgnoreCase)
                   || propertyName.Equals("currencyCode", StringComparison.OrdinalIgnoreCase)
                   || propertyName.Equals("currencySymbol", StringComparison.OrdinalIgnoreCase)
                   || propertyName.Equals("symbol", StringComparison.OrdinalIgnoreCase);
        }

        private static string ResolveModePrice(JToken modeToken)
        {
            if (modeToken is JObject modeObject)
            {
                string stringPrice = WebBridgeUtils.ReadString(modeObject, "price", "amount", "cost", "value");
                if (!string.IsNullOrWhiteSpace(stringPrice))
                    return stringPrice;
            }

            if (modeToken == null || modeToken.Type == JTokenType.Null || modeToken.Type == JTokenType.Object)
                return "0";

            return modeToken.ToString(Formatting.None);
        }

        private static int ResolveModeBonusAmount(JToken modeToken)
        {
            if (modeToken is not JObject modeObject)
                return 0;

            int? value = WebBridgeUtils.ReadInt(modeObject, "count", "moves", "bonusCount", "steps", "lineCount");
            return value.HasValue ? Mathf.Max(0, value.Value) : 0;
        }

        #region Mock

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

        private void RestoreMockGame()
        {
            InitializeMockIfNeeded();

            int totalSteps = ResolveMockCoefficients()?.Length ?? 6;
            int restoreStep = Mathf.Max(1, totalSteps / 2);

            _mockMoveIndex = restoreStep;
            _mockBonusStepsCollected.Clear();

            for (int i = 1; i <= restoreStep && _mockBonusStepsCollected.Count < _mockBonusStepsThreshold; i++)
            {
                if (_mockRandom.NextDouble() <= _mockBonusStepTriggerChance)
                    _mockBonusStepsCollected.Add(i);
            }

            WebGameStatePayload restoredState = new WebGameStatePayload
            {
                Status = "in-game",
                Step = restoreStep,
                BonusStepsCollected = _mockBonusStepsCollected.ToArray(),
                BonusStepTriggered = false,
                BonusGame = null,
                IsWinMain = null
            };

            ApplyRestore(BuildMockGameConfig(), restoredState);
        }

        private void CycleMockDifficulty()
        {
            _currentMockDifficulty = MockConfig.Instance.GetNextDifficulty(_currentMockDifficulty);
            Debug.Log($"[GameWebBridge] Mock difficulty changed to: {_currentMockDifficulty}");
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

        private JToken BuildMockBonusModes()
        {
            JObject result = new JObject();
            if (_mockBonusCounts != null)
            {
                for (int i = 0; i < _mockBonusCounts.Length; i++)
                {
                    MockBonusCount bonusCount = _mockBonusCounts[i];
                    if (string.IsNullOrWhiteSpace(bonusCount.Difficult))
                        continue;

                    result[bonusCount.Difficult] = new JObject
                    {
                        ["price"] = string.IsNullOrWhiteSpace(bonusCount.Price) ? "0" : bonusCount.Price,
                        ["currency"] = string.IsNullOrWhiteSpace(bonusCount.Currency) ? DefaultBetCurrency : bonusCount.Currency,
                        ["count"] = Mathf.Max(0, bonusCount.Count)
                    };
                }
            }

            if (!result.HasValues)
            {
                result["easy"] = new JObject
                {
                    ["price"] = "100",
                    ["currency"] = DefaultBetCurrency,
                    ["count"] = 10
                };
                result["medium"] = new JObject
                {
                    ["price"] = "200",
                    ["currency"] = DefaultBetCurrency,
                    ["count"] = 8
                };
                result["hard"] = new JObject
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

        #endregion
    }
}
