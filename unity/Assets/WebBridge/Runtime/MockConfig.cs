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
            public RoadDifficulty Name;
            public float[] Coefficients;
        }

        private const string ResourcePath = "MockConfig";

        [SerializeField] private DifficultyEntry[] _difficulties =
        {
            new DifficultyEntry
            {
                Name = RoadDifficulty.Easy,
                Coefficients = new[] { 1.1f, 1.2f, 1.4f, 1.8f, 2.2f, 2.6f, 3.2f, 4.1f, 5.8f }
            },
            new DifficultyEntry
            {
                Name = RoadDifficulty.Medium,
                Coefficients = new[] { 1.2f, 1.5f, 1.8f, 2.4f, 3.0f, 3.8f, 5.0f, 7.0f, 10.0f }
            },
            new DifficultyEntry
            {
                Name = RoadDifficulty.Hard,
                Coefficients = new[] { 1.5f, 2.0f, 3.0f, 4.5f, 6.5f, 9.0f, 13.0f, 18.0f, 25.0f }
            },
        };

        [SerializeField] private RoadDifficulty _defaultDifficulty = RoadDifficulty.Easy;

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
        public RoadDifficulty DefaultDifficulty => _defaultDifficulty;

        public float[] GetCoefficients(RoadDifficulty difficulty)
        {
            for (int i = 0; i < _difficulties.Length; i++)
            {
                if (_difficulties[i].Name == difficulty)
                    return _difficulties[i].Coefficients;
            }

            return Array.Empty<float>();
        }

        public RoadDifficulty GetNextDifficulty(RoadDifficulty current)
        {
            for (int i = 0; i < _difficulties.Length; i++)
            {
                if (_difficulties[i].Name == current)
                    return _difficulties[(i + 1) % _difficulties.Length].Name;
            }

            return _difficulties[0].Name;
        }
    }
}
