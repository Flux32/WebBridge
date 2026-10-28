using System;
using System.Globalization;
using UnityEngine;

namespace Modules.MineSlot
{
    /// <summary>
    /// Mock-mode emulation parameters of the Mine Slot bridge: the bet the stand-in for the
    /// platform plays and how it formats money. Serialized on the bridge, so every scene can tune
    /// its own without touching code.
    /// </summary>
    [Serializable]
    public class MineSlotMockSettings
    {
        [Tooltip("The bet as the backend formats it (\"1\", \"0.5\").")]
        [SerializeField] private string _betAmount = "1";
        [SerializeField] private string _currency = "USD";
        [SerializeField, Min(0)] private int _decimalPlaces = 2;

        [Tooltip("Value returned for RequestWhiteLabel while there is no React around.")]
        [SerializeField] private bool _isWhiteLabel;

        public decimal BetAmount =>
            decimal.Parse(_betAmount, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture);

        public string Currency => _currency;

        public int DecimalPlaces => _decimalPlaces;

        public bool IsWhiteLabel => _isWhiteLabel;

        public string FormatAmount(decimal amount) =>
            amount.ToString($"F{_decimalPlaces}", CultureInfo.InvariantCulture);
    }
}
