using System;
using WebBridge;

namespace Modules.Jumper
{
    /// <summary>
    /// Local stand-in for the React + game server pair in mock mode. It talks to the bridge only
    /// through the bridge's React entry points, with the very JSON React would send, so the game
    /// runs its real parse-and-play path without a web build. It keeps what the host owns: the
    /// live round, the bet-bar lock between a jump and SpinReady, and the restart after a closed round.
    /// </summary>
    public class JumperMockHost
    {
        private const string LoseRestartReason = "lose";
        private const string WinRestartReason = "win";
        private const string CashoutRestartReason = "cashout";

        private readonly JumperWebBridge _bridge;
        private readonly JumperMockSettings _settings;
        private readonly Random _random = new Random();

        private JumperMockRound _round;
        private bool _isJumpPlaying;

        public JumperMockHost(JumperWebBridge bridge, JumperMockSettings settings)
        {
            _bridge = bridge;
            _settings = settings;
        }

        // No round: the next Play places a bet and opens one.
        public bool CanBet => _round == null;

        // A live round whose last jump has landed (SpinReady), like the enabled Play of the bet bar.
        public bool CanJump => _round != null && !_round.IsClosed && !_isJumpPlaying;

        // A bet makes the first jump right away, so a landed round always has a step to pay out.
        public bool CanCashout => CanJump;

        public JumperDifficulty Difficulty => _bridge.CurrentDifficulty.Value;

        public string SessionInfo
        {
            get
            {
                if (_round == null)
                    return "No round. BET opens one with the first jump, BONUS buys a series.";

                if (_isJumpPlaying)
                    return "Jump in flight: waiting for NotifySpinReady.";

                return $"On step {_round.LandingStep}, win {_round.WinAmount}. JUMP or CASHOUT.";
            }
        }

        /// <summary>The sync React runs once the engine is ready: difficulty, then config and state.</summary>
        public void Start()
        {
            _bridge.SetJumperDifficulty(JumperWireNames.Difficulty.ToWireName(_settings.DefaultDifficulty));
            AnswerGameConfig();
            AnswerGameState();
        }

        public void AnswerGameConfig() =>
            _bridge.ApplyGameConfig(Json.Serialize(JumperMockPayloads.BuildConfig(_settings)));

        public void AnswerGameState() =>
            _bridge.ApplyGameState(Json.Serialize(JumperMockPayloads.BuildState(_round, Difficulty)));

        public void AnswerWhiteLabel() => _bridge.ApplyWhiteLabel(_settings.IsWhiteLabel ? 1 : 0);

        /// <summary>A move from the scene: answered like the bet-bar Play, or refused while it is disabled.</summary>
        public void AnswerPlay()
        {
            if (CanBet)
                Bet();
            else if (CanJump)
                Jump();
            else
                _bridge.OnDisabledPlayPressed();
        }

        // Play gets no SpinReady: the host follows it with the first jump at once.
        public void Bet()
        {
            _round = new JumperMockRound(Difficulty, _settings, _random);
            SendMove(JumperMove.Play);
            Jump();
        }

        public void Jump()
        {
            _isJumpPlaying = true;
            _round.Jump();
            SendMove(JumperMove.Step);
        }

        // The order of the real host: the press first, then the payout reply, then the restart once
        // the result window would have closed.
        public void Cashout()
        {
            _bridge.OnCashoutPressed();
            _round.Payout();
            SendMove(JumperMove.Payout);
            Restart(CashoutRestartReason);
        }

        public void BuyBonus() =>
            _bridge.StartBonus(Json.Serialize(JumperMockBonusSeries.Build(Difficulty, _settings, _random)));

        public void ToggleAutoplay() => _bridge.SetAutoplay(_bridge.IsAutoplayEnabled ? 0 : 1);

        /// <summary>Steps the difficulty like the bet-bar selector; React allows it only between rounds.</summary>
        public void StepDifficulty(int direction)
        {
            JumperDifficulty[] difficulties = (JumperDifficulty[])Enum.GetValues(typeof(JumperDifficulty));
            int index = Array.IndexOf(difficulties, Difficulty);
            int nextIndex = (index + direction + difficulties.Length) % difficulties.Length;
            _bridge.SetJumperDifficulty(JumperWireNames.Difficulty.ToWireName(difficulties[nextIndex]));
        }

        /// <summary>The engine reported the jump over: unlock the bar and restart a round the jump closed.</summary>
        public void OnSpinReady()
        {
            _isJumpPlaying = false;
            if (_round == null || !_round.IsClosed)
                return;

            Restart(_round.Status == JumperRoundStatus.Lose ? LoseRestartReason : WinRestartReason);
        }

        /// <summary>Drops the round without a restart, as a reload would.</summary>
        public void Reset()
        {
            _round = null;
            _isJumpPlaying = false;
            AnswerGameState();
        }

        private void SendMove(JumperMove move) =>
            _bridge.ApplyJumperMove(Json.Serialize(JumperMockPayloads.BuildMove(_round, move)));

        private void Restart(string reason)
        {
            string amount = _round.Status == JumperRoundStatus.Lose
                ? string.Empty
                : $"{_round.WinAmount} {_settings.Currency}";
            _round = null;
            _bridge.RestartRound($"{reason}|{amount}");
        }
    }
}
