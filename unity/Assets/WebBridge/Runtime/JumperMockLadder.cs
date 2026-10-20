using System;
using System.Globalization;
using UnityEngine;

namespace Modules.Jumper
{
    /// <summary>
    /// One difficulty's ladder in mock mode. The coefficients grow geometrically from the first
    /// step; the step counts match the dev server (EASY 40, MEDIUM 38, HARD 35), the values are
    /// illustrative — the real tables come from the server's get-game-config.
    /// </summary>
    [Serializable]
    public class JumperMockLadder
    {
        private const int CoefficientDecimals = 2;

        [SerializeField] private JumperDifficulty _difficulty;
        [SerializeField, Min(2)] private int _stepCount;
        [SerializeField, Min(1f)] private float _firstCoefficient;
        [SerializeField, Min(1f)] private float _growth;
        [Tooltip("The bonus price in bets.")]
        [SerializeField, Min(1f)] private float _bonusBuyMultiplier;

        // Unity's serializer creates the element when the array grows in the inspector.
        public JumperMockLadder()
        {
        }

        public JumperMockLadder(
            JumperDifficulty difficulty,
            int stepCount,
            float firstCoefficient,
            float growth,
            float bonusBuyMultiplier)
        {
            _difficulty = difficulty;
            _stepCount = stepCount;
            _firstCoefficient = firstCoefficient;
            _growth = growth;
            _bonusBuyMultiplier = bonusBuyMultiplier;
        }

        public JumperDifficulty Difficulty => _difficulty;

        public float BonusBuyMultiplier => _bonusBuyMultiplier;

        /// <summary>The coefficient of each step by its index, as the server's decimal strings.</summary>
        public string[] BuildCoefficients()
        {
            string[] coefficients = new string[_stepCount];
            for (int step = 0; step < _stepCount; step++)
            {
                decimal coefficient = (decimal)(_firstCoefficient * Math.Pow(_growth, step));
                coefficients[step] = Math.Round(coefficient, CoefficientDecimals)
                    .ToString("0.00", CultureInfo.InvariantCulture);
            }

            return coefficients;
        }
    }
}
