using System;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.MineSlot
{
    /// <summary>
    /// The Mine Slot play reply as the server sends it (protocol/src/mineSlot.ts MineSlotSpinResult):
    /// the GameState base plus the mode's fields on the top level. One reply carries the whole round —
    /// the base spin and, after three scatters or a bought bonus, every free spin, all on one field.
    /// get-game-state answers the same shape; an idle one (status none) has no rounds. Money stays the
    /// platform's decimal string.
    /// </summary>
    [Preserve]
    [Serializable]
    public class WebMineSlotSpinResultPayload : WebGameStateBase
    {
        [JsonName("betAmount")]
        public string BetAmount;

        [JsonName("currency")]
        public string Currency;

        // Coefficient of the whole reply: the blocks' coefficients times every chest's.
        [JsonName("coeff")]
        public float? Coeff;

        // 1 for a plain spin; the base spin plus the free spins when a bonus game played.
        [JsonName("rounds")]
        public int Rounds;

        // One 15-symbol string per round, see MineSlotReels and MineSlotSymbols.
        [JsonName("boards")]
        public string[] Boards = Array.Empty<string>();

        // The 30 blocks as they stood when the reply's first round began, see MineSlotField and
        // MineSlotBlocks. It is not regenerated between free spins.
        [JsonName("field")]
        public string Field;

        // Every pickaxe fall in the order of play: per column from wooden to enchanted.
        [JsonName("pickaxes")]
        public MineSlotHitPayload[] Pickaxes = Array.Empty<MineSlotHitPayload>();

        // Every dynamite fall, after the round's pickaxes, from the left column to the right.
        [JsonName("tnt")]
        public MineSlotHitPayload[] Tnt = Array.Empty<MineSlotHitPayload>();

        [JsonName("chests")]
        public MineSlotChestPayload[] Chests = Array.Empty<MineSlotChestPayload>();

        public char GetBoardSymbol(int round, int reel, int row) => Boards[round][MineSlotReels.CellIndex(reel, row)];

        public char GetFieldBlock(int column, int level) => Field[MineSlotField.CellIndex(column, level)];
    }

    /// <summary>A pickaxe's or a dynamite's fall and the blocks it damaged, top to bottom.</summary>
    [Preserve]
    [Serializable]
    public class MineSlotHitPayload
    {
        // Index into Boards: the round the symbol landed in.
        [JsonName("round")]
        public int Round;

        // Board cell of the symbol, reel * rows + row.
        [JsonName("index")]
        public int Index;

        [JsonName("brokenBlocks")]
        public MineSlotBrokenBlockPayload[] BrokenBlocks = Array.Empty<MineSlotBrokenBlockPayload>();

        public int Reel => MineSlotReels.ReelOf(Index);

        public int Row => MineSlotReels.RowOf(Index);
    }

    /// <summary>Damage to one block. Coeff and Payout come only with the hit that breaks the block.</summary>
    [Preserve]
    [Serializable]
    public class MineSlotBrokenBlockPayload
    {
        // Field cell, column * depth + level.
        [JsonName("index")]
        public int Index;

        [JsonName("damage")]
        public int Damage;

        [JsonName("coeff")]
        public float? Coeff;

        [JsonName("payout")]
        public string Payout;

        public int Column => MineSlotField.ColumnOf(Index);

        public int Level => MineSlotField.LevelOf(Index);
    }

    /// <summary>A chest reached by breaking a column through.</summary>
    [Preserve]
    [Serializable]
    public class MineSlotChestPayload
    {
        [JsonName("col")]
        public int Column;

        [JsonName("coeff")]
        public float Coeff;

        [JsonName("payout")]
        public string Payout;
    }
}
