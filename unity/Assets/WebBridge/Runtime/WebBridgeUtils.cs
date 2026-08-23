using System;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Scripting;

namespace WebBridge
{
    [Preserve]
    public static class WebBridgeUtils
    {
        private const string MockEditorPrefKey = "WebBridge_EnableMock";
        private const string CheatsEditorPrefKey = "WebBridge_EnableCheats";

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

        public static bool IsCheatsEnabled
        {
            get
            {
#if WEBBRIDGE_CHEATS
                return true;
#elif UNITY_EDITOR
                return UnityEditor.EditorPrefs.GetBool(CheatsEditorPrefKey, false);
#else
                return false;
#endif
            }
        }

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void SendToReact(string msg);

        [DllImport("__Internal")]
        private static extern void WebBridge_SaveToLocalStorage(string key, string value);

        [DllImport("__Internal")]
        private static extern IntPtr WebBridge_LoadFromLocalStorage(string key);

        [DllImport("__Internal")]
        private static extern void WebBridge_RemoveFromLocalStorage(string key);
#endif

        public static void Send(string message)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            SendToReact(message);
#endif
            WebBridgeLogger.Log("[Unity -> React] " + message);
        }

        public static void SaveToLocalStorage(string key, string value)
        {
            WebBridgeLogger.Log($"[WebBridgeStorage] Save '{key}': {value}");
#if UNITY_WEBGL && !UNITY_EDITOR
            WebBridge_SaveToLocalStorage(key, value);
#endif
        }

        public static string LoadFromLocalStorage(string key)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            IntPtr ptr = WebBridge_LoadFromLocalStorage(key);
            if (ptr == IntPtr.Zero)
            {
                WebBridgeLogger.Log($"[WebBridgeStorage] Load '{key}': null (ptr=0)");
                return null;
            }
            string result = Marshal.PtrToStringUTF8(ptr);
            WebBridgeLogger.Log($"[WebBridgeStorage] Load '{key}': {result ?? "null"}");
            return result;
#else
            WebBridgeLogger.Log($"[WebBridgeStorage] Load '{key}' (editor stub → null)");
            return null;
#endif
        }

        public static void RemoveFromLocalStorage(string key)
        {
            WebBridgeLogger.Log($"[WebBridgeStorage] Remove '{key}'");
#if UNITY_WEBGL && !UNITY_EDITOR
            WebBridge_RemoveFromLocalStorage(key);
#endif
        }

        public static T DeserializePayload<T>(string payload, string methodName)
            where T : class
        {
            if (string.IsNullOrWhiteSpace(payload))
                return null;

            try
            {
                JsonValue token = JsonValue.Parse(payload);
                if (token.IsArray)
                {
                    JsonValue first = token.First;
                    return (first == null || first.IsNull) ? null : first.ToObject<T>();
                }

                return token.ToObject<T>();
            }
            catch (Exception exception)
            {
                WebBridgeLogger.LogWarning($"[WebBridge] Failed to parse {methodName}: {exception.Message}");
                return null;
            }
        }

        public static string ReadString(JsonValue source, params string[] propertyNames)
        {
            if (source == null)
                return null;

            for (int i = 0; i < propertyNames.Length; i++)
            {
                JsonValue valueToken = source[propertyNames[i]];
                if (valueToken == null || valueToken.IsNull)
                    continue;

                string value = valueToken.IsString
                    ? valueToken.AsString()
                    : valueToken.ToCompactString();
                if (!string.IsNullOrWhiteSpace(value))
                    return value;
            }

            return null;
        }

        public static int? ReadInt(JsonValue source, params string[] propertyNames)
        {
            if (source == null)
                return null;

            for (int i = 0; i < propertyNames.Length; i++)
            {
                JsonValue valueToken = source[propertyNames[i]];
                if (valueToken == null || valueToken.IsNull)
                    continue;

                if (valueToken.IsInteger)
                    return valueToken.AsInt();

                if (valueToken.IsFloat)
                    return Mathf.RoundToInt((float)valueToken.AsDouble());

                string raw = valueToken.ToCompactString();
                if (int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out int parsed))
                    return parsed;

                if (float.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out float parsedFloat))
                    return Mathf.RoundToInt(parsedFloat);
            }

            return null;
        }

        public static string FormatIntArray(IReadOnlyList<int> values)
        {
            if (values == null || values.Count == 0)
                return "[]";

            return $"[{string.Join(",", values)}]";
        }
    }
}
