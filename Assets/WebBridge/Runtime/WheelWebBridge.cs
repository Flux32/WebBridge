using System;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Wheel
{
    /// <summary>
    /// Bridge between React and a wheel-style game (one shared round, a bet on a colour).
    ///
    /// React owns the round: it talks to the game service, follows the phase the backend pushes
    /// and forwards it here. Unity holds no round logic and no betting UI — the bet bar and the
    /// bet board live in React — it only shows the phase it is told about and reports back when
    /// its presentation of the outcome has finished.
    /// </summary>
    [Preserve]
    public class WheelWebBridge : WebBridgeBase<WheelWebBridge>
    {
        // Fires on every phase report: betting, spinning, finished, stopped.
        public event Action<WebWheelRoundPayload> RoundReceived;

        public WebWheelRoundPayload LastRound { get; private set; }

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

        // React entry point (SendMessage): state of the shared round — phase, time left and,
        // once it is known, the outcome.
        public void ApplyRound(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyRound raw: {payload}");
            WebWheelRoundPayload round =
                WebBridgeUtils.DeserializePayload<WebWheelRoundPayload>(payload, nameof(ApplyRound));
            if (round == null)
                return;

            HasReceivedInitialConfig = true;
            LastRound = round;
            RoundReceived?.Invoke(round);
        }

        // Unity -> React: the outcome has been played out on screen. React settles the win UI on
        // this signal instead of the backend answer, so the player never sees the result early.
        public void NotifyRoundShown()
        {
            WebBridgeUtils.Send("RoundShown");
        }
    }
}
