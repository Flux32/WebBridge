namespace Modules.PlinkoAztec
{
    /// <summary>
    /// What the mock host should make the next drop do. Picked in the mock debug panel so a
    /// rare presentation (wheel, bonus game, top slot) can be replayed on demand instead of
    /// waiting for the random draw to hit it.
    /// </summary>
    public enum PlinkoAztecMockScenario
    {
        /// <summary>Every ball lands by the slot-line draw.</summary>
        Random = 0,

        /// <summary>Every ball lands in the highest-paying slot.</summary>
        TopSlots = 1,

        /// <summary>Every ball lands in the lowest-paying slot.</summary>
        BottomSlots = 2,

        /// <summary>One ball lands in a spin slot, so the round ends with a fortune-wheel multiplier.</summary>
        FortuneWheel = 3,

        /// <summary>One ball lands in a spin slot and the wheel stops on the bonus-game sector.</summary>
        BonusGame = 4,
    }
}
