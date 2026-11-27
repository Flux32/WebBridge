using System;
using UnityEngine.Scripting;

namespace WebBridge
{
    /// <summary>
    /// Flat parameters of a custom analytics event: strings, numbers and flags only. JsonUtility does
    /// not serialize dictionaries, so the JSON is built by hand with <see cref="JsonValue"/>. Adding
    /// a key twice keeps the last value.
    /// </summary>
    [Preserve]
    public sealed class AnalyticsParams
    {
        private readonly JsonValue _values = JsonValue.NewObject();

        public int Count => _values.Count;

        /// <summary>A null value or key has no valid JSON form: it is dropped with a warning.</summary>
        public AnalyticsParams Add(string key, string value) =>
            value == null ? Drop(key, "its value is null") : Set(key, JsonValue.Of(value));

        public AnalyticsParams Add(string key, int value) => Set(key, JsonValue.Of(value));

        /// <summary>
        /// A number must be finite: NaN and infinity have no JSON form and would break the whole event,
        /// so such a value is dropped with a warning.
        /// </summary>
        public AnalyticsParams Add(string key, double value) =>
            double.IsNaN(value) || double.IsInfinity(value)
                ? Drop(key, "its value is not finite")
                : Set(key, JsonValue.Of(value));

        public AnalyticsParams Add(string key, bool value) => Set(key, JsonValue.Of(value));

        /// <summary>A copy that carries <paramref name="key"/> first, so a helper's own param wins over an extra one.</summary>
        internal AnalyticsParams CopyWith(string key, string value)
        {
            AnalyticsParams copy = new AnalyticsParams().Add(key, value);
            foreach (var property in _values.Properties())
            {
                if (!string.Equals(property.Key, key, StringComparison.Ordinal))
                    copy._values[property.Key] = property.Value;
            }

            return copy;
        }

        internal JsonValue ToJsonValue() => _values;

        private AnalyticsParams Set(string key, JsonValue value)
        {
            if (key == null)
                return Drop(key, "its key is null");

            _values[key] = value;
            return this;
        }

        private AnalyticsParams Drop(string key, string reason)
        {
            WebBridgeLogger.LogWarning($"[WebBridge] Analytics param '{key}' was dropped: {reason}.");
            return this;
        }
    }
}
