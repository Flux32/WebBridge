using System;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Plinko
{
    // Plinko game state. Base fields (status/bet/isFinished/isWin/winAmount) come from
    // WebGameStateBase; the fields below are the Plinko extendGameState delivered on the top
    // level of the GameState object (see Plinko WebSocket API).
    [Preserve]
    [Serializable]
    public class WebPlinkoStatePayload : WebGameStateBase
    {
        // Final coefficient of the round. Present when the round resolves.
        [JsonName("coeff")]
        public float? Coeff;

        // Index of the slot the ball landed in (0-based). Present when the round resolves.
        [JsonName("resultPosition")]
        public int? ResultPosition;

        // Risk level of the round: LOW, MEDIUM or HIGH. Present when the round resolves.
        [JsonName("risk")]
        public string Risk;

        // Top-level duplicates the platform also sends alongside the bet object.
        [JsonName("betAmount")]
        public string BetAmount;

        [JsonName("currency")]
        public string Currency;
    }

    // Plinko game configuration. Common bet limits plus the per-risk coefficient table used to
    // build the board. Coefficients are kept as a raw JsonValue because their shape is owned by
    // the platform config; read a concrete row with GetCoefficients(risk).
    [Preserve]
    [Serializable]
    public class WebPlinkoConfigPayload
    {
        [JsonName("currency")]
        public string Currency;

        [JsonName("minBetAmount")]
        public float? MinBetAmount;

        [JsonName("maxBetAmount")]
        public float? MaxBetAmount;

        [JsonName("balance")]
        public float? Balance;

        // Map of risk level (LOW/MEDIUM/HIGH) to the slot coefficient array for that level.
        [JsonName("coefficients")]
        public JsonValue Coefficients;

        public float[] GetCoefficients(string risk)
        {
            if (Coefficients == null || !Coefficients.IsObject || string.IsNullOrWhiteSpace(risk))
                return Array.Empty<float>();

            JsonValue row = Coefficients[risk];
            if (row == null || !row.IsArray)
                return Array.Empty<float>();

            float[] result = new float[row.Count];
            for (int i = 0; i < row.Count; i++)
                result[i] = (float)row[i].AsDouble();

            return result;
        }
    }
}
