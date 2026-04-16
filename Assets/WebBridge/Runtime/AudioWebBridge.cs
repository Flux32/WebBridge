using UnityEngine;
#if UNITY_EDITOR
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Networking;
#endif

using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    public class AudioWebBridge : MonoBehaviour
    {
        private const string PlaySoundMessageBase = "PlaySound_";
        private const string PlayMusicMessageBase = "PlayMusic_";

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
                Debug.LogError($"Instance {nameof(AudioWebBridge)} already exists.");
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

        public void PlaySound(string soundKey)
        {
            //Debug.Log($"Play sound: {soundKey}");
#if UNITY_EDITOR
            StartCoroutine(LoadAndPlay(soundKey, false));
#else
            WebBridgeUtils.Send(PlaySoundMessageBase + soundKey);
#endif
        }

        public void PlayMusic(string soundKey)
        {
            Debug.Log($"Play music: {soundKey}");
#if UNITY_EDITOR
            StartCoroutine(LoadAndPlay(soundKey, true));
#else
            WebBridgeUtils.Send(PlayMusicMessageBase + soundKey);
#endif
        }

#if UNITY_EDITOR
        private IEnumerator LoadAndPlay(string soundKey, bool isMusic)
        {
            if (string.IsNullOrEmpty(soundKey))
            {
                Debug.LogError("[AudioWebBridge] Sound key is empty. Assign a valid key in the component.");
                yield break;
            }

            if (_clipCache.TryGetValue(soundKey, out AudioClip cached))
            {
                Play(cached, isMusic);
                yield break;
            }

            string folderPath = GetSoundFolderPath();
            if (string.IsNullOrEmpty(folderPath))
            {
                Debug.LogWarning("[AudioWebBridge] Sound folder path is not configured in SoundKeys.");
                yield break;
            }

            string filePath = $"file://{folderPath}/{soundKey}.mp3";

            using UnityWebRequest request = UnityWebRequestMultimedia.GetAudioClip(filePath, AudioType.MPEG);
            yield return request.SendWebRequest();

            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError($"[AudioWebBridge] Failed to load '{soundKey}' from {filePath}: {request.error}");
                yield break;
            }

            AudioClip clip = DownloadHandlerAudioClip.GetContent(request);
            clip.name = soundKey;
            _clipCache[soundKey] = clip;
            Play(clip, isMusic);
        }

        private void Play(AudioClip clip, bool isMusic)
        {
            if (isMusic)
            {
                _musicSource.clip = clip;
                _musicSource.Play();
            }
            else
            {
                _sfxSource.PlayOneShot(clip);
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
