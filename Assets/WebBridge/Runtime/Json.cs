using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Text;
using UnityEngine.Scripting;

namespace WebBridge
{
    // Маппинг имени поля в JSON-ключ. Замена Newtonsoft [JsonProperty("...")].
    [Preserve]
    [AttributeUsage(AttributeTargets.Field, Inherited = false)]
    public sealed class JsonNameAttribute : Attribute
    {
        public string Name { get; }

        public JsonNameAttribute(string name)
        {
            Name = name;
        }
    }

    public enum JsonKind
    {
        Null,
        Bool,
        Integer,
        Float,
        String,
        Array,
        Object
    }

    // Лёгкое JSON-дерево — замена Newtonsoft JToken/JObject/JArray для
    // динамических данных (например bonusModes произвольной формы).
    [Preserve]
    public sealed class JsonValue
    {
        private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        private JsonKind _kind;
        private bool _bool;
        private double _num;
        private string _raw;   // исходный текст числа (точное round-trip представление)
        private string _str;
        private List<JsonValue> _array;
        private List<KeyValuePair<string, JsonValue>> _object;

        public JsonKind Kind => _kind;

        public bool IsNull => _kind == JsonKind.Null;
        public bool IsObject => _kind == JsonKind.Object;
        public bool IsArray => _kind == JsonKind.Array;
        public bool IsString => _kind == JsonKind.String;
        public bool IsInteger => _kind == JsonKind.Integer;
        public bool IsFloat => _kind == JsonKind.Float;
        public bool IsBool => _kind == JsonKind.Bool;

        public static JsonValue CreateNull() => new JsonValue { _kind = JsonKind.Null };
        public static JsonValue NewObject() => new JsonValue { _kind = JsonKind.Object, _object = new List<KeyValuePair<string, JsonValue>>() };
        public static JsonValue NewArray() => new JsonValue { _kind = JsonKind.Array, _array = new List<JsonValue>() };

        public static JsonValue Of(string value)
        {
            if (value == null)
                return CreateNull();
            return new JsonValue { _kind = JsonKind.String, _str = value };
        }

        public static JsonValue Of(bool value) => new JsonValue { _kind = JsonKind.Bool, _bool = value };

        public static JsonValue Of(long value) => new JsonValue
        {
            _kind = JsonKind.Integer,
            _num = value,
            _raw = value.ToString(Inv)
        };

        public static JsonValue Of(double value) => new JsonValue
        {
            _kind = JsonKind.Float,
            _num = value,
            _raw = value.ToString("R", Inv)
        };

        public static implicit operator JsonValue(string value) => Of(value);
        public static implicit operator JsonValue(bool value) => Of(value);
        public static implicit operator JsonValue(int value) => Of(value);
        public static implicit operator JsonValue(long value) => Of(value);
        public static implicit operator JsonValue(float value) => Of(value);
        public static implicit operator JsonValue(double value) => Of(value);

        // --- доступ к объекту -------------------------------------------------

        public bool HasValues =>
            (_kind == JsonKind.Object && _object != null && _object.Count > 0) ||
            (_kind == JsonKind.Array && _array != null && _array.Count > 0);

        // get: значение по ключу или null, если ключа нет (как у Newtonsoft).
        // set: создаёт/заменяет ключ.
        public JsonValue this[string key]
        {
            get
            {
                if (_kind != JsonKind.Object || _object == null)
                    return null;
                for (int i = 0; i < _object.Count; i++)
                {
                    if (string.Equals(_object[i].Key, key, StringComparison.Ordinal))
                        return _object[i].Value;
                }
                return null;
            }
            set
            {
                if (_kind != JsonKind.Object)
                {
                    _kind = JsonKind.Object;
                    _object = new List<KeyValuePair<string, JsonValue>>();
                }
                JsonValue v = value ?? CreateNull();
                for (int i = 0; i < _object.Count; i++)
                {
                    if (string.Equals(_object[i].Key, key, StringComparison.Ordinal))
                    {
                        _object[i] = new KeyValuePair<string, JsonValue>(key, v);
                        return;
                    }
                }
                _object.Add(new KeyValuePair<string, JsonValue>(key, v));
            }
        }

        public IEnumerable<KeyValuePair<string, JsonValue>> Properties()
        {
            if (_kind == JsonKind.Object && _object != null)
                return _object;
            return System.Linq.Enumerable.Empty<KeyValuePair<string, JsonValue>>();
        }

        // --- доступ к массиву -------------------------------------------------

        public int Count
        {
            get
            {
                if (_kind == JsonKind.Array) return _array?.Count ?? 0;
                if (_kind == JsonKind.Object) return _object?.Count ?? 0;
                return 0;
            }
        }

