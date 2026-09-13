using System;
using UnityEngine;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.PlinkoAztec
{
    /// <summary>
    /// Editor-play overlay that stands in for the React bet bar: pick balls-per-drop and a
    /// scenario, press DROP, and the bridge receives the same payload the platform would send.
    /// The Plinko Aztec bridge adds it to its own GameObject in mock mode, so it shows up only
    /// on scenes that actually host the Aztec bridge.
    /// </summary>
    [Preserve]
    public class PlinkoAztecMockDebugIMGUI : DebugPanelIMGUI
    {
        private const float ScenarioLabelHeight = 24f;
        private const float ScenarioButtonHeight = 34f;
        private const float ScenarioGap = 6f;
        private const float ActionsHeight = 46f;
        private const float HintHeight = 40f;

        private static readonly PlinkoAztecMockScenario[] Scenarios =
        {
            PlinkoAztecMockScenario.Random,
            PlinkoAztecMockScenario.TopSlots,
            PlinkoAztecMockScenario.BottomSlots,
            PlinkoAztecMockScenario.FortuneWheel,
            PlinkoAztecMockScenario.BonusGame,
        };

        private int _scenarioIndex;

        protected override string ButtonCaption => "PLK";

        protected override Color ButtonColor => new Color(0.15f, 0.55f, 0.35f, 0.92f);

        protected override string Title => "Plinko Aztec Mock";

        protected override float PanelWidth => 360f;

        protected override float MeasureContentHeight()
        {
            float scenarioBlock = ScenarioLabelHeight
                                  + ScenarioButtonHeight * Scenarios.Length
                                  + ScenarioGap * (Scenarios.Length - 1);

            return RowHeight + Padding
                   + scenarioBlock + Padding
                   + ActionsHeight + Padding
                   + HintHeight;
        }

        protected override void DrawContent(Rect content)
        {
            PlinkoAztecWebBridge bridge = PlinkoAztecWebBridge.Instance;
            float y = content.y;

            DrawArrowRow(
                new Rect(content.x, y, content.width, RowHeight),
                "Balls",
                bridge.CurrentBallsAmount.ToString(),
                () => StepBallsAmount(bridge, -1),
                () => StepBallsAmount(bridge, 1));
            y += RowHeight + Padding;

            GUI.Label(new Rect(content.x, y, content.width, ScenarioLabelHeight), "Scenario", LabelStyle);
            y += ScenarioLabelHeight;

            for (int i = 0; i < Scenarios.Length; i++)
            {
                Rect optionRect = new Rect(content.x, y, content.width, ScenarioButtonHeight);
                if (DrawOption(optionRect, ScenarioLabel(Scenarios[i]), i == _scenarioIndex))
                    _scenarioIndex = i;

                y += ScenarioButtonHeight;
                if (i < Scenarios.Length - 1)
                    y += ScenarioGap;
            }

            y += Padding;

            bool isBonusActive = bridge.IsMockBonusActive;
            float actionWidth = (content.width - Padding * 2) / 3f;

            if (GUI.Button(new Rect(content.x, y, actionWidth, ActionsHeight), "DROP", ActionButtonStyle))
                bridge.PlayMockDrop(Scenarios[_scenarioIndex]);

            GUI.enabled = isBonusActive;
            if (GUI.Button(new Rect(content.x + actionWidth + Padding, y, actionWidth, ActionsHeight), "STEP", ActionButtonStyle))
                bridge.RequestStep();
            GUI.enabled = true;

            if (GUI.Button(new Rect(content.x + (actionWidth + Padding) * 2f, y, actionWidth, ActionsHeight), "RESET", ActionButtonStyle))
                bridge.ResetMockSession();

            y += ActionsHeight + Padding;

            GUI.Label(new Rect(content.x, y, content.width, HintHeight), bridge.MockSessionInfo, HintStyle);
        }

        private static void StepBallsAmount(PlinkoAztecWebBridge bridge, int direction)
        {
            int[] options = bridge.MockBallsAmountOptions;
            int currentIndex = Array.IndexOf(options, bridge.CurrentBallsAmount);
            int nextIndex = (currentIndex + direction + options.Length) % options.Length;
            bridge.SetBallsAmount(options[nextIndex]);
        }

        private static string ScenarioLabel(PlinkoAztecMockScenario scenario)
        {
            switch (scenario)
            {
                case PlinkoAztecMockScenario.TopSlots: return "All balls → top slot";
                case PlinkoAztecMockScenario.BottomSlots: return "All balls → bottom slot";
                case PlinkoAztecMockScenario.FortuneWheel: return "Fortune wheel multiplier";
                case PlinkoAztecMockScenario.BonusGame: return "Fortune wheel → bonus game";
                default: return "Random drop";
            }
        }
    }
}
