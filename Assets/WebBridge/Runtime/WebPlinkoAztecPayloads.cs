using System;
using System.Collections.Generic;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.PlinkoAztec
{
    // Result of a single ball drop (one entry of GameState.ballsResult, see Plinko Aztec
    // WebSocket API). position is the slot label ("0.2", "20", "spin"), coeff is the win
    // coefficient the slot paid ("0" for spin slots).
    [Preserve]
    [Serializable]
    public class WebPlinkoAztecBallResult
    {
        [JsonName("position")]
        public string Position;

        [JsonName("coeff")]
        public string Coeff;

        // How many bumper hits this ball scored on the way down.
        [JsonName("bonusBumpAmount")]
        public int? BonusBumpAmount;
    }

    // Result of a fortune-wheel spin. Present on the GameState only when the wheel was
    // triggered during the round.
    [Preserve]
    [Serializable]
    public class WebPlinkoAztecFreeSpinResult
    {
        // Wheel sector that came up (multiplier value or the bonus-game sector).
        [JsonName("position")]
        public string Position;

        [JsonName("winAmount")]
        public string WinAmount;

        [JsonName("coeff")]
        public string Coeff;
    }

    // Live state of an active bonus game (bonusGameState.result). Present only while a bonus
    // game is running.
    [Preserve]
    [Serializable]
    public class WebPlinkoAztecBonusGameResult
    {
        // 1-based index for the case when several bonus games were won at once.
        [JsonName("gameNumber")]
        public int? GameNumber;

        [JsonName("level")]
        public int? Level;

        // Progress towards the next bonus level (bumper hits on the current level).
        [JsonName("progress")]
        public int? Progress;

        // Balls thrown per bonus step on the current level.
        [JsonName("ballPerDrop")]
        public int? BallPerDrop;

        // Bonus steps left.
        [JsonName("ballsAmount")]
        public int? BallsAmount;

        [JsonName("freeSpinProgress")]
        public int? FreeSpinProgress;

        [JsonName("winAmount")]
        public string WinAmount;
    }

    // Bumper-hit counters plus the active bonus game, if any. progress keys follow the
    // "CUR-balls-betPerBall" format (e.g. "USD-10-1"), one independent counter per combination.
    [Preserve]
    [Serializable]
    public class WebPlinkoAztecBonusGameState
    {
        [JsonName("progress")]
        public Dictionary<string, int> Progress;

        [JsonName("result")]
        public WebPlinkoAztecBonusGameResult Result;
    }

    // Plinko Aztec game state. Base fields (status/bet/isFinished/isWin/winAmount) come from
    // WebGameStateBase; the fields below are the Aztec extendGameState delivered on the top
    // level of the GameState object (see Plinko Aztec WebSocket API).
    [Preserve]
    [Serializable]
    public class WebPlinkoAztecStatePayload : WebGameStateBase
    {
        // Final round coefficient (sum of all ball coefficients). Present when the round resolves.
        [JsonName("coeff")]
        public float? Coeff;

        // Balls used in the round: 10, 20 or 50.
        [JsonName("ballsAmount")]
        public int? BallsAmount;

        // Bet per single ball; total bet = betPerBall * ballsAmount.
        [JsonName("betPerBall")]
        public string BetPerBall;

        [JsonName("ballsResult")]
        public WebPlinkoAztecBallResult[] BallsResult;

        // Present only if the fortune wheel was triggered during the round.
        [JsonName("freeSpinResult")]
        public WebPlinkoAztecFreeSpinResult FreeSpinResult;

        [JsonName("bonusGameState")]
        public WebPlinkoAztecBonusGameState BonusGameState;

        // Top-level duplicates the platform also sends alongside the bet object.
        [JsonName("betAmount")]
        public string BetAmount;

        [JsonName("currency")]
        public string Currency;
    }

    // Where a balls-per-drop change came from. None marks the pushes the player did not make:
    // the first value after load, the answer to RequestBallsAmount, and the re-clamp React does
    // when the backend config drops the selected option.
    public enum PlinkoAztecBallsAmountDirection
    {
        None = 0,
        Increased = 1,
        Decreased = 2
    }

    // Argument of PlinkoAztecWebBridge.BallsAmountChanged. Carries the new balls-per-drop
    // selection together with the previous one, so the board can add or remove exactly the
    // balls that changed instead of rebuilding the whole tray.
    public readonly struct PlinkoAztecBallsAmountChange
    {
        public PlinkoAztecBallsAmountChange(
            int amount,
            int previousAmount,
            PlinkoAztecBallsAmountDirection direction)
        {
            Amount = amount;
            PreviousAmount = previousAmount;
            Direction = direction;
        }

        public int Amount { get; }

        // 0 until React reports the first selection.
        public int PreviousAmount { get; }

        public PlinkoAztecBallsAmountDirection Direction { get; }

        public bool IsIncrease => Direction == PlinkoAztecBallsAmountDirection.Increased;

        public bool IsDecrease => Direction == PlinkoAztecBallsAmountDirection.Decreased;
    }

    // Bet limits shared by the platform (get-game-config betConfig object). Amounts come as
    // strings with currency precision.
    [Preserve]
    [Serializable]
    public class WebPlinkoAztecBetConfigPayload
    {
        [JsonName("minBetAmount")]
        public string MinBetAmount;

        [JsonName("maxBetAmount")]
        public string MaxBetAmount;

        [JsonName("maxWinAmount")]
        public string MaxWinAmount;

        [JsonName("defaultBetAmount")]
        public string DefaultBetAmount;

        [JsonName("decimalPlaces")]
        public string DecimalPlaces;

        [JsonName("currency")]
        public string Currency;
    }

    // One slot of the board's bottom line (get-game-config positions[]): its win coefficient
    // and hit probability. Spin slots come with coefficient 0.
    [Preserve]
    [Serializable]
    public class WebPlinkoAztecPositionPayload
    {
        [JsonName("coefficient")]
        public float? Coefficient;

        [JsonName("probability")]
        public float? Probability;
    }

    // Plinko Aztec game configuration (get-game-config): bet limits, the slot line and the
    // allowed balls-per-drop options, plus saved bumper-hit progress per combination.
    [Preserve]
    [Serializable]
    public class WebPlinkoAztecConfigPayload
    {
        [JsonName("betConfig")]
        public WebPlinkoAztecBetConfigPayload BetConfig;

        [JsonName("positions")]
        public WebPlinkoAztecPositionPayload[] Positions;

        // Allowed ballsAmount values for play (e.g. [10, 20, 50]).
        [JsonName("ballsAmountOptions")]
        public int[] BallsAmountOptions;

        [JsonName("showStartupModal")]
        public bool? ShowStartupModal;

        // Same "CUR-balls-betPerBall" keyed counters as bonusGameState.progress.
        [JsonName("bonusGameProgress")]
        public Dictionary<string, int> BonusGameProgress;
    }
}
