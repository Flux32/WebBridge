using System;
using UnityEngine;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.MineSlot
{
    /// <summary>
    /// Bridge between React and a Mine Slot game: a 5 × 3 slot whose pickaxes fall into a field of
    /// blocks under the reels. React forwards the server's play reply as is (ApplySpinResult): the
    /// base spin and, after three scatters or a bought bonus, every free spin on one field. Unity
    /// plays the rounds in order and calls NotifySpinReady once, after the last one — React keeps
    /// the win and the bet bar locked until then.
    /// </summary>
    [Preserve]
    public class MineSlotWebBridge : WebBridgeBase<MineSlotWebBridge>
    {
        [Header("Mock")]
        [SerializeField] private MineSlotMockSettings _mockSettings = new MineSlotMockSettings();

        // The platform config, as is: its shape is owned by the platform, not by this contract.
        public event Action<JsonValue> GameConfigReceived;

        // "Bring the scene to this state" (load, resync); status none means no round is in play.
        public event Action<WebMineSlotSpinResultPayload> GameStateReceived;

        // A play reply: the game plays every round of it, then calls NotifySpinReady.
        public event Action<WebMineSlotSpinResultPayload> SpinResultReceived;

        public JsonValue LastGameConfig { get; private set; }

        // The latest state React described, by a game state or by a play reply.
        public WebMineSlotSpinResultPayload LastGameState { get; private set; }

        public WebMineSlotSpinResultPayload LastSpinResult { get; private set; }

        // The stand-in for React and the game server in mock mode; null outside it.
        public MineSlotMockHost MockHost { get; private set; }

        private void Start()
        {
            HasReceivedInitialConfig = IsMockEnabled;

            if (IsMockEnabled)
            {
                InitializeMock();
                return;
            }

            BeginInitialWebSyncAfterSceneLoad();
        }

        public override void RequestGameConfig()
        {
            if (IsMockEnabled)
                MockHost.AnswerGameConfig();
            else
                WebBridgeUtils.Send("RequestGameConfig");
        }

        public override void RequestGameState()
        {
            if (IsMockEnabled)
                MockHost.AnswerGameState();
            else
                WebBridgeUtils.Send("RequestGameState");
        }

        // In mock mode the serialized value is delivered at once, so editor play still drives the swap.
        public override void RequestWhiteLabel()
        {
            if (IsMockEnabled)
                MockHost.AnswerWhiteLabel();
            else
                base.RequestWhiteLabel();
        }

        // In mock mode the stand-in answers as React does: a spin, or DisabledPlayPressed mid-round.
        public override void RequestPlay()
        {
            if (IsMockEnabled)
                MockHost.AnswerPlay();
            else
                base.RequestPlay();
        }

        // React entry point (SendMessage): the platform game config.
        public void ApplyGameConfig(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyGameConfig raw: {payload}");
            JsonValue config = WebBridgeUtils.DeserializePayload<JsonValue>(payload, nameof(ApplyGameConfig));
            if (config == null)
                return;

            HasReceivedInitialConfig = true;
            LastGameConfig = config;
            GameConfigReceived?.Invoke(config);
        }

        // React entry point (SendMessage): the current GameState (get-game-state on load).
        public void ApplyGameState(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyGameState raw: {payload}");
            WebMineSlotSpinResultPayload state =
                WebBridgeUtils.DeserializePayload<WebMineSlotSpinResultPayload>(payload, nameof(ApplyGameState));
            if (state == null)
                return;

            LastGameState = state;
            GameStateReceived?.Invoke(state);
        }

        // React entry point (SendMessage): the server's play reply as JSON, free spins included.
        public void ApplySpinResult(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplySpinResult raw: {payload}");
            WebMineSlotSpinResultPayload result =
                WebBridgeUtils.DeserializePayload<WebMineSlotSpinResultPayload>(payload, nameof(ApplySpinResult));
            if (result == null)
                return;

            LastSpinResult = result;
            LastGameState = result;
            SpinResultReceived?.Invoke(result);
        }

        // Unity -> React: every round of the reply is played out. React reveals the win and unlocks
        // the bet bar on this signal, never on the server reply, so the outcome is never spoiled.
        public void NotifySpinReady()
        {
            WebBridgeUtils.Send("SpinReady");

            if (IsMockEnabled)
                MockHost.OnSpinReady();
        }

        // Mock mode replaces React entirely: the host answers, the debug panel is the bet bar.
        private void InitializeMock()
        {
            MockHost = new MineSlotMockHost(this, _mockSettings);
            gameObject.AddComponent<MineSlotMockDebugIMGUI>();
            MockHost.Start();
        }
    }
}
