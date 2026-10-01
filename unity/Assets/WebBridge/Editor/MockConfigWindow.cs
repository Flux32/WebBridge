using System;
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

            RoadDifficulty[] difficulties = ReadConfiguredDifficulties();
            string[] names = Array.ConvertAll(difficulties, difficulty => difficulty.ToWireName());
            int currentIndex = FindIndex(difficulties, (RoadDifficulty)_defaultDifficulty.intValue);
            int selectedIndex = EditorGUILayout.Popup("Default Difficulty", currentIndex, names);

            if (selectedIndex >= 0 && selectedIndex < difficulties.Length)
                _defaultDifficulty.intValue = (int)difficulties[selectedIndex];

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

        private RoadDifficulty[] ReadConfiguredDifficulties()
        {
            int count = _difficulties.arraySize;
            RoadDifficulty[] difficulties = new RoadDifficulty[count];

            for (int i = 0; i < count; i++)
            {
                SerializedProperty entry = _difficulties.GetArrayElementAtIndex(i);
                difficulties[i] = (RoadDifficulty)entry.FindPropertyRelative("Name").intValue;
            }

            return difficulties;
        }

        private static int FindIndex(RoadDifficulty[] difficulties, RoadDifficulty value)
        {
            int index = Array.IndexOf(difficulties, value);
            return index < 0 ? 0 : index;
        }
    }
}
