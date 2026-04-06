using UnityEngine;

namespace Modules.Road
{
    [CreateAssetMenu(fileName = "SoundKeys", menuName = "WebBridge/Sound Keys")]
    public class SoundKeys : ScriptableObject
    {
        [SerializeField] private string[] _keys = System.Array.Empty<string>();

        public string[] Keys => _keys;
    }
}
