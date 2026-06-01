namespace Modules.Road
{
    /// <summary>
    /// Why the round is being restarted, passed by React in the RestartRound payload.
    /// Lets the game decide what to show before re-arming (e.g. a win table on cashout/win).
    /// </summary>
    public enum RestartReason
    {
        None = 0,
        Win = 1,
        Cashout = 2,
        Lose = 3,
    }
}
