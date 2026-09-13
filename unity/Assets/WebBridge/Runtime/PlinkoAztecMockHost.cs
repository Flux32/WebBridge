using System;
using System.Collections.Generic;
using System.Globalization;
using WebBridge;

namespace Modules.PlinkoAztec
{
    /// <summary>
    /// Local stand-in for the React + platform pair in editor play. Builds the very same JSON
    /// payloads the bridge receives from the web side, so the board runs through its real parse
    /// path without a web build, and keeps the session state a backend would own: bumper
    /// progress per bet combination and the running bonus game.
    /// </summary>
    public class PlinkoAztecMockHost
    {
        private const string SpinSlotLabel = "spin";
        private const string BonusWheelSector = "bonus";
        private const string StatusIdle = "none";
        private const string StatusInGame = "in-game";
        private const string StatusWin = "win";
        private const int MaxBumpsPerBall = 3;

        private readonly PlinkoAztecMockSettings _settings;
        private readonly Random _random = new Random();
        private readonly Dictionary<string, int> _bonusProgress = new Dictionary<string, int>();

        private WebPlinkoAztecBonusGameResult _activeBonus;
        private int _bonusGamesPlayed;

        public PlinkoAztecMockHost(PlinkoAztecMockSettings settings)
        {
            _settings = settings;
        }

        public bool IsBonusActive => _activeBonus != null;

        public int BonusLevel => _activeBonus.Level.Value;

        public int BonusStepsLeft => _activeBonus.BallsAmount.Value;

        /// <summary>Drops the emulated session back to a fresh player: no progress, no bonus.</summary>
        public void Reset()
        {
            _bonusProgress.Clear();
            _activeBonus = null;
            _bonusGamesPlayed = 0;
        }

        public string BuildGameConfig()
        {
            float[] coefficients = _settings.SlotCoefficients;
            WebPlinkoAztecPositionPayload[] positions = new WebPlinkoAztecPositionPayload[coefficients.Length];
            float probability = 1f / coefficients.Length;
            for (int i = 0; i < coefficients.Length; i++)
            {
                positions[i] = new WebPlinkoAztecPositionPayload
                {
                    Coefficient = Math.Max(0f, coefficients[i]),
                    Probability = probability,
                };
            }

            return Json.Serialize(new WebPlinkoAztecConfigPayload
            {
                BetConfig = new WebPlinkoAztecBetConfigPayload
                {
                    MinBetAmount = FormatAmount(_settings.BetPerBall),
                    MaxBetAmount = FormatAmount(_settings.BetPerBall * 100f),
                    MaxWinAmount = FormatAmount(_settings.BetPerBall * 10000f),
                    DefaultBetAmount = FormatAmount(_settings.BetPerBall),
                    DecimalPlaces = _settings.DecimalPlaces.ToString(CultureInfo.InvariantCulture),
                    Currency = _settings.Currency,
                },
                Positions = positions,
                BallsAmountOptions = _settings.BallsAmountOptions,
                ShowStartupModal = false,
                BonusGameProgress = new Dictionary<string, int>(_bonusProgress),
            });
        }

        /// <summary>Session state as the platform reports it on load: nothing played yet.</summary>
        public string BuildGameState(int ballsAmount)
        {
            WebPlinkoAztecStatePayload state = CreateState(ballsAmount);
            state.Status = _activeBonus == null ? StatusIdle : StatusInGame;
            state.IsFinished = _activeBonus == null;
            return Json.Serialize(state);
        }

