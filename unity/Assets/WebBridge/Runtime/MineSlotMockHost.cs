using System;
using WebBridge;

namespace Modules.MineSlot
{
    /// <summary>
    /// Local stand-in for the React + game server pair in mock mode. It talks to the bridge only
    /// through the bridge's React entry points, with the very JSON the platform would send, so the
    /// game runs its real parse-and-play path without a web build. It keeps what the host owns: the
    /// bet-bar lock from a play reply until SpinReady.
    /// </summary>
    public class MineSlotMockHost
    {
        private readonly MineSlotWebBridge _bridge;
        private readonly MineSlotMockSettings _settings;
        private readonly Random _random = new Random();

        private WebMineSlotSpinResultPayload _lastReply;
        // The engine owes a SpinReady: it is playing the rounds of the last reply.
        private bool _isAwaitingSpinReady;

        public MineSlotMockHost(MineSlotWebBridge bridge, MineSlotMockSettings settings)
        {
            _bridge = bridge;
            _settings = settings;
        }

        // The bet bar is free, like the enabled Play and bonus buy of the shell.
        public bool CanSpin => !_isAwaitingSpinReady;

        public string SessionInfo
        {
            get
            {
                if (_isAwaitingSpinReady)
                    return $"{_lastReply.Rounds} round(s) in play: waiting for NotifySpinReady.";

                if (_lastReply == null)
                    return $"SPIN deals a board, BONUS buys a base spin and {MineSlotSymbols.FreeSpins} free spins.";

                return $"Last reply: {_lastReply.Rounds} round(s), coeff {_lastReply.Coeff}, "
                       + $"win {_lastReply.WinAmount} {_settings.Currency}.";
            }
        }

        /// <summary>The sync React runs once the engine is ready: config, then state.</summary>
        public void Start()
        {
            AnswerGameConfig();
            AnswerGameState();
        }

        public void AnswerGameConfig() => _bridge.ApplyGameConfig(MineSlotMockReplies.BuildConfig(_settings));

        public void AnswerGameState() => _bridge.ApplyGameState(MineSlotMockReplies.BuildIdleState());

        public void AnswerWhiteLabel() => _bridge.ApplyWhiteLabel(_settings.IsWhiteLabel ? 1 : 0);

        /// <summary>A spin from the scene: answered like the bet-bar Play, or refused while it is disabled.</summary>
        public void AnswerPlay()
        {
            if (CanSpin)
                Spin();
            else
                _bridge.OnDisabledPlayPressed();
        }

        /// <summary>A plain spin; three scatters turn it into a bonus game.</summary>
        public void Spin()
        {
            RequireFreeBetBar(nameof(Spin));
            Deliver(MineSlotMockBoards.DealBoard(_random));
        }

        /// <summary>A bought bonus game: the reply carries the base spin and every free spin.</summary>
        public void BuyBonus()
        {
            RequireFreeBetBar(nameof(BuyBonus));
            Deliver(MineSlotMockBoards.DealBonusBoard(_random));
        }

        /// <summary>The engine reported every round of the reply played out: unlock the bar.</summary>
        public void OnSpinReady() => _isAwaitingSpinReady = false;

        /// <summary>Drops the lock and the last reply, as a reload would.</summary>
        public void Reset()
        {
            _lastReply = null;
            _isAwaitingSpinReady = false;
            AnswerGameState();
        }

        private void Deliver(string baseBoard)
        {
            _lastReply = MineSlotMockReplies.BuildSpinResult(baseBoard, _settings, _random);
            // Set before the send: the game may answer within ApplySpinResult.
            _isAwaitingSpinReady = true;
            _bridge.ApplySpinResult(Json.Serialize(_lastReply));
        }

        // The shell's bar is locked until SpinReady, so a spin or a buy cannot be placed meanwhile.
        private void RequireFreeBetBar(string action)
        {
            if (!CanSpin)
                throw new InvalidOperationException($"[MineSlotMockHost] {action} while a round is still in play.");
        }
    }
}
