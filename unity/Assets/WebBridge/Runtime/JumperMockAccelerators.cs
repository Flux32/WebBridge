using System;

namespace Modules.Jumper
{
    /// <summary>
    /// Accelerator draws and conversions the mock round and the mock bonus series share. A slot
    /// state and a route action name an accelerator by the accelerator's own wire name.
    /// </summary>
    internal static class JumperMockAccelerators
    {
        public static readonly JumperAccelerator[] All =
        {
            JumperAccelerator.Trampoline,
            JumperAccelerator.Jetpack,
            JumperAccelerator.Rocket,
        };

        public static JumperAccelerator Pick(Random random) => All[random.Next(All.Length)];

        public static JumperSlotState ToSlotState(JumperAccelerator accelerator) =>
            JumperWireNames.SlotState.Parse(JumperWireNames.Accelerator.ToWireName(accelerator));

        public static JumperRouteAction ToRouteAction(JumperAccelerator accelerator) =>
            JumperWireNames.RouteAction.Parse(JumperWireNames.Accelerator.ToWireName(accelerator));

        /// <summary>False for a slot that holds nothing (None) or is not revealed (Hidden).</summary>
        public static bool TryGetAccelerator(JumperSlotState slotState, out JumperAccelerator accelerator) =>
            JumperWireNames.Accelerator.TryParse(JumperWireNames.SlotState.ToWireName(slotState), out accelerator);
    }
}
