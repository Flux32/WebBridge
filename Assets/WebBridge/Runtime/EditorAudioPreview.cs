#if UNITY_EDITOR
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

using WebBridge;

namespace Modules.Road
{
    /// <summary>
    /// Локальное озвучивание в редакторе: там React'а нет, а слышать игру надо.
    /// Грузит `{ключ}.mp3` из папки ассета <see cref="SoundKeys"/> и играет сам —
    /// one-shot, музыку и зацикленные звуки по тем же ключам, что уедут в React.
    /// Компонент живёт только в редакторной сборке; в WebGL его нет.
    /// </summary>
    public class EditorAudioPreview : MonoBehaviour
    {
        private readonly Dictionary<string, AudioClip> _clipCache = new();
        private readonly Dictionary<string, AudioSource> _loopSources = new();
        private AudioSource _sfxSource;
        private AudioSource _musicSource;
        private string _cachedFolderPath;

        private void Awake()
        {
            _sfxSource = gameObject.AddComponent<AudioSource>();
            _musicSource = gameObject.AddComponent<AudioSource>();
            _musicSource.loop = true;
        }

        public void PlaySound(string soundKey, float? volume) =>
            StartCoroutine(LoadAndPlay(soundKey, clip => _sfxSource.PlayOneShot(clip, Volume(volume))));

        public void PlayMusic(string soundKey, float? volume) =>
            StartCoroutine(LoadAndPlay(soundKey, clip => PlayOn(_musicSource, clip, volume)));

        public void PlayLoop(string soundKey, float? volume)
        {
            if (_loopSources.TryGetValue(soundKey, out AudioSource running) && running.isPlaying)
            {
                running.volume = Volume(volume);
                return;
            }

            StartCoroutine(LoadAndPlay(soundKey, clip => PlayOn(LoopSource(soundKey), clip, volume)));
        }

        /// <summary>
        /// Громкость играющего звука: у зацикленного — его собственный источник,
        /// иначе общий SFX-источник. В редакторе one-shot'ы делят один источник,
        /// поэтому громкость одиночного звука здесь доводится сразу для всех —
        /// в React каждый инстанс доводится отдельно.
        /// </summary>
        public void SetVolume(string soundKey, float volume)
        {
            AudioSource source = _loopSources.TryGetValue(soundKey, out AudioSource loop) && loop.isPlaying
                ? loop
                : _sfxSource;

            source.volume = Volume(volume);
        }

        public void StopLoop(string soundKey)
        {
            if (!_loopSources.TryGetValue(soundKey, out AudioSource source))
                return;

            source.Stop();
        }

        private AudioSource LoopSource(string soundKey)
        {
            if (_loopSources.TryGetValue(soundKey, out AudioSource existing))
                return existing;

            AudioSource source = gameObject.AddComponent<AudioSource>();
            source.loop = true;
            _loopSources[soundKey] = source;
            return source;
        }

        private static void PlayOn(AudioSource source, AudioClip clip, float? volume)
        {
            source.clip = clip;
            source.volume = Volume(volume);
            source.Play();
        }

        private static float Volume(float? volume) => volume.HasValue ? Mathf.Clamp01(volume.Value) : 1f;

        private IEnumerator LoadAndPlay(string soundKey, System.Action<AudioClip> play)
        {
            if (string.IsNullOrEmpty(soundKey))
            {
                WebBridgeLogger.LogError("[EditorAudioPreview] Sound key is empty. Assign a valid key in the component.");
                yield break;
            }

            if (_clipCache.TryGetValue(soundKey, out AudioClip cached))
            {
                play(cached);
                yield break;
            }

            string folderPath = SoundFolderPath();
            if (string.IsNullOrEmpty(folderPath))
            {
                WebBridgeLogger.LogWarning("[EditorAudioPreview] Sound folder path is not configured in SoundKeys.");
                yield break;
            }

            string filePath = $"file://{folderPath}/{soundKey}.mp3";

            using UnityWebRequest request = UnityWebRequestMultimedia.GetAudioClip(filePath, AudioType.MPEG);
            yield return request.SendWebRequest();

            if (request.result != UnityWebRequest.Result.Success)
            {
                WebBridgeLogger.LogError($"[EditorAudioPreview] Failed to load '{soundKey}' from {filePath}: {request.error}");
                yield break;
            }

            AudioClip clip = DownloadHandlerAudioClip.GetContent(request);
            clip.name = soundKey;
            _clipCache[soundKey] = clip;
            play(clip);
        }

        private string SoundFolderPath()
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
    }
}
#endif
