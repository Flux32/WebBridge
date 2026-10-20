namespace Modules.Road
{
    /// <summary>
    /// Wire form of the RestartRound command every round-based bridge receives: "&lt;reason&gt;|&lt;amount&gt;"
    /// (e.g. "cashout|$5.00", "lose|"). The amount is React's display string, kept as is.
    /// </summary>
    public static class RestartRoundPayload
    {
        private const char Separator = '|';

        // Empty or null payload -> RestartReason.None without an amount.
        public static void Parse(string payload, out RestartReason reason, out string amount)
        {
            reason = RestartReason.None;
            amount = null;

            if (string.IsNullOrWhiteSpace(payload))
                return;

            string reasonToken = payload;
            int separatorIndex = payload.IndexOf(Separator);
            if (separatorIndex >= 0)
            {
                reasonToken = payload.Substring(0, separatorIndex);
                amount = payload.Substring(separatorIndex + 1);
            }

            switch (reasonToken.Trim().ToLowerInvariant())
            {
                case "win": reason = RestartReason.Win; break;
                case "cashout": reason = RestartReason.Cashout; break;
                case "lose": reason = RestartReason.Lose; break;
                default: reason = RestartReason.None; break;
            }
        }
    }
}
