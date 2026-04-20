using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    public class TranslationsWebBridge : MonoBehaviour
    {
        private const string RequestTranslationsMessage = "RequestTranslations";

        private readonly Dictionary<string, string> _translations =
            new Dictionary<string, string>(StringComparer.Ordinal);

        public static TranslationsWebBridge Instance { get; private set; }

        public event Action TranslationsChanged;

        public bool HasTranslations { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogError($"Instance {nameof(TranslationsWebBridge)} already exists.");
                Destroy(gameObject);
                return;
            }

            Instance = this;
        }

        private void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        public void ApplyTranslations(string payload)
        {
            if (string.IsNullOrWhiteSpace(payload))
            {
                Debug.LogWarning("[TranslationsWebBridge] ApplyTranslations ignored. Empty payload.");
                return;
            }

            Dictionary<string, string> parsed;
            try
            {
                parsed = JsonConvert.DeserializeObject<Dictionary<string, string>>(payload);
            }
            catch (Exception exception)
            {
                Debug.LogWarning($"[TranslationsWebBridge] Failed to parse payload: {exception.Message}");
                return;
            }

            if (parsed == null)
                return;

            _translations.Clear();
            foreach (KeyValuePair<string, string> entry in parsed)
            {
                if (string.IsNullOrEmpty(entry.Key))
                    continue;

                string value = entry.Value ?? string.Empty;
                _translations[entry.Key] = value;
                Debug.Log($"[TranslationsWebBridge] {entry.Key}: {value}");
            }

            Debug.Log($"[TranslationsWebBridge] Applied {_translations.Count} translation(s).");

            HasTranslations = true;
            TranslationsChanged?.Invoke();
        }

        public bool TryGet(string key, out string value)
        {
            if (string.IsNullOrEmpty(key))
            {
                value = null;
                return false;
            }

            return _translations.TryGetValue(key, out value);
        }

        public string Get(string key)
        {
            return TryGet(key, out string value) ? value : key;
        }

        public void RequestTranslations()
        {
            WebBridgeUtils.Send(RequestTranslationsMessage);
        }
    }
}
