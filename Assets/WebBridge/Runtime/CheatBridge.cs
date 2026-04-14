using System.Globalization;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    public static class CheatBridge
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void CheatPostRngOn(string nonce);

        [DllImport("__Internal")]
        private static extern void CheatPostRngOff();
#endif

        public static void SendOn(int nonce)
        {
            string nonceStr = nonce.ToString(CultureInfo.InvariantCulture);
#if UNITY_WEBGL && !UNITY_EDITOR
            CheatPostRngOn(nonceStr);
#endif
            Debug.Log($"[CheatBridge] RNG ON nonce={nonceStr}");
        }

        public static void SendOff()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            CheatPostRngOff();
#endif
            Debug.Log("[CheatBridge] RNG OFF");
        }
    }
}