        public JsonValue this[int index]
        {
            get
            {
                if (_kind == JsonKind.Array && _array != null && index >= 0 && index < _array.Count)
                    return _array[index];
                return null;
            }
        }

        public void Add(JsonValue value)
        {
            if (_kind != JsonKind.Array)
            {
                _kind = JsonKind.Array;
                _array = new List<JsonValue>();
            }
            _array.Add(value ?? CreateNull());
        }

        public JsonValue First => (_kind == JsonKind.Array && _array != null && _array.Count > 0) ? _array[0] : null;

        // --- скалярные геттеры ------------------------------------------------

        public string AsString() => _kind == JsonKind.String ? _str : null;

        public double AsDouble() => _num;

        public bool? AsBool()
        {
            if (_kind == JsonKind.Bool) return _bool;
            return null;
        }

        public int? AsInt()
        {
            switch (_kind)
            {
                case JsonKind.Integer:
                    return (int)Math.Round(_num);
                case JsonKind.Float:
                    return (int)Math.Round(_num);
                case JsonKind.String:
                    if (int.TryParse(_str, NumberStyles.Integer, Inv, out int i)) return i;
                    if (float.TryParse(_str, NumberStyles.Float, Inv, out float f)) return (int)Math.Round(f);
                    return null;
                default:
                    return null;
            }
        }

        public float? AsFloat()
        {
            switch (_kind)
            {
                case JsonKind.Integer:
                case JsonKind.Float:
                    return (float)_num;
                case JsonKind.String:
                    if (float.TryParse(_str, NumberStyles.Float, Inv, out float f)) return f;
                    return null;
                default:
                    return null;
            }
        }

        // Компактное строковое представление узла (аналог JToken.ToString(Formatting.None)):
        // строка -> сырое значение без кавычек, число -> текст числа, объект/массив -> JSON.
        public string ToCompactString()
        {
            switch (_kind)
            {
                case JsonKind.Null: return "null";
                case JsonKind.Bool: return _bool ? "true" : "false";
                case JsonKind.Integer:
                case JsonKind.Float: return _raw ?? _num.ToString("R", Inv);
                case JsonKind.String: return _str ?? string.Empty;
                default: return ToJsonString();
            }
        }

        // --- сериализация -----------------------------------------------------

        public string ToJsonString()
        {
            StringBuilder sb = new StringBuilder(64);
            WriteTo(sb);
            return sb.ToString();
        }

        public void WriteTo(StringBuilder sb)
        {
            switch (_kind)
            {
                case JsonKind.Null:
                    sb.Append("null");
                    break;
                case JsonKind.Bool:
                    sb.Append(_bool ? "true" : "false");
                    break;
                case JsonKind.Integer:
                case JsonKind.Float:
                    sb.Append(_raw ?? _num.ToString("R", Inv));
                    break;
                case JsonKind.String:
                    WriteEscapedString(sb, _str);
                    break;
                case JsonKind.Array:
                    sb.Append('[');
                    if (_array != null)
                    {
                        for (int i = 0; i < _array.Count; i++)
                        {
                            if (i > 0) sb.Append(',');
                            (_array[i] ?? CreateNull()).WriteTo(sb);
                        }
                    }
                    sb.Append(']');
                    break;
                case JsonKind.Object:
                    sb.Append('{');
                    if (_object != null)
                    {
                        for (int i = 0; i < _object.Count; i++)
                        {
                            if (i > 0) sb.Append(',');
                            WriteEscapedString(sb, _object[i].Key);
                            sb.Append(':');
                            (_object[i].Value ?? CreateNull()).WriteTo(sb);
                        }
                    }
                    sb.Append('}');
                    break;
            }
        }

