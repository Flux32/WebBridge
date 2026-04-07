using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Scripting;

namespace Modules.Road
{
    [Preserve]
    [CreateAssetMenu(fileName = "MockConfig", menuName = "WebBridge/Mock Config")]
    public class MockConfig : ScriptableObject
    {
        [Serializable]
        public struct DifficultyEntry
        {
            public string Name;
            public float[] Coefficients;
        }

        private const string ResourcePath = "MockConfig";

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

        public static MockConfig Instance
        {
            get
            {
                if (_instance == null)
                    _instance = Resources.Load<MockConfig>(ResourcePath);
                return _instance;
            }
        }

        public IReadOnlyList<DifficultyEntry> Difficulties => _difficulties;
        public string DefaultDifficulty => _defaultDifficulty;

        public float[] GetCoefficients(string difficultyName)
        {
            for (int i = 0; i < _difficulties.Length; i++)
            {
                if (string.Equals(_difficulties[i].Name, difficultyName, StringComparison.OrdinalIgnoreCase))
                    return _difficulties[i].Coefficients;
            }

            return Array.Empty<float>();
        }

        public string GetNextDifficulty(string current)
        {
            for (int i = 0; i < _difficulties.Length; i++)
            {
                if (string.Equals(_difficulties[i].Name, current, StringComparison.OrdinalIgnoreCase))
                    return _difficulties[(i + 1) % _difficulties.Length].Name;
            }

            return _difficulties[0].Name;
        }
    }
}
