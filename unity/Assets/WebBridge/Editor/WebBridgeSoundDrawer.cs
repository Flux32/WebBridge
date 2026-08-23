using System;
using UnityEditor;
using UnityEngine;

namespace Modules.Road.Editor
{
    [CustomPropertyDrawer(typeof(WebBridgeSoundAttribute))]
    public class WebBridgeSoundDrawer : PropertyDrawer
    {
        public override void OnGUI(Rect position, SerializedProperty property, GUIContent label)
        {
            if (property.propertyType != SerializedPropertyType.String)
            {
                EditorGUI.PropertyField(position, property, label);
                return;
            }

            string[] keys = GetKeys();
            if (keys.Length == 0)
            {
                EditorGUI.PropertyField(position, property, label);
                return;
            }

            int currentIndex = Array.IndexOf(keys, property.stringValue);
            if (currentIndex < 0)
                currentIndex = 0;

            int selectedIndex = EditorGUI.Popup(position, label.text, currentIndex, keys);
            property.stringValue = keys[selectedIndex];
        }

        private static string[] GetKeys()
        {
            string[] guids = AssetDatabase.FindAssets("t:SoundKeys");
            if (guids.Length == 0)
                return Array.Empty<string>();

            string path = AssetDatabase.GUIDToAssetPath(guids[0]);
            SoundKeys asset = AssetDatabase.LoadAssetAtPath<SoundKeys>(path);
            return asset != null ? asset.Keys : Array.Empty<string>();
        }
    }
}
