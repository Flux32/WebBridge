using System;
using System.Collections.Generic;
using System.Globalization;

namespace Modules.Jumper
{
    /// <summary>
    /// One round as the dev game server plays it (RoadFrontent src/modes/jumper/PROTOCOL.md):
    /// every accelerator slot is placed when the round opens and stays HIDDEN until the player
    /// lands on it or flies over it; accelerators chain, the next jump aims at landingStep + 1,
    /// and a closed round names the step of the fall in collisionPosition.
    /// </summary>
    internal sealed class JumperMockRound
    {
        private const string NoCoefficient = "0";

        private readonly JumperDifficulty _difficulty;
        private readonly JumperMockSettings _settings;
        private readonly Random _random;
        private readonly string[] _coefficients;
        private readonly decimal _betAmount;
        private readonly SortedDictionary<int, JumperSlotState> _slotContents =
            new SortedDictionary<int, JumperSlotState>();
        private readonly HashSet<int> _revealedSlots = new HashSet<int>();
        private readonly List<WebJumperVisitedStepPayload> _visitedSteps = new List<WebJumperVisitedStepPayload>();

        private int _lineNumber = WebJumperRoundStatePayload.StartStep;
        private int? _collisionPosition;

        public JumperMockRound(JumperDifficulty difficulty, JumperMockSettings settings, Random random)
        {
            _difficulty = difficulty;
            _settings = settings;
            _random = random;
            _coefficients = settings.GetLadder(difficulty).CopyCoefficients();
            _betAmount = settings.BetAmount;
            PlaceSlots();
        }

        public JumperRoundStatus Status { get; private set; } = JumperRoundStatus.InGame;

        public int LandingStep { get; private set; } = WebJumperRoundStatePayload.StartStep;

        public bool HasJumped => LandingStep != WebJumperRoundStatePayload.StartStep;

        public bool IsClosed => Status != JumperRoundStatus.InGame;

        // A fall past the top of the ladder: where the server puts collisionPosition when the
        // player could not have fallen anywhere on it.
        private int PastLastStep => _coefficients.Length;

        private int LastStep => _coefficients.Length - 1;

        public string WinAmount => _settings.FormatAmount(_betAmount * ParseCoefficient(Coefficient));

        private string Coefficient =>
            HasJumped && Status != JumperRoundStatus.Lose ? _coefficients[LandingStep] : NoCoefficient;

        /// <summary>The step request: one jump and the accelerator chain it sets off.</summary>
        public void Jump()
        {
            if (IsClosed)
                throw new InvalidOperationException("Cannot jump in a closed jumper round.");

            _visitedSteps.Clear();
            _lineNumber = LandingStep + 1;
            LandingStep = FlyThroughAccelerators(_lineNumber);

            if (_random.NextDouble() < _settings.LoseChance)
                Close(JumperRoundStatus.Lose, LandingStep);
            else if (LandingStep == LastStep)
                Close(JumperRoundStatus.Win, PastLastStep);
        }

        /// <summary>The payout request: the round closes with the landing step's win.</summary>
        public void Payout()
        {
            if (IsClosed || !HasJumped)
                throw new InvalidOperationException("Cannot payout without steps.");

            Close(JumperRoundStatus.Win, _random.Next(LandingStep + 1, PastLastStep + 1));
        }

        public void FillState(WebJumperRoundStatePayload state)
        {
            state.StatusName = JumperWireNames.RoundStatus.ToWireName(Status);
            state.DifficultyName = JumperWireNames.Difficulty.ToWireName(_difficulty);
            state.Coeff = Coefficient;
            state.WinAmount = WinAmount;
            state.Slots = BuildSlots();
            state.LineNumber = _lineNumber;
            state.LandingStep = LandingStep;
            state.VisitedSteps = _visitedSteps.ToArray();
            state.CollisionPosition = _collisionPosition;
        }

        private void Close(JumperRoundStatus status, int collisionPosition)
        {
            Status = status;
            _collisionPosition = collisionPosition;
        }

        // The top step never carries a slot: there is nowhere left to throw the player.
        private void PlaceSlots()
        {
            for (int step = 0; step < LastStep; step++)
            {
                if (_random.NextDouble() >= _settings.SlotChance)
                    continue;

                _slotContents[step] = _random.NextDouble() < _settings.EmptySlotChance
                    ? JumperSlotState.None
                    : JumperMockAccelerators.ToSlotState(JumperMockAccelerators.Pick(_random));
            }
        }

        private int FlyThroughAccelerators(int step)
        {
            RevealSlot(step);
            while (TryGetAccelerator(step, out JumperAccelerator accelerator))
            {
                _visitedSteps.Add(new WebJumperVisitedStepPayload
                {
                    Step = step,
                    AcceleratorName = JumperWireNames.Accelerator.ToWireName(accelerator),
                });

                int target = Math.Min(step + _settings.GetDistance(accelerator), LastStep);
                for (int flownOver = step + 1; flownOver <= target; flownOver++)
                    RevealSlot(flownOver);

                step = target;
            }

            return step;
        }

        private bool TryGetAccelerator(int step, out JumperAccelerator accelerator)
        {
            accelerator = default;
            return _slotContents.TryGetValue(step, out JumperSlotState content)
                   && JumperMockAccelerators.TryGetAccelerator(content, out accelerator);
        }

        private void RevealSlot(int step)
        {
            if (_slotContents.ContainsKey(step))
                _revealedSlots.Add(step);
        }

        private WebJumperSlotPayload[] BuildSlots()
        {
            List<WebJumperSlotPayload> slots = new List<WebJumperSlotPayload>(_slotContents.Count);
            foreach (KeyValuePair<int, JumperSlotState> slot in _slotContents)
            {
                JumperSlotState shown = _revealedSlots.Contains(slot.Key) ? slot.Value : JumperSlotState.Hidden;
                slots.Add(new WebJumperSlotPayload
                {
                    Step = slot.Key,
                    StateName = JumperWireNames.SlotState.ToWireName(shown),
                });
            }

            return slots.ToArray();
        }

        private static decimal ParseCoefficient(string coefficient) =>
            decimal.Parse(coefficient, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture);
    }
}
