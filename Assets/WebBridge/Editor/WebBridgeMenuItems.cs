using System.Collections.Generic;
using System.Linq;
using Modules.Plinko;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Modules.Road.Editor
{
    public static class WebBridgeMenuItems
    {
        private const string EnableMockMenu = "Tools/WebBridge/Enable Mock";
        private const string EnableMockInBuildMenu = "Tools/WebBridge/Enable Mock In Build";
        private const string EnableCheatsMenu = "Tools/WebBridge/Enable Cheats";
        private const string EnableCheatsInBuildMenu = "Tools/WebBridge/Enable Cheats In Build";
        private const string MockEditorPrefKey = "WebBridge_EnableMock";
        private const string CheatsEditorPrefKey = "WebBridge_EnableCheats";
        private const string MockDefineSymbol = "WEBBRIDGE_MOCK";
        private const string CheatsDefineSymbol = "WEBBRIDGE_CHEATS";
        private const string RoadPackagePrefabPath = "Packages/com.pixi.webbridge/Runtime/Prefabs/RoadWebBridge.prefab";
        private const string RoadAssetsPrefabPath = "Assets/WebBridge/Runtime/Prefabs/RoadWebBridge.prefab";
        private const string PlinkoPackagePrefabPath = "Packages/com.pixi.webbridge/Runtime/Prefabs/PlinkoWebBridge.prefab";
        private const string PlinkoAssetsPrefabPath = "Assets/WebBridge/Runtime/Prefabs/PlinkoWebBridge.prefab";
        private const string WebBridgeObjectName = "WebBridge";
        private const string SoundKeysMenu = "Tools/WebBridge/Sounds";
        private const string MockConfigMenu = "Tools/WebBridge/MockConfig";

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

        #endregion

        #region Enable Cheats (Editor Play Mode)

        [MenuItem(EnableCheatsMenu, false, 110)]
        private static void ToggleEnableCheats()
        {
            bool current = EditorPrefs.GetBool(CheatsEditorPrefKey, false);
            EditorPrefs.SetBool(CheatsEditorPrefKey, !current);
        }

        [MenuItem(EnableCheatsMenu, true)]
        private static bool ToggleEnableCheatsValidate()
        {
            Menu.SetChecked(EnableCheatsMenu, EditorPrefs.GetBool(CheatsEditorPrefKey, false));
            return true;
        }

        #endregion

        #region Enable Cheats In Build (Define Symbol)

        [MenuItem(EnableCheatsInBuildMenu, false, 111)]
        private static void ToggleEnableCheatsInBuild()
        {
            if (HasDefineSymbol(CheatsDefineSymbol))
                RemoveDefineSymbol(CheatsDefineSymbol);
            else
                AddDefineSymbol(CheatsDefineSymbol);
        }

        [MenuItem(EnableCheatsInBuildMenu, true)]
        private static bool ToggleEnableCheatsInBuildValidate()
        {
            Menu.SetChecked(EnableCheatsInBuildMenu, HasDefineSymbol(CheatsDefineSymbol));
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

        #region Mock Config

        [MenuItem(MockConfigMenu, false, 103)]
        private static void OpenMockConfig()
        {
            MockConfigWindow.Open();
        }

        #endregion

        #region Create Prefab

        [MenuItem("GameObject/WebBridge/Create RoadWebBridge", false, 10)]
        private static void CreateRoadWebBridge(MenuCommand menuCommand)
        {
            CreateWebBridge(menuCommand, RoadPackagePrefabPath, RoadAssetsPrefabPath, "Road");
        }

        [MenuItem("GameObject/WebBridge/Create PlinkoWebBridge", false, 11)]
        private static void CreatePlinkoWebBridge(MenuCommand menuCommand)
        {
            CreateWebBridge(menuCommand, PlinkoPackagePrefabPath, PlinkoAssetsPrefabPath, "Plinko");
        }

        private static void CreateWebBridge(MenuCommand menuCommand, string packagePath, string assetsPath, string label)
        {
            if (TryGetExistingWebBridge(out GameObject existing))
            {
                EditorUtility.DisplayDialog(
                    "WebBridge already exists",
                    $"A WebBridge object ('{existing.name}') already exists in the scene. Only one WebBridge is allowed per scene.",
                    "OK");
                Selection.activeObject = existing;
                return;
            }

            GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(packagePath)
                                ?? AssetDatabase.LoadAssetAtPath<GameObject>(assetsPath);
            if (prefab == null)
            {
                Debug.LogError($"[WebBridge] {label} prefab not found at: {packagePath} or {assetsPath}");
                return;
            }

            GameObject instance = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            // React targets the object by name via SendMessage, so it is always "WebBridge"
            // regardless of which game prefab was instantiated.
            instance.name = WebBridgeObjectName;
            GameObjectUtility.SetParentAndAlign(instance, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(instance, $"Create {label}WebBridge");
            Selection.activeObject = instance;
        }

        // A scene may host only one WebBridge (Road or Plinko). Both bridges derive from
        // WebBridgeBase, so the presence of either concrete component blocks a second creation.
        private static bool TryGetExistingWebBridge(out GameObject existing)
        {
            existing = null;

            RoadWebBridge road = Object.FindFirstObjectByType<RoadWebBridge>(FindObjectsInactive.Include);
            if (road != null)
            {
                existing = road.gameObject;
                return true;
            }

            PlinkoWebBridge plinko = Object.FindFirstObjectByType<PlinkoWebBridge>(FindObjectsInactive.Include);
            if (plinko != null)
            {
                existing = plinko.gameObject;
                return true;
            }

            return false;
        }

        #endregion
    }
}
