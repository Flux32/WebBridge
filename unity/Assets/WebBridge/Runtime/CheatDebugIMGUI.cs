using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    public class CheatDebugIMGUI : MonoBehaviour
    {
        private const float ButtonSize = 60f;
        private const float DragThreshold = 10f;

        private enum Difficulty { Easy, Medium, Hard, Daredevil }

        private enum Scenario
        {
            FullPath,
            FullPathPlusCoins,
            FullBonusPath,
            BonusCoef50Plus,
            BonusCoef25To49,
        }

        private static readonly Difficulty[] Difficulties =
        {
            Difficulty.Easy, Difficulty.Medium, Difficulty.Hard, Difficulty.Daredevil,
        };

        private static readonly Scenario[] Scenarios =
        {
            Scenario.FullPath,
            Scenario.FullPathPlusCoins,
            Scenario.FullBonusPath,
            Scenario.BonusCoef50Plus,
            Scenario.BonusCoef25To49,
        };

        private static readonly Dictionary<(Difficulty, Scenario), int> NonceTable =
            new Dictionary<(Difficulty, Scenario), int>
            {
                { (Difficulty.Easy,      Scenario.FullPath), 43 },
                { (Difficulty.Medium,    Scenario.FullPath), 1461 },
                { (Difficulty.Hard,      Scenario.FullPath), 82613 },
                { (Difficulty.Daredevil, Scenario.FullPath), 3670057 },

                { (Difficulty.Easy,      Scenario.FullPathPlusCoins), 4146 },
                { (Difficulty.Medium,    Scenario.FullPathPlusCoins), 23749 },
                { (Difficulty.Hard,      Scenario.FullPathPlusCoins), 333805 },
                { (Difficulty.Daredevil, Scenario.FullPathPlusCoins), 3670057 },

                { (Difficulty.Easy,      Scenario.FullBonusPath), 1 },
                { (Difficulty.Medium,    Scenario.FullBonusPath), 242 },
                { (Difficulty.Hard,      Scenario.FullBonusPath), 1062 },
                { (Difficulty.Daredevil, Scenario.FullBonusPath), 79008 },

                { (Difficulty.Easy, Scenario.BonusCoef50Plus), 1 },
                { (Difficulty.Easy, Scenario.BonusCoef25To49), 111 },
            };

        private Vector2 _buttonPosition;
        private bool _isPanelOpen;
        private bool _isDragging;
        private Vector2 _dragOffset;
        private Vector2 _pointerDownPosition;
        private bool _pointerDown;

        private int _difficultyIndex;
        private int _scenarioIndex;

        private GUIStyle _buttonStyle;
        private GUIStyle _panelStyle;
        private GUIStyle _labelStyle;
        private GUIStyle _controlButtonStyle;
        private GUIStyle _closeButtonStyle;
        private GUIStyle _valueStyle;
        private GUIStyle _actionButtonStyle;
        private GUIStyle _hintStyle;
        private GUIStyle _scenarioButtonStyle;
        private GUIStyle _scenarioSelectedButtonStyle;
        private bool _stylesInitialized;

        private void Awake()
        {
            _buttonPosition = new Vector2(Screen.width - ButtonSize - 20f, Screen.height * 0.5f);
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
                normal = { textColor = Color.white },
            };
            _buttonStyle.normal.background = MakeTexture(1, 1, new Color(0.85f, 0.25f, 0.25f, 0.92f));

            _panelStyle = new GUIStyle(GUI.skin.box);
            _panelStyle.normal.background = MakeTexture(1, 1, new Color(0.1f, 0.1f, 0.1f, 0.94f));

            _labelStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 16,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleLeft,
                normal = { textColor = Color.white },
            };

            _valueStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 16,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = new Color(0.4f, 0.9f, 0.4f) },
            };

            _controlButtonStyle = new GUIStyle(GUI.skin.button)
            {
                fontSize = 20,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
            };

            _closeButtonStyle = new GUIStyle(GUI.skin.button)
            {
                fontSize = 14,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
            };

            _actionButtonStyle = new GUIStyle(GUI.skin.button)
            {
                fontSize = 16,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
            };

            _hintStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 12,
                fontStyle = FontStyle.Italic,
                alignment = TextAnchor.UpperLeft,
                wordWrap = true,
                normal = { textColor = new Color(0.75f, 0.75f, 0.75f) },
            };

            _scenarioButtonStyle = new GUIStyle(GUI.skin.button)
            {
                fontSize = 14,
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleLeft,
                padding = new RectOffset(12, 12, 4, 4),
            };

            _scenarioSelectedButtonStyle = new GUIStyle(_scenarioButtonStyle)
            {
                normal = { textColor = Color.white, background = MakeTexture(1, 1, new Color(0.2f, 0.55f, 0.95f, 1f)) },
                hover = { textColor = Color.white, background = MakeTexture(1, 1, new Color(0.25f, 0.6f, 1f, 1f)) },
                active = { textColor = Color.white, background = MakeTexture(1, 1, new Color(0.15f, 0.45f, 0.85f, 1f)) },
                focused = { textColor = Color.white, background = MakeTexture(1, 1, new Color(0.2f, 0.55f, 0.95f, 1f)) },
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

            GUI.Box(buttonRect, "CHT", _buttonStyle);
        }

        private void DrawPanel()
        {
            float panelWidth = 360f;
            float rowHeight = 40f;
            float padding = 12f;
            float arrowWidth = 44f;

            float headerHeight = 40f;
            float actionsHeight = 46f;
            float hintHeight = 48f;
            float scenarioLabelHeight = 24f;
            float scenarioButtonHeight = 34f;
            float scenarioGap = 6f;
            float scenarioBlockHeight = scenarioLabelHeight
                                        + scenarioButtonHeight * Scenarios.Length
                                        + scenarioGap * (Scenarios.Length - 1);

            float panelHeight = padding * 2
                                + headerHeight
                                + rowHeight + padding            // Difficulty
                                + scenarioBlockHeight + padding  // Scenario block
                                + rowHeight + padding            // Nonce
                                + actionsHeight + padding        // Apply / Off
                                + hintHeight;

            float panelX = Mathf.Clamp(_buttonPosition.x - panelWidth - 10f, 0f, Screen.width - panelWidth);
            float panelY = Mathf.Clamp(_buttonPosition.y, 0f, Screen.height - panelHeight);

            Rect panelRect = new Rect(panelX, panelY, panelWidth, panelHeight);
            GUI.Box(panelRect, GUIContent.none, _panelStyle);

            float contentX = panelRect.x + padding;
            float contentWidth = panelWidth - padding * 2;
            float y = panelRect.y + padding;

            GUI.Label(new Rect(contentX, y, contentWidth - 36f, headerHeight), "Cheats", _labelStyle);
            if (GUI.Button(new Rect(panelRect.xMax - padding - 32f, y + 4f, 32f, 32f), "X", _closeButtonStyle))
                _isPanelOpen = false;
            y += headerHeight;

            DrawRow(contentX, y, contentWidth, rowHeight, arrowWidth,
                "Difficulty", DifficultyLabel(Difficulties[_difficultyIndex]),
                () => _difficultyIndex = (_difficultyIndex - 1 + Difficulties.Length) % Difficulties.Length,
                () => _difficultyIndex = (_difficultyIndex + 1) % Difficulties.Length);
            y += rowHeight + padding;

            GUI.Label(new Rect(contentX, y, contentWidth, scenarioLabelHeight), "Scenario", _labelStyle);
            y += scenarioLabelHeight;

            for (int i = 0; i < Scenarios.Length; i++)
            {
                bool isSelected = i == _scenarioIndex;
                GUIStyle style = isSelected ? _scenarioSelectedButtonStyle : _scenarioButtonStyle;
                string prefix = isSelected ? "●  " : "○  ";
                Rect buttonRect = new Rect(contentX, y, contentWidth, scenarioButtonHeight);
                if (GUI.Button(buttonRect, prefix + ScenarioLabel(Scenarios[i]), style))
                    _scenarioIndex = i;

                y += scenarioButtonHeight;
                if (i < Scenarios.Length - 1)
                    y += scenarioGap;
            }
            y += padding;

            int? resolvedNonce = ResolveNonce();
            string nonceDisplay = resolvedNonce.HasValue
                ? resolvedNonce.Value.ToString()
                : "— not available —";

            GUI.Label(new Rect(contentX, y, 100f, rowHeight), "Nonce", _labelStyle);
            GUI.Label(new Rect(contentX + 100f, y, contentWidth - 100f, rowHeight), nonceDisplay, _valueStyle);
            y += rowHeight + padding;

            float actionWidth = (contentWidth - padding) / 2f;
            bool canApply = resolvedNonce.HasValue;

            GUI.enabled = canApply;
            if (GUI.Button(new Rect(contentX, y, actionWidth, actionsHeight), "APPLY", _actionButtonStyle))
                CheatBridge.SendOn(resolvedNonce.Value);
            GUI.enabled = true;

            if (GUI.Button(new Rect(contentX + actionWidth + padding, y, actionWidth, actionsHeight), "OFF", _actionButtonStyle))
                CheatBridge.SendOff();

            y += actionsHeight + padding;

            GUI.Label(new Rect(contentX, y, contentWidth, hintHeight),
                "After each round press OFF — otherwise the next bet will reuse the same nonce.",
                _hintStyle);
        }

        private int? ResolveNonce()
        {
            var key = (Difficulties[_difficultyIndex], Scenarios[_scenarioIndex]);
            return NonceTable.TryGetValue(key, out int v) ? v : (int?)null;
        }

        private static string DifficultyLabel(Difficulty d)
        {
            switch (d)
            {
                case Difficulty.Easy:      return "EASY";
                case Difficulty.Medium:    return "MEDIUM";
                case Difficulty.Hard:      return "HARD";
                case Difficulty.Daredevil: return "DAREDEVIL";
                default:                   return d.ToString();
            }
        }

        private static string ScenarioLabel(Scenario s)
        {
            switch (s)
            {
                case Scenario.FullPath:          return "Full path";
                case Scenario.FullPathPlusCoins: return "Full path + 3 coins";
                case Scenario.FullBonusPath:     return "Full bonus path";
                case Scenario.BonusCoef50Plus:   return "Bonus total 50+";
                case Scenario.BonusCoef25To49:   return "Bonus total 25-49";
                default:                         return s.ToString();
            }
        }

        private void DrawRow(
            float x, float y, float width, float height, float arrowWidth,
            string label, string value,
            Action onLeft, Action onRight)
        {
            float labelWidth = 100f;
            float valueWidth = width - labelWidth - arrowWidth * 2 - 8f;

            GUI.Label(new Rect(x, y, labelWidth, height), label, _labelStyle);

            float controlX = x + labelWidth;

            if (GUI.Button(new Rect(controlX, y + 2f, arrowWidth, height - 4f), "<", _controlButtonStyle))
                onLeft?.Invoke();

            GUI.Label(new Rect(controlX + arrowWidth + 2f, y, valueWidth - 4f, height), value, _valueStyle);

            if (GUI.Button(new Rect(controlX + arrowWidth + valueWidth, y + 2f, arrowWidth, height - 4f), ">", _controlButtonStyle))
                onRight?.Invoke();
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
                hideFlags = HideFlags.HideAndDontSave,
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
