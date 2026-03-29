const SNAPSHOT_PREFIX = "aic:snapshot:";

function snapshotKey(tabId) {
  return SNAPSHOT_PREFIX + String(tabId);
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("AIC Devtools extension installed");
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(snapshotKey(tabId));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "aic:set-tab-snapshot" && sender.tab?.id != null) {
    void chrome.storage.session
      .set({
        [snapshotKey(sender.tab.id)]: message.envelope
      })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "aic:get-tab-snapshot" && message.tabId != null) {
    void chrome.storage.session.get(snapshotKey(message.tabId)).then((result) => {
      sendResponse({
        snapshot: result[snapshotKey(message.tabId)] || null
      });
    });
    return true;
  }

  if (message?.type === "aic:clear-tab-snapshot" && message.tabId != null) {
    void chrome.storage.session.remove(snapshotKey(message.tabId)).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "aic:get-tab-url" && message.tabId != null) {
    void chrome.tabs.get(message.tabId).then((tab) => {
      sendResponse({
        url: tab?.url || null
      });
    });
    return true;
  }

  if (message?.type === "aic:collect-dom-candidates" && message.tabId != null) {
    void chrome.tabs
      .sendMessage(message.tabId, {
        type: "aic:collect-dom-candidates"
      })
      .then((response) => {
        sendResponse({
          candidates: Array.isArray(response?.candidates) ? response.candidates : []
        });
      })
      .catch(() => {
        sendResponse({
          candidates: []
        });
      });
    return true;
  }

  return false;
});
