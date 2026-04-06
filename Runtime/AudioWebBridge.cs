using UnityEngine;

namespace Modules.Road
{
    public class AudioWebBridge : MonoBehaviour
    {
        private const string PlaySoundMessageBase = "PlaySound_";
        private const string PlayMusicMessageBase = "PlayMusic_";

        public static AudioWebBridge Instance { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogError($"Instance {nameof(AudioWebBridge)} already exists.");
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

        public void PlaySound(Sounds sound)
        {
            Debug.Log($"Play sound: {sound}");
            WebBridgeUtils.Send(PlaySoundMessageBase + (int)sound);
        }

        public void PlayMusic(Sounds sound)
        {
            Debug.Log($"Play music: {sound}");
            WebBridgeUtils.Send(PlayMusicMessageBase + (int)sound);
        }
    }
}
