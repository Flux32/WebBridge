using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    [CreateAssetMenu(fileName = "SoundKeys", menuName = "WebBridge/Sound Keys")]
    public class SoundKeys : ScriptableObject
    {
        [SerializeField] private string[] _keys = System.Array.Empty<string>();
        [SerializeField] private string _soundFolderPath = "";

        public string[] Keys => _keys;
        public string SoundFolderPath => _soundFolderPath;
    }
}
