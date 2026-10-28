using System;
using System.Collections.Generic;
using WebBridge;

namespace Modules.MineSlot
{
    /// <summary>The JSON the platform would answer with, built from the mock's boards and rules.</summary>
    internal static class MineSlotMockReplies
    {
        private const string StatusIdle = "none";
        private const string StatusWin = "win";
        private const string StatusLose = "lose";

        public static string BuildConfig(MineSlotMockSettings settings)
        {
            JsonValue config = JsonValue.NewObject();
            config["currency"] = settings.Currency;
            return config.ToJsonString();
        }

        /// <summary>What get-game-state answers between rounds: a spin settles at once, so nothing is open.</summary>
        public static string BuildIdleState()
        {
            JsonValue state = JsonValue.NewObject();
            state["status"] = StatusIdle;
            return state.ToJsonString();
        }

        /// <summary>
        /// The play reply of one spin. A base board with three scatters, or a bought bonus, comes back
        /// as the base spin plus the free spins, all on one field.
        /// </summary>
        public static WebMineSlotSpinResultPayload BuildSpinResult(
            string baseBoard, MineSlotMockSettings settings, Random random)
        {
            List<string> boards = new List<string> { baseBoard };
            if (MineSlotMockBoards.StartsBonus(baseBoard))
            {
                for (int i = 0; i < MineSlotSymbols.FreeSpins; i++)
                    boards.Add(MineSlotMockBoards.DealBoard(random));
            }

            string field = MineSlotMockBoards.DealField(random);
            MineSlotMockRound round = MineSlotMockRound.Play(boards, field, settings, random);
            return Settle(round, boards, field, settings);
        }

        private static WebMineSlotSpinResultPayload Settle(
            MineSlotMockRound round, List<string> boards, string field, MineSlotMockSettings settings)
        {
            decimal coeff = round.Coeff;
            bool isWin = coeff > 0m;
            string betAmount = settings.FormatAmount(settings.BetAmount);

            return new WebMineSlotSpinResultPayload
            {
                Status = isWin ? StatusWin : StatusLose,
                Bet = new WebBetPayload
                {
                    Amount = betAmount,
                    Currency = settings.Currency,
                    DecimalPlaces = settings.DecimalPlaces,
                },
                IsFinished = true,
                IsWin = isWin,
                WinAmount = settings.FormatAmount(coeff * settings.BetAmount),
                BetAmount = betAmount,
                Currency = settings.Currency,
                Coeff = (float)coeff,
                Rounds = boards.Count,
                Boards = boards.ToArray(),
                Field = field,
                Pickaxes = round.Pickaxes,
                Tnt = round.Tnt,
                Chests = round.Chests,
            };
        }
    }
}
