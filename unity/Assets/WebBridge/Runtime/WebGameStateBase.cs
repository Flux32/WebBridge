using System;
using UnityEngine.Scripting;

namespace WebBridge
{
    // Bet parameters shared by every platform game (mirrors client-core GameState.bet).
    [Preserve]
    [Serializable]
    public class WebBetPayload
    {
        [JsonName("amount")]
        public string Amount;

        [JsonName("currency")]
        public string Currency;

        [JsonName("decimalPlaces")]
        public int? DecimalPlaces;
    }

    // Base game-state fields common to every platform game (mirrors the client-core GameState
    // base). Per-game bridges derive their own state payload and add the game-specific fields
    // that the platform delivers as extendGameState on the top level.
    [Preserve]
    [Serializable]
    public abstract class WebGameStateBase
    {
        [JsonName("status")]
        public string Status;

        [JsonName("bet")]
        public WebBetPayload Bet;

        [JsonName("isFinished")]
        public bool? IsFinished;

        [JsonName("isWin")]
        public bool? IsWin;

        [JsonName("winAmount")]
        public string WinAmount;

        [JsonName("error")]
        public string Error;
    }
}
