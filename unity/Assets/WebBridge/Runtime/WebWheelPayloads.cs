using System;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Wheel
{
    /// <summary>
    /// Phase of the shared wheel round. The backend runs one round for every player at once,
    /// so the game never starts a round itself — it shows the phase React reports.
    /// </summary>
    public enum WheelRoundStatus
    {
        Unknown = 0,
        WaitingForBets = 1,
        Spinning = 2,
        Finished = 3,
        Stopped = 4
    }

    /// <summary>Sector colour of the wheel. Each colour pays its own fixed multiplier.</summary>
    public enum WheelColor
    {
        Unknown = 0,
        Black = 1,
        Red = 2,
        Blue = 3,
        Green = 4
    }

    /// <summary>
    /// State of the current round as React received it from the game service. Strings are the
    /// wire form; game code reads the parsed <see cref="Status"/> and <see cref="Winner"/>.
    /// </summary>
    [Preserve]
    [Serializable]
    public class WebWheelRoundPayload
    {
        [JsonName("status")]
        public string StatusName;

        // Round number of the backend, shown to the player as the round id.
        [JsonName("roundId")]
        public string RoundId;

        // Milliseconds left until the phase changes. Sent with the betting phase; absent when
        // the backend named no term.
        [JsonName("msToNextPhase")]
        public int? MsToNextPhase;

        // Colour the round resolved to. Sent once the outcome is known.
        [JsonName("winnerColor")]
        public string WinnerColorName;

        // Index of the winning cell and where inside it the pointer stops. Meaningful for a
        // wheel layout; a game that shows the outcome differently reads Winner instead.
        [JsonName("cellIndex")]
        public int? CellIndex;

        [JsonName("inCellOffset")]
        public float? InCellOffset;

        public WheelRoundStatus Status => ParseStatus(StatusName);

        public WheelColor Winner => ParseColor(WinnerColorName);

        private static WheelRoundStatus ParseStatus(string value)
        {
            switch (value)
            {
                case "WAIT_GAME": return WheelRoundStatus.WaitingForBets;
                case "IN_GAME": return WheelRoundStatus.Spinning;
                case "FINISH_GAME": return WheelRoundStatus.Finished;
                case "STOPPED": return WheelRoundStatus.Stopped;
                default: return WheelRoundStatus.Unknown;
            }
        }

        private static WheelColor ParseColor(string value)
        {
            switch (value)
            {
                case "BLACK": return WheelColor.Black;
                case "RED": return WheelColor.Red;
                case "BLUE": return WheelColor.Blue;
                case "GREEN": return WheelColor.Green;
                default: return WheelColor.Unknown;
            }
        }
    }

    /// <summary>
    /// Where the React bet bar covers the canvas. Heights are canvas shares from the bottom edge
    /// (0..1, as a Unity viewport): lay out the game above <see cref="BetBarTopViewport"/>, or above
    /// <see cref="HistoryTopViewport"/> for what may run under the countdown bar.
    /// </summary>
    [Preserve]
    [Serializable]
    public class WebWheelBetBarMetricsPayload
    {
        // Width of the bar column (countdown, bet panel, board) as a share of the canvas width.
        [JsonName("widthViewport")]
        public float WidthViewport;

        // Top edge of the bar: the "PLACE YOUR BETS" call over the countdown bar.
        [JsonName("betBarTopViewport")]
        public float BetBarTopViewport;

        // Top edge of the history strip (past rounds) under the countdown bar.
        [JsonName("historyTopViewport")]
        public float HistoryTopViewport;

        // Scale of the bar against its 1920x1080 design: 1 is the design size.
        [JsonName("betBarScale")]
        public float BetBarScale;
    }
}
