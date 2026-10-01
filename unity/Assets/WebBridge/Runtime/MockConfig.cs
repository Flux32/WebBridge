using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Scripting;
using WebBridge;

namespace Modules.Road
{
    [Preserve]
    [CreateAssetMenu(fileName = "MockConfig", menuName = "WebBridge/Mock Config")]
    public class MockConfig : ScriptableObject
    {
        // Serialized as strings on purpose: games keep their own Resources/MockConfig.asset with
        // these names, so the field types are a contract with them. RoadDifficulty lives only in
        // the API below.
        [Serializable]
        public struct DifficultyEntry
        {
            public string Name;
            public float[] Coefficients;
        }

        private const string ResourcePath = "MockConfig";

        private static readonly string AllowedNames = string.Join(
            ", ",
            ((RoadDifficulty[])Enum.GetValues(typeof(RoadDifficulty))).Select(difficulty => difficulty.ToWireName()));

        [SerializeField] private DifficultyEntry[] _difficulties =
        {
            new DifficultyEntry
            {
                Name = "easy",
                Coefficients = new[] { 1.1f, 1.2f, 1.4f, 1.8f, 2.2f, 2.6f, 3.2f, 4.1f, 5.8f }
            },
            new DifficultyEntry
            {
                Name = "medium",
                Coefficients = new[] { 1.2f, 1.5f, 1.8f, 2.4f, 3.0f, 3.8f, 5.0f, 7.0f, 10.0f }
            },
            new DifficultyEntry
            {
                Name = "hard",
                Coefficients = new[] { 1.5f, 2.0f, 3.0f, 4.5f, 6.5f, 9.0f, 13.0f, 18.0f, 25.0f }
            },
        };

        [SerializeField] private string _defaultDifficulty = "easy";

        private static MockConfig _instance;

        // Parsed entries in asset order; _configuredCoefficients[i] is the ladder of _configuredDifficulties[i].
        // NonSerialized: a domain reload must re-parse them, not restore half of them.
        [NonSerialized] private readonly List<RoadDifficulty> _configuredDifficulties = new List<RoadDifficulty>();
        [NonSerialized] private readonly List<float[]> _configuredCoefficients = new List<float[]>();
        [NonSerialized] private RoadDifficulty? _configuredDefault;
        [NonSerialized] private bool _isParsed;

        public static MockConfig Instance
        {
            get
            {
                if (_instance == null)
                    _instance = Resources.Load<MockConfig>(ResourcePath);
                return _instance;
            }
        }

        /// <summary>Configured difficulties in asset order; entries with an unknown name are left out.</summary>
        public IReadOnlyList<RoadDifficulty> Difficulties
        {
            get
            {
                EnsureParsed();
                return _configuredDifficulties;
            }
        }

        /// <exception cref="InvalidOperationException">
        /// The default is not a difficulty name or is not among the configured entries.
        /// </exception>
        public RoadDifficulty DefaultDifficulty
        {
            get
            {
                EnsureParsed();
                return _configuredDefault ?? throw CreateInvalidDefaultException();
            }
        }

        public float[] GetCoefficients(RoadDifficulty difficulty)
        {
            EnsureParsed();
            int index = _configuredDifficulties.IndexOf(difficulty);
            return index < 0 ? Array.Empty<float>() : _configuredCoefficients[index];
        }

        public RoadDifficulty GetNextDifficulty(RoadDifficulty current)
        {
            EnsureParsed();
            int index = _configuredDifficulties.IndexOf(current);
            return index < 0
                ? _configuredDifficulties[0]
                : _configuredDifficulties[(index + 1) % _configuredDifficulties.Count];
        }

        // The editor calls OnValidate on import, on every load and on every inspector edit, so it only
        // marks the entries stale: they are parsed, and an unknown name is reported, once on the next read.
        private void OnValidate()
        {
            _isParsed = false;
        }

        private void EnsureParsed()
        {
            if (_isParsed)
                return;

            ParseEntries();
            _isParsed = true;
        }

        private InvalidOperationException CreateInvalidDefaultException()
        {
            return new InvalidOperationException(
                $"[MockConfig] Default difficulty '{_defaultDifficulty}' is not one of the configured entries "
                + $"({string.Join(", ", _configuredDifficulties.Select(difficulty => difficulty.ToWireName()))}); "
                + $"allowed names: {AllowedNames}. Fix Resources/{ResourcePath}.");
        }

        private void ParseEntries()
        {
            _configuredDifficulties.Clear();
            _configuredCoefficients.Clear();

            for (int i = 0; i < _difficulties.Length; i++)
            {
                DifficultyEntry entry = _difficulties[i];
                if (!TryParseEntryName(entry.Name, out RoadDifficulty difficulty))
                {
                    WebBridgeLogger.LogError(
                        $"[MockConfig] Difficulty entry [{i}] '{entry.Name}' is not a difficulty name "
                        + $"({AllowedNames}); the mock skips it. Fix Resources/{ResourcePath}.");
                    continue;
                }

                _configuredDifficulties.Add(difficulty);
                _configuredCoefficients.Add(entry.Coefficients);
            }

            _configuredDefault = TryParseEntryName(_defaultDifficulty, out RoadDifficulty defaultDifficulty)
                                 && _configuredDifficulties.Contains(defaultDifficulty)
                ? defaultDifficulty
                : (RoadDifficulty?)null;
        }

        // Asset names are typed by hand in any case ("DareDevil", "easy"), so they match the wire
        // names case-insensitively. The wire itself (RoadWebBridge.SetDifficulty) stays exact.
        private static bool TryParseEntryName(string name, out RoadDifficulty difficulty)
        {
            difficulty = default;
            return name != null && RoadDifficultyWireNames.TryParse(name.ToUpperInvariant(), out difficulty);
        }
    }
}
