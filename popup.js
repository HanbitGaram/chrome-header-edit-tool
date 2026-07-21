// Currently loaded messages
let currentMessages = {};

// Load messages for a language
async function loadMessages(lang) {
  try {
    const response = await fetch(
      chrome.runtime.getURL(`_locales/${lang}/messages.json`),
    );
    const messages = await response.json();
    currentMessages = messages;
    return messages;
  } catch (error) {
    console.error(`Failed to load messages for ${lang}:`, error);
    // Fall back to the default language
    const fallbackResponse = await fetch(
      chrome.runtime.getURL(`_locales/en/messages.json`),
    );
    const fallbackMessages = await fallbackResponse.json();
    currentMessages = fallbackMessages;
    return fallbackMessages;
  }
}

// Get a message by key
function getMessage(key) {
  return currentMessages[key]?.message || key;
}

// Initialize i18n
async function initializeI18n() {
  // Get the saved language
  const storage = await chrome.storage.local.get(["selectedLanguage"]);
  const uiLang = chrome.i18n.getUILanguage();
  let defaultLang = uiLang.split("-")[0];

  // Handle locales with regional variants (zh-CN, zh-TW, pt-BR, pt-PT)
  if (uiLang.startsWith("zh")) {
    defaultLang = uiLang.replace("-", "_");
  } else if (defaultLang === "pt") {
    defaultLang = uiLang === "pt-BR" ? "pt_BR" : "pt_PT";
  }

  const selectedLang = storage.selectedLanguage || defaultLang;

  // Load messages
  await loadMessages(selectedLang);

  // Set textContent for all elements with a data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    element.textContent = getMessage(key);
  });

  // Set placeholder for all elements with a data-i18n-placeholder attribute
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    element.placeholder = getMessage(key);
  });

  // Set innerHTML for all elements with a data-i18n-html attribute
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    const key = element.getAttribute("data-i18n-html");
    element.innerHTML = getMessage(key);
  });

  // Set title (tooltip) for all elements with a data-i18n-title attribute
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const key = element.getAttribute("data-i18n-title");
    element.title = getMessage(key);
  });

  // Initialize the language selector
  await initLanguageSelector();
}

// Initialize the language selector
async function initLanguageSelector() {
  const langSelect = document.getElementById("lang-select");
  const langBtn = document.getElementById("lang-btn");

  // Get the saved language
  const storage = await chrome.storage.local.get(["selectedLanguage"]);
  const uiLang = chrome.i18n.getUILanguage();
  let defaultLang = uiLang.split("-")[0];

  // Handle locales with regional variants (zh-CN, zh-TW, pt-BR, pt-PT)
  if (uiLang.startsWith("zh")) {
    defaultLang = uiLang.replace("-", "_");
  } else if (defaultLang === "pt") {
    defaultLang = uiLang === "pt-BR" ? "pt_BR" : "pt_PT";
  }

  const currentLang = storage.selectedLanguage || defaultLang;

  // Select the current language
  if (langSelect.querySelector(`option[value="${currentLang}"]`)) {
    langSelect.value = currentLang;
  }

  // Toggle the selector on button click
  langBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    langSelect.classList.toggle("show");
  });

  // Change language
  langSelect.addEventListener("change", async (e) => {
    const newLang = e.target.value;

    // Save the language
    await chrome.storage.local.set({ selectedLanguage: newLang });

    // Reload messages
    await loadMessages(newLang);

    // Update the UI
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      element.textContent = getMessage(key);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      const key = element.getAttribute("data-i18n-placeholder");
      element.placeholder = getMessage(key);
    });

    document.querySelectorAll("[data-i18n-html]").forEach((element) => {
      const key = element.getAttribute("data-i18n-html");
      element.innerHTML = getMessage(key);
    });

    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      const key = element.getAttribute("data-i18n-title");
      element.title = getMessage(key);
    });

    langSelect.classList.remove("show");

    // Reload the header list (apply translated text)
    loadHeaders();
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!langBtn.contains(e.target) && !langSelect.contains(e.target)) {
      langSelect.classList.remove("show");
    }
  });
}

// Initialize i18n on page load
initializeI18n();

// Tab switching
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabName = btn.dataset.tab;

    // Deactivate all tab buttons
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    // Hide all tab contents
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));

    // Activate the selected tab
    btn.classList.add("active");
    document.getElementById(`${tabName}-tab`).classList.add("active");
  });
});

// Get the active tab's domain (empty for non-web pages such as chrome://)
async function getActiveTabDomain() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = new URL(tab.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.hostname;
  } catch (error) {
    return "";
  }
}

