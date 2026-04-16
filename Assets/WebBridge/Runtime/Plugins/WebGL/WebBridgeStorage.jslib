mergeInto(LibraryManager.library, {
  WebBridge_SaveToLocalStorage: function (keyPtr, valuePtr) {
    try {
      localStorage.setItem(UTF8ToString(keyPtr), UTF8ToString(valuePtr));
    } catch (e) {
      console.warn('[WebBridgeStorage] Save failed', e);
    }
  },
  WebBridge_LoadFromLocalStorage: function (keyPtr) {
    try {
      var val = localStorage.getItem(UTF8ToString(keyPtr));
      if (!val) return 0;
      var len = lengthBytesUTF8(val) + 1;
      var buf = _malloc(len);
      stringToUTF8(val, buf, len);
      return buf;
    } catch (e) {
      console.warn('[WebBridgeStorage] Load failed', e);
      return 0;
    }
  },
  WebBridge_RemoveFromLocalStorage: function (keyPtr) {
    try {
      localStorage.removeItem(UTF8ToString(keyPtr));
    } catch (e) {
      console.warn('[WebBridgeStorage] Remove failed', e);
    }
  }
});
