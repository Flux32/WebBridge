using UnityEngine;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Jumper
{
    /// <summary>
    /// Mock-mode overlay that stands in for the React bet bar: pick the difficulty, bet, jump,
    /// cash out, buy a bonus series or switch autoplay, and the bridge receives the same payloads
    /// the platform would send. The jumper bridge adds it to its own GameObject in mock mode.
    /// </summary>
    [Preserve]
    public class JumperMockDebugIMGUI : DebugPanelIMGUI
    {
        private const float ActionsHeight = 46f;
        private const float HintHeight = 40f;
        private const int ActionsPerRow = 3;

        protected override string ButtonCaption => "JMP";

        protected override Color ButtonColor => new Color(0.55f, 0.35f, 0.85f, 0.92f);

        protected override string Title => "Jumper Mock";

        protected override float PanelWidth => 360f;

        protected override float MeasureContentHeight() =>
            RowHeight + Padding + (ActionsHeight + Padding) * 2f + HintHeight;

        protected override void DrawContent(Rect content)
        {
            JumperWebBridge bridge = JumperWebBridge.Instance;
            JumperMockHost host = bridge.MockHost;
            float y = content.y;

            GUI.enabled = host.CanBet;
            DrawArrowRow(
                new Rect(content.x, y, content.width, RowHeight),
                "Difficulty",
                JumperWireNames.Difficulty.ToWireName(host.Difficulty),
                () => host.StepDifficulty(-1),
                () => host.StepDifficulty(1));
            y += RowHeight + Padding;

            Rect roundRow = new Rect(content.x, y, content.width, ActionsHeight);
            if (DrawAction(roundRow, 0, "BET", host.CanBet))
                host.Bet();
            if (DrawAction(roundRow, 1, "JUMP", host.CanJump))
                host.Jump();
            if (DrawAction(roundRow, 2, "CASHOUT", host.CanCashout))
                host.Cashout();
            y += ActionsHeight + Padding;

            Rect sessionRow = new Rect(content.x, y, content.width, ActionsHeight);
            if (DrawAction(sessionRow, 0, "BONUS", host.CanBet))
                host.BuyBonus();
            if (DrawAction(sessionRow, 1, bridge.IsAutoplayEnabled ? "AUTO ON" : "AUTO OFF", true))
                host.ToggleAutoplay();
            if (DrawAction(sessionRow, 2, "RESET", true))
                host.Reset();
            y += ActionsHeight + Padding;

            GUI.enabled = true;
            GUI.Label(new Rect(content.x, y, content.width, HintHeight), host.SessionInfo, HintStyle);
        }

        private bool DrawAction(Rect row, int column, string caption, bool isEnabled)
        {
            float width = (row.width - Padding * (ActionsPerRow - 1)) / ActionsPerRow;
            Rect rect = new Rect(row.x + (width + Padding) * column, row.y, width, row.height);
            GUI.enabled = isEnabled;
            return GUI.Button(rect, caption, ActionButtonStyle);
        }
    }
}
