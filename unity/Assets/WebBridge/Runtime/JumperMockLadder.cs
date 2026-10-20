using System;
using UnityEngine;

namespace Modules.Jumper
{
    /// <summary>One difficulty's ladder in mock mode, as the server's get-game-config reports it.</summary>
    [Serializable]
    public class JumperMockLadder
    {
        [SerializeField] private JumperDifficulty _difficulty;

        [Tooltip("The coefficient of each step by its index, as the server's decimal strings.")]
        [SerializeField] private string[] _coefficients;

        [Tooltip("The bonus price in bets.")]
        [SerializeField, Min(1f)] private float _bonusBuyMultiplier;

        // Unity's serializer creates the element when the array grows in the inspector.
        public JumperMockLadder()
        {
        }

        public JumperMockLadder(JumperDifficulty difficulty, string[] coefficients, float bonusBuyMultiplier)
        {
            _difficulty = difficulty;
            _coefficients = coefficients;
            _bonusBuyMultiplier = bonusBuyMultiplier;
        }

        public JumperDifficulty Difficulty => _difficulty;

        public float BonusBuyMultiplier => _bonusBuyMultiplier;

        /// <summary>A copy, so a payload built from it cannot change the settings.</summary>
        public string[] CopyCoefficients() => (string[])_coefficients.Clone();
    }
}
