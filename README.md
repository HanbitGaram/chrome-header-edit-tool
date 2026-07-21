# Simple Header Editor

A lightweight Chrome extension for adding, editing, and removing HTTP request and response headers. Built on Manifest V3 and the `declarativeNetRequest` API, so headers are rewritten natively by the browser without intercepting traffic in JavaScript.

- Chrome Web Store: https://chromewebstore.google.com/detail/odfapcbkmbbfnijdnicoifgpjnjnnenn
- Source code: https://github.com/HanbitGaram/chrome-header-edit-tool

## Features

- **Request and response headers** — Manage both directions from separate tabs in the popup.
- **Per-site scoping** — Each header can apply to every site, or only to the site in the current tab. Toggle the pin chip when adding a header (or on a saved header) to scope it to the active tab's domain, subdomains included.
- **Enable / disable without deleting** — Every saved header has an on/off switch, so you can pause a rule and bring it back later.
- **Inline editing** — Edit the name and value of saved headers directly in the list; changes are applied on blur or Enter.
- **Autocomplete for common headers** — Suggestions for frequently used request headers (`Authorization`, `User-Agent`, ...) and CORS/security response headers (`Access-Control-Allow-Origin`, `Content-Security-Policy`, ...).
- **51 languages** — The popup UI is localized for all locales supported by the Chrome Web Store. The language follows the browser setting and can be changed manually in the popup.
- **No external dependencies** — Plain HTML/CSS/JS, no build step, no analytics, no network calls beyond the headers you configure.

## Installation

### From the Chrome Web Store

Install from the [store page](https://chromewebstore.google.com/detail/odfapcbkmbbfnijdnicoifgpjnjnnenn).

### From source

1. Clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the repository folder.

## Usage

1. Click the extension icon to open the popup.
2. Pick the **Request Headers** or **Response Headers** tab.
3. Enter a header name and value.
4. Optionally toggle the pin chip to apply the header only to the site open in the current tab.
5. Click **Add**. The rule takes effect immediately in all tabs.

Saved headers can be edited in place, scoped or unscoped with the pin chip, switched on/off, or deleted.

## How it works

- The popup stores headers in `chrome.storage.local` and notifies the background service worker.
- The service worker (`background.js`) converts the stored headers into `declarativeNetRequest` dynamic rules. Headers with the same site scope are grouped into a single rule; site-scoped rules use the `requestDomains` condition, which also matches subdomains.
- Because rules are evaluated by the browser itself, there is no per-request JavaScript overhead and no access to request bodies or credentials.

## Limitations

- Chrome only allows a limited set of response headers to be modified by extensions (mainly CORS and security headers such as `Access-Control-Allow-Origin`, `Content-Security-Policy`, `X-Frame-Options`). Other response headers can be saved but may not be applied; the popup marks these entries with a warning.
- Headers cannot be modified on browser-internal pages (`chrome://`, the Web Store, etc.).
- Request header rules apply to all resource types (documents, XHR/fetch, scripts, images, WebSocket, and so on) for the matched sites.

## Project structure

```
manifest.json    Extension manifest (Manifest V3)
background.js    Service worker: converts saved headers into declarativeNetRequest rules
popup.html       Popup markup
popup.css        Popup styles
popup.js         Popup logic: header CRUD, site scoping, i18n, language selector
_locales/        Localized UI strings (51 locales)
```

## Permissions

| Permission | Purpose |
| --- | --- |
| `declarativeNetRequest` (+ host access) | Create the dynamic rules that rewrite headers |
| `storage` | Persist saved headers and the selected UI language |
| `webRequest` | Diagnostics for header matching |
| `<all_urls>` | Apply header rules on any site; read the active tab's domain for per-site scoping |
