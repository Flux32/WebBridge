using System;
using Modules.Road;
using UnityEngine;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Jumper
{
    /// <summary>
    /// Bridge between React and a jumper game: a ladder of platforms whose accelerators throw the
    /// player several steps up.
    ///
    /// React owns the round: it talks to the game service (play, step, payout), shapes the replies
    /// into the payloads of protocol/src/jumper.ts and forwards them here. Unity holds no round
    /// logic — it plays the move it is told about and reports back when the jump is over, because
    /// React keeps the result and the bet bar locked until then. A RestartRound is answered the
    /// same way, as in crush and road: the scene is reset, then NotifySpinReady.
    /// </summary>
    [Preserve]
    public class JumperWebBridge : WebBridgeBase<JumperWebBridge>
    {
        private const string BonusProgressSaveMessagePrefix = "BonusProgressSave_";

        [Header("Mock")]
        [SerializeField] private JumperMockSettings _mockSettings = new JumperMockSettings();

        public event Action<WebJumperGameConfigPayload> GameConfigReceived;

        // Fires on ApplyGameState: "bring the scene to this round" (load, resync), as opposed to
        // MoveReceived: "this move happened, play it".
        public event Action<WebJumperRoundStatePayload> GameStateReceived;

        // Fires on every live move: play (the round opened, the player still stands below step 0),
        // step (a jump, accelerators included) and payout (the round closed with a win).
        public event Action<WebJumperMovePayload> MoveReceived;

        // Fires only when the difficulty really changes; a late subscriber reads CurrentDifficulty.
        public event Action<JumperDifficultyChange> DifficultyChanged;

        // Fires when autoplay switches. While it runs, React keeps the whole bet bar locked except
        // its stop button and makes the moves itself.
        public event Action<bool> AutoplayChanged;

        // Fires when React restarts the round: after a loss, a win at the top, a cash out (once its
        // result window has closed — the press itself arrives earlier as CashoutPressed). Carries
        // React's display string of the win, if any. The game resets the scene and answers with
        // NotifySpinReady; React keeps the bet bar locked until then.
        public event Action<RestartReason, string> RestartRequested;

        // Fires when React hands over a bought bonus series. The game plays the free games itself
        // and reports them with NotifyBonusActive, SaveBonusProgress and NotifyBonusEnded.
        public event Action<WebJumperStartBonusPayload> BonusStartRequested;

        public WebJumperGameConfigPayload LastGameConfig { get; private set; }

        // The latest round React described, by a state or by a move.
        public WebJumperRoundStatePayload LastGameState { get; private set; }

        public WebJumperMovePayload LastMove { get; private set; }

        public WebJumperStartBonusPayload LastBonusStart { get; private set; }

        // null until React reports it: the host pushes it once the bridge is ready and again on
        // every change.
        public JumperDifficulty? CurrentDifficulty { get; private set; }

        public bool IsAutoplayEnabled { get; private set; }

        // The stand-in for React and the game server in mock mode; null outside it.
        public JumperMockHost MockHost { get; private set; }

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
            {
                MockHost.AnswerGameConfig();
                return;
            }

            WebBridgeUtils.Send("RequestGameConfig");
        }

        public override void RequestGameState()
        {
            if (IsMockEnabled)
            {
                MockHost.AnswerGameState();
                return;
            }

            WebBridgeUtils.Send("RequestGameState");
        }

        // In mock mode the serialized value is delivered at once, so editor play still drives the
        // white-label swap. Otherwise defers to the base handshake.
        public override void RequestWhiteLabel()
        {
            if (IsMockEnabled)
            {
                MockHost.AnswerWhiteLabel();
                return;
            }

            base.RequestWhiteLabel();
        }

        // In mock mode the stand-in answers the way React does: a bet when no round is open, a jump
        // in a live round, DisabledPlayPressed while the bar is locked.
        public override void RequestPlay()
        {
            if (IsMockEnabled)
            {
                MockHost.AnswerPlay();
                return;
            }

            base.RequestPlay();
        }

        // React entry point (SendMessage): every difficulty's ladder.
        public void ApplyGameConfig(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyGameConfig raw: {payload}");
            WebJumperGameConfigPayload config =
                WebBridgeUtils.DeserializePayload<WebJumperGameConfigPayload>(payload, nameof(ApplyGameConfig));
            if (config == null)
                return;

            HasReceivedInitialConfig = true;
            LastGameConfig = config;
            GameConfigReceived?.Invoke(config);
        }

        // React entry point (SendMessage): the round as the server last described it.
        public void ApplyGameState(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyGameState raw: {payload}");
            WebJumperRoundStatePayload state =
                WebBridgeUtils.DeserializePayload<WebJumperRoundStatePayload>(payload, nameof(ApplyGameState));
            if (state == null)
                return;

            LastGameState = state;
            GameStateReceived?.Invoke(state);
        }

        // React entry point (SendMessage): the difficulty in play by the backend's name ("HARD").
        // Accepts the exact name only; re-sending the same difficulty raises no event.
        public void SetJumperDifficulty(string wireName)
        {
            if (!JumperWireNames.Difficulty.TryParse(wireName, out JumperDifficulty difficulty))
            {
                WebBridgeLogger.LogWarning($"[JumperWebBridge] SetJumperDifficulty ignored: '{wireName}'");
                return;
            }

            if (difficulty == CurrentDifficulty)
                return;

            JumperDifficulty? previous = CurrentDifficulty;
            CurrentDifficulty = difficulty;
            WebBridgeLogger.Log($"[JumperWebBridge] Difficulty: {previous} -> {difficulty}");
            DifficultyChanged?.Invoke(new JumperDifficultyChange(previous, difficulty));
        }

        // React entry point (SendMessage): a live move's result. Of the moves, SpinReady answers
        // jumps only: play opens the round and React follows it with the first jump (step to step 0)
        // without waiting; a step is played, accelerator chain included, and NotifySpinReady goes
        // once the player has landed or fallen; payout closes the round, which then waits for
        // RestartRound.
        public void ApplyJumperMove(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] ApplyJumperMove raw: {payload}");
            WebJumperMovePayload move =
                WebBridgeUtils.DeserializePayload<WebJumperMovePayload>(payload, nameof(ApplyJumperMove));
            if (move == null)
                return;

            LastMove = move;
            LastGameState = move;
            MoveReceived?.Invoke(move);
        }

        // React entry point (SendMessage): 1 = autoplay on, 0 = off.
        public void SetAutoplay(int value)
        {
            bool isEnabled = value != 0;
            if (isEnabled == IsAutoplayEnabled)
                return;

            IsAutoplayEnabled = isEnabled;
            WebBridgeLogger.Log($"[JumperWebBridge] Autoplay: {isEnabled}");
            AutoplayChanged?.Invoke(isEnabled);
        }

        // React entry point (SendMessage): "<reason>|<amount>", e.g. "cashout|$5.00" or "lose|".
        public void RestartRound(string payload)
        {
            RestartRoundPayload.Parse(payload, out RestartReason reason, out string amount);
            RestartRequested?.Invoke(reason, amount);
        }

        // React entry point (SendMessage): the bought bonus series, settled and paid by the server.
        public void StartBonus(string payload)
        {
            WebBridgeLogger.Log($"[BridgeDebug][React->Unity] StartBonus raw: {payload}");
            WebJumperStartBonusPayload bonus =
                WebBridgeUtils.DeserializePayload<WebJumperStartBonusPayload>(payload, nameof(StartBonus));
            if (bonus == null)
                return;

            LastBonusStart = bonus;
            BonusStartRequested?.Invoke(bonus);
        }

        // Unity -> React: the jump animation is over, or the scene is reset after RestartRound.
        // React reveals the move's result and unlocks the bet bar on this signal, never on the
        // server reply, so the player never sees the outcome before the jump lands.
        public void NotifySpinReady()
        {
            WebBridgeUtils.Send("SpinReady");

            if (IsMockEnabled)
                MockHost.OnSpinReady();
        }

        // Unity -> React: the bonus series started playing.
        public void NotifyBonusActive()
        {
            WebBridgeUtils.Send("BonusActive");
        }

        // Unity -> React: a free game of the series is played out.
        public void SaveBonusProgress(int completedIterations, int totalIterations)
        {
            string json = Json.Serialize(new WebJumperBonusProgressPayload
            {
                CompletedIterations = completedIterations,
                TotalIterations = totalIterations,
            });
            WebBridgeUtils.Send(BonusProgressSaveMessagePrefix + json);
        }

        // Unity -> React: the last free game of the series is played out.
        public void NotifyBonusEnded()
        {
            WebBridgeUtils.Send("BonusEnded");
        }

        // Mock mode replaces React entirely: the host answers what the web side would, and the
        // debug panel replaces the bet bar the player would press.
        private void InitializeMock()
        {
            MockHost = new JumperMockHost(this, _mockSettings);
            gameObject.AddComponent<JumperMockDebugIMGUI>();
            MockHost.Start();
        }
    }
}
