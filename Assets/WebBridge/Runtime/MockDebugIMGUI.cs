using System;
using System.Reflection;
using UnityEngine;

namespace Modules.Road
{
    public class MockDebugIMGUI : MonoBehaviour
    {
        private const float ButtonSize = 60f;
        private const float DragThreshold = 10f;
        private const float StepLoseChance = 0.05f;
        private const float StepBonusChance = 0.05f;

        private static readonly MethodInfo SetMockDifficultyMethod = typeof(GameWebBridge)
            .GetMethod("SetMockDifficulty", BindingFlags.NonPublic | BindingFlags.Instance);

        private Vector2 _buttonPosition;
        private bool _isPanelOpen;
        private bool _isDragging;
        private Vector2 _dragOffset;
        private Vector2 _pointerDownPosition;
        private bool _pointerDown;

        private GUIStyle _buttonStyle;
        private GUIStyle _panelStyle;
        private GUIStyle _labelStyle;
        private GUIStyle _controlButtonStyle;
        private GUIStyle _closeButtonStyle;
        private GUIStyle _valueStyle;
        private bool _stylesInitialized;

        private void Awake()
        {
            _buttonPosition = new Vector2(20f, Screen.height * 0.5f);
        }

        private void InitStyles()
        {
            if (_stylesInitialized)
                return;

            _stylesInitialized = true;

            _buttonStyle = new GUIStyle(GUI.skin.box)
            {
                fontSize = 14,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Color.white }
            };

            Texture2D buttonBg = MakeTexture(1, 1, new Color(0.2f, 0.2f, 0.2f, 0.85f));
            _buttonStyle.normal.background = buttonBg;

            _panelStyle = new GUIStyle(GUI.skin.box);
            Texture2D panelBg = MakeTexture(1, 1, new Color(0.1f, 0.1f, 0.1f, 0.92f));
            _panelStyle.normal.background = panelBg;

            _labelStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 16,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleLeft,
                normal = { textColor = Color.white }
            };

