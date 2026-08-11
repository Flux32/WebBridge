using UnityEngine;
using UnityEngine.Scripting;

using WebBridge;

namespace Modules.Road
{
    /// <summary>
    /// Звук игры уходит в React по строковому ключу: дорожки и громкость живут в
    /// games-configurator, здесь только имя звука и что с ним делать.
    ///
    /// Зацикленный звук — это ПАРА вызовов: <see cref="PlayLoop"/> держит его до
    /// <see cref="StopLoop"/>. Повторный PlayLoop с тем же ключом не начинает
    /// звук заново — он только доводит громкость, так что вызывать его в Update
    /// безопасно. Ключ, оставленный без StopLoop, играет до конца сессии.
    /// </summary>
    [Preserve]
    public class AudioWebBridge : MonoBehaviour
    {
        public static AudioWebBridge Instance { get; private set; }

#if UNITY_EDITOR
        private EditorAudioPreview _preview;
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
            _preview = gameObject.AddComponent<EditorAudioPreview>();
#endif
        }

        private void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        public void PlaySound(string soundKey, float? volume = null)
        {
#if UNITY_EDITOR
            _preview.PlaySound(soundKey, volume);
#else
            WebBridgeUtils.Send(AudioMessages.PlaySound(soundKey, volume));
#endif
        }

        public void PlayMusic(string soundKey, float? volume = null)
        {
#if UNITY_EDITOR
            _preview.PlayMusic(soundKey, volume);
#else
            WebBridgeUtils.Send(AudioMessages.PlayMusic(soundKey, volume));
#endif
        }

        /// <summary>Запустить зацикленный звук (или доводит громкость играющего).</summary>
        public void PlayLoop(string soundKey, float? volume = null)
        {
#if UNITY_EDITOR
            _preview.PlayLoop(soundKey, volume);
#else
            WebBridgeUtils.Send(AudioMessages.PlayLoop(soundKey, volume));
#endif
        }

        /// <summary>Остановить зацикленный звук. Неизвестный ключ — no-op.</summary>
        public void StopLoop(string soundKey)
        {
#if UNITY_EDITOR
            _preview.StopLoop(soundKey);
#else
            WebBridgeUtils.Send(AudioMessages.StopLoop(soundKey));
#endif
        }
    }
}