// Add a request header
document.getElementById("add-req-btn").addEventListener("click", async () => {
  const name = document.getElementById("req-name").value.trim();
  const value = document.getElementById("req-value").value.trim();
  const siteOnly = document.getElementById("req-site-only").checked;

  if (!name || !value) {
    alert(getMessage("alertEmptyFields"));
    return;
  }

  const sites = siteOnly ? await getActiveTabDomain() : "";
  await addHeader("request", name, value, sites);

  // Reset input fields
  document.getElementById("req-name").value = "";
  document.getElementById("req-value").value = "";
  document.getElementById("req-site-only").checked = false;

  loadHeaders();
});

// Response headers modifiable by Chrome
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

// Add a response header
document.getElementById("add-res-btn").addEventListener("click", async () => {
  const name = document.getElementById("res-name").value.trim();
  const value = document.getElementById("res-value").value.trim();
  const siteOnly = document.getElementById("res-site-only").checked;

  if (!name || !value) {
    alert(getMessage("alertEmptyFields"));
    return;
  }

  // Validate response header
  // if (!MODIFIABLE_RESPONSE_HEADERS.includes(name.toLowerCase())) {
  //   const proceed = confirm(
  //     `⚠️ Warning: the "${name}" header may not be modifiable by Chrome.\n\n` +
  //       `Modifiable response headers:\n${MODIFIABLE_RESPONSE_HEADERS.join(
  //         "\n"
  //       )}\n\n` +
  //       `Add it anyway? (It will not be applied)`
  //   );
  //   if (!proceed) return;
  // }

  const sites = siteOnly ? await getActiveTabDomain() : "";
  await addHeader("response", name, value, sites);

  // Reset input fields
  document.getElementById("res-name").value = "";
  document.getElementById("res-value").value = "";
  document.getElementById("res-site-only").checked = false;

  loadHeaders();
});

// Add a header
async function addHeader(type, name, value, sites = "") {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  // Check for duplicates
  const exists = headers.some(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  if (exists) {
    alert(getMessage("alertDuplicate"));
    return;
  }

  headers.push({ name, value, sites, enabled: true });
  await chrome.storage.local.set({ [`${type}Headers`]: headers });

  // Notify the background script to update rules
  chrome.runtime.sendMessage({ action: "updateRules" });
}

// Toggle a header on/off
async function toggleHeader(type, index, enabled) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  if (headers[index]) {
    headers[index].enabled = enabled;
    await chrome.storage.local.set({ [`${type}Headers`]: headers });

    // Notify the background script to update rules
    chrome.runtime.sendMessage({ action: "updateRules" });

    loadHeaders();
  }
}

// Update a header name
async function updateHeaderName(type, index, newName) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  if (headers[index]) {
    // Check for duplicates (excluding itself)
    const exists = headers.some(
      (h, i) => i !== index && h.name.toLowerCase() === newName.toLowerCase(),
    );
    if (exists) {
      alert(getMessage("alertDuplicate"));
      loadHeaders();
      return;
    }

    headers[index].name = newName;
    await chrome.storage.local.set({ [`${type}Headers`]: headers });

    // Notify the background script to update rules
    chrome.runtime.sendMessage({ action: "updateRules" });

    loadHeaders();
  }
}

// Update a header's site scope (empty = apply to all sites)
async function updateHeaderSites(type, index, newSites) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  if (headers[index]) {
    headers[index].sites = newSites;
    await chrome.storage.local.set({ [`${type}Headers`]: headers });

    // Notify the background script to update rules
    chrome.runtime.sendMessage({ action: "updateRules" });

    loadHeaders();
  }
}

// Update a header value
async function updateHeaderValue(type, index, newValue) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  if (headers[index]) {
    headers[index].value = newValue;
    await chrome.storage.local.set({ [`${type}Headers`]: headers });

    // Notify the background script to update rules
    chrome.runtime.sendMessage({ action: "updateRules" });

    loadHeaders();
  }
}

// Delete a header by index
async function deleteHeaderByIndex(type, index) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  headers.splice(index, 1);
  await chrome.storage.local.set({ [`${type}Headers`]: headers });

  // Notify the background script to update rules
  chrome.runtime.sendMessage({ action: "updateRules" });

  loadHeaders();
}

// Delete a header by name
async function deleteHeader(type, name) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  const filtered = headers.filter((h) => h.name !== name);
  await chrome.storage.local.set({ [`${type}Headers`]: filtered });

  // Notify the background script to update rules
  chrome.runtime.sendMessage({ action: "updateRules" });

  loadHeaders();
}

