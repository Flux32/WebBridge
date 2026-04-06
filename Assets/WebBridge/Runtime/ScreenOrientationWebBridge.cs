using System;
using UnityEngine;

namespace Modules.Road
{
    public class ScreenOrientationWebBridge : MonoBehaviour
    {
        [Header("UI Layout")]
        [SerializeField, Min(0.01f)] private float _mobileMaxAspectRatio = 1.1f;

        [Header("Mock")]
        [SerializeField] private bool _useMockAspectRatio;
        [SerializeField, Min(0.01f)] private float _mockAspectRatio = 1f;

        private int? _lastOrientationPayload;

        public static ScreenOrientationWebBridge Instance { get; private set; }

        public event Action<bool> OrientationChanged;
        public event Action<int> OrientationRawChanged;

        public bool IsMobileUi => (_useMockAspectRatio || !_lastOrientationPayload.HasValue)
            ? CalculateIsMobileUiByAspect(GetEffectiveAspectRatio())
            : _lastOrientationPayload.Value > 0;

        public bool UseMockAspectRatio => _useMockAspectRatio;
        public float MockAspectRatio => _mockAspectRatio;
        public float CurrentAspectRatio => GetEffectiveAspectRatio();

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

        private void Start()
        {
            OrientationChanged?.Invoke(IsMobileUi);
        }

        private void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        public void ChangeOrientation(int orientation)
        {
            _lastOrientationPayload = orientation <= 0 ? 0 : 1;
            OrientationChanged?.Invoke(IsMobileUi);
            OrientationRawChanged?.Invoke(orientation);
        }

        public void SetUseMockAspectRatio(bool useMockAspectRatio)
        {
            if (_useMockAspectRatio == useMockAspectRatio)
                return;

            _useMockAspectRatio = useMockAspectRatio;
            OrientationChanged?.Invoke(IsMobileUi);
        }

        public void SetMockAspectRatio(float aspectRatio)
        {
            float normalizedAspectRatio = Mathf.Max(0.01f, aspectRatio);
            if (Mathf.Approximately(_mockAspectRatio, normalizedAspectRatio))
                return;

            _mockAspectRatio = normalizedAspectRatio;
            OrientationChanged?.Invoke(IsMobileUi);
        }

        private float GetEffectiveAspectRatio()
        {
            if (_useMockAspectRatio)
                return Mathf.Max(0.01f, _mockAspectRatio);

            int height = Mathf.Max(1, Screen.height);
            int width = Mathf.Max(1, Screen.width);
            return width / (float)height;
        }

        private bool CalculateIsMobileUiByAspect(float aspectRatio)
        {
            float threshold = Mathf.Max(0.01f, _mobileMaxAspectRatio);
            return aspectRatio <= threshold;
        }
    }
}
