using System;
using System.Collections.Generic;
using System.Linq;

namespace Modules.MineSlot
{
    /// <summary>
    /// The Mine Slot rules the mock host plays a reply by — a port of
    /// js/webbridge/src/mine-slot/mineSlotMockRound.ts, a simplified model of the backend, close
    /// enough for a scene to be tried on real-looking replies: per column the pickaxes fall from
    /// wooden to enchanted, then the dynamite from the left column to the right; a column broken
    /// through opens its chest, and the chests' multipliers multiply.
    /// </summary>
    internal sealed class MineSlotMockRound
    {
        private const int CoeffDecimals = 2;

        private readonly MineSlotMockField _field;
        private readonly MineSlotMockSettings _settings;
        private readonly decimal _betAmount;
        private readonly Random _random;
        private readonly List<MineSlotHitPayload> _pickaxes = new List<MineSlotHitPayload>();
        private readonly List<MineSlotHitPayload> _tnt = new List<MineSlotHitPayload>();
        private readonly List<MineSlotChestPayload> _chests = new List<MineSlotChestPayload>();

        private MineSlotMockRound(string field, MineSlotMockSettings settings, Random random)
        {
            _settings = settings;
            _betAmount = settings.BetAmount;
            _random = random;
            _field = new MineSlotMockField(field, _betAmount, settings);
        }

        public MineSlotHitPayload[] Pickaxes => _pickaxes.ToArray();

        public MineSlotHitPayload[] Tnt => _tnt.ToArray();

        public MineSlotChestPayload[] Chests => _chests.ToArray();

        /// <summary>The blocks' coefficients times every chest's multiplier.</summary>
        public decimal Coeff
        {
            get
            {
                decimal multiplier = 1m;
                foreach (MineSlotChestPayload chest in _chests)
                    multiplier *= (decimal)chest.Coeff;

                return Math.Round(_field.PaidCoeff * multiplier, CoeffDecimals);
            }
        }

        /// <summary>Plays every board on one field, in order, as the bonus game does.</summary>
        public static MineSlotMockRound Play(
            IReadOnlyList<string> boards, string field, MineSlotMockSettings settings, Random random)
        {
            MineSlotMockRound round = new MineSlotMockRound(field, settings, random);
            for (int i = 0; i < boards.Count; i++)
                round.PlayBoard(i, boards[i]);

            return round;
        }

        private void PlayBoard(int round, string board)
        {
            for (int reel = 0; reel < MineSlotReels.Count; reel++)
                DropPickaxes(round, board, reel);

            for (int cell = 0; cell < board.Length; cell++)
            {
                if (board[cell] == MineSlotSymbols.Dynamite)
                    _tnt.Add(CreateHit(round, cell, Blast(MineSlotReels.ReelOf(cell))));
            }

            OpenChests();
        }

        private void DropPickaxes(int round, string board, int reel)
        {
            int[] cells = Enumerable.Range(0, MineSlotReels.Rows)
                .Select(row => MineSlotReels.CellIndex(reel, row))
                .ToArray();
            bool isEnchanted = cells.Any(cell => board[cell] == MineSlotSymbols.EnchantmentBook);
            IEnumerable<int> pickaxeCells = cells
                .Where(cell => MineSlotSymbols.IsPickaxe(board[cell]))
                .OrderBy(cell => MineSlotSymbols.GetPickaxeStrength(board[cell]));

            foreach (int cell in pickaxeCells)
            {
                int strength = isEnchanted
                    ? MineSlotSymbols.EnchantedStrength
                    : MineSlotSymbols.GetPickaxeStrength(board[cell]);
                _pickaxes.Add(CreateHit(round, cell, Dig(reel, strength)));
            }
        }

        private MineSlotBrokenBlockPayload[] Dig(int column, int strength)
        {
            List<MineSlotBrokenBlockPayload> broken = new List<MineSlotBrokenBlockPayload>();
            int left = strength;
            for (int? cell = _field.TopOf(column); cell.HasValue && left > 0; cell = _field.TopOf(column))
            {
                MineSlotBrokenBlockPayload block = _field.Hit(cell.Value, left);
                broken.Add(block);
                left -= block.Damage;
            }

            return broken.ToArray();
        }

        private MineSlotBrokenBlockPayload[] Blast(int column)
        {
            List<MineSlotBrokenBlockPayload> broken = new List<MineSlotBrokenBlockPayload>();
            foreach (int target in new[] { column, column - 1, column + 1 })
            {
                if (target < 0 || target >= MineSlotField.Columns)
                    continue;

                int? cell = _field.TopOf(target);
                if (cell.HasValue)
                    broken.Add(_field.Hit(cell.Value, MineSlotSymbols.DynamiteDamage));
            }

            return broken.ToArray();
        }

        private void OpenChests()
        {
            for (int column = 0; column < MineSlotField.Columns; column++)
            {
                if (!_field.IsBrokenThrough(column) || _chests.Any(chest => chest.Column == column))
                    continue;

                int coeff = MineSlotChests.Coeffs[_random.Next(MineSlotChests.Coeffs.Count)];
                _chests.Add(new MineSlotChestPayload
                {
                    Column = column,
                    Coeff = coeff,
                    Payout = _settings.FormatAmount(coeff * _betAmount),
                });
            }
        }

        private static MineSlotHitPayload CreateHit(int round, int cell, MineSlotBrokenBlockPayload[] brokenBlocks) =>
            new MineSlotHitPayload { Round = round, Index = cell, BrokenBlocks = brokenBlocks };
    }
}
