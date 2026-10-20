namespace Modules.Jumper
{
    // The numeric values below are the bridge's own and never travel over the wire: React sends
    // every one of these by the backend's name, see JumperWireNames.

    /// <summary>Jumper difficulty level. Jumper has no DAREDEVIL.</summary>
    public enum JumperDifficulty
    {
        Easy = 0,
        Medium = 1,
        Hard = 2,
    }

    /// <summary>An accelerator that throws the player several steps up the ladder.</summary>
    public enum JumperAccelerator
    {
        Trampoline = 0,
        Jetpack = 1,
        Rocket = 2,
    }

    /// <summary>
    /// What an accelerator slot shows: Hidden until the player lands on it or flies over it,
    /// then its accelerator, or None for an empty slot.
    /// </summary>
    public enum JumperSlotState
    {
        Hidden = 0,
        None = 1,
        Trampoline = 2,
        Jetpack = 3,
        Rocket = 4,
    }

    /// <summary>Round status as the server reports it; None — no live round.</summary>
    public enum JumperRoundStatus
    {
        None = 0,
        InGame = 1,
        Win = 2,
        Lose = 3,
    }

    /// <summary>The request a move payload answers.</summary>
    public enum JumperMove
    {
        Play = 0,
        Step = 1,
        Payout = 2,
    }

    /// <summary>One step of a free game's route: a plain jump or an accelerator.</summary>
    public enum JumperRouteAction
    {
        Step = 0,
        Trampoline = 1,
        Jetpack = 2,
        Rocket = 3,
    }

    /// <summary>Argument of <see cref="JumperWebBridge.DifficultyChanged"/>.</summary>
    public readonly struct JumperDifficultyChange
    {
        public JumperDifficultyChange(JumperDifficulty? previous, JumperDifficulty current)
        {
            Previous = previous;
            Current = current;
        }

        // null on the first difficulty after load.
        public JumperDifficulty? Previous { get; }

        public JumperDifficulty Current { get; }
    }
}
