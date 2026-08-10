using System;
using UnityEngine;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.PlinkoAztec
{
    // Thin bridge between React (client-core WebSocket backend) and the Unity Plinko Aztec
    // board. React owns betting: it calls game.play({ betPerBall, ballsAmount }) on client-core,
    // receives the resolved GameState and forwards it here so Unity animates the balls into
    // their ballsResult positions (including fortune-wheel and bonus-game presentation). Bonus
    // steps are the same loop: Unity asks for a step (player tap), React calls game.step() and
    // forwards the result. Unity holds no gameplay logic — it only visualizes results and
    // reports when animations end.
    [Preserve]
    public class PlinkoAztecWebBridge : WebBridgeBase<PlinkoAztecWebBridge>
    {
        // Balls-per-drop is unknown until React pushes the bet-bar selection.
        private const int UnknownBallsAmount = 0;

        public event Action<WebPlinkoAztecConfigPayload> GameConfigReceived;
        public event Action<WebPlinkoAztecStatePayload> GameStateReceived;
        public event Action<WebPlinkoAztecStatePayload> DropResultReceived;
        public event Action<WebPlinkoAztecStatePayload> StepResultReceived;

        // Fires on every balls-per-drop change: the player stepped the bet-bar switch up or
        // down, or React pushed the current selection (load, RequestBallsAmount answer). The
        // value is cached in CurrentBallsAmount, so a subscriber that wires up later can read
        // it instead of waiting for the next change.
        public event Action<PlinkoAztecBallsAmountChange> BallsAmountChanged;

        public WebPlinkoAztecConfigPayload LastGameConfig { get; private set; }
        public WebPlinkoAztecStatePayload LastGameState { get; private set; }
        public WebPlinkoAztecStatePayload LastDropResult { get; private set; }
        public WebPlinkoAztecStatePayload LastStepResult { get; private set; }

        // Balls the next drop will throw, as selected in the React bet bar. 0 until React
        // reports the selection — call RequestBallsAmount to ask for it.
        public int CurrentBallsAmount { get; private set; } = UnknownBallsAmount;

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

        // Unity -> React: the player triggered the next bonus-game drop (tap on the board).
        // React answers with a game.step() result via ApplyStepResult.
        public void RequestStep()
        {
            WebBridgeUtils.Send("RequestStep");
        }

        // Unity -> React: asks for the balls-per-drop currently selected in the bet bar; React
        // answers by calling SetBallsAmount. React also pushes the value on load and on every
        // switch, so this is only for game code that wires up later and needs what it missed.
        public void RequestBallsAmount()
        {
            WebBridgeUtils.Send("RequestBallsAmount");
        }

        // React entry point (SendMessage): balls-per-drop selected in the bet bar. React owns
        // the value (the allowed options come from the backend config) — this is the only way
        // the selection enters Unity. Re-sending the same value raises no event.
        public void SetBallsAmount(int amount)
        {
            if (amount <= UnknownBallsAmount)
            {
                WebBridgeLogger.LogWarning($"[PlinkoAztecWebBridge] SetBallsAmount ignored: {amount}");
                return;
            }

            if (amount == CurrentBallsAmount)
                return;

            int previousAmount = CurrentBallsAmount;
            CurrentBallsAmount = amount;
            WebBridgeLogger.Log($"[PlinkoAztecWebBridge] BallsAmount: {previousAmount} -> {amount}");
            BallsAmountChanged?.Invoke(
                new PlinkoAztecBallsAmountChange(amount, previousAmount, ResolveDirection(previousAmount, amount)));
        }

        // React entry point (SendMessage): platform game config with the slot line and
        // balls-per-drop options.
        public void ApplyGameConfig(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyGameConfig raw: {payload}");
            WebPlinkoAztecConfigPayload config =
                WebBridgeUtils.DeserializePayload<WebPlinkoAztecConfigPayload>(payload, nameof(ApplyGameConfig));
            if (config == null)
                return;

            HasReceivedInitialConfig = true;
            LastGameConfig = config;
            GameConfigReceived?.Invoke(config);
        }

        // React entry point (SendMessage): current GameState (e.g. get-game-state on load).
        public void ApplyGameState(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyGameState raw: {payload}");
            WebPlinkoAztecStatePayload state =
                WebBridgeUtils.DeserializePayload<WebPlinkoAztecStatePayload>(payload, nameof(ApplyGameState));
            if (state == null)
                return;

            LastGameState = state;
            GameStateReceived?.Invoke(state);
        }

        // React entry point (SendMessage): resolved result of a play command. Carries coeff,
        // ballsResult, freeSpinResult and bonusGameState. The board animates every ball into
        // its position, then plays the wheel/bonus presentation if present.
        public void ApplyDropResult(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyDropResult raw: {payload}");
            WebPlinkoAztecStatePayload result =
                WebBridgeUtils.DeserializePayload<WebPlinkoAztecStatePayload>(payload, nameof(ApplyDropResult));
            if (result == null)
                return;

            LastDropResult = result;
            LastGameState = result;
            DropResultReceived?.Invoke(result);
        }

        // React entry point (SendMessage): resolved result of a bonus-game step command. Same
        // GameState shape as a drop; bonusGameState.result carries the live bonus counters.
        public void ApplyStepResult(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyStepResult raw: {payload}");
            WebPlinkoAztecStatePayload result =
                WebBridgeUtils.DeserializePayload<WebPlinkoAztecStatePayload>(payload, nameof(ApplyStepResult));
            if (result == null)
                return;

            LastStepResult = result;
            LastGameState = result;
            StepResultReceived?.Invoke(result);
        }

        // Unity -> React: the drop animation finished and every ball settled. React settles the
        // win UI (balance already updated by the backend response) on this signal.
        public void NotifyDropFinished()
        {
            WebBridgeUtils.Send("DropFinished");
        }

        // The very first value the bridge learns has nothing to compare against, so it is a
        // plain sync rather than a step the player made.
        private static PlinkoAztecBallsAmountDirection ResolveDirection(int previousAmount, int amount)
        {
            if (previousAmount == UnknownBallsAmount)
                return PlinkoAztecBallsAmountDirection.None;

            return amount > previousAmount
                ? PlinkoAztecBallsAmountDirection.Increased
                : PlinkoAztecBallsAmountDirection.Decreased;
        }
    }
}