        internal static void WriteEscapedString(StringBuilder sb, string value)
        {
            if (value == null)
            {
                sb.Append("null");
                return;
            }

            sb.Append('"');
            for (int i = 0; i < value.Length; i++)
            {
                char c = value[i];
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < ' ')
                            sb.Append("\\u").Append(((int)c).ToString("x4", Inv));
                        else
                            sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        // --- парсинг ----------------------------------------------------------

        public static JsonValue Parse(string json)
        {
            if (json == null)
                throw new FormatException("JSON is null");

            int index = 0;
            JsonValue value = ParseValue(json, ref index);
            SkipWhitespace(json, ref index);
            if (index != json.Length)
                throw new FormatException($"Unexpected trailing characters at {index}");
            return value;
        }

        private static JsonValue ParseValue(string s, ref int i)
        {
            SkipWhitespace(s, ref i);
            if (i >= s.Length)
                throw new FormatException("Unexpected end of JSON");

            char c = s[i];
            switch (c)
            {
                case '{': return ParseObject(s, ref i);
                case '[': return ParseArray(s, ref i);
                case '"': return Of(ParseString(s, ref i));
                case 't':
                case 'f': return ParseBool(s, ref i);
                case 'n': ParseLiteral(s, ref i, "null"); return CreateNull();
                default: return ParseNumber(s, ref i);
            }
        }

        private static JsonValue ParseObject(string s, ref int i)
        {
            JsonValue obj = NewObject();
            i++; // {
            SkipWhitespace(s, ref i);
            if (i < s.Length && s[i] == '}') { i++; return obj; }

            while (true)
            {
                SkipWhitespace(s, ref i);
                if (i >= s.Length || s[i] != '"')
                    throw new FormatException($"Expected property name at {i}");
                string key = ParseString(s, ref i);
                SkipWhitespace(s, ref i);
                if (i >= s.Length || s[i] != ':')
                    throw new FormatException($"Expected ':' at {i}");
                i++;
                JsonValue val = ParseValue(s, ref i);
                obj[key] = val;

                SkipWhitespace(s, ref i);
                if (i >= s.Length)
                    throw new FormatException("Unterminated object");
                if (s[i] == ',') { i++; continue; }
                if (s[i] == '}') { i++; break; }
                throw new FormatException($"Expected ',' or '}}' at {i}");
            }
            return obj;
        }

        private static JsonValue ParseArray(string s, ref int i)
        {
            JsonValue arr = NewArray();
            i++; // [
            SkipWhitespace(s, ref i);
            if (i < s.Length && s[i] == ']') { i++; return arr; }

            while (true)
            {
                JsonValue val = ParseValue(s, ref i);
                arr.Add(val);

                SkipWhitespace(s, ref i);
                if (i >= s.Length)
                    throw new FormatException("Unterminated array");
                if (s[i] == ',') { i++; continue; }
                if (s[i] == ']') { i++; break; }
                throw new FormatException($"Expected ',' or ']' at {i}");
            }
            return arr;
        }

        private static string ParseString(string s, ref int i)
        {
            i++; // opening quote
            StringBuilder sb = new StringBuilder();
            while (i < s.Length)
            {
                char c = s[i++];
                if (c == '"')
                    return sb.ToString();

                if (c == '\\')
                {
                    if (i >= s.Length) break;
                    char e = s[i++];
                    switch (e)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            if (i + 4 > s.Length)
                                throw new FormatException("Invalid \\u escape");
                            string hex = s.Substring(i, 4);
                            sb.Append((char)int.Parse(hex, NumberStyles.HexNumber, Inv));
                            i += 4;
                            break;
                        default:
                            throw new FormatException($"Invalid escape \\{e}");
                    }
                }
                else
                {
                    sb.Append(c);
                }
            }
            throw new FormatException("Unterminated string");
        }

        private static JsonValue ParseBool(string s, ref int i)
        {
            if (s[i] == 't') { ParseLiteral(s, ref i, "true"); return Of(true); }
            ParseLiteral(s, ref i, "false");
            return Of(false);
        }

        private static void ParseLiteral(string s, ref int i, string literal)
        {
            if (i + literal.Length > s.Length || s.Substring(i, literal.Length) != literal)
                throw new FormatException($"Invalid literal at {i}, expected '{literal}'");
            i += literal.Length;
        }

        private static JsonValue ParseNumber(string s, ref int i)
        {
            int start = i;
            if (i < s.Length && (s[i] == '-' || s[i] == '+')) i++;
            while (i < s.Length)
            {
                char c = s[i];
                if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') { i++; continue; }
                break;
            }

            if (i == start)
                throw new FormatException($"Invalid number at {start}");

            string raw = s.Substring(start, i - start);
            if (!double.TryParse(raw, NumberStyles.Float, Inv, out double num))
                throw new FormatException($"Invalid number '{raw}'");

            bool hasFractional = raw.IndexOf('.') >= 0 || raw.IndexOf('e') >= 0 || raw.IndexOf('E') >= 0;
            return new JsonValue
            {
                _kind = hasFractional ? JsonKind.Float : JsonKind.Integer,
                _num = num,
                _raw = raw
            };
        }

        private static void SkipWhitespace(string s, ref int i)
        {
            while (i < s.Length)
            {
                char c = s[i];
                if (c == ' ' || c == '\t' || c == '\n' || c == '\r') i++;
                else break;
            }
        }

        // --- маппинг в POCO ---------------------------------------------------

        public T ToObject<T>() => (T)ToObject(typeof(T));

        public object ToObject(Type type)
        {
            return JsonMapper.FromJson(this, type);
        }
    }

    // Рефлексия-маппер: POCO <-> JsonValue. Заменяет JsonConvert.(De)SerializeObject.
    [Preserve]
    public static class Json
    {
        public static string Serialize(object value)
        {
            return JsonMapper.ToJson(value).ToJsonString();
        }

