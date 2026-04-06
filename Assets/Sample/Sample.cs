using Modules.Road;
using UnityEngine;

public class Sample : MonoBehaviour
{
    [SerializeField, WebBridgeSound] private string _sampleSound;
    
    private void Test()
    {
        AudioWebBridge.Instance.PlaySound(_sampleSound);
    }
}