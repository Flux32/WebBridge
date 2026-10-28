using System;
using System.Collections.Generic;
using UnityEngine.Scripting;

namespace Modules.MineSlot
{
    /// <summary>Reel symbol codes of protocol/src/mineSlot.ts and what the alphabet says about them.</summary>
    [Preserve]
    public static class MineSlotSymbols
    {
        public const char Empty = 'x';
        public const char WoodenPickaxe = '1';
        public const char StonePickaxe = '2';
        public const char GoldenPickaxe = '3';
        public const char EnchantedPickaxe = '5';

        // Falls after every pickaxe and deals DynamiteDamage around itself.
        public const char Dynamite = 'd';

        // Makes every pickaxe of its reel EnchantedStrength strong.
        public const char EnchantmentBook = 'e';

        // ScattersForBonus or more start the bonus game of FreeSpins free spins.
        public const char Scatter = 'b';

        public const int EnchantedStrength = 5;
        public const int DynamiteDamage = 2;
        public const int ScattersForBonus = 3;
        public const int FreeSpins = 4;

        public static bool IsPickaxe(char symbol) =>
            symbol == WoodenPickaxe
            || symbol == StonePickaxe
            || symbol == GoldenPickaxe
            || symbol == EnchantedPickaxe;

        /// <summary>The damage the pickaxe deals in its column, its reel's enchantment aside.</summary>
        /// <exception cref="ArgumentOutOfRangeException">The symbol is not a pickaxe.</exception>
        public static int GetPickaxeStrength(char symbol)
        {
            switch (symbol)
            {
                case WoodenPickaxe:
                    return 1;
                case StonePickaxe:
                    return 2;
                case GoldenPickaxe:
                    return 3;
                case EnchantedPickaxe:
                    return EnchantedStrength;
                default:
                    throw new ArgumentOutOfRangeException(nameof(symbol), symbol, "Not a Mine Slot pickaxe.");
            }
        }
    }

    /// <summary>A field block: the damage that breaks it and the coefficient breaking it pays.</summary>
    [Preserve]
    public readonly struct MineSlotBlock
    {
        public MineSlotBlock(char code, int durability, float coeff)
        {
            Code = code;
            Durability = durability;
            Coeff = coeff;
        }

        public char Code { get; }

        public int Durability { get; }

        public float Coeff { get; }
    }

    /// <summary>Field block codes of protocol/src/mineSlot.ts.</summary>
    [Preserve]
    public static class MineSlotBlocks
    {
        public static readonly MineSlotBlock Dirt = new MineSlotBlock('d', 1, 0f);
        public static readonly MineSlotBlock Stone = new MineSlotBlock('s', 2, 0.1f);
        public static readonly MineSlotBlock Redstone = new MineSlotBlock('r', 4, 1f);
        public static readonly MineSlotBlock Gold = new MineSlotBlock('g', 5, 3f);
        public static readonly MineSlotBlock Crystal = new MineSlotBlock('c', 6, 5f);
        public static readonly MineSlotBlock Obsidian = new MineSlotBlock('o', 7, 25f);

        public static readonly IReadOnlyList<MineSlotBlock> All =
            Array.AsReadOnly(new[] { Dirt, Stone, Redstone, Gold, Crystal, Obsidian });

        /// <exception cref="ArgumentOutOfRangeException">The code is not a Mine Slot block.</exception>
        public static MineSlotBlock Get(char code)
        {
            foreach (MineSlotBlock block in All)
            {
                if (block.Code == code)
                    return block;
            }

            throw new ArgumentOutOfRangeException(nameof(code), code, "Not a Mine Slot block code.");
        }
    }

    /// <summary>The chests under the field.</summary>
    [Preserve]
    public static class MineSlotChests
    {
        /// <summary>The multipliers a chest can hold.</summary>
        public static readonly IReadOnlyList<int> Coeffs = Array.AsReadOnly(new[] { 2, 3, 4, 5, 10, 25, 50, 100 });
    }
}
