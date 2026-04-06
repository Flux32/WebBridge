using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Modules.Road.Editor
{
    public static class WebBridgeMenuItems
    {
        private const string EnableMockMenu = "Tools/WebBridge/Enable Mock";
        private const string EnableMockInBuildMenu = "Tools/WebBridge/Enable Mock In Build";
        private const string MockEditorPrefKey = "WebBridge_EnableMock";
        private const string MockDefineSymbol = "WEBBRIDGE_MOCK";
        private const string PackagePrefabPath = "Packages/com.pixi.webbridge/Runtime/Prefabs/WebBridge.prefab";
        private const string AssetsPrefabPath = "Assets/WebBridge/Runtime/Prefabs/WebBridge.prefab";
        private const string SoundKeysMenu = "Tools/WebBridge/Sounds";

        #region Enable Mock (Editor Play Mode)

        [MenuItem(EnableMockMenu, false, 100)]
        private static void ToggleEnableMock()
        {
            bool current = EditorPrefs.GetBool(MockEditorPrefKey, false);
            EditorPrefs.SetBool(MockEditorPrefKey, !current);
        }

        [MenuItem(EnableMockMenu, true)]
        private static bool ToggleEnableMockValidate()
        {
            Menu.SetChecked(EnableMockMenu, EditorPrefs.GetBool(MockEditorPrefKey, false));
            return true;
        }

        #endregion

        #region Enable Mock In Build (Define Symbol)

        [MenuItem(EnableMockInBuildMenu, false, 101)]
        private static void ToggleEnableMockInBuild()
        {
            if (HasDefineSymbol(MockDefineSymbol))
                RemoveDefineSymbol(MockDefineSymbol);
            else
                AddDefineSymbol(MockDefineSymbol);
        }

        [MenuItem(EnableMockInBuildMenu, true)]
        private static bool ToggleEnableMockInBuildValidate()
        {
            Menu.SetChecked(EnableMockInBuildMenu, HasDefineSymbol(MockDefineSymbol));
            return true;
        }

        private static bool HasDefineSymbol(string symbol)
        {
            NamedBuildTarget target = GetActiveBuildTarget();
            PlayerSettings.GetScriptingDefineSymbols(target, out string[] defines);
            return defines.Contains(symbol);
        }

        private static void AddDefineSymbol(string symbol)
        {
            NamedBuildTarget target = GetActiveBuildTarget();
            PlayerSettings.GetScriptingDefineSymbols(target, out string[] defines);
            if (defines.Contains(symbol))
                return;

            List<string> list = new List<string>(defines) { symbol };
            PlayerSettings.SetScriptingDefineSymbols(target, list.ToArray());
        }

        private static void RemoveDefineSymbol(string symbol)
        {
            NamedBuildTarget target = GetActiveBuildTarget();
            PlayerSettings.GetScriptingDefineSymbols(target, out string[] defines);
            List<string> list = new List<string>(defines);
            if (!list.Remove(symbol))
                return;

            PlayerSettings.SetScriptingDefineSymbols(target, list.ToArray());
        }

        private static NamedBuildTarget GetActiveBuildTarget()
        {
            return NamedBuildTarget.FromBuildTargetGroup(EditorUserBuildSettings.selectedBuildTargetGroup);
        }

        #endregion

        #region Sound Keys

        [MenuItem(SoundKeysMenu, false, 102)]
        private static void OpenSoundKeys()
        {
            SoundKeysWindow.Open();
        }

        #endregion

        #region Create Prefab

        [MenuItem("GameObject/WebBridge", false, 10)]
        private static void CreateWebBridge(MenuCommand menuCommand)
        {
            GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(PackagePrefabPath)
                                ?? AssetDatabase.LoadAssetAtPath<GameObject>(AssetsPrefabPath);
            if (prefab == null)
            {
                Debug.LogError($"[WebBridge] Prefab not found at: {PackagePrefabPath} or {AssetsPrefabPath}");
                return;
            }

            GameObject instance = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            GameObjectUtility.SetParentAndAlign(instance, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(instance, "Create WebBridge");
            Selection.activeObject = instance;
        }

        #endregion
    }
}
