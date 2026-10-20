using System;

namespace Modules.Jumper
{
    /// <summary>The payloads React would build from the mock server's config and round.</summary>
    internal static class JumperMockPayloads
    {
        private const string NoAmount = "0";

        public static WebJumperGameConfigPayload BuildConfig(JumperMockSettings settings)
        {
            JumperMockLadder[] ladders = settings.Ladders;
            WebJumperLadderPayload[] payloads = new WebJumperLadderPayload[ladders.Length];
            for (int i = 0; i < ladders.Length; i++)
                payloads[i] = BuildLadder(ladders[i], settings);

            return new WebJumperGameConfigPayload { Ladders = payloads };
        }

        /// <summary>The live round, or status none when there is none — what get-game-state answers.</summary>
        public static WebJumperRoundStatePayload BuildState(JumperMockRound round, JumperDifficulty difficulty)
        {
            WebJumperRoundStatePayload state = new WebJumperRoundStatePayload();
            if (round == null)
                FillNoRound(state, difficulty);
            else
                round.FillState(state);

            return state;
        }

        public static WebJumperMovePayload BuildMove(JumperMockRound round, JumperMove move)
        {
            WebJumperMovePayload payload = new WebJumperMovePayload
            {
                MoveName = JumperWireNames.Move.ToWireName(move),
            };
            round.FillState(payload);
            return payload;
        }

        private static WebJumperLadderPayload BuildLadder(JumperMockLadder ladder, JumperMockSettings settings)
        {
            JumperAccelerator[] accelerators = JumperMockAccelerators.All;
            WebJumperAcceleratorDistancePayload[] distances =
                new WebJumperAcceleratorDistancePayload[accelerators.Length];
            for (int i = 0; i < accelerators.Length; i++)
            {
                distances[i] = new WebJumperAcceleratorDistancePayload
                {
                    AcceleratorName = JumperWireNames.Accelerator.ToWireName(accelerators[i]),
                    Steps = settings.GetDistance(accelerators[i]),
                };
            }

            return new WebJumperLadderPayload
            {
                DifficultyName = JumperWireNames.Difficulty.ToWireName(ladder.Difficulty),
                Coefficients = ladder.CopyCoefficients(),
                Accelerators = distances,
                BonusBuyMultiplier = ladder.BonusBuyMultiplier,
            };
        }

        private static void FillNoRound(WebJumperRoundStatePayload state, JumperDifficulty difficulty)
        {
            state.StatusName = JumperWireNames.RoundStatus.ToWireName(JumperRoundStatus.None);
            state.DifficultyName = JumperWireNames.Difficulty.ToWireName(difficulty);
            state.Coeff = NoAmount;
            state.WinAmount = NoAmount;
            state.Slots = Array.Empty<WebJumperSlotPayload>();
            state.LineNumber = WebJumperRoundStatePayload.StartStep;
            state.LandingStep = WebJumperRoundStatePayload.StartStep;
            state.VisitedSteps = Array.Empty<WebJumperVisitedStepPayload>();
            state.CollisionPosition = null;
        }
    }
}
