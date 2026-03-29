const state = {
  endpoint: undefined,
  manifest: undefined,
  pageUrl: undefined,
  sourceLabel: "No connection yet."
};

const statusNode = document.getElementById("status");
const metaNode = document.getElementById("meta");
const sourceNode = document.getElementById("source");
const elementsNode = document.getElementById("elements");
const jsonNode = document.getElementById("json");
const refreshButton = document.getElementById("refresh");
const openEndpointButton = document.getElementById("open-endpoint");
const copyJsonButton = document.getElementById("copy-json");

function setStatus(message, tone = "neutral") {
  statusNode.textContent = message;
  statusNode.dataset.tone = tone;
}

function setButtonsEnabled(enabled) {
  openEndpointButton.disabled = !enabled;
  copyJsonButton.disabled = !enabled;
}

function buildEndpoint(tabUrl) {
  const url = new URL(tabUrl);
  return new URL("/.well-known/agent/ui", url.origin).toString();
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function getStoredSnapshot(tabId) {
  const response = await chrome.runtime.sendMessage({
    tabId,
    type: "aic:get-tab-snapshot"
  });
  return response?.snapshot ?? null;
}

function renderManifest(manifest) {
  const viewId = manifest?.view?.view_id || "unknown";
  const pageUrl = manifest?.page?.url || state.pageUrl || "unknown";
  const elements = Array.isArray(manifest?.elements) ? manifest.elements : [];

  metaNode.textContent = viewId + " · " + elements.length + " element(s) · " + pageUrl;
  sourceNode.textContent = state.sourceLabel;
  elementsNode.innerHTML = "";

  if (elements.length === 0) {
    const emptyNode = document.createElement("li");
    emptyNode.textContent = "The endpoint responded, but it did not include any elements.";
    elementsNode.appendChild(emptyNode);
  } else {
    elements.slice(0, 12).forEach((element) => {
      const item = document.createElement("li");
      const entity =
        element?.entity_ref?.entity_type && element?.entity_ref?.entity_id
          ? " -> " + element.entity_ref.entity_type + ":" + element.entity_ref.entity_id
          : "";
      item.textContent = element.role + " " + element.id + " [" + element.risk + "]" + entity;
      elementsNode.appendChild(item);
    });
  }

  jsonNode.textContent = JSON.stringify(manifest, null, 2);
}

async function loadManifest() {
  setStatus("Inspecting active tab...", "neutral");
  setButtonsEnabled(false);

  try {
    const activeTab = await getActiveTab();

    if (!activeTab || !activeTab.id || !activeTab.url) {
      throw new Error("No active tab URL is available.");
    }

    state.pageUrl = activeTab.url;
    state.endpoint = buildEndpoint(activeTab.url);

    const storedSnapshot = await getStoredSnapshot(activeTab.id);

    if (storedSnapshot?.manifest) {
      state.manifest = storedSnapshot.manifest;
      state.sourceLabel =
        "Live bridge snapshot · " + (storedSnapshot.captured_at || "unknown timestamp");
      renderManifest(state.manifest);
      setButtonsEnabled(true);
      setStatus("Loaded live registry snapshot from active tab.", "ok");
      return;
    }

    const response = await fetch(state.endpoint, {
      headers: {
        accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Runtime endpoint returned " + response.status + ".");
    }

    state.manifest = await response.json();
    state.sourceLabel = "Endpoint fallback · " + state.endpoint;
    renderManifest(state.manifest);
    setButtonsEnabled(true);
    setStatus("Loaded runtime manifest from endpoint fallback.", "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extension error";
    metaNode.textContent = state.endpoint
      ? "Tried " + state.endpoint
      : "Unable to resolve endpoint for the active tab.";
    sourceNode.textContent = "No live bridge snapshot or endpoint manifest was available.";
    elementsNode.innerHTML = "<li>Mount AICDevtoolsBridge in the app or expose /.well-known/agent/ui.</li>";
    jsonNode.textContent = message;
    setStatus(message, "error");
  }
}

refreshButton.addEventListener("click", () => {
  void loadManifest();
});

openEndpointButton.addEventListener("click", () => {
  if (state.endpoint) {
    void chrome.tabs.create({ url: state.endpoint });
  }
});

copyJsonButton.addEventListener("click", async () => {
  if (!state.manifest) {
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(state.manifest, null, 2));
  setStatus("Manifest JSON copied to clipboard.", "ok");
});

void loadManifest();