            _valueStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 16,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = new Color(0.4f, 0.9f, 0.4f) }
            };

            _controlButtonStyle = new GUIStyle(GUI.skin.button)
            {
                fontSize = 20,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter
            };

            _closeButtonStyle = new GUIStyle(GUI.skin.button)
            {
                fontSize = 14,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter
            };
        }

        private void OnGUI()
        {
            InitStyles();

            if (_isPanelOpen)
                DrawPanel();

            DrawDraggableButton();
        }

        private void DrawDraggableButton()
        {
            Rect buttonRect = new Rect(_buttonPosition.x, _buttonPosition.y, ButtonSize, ButtonSize);
            int controlId = GUIUtility.GetControlID(FocusType.Passive);
            Event current = Event.current;

            switch (current.type)
            {
                case EventType.MouseDown when buttonRect.Contains(current.mousePosition):
                    GUIUtility.hotControl = controlId;
                    _pointerDown = true;
                    _pointerDownPosition = current.mousePosition;
                    _dragOffset = _buttonPosition - current.mousePosition;
                    _isDragging = false;
                    current.Use();
                    break;

                case EventType.MouseDrag when GUIUtility.hotControl == controlId:
                    Vector2 delta = current.mousePosition - _pointerDownPosition;
                    if (!_isDragging && delta.magnitude > DragThreshold)
                        _isDragging = true;

                    if (_isDragging)
                    {
                        _buttonPosition = current.mousePosition + _dragOffset;
                        ClampButtonPosition();
                    }

                    current.Use();
                    break;

                case EventType.MouseUp when GUIUtility.hotControl == controlId:
                    GUIUtility.hotControl = 0;
                    if (_pointerDown && !_isDragging)
                        _isPanelOpen = !_isPanelOpen;

                    _pointerDown = false;
                    _isDragging = false;
                    current.Use();
                    break;
            }

            GUI.Box(buttonRect, "DBG", _buttonStyle);
        }

        private void DrawPanel()
        {
            GameWebBridge bridge = GameWebBridge.Instance;
            if (bridge == null)
                return;

            float panelWidth = 320f;
            float rowHeight = 40f;
            float padding = 12f;
            float arrowWidth = 44f;
            int rows = 4;
            float panelHeight = padding * 2 + rowHeight * rows + padding * (rows - 1) + 44f;

            float panelX = Mathf.Clamp(
                _buttonPosition.x + ButtonSize + 10f,
                0f,
                Screen.width - panelWidth);
            float panelY = Mathf.Clamp(
                _buttonPosition.y,
                0f,
                Screen.height - panelHeight);

            Rect panelRect = new Rect(panelX, panelY, panelWidth, panelHeight);
            GUI.Box(panelRect, GUIContent.none, _panelStyle);

            float contentX = panelRect.x + padding;
            float contentWidth = panelWidth - padding * 2;
            float y = panelRect.y + padding;

            GUI.Label(new Rect(contentX, y, contentWidth - 36f, rowHeight), "Mock Debug", _labelStyle);

            if (GUI.Button(new Rect(panelRect.xMax - padding - 32f, y + 4f, 32f, 32f), "X", _closeButtonStyle))
                _isPanelOpen = false;

            y += rowHeight + padding;

            DrawRow(contentX, y, contentWidth, rowHeight, arrowWidth,
                "Difficulty", bridge.CurrentMockDifficulty,
                () => CycleDifficulty(bridge, -1),
                () => CycleDifficulty(bridge, 1));
            y += rowHeight + padding;

            DrawRow(contentX, y, contentWidth, rowHeight, arrowWidth,
                "Lose %", $"{bridge.MockLoseChance * 100f:F0}%",
                () => bridge.MockLoseChance -= StepLoseChance,
                () => bridge.MockLoseChance += StepLoseChance);
            y += rowHeight + padding;

            DrawRow(contentX, y, contentWidth, rowHeight, arrowWidth,
                "Bonus %", $"{bridge.MockBonusStepTriggerChance * 100f:F0}%",
                () => bridge.MockBonusStepTriggerChance -= StepBonusChance,
                () => bridge.MockBonusStepTriggerChance += StepBonusChance);
        }

        private void DrawRow(
            float x, float y, float width, float height, float arrowWidth,
            string label, string value,
            Action onLeft, Action onRight)
        {
            float labelWidth = 90f;
            float valueWidth = width - labelWidth - arrowWidth * 2 - 8f;

            GUI.Label(new Rect(x, y, labelWidth, height), label, _labelStyle);

            float controlX = x + labelWidth;

            if (GUI.Button(new Rect(controlX, y + 2f, arrowWidth, height - 4f), "<", _controlButtonStyle))
                onLeft?.Invoke();

            GUI.Label(new Rect(controlX + arrowWidth + 2f, y, valueWidth - 4f, height), value, _valueStyle);

            if (GUI.Button(new Rect(controlX + arrowWidth + valueWidth, y + 2f, arrowWidth, height - 4f), ">", _controlButtonStyle))
                onRight?.Invoke();
        }

        private static void CycleDifficulty(GameWebBridge bridge, int direction)
        {
            MockConfig config = MockConfig.Instance;
            if (config == null || config.Difficulties.Count == 0)
                return;

            int currentIndex = -1;
            for (int i = 0; i < config.Difficulties.Count; i++)
            {
                if (string.Equals(config.Difficulties[i].Name, bridge.CurrentMockDifficulty,
                        StringComparison.OrdinalIgnoreCase))
                {
                    currentIndex = i;
                    break;
                }
            }

            if (currentIndex < 0)
                currentIndex = 0;

            int count = config.Difficulties.Count;
            int nextIndex = (currentIndex + direction % count + count) % count;
            string newDifficulty = config.Difficulties[nextIndex].Name;

            SetMockDifficultyMethod.Invoke(bridge, new object[] { newDifficulty });
        }

        private void ClampButtonPosition()
        {
            _buttonPosition.x = Mathf.Clamp(_buttonPosition.x, 0f, Screen.width - ButtonSize);
            _buttonPosition.y = Mathf.Clamp(_buttonPosition.y, 0f, Screen.height - ButtonSize);
        }

        private static Texture2D MakeTexture(int width, int height, Color color)
        {
            Texture2D texture = new Texture2D(width, height, TextureFormat.RGBA32, false)
            {
                hideFlags = HideFlags.HideAndDontSave
            };

            Color[] pixels = new Color[width * height];
            for (int i = 0; i < pixels.Length; i++)
                pixels[i] = color;

            texture.SetPixels(pixels);
            texture.Apply();
            return texture;
        }
    }
}
