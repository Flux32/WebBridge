mergeInto(LibraryManager.library, {
  CheatPostRngOn: function (noncePtr) {
    var nonce = UTF8ToString(noncePtr);
    try {
      window.postMessage({ isActive: true, nonce: nonce }, '*');
    } catch (e) {
      console.warn('[CheatBridge] postMessage ON failed', e);
    }
  },
  CheatPostRngOff: function () {
    try {
      window.postMessage({ isActive: false }, '*');
    } catch (e) {
      console.warn('[CheatBridge] postMessage OFF failed', e);
    }
  }
});