        /// <summary>Resolved play result: every ball placed, wheel and bonus entry included.</summary>
        public string BuildDropResult(int ballsAmount, PlinkoAztecMockScenario scenario)
        {
            WebPlinkoAztecBallResult[] balls = new WebPlinkoAztecBallResult[ballsAmount];
            float totalCoefficient = 0f;
            int totalBumps = 0;
            bool wheelTriggered = false;

            for (int i = 0; i < ballsAmount; i++)
            {
                int slotIndex = ResolveSlotIndex(i, scenario);
                float coefficient = _settings.SlotCoefficients[slotIndex];
                bool isSpinSlot = coefficient <= 0f;
                int bumps = RollBumps();

                wheelTriggered |= isSpinSlot;
                totalCoefficient += isSpinSlot ? 0f : coefficient;
                totalBumps += bumps;

                balls[i] = new WebPlinkoAztecBallResult
                {
                    Position = isSpinSlot ? SpinSlotLabel : FormatCoefficient(coefficient),
                    Coeff = FormatCoefficient(isSpinSlot ? 0f : coefficient),
                    BonusBumpAmount = bumps,
                };
            }

            AddBonusProgress(ballsAmount, totalBumps);

            float win = totalCoefficient * _settings.BetPerBall;
            WebPlinkoAztecFreeSpinResult freeSpin = null;

            if (wheelTriggered)
            {
                bool awardsBonusGame = scenario == PlinkoAztecMockScenario.BonusGame;
                freeSpin = BuildFreeSpinResult(awardsBonusGame, win);
                if (awardsBonusGame)
                    StartBonusGame();
                else
                    win *= _settings.FortuneWheelCoefficient;
            }

            WebPlinkoAztecStatePayload result = CreateState(ballsAmount);
            result.Status = _activeBonus == null ? StatusWin : StatusInGame;
            result.IsFinished = _activeBonus == null;
            result.IsWin = win > 0f;
            result.Coeff = totalCoefficient;
            result.WinAmount = FormatAmount(win);
            result.BallsResult = balls;
            result.FreeSpinResult = freeSpin;

            return Json.Serialize(result);
        }

        /// <summary>Resolved bonus-step result: one bonus throw, its counters advanced.</summary>
        public string BuildStepResult(int ballsAmount)
        {
            int ballsPerStep = _activeBonus.BallPerDrop.Value;
            WebPlinkoAztecBallResult[] balls = new WebPlinkoAztecBallResult[ballsPerStep];
            float stepCoefficient = 0f;
            int stepBumps = 0;

            for (int i = 0; i < ballsPerStep; i++)
            {
                int slotIndex = ResolveSlotIndex(i, PlinkoAztecMockScenario.Random);
                float coefficient = _settings.SlotCoefficients[slotIndex];
                bool isSpinSlot = coefficient <= 0f;
                int bumps = RollBumps();

                stepCoefficient += isSpinSlot ? 0f : coefficient;
                stepBumps += bumps;

                balls[i] = new WebPlinkoAztecBallResult
                {
                    Position = isSpinSlot ? SpinSlotLabel : FormatCoefficient(coefficient),
                    Coeff = FormatCoefficient(isSpinSlot ? 0f : coefficient),
                    BonusBumpAmount = bumps,
                };
            }

            float stepWin = stepCoefficient * _settings.BetPerBall;
            AdvanceBonusGame(stepWin, stepBumps);

            WebPlinkoAztecStatePayload result = CreateState(ballsAmount);
            result.Status = _activeBonus == null ? StatusWin : StatusInGame;
            result.IsFinished = _activeBonus == null;
            result.IsWin = stepWin > 0f;
            result.Coeff = stepCoefficient;
            result.WinAmount = FormatAmount(stepWin);
            result.BallsResult = balls;

            return Json.Serialize(result);
        }

        private WebPlinkoAztecStatePayload CreateState(int ballsAmount)
        {
            string betAmount = FormatAmount(_settings.BetPerBall * ballsAmount);
            return new WebPlinkoAztecStatePayload
            {
                Bet = new WebBetPayload
                {
                    Amount = betAmount,
                    Currency = _settings.Currency,
                    DecimalPlaces = _settings.DecimalPlaces,
                },
                BetAmount = betAmount,
                Currency = _settings.Currency,
                BallsAmount = ballsAmount,
                BetPerBall = FormatAmount(_settings.BetPerBall),
                BonusGameState = new WebPlinkoAztecBonusGameState
                {
                    Progress = new Dictionary<string, int>(_bonusProgress),
                    Result = _activeBonus,
                },
            };
        }

