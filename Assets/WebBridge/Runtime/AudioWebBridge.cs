using System.Collections.Generic;
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
    ///
    /// One-shot уходит не чаще одного раза за кадр на ключ: залп из восьми
    /// одинаковых попаданий в одном кадре — это один звук, а не восемь копий
    /// поверх друг друга (React сложил бы их все).
    /// </summary>
    [Preserve]
    public class AudioWebBridge : MonoBehaviour
    {
        public static AudioWebBridge Instance { get; private set; }

        /// <summary>Кадр последней отправки ключа — дедуп one-shot'ов внутри кадра.</summary>
        private readonly Dictionary<string, int> _lastSentFrame = new();

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
            if (string.IsNullOrEmpty(soundKey) || WasSentThisFrame(soundKey))
                return;

#if UNITY_EDITOR
            _preview.PlaySound(soundKey, volume);
#else
            WebBridgeUtils.Send(AudioMessages.PlaySound(soundKey, volume));
#endif
        }

        /// <summary>
        /// Сыграть ОДИН из взаимозаменяемых вариантов звука (три версии попадания),
        /// чтобы повторяющееся событие не строчило одним и тем же сэмплом.
        /// </summary>
        public void PlaySoundAnyOf(params string[] soundKeys)
        {
            // Со случайного варианта, но играем первый непустой: незаполненное поле
            // в инспекторе не должно превращаться в тишину вместо звука.
            int start = Random.Range(0, soundKeys.Length);
            for (int i = 0; i < soundKeys.Length; i++)
            {
                string soundKey = soundKeys[(start + i) % soundKeys.Length];
                if (string.IsNullOrEmpty(soundKey))
                    continue;

                PlaySound(soundKey);
                return;
            }
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

        /// <summary>
        /// Сменить громкость УЖЕ играющего звука, не перезапуская его: перезапуск
        /// ради громкости дал бы звук поверх самого себя. React пересчитывает её
        /// той же формулой, что при старте, поэтому здесь — тот же множитель
        /// 0..1, что и в PlaySound. Ключ, который сейчас не играет, — no-op.
        ///
        /// Дедуп кадра сюда не относится: это не новый звук, звать из Update
        /// безопасно.
        /// </summary>
        public void SetVolume(string soundKey, float volume)
        {
            if (string.IsNullOrEmpty(soundKey))
                return;

#if UNITY_EDITOR
            _preview.SetVolume(soundKey, volume);
#else
            WebBridgeUtils.Send(AudioMessages.SetVolume(soundKey, volume));
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

        private bool WasSentThisFrame(string soundKey)
        {
            int frame = Time.frameCount;
            if (_lastSentFrame.TryGetValue(soundKey, out int sent) && sent == frame)
                return true;

            _lastSentFrame[soundKey] = frame;
            return false;
        }
    }
}
