// Initialize on extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log("Header editor extension installed.");
  updateRules();
});

// Update rules on browser startup
chrome.runtime.onStartup.addListener(() => {
  updateRules();
});

// Receive messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateRules") {
    updateRules();
  }
});

// Response headers modifiable by Chrome (lowercase)
const MODIFIABLE_RESPONSE_HEADERS = [
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-expose-headers",
  "access-control-max-age",
  "content-security-policy",
  "content-security-policy-report-only",
  "cross-origin-embedder-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "x-content-type-options",
  "x-frame-options",
];

// Convert a string like "example.com, api.foo.com" into an array of domains
function parseSites(sites) {
  if (!sites) return [];
  return sites
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) =>
      s
        .replace(/^https?:\/\//, "")
        .replace(/^\*\./, "")
        .split("/")[0]
        .split(":")[0]
    )
    .filter(Boolean);
}

// Group headers by site scope (one rule per site group)
function groupBySites(headers) {
  const groups = new Map();
  for (const header of headers) {
    const domains = parseSites(header.sites);
    const key = JSON.stringify([...domains].sort());
    if (!groups.has(key)) {
      groups.set(key, { domains, headers: [] });
    }
    groups.get(key).headers.push(header);
  }
  return [...groups.values()];
}

const ALL_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other",
];

// Update declarativeNetRequest rules
async function updateRules() {
  try {
    // Remove existing rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map((rule) => rule.id);

    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
      });
    }

    // Get saved headers
    const storage = await chrome.storage.local.get([
      "requestHeaders",
      "responseHeaders",
    ]);
    const requestHeaders = storage.requestHeaders || [];
    const responseHeaders = storage.responseHeaders || [];

    const newRules = [];
    let ruleId = 1;

    // Create request header rules (enabled only, grouped by site scope)
    const enabledRequestHeaders = requestHeaders.filter(
      (h) => h.enabled !== false
    );
    for (const group of groupBySites(enabledRequestHeaders)) {
      const condition = {
        urlFilter: "*",
        resourceTypes: ALL_RESOURCE_TYPES,
      };
      // If sites are specified, apply only to those domains (including subdomains)
      if (group.domains.length > 0) {
        condition.requestDomains = group.domains;
      }

      newRules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: group.headers.map((header) => ({
            header: header.name,
            operation: "set",
            value: header.value,
          })),
        },
        condition,
      });
    }

    // Create response header rules (enabled only, grouped by site scope)
    const enabledResponseHeaders = responseHeaders.filter(
      (h) => h.enabled !== false
    );
    for (const header of enabledResponseHeaders) {
      if (!MODIFIABLE_RESPONSE_HEADERS.includes(header.name.toLowerCase())) {
        console.warn(
          `⚠️ Warning: the "${
            header.name
          }" header may not be modifiable by Chrome. Modifiable headers: ${MODIFIABLE_RESPONSE_HEADERS.join(
            ", "
          )}`
        );
      }
    }

    for (const group of groupBySites(enabledResponseHeaders)) {
      const condition = {
        urlFilter: "|http*://*/*",
        resourceTypes: ALL_RESOURCE_TYPES,
      };
      // If sites are specified, apply only to those domains (including subdomains)
      if (group.domains.length > 0) {
        condition.requestDomains = group.domains;
      }

      newRules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: "modifyHeaders",
          responseHeaders: group.headers.map((header) => ({
            header: header.name.toLowerCase(),
            operation: "set",
            value: header.value,
          })),
        },
        condition,
      });
    }

    // Add new rules
    if (newRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules,
      });
      console.log("✅ Header rules updated:", newRules);
      console.log("📊 Rule count:", newRules.length);
      console.log("📝 Request header count:", requestHeaders.length);
      console.log("📝 Response header count:", responseHeaders.length);
    } else {
      console.log("⚠️ No header rules to apply.");
    }

    // Save applied state (for the UI)
    await chrome.storage.local.set({
      lastUpdate: new Date().toISOString(),
      appliedRulesCount: newRules.length,
    });
  } catch (error) {
    console.error("❌ Failed to update rules:", error);
    await chrome.storage.local.set({
      lastError: error.message,
      lastUpdate: new Date().toISOString(),
    });
  }
}
