using System;
using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    public class WebBridgeUI : MonoBehaviour
    {
        private const string OpenTransitionScreenMessage = "OpenTransitionScreen";
        private const string CloseTransitionScreenMessage = "CloseTransitionScreen";

        public static WebBridgeUI Instance { get; private set; }

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

        public void OpenTransitionScreen()
        {
            if (IsTransitionScreenOpen)
                return;

            IsTransitionScreenOpen = true;
            WebBridgeUtils.Send(OpenTransitionScreenMessage);
            TransitionScreenOpenStarted?.Invoke();
        }

        public void CloseTransitionScreen()
        {
            if (!IsTransitionScreenOpen)
                return;

            IsTransitionScreenOpen = false;
            WebBridgeUtils.Send(CloseTransitionScreenMessage);
            TransitionScreenCloseStarted?.Invoke();
        }

        // Called from React via SendMessage when the `in` animation completes
        // (gates fully closed).
        public void OnTransitionScreenOpenFinished()
        {
            TransitionScreenOpenFinished?.Invoke();
        }

        // Called from React via SendMessage when the `out` animation completes
        // (gates fully opened, overlay unmounted).
        public void OnTransitionScreenCloseFinished()
        {
            TransitionScreenCloseFinished?.Invoke();
        }
    }
}
