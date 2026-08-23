using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Road
{
    // Road-specific debug string builders. Kept out of the shared WebBridgeUtils so the common
    // layer stays free of gameplay payload dependencies.
    [Preserve]
    public static class RoadBridgeDebug
    {
        public static string BuildConfigDebugInfo(WebGameConfigPayload config)
        {
            if (config == null)
                return "null";

            int coeffsCount = config.Coefficients?.Length ?? 0;
            int bonusCountEntries = config.BonusCounts?.Count ?? 0;
            string bonusCounts = FormatBonusCounts(config.BonusCounts);
            string minBet = config.MinBetAmount.HasValue
                ? config.MinBetAmount.Value.ToString(CultureInfo.InvariantCulture)
                : "null";
            string maxBet = config.MaxBetAmount.HasValue
                ? config.MaxBetAmount.Value.ToString(CultureInfo.InvariantCulture)
                : "null";
            return $"coefficientsCount={coeffsCount}; bonusCountsEntries={bonusCountEntries}; bonusCounts={bonusCounts}; minBet={minBet}; maxBet={maxBet}";
        }

        public static string BuildStateDebugInfo(WebGameStatePayload state)
        {
            if (state == null)
                return "null";

            string coins = WebBridgeUtils.FormatIntArray(state.BonusStepsCollected);
            string bonusGame = FormatBonusGame(state.BonusGame);
            string isWinMain = state.IsWinMain.HasValue ? state.IsWinMain.Value.ToString() : "null";
            string coinsTriggered = state.BonusStepTriggered.HasValue
                ? state.BonusStepTriggered.Value.ToString()
                : "null";
            string status = string.IsNullOrWhiteSpace(state.Status) ? "null" : state.Status;
            string lineNumber = state.Step.HasValue ? state.Step.Value.ToString() : "null";
            return $"status={status}; lineNumber={lineNumber}; isWinMain={isWinMain}; coinsTriggered={coinsTriggered}; coinsCollected={coins}; bonusGame={bonusGame}";
        }

        public static string FormatBonusCounts(IReadOnlyDictionary<string, int> bonusCounts)
        {
            if (bonusCounts == null || bonusCounts.Count == 0)
                return "{}";

            return "{" + string.Join(", ", bonusCounts.Select(pair => $"{pair.Key}:{pair.Value}")) + "}";
        }

        public static string FormatBonusGame(WebBonusGamePayload bonusGame)
        {
            if (bonusGame == null)
                return "null";

            string positions = WebBridgeUtils.FormatIntArray(bonusGame.BonusPositions);
            return $"{{coeff={bonusGame.BonusTotalCoefficient.ToString(CultureInfo.InvariantCulture)}, " +
                   $"win={bonusGame.BonusTotalWin}, positions={positions}}}";
        }
    }
}
