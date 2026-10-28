using UnityEngine;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.MineSlot
{
    /// <summary>
    /// Mock-mode overlay that stands in for the React bet bar: spin, buy a bonus game or reset, and
    /// the bridge receives the same payloads the platform would send. The Mine Slot bridge adds it
    /// to its own GameObject in mock mode.
    /// </summary>
    [Preserve]
    public class MineSlotMockDebugIMGUI : DebugPanelIMGUI
    {
        private const float ActionsHeight = 46f;
        private const float HintHeight = 40f;
        private const int ActionsPerRow = 3;

        protected override string ButtonCaption => "MIN";

        protected override Color ButtonColor => new Color(0.8f, 0.55f, 0.15f, 0.92f);

        protected override string Title => "Mine Slot Mock";

        protected override float PanelWidth => 360f;

        protected override float MeasureContentHeight() => ActionsHeight + Padding + HintHeight;

        protected override void DrawContent(Rect content)
        {
            MineSlotMockHost host = MineSlotWebBridge.Instance.MockHost;
            Rect actionsRow = new Rect(content.x, content.y, content.width, ActionsHeight);

            if (DrawAction(actionsRow, 0, "SPIN", host.CanSpin))
                host.Spin();
            if (DrawAction(actionsRow, 1, "BONUS", host.CanSpin))
                host.BuyBonus();
            if (DrawAction(actionsRow, 2, "RESET", true))
                host.Reset();

            GUI.enabled = true;
            Rect hint = new Rect(content.x, actionsRow.yMax + Padding, content.width, HintHeight);
            GUI.Label(hint, host.SessionInfo, HintStyle);
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
