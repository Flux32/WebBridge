using System;
using UnityEngine;
using UnityEngine.Scripting;

namespace WebBridge
{
    /// <summary>
    /// Shared chrome of the in-game debug panels: a draggable round-trip button that toggles a
    /// dark panel, the GUI styles and the row widgets. Derived panels only describe their own
    /// content, so every debug overlay in the package looks and behaves the same.
    /// </summary>
    [Preserve]
    public abstract class DebugPanelIMGUI : MonoBehaviour
    {
        protected const float Padding = 12f;
        protected const float RowHeight = 40f;
        protected const float HeaderHeight = 40f;

        private const float ButtonSize = 60f;
        private const float DragThreshold = 10f;
        private const float ArrowWidth = 44f;
        private const float LabelWidth = 100f;

        private Vector2 _buttonPosition;
        private bool _isPanelOpen;
        private bool _isDragging;
        private bool _pointerDown;
        private Vector2 _dragOffset;
        private Vector2 _pointerDownPosition;
        private bool _stylesInitialized;

        private GUIStyle _toggleButtonStyle;
        private GUIStyle _panelStyle;
        private GUIStyle _optionStyle;
        private GUIStyle _selectedOptionStyle;

        /// <summary>Caption of the collapsed panel button (3 letters fit best).</summary>
        protected abstract string ButtonCaption { get; }

        /// <summary>Background of the collapsed panel button — tells the overlays apart.</summary>
        protected abstract Color ButtonColor { get; }

        /// <summary>Title drawn in the panel header.</summary>
        protected abstract string Title { get; }

        protected abstract float PanelWidth { get; }

        /// <summary>Height of the content area, header and paddings excluded.</summary>
        protected abstract float MeasureContentHeight();

        /// <summary>Draws the panel body inside the rect left by the header and the paddings.</summary>
        protected abstract void DrawContent(Rect content);

        /// <summary>Side of the screen the collapsed button starts on.</summary>
        protected virtual bool IsAnchoredLeft => true;

        protected GUIStyle LabelStyle { get; private set; }
        protected GUIStyle ValueStyle { get; private set; }
        protected GUIStyle HintStyle { get; private set; }
        protected GUIStyle ActionButtonStyle { get; private set; }

        protected virtual void Awake()
        {
            float x = IsAnchoredLeft ? 20f : Screen.width - ButtonSize - 20f;
            _buttonPosition = new Vector2(x, Screen.height * 0.5f);
        }

        private void OnGUI()
        {
            InitStyles();

            if (_isPanelOpen)
                DrawPanel();

            DrawDraggableButton();
        }

        private void InitStyles()
        {
            if (_stylesInitialized)
                return;

            _stylesInitialized = true;

            _toggleButtonStyle = new GUIStyle(GUI.skin.box)
            {
                fontSize = 14,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Color.white, background = MakeTexture(ButtonColor) },
            };

            _panelStyle = new GUIStyle(GUI.skin.box)
            {
                normal = { background = MakeTexture(new Color(0.1f, 0.1f, 0.1f, 0.94f)) },
            };

            LabelStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 16,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleLeft,
                normal = { textColor = Color.white },
            };

            ValueStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 16,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = new Color(0.4f, 0.9f, 0.4f) },
            };

            HintStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 12,
                fontStyle = FontStyle.Italic,
                alignment = TextAnchor.UpperLeft,
                wordWrap = true,
                normal = { textColor = new Color(0.75f, 0.75f, 0.75f) },
            };

            ActionButtonStyle = new GUIStyle(GUI.skin.button)
            {
                fontSize = 16,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
            };

            _optionStyle = new GUIStyle(GUI.skin.button)
            {
                fontSize = 14,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleLeft,
                padding = new RectOffset(12, 12, 4, 4),
            };

            Texture2D selectedBackground = MakeTexture(new Color(0.2f, 0.55f, 0.95f, 1f));
            _selectedOptionStyle = new GUIStyle(_optionStyle)
            {
                normal = { textColor = Color.white, background = selectedBackground },
                hover = { textColor = Color.white, background = MakeTexture(new Color(0.25f, 0.6f, 1f, 1f)) },
                active = { textColor = Color.white, background = MakeTexture(new Color(0.15f, 0.45f, 0.85f, 1f)) },
                focused = { textColor = Color.white, background = selectedBackground },
            };
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
                    if (!_isDragging && (current.mousePosition - _pointerDownPosition).magnitude > DragThreshold)
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

            GUI.Box(buttonRect, ButtonCaption, _toggleButtonStyle);
        }

        private void DrawPanel()
        {
            float panelWidth = PanelWidth;
            float panelHeight = Padding * 2 + HeaderHeight + MeasureContentHeight();

            float panelX = IsAnchoredLeft
                ? _buttonPosition.x + ButtonSize + 10f
                : _buttonPosition.x - panelWidth - 10f;

            Rect panelRect = new Rect(
                Mathf.Clamp(panelX, 0f, Screen.width - panelWidth),
                Mathf.Clamp(_buttonPosition.y, 0f, Screen.height - panelHeight),
                panelWidth,
                panelHeight);

            GUI.Box(panelRect, GUIContent.none, _panelStyle);

            float contentX = panelRect.x + Padding;
            float contentWidth = panelWidth - Padding * 2;
            float y = panelRect.y + Padding;

            GUI.Label(new Rect(contentX, y, contentWidth - 36f, HeaderHeight), Title, LabelStyle);
            if (GUI.Button(new Rect(panelRect.xMax - Padding - 32f, y + 4f, 32f, 32f), "X", _optionStyle))
                _isPanelOpen = false;

            y += HeaderHeight;

            DrawContent(new Rect(contentX, y, contentWidth, panelRect.yMax - Padding - y));
        }

        /// <summary>Label + &lt; value &gt; stepper, the workhorse row of every debug panel.</summary>
        protected void DrawArrowRow(Rect rect, string label, string value, Action onPrevious, Action onNext)
        {
            float valueWidth = rect.width - LabelWidth - ArrowWidth * 2 - 8f;

            GUI.Label(new Rect(rect.x, rect.y, LabelWidth, rect.height), label, LabelStyle);

            float controlX = rect.x + LabelWidth;

            if (GUI.Button(new Rect(controlX, rect.y + 2f, ArrowWidth, rect.height - 4f), "<", ActionButtonStyle))
                onPrevious();

            GUI.Label(new Rect(controlX + ArrowWidth + 2f, rect.y, valueWidth - 4f, rect.height), value, ValueStyle);

            if (GUI.Button(new Rect(controlX + ArrowWidth + valueWidth, rect.y + 2f, ArrowWidth, rect.height - 4f), ">", ActionButtonStyle))
                onNext();
        }

        /// <summary>Radio-style option row. Returns true on the frame the option was clicked.</summary>
        protected bool DrawOption(Rect rect, string label, bool isSelected)
        {
            GUIStyle style = isSelected ? _selectedOptionStyle : _optionStyle;
            return GUI.Button(rect, (isSelected ? "●  " : "○  ") + label, style);
        }

        private void ClampButtonPosition()
        {
            _buttonPosition.x = Mathf.Clamp(_buttonPosition.x, 0f, Screen.width - ButtonSize);
            _buttonPosition.y = Mathf.Clamp(_buttonPosition.y, 0f, Screen.height - ButtonSize);
        }

        private static Texture2D MakeTexture(Color color)
        {
            Texture2D texture = new Texture2D(1, 1, TextureFormat.RGBA32, false)
            {
                hideFlags = HideFlags.HideAndDontSave,
            };

            texture.SetPixels(new[] { color });
            texture.Apply();
            return texture;
        }
    }
}
