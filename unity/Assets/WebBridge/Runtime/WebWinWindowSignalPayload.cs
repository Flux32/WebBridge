using System;
using System.Globalization;
using UnityEngine.Scripting;

namespace WebBridge
{
    // Named mark of a result window's scenario. The scenario is authored in
    // games-configurator: it lays out the window's animations, sounds and marks like
    // this one on a timeline. What the name means is up to the game — the bridge only
    // carries it, together with the key of the window that called it.
    [Preserve]
    [Serializable]
    public class WebWinWindowSignalPayload
    {
        [JsonName("window")]
        public string Window;

        [JsonName("name")]
        public string Name;

        // Type of the value the mark carries: "int", "float", "bool" or "string".
        // Empty when the mark carries nothing but its name.
        [JsonName("valueType")]
        public string ValueType;

        // The value itself, as text. React sends it this way so this payload stays a
        // plain typed class instead of a field that is a number, a flag or a string
        // depending on the mark. Read it through the getters below.
        [JsonName("value")]
        public string Value;

        public bool HasValue => !string.IsNullOrEmpty(ValueType);

        // Each getter reads the value as the type the mark declared. Calling the one
        // that does not match ValueType throws — the mark's type is part of what the
        // admin authored, not something to guess at runtime.
        public int AsInt() => int.Parse(Value, CultureInfo.InvariantCulture);

        public float AsFloat() => float.Parse(Value, CultureInfo.InvariantCulture);

        public bool AsBool() => bool.Parse(Value);

        public string AsString() => Value;
    }
}
