using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Road
{
    /// <summary>
    /// Reads the bonus shop offer out of the raw game config.
    /// The platform describes bonus modes in more than one shape — an object keyed by mode name
    /// or an array of mode objects, with the currency sometimes on the mode and sometimes beside
    /// it — so the reading is a job of its own and not something the bridge should carry.
    /// </summary>
    [Preserve]
    public static class RoadBonusModeReader
    {
        private const string DefaultBetCurrency = "USD";

        public static IReadOnlyList<WebBonusShopModePayload> ReadShopModes(WebGameConfigPayload config)
        {
            List<WebBonusShopModePayload> result = new List<WebBonusShopModePayload>();
            HashSet<string> usedModes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            string defaultCurrency = ResolveBonusCurrency(config);

            JsonValue bonusModesToken = config?.BonusModes;
            if (bonusModesToken != null)
                CollectBonusModesFromToken(bonusModesToken, result, usedModes, defaultCurrency);

            if (result.Count == 0 && config?.BonusCounts != null)
            {
                foreach (KeyValuePair<string, int> mode in config.BonusCounts)
                {
                    if (string.IsNullOrWhiteSpace(mode.Key) || !usedModes.Add(mode.Key))
                        continue;

                    result.Add(new WebBonusShopModePayload
                    {
                        ModeName = mode.Key,
                        Price = "0",
                        Currency = defaultCurrency,
                        BonusAmount = Mathf.Max(0, mode.Value)
                    });
                }
            }

            return result;
        }

        private static void CollectBonusModesFromToken(
            JsonValue token,
            ICollection<WebBonusShopModePayload> result,
            ISet<string> usedModes,
            string defaultCurrency)
        {
            if (token == null || token.IsNull)
                return;

            if (token.IsObject)
            {
                foreach (KeyValuePair<string, JsonValue> modeProperty in token.Properties())
                {
                    if (IsCurrencyPropertyName(modeProperty.Key))
                        continue;

                    AddBonusMode(result, usedModes, modeProperty.Key, modeProperty.Value, defaultCurrency);
                }

                return;
            }

            if (!token.IsArray)
                return;

            for (int i = 0; i < token.Count; i++)
            {
                JsonValue modeObject = token[i];
                if (modeObject == null || !modeObject.IsObject)
                    continue;

                string modeName = WebBridgeUtils.ReadString(modeObject, "modeId", "modeName", "mode", "name", "key");
                AddBonusMode(result, usedModes, modeName, modeObject, defaultCurrency);
            }
        }

        private static void AddBonusMode(
            ICollection<WebBonusShopModePayload> result,
            ISet<string> usedModes,
            string modeName,
            JsonValue modeToken,
            string defaultCurrency)
        {
            if (string.IsNullOrWhiteSpace(modeName) || !usedModes.Add(modeName))
                return;

            result.Add(new WebBonusShopModePayload
            {
                ModeName = modeName,
                Price = ResolveModePrice(modeToken),
                Currency = ResolveModeCurrency(modeToken, defaultCurrency),
                BonusAmount = ResolveModeBonusAmount(modeToken)
            });
        }

        private static string ResolveModeCurrency(JsonValue modeToken, string defaultCurrency)
        {
            if (modeToken != null && modeToken.IsObject)
            {
                string modeCurrency = WebBridgeUtils.ReadString(modeToken, "currency", "currencyCode", "currencySymbol", "symbol");
                if (!string.IsNullOrWhiteSpace(modeCurrency))
                    return modeCurrency;
            }

            return string.IsNullOrWhiteSpace(defaultCurrency) ? DefaultBetCurrency : defaultCurrency;
        }

        private static string ResolveBonusCurrency(WebGameConfigPayload config)
        {
            if (!string.IsNullOrWhiteSpace(config?.Currency))
                return config.Currency;

            if (config?.BonusModes != null && config.BonusModes.IsObject)
            {
                string modesCurrency = WebBridgeUtils.ReadString(config.BonusModes, "currency", "currencyCode", "currencySymbol", "symbol");
                if (!string.IsNullOrWhiteSpace(modesCurrency))
                    return modesCurrency;
            }

            return DefaultBetCurrency;
        }

        private static bool IsCurrencyPropertyName(string propertyName)
        {
            if (string.IsNullOrWhiteSpace(propertyName))
                return false;

            return propertyName.Equals("currency", StringComparison.OrdinalIgnoreCase)
                   || propertyName.Equals("currencyCode", StringComparison.OrdinalIgnoreCase)
                   || propertyName.Equals("currencySymbol", StringComparison.OrdinalIgnoreCase)
                   || propertyName.Equals("symbol", StringComparison.OrdinalIgnoreCase);
        }

        private static string ResolveModePrice(JsonValue modeToken)
        {
            if (modeToken != null && modeToken.IsObject)
            {
                string stringPrice = WebBridgeUtils.ReadString(modeToken, "price", "amount", "cost", "value");
                if (!string.IsNullOrWhiteSpace(stringPrice))
                    return stringPrice;
            }

            if (modeToken == null || modeToken.IsNull || modeToken.IsObject)
                return "0";

            return modeToken.ToCompactString();
        }

        private static int ResolveModeBonusAmount(JsonValue modeToken)
        {
            if (modeToken == null || !modeToken.IsObject)
                return 0;

            int? value = WebBridgeUtils.ReadInt(modeToken, "count", "moves", "bonusCount", "steps", "lineCount");
            return value.HasValue ? Mathf.Max(0, value.Value) : 0;
        }

    }
}
