using System;

namespace Modules.MineSlot
{
    /// <summary>
    /// The field of blocks as the mock rounds dig it: what is left of every block's durability and
    /// the coefficient the broken blocks have paid so far. It lives through every round of a reply,
    /// as the bonus game's field does.
    /// </summary>
    internal sealed class MineSlotMockField
    {
        private readonly string _codes;
        private readonly int[] _durability;
        private readonly decimal _betAmount;
        private readonly MineSlotMockSettings _settings;

        public MineSlotMockField(string codes, decimal betAmount, MineSlotMockSettings settings)
        {
            _codes = codes;
            _betAmount = betAmount;
            _settings = settings;
            _durability = new int[codes.Length];
            for (int cell = 0; cell < codes.Length; cell++)
                _durability[cell] = MineSlotBlocks.Get(codes[cell]).Durability;
        }

        public decimal PaidCoeff { get; private set; }

        public bool IsBrokenThrough(int column) => !TopOf(column).HasValue;

        /// <summary>The top block of the column still standing, or null once it is broken through.</summary>
        public int? TopOf(int column)
        {
            for (int level = 0; level < MineSlotField.Depth; level++)
            {
                int cell = MineSlotField.CellIndex(column, level);
                if (_durability[cell] > 0)
                    return cell;
            }

            return null;
        }

        /// <summary>Deals up to <paramref name="damage"/> to a standing block; the hit that breaks it pays.</summary>
        /// <exception cref="InvalidOperationException">The block is already broken.</exception>
        public MineSlotBrokenBlockPayload Hit(int cell, int damage)
        {
            if (_durability[cell] == 0)
                throw new InvalidOperationException($"Field cell {cell} is already broken.");

            int dealt = Math.Min(_durability[cell], damage);
            _durability[cell] -= dealt;
            MineSlotBrokenBlockPayload hit = new MineSlotBrokenBlockPayload { Index = cell, Damage = dealt };

            MineSlotBlock block = MineSlotBlocks.Get(_codes[cell]);
            if (_durability[cell] > 0 || block.Coeff <= 0f)
                return hit;

            decimal coeff = (decimal)block.Coeff;
            PaidCoeff += coeff;
            hit.Coeff = block.Coeff;
            hit.Payout = _settings.FormatAmount(coeff * _betAmount);
            return hit;
        }
    }
}
