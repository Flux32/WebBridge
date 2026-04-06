using UnityEditor;
using UnityEngine;

namespace Modules.Road.Editor
{
    public class MockConfigWindow : EditorWindow
    {
        private const string MockConfigDefaultPath = "Assets/Resources/MockConfig.asset";
        private const string MockConfigResourcesFolder = "Assets/Resources";

        private MockConfig _asset;
        private SerializedObject _serializedObject;
        private SerializedProperty _difficulties;
        private SerializedProperty _defaultDifficulty;
        private Vector2 _scrollPosition;

        public static void Open()
        {
            var window = GetWindow<MockConfigWindow>("Mock Config");
            window.minSize = new Vector2(350, 250);
            window.Show();
        }

        private void OnEnable()
        {
            LoadOrCreateAsset();
        }

        private void OnGUI()
        {
            if (_asset == null || _serializedObject == null)
            {
                LoadOrCreateAsset();
                if (_asset == null)
                    return;
            }

            _serializedObject.Update();

            _scrollPosition = EditorGUILayout.BeginScrollView(_scrollPosition);
            EditorGUILayout.PropertyField(_difficulties, new GUIContent("Difficulties"), true);

            string[] names = BuildDifficultyNames();
            int currentIndex = FindIndex(names, _defaultDifficulty.stringValue);
            int selectedIndex = EditorGUILayout.Popup("Default Difficulty", currentIndex, names);

            if (selectedIndex >= 0 && selectedIndex < names.Length)
                _defaultDifficulty.stringValue = names[selectedIndex];

            EditorGUILayout.EndScrollView();

            if (_serializedObject.ApplyModifiedProperties())
                AssetDatabase.SaveAssetIfDirty(_asset);
        }

        private void LoadOrCreateAsset()
        {
            string[] guids = AssetDatabase.FindAssets("t:MockConfig");

            if (guids.Length > 0)
            {
                string path = AssetDatabase.GUIDToAssetPath(guids[0]);
                _asset = AssetDatabase.LoadAssetAtPath<MockConfig>(path);
            }
            else
            {
                if (!AssetDatabase.IsValidFolder(MockConfigResourcesFolder))
                    AssetDatabase.CreateFolder("Assets", "Resources");

                _asset = CreateInstance<MockConfig>();
                AssetDatabase.CreateAsset(_asset, MockConfigDefaultPath);
                AssetDatabase.SaveAssets();
            }

            _serializedObject = new SerializedObject(_asset);
            _difficulties = _serializedObject.FindProperty("_difficulties");
            _defaultDifficulty = _serializedObject.FindProperty("_defaultDifficulty");
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
