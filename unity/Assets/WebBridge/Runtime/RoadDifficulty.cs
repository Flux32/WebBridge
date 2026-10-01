using System;

namespace Modules.Road
{
    /// <summary>
    /// Road difficulty level. React sends it by the backend's name (<c>SetDifficulty("HARD")</c>);
    /// the numeric values are the bridge's own and never travel over the wire.
    /// </summary>
    public enum RoadDifficulty
    {
        Easy = 0,
        Medium = 1,
        Hard = 2,
        Daredevil = 3,
    }

    /// <summary>Argument of <see cref="RoadWebBridge.DifficultyChanged"/>.</summary>
    public readonly struct RoadDifficultyChange
    {
        public RoadDifficultyChange(RoadDifficulty? previous, RoadDifficulty current)
        {
            Previous = previous;
            Current = current;
        }

        // null on the first difficulty after load.
        public RoadDifficulty? Previous { get; }

        public RoadDifficulty Current { get; }
    }

    /// <summary>The backend's difficulty names, the only form a difficulty takes on the wire.</summary>
    public static class RoadDifficultyWireNames
    {
        private const string Easy = "EASY";
        private const string Medium = "MEDIUM";
        private const string Hard = "HARD";
        private const string Daredevil = "DAREDEVIL";

        // Exact match only: Enum.TryParse would also take "1", "hard" or "Hard".
        public static bool TryParse(string wireName, out RoadDifficulty difficulty)
        {
            switch (wireName)
            {
                case Easy:
                    difficulty = RoadDifficulty.Easy;
                    return true;
                case Medium:
                    difficulty = RoadDifficulty.Medium;
                    return true;
                case Hard:
                    difficulty = RoadDifficulty.Hard;
                    return true;
                case Daredevil:
                    difficulty = RoadDifficulty.Daredevil;
                    return true;
                default:
                    difficulty = default;
                    return false;
            }
        }

        public static string ToWireName(this RoadDifficulty difficulty)
        {
            switch (difficulty)
            {
                case RoadDifficulty.Easy:
                    return Easy;
                case RoadDifficulty.Medium:
                    return Medium;
                case RoadDifficulty.Hard:
                    return Hard;
                case RoadDifficulty.Daredevil:
                    return Daredevil;
                default:
                    throw new ArgumentOutOfRangeException(nameof(difficulty), difficulty, "Unknown road difficulty");
            }
        }
    }
}
