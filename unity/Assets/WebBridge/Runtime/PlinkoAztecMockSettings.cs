using System;
using UnityEngine;

namespace Modules.PlinkoAztec
{
    /// <summary>
    /// Editor-only emulation parameters of the Plinko Aztec bridge: what the local stand-in for
    /// the platform reports as config and what the fake rounds pay. Serialized on the bridge, so
    /// every scene can tune its own board without touching code.
    /// </summary>
    [Serializable]
    public class PlinkoAztecMockSettings
    {
        [Tooltip("Slot line, left to right. A zero marks a fortune-wheel (\"spin\") slot.")]
        [SerializeField]
        private float[] _slotCoefficients =
        {
            1000f, 130f, 26f, 9f, 4f, 2f, 0.2f, 0f, 0.2f, 2f, 4f, 9f, 26f, 130f, 1000f,
        };

        [Tooltip("Balls-per-drop options the fake bet bar offers.")]
        [SerializeField] private int[] _ballsAmountOptions = { 10, 20, 50 };

        [SerializeField, Min(0f)] private float _betPerBall = 1f;
        [SerializeField] private string _currency = "USD";
        [SerializeField, Min(0)] private int _decimalPlaces = 2;

        [Tooltip("Chance that a single ball scores a bumper hit on its way down.")]
        [SerializeField, Range(0f, 1f)] private float _bumperChance = 0.25f;

        [Tooltip("Bumper hits needed to raise the bonus game one level.")]
        [SerializeField, Min(1)] private int _bonusLevelThreshold = 5;

        [Tooltip("Bonus steps a won bonus game runs before it pays out.")]
        [SerializeField, Min(1)] private int _bonusSteps = 5;

        [Tooltip("Balls thrown per bonus step on the first bonus level.")]
        [SerializeField, Min(1)] private int _bonusBallsPerStep = 3;

        [Tooltip("Multiplier the fortune wheel stops on when it does not award the bonus game.")]
        [SerializeField, Min(0f)] private float _fortuneWheelCoefficient = 2f;

        [Tooltip("Value returned for RequestWhiteLabel while there is no React around.")]
        [SerializeField] private bool _isWhiteLabel;

        public float[] SlotCoefficients => _slotCoefficients;

        public int[] BallsAmountOptions => _ballsAmountOptions;

        public int DefaultBallsAmount => _ballsAmountOptions[0];

        public float BetPerBall => _betPerBall;

        public string Currency => _currency;

        public int DecimalPlaces => _decimalPlaces;

        public float BumperChance => _bumperChance;

        public int BonusLevelThreshold => _bonusLevelThreshold;

        public int BonusSteps => _bonusSteps;

        public int BonusBallsPerStep => _bonusBallsPerStep;

        public float FortuneWheelCoefficient => _fortuneWheelCoefficient;

        public bool IsWhiteLabel => _isWhiteLabel;

        /// <summary>Index of the first spin slot, or -1 when the line has none.</summary>
        public int SpinSlotIndex => Array.FindIndex(_slotCoefficients, coefficient => coefficient <= 0f);
    }
}
