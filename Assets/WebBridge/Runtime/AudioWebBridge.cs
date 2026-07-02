using System.Globalization;
using UnityEngine;
#if UNITY_EDITOR
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Networking;
#endif

using UnityEngine.Scripting;

using WebBridge;

namespace Modules.Road
{
    [Preserve]
    public class AudioWebBridge : MonoBehaviour
    {
        private const string PlaySoundMessageBase = "PlaySound_";
        private const string PlayMusicMessageBase = "PlayMusic_";
        private const char VolumeSeparator = '|';

        public static AudioWebBridge Instance { get; private set; }

#if UNITY_EDITOR
        private AudioSource _sfxSource;
        private AudioSource _musicSource;
        private readonly Dictionary<string, AudioClip> _clipCache = new();
        private string _cachedFolderPath;
#endif

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                WebBridgeLogger.LogError($"Instance {nameof(AudioWebBridge)} already exists.");
                Destroy(gameObject);
                return;
            }

            Instance = this;

#if UNITY_EDITOR
            _sfxSource = gameObject.AddComponent<AudioSource>();
            _musicSource = gameObject.AddComponent<AudioSource>();
            _musicSource.loop = true;
#endif
        }

        private void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        public void PlaySound(string soundKey, float? volume = null)
        {
            //WebBridgeLogger.Log($"Play sound: {soundKey}");
#if UNITY_EDITOR
            StartCoroutine(LoadAndPlay(soundKey, false, volume));
#else
            WebBridgeUtils.Send(BuildMessage(PlaySoundMessageBase, soundKey, volume));
#endif
        }

        public void PlayMusic(string soundKey, float? volume = null)
        {
            WebBridgeLogger.Log($"Play music: {soundKey}");
#if UNITY_EDITOR
            StartCoroutine(LoadAndPlay(soundKey, true, volume));
#else
            WebBridgeUtils.Send(BuildMessage(PlayMusicMessageBase, soundKey, volume));
#endif
        }

        private static string BuildMessage(string messageBase, string soundKey, float? volume)
        {
            if (!volume.HasValue)
                return messageBase + soundKey;

            float clamped = Mathf.Clamp01(volume.Value);
            return messageBase + soundKey + VolumeSeparator + clamped.ToString(CultureInfo.InvariantCulture);
        }

#if UNITY_EDITOR
        private IEnumerator LoadAndPlay(string soundKey, bool isMusic, float? volume)
        {
            if (string.IsNullOrEmpty(soundKey))
            {
                WebBridgeLogger.LogError("[AudioWebBridge] Sound key is empty. Assign a valid key in the component.");
                yield break;
            }

            if (_clipCache.TryGetValue(soundKey, out AudioClip cached))
            {
                Play(cached, isMusic, volume);
                yield break;
            }

            string folderPath = GetSoundFolderPath();
            if (string.IsNullOrEmpty(folderPath))
            {
                WebBridgeLogger.LogWarning("[AudioWebBridge] Sound folder path is not configured in SoundKeys.");
                yield break;
            }

            string filePath = $"file://{folderPath}/{soundKey}.mp3";

            using UnityWebRequest request = UnityWebRequestMultimedia.GetAudioClip(filePath, AudioType.MPEG);
            yield return request.SendWebRequest();

            if (request.result != UnityWebRequest.Result.Success)
            {
                WebBridgeLogger.LogError($"[AudioWebBridge] Failed to load '{soundKey}' from {filePath}: {request.error}");
                yield break;
            }

            AudioClip clip = DownloadHandlerAudioClip.GetContent(request);
            clip.name = soundKey;
            _clipCache[soundKey] = clip;
            Play(clip, isMusic, volume);
        }

        private void Play(AudioClip clip, bool isMusic, float? volume)
        {
            float resolvedVolume = volume.HasValue ? Mathf.Clamp01(volume.Value) : 1f;

            if (isMusic)
            {
                _musicSource.clip = clip;
                _musicSource.volume = resolvedVolume;
                _musicSource.Play();
            }
            else
            {
                _sfxSource.PlayOneShot(clip, resolvedVolume);
            }
        }

        private string GetSoundFolderPath()
        {
            if (_cachedFolderPath != null)
                return _cachedFolderPath;

            string[] guids = UnityEditor.AssetDatabase.FindAssets("t:SoundKeys");
            if (guids.Length == 0)
                return null;

            string assetPath = UnityEditor.AssetDatabase.GUIDToAssetPath(guids[0]);
            SoundKeys soundKeys = UnityEditor.AssetDatabase.LoadAssetAtPath<SoundKeys>(assetPath);
            _cachedFolderPath = soundKeys != null ? soundKeys.SoundFolderPath : null;
            return _cachedFolderPath;
        }
#endif
    }
}
