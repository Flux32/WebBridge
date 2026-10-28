using System;

namespace Modules.MineSlot
{
    /// <summary>
    /// Boards and fields the mock host deals, in the backend's alphabet (a port of
    /// js/webbridge/src/mine-slot/mineSlotMockBoards.ts): empty cells most of the time, pickaxes
    /// rarer the stronger they are, and a field that gets harder the deeper it goes.
    /// </summary>
    internal static class MineSlotMockBoards
    {
        private static readonly char[] Symbols =
        {
            MineSlotSymbols.Empty,
            MineSlotSymbols.WoodenPickaxe,
            MineSlotSymbols.StonePickaxe,
            MineSlotSymbols.GoldenPickaxe,
            MineSlotSymbols.EnchantedPickaxe,
            MineSlotSymbols.Dynamite,
            MineSlotSymbols.EnchantmentBook,
            MineSlotSymbols.Scatter,
        };

        // Weight of the symbol at the same index of Symbols; they sum to 100.
        private static readonly int[] SymbolWeights = { 52, 16, 10, 6, 3, 5, 3, 5 };

        // Blocks a level may hold, top to bottom: dirt on top, obsidian at the bottom now and then.
        private static readonly char[][] LevelBlocks =
        {
            new[] { MineSlotBlocks.Dirt.Code },
            new[] { MineSlotBlocks.Dirt.Code, MineSlotBlocks.Stone.Code },
            new[] { MineSlotBlocks.Stone.Code },
            new[] { MineSlotBlocks.Stone.Code, MineSlotBlocks.Redstone.Code },
            new[] { MineSlotBlocks.Redstone.Code, MineSlotBlocks.Gold.Code, MineSlotBlocks.Crystal.Code },
            new[] { MineSlotBlocks.Gold.Code, MineSlotBlocks.Crystal.Code, MineSlotBlocks.Obsidian.Code },
        };

        private static readonly int TotalWeight = Sum(SymbolWeights);

        public static string DealBoard(Random random)
        {
            char[] cells = new char[MineSlotReels.Cells];
            for (int cell = 0; cell < cells.Length; cell++)
                cells[cell] = DealSymbol(random);

            return new string(cells);
        }

        /// <summary>A base board that starts the bonus game: scatters on the top row of the first reels.</summary>
        public static string DealBonusBoard(Random random)
        {
            char[] cells = DealBoard(random).ToCharArray();
            for (int reel = 0; reel < MineSlotSymbols.ScattersForBonus; reel++)
                cells[MineSlotReels.CellIndex(reel, 0)] = MineSlotSymbols.Scatter;

            return new string(cells);
        }

        public static string DealField(Random random)
        {
            char[] cells = new char[MineSlotField.Cells];
            for (int column = 0; column < MineSlotField.Columns; column++)
            {
                for (int level = 0; level < MineSlotField.Depth; level++)
                {
                    char[] choices = LevelBlocks[level];
                    cells[MineSlotField.CellIndex(column, level)] = choices[random.Next(choices.Length)];
                }
            }

            return new string(cells);
        }

        public static bool StartsBonus(string board)
        {
            int scatters = 0;
            foreach (char symbol in board)
            {
                if (symbol == MineSlotSymbols.Scatter)
                    scatters++;
            }

            return scatters >= MineSlotSymbols.ScattersForBonus;
        }

        private static char DealSymbol(Random random)
        {
            int roll = random.Next(TotalWeight);
            for (int i = 0; i < Symbols.Length; i++)
            {
                roll -= SymbolWeights[i];
                if (roll < 0)
                    return Symbols[i];
            }

            throw new InvalidOperationException($"Roll past the total symbol weight {TotalWeight}.");
        }

        private static int Sum(int[] values)
        {
            int sum = 0;
            foreach (int value in values)
                sum += value;

            return sum;
        }
    }
}
