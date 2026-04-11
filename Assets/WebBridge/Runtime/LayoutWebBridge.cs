using System;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    public class LayoutWebBridge : MonoBehaviour
    {
        private const string UiVisibilityMessageBase = "UiVisibility_";

        [Header("Web UI")]
        [SerializeField] private bool _hideDesktopBetBar;
        [SerializeField] private bool _hideMobileBetBar;
        [SerializeField] private bool _hideMobileLastWin;
        [SerializeField] private bool _hideSettingsMenuButton;
        [SerializeField] private bool _hideLogo;
        [SerializeField] private bool _hideBottomBalancePanel = true;
        [SerializeField] private bool _desktopBetBarInteractable = true;
        [SerializeField] private bool _mobileBetBarInteractable = true;

        public static LayoutWebBridge Instance { get; private set; }

        public event Action<WebMobileBetBarViewportPayload> MobileBetBarViewportChanged;
        public event Action<WebBetBarHideStatePayload> BetBarHideStateChanged;

        public float MobileBetBarViewportWidth { get; private set; }
        public float MobileBetBarViewportHeightEnd { get; private set; }
        public Vector2 MobileBetBarBonusButtonRight { get; private set; }
        public Vector2 MobileBetBarRight { get; private set; }
        public bool IsDesktopBetBarHidden => _hideDesktopBetBar;
        public bool IsMobileBetBarHidden => _hideMobileBetBar;
        public bool IsMobileLastWinHidden => _hideMobileLastWin;
        public bool IsSettingsMenuButtonHidden => _hideSettingsMenuButton;
        public bool IsLogoHidden => _hideLogo;
        public bool IsBottomBalancePanelHidden => _hideBottomBalancePanel;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogError($"Instance {nameof(LayoutWebBridge)} already exists.");
                Destroy(gameObject);
                return;
            }

            Instance = this;
        }

        private void Start()
        {
            SyncUiVisibility();
            NotifyBetBarHideStateChanged();
        }

        private void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        public void SetMobileBetBarViewportMetrics(string payload)
        {
            WebMobileBetBarViewportPayload viewport =
                WebBridgeUtils.DeserializePayload<WebMobileBetBarViewportPayload>(payload, nameof(SetMobileBetBarViewportMetrics));
            if (viewport == null)
                return;

            float width = Mathf.Clamp01(viewport.WidthViewport);
            float heightEnd = Mathf.Clamp01(viewport.HeightEndViewport);
            Vector2 bonusButtonRight = ClampViewportPoint(viewport.BonusButtonRight);
            Vector2 betBarRight = ClampViewportPoint(viewport.BetBarRight);

            bool hasChanged = !Mathf.Approximately(MobileBetBarViewportWidth, width)
                              || !Mathf.Approximately(MobileBetBarViewportHeightEnd, heightEnd)
                              || MobileBetBarBonusButtonRight != bonusButtonRight
                              || MobileBetBarRight != betBarRight;

            MobileBetBarViewportWidth = width;
            MobileBetBarViewportHeightEnd = heightEnd;
            MobileBetBarBonusButtonRight = bonusButtonRight;
            MobileBetBarRight = betBarRight;

            if (!hasChanged)
                return;

            MobileBetBarViewportChanged?.Invoke(new WebMobileBetBarViewportPayload
            {
                WidthViewport = width,
                HeightEndViewport = heightEnd,
                BonusButtonRight = new WebViewportPoint { X = bonusButtonRight.x, Y = bonusButtonRight.y },
                BetBarRight = new WebViewportPoint { X = betBarRight.x, Y = betBarRight.y }
            });
        }

        private static Vector2 ClampViewportPoint(WebViewportPoint point)
        {
            if (point == null)
                return Vector2.zero;

            return new Vector2(Mathf.Clamp01(point.X), Mathf.Clamp01(point.Y));
        }

        public void SetHideDesktopBetBar(bool isHidden)
        {
            if (_hideDesktopBetBar == isHidden)
            {
                NotifyBetBarHideStateChanged();
                return;
            }

            _hideDesktopBetBar = isHidden;
            NotifyBetBarHideStateChanged();
            SyncUiVisibility();
        }

        public void SetHideMobileBetBar(bool isHidden)
        {
            if (_hideMobileBetBar == isHidden)
            {
                NotifyBetBarHideStateChanged();
                return;
            }

            _hideMobileBetBar = isHidden;
            NotifyBetBarHideStateChanged();
            SyncUiVisibility();
        }

        public void SetHideSettingsMenuButton(bool isHidden)
        {
            if (_hideSettingsMenuButton == isHidden)
                return;

            _hideSettingsMenuButton = isHidden;
            SyncUiVisibility();
        }

        public void SetHideMobileLastWin(bool isHidden)
        {
            if (_hideMobileLastWin == isHidden)
                return;

            _hideMobileLastWin = isHidden;
            SyncUiVisibility();
        }

        public void SetHideLogo(bool isHidden)
        {
            if (_hideLogo == isHidden)
                return;

            _hideLogo = isHidden;
            SyncUiVisibility();
        }

        public void SetHideBottomBalancePanel(bool isHidden)
        {
            if (_hideBottomBalancePanel == isHidden)
                return;

            _hideBottomBalancePanel = isHidden;
            SyncUiVisibility();
        }

        public void HideBottomBalancePanel()
        {
            SetHideBottomBalancePanel(true);
        }

        public void ShowBottomBalancePanel()
        {
            SetHideBottomBalancePanel(false);
        }

        public void SetBetBarInteractable(bool isInteractable)
        {
            if (_desktopBetBarInteractable == isInteractable)
                return;

            _desktopBetBarInteractable = isInteractable;

            if (_hideDesktopBetBar)
                return;

            SyncUiVisibility();
        }

        public void SetMobileBetBarInteractable(bool isInteractable)
        {
            if (_mobileBetBarInteractable == isInteractable)
                return;

            _mobileBetBarInteractable = isInteractable;

            if (_hideMobileBetBar)
                return;

            SyncUiVisibility();
        }

        public void SyncUiVisibility()
        {
            WebUiVisibilityPayload payload = new WebUiVisibilityPayload
            {
                HideDesktopBetBar = _hideDesktopBetBar,
                HideMobileBetBar = _hideMobileBetBar,
                HideMobileLastWin = _hideMobileLastWin,
                HideSettingsMenuButton = _hideSettingsMenuButton,
                HideLogo = _hideLogo,
                HideBottomBalancePanel = _hideBottomBalancePanel,
                DesktopBetBarInteractable = _desktopBetBarInteractable,
                MobileBetBarInteractable = _mobileBetBarInteractable
            };

            WebBridgeUtils.Send(UiVisibilityMessageBase + JsonConvert.SerializeObject(payload));
        }

        private void NotifyBetBarHideStateChanged()
        {
            BetBarHideStateChanged?.Invoke(new WebBetBarHideStatePayload
            {
                HideDesktopBetBar = _hideDesktopBetBar,
                HideMobileBetBar = _hideMobileBetBar
            });
        }
    }
}
