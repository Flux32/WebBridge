using UnityEditor;
using UnityEngine;

namespace Modules.Road.Editor
{
    [CustomEditor(typeof(MockConfig))]
    public class MockConfigEditor : UnityEditor.Editor
    {
        private SerializedProperty _difficulties;
        private SerializedProperty _defaultDifficulty;

        private void OnEnable()
        {
            _difficulties = serializedObject.FindProperty("_difficulties");
            _defaultDifficulty = serializedObject.FindProperty("_defaultDifficulty");
        }

        public override void OnInspectorGUI()
        {
            serializedObject.Update();

            EditorGUILayout.PropertyField(_difficulties, true);

            string[] names = BuildDifficultyNames();
            int currentIndex = FindIndex(names, _defaultDifficulty.stringValue);
            int selectedIndex = EditorGUILayout.Popup("Default Difficulty", currentIndex, names);

            if (selectedIndex >= 0 && selectedIndex < names.Length)
                _defaultDifficulty.stringValue = names[selectedIndex];

            serializedObject.ApplyModifiedProperties();
        }

        private string[] BuildDifficultyNames()
        {
            int count = _difficulties.arraySize;
            string[] names = new string[count];

            for (int i = 0; i < count; i++)
            {
                SerializedProperty entry = _difficulties.GetArrayElementAtIndex(i);
                SerializedProperty nameProperty = entry.FindPropertyRelative("Name");
                string name = nameProperty?.stringValue;
                names[i] = string.IsNullOrWhiteSpace(name) ? $"[{i}]" : name;
            }

            return names;
        }

        private static int FindIndex(string[] names, string value)
        {
            for (int i = 0; i < names.Length; i++)
            {
                if (names[i] == value)
                    return i;
            }

            return 0;
        }
    }
}
