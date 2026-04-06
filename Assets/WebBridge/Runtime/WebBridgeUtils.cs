using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.InteropServices;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Modules.Road
{
    public static class WebBridgeUtils
    {
        private const string MockEditorPrefKey = "WebBridge_EnableMock";

        public static bool IsMockEnabled
        {
            get
            {
#if WEBBRIDGE_MOCK
                return true;
#elif UNITY_EDITOR
                return UnityEditor.EditorPrefs.GetBool(MockEditorPrefKey, false);
#else
                return false;
#endif
            }
        }

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void SendToReact(string msg);
#endif

        public static void Send(string message)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            SendToReact(message);
#endif
            Debug.Log("[Unity -> React] " + message);
        }

        public static T DeserializePayload<T>(string payload, string methodName)
            where T : class
        {
            if (string.IsNullOrWhiteSpace(payload))
                return null;

            try
            {
                JToken token = JToken.Parse(payload);
                if (token.Type == JTokenType.Array)
                {
                    JToken first = token.First;
                    return first?.Type == JTokenType.Null ? null : first?.ToObject<T>();
                }

                return token.ToObject<T>();
            }
            catch (Exception exception)
            {
                Debug.LogWarning($"[WebBridge] Failed to parse {methodName}: {exception.Message}");
                return null;
            }
        }

        public static string ReadString(JObject source, params string[] propertyNames)
        {
            for (int i = 0; i < propertyNames.Length; i++)
            {
                JToken valueToken = source[propertyNames[i]];
                if (valueToken == null || valueToken.Type == JTokenType.Null)
                    continue;

                string value = valueToken.Type == JTokenType.String
                    ? valueToken.Value<string>()
                    : valueToken.ToString(Formatting.None);
                if (!string.IsNullOrWhiteSpace(value))
                    return value;
            }

            return null;
        }

        public static int? ReadInt(JObject source, params string[] propertyNames)
        {
            for (int i = 0; i < propertyNames.Length; i++)
            {
                JToken valueToken = source[propertyNames[i]];
                if (valueToken == null || valueToken.Type == JTokenType.Null)
                    continue;

                if (valueToken.Type == JTokenType.Integer)
                    return valueToken.Value<int>();

                if (valueToken.Type == JTokenType.Float)
                    return Mathf.RoundToInt(valueToken.Value<float>());

                string raw = valueToken.ToString(Formatting.None);
                if (int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out int parsed))
                    return parsed;

                if (float.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out float parsedFloat))
                    return Mathf.RoundToInt(parsedFloat);
            }

            return null;
        }

        public static string BuildConfigDebugInfo(WebGameConfigPayload config)
        {
            if (config == null)
                return "null";

            int coeffsCount = config.Coefficients?.Length ?? 0;
            int bonusCountEntries = config.BonusCounts?.Count ?? 0;
            string bonusCounts = FormatBonusCounts(config.BonusCounts);
            string minBet = config.MinBetAmount.HasValue
                ? config.MinBetAmount.Value.ToString(CultureInfo.InvariantCulture)
                : "null";
            string maxBet = config.MaxBetAmount.HasValue
                ? config.MaxBetAmount.Value.ToString(CultureInfo.InvariantCulture)
                : "null";
            return $"coefficientsCount={coeffsCount}; bonusCountsEntries={bonusCountEntries}; bonusCounts={bonusCounts}; minBet={minBet}; maxBet={maxBet}";
        }

        public static string BuildStateDebugInfo(WebGameStatePayload state)
        {
            if (state == null)
                return "null";

            string coins = FormatIntArray(state.BonusStepsCollected);
            string bonusGame = FormatBonusGame(state.BonusGame);
            string isWinMain = state.IsWinMain.HasValue ? state.IsWinMain.Value.ToString() : "null";
            string coinsTriggered = state.BonusStepTriggered.HasValue
                ? state.BonusStepTriggered.Value.ToString()
                : "null";
            string status = string.IsNullOrWhiteSpace(state.Status) ? "null" : state.Status;
            return $"status={status}; isWinMain={isWinMain}; coinsTriggered={coinsTriggered}; coinsCollected={coins}; bonusGame={bonusGame}";
        }

        public static string FormatIntArray(IReadOnlyList<int> values)
        {
            if (values == null || values.Count == 0)
                return "[]";

            return $"[{string.Join(",", values)}]";
        }

        public static string FormatBonusCounts(IReadOnlyDictionary<string, int> bonusCounts)
        {
            if (bonusCounts == null || bonusCounts.Count == 0)
                return "{}";

            return "{" + string.Join(", ", bonusCounts.Select(pair => $"{pair.Key}:{pair.Value}")) + "}";
        }

        public static string FormatBonusGame(WebBonusGamePayload bonusGame)
        {
            if (bonusGame == null)
                return "null";

            string positions = FormatIntArray(bonusGame.BonusPositions);
            return $"{{coeff={bonusGame.BonusTotalCoefficient.ToString(CultureInfo.InvariantCulture)}, " +
                   $"win={bonusGame.BonusTotalWin}, positions={positions}}}";
        }
    }
}
