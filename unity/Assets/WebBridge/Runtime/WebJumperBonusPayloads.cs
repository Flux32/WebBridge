using System;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Jumper
{
    /// <summary>One step of a free game's route: a plain jump or an accelerator.</summary>
    [Preserve]
    [Serializable]
    public class WebJumperRoutePointPayload
    {
        [JsonName("step")]
        public int Step;

        [JsonName("action")]
        public string ActionName;

        public JumperRouteAction Action => JumperWireNames.RouteAction.Parse(ActionName);
    }

    /// <summary>
    /// One free game of the bought series. The route starts at step 0; after Step the next point
    /// is the next step, after an accelerator the step it throws the player to.
    /// </summary>
    [Preserve]
    [Serializable]
    public class WebJumperBonusGamePayload
    {
        // The step the free game ends on.
        [JsonName("finalStep")]
        public int FinalStep;

        // The game's coefficient in bets: the ladder's coefficient of FinalStep.
        [JsonName("coefficient")]
        public string Coefficient;

        [JsonName("route")]
        public WebJumperRoutePointPayload[] Route;
    }

    /// <summary>
    /// JSON of StartBonus. The server settles the whole series in one reply and pays it at once;
    /// the game plays the free games itself and reports progress with the bonus notifications.
    /// </summary>
    [Preserve]
    [Serializable]
    public class WebJumperStartBonusPayload
    {
        [JsonName("difficulty")]
        public string DifficultyName;

        // The bet one free game is played for: the price paid divided by the bonus multiplier.
        [JsonName("betAmount")]
        public string BetAmount;

        [JsonName("currency")]
        public string Currency;

        // The bet in the display currency ("$0.05"), as the cash out shows it. Empty or absent —
        // show BetAmount.
        [JsonName("displayBet")]
        public string DisplayBet;

        [JsonName("games")]
        public WebJumperBonusGamePayload[] Games;

        // The sum of the games' coefficients.
        [JsonName("totalCoefficient")]
        public string TotalCoefficient;

        [JsonName("totalWin")]
        public string TotalWin;

        public JumperDifficulty Difficulty => JumperWireNames.Difficulty.Parse(DifficultyName);
    }

    /// <summary>
    /// Body of BonusProgressSave_: how many free games of the series are played out, in the
    /// counter form every series bonus reports (road, twist). The host shows "free games left" from it.
    /// </summary>
    [Preserve]
    [Serializable]
    public class WebJumperBonusProgressPayload
    {
        [JsonName("completedIterations")]
        public int CompletedIterations;

        [JsonName("totalIterations")]
        public int TotalIterations;
    }
}