        private WebPlinkoAztecFreeSpinResult BuildFreeSpinResult(bool awardsBonusGame, float win)
        {
            if (awardsBonusGame)
            {
                return new WebPlinkoAztecFreeSpinResult
                {
                    Position = BonusWheelSector,
                    Coeff = FormatCoefficient(0f),
                    WinAmount = FormatAmount(0f),
                };
            }

            float coefficient = _settings.FortuneWheelCoefficient;
            return new WebPlinkoAztecFreeSpinResult
            {
                Position = FormatCoefficient(coefficient),
                Coeff = FormatCoefficient(coefficient),
                WinAmount = FormatAmount(win * coefficient),
            };
        }

        private void StartBonusGame()
        {
            _bonusGamesPlayed++;
            _activeBonus = new WebPlinkoAztecBonusGameResult
            {
                GameNumber = _bonusGamesPlayed,
                Level = 1,
                Progress = 0,
                BallPerDrop = _settings.BonusBallsPerStep,
                BallsAmount = _settings.BonusSteps,
                FreeSpinProgress = 0,
                WinAmount = FormatAmount(0f),
            };
        }

        // One bonus step: the win piles onto the bonus total, bumper hits raise the level, and
        // the last step hands the bonus game back to the main round.
        private void AdvanceBonusGame(float stepWin, int stepBumps)
        {
            float bonusWin = ParseAmount(_activeBonus.WinAmount) + stepWin;
            _activeBonus.WinAmount = FormatAmount(bonusWin);
            _activeBonus.BallsAmount--;

            int progress = _activeBonus.Progress.Value + stepBumps;
            while (progress >= _settings.BonusLevelThreshold)
            {
                progress -= _settings.BonusLevelThreshold;
                _activeBonus.Level++;
                _activeBonus.BallPerDrop++;
            }

            _activeBonus.Progress = progress;

            if (_activeBonus.BallsAmount <= 0)
                _activeBonus = null;
        }

        // Progress counters are independent per "CUR-balls-betPerBall" combination, the way the
        // backend keeps them, so switching the bet bar in the editor switches the counter too.
        private void AddBonusProgress(int ballsAmount, int bumps)
        {
            string key = $"{_settings.Currency}-{ballsAmount}-{FormatCoefficient(_settings.BetPerBall)}";
            _bonusProgress.TryGetValue(key, out int current);
            _bonusProgress[key] = current + bumps;
        }

        private int ResolveSlotIndex(int ballIndex, PlinkoAztecMockScenario scenario)
        {
            float[] coefficients = _settings.SlotCoefficients;

            switch (scenario)
            {
                case PlinkoAztecMockScenario.TopSlots:
                    return IndexOfExtremeCoefficient(true);

                case PlinkoAztecMockScenario.BottomSlots:
                    return IndexOfExtremeCoefficient(false);

                case PlinkoAztecMockScenario.FortuneWheel when ballIndex == 0:
                case PlinkoAztecMockScenario.BonusGame when ballIndex == 0:
                    return _settings.SpinSlotIndex;

                default:
                    return _random.Next(coefficients.Length);
            }
        }

        private int IndexOfExtremeCoefficient(bool takeHighest)
        {
            float[] coefficients = _settings.SlotCoefficients;
            int bestIndex = 0;
            float best = coefficients[0];

            for (int i = 1; i < coefficients.Length; i++)
            {
                float coefficient = coefficients[i];
                if (coefficient <= 0f)
                    continue;

                bool isBetter = takeHighest ? coefficient > best : coefficient < best || best <= 0f;
                if (!isBetter)
                    continue;

                best = coefficient;
                bestIndex = i;
            }

            return bestIndex;
        }

        private int RollBumps()
        {
            int bumps = 0;
            for (int i = 0; i < MaxBumpsPerBall; i++)
            {
                if (_random.NextDouble() <= _settings.BumperChance)
                    bumps++;
            }

            return bumps;
        }

        private string FormatAmount(float value) =>
            value.ToString($"F{_settings.DecimalPlaces}", CultureInfo.InvariantCulture);

        private static float ParseAmount(string value) =>
            float.Parse(value, NumberStyles.Float, CultureInfo.InvariantCulture);

        private static string FormatCoefficient(float value) =>
            value.ToString("0.####", CultureInfo.InvariantCulture);
    }
}
