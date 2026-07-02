using System;
using UnityEngine;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Plinko
{
    // Thin bridge between React (client-core WebSocket backend) and the Unity Plinko board.
    // React owns betting: it calls game.play({ risk }) on client-core, receives the resolved
    // GameState and forwards it here so Unity animates the ball into resultPosition. Unity holds
    // no gameplay logic — it only visualizes results and reports when the drop animation ends.
    [Preserve]
    public class PlinkoWebBridge : WebBridgeBase<PlinkoWebBridge>
    {
        public event Action<WebPlinkoConfigPayload> GameConfigReceived;
        public event Action<WebPlinkoStatePayload> GameStateReceived;
        public event Action<WebPlinkoStatePayload> DropResultReceived;
        public event Action<float> BalanceReceived;

        public WebPlinkoConfigPayload LastGameConfig { get; private set; }
        public WebPlinkoStatePayload LastGameState { get; private set; }
        public WebPlinkoStatePayload LastDropResult { get; private set; }
        public float? LastBalance { get; private set; }

        private void Start()
        {
            HasReceivedInitialConfig = IsMockEnabled;

            if (!IsMockEnabled)
                BeginInitialWebSyncAfterSceneLoad();
        }

        public override void RequestGameConfig()
        {
            WebBridgeUtils.Send("RequestGameConfig");
        }

        public override void RequestGameState()
        {
            WebBridgeUtils.Send("RequestGameState");
        }

        // React entry point (SendMessage): platform game config with per-risk coefficients.
        public void ApplyGameConfig(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyGameConfig raw: {payload}");
            WebPlinkoConfigPayload config =
                WebBridgeUtils.DeserializePayload<WebPlinkoConfigPayload>(payload, nameof(ApplyGameConfig));
            if (config == null)
                return;

            HasReceivedInitialConfig = true;
            LastGameConfig = config;
            GameConfigReceived?.Invoke(config);

            if (config.Balance.HasValue)
            {
                LastBalance = config.Balance.Value;
                BalanceReceived?.Invoke(config.Balance.Value);
            }
        }

        // React entry point (SendMessage): current GameState (e.g. get-game-state on load).
        public void ApplyGameState(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyGameState raw: {payload}");
            WebPlinkoStatePayload state =
                WebBridgeUtils.DeserializePayload<WebPlinkoStatePayload>(payload, nameof(ApplyGameState));
            if (state == null)
                return;

            LastGameState = state;
            GameStateReceived?.Invoke(state);
        }

        // React entry point (SendMessage): resolved result of a play command. Carries coeff,
        // resultPosition, winAmount and risk. The board animates the ball into resultPosition.
        public void ApplyDropResult(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyDropResult raw: {payload}");
            WebPlinkoStatePayload result =
                WebBridgeUtils.DeserializePayload<WebPlinkoStatePayload>(payload, nameof(ApplyDropResult));
            if (result == null)
                return;

            LastDropResult = result;
            LastGameState = result;
            DropResultReceived?.Invoke(result);
        }

        // Unity -> React: the drop animation finished and the ball settled. React settles the
        // win UI (balance already updated by the backend response) on this signal.
        public void NotifyDropFinished()
        {
            WebBridgeUtils.Send("DropFinished");
        }
    }
}