        public static T Deserialize<T>(string json)
        {
            if (string.IsNullOrEmpty(json))
                return default;
            return JsonValue.Parse(json).ToObject<T>();
        }
    }

    [Preserve]
    internal static class JsonMapper
    {
        private const BindingFlags FieldFlags = BindingFlags.Public | BindingFlags.Instance;

        public static JsonValue ToJson(object value)
        {
            if (value == null)
                return JsonValue.CreateNull();

            if (value is JsonValue jv)
                return jv;

            switch (value)
            {
                case string s: return JsonValue.Of(s);
                case bool b: return JsonValue.Of(b);
                case float f: return JsonValue.Of((double)f);
                case double d: return JsonValue.Of(d);
                case int i: return JsonValue.Of(i);
                case long l: return JsonValue.Of(l);
                case short sh: return JsonValue.Of(sh);
                case byte by: return JsonValue.Of(by);
            }

            Type type = value.GetType();

            if (value is IDictionary dictionary)
            {
                JsonValue obj = JsonValue.NewObject();
                foreach (DictionaryEntry entry in dictionary)
                    obj[Convert.ToString(entry.Key, CultureInfo.InvariantCulture)] = ToJson(entry.Value);
                return obj;
            }

            if (value is IEnumerable enumerable && !(value is string))
            {
                JsonValue arr = JsonValue.NewArray();
                foreach (object item in enumerable)
                    arr.Add(ToJson(item));
                return arr;
            }

            if (type.IsEnum)
                return JsonValue.Of(Convert.ToString(value, CultureInfo.InvariantCulture));

            // POCO: публичные поля с учётом [JsonName].
            JsonValue result = JsonValue.NewObject();
            FieldInfo[] fields = type.GetFields(FieldFlags);
            for (int i = 0; i < fields.Length; i++)
            {
                FieldInfo field = fields[i];
                result[ResolveName(field)] = ToJson(field.GetValue(value));
            }
            return result;
        }

        public static object FromJson(JsonValue json, Type type)
        {
            if (type == typeof(JsonValue))
                return json;

            if (json == null || json.IsNull)
                return GetDefault(type);

            // Nullable<T> -> разбираем как T.
            Type underlying = Nullable.GetUnderlyingType(type);
            if (underlying != null)
                return FromJson(json, underlying);

            if (type == typeof(string))
                return json.IsString ? json.AsString() : json.ToCompactString();
            if (type == typeof(bool))
                return json.AsBool() ?? false;
            if (type == typeof(int))
                return json.AsInt() ?? 0;
            if (type == typeof(long))
                return (long)(json.AsInt() ?? 0);
            if (type == typeof(float))
                return json.AsFloat() ?? 0f;
            if (type == typeof(double))
                return (double)(json.AsFloat() ?? 0f);
            if (type.IsEnum)
                return Enum.Parse(type, json.IsString ? json.AsString() : json.ToCompactString(), true);

            if (type.IsArray)
            {
                Type element = type.GetElementType();
                int count = json.IsArray ? json.Count : 0;
                Array array = Array.CreateInstance(element, count);
                for (int i = 0; i < count; i++)
                    array.SetValue(FromJson(json[i], element), i);
                return array;
            }

            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Dictionary<,>))
            {
                Type[] args = type.GetGenericArguments();
                Type valueType = args[1];
                IDictionary dictionary = (IDictionary)Activator.CreateInstance(type);
                if (json.IsObject)
                {
                    foreach (KeyValuePair<string, JsonValue> entry in json.Properties())
                        dictionary[entry.Key] = FromJson(entry.Value, valueType);
                }
                return dictionary;
            }

            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(List<>))
            {
                Type element = type.GetGenericArguments()[0];
                IList list = (IList)Activator.CreateInstance(type);
                int count = json.IsArray ? json.Count : 0;
                for (int i = 0; i < count; i++)
                    list.Add(FromJson(json[i], element));
                return list;
            }

            // POCO.
            object instance = Activator.CreateInstance(type);
            if (json.IsObject)
            {
                FieldInfo[] fields = type.GetFields(FieldFlags);
                for (int i = 0; i < fields.Length; i++)
                {
                    FieldInfo field = fields[i];
                    JsonValue fieldJson = json[ResolveName(field)];
                    if (fieldJson == null)
                        continue;
                    field.SetValue(instance, FromJson(fieldJson, field.FieldType));
                }
            }
            return instance;
        }

        private static string ResolveName(FieldInfo field)
        {
            JsonNameAttribute attribute = field.GetCustomAttribute<JsonNameAttribute>();
            return attribute != null ? attribute.Name : field.Name;
        }

        private static object GetDefault(Type type)
        {
            return type.IsValueType ? Activator.CreateInstance(type) : null;
        }
    }
}
