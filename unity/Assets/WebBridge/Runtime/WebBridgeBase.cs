using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Scripting;

namespace WebBridge
{
    /// <summary>
    /// Game-agnostic foundation shared by every per-game WebBridge. Owns the pieces that are
    /// identical across games: the singleton, the initial React sync retry loop, and the
    /// white-label handshake. Gameplay-specific payloads and events live in the derived bridge.
    /// </summary>
    [Preserve]
    public abstract class WebBridgeBase<T> : MonoBehaviour where T : WebBridgeBase<T>
    {
        private const int InitialWebSyncAttempts = 10;
        private const float InitialWebSyncRetryIntervalSeconds = 0.5f;

        private Coroutine _initialWebSyncCoroutine;

        public static T Instance { get; private set; }

        // Fires with the white-label flag React reports (from its runtime manifest) in response
        // to RequestWhiteLabel. true = white-label (no branding), false = branded. Cached in
        // CurrentIsWhiteLabel so a subscriber that wires up after the reply can still read it.
        public event Action<bool> WhiteLabelReceived;

        // Fires whenever fast game switches: React pushes the player's choice from the bet-bar
        // toggle (SetFastGame), and the game itself may flip it through NotifyFastGameChanged.
        // Cached in IsFastGameEnabled so a subscriber that wires up after the push still reads it.
        public event Action<bool> FastGameChanged;

        public bool? CurrentIsWhiteLabel { get; private set; }

        // Fast game speeds the round presentation up (no showcase pauses). Off until React says
        // otherwise — its stored value arrives right after the engine loads.
        public bool IsFastGameEnabled { get; private set; }

        protected static bool IsMockEnabled => WebBridgeUtils.IsMockEnabled;
        protected static bool IsCheatsEnabled => WebBridgeUtils.IsCheatsEnabled;

        // Set by the derived bridge once React has delivered the initial config/state so the
        // sync loop can stop early.
        protected bool HasReceivedInitialConfig { get; set; }

        protected virtual void Awake()
        {
            if (Instance != null && Instance != this)
            {
                WebBridgeLogger.LogError($"Instance {typeof(T).Name} already exists.");
                Destroy(gameObject);
                return;
            }

            Instance = (T)this;
        }

        protected virtual void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        protected void BeginInitialWebSyncAfterSceneLoad()
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
            while (!IsMockEnabled && !HasReceivedInitialConfig && attempts < InitialWebSyncAttempts)
            {
                attempts++;
                RequestGameConfig();
                RequestGameState();

                if (HasReceivedInitialConfig)
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

        // Asks React for the white-label flag (read from its runtime manifest). React replies by
        // calling ApplyWhiteLabel. Derived bridges may override to short-circuit in mock mode.
        public virtual void RequestWhiteLabel()
        {
            WebBridgeUtils.Send("RequestWhiteLabel");
        }

        // React entry point (SendMessage): 1 = white-label, 0 = branded.
        public void ApplyWhiteLabel(int value)
        {
            bool isWhiteLabel = value != 0;
            CurrentIsWhiteLabel = isWhiteLabel;
            WebBridgeLogger.Log($"[{typeof(T).Name}] ApplyWhiteLabel: {isWhiteLabel}");
            WhiteLabelReceived?.Invoke(isWhiteLabel);
        }

        // React entry point (SendMessage): 1 = enable WebBridge logging, 0 = disable. Lets the
        // cheat panel turn the (build-default-off) bridge logs on/off at runtime.
        public void SetLoggingEnabled(int value)
        {
            WebBridgeLogger.IsEnabled = value != 0;
        }

        // React entry point (SendMessage): 1 = fast game on, 0 = off. The toggle lives in the
        // React bet bar and is shared by every game; React owns the value and persists it, so
        // this is the single way the setting enters Unity.
        public void SetFastGame(int value)
        {
            ApplyFastGame(value != 0);
        }

        // Asks React for the current fast-game status; it replies by calling SetFastGame. React
        // also pushes the value on load, so this is only for game code that wires up later and
        // needs the state it may have missed.
        public virtual void RequestFastGame()
        {
            WebBridgeUtils.Send("RequestFastGame");
        }

        // Unity -> React: the game switched fast mode on its own (e.g. forced it off for a bonus).
        // React mirrors the value into the bet-bar toggle. Silent when nothing actually changed.
        public void NotifyFastGameChanged(bool isEnabled)
        {
            if (!ApplyFastGame(isEnabled))
                return;

            WebBridgeUtils.Send(isEnabled ? "FastGame_1" : "FastGame_0");
        }

        // Returns true when the value actually changed — keeps both entry points from re-applying
        // the same speed and from echoing it back to the side that just sent it.
        private bool ApplyFastGame(bool isEnabled)
        {
            if (IsFastGameEnabled == isEnabled)
                return false;

            IsFastGameEnabled = isEnabled;
            WebBridgeLogger.Log($"[{typeof(T).Name}] FastGame: {isEnabled}");
            FastGameChanged?.Invoke(isEnabled);
            return true;
        }

        public abstract void RequestGameConfig();
        public abstract void RequestGameState();
    }
}
