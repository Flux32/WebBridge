using System.Globalization;
using UnityEngine.Scripting;

namespace WebBridge
{
    /// <summary>
    /// Custom game events for analytics (ADR-0011): the game names an event and gives it flat params,
    /// the React shell adds the context (game, session, release, device) and validates the event. There
    /// is no reply. Outside the shell (the editor, mock mode) <see cref="WebBridgeUtils.Send"/> only
    /// logs the message, so nothing leaves the game.
    ///
    /// Keep personal data and money out of events: no emails, ids, bets, wins or balances. The shell
    /// rejects the obvious ones (keys such as email, user_id, bet, balance), the rest is the game's
    /// responsibility. Rules and limits live in the protocol (gameEvents.ts); the constants below are
    /// copies of them, used only for log warnings.
    /// </summary>
    [Preserve]
    public sealed class Analytics
    {
        // React parses `TrackEvent_{"name":"…","params":{…}}` in unityProtocol.ts; change it in step.
        private const string TrackEventMessagePrefix = "TrackEvent_";
        private const string NameKey = "name";
        private const string ParamsKey = "params";

        // Copies of GAME_EVENT_LIMITS.nameMaxLength / maxParams.
        private const int NameMaxLength = 64;
        private const int MaxParams = 20;

        /// <summary>
        /// Sends a custom event. The name is lowercase letters, digits and '_' (up to 64 characters).
        /// With bridge logs on, a name or a param count the shell would reject is warned about, and the
        /// event is sent anyway: the shell decides.
        /// </summary>
        public void Track(string name, AnalyticsParams parameters = null)
        {
            WarnAboutRejection(name, parameters);

            JsonValue message = JsonValue.NewObject();
            message[NameKey] = JsonValue.Of(name);
            if (parameters != null)
                message[ParamsKey] = parameters.ToJsonValue();

            WebBridgeUtils.Send(TrackEventMessagePrefix + message.ToJsonString());
        }

        /// <summary>Standard event <c>level_start</c>. A level is a bonus stage, a ladder step, a stage.</summary>
        public void LevelStart(string level, AnalyticsParams extra = null) =>
            Track("level_start", WithLevel(level, extra));

        public void LevelComplete(string level, AnalyticsParams extra = null) =>
            Track("level_complete", WithLevel(level, extra));

        public void LevelFail(string level, AnalyticsParams extra = null) =>
            Track("level_fail", WithLevel(level, extra));

        /// <summary>
        /// Standard event <c>resource_source</c>: an in-game resource came in (a chest, a reward).
        /// <paramref name="currency"/> and <paramref name="source"/> are identifiers; money of the
        /// player is not a resource. <paramref name="amount"/> must be greater than zero.
        /// </summary>
        public void ResourceSource(string currency, double amount, string source, AnalyticsParams extra = null) =>
            Track("resource_source", WithResource(currency, amount, "source", source, extra));

        /// <summary>Standard event <c>resource_sink</c>: an in-game resource was spent.</summary>
        public void ResourceSink(string currency, double amount, string sink, AnalyticsParams extra = null) =>
            Track("resource_sink", WithResource(currency, amount, "sink", sink, extra));

        private static AnalyticsParams WithLevel(string level, AnalyticsParams extra) =>
            (extra ?? new AnalyticsParams()).CopyWith("level", level);

        private static AnalyticsParams WithResource(
            string currency, double amount, string reasonKey, string reason, AnalyticsParams extra) =>
            (extra ?? new AnalyticsParams())
                .CopyWith("currency", currency)
                .Add("amount", amount)
                .Add(reasonKey, reason);

        // GAME_EVENT_NAME_PATTERN, /^[a-z][a-z0-9_]*$/, by hand: a Regex `$` also matches before a
        // trailing newline, and the package has no other use for System.Text.RegularExpressions.
        private static bool IsNamePattern(string name)
        {
            if (!IsLowerLetter(name[0]))
                return false;

            for (int i = 1; i < name.Length; i++)
            {
                char symbol = name[i];
                if (!IsLowerLetter(symbol) && !(symbol >= '0' && symbol <= '9') && symbol != '_')
                    return false;
            }

            return true;
        }

        private static bool IsLowerLetter(char symbol) => symbol >= 'a' && symbol <= 'z';

        private static void WarnAboutRejection(string name, AnalyticsParams parameters)
        {
            if (!WebBridgeLogger.IsEnabled)
                return;

            if (string.IsNullOrEmpty(name) || name.Length > NameMaxLength || !IsNamePattern(name))
            {
                WebBridgeLogger.LogWarning(
                    $"[WebBridge] TrackEvent \"{name}\" will be rejected by the shell: bad_name " +
                    "(lowercase letters, digits and '_', starts with a letter, up to " +
                    NameMaxLength.ToString(CultureInfo.InvariantCulture) + " characters).");
                return;
            }

            if (parameters != null && parameters.Count > MaxParams)
            {
                WebBridgeLogger.LogWarning(
                    $"[WebBridge] TrackEvent \"{name}\" will be rejected by the shell: bad_params " +
                    $"({parameters.Count.ToString(CultureInfo.InvariantCulture)} params, at most " +
                    MaxParams.ToString(CultureInfo.InvariantCulture) + ").");
            }
        }
    }
}
