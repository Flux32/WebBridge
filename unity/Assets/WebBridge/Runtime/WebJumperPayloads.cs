using System;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Jumper
{
    // Jumper payloads as the host shapes them from the game server's replies
    // (protocol/src/jumper.ts): arrays instead of the server's step-keyed maps. Money and
    // coefficients stay the server's decimal strings. Enums travel as the backend's names: the
    // string field is the wire form, the property of the same meaning parses it and throws a
    // FormatException on a name the protocol does not define.

    /// <summary>How far an accelerator throws the player on one difficulty.</summary>
    [Preserve]
    [Serializable]
    public class WebJumperAcceleratorDistancePayload
    {
        [JsonName("accelerator")]
        public string AcceleratorName;

        [JsonName("steps")]
        public int Steps;

        public JumperAccelerator Accelerator => JumperWireNames.Accelerator.Parse(AcceleratorName);
    }

    /// <summary>One difficulty's ladder.</summary>
    [Preserve]
    [Serializable]
    public class WebJumperLadderPayload
    {
        [JsonName("difficulty")]
        public string DifficultyName;

        // The coefficient of each step, by its index.
        [JsonName("coefficients")]
        public string[] Coefficients;

        [JsonName("accelerators")]
        public WebJumperAcceleratorDistancePayload[] Accelerators;

        // The bonus price in bets.
        [JsonName("bonusBuyMultiplier")]
        public float BonusBuyMultiplier;

        public JumperDifficulty Difficulty => JumperWireNames.Difficulty.Parse(DifficultyName);

        /// <summary>Steps the accelerator throws the player; throws when the ladder does not list it.</summary>
        public int GetDistance(JumperAccelerator accelerator)
        {
            foreach (WebJumperAcceleratorDistancePayload distance in Accelerators)
            {
                if (distance.Accelerator == accelerator)
                    return distance.Steps;
            }

            throw new InvalidOperationException($"Jumper ladder {DifficultyName} has no {accelerator} distance.");
        }
    }

    /// <summary>
    /// JSON of ApplyGameConfig: every difficulty's ladder. SetJumperDifficulty picks the one in play.
    /// </summary>
    [Preserve]
    [Serializable]
    public class WebJumperGameConfigPayload
    {
        [JsonName("ladders")]
        public WebJumperLadderPayload[] Ladders;

        /// <summary>The ladder of the difficulty; throws when the config does not carry it.</summary>
        public WebJumperLadderPayload GetLadder(JumperDifficulty difficulty)
        {
            foreach (WebJumperLadderPayload ladder in Ladders)
            {
                if (ladder.Difficulty == difficulty)
                    return ladder;
            }

            throw new InvalidOperationException($"Jumper game config has no {difficulty} ladder.");
        }
    }

    /// <summary>An accelerator slot of the round, known from the round's start.</summary>
    [Preserve]
    [Serializable]
    public class WebJumperSlotPayload
    {
        [JsonName("step")]
        public int Step;

        [JsonName("state")]
        public string StateName;

        public JumperSlotState State => JumperWireNames.SlotState.Parse(StateName);
    }

    /// <summary>An accelerator the jump went through, in the order the player hit them.</summary>
    [Preserve]
    [Serializable]
    public class WebJumperVisitedStepPayload
    {
        [JsonName("step")]
        public int Step;

        [JsonName("accelerator")]
        public string AcceleratorName;

        public JumperAccelerator Accelerator => JumperWireNames.Accelerator.Parse(AcceleratorName);
    }

    /// <summary>
    /// The round as the server last described it (ApplyGameState). Status None — no live round.
    /// </summary>
    [Preserve]
    [Serializable]
    public class WebJumperRoundStatePayload
    {
        /// <summary>Where the player stands before the first jump: below step 0.</summary>
        public const int StartStep = -1;

        [JsonName("status")]
        public string StatusName;

        [JsonName("difficulty")]
        public string DifficultyName;

        // The coefficient of LandingStep; "0" before the first jump and after a loss.
        [JsonName("coeff")]
        public string Coeff;

        [JsonName("winAmount")]
        public string WinAmount;

        // Every accelerator slot of the round, known from its start.
        [JsonName("slots")]
        public WebJumperSlotPayload[] Slots;

        // The step this jump aimed at; StartStep before the first one.
        [JsonName("lineNumber")]
        public int LineNumber;

        // Where the player stands after the accelerator chain; the next jump aims at LandingStep + 1.
        [JsonName("landingStep")]
        public int LandingStep;

        [JsonName("visitedSteps")]
        public WebJumperVisitedStepPayload[] VisitedSteps;

        // Only on a closed round: the step the player fell from, or after a cash out the step
        // where they would have fallen.
        [JsonName("collisionPosition")]
        public int? CollisionPosition;

        public JumperRoundStatus Status => JumperWireNames.RoundStatus.Parse(StatusName);

        public JumperDifficulty Difficulty => JumperWireNames.Difficulty.Parse(DifficultyName);

        public bool HasJumped => LandingStep != StartStep;

        public bool IsClosed => Status == JumperRoundStatus.Win || Status == JumperRoundStatus.Lose;
    }

    /// <summary>
    /// A live move's result (ApplyJumperMove). The game plays it and calls NotifySpinReady when the
    /// jump is over; after Payout it shows the closed round and waits for RestartRound.
    /// </summary>
    [Preserve]
    [Serializable]
    public class WebJumperMovePayload : WebJumperRoundStatePayload
    {
        [JsonName("move")]
        public string MoveName;

        public JumperMove Move => JumperWireNames.Move.Parse(MoveName);
    }
}
