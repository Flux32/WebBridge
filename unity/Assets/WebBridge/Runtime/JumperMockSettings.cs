using System;
using System.Globalization;
using UnityEngine;

namespace Modules.Jumper
{
    /// <summary>
    /// Mock-mode emulation parameters of the jumper bridge: the ladders the stand-in for the
    /// platform reports and how its fake rounds play out. Serialized on the bridge, so every scene
    /// can tune its own ladder without touching code.
    /// </summary>
    [Serializable]
    public class JumperMockSettings
    {
        [SerializeField]
        private JumperMockLadder[] _ladders =
        {
            new JumperMockLadder(JumperDifficulty.Easy, 40, 1.02f, 1.08f, 100f),
            new JumperMockLadder(JumperDifficulty.Medium, 38, 1.1f, 1.13f, 100f),
            new JumperMockLadder(JumperDifficulty.Hard, 35, 1.2f, 1.2f, 100f),
        };

        [SerializeField] private JumperDifficulty _defaultDifficulty = JumperDifficulty.Easy;

        [Header("Accelerators (steps thrown)")]
        [SerializeField, Min(1)] private int _trampolineSteps = 2;
        [SerializeField, Min(1)] private int _jetpackSteps = 4;
        [SerializeField, Min(1)] private int _rocketSteps = 8;

        [Header("Round")]
        [Tooltip("Share of the ladder's steps that carry an accelerator slot.")]
        [SerializeField, Range(0f, 1f)] private float _slotChance = 0.3f;
        [Tooltip("Share of the slots that reveal as empty (NONE).")]
        [SerializeField, Range(0f, 1f)] private float _emptySlotChance = 0.3f;
        [Tooltip("Chance that the player falls where a jump lands.")]
        [SerializeField, Range(0f, 1f)] private float _loseChance = 0.15f;

        [Header("Bet")]
        [Tooltip("The bet as the backend formats it (\"1\", \"0.5\").")]
        [SerializeField] private string _betAmount = "1";
        [SerializeField] private string _currency = "USD";
        [SerializeField, Min(0)] private int _decimalPlaces = 2;

        [Header("Bonus")]
        [Tooltip("Free games in a bought series.")]
        [SerializeField, Min(1)] private int _bonusGames = 3;

        [Tooltip("Value returned for RequestWhiteLabel while there is no React around.")]
        [SerializeField] private bool _isWhiteLabel;

        public JumperMockLadder[] Ladders => _ladders;

        public JumperDifficulty DefaultDifficulty => _defaultDifficulty;

        public float SlotChance => _slotChance;

        public float EmptySlotChance => _emptySlotChance;

        public float LoseChance => _loseChance;

        public decimal BetAmount =>
            decimal.Parse(_betAmount, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture);

        public string Currency => _currency;

        public int BonusGames => _bonusGames;

        public bool IsWhiteLabel => _isWhiteLabel;

        public JumperMockLadder GetLadder(JumperDifficulty difficulty)
        {
            foreach (JumperMockLadder ladder in _ladders)
            {
                if (ladder.Difficulty == difficulty)
                    return ladder;
            }

            throw new InvalidOperationException($"Jumper mock settings have no {difficulty} ladder.");
        }

        public int GetDistance(JumperAccelerator accelerator)
        {
            switch (accelerator)
            {
                case JumperAccelerator.Trampoline:
                    return _trampolineSteps;
                case JumperAccelerator.Jetpack:
                    return _jetpackSteps;
                case JumperAccelerator.Rocket:
                    return _rocketSteps;
                default:
                    throw new ArgumentOutOfRangeException(
                        nameof(accelerator), accelerator, "Unknown jumper accelerator.");
            }
        }

        public string FormatAmount(decimal amount) =>
            amount.ToString($"F{_decimalPlaces}", CultureInfo.InvariantCulture);
    }
}
