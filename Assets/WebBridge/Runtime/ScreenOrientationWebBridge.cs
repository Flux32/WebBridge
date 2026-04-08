using System;
using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    public class ScreenOrientationWebBridge : MonoBehaviour
    {
        [Header("Mock")]
        [SerializeField, Min(0.01f)] private float _mockMobileAspectRatio = 1.1f;

        private int _lastMockOrientation = -1;

        public static ScreenOrientationWebBridge Instance { get; private set; }

        public event Action<int> OrientationChanged;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogError($"Instance {nameof(ScreenOrientationWebBridge)} already exists.");
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

#if UNITY_EDITOR
        private void Update()
        {
            if (!WebBridgeUtils.IsMockEnabled)
                return;

            int orientation = CalculateMockOrientation();
            if (orientation == _lastMockOrientation)
                return;

            _lastMockOrientation = orientation;
            ChangeOrientation(orientation);
        }

        private int CalculateMockOrientation()
        {
            float aspectRatio = Screen.width / (float)Mathf.Max(1, Screen.height);
            return aspectRatio <= _mockMobileAspectRatio ? 1 : 0;
        }
#endif

        public void ChangeOrientation(int orientation)
        {
            OrientationChanged?.Invoke(orientation);
        }
    }
}
