function normalizeLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return normalizeLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}

function inferRole(element) {
  const explicitRole = element.getAttribute("role");

  switch ((explicitRole || "").toLowerCase()) {
    case "button":
      return "button";
    case "link":
      return "link";
    case "searchbox":
      return "searchbox";
    case "textbox":
      return "input";
    case "combobox":
      return "combobox";
    case "listbox":
      return "listbox";
    case "dialog":
      return "dialog";
    case "form":
      return "form";
    case "row":
      return "row";
    case "table":
      return "table";
    default:
      break;
  }

  switch (element.tagName.toLowerCase()) {
    case "a":
      return "link";
    case "button":
      return "button";
    case "select":
      return "select";
    case "textarea":
      return "textarea";
    case "input": {
      const type = (element.getAttribute("type") || "").toLowerCase();

      if (type === "checkbox") {
        return "checkbox";
      }

      if (type === "radio") {
        return "radio";
      }

      if (type === "search") {
        return "searchbox";
      }

      return "input";
    }
    default:
      return "generic";
  }
}

function isVisible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  if (element.hidden || element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }

  return rect.width > 0 && rect.height > 0;
}

function readLabel(element) {
  return normalizeLabel(
    element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.getAttribute("value") ||
      element.textContent ||
      ""
  );
}

function collectDomCandidates() {
  const pageUrl = window.location.href;
  const routePattern = window.location.pathname || "/";
  const seenKeys = new Set();
  const candidates = [];

  Array.from(document.querySelectorAll("button, a, input, select, textarea, [role]")).forEach((element) => {
    if (!isVisible(element)) {
      return;
    }

    const label = readLabel(element);

    if (!label) {
      return;
    }

    const role = inferRole(element);
    const key = routePattern + "::" + role + "::" + slugify(label);

    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    candidates.push({
      annotated_agent_id:
        element.getAttribute("data-agent-id") ||
        element.getAttribute("data-aic-id") ||
        undefined,
      key,
      label,
      page_url: pageUrl,
      role,
      route_pattern: routePattern,
      selectors: {
        testId:
          element.getAttribute("data-testid") ||
          element.getAttribute("data-test-id") ||
          undefined,
        text: label
      },
      tag_name: element.tagName.toLowerCase()
    });
  });

  return candidates;
}

window.addEventListener("aic:devtools:snapshot", (event) => {
  const detail = event?.detail;

  if (!detail || typeof detail !== "object" || !detail.manifest) {
    return;
  }

  void chrome.runtime.sendMessage({
    envelope: detail,
    type: "aic:set-tab-snapshot"
  });
}, true);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "aic:collect-dom-candidates") {
    sendResponse({
      candidates: collectDomCandidates()
    });
    return true;
  }

  return false;
});
