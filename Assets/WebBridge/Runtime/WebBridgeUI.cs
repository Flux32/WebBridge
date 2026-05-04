using System;
using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    public class WebBridgeUI : MonoBehaviour
    {
        public static WebBridgeUI Instance { get; private set; }

        // Reflects React-side TransitionScreen state — set on OpenStarted /
        // cleared on CloseFinished events from React.
        public bool IsTransitionScreenOpen { get; private set; }

        public event Action TransitionScreenOpenStarted;
        public event Action TransitionScreenOpenFinished;
        public event Action TransitionScreenCloseStarted;
        public event Action TransitionScreenCloseFinished;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogError($"Instance {nameof(WebBridgeUI)} already exists.");
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

        // ───────────────────────── React → Unity ─────────────────────────
        // React owns the TransitionScreen lifecycle entirely now. It opens
        // gates after YouWinFreeGames is dismissed (bonus start) or after
        // receiving the `BonusEnded` signal from Unity (bonus end), runs its
        // IN/IDLE/OUT animations, and notifies Unity at each phase via the
        // SendMessage receivers below. Unity doesn't initiate the open/close.

        public void OnTransitionScreenOpenStarted()
        {
            Debug.Log("[WebBridgeUI] OnTransitionScreenOpenStarted received from React");
            IsTransitionScreenOpen = true;
            TransitionScreenOpenStarted?.Invoke();
        }

        public void OnTransitionScreenOpenFinished()
        {
            int subscriberCount = TransitionScreenOpenFinished?.GetInvocationList().Length ?? 0;
            Debug.Log($"[WebBridgeUI] OnTransitionScreenOpenFinished received from React — subscribers={subscriberCount}");
            TransitionScreenOpenFinished?.Invoke();
        }

        public void OnTransitionScreenCloseStarted()
        {
            Debug.Log("[WebBridgeUI] OnTransitionScreenCloseStarted received from React");
            TransitionScreenCloseStarted?.Invoke();
        }

        public void OnTransitionScreenCloseFinished()
        {
            int subscriberCount = TransitionScreenCloseFinished?.GetInvocationList().Length ?? 0;
            Debug.Log($"[WebBridgeUI] OnTransitionScreenCloseFinished received from React — subscribers={subscriberCount}");
            IsTransitionScreenOpen = false;
            TransitionScreenCloseFinished?.Invoke();
        }
    }
}