// Load saved headers
async function loadHeaders() {
  const storage = await chrome.storage.local.get([
    "requestHeaders",
    "responseHeaders",
  ]);

  const requestHeaders = storage.requestHeaders || [];
  const responseHeaders = storage.responseHeaders || [];

  // Render request headers
  renderHeaders("req", requestHeaders);

  // Render response headers
  renderHeaders("res", responseHeaders);
}

// Render the header list
function renderHeaders(prefix, headers) {
  const listElement = document.getElementById(`${prefix}-headers-list`);

  if (headers.length === 0) {
    listElement.innerHTML = `<div class="empty-state" data-i18n="emptyState">${getMessage(
      "emptyState",
    )}</div>`;
    return;
  }

  const type = prefix === "req" ? "request" : "response";

  listElement.innerHTML = headers
    .map((header, index) => {
      // For response headers, check whether they are modifiable
      const isInvalid =
        type === "response" &&
        !MODIFIABLE_RESPONSE_HEADERS.includes(header.name.toLowerCase());
      const warningIcon = ""; //isInvalid ? " ⚠️" : "";
      const isEnabled = header.enabled !== false; // treat undefined as true

      return `
      <div class="header-item ${!isEnabled ? "disabled" : ""}">
        <input 
          type="checkbox" 
          class="header-toggle" 
          data-type="${type}" 
          data-index="${index}"
          ${isEnabled ? "checked" : ""}
        />
        <div class="header-inputs">
          <input 
            type="text" 
            class="header-name-input" 
            value="${escapeHtml(header.name)}" 
            data-type="${type}" 
            data-index="${index}"
            placeholder="Header Name"
            ${!isEnabled ? "disabled" : ""}
          />${warningIcon}
          <input
            type="text"
            class="header-value-input"
            value="${escapeHtml(header.value)}"
            data-type="${type}"
            data-index="${index}"
            placeholder="Header Value"
            ${!isEnabled ? "disabled" : ""}
          />
          <label class="site-scope item-site-scope" title="${escapeHtml(
            getMessage("siteOnlyLabel"),
          )}">
            <input
              type="checkbox"
              class="header-site-toggle"
              data-type="${type}"
              data-index="${index}"
              ${header.sites ? "checked" : ""}
              ${!isEnabled ? "disabled" : ""}
            />
            <span class="site-chip">${
              header.sites
                ? `<span class="site-domain">${escapeHtml(header.sites)}</span>`
                : ""
            }</span>
          </label>
          ${
            isInvalid
              ? `<div class="warning-text" data-i18n="warningNotApplied">${getMessage(
                  "warningNotApplied",
                )}</div>`
              : ""
          }
        </div>
        <button class="delete-btn" data-type="${type}" data-i18n="btnDelete" data-index="${index}">${getMessage(
          "btnDelete",
        )}</button>
      </div>
    `;
    })
    .join("");

  // Add checkbox event listeners
  listElement.querySelectorAll(".header-toggle").forEach((checkbox) => {
    checkbox.addEventListener("change", async (e) => {
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      await toggleHeader(type, index, e.target.checked);
    });
  });

  // Add header name change listeners
  listElement.querySelectorAll(".header-name-input").forEach((input) => {
    input.addEventListener("blur", async (e) => {
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      const newName = e.target.value.trim();
      if (newName) {
        await updateHeaderName(type, index, newName);
      } else {
        loadHeaders(); // restore original if empty
      }
    });
    // Save on Enter key as well
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.target.blur();
      }
    });
  });

  // Add header value change listeners
  listElement.querySelectorAll(".header-value-input").forEach((input) => {
    input.addEventListener("blur", async (e) => {
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      const newValue = e.target.value.trim();
      if (newValue) {
        await updateHeaderValue(type, index, newValue);
      } else {
        loadHeaders(); // restore original if empty
      }
    });
    // Save on Enter key as well
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.target.blur();
      }
    });
  });

  // Add "apply to this site only" toggle listeners
  listElement.querySelectorAll(".header-site-toggle").forEach((checkbox) => {
    checkbox.addEventListener("change", async (e) => {
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      // Checked: apply only to the current tab's domain / unchecked: apply to all sites
      const sites = e.target.checked ? await getActiveTabDomain() : "";
      await updateHeaderSites(type, index, sites);
    });
  });

  // Add delete button listeners
  listElement.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const index = parseInt(btn.dataset.index);
      deleteHeaderByIndex(type, index);
    });
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Show saved headers on page load
loadHeaders();
