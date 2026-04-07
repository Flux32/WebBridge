using System.Collections.Generic;
using System.IO;
using System.Linq;
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
        private SerializedProperty _soundFolderPathProperty;
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

            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.PropertyField(_soundFolderPathProperty, new GUIContent("Sound Folder Path"));
            if (GUILayout.Button("Browse", GUILayout.Width(60)))
            {
                string selected = EditorUtility.OpenFolderPanel("Select Sound Folder",
                    _soundFolderPathProperty.stringValue, "");
                if (!string.IsNullOrEmpty(selected))
                    _soundFolderPathProperty.stringValue = selected;
            }
            EditorGUILayout.EndHorizontal();

            EditorGUI.BeginDisabledGroup(string.IsNullOrEmpty(_soundFolderPathProperty.stringValue));
            if (GUILayout.Button("Scan"))
                ScanFolder();
            EditorGUI.EndDisabledGroup();

            EditorGUILayout.Space();

            _scrollPosition = EditorGUILayout.BeginScrollView(_scrollPosition);
            EditorGUILayout.PropertyField(_keysProperty, new GUIContent("Sound Keys"), true);
            EditorGUILayout.EndScrollView();

            if (_serializedObject.ApplyModifiedProperties())
                AssetDatabase.SaveAssetIfDirty(_asset);
        }

        private void ScanFolder()
        {
            string folderPath = _soundFolderPathProperty.stringValue;
            if (!Directory.Exists(folderPath))
            {
                EditorUtility.DisplayDialog("Scan", $"Folder not found:\n{folderPath}", "OK");
                return;
            }

            HashSet<string> existing = new();
            for (int i = 0; i < _keysProperty.arraySize; i++)
                existing.Add(_keysProperty.GetArrayElementAtIndex(i).stringValue);

            string[] files = Directory.GetFiles(folderPath, "*.mp3");
            int added = 0;

            foreach (string file in files.OrderBy(f => f))
            {
                string key = Path.GetFileNameWithoutExtension(file);
                if (existing.Contains(key))
                    continue;

                _keysProperty.InsertArrayElementAtIndex(_keysProperty.arraySize);
                _keysProperty.GetArrayElementAtIndex(_keysProperty.arraySize - 1).stringValue = key;
                existing.Add(key);
                added++;
            }

            if (added > 0)
            {
                _serializedObject.ApplyModifiedProperties();
                AssetDatabase.SaveAssetIfDirty(_asset);
            }

            Debug.Log($"[SoundKeys] Scan complete: found {files.Length} mp3 files, added {added} new keys.");
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
            _soundFolderPathProperty = _serializedObject.FindProperty("_soundFolderPath");
        }
    }
}
