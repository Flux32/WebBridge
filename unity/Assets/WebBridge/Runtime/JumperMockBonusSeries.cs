using System;
using System.Collections.Generic;
using System.Globalization;

namespace Modules.Jumper
{
    /// <summary>
    /// A bought bonus series as the dev game server settles it: every free game at once, each with
    /// its final step, that step's coefficient and the route to it. A route lists only the platforms
    /// jumped from, starting at step 0: after STEP the next point is the next step, after an
    /// accelerator the step it throws the player to, and the last jump lands on the final step,
    /// which has no point of its own.
    /// </summary>
    internal static class JumperMockBonusSeries
    {
        private const string CoefficientFormat = "0.00";

        // Every free game makes at least the jump from step 0, so it cannot end below step 1.
        private const int LowestFinalStep = 1;

        public static WebJumperStartBonusPayload Build(
            JumperDifficulty difficulty,
            JumperMockSettings settings,
            Random random)
        {
            string[] coefficients = settings.GetLadder(difficulty).CopyCoefficients();
            WebJumperBonusGamePayload[] games = new WebJumperBonusGamePayload[settings.BonusGames];
            decimal totalCoefficient = 0m;

            for (int i = 0; i < games.Length; i++)
            {
                int finalStep = random.Next(LowestFinalStep, coefficients.Length);
                games[i] = new WebJumperBonusGamePayload
                {
                    FinalStep = finalStep,
                    Coefficient = coefficients[finalStep],
                    Route = BuildRoute(finalStep, settings, random),
                };
                totalCoefficient += decimal.Parse(coefficients[finalStep], CultureInfo.InvariantCulture);
            }

            decimal betAmount = settings.BetAmount;
            return new WebJumperStartBonusPayload
            {
                DifficultyName = JumperWireNames.Difficulty.ToWireName(difficulty),
                BetAmount = settings.FormatAmount(betAmount),
                Currency = settings.Currency,
                DisplayBet = string.Empty,
                Games = games,
                TotalCoefficient = totalCoefficient.ToString(CoefficientFormat, CultureInfo.InvariantCulture),
                TotalWin = settings.FormatAmount(betAmount * totalCoefficient),
            };
        }

        private static WebJumperRoutePointPayload[] BuildRoute(
            int finalStep,
            JumperMockSettings settings,
            Random random)
        {
            List<WebJumperRoutePointPayload> route = new List<WebJumperRoutePointPayload>();
            int step = 0;

            do
            {
                JumperRouteAction action = PickAction(finalStep - step, settings, random, out int distance);
                route.Add(CreatePoint(step, action));
                step += distance;
            }
            while (step < finalStep);

            return route.ToArray();
        }

        // An accelerator only where its throw does not overshoot: the last jump lands on finalStep.
        private static JumperRouteAction PickAction(
            int stepsLeft,
            JumperMockSettings settings,
            Random random,
            out int distance)
        {
            distance = 1;
            if (random.NextDouble() >= settings.SlotChance)
                return JumperRouteAction.Step;

            JumperAccelerator accelerator = JumperMockAccelerators.Pick(random);
            int acceleratorDistance = settings.GetDistance(accelerator);
            if (acceleratorDistance > stepsLeft)
                return JumperRouteAction.Step;

            distance = acceleratorDistance;
            return JumperMockAccelerators.ToRouteAction(accelerator);
        }

        private static WebJumperRoutePointPayload CreatePoint(int step, JumperRouteAction action) =>
            new WebJumperRoutePointPayload
            {
                Step = step,
                ActionName = JumperWireNames.RouteAction.ToWireName(action),
            };
    }
}
