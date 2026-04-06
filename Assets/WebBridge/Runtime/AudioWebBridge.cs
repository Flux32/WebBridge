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

        public void PlaySound(string soundKey)
        {
            Debug.Log($"Play sound: {soundKey}");
            WebBridgeUtils.Send(PlaySoundMessageBase + soundKey);
        }

        public void PlayMusic(string soundKey)
        {
            Debug.Log($"Play music: {soundKey}");
            WebBridgeUtils.Send(PlayMusicMessageBase + soundKey);
        }
    }
}
