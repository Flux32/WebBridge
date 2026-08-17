using System.Globalization;
using UnityEngine;

namespace Modules.Road
{
    /// <summary>
    /// Формат звуковых сообщений моста: `{Команда}_{ключ}` и необязательный
    /// суффикс громкости `|{0..1}`. React разбирает его в unityProtocol.ts —
    /// менять формат можно только парно с ним.
    /// </summary>
    public static class AudioMessages
    {
        private const string PlaySoundBase = "PlaySound_";
        private const string PlayMusicBase = "PlayMusic_";
        private const string PlayLoopBase = "PlayLoop_";
        private const string StopLoopBase = "StopLoop_";
        private const string SetVolumeBase = "SetVolume_";
        private const char VolumeSeparator = '|';

        public static string PlaySound(string soundKey, float? volume) => Build(PlaySoundBase, soundKey, volume);

        public static string PlayMusic(string soundKey, float? volume) => Build(PlayMusicBase, soundKey, volume);

        public static string PlayLoop(string soundKey, float? volume) => Build(PlayLoopBase, soundKey, volume);

        public static string StopLoop(string soundKey) => StopLoopBase + soundKey;

        /// <summary>Громкость здесь обязательна: без суффикса React команду отбрасывает.</summary>
        public static string SetVolume(string soundKey, float volume) => Build(SetVolumeBase, soundKey, volume);

        private static string Build(string messageBase, string soundKey, float? volume)
        {
            if (!volume.HasValue)
                return messageBase + soundKey;

            float clamped = Mathf.Clamp01(volume.Value);
            return messageBase + soundKey + VolumeSeparator + clamped.ToString(CultureInfo.InvariantCulture);
        }
    }
}
