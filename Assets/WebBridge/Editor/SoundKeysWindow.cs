using UnityEditor;
using UnityEngine;

namespace Modules.Road.Editor
{
    public class SoundKeysWindow : EditorWindow
    {
        private const string SoundKeysDefaultPath = "Assets/SoundKeys.asset";

        private SoundKeys _asset;
        private SerializedObject _serializedObject;
        private SerializedProperty _keysProperty;
        private Vector2 _scrollPosition;

        public static void Open()
        {
            var window = GetWindow<SoundKeysWindow>("Sound Keys");
            window.minSize = new Vector2(300, 200);
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
            EditorGUILayout.PropertyField(_keysProperty, new GUIContent("Sound Keys"), true);
            EditorGUILayout.EndScrollView();

            if (_serializedObject.ApplyModifiedProperties())
                AssetDatabase.SaveAssetIfDirty(_asset);
        }

        private void LoadOrCreateAsset()
        {
            string[] guids = AssetDatabase.FindAssets("t:SoundKeys");

            if (guids.Length > 0)
            {
                string path = AssetDatabase.GUIDToAssetPath(guids[0]);
                _asset = AssetDatabase.LoadAssetAtPath<SoundKeys>(path);
            }
            else
            {
                _asset = CreateInstance<SoundKeys>();
                AssetDatabase.CreateAsset(_asset, SoundKeysDefaultPath);
                AssetDatabase.SaveAssets();
            }

            _serializedObject = new SerializedObject(_asset);
            _keysProperty = _serializedObject.FindProperty("_keys");
        }
    }
}
