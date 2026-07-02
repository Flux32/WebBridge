using UnityEngine;
using UnityEngine.Scripting;

namespace WebBridge
{
    /// <summary>
    /// Centralized logging for every WebBridge component. Wraps UnityEngine.Debug so the bridge's
    /// informational output can be toggled from one place (e.g. silenced in production) while
    /// warnings and errors always surface. Use this instead of calling Debug.Log* directly.
    /// </summary>
    [Preserve]
    public static class WebBridgeLogger
    {
        /// <summary>
        /// Toggles informational logs (<see cref="Log"/>). Warnings and errors ignore this flag —
        /// they always emit. Default: enabled in the editor, disabled in builds (React can flip it
        /// at runtime via the cheat panel → <c>SetLoggingEnabled</c>).
        /// </summary>
        public static bool IsEnabled { get; set; } =
#if UNITY_EDITOR
            true;
#else
            false;
#endif

        public static void Log(string message)
        {
            if (IsEnabled)
                Debug.Log(message);
        }

        public static void LogWarning(string message)
        {
            Debug.LogWarning(message);
        }

        public static void LogError(string message)
        {
            Debug.LogError(message);
        }
    }
}
