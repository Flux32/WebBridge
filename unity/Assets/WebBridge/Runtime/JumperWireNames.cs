using System;
using System.Collections.Generic;

namespace Modules.Jumper
{
    /// <summary>
    /// The backend's names of the jumper enums, the only form they take on the wire
    /// (protocol/src/jumper.ts). Matching is exact, like RoadDifficultyWireNames: Enum.TryParse
    /// would also take "1", "easy" or "Easy".
    /// </summary>
    public static class JumperWireNames
    {
        public static readonly JumperWireNameMap<JumperDifficulty> Difficulty =
            new JumperWireNameMap<JumperDifficulty>(
                ("EASY", JumperDifficulty.Easy),
                ("MEDIUM", JumperDifficulty.Medium),
                ("HARD", JumperDifficulty.Hard));

        public static readonly JumperWireNameMap<JumperAccelerator> Accelerator =
            new JumperWireNameMap<JumperAccelerator>(
                ("TRAMPOLINE", JumperAccelerator.Trampoline),
                ("JETPACK", JumperAccelerator.Jetpack),
                ("ROCKET", JumperAccelerator.Rocket));

        public static readonly JumperWireNameMap<JumperSlotState> SlotState =
            new JumperWireNameMap<JumperSlotState>(
                ("HIDDEN", JumperSlotState.Hidden),
                ("NONE", JumperSlotState.None),
                ("TRAMPOLINE", JumperSlotState.Trampoline),
                ("JETPACK", JumperSlotState.Jetpack),
                ("ROCKET", JumperSlotState.Rocket));

        public static readonly JumperWireNameMap<JumperRoundStatus> RoundStatus =
            new JumperWireNameMap<JumperRoundStatus>(
                ("none", JumperRoundStatus.None),
                ("in-game", JumperRoundStatus.InGame),
                ("win", JumperRoundStatus.Win),
                ("lose", JumperRoundStatus.Lose));

        public static readonly JumperWireNameMap<JumperMove> Move =
            new JumperWireNameMap<JumperMove>(
                ("play", JumperMove.Play),
                ("step", JumperMove.Step),
                ("payout", JumperMove.Payout));

        public static readonly JumperWireNameMap<JumperRouteAction> RouteAction =
            new JumperWireNameMap<JumperRouteAction>(
                ("STEP", JumperRouteAction.Step),
                ("TRAMPOLINE", JumperRouteAction.Trampoline),
                ("JETPACK", JumperRouteAction.Jetpack),
                ("ROCKET", JumperRouteAction.Rocket));
    }

    /// <summary>Two-way exact mapping between an enum and its wire names.</summary>
    public sealed class JumperWireNameMap<TEnum> where TEnum : struct, Enum
    {
        private readonly Dictionary<string, TEnum> _valuesByName =
            new Dictionary<string, TEnum>(StringComparer.Ordinal);
        private readonly Dictionary<TEnum, string> _namesByValue = new Dictionary<TEnum, string>();

        public JumperWireNameMap(params (string Name, TEnum Value)[] entries)
        {
            foreach ((string name, TEnum value) in entries)
            {
                _valuesByName.Add(name, value);
                _namesByValue.Add(value, name);
            }
        }

        public bool TryParse(string wireName, out TEnum value)
        {
            if (wireName == null)
            {
                value = default;
                return false;
            }

            return _valuesByName.TryGetValue(wireName, out value);
        }

        /// <summary>Throws <see cref="FormatException"/> on a name the protocol does not define.</summary>
        public TEnum Parse(string wireName)
        {
            if (!TryParse(wireName, out TEnum value))
                throw new FormatException($"'{wireName}' is not a jumper {typeof(TEnum).Name} wire name.");

            return value;
        }

        public string ToWireName(TEnum value)
        {
            if (!_namesByValue.TryGetValue(value, out string name))
                throw new ArgumentOutOfRangeException(nameof(value), value, $"Unknown jumper {typeof(TEnum).Name}.");

            return name;
        }
    }
}
