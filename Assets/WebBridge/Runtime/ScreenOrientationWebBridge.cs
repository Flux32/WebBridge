using System;
using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    public enum ScreenOrientationType
    {
        Desktop = 0,
        Mobile = 1
    }

    [Preserve]
    public class ScreenOrientationWebBridge : MonoBehaviour
    {
        [Header("Mock")]
        [SerializeField, Min(0.01f)] private float _mockMobileAspectRatio = 1.1f;

        private ScreenOrientationType? _lastMockOrientation;
        private ScreenOrientationType _currentOrientation;

        public static ScreenOrientationWebBridge Instance { get; private set; }

        public ScreenOrientationType CurrentOrientation => _currentOrientation;

        public event Action<ScreenOrientationType> OrientationChanged;

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

            ScreenOrientationType orientation = CalculateMockOrientation();
            if (orientation == _lastMockOrientation)
                return;

            _lastMockOrientation = orientation;
            ChangeOrientation(orientation);
        }

        private ScreenOrientationType CalculateMockOrientation()
        {
            float aspectRatio = Screen.width / (float)Mathf.Max(1, Screen.height);
            return aspectRatio <= _mockMobileAspectRatio
                ? ScreenOrientationType.Mobile
                : ScreenOrientationType.Desktop;
        }
#endif

        public void ChangeOrientation(ScreenOrientationType orientation)
        {
            _currentOrientation = orientation;
            OrientationChanged?.Invoke(orientation);
        }
    }
}
