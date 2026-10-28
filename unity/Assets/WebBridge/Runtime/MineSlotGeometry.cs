using System;
using UnityEngine.Scripting;

namespace Modules.MineSlot
{
    /// <summary>
    /// The 5 × 3 reels of protocol/src/mineSlot.ts. A board string is column-major: cell
    /// <c>reel * Rows + row</c>, the top row first.
    /// </summary>
    [Preserve]
    public static class MineSlotReels
    {
        public const int Count = 5;
        public const int Rows = 3;
        public const int Cells = Count * Rows;

        /// <exception cref="ArgumentOutOfRangeException">The reel or the row is off the board.</exception>
        public static int CellIndex(int reel, int row)
        {
            MineSlotRange.Require(reel, Count, nameof(reel));
            MineSlotRange.Require(row, Rows, nameof(row));
            return reel * Rows + row;
        }

        public static int ReelOf(int cell)
        {
            MineSlotRange.Require(cell, Cells, nameof(cell));
            return cell / Rows;
        }

        public static int RowOf(int cell)
        {
            MineSlotRange.Require(cell, Cells, nameof(cell));
            return cell % Rows;
        }
    }

    /// <summary>
    /// The 5 × 6 field of blocks under the reels, one column per reel. A field string is
    /// column-major: cell <c>column * Depth + level</c>, the top block first.
    /// </summary>
    [Preserve]
    public static class MineSlotField
    {
        public const int Columns = MineSlotReels.Count;
        public const int Depth = 6;
        public const int Cells = Columns * Depth;

        /// <exception cref="ArgumentOutOfRangeException">The column or the level is off the field.</exception>
        public static int CellIndex(int column, int level)
        {
            MineSlotRange.Require(column, Columns, nameof(column));
            MineSlotRange.Require(level, Depth, nameof(level));
            return column * Depth + level;
        }

        public static int ColumnOf(int cell)
        {
            MineSlotRange.Require(cell, Cells, nameof(cell));
            return cell / Depth;
        }

        public static int LevelOf(int cell)
        {
            MineSlotRange.Require(cell, Cells, nameof(cell));
            return cell % Depth;
        }
    }

    internal static class MineSlotRange
    {
        // A coordinate past its axis would silently address a neighbouring reel or column.
        public static void Require(int value, int count, string name)
        {
            if (value < 0 || value >= count)
                throw new ArgumentOutOfRangeException(name, value, $"Expected 0..{count - 1}.");
        }
    }
}
