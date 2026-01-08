// 현재 로드된 메시지
let currentMessages = {};

// 언어별 메시지 로드
async function loadMessages(lang) {
  try {
    const response = await fetch(
      chrome.runtime.getURL(`_locales/${lang}/messages.json`)
    );
    const messages = await response.json();
    currentMessages = messages;
    return messages;
  } catch (error) {
    console.error(`Failed to load messages for ${lang}:`, error);
    // 기본 언어로 폴백
    const fallbackResponse = await fetch(
      chrome.runtime.getURL(`_locales/en/messages.json`)
    );
    const fallbackMessages = await fallbackResponse.json();
    currentMessages = fallbackMessages;
    return fallbackMessages;
  }
}

// 메시지 가져오기
function getMessage(key) {
  return currentMessages[key]?.message || key;
}

// i18n 초기화 함수
async function initializeI18n() {
  // 저장된 언어 가져오기
  const storage = await chrome.storage.local.get(["selectedLanguage"]);
  const uiLang = chrome.i18n.getUILanguage();
  let defaultLang = uiLang.split("-")[0];

  // zh-CN, zh-TW 처리
  if (uiLang.startsWith("zh")) {
    defaultLang = uiLang.replace("-", "_");
  }

  const selectedLang = storage.selectedLanguage || defaultLang;

  // 메시지 로드
  await loadMessages(selectedLang);

  // data-i18n 속성을 가진 모든 요소들의 textContent 설정
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    element.textContent = getMessage(key);
  });

  // data-i18n-placeholder 속성을 가진 모든 요소들의 placeholder 설정
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    element.placeholder = getMessage(key);
  });

  // data-i18n-html 속성을 가진 모든 요소들의 innerHTML 설정
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    const key = element.getAttribute("data-i18n-html");
    element.innerHTML = getMessage(key);
  });

  // 언어 선택기 초기화
  await initLanguageSelector();
}

// 언어 선택기 초기화
async function initLanguageSelector() {
  const langSelect = document.getElementById("lang-select");
  const langBtn = document.getElementById("lang-btn");

  // 저장된 언어 가져오기
  const storage = await chrome.storage.local.get(["selectedLanguage"]);
  const uiLang = chrome.i18n.getUILanguage();
  let defaultLang = uiLang.split("-")[0];

  // zh-CN, zh-TW 처리
  if (uiLang.startsWith("zh")) {
    defaultLang = uiLang.replace("-", "_");
  }

  const currentLang = storage.selectedLanguage || defaultLang;

  // 현재 언어 선택
  if (langSelect.querySelector(`option[value="${currentLang}"]`)) {
    langSelect.value = currentLang;
  }

  // 버튼 클릭시 선택기 토글
  langBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    langSelect.classList.toggle("show");
  });

  // 언어 변경
  langSelect.addEventListener("change", async (e) => {
    const newLang = e.target.value;

    // 언어 저장
    await chrome.storage.local.set({ selectedLanguage: newLang });

    // 메시지 리로드
    await loadMessages(newLang);

    // UI 업데이트
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

    langSelect.classList.remove("show");

    // 헤더 목록 다시 로드 (번역된 텍스트 적용)
    loadHeaders();
  });

  // 외부 클릭시 닫기
  document.addEventListener("click", (e) => {
    if (!langBtn.contains(e.target) && !langSelect.contains(e.target)) {
      langSelect.classList.remove("show");
    }
  });
}

// 페이지 로드시 i18n 초기화
initializeI18n();

// 탭 전환 기능
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabName = btn.dataset.tab;

    // 모든 탭 버튼 비활성화
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    // 모든 탭 콘텐츠 숨기기
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));

    // 선택된 탭 활성화
    btn.classList.add("active");
    document.getElementById(`${tabName}-tab`).classList.add("active");
  });
});

// 요청 헤더 추가
document.getElementById("add-req-btn").addEventListener("click", async () => {
  const name = document.getElementById("req-name").value.trim();
  const value = document.getElementById("req-value").value.trim();

  if (!name || !value) {
    alert(getMessage("alertEmptyFields"));
    return;
  }

  await addHeader("request", name, value);

  // 입력 필드 초기화
  document.getElementById("req-name").value = "";
  document.getElementById("req-value").value = "";

  loadHeaders();
});

// Chrome에서 수정 가능한 response 헤더 목록
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

// 응답 헤더 추가
document.getElementById("add-res-btn").addEventListener("click", async () => {
  const name = document.getElementById("res-name").value.trim();
  const value = document.getElementById("res-value").value.trim();

  if (!name || !value) {
    alert(getMessage("alertEmptyFields"));
    return;
  }

  // Response 헤더 검증
  // if (!MODIFIABLE_RESPONSE_HEADERS.includes(name.toLowerCase())) {
  //   const proceed = confirm(
  //     `⚠️ 경고: "${name}" 헤더는 Chrome에서 수정하지 못할 수 있습니다.\n\n` +
  //       `수정 가능한 Response 헤더:\n${MODIFIABLE_RESPONSE_HEADERS.join(
  //         "\n"
  //       )}\n\n` +
  //       `그래도 추가하시겠습니까? (적용되지 않습니다)`
  //   );
  //   if (!proceed) return;
  // }

  await addHeader("response", name, value);

  // 입력 필드 초기화
  document.getElementById("res-name").value = "";
  document.getElementById("res-value").value = "";

  loadHeaders();
});

// 헤더 추가 함수
async function addHeader(type, name, value) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  // 중복 체크
  const exists = headers.some(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    alert(getMessage("alertDuplicate"));
    return;
  }

  headers.push({ name, value, enabled: true });
  await chrome.storage.local.set({ [`${type}Headers`]: headers });

  // background script에 업데이트 알림
  chrome.runtime.sendMessage({ action: "updateRules" });
}

// 헤더 온오프 토글 함수
async function toggleHeader(type, index, enabled) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  if (headers[index]) {
    headers[index].enabled = enabled;
    await chrome.storage.local.set({ [`${type}Headers`]: headers });

    // background script에 업데이트 알림
    chrome.runtime.sendMessage({ action: "updateRules" });

    loadHeaders();
  }
}

// 헤더 이름 수정 함수
async function updateHeaderName(type, index, newName) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  if (headers[index]) {
    // 중복 체크 (자기 자신 제외)
    const exists = headers.some(
      (h, i) => i !== index && h.name.toLowerCase() === newName.toLowerCase()
    );
    if (exists) {
      alert(getMessage("alertDuplicate"));
      loadHeaders();
      return;
    }

    headers[index].name = newName;
    await chrome.storage.local.set({ [`${type}Headers`]: headers });

    // background script에 업데이트 알림
    chrome.runtime.sendMessage({ action: "updateRules" });

    loadHeaders();
  }
}

// 헤더 값 수정 함수
async function updateHeaderValue(type, index, newValue) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  if (headers[index]) {
    headers[index].value = newValue;
    await chrome.storage.local.set({ [`${type}Headers`]: headers });

    // background script에 업데이트 알림
    chrome.runtime.sendMessage({ action: "updateRules" });

    loadHeaders();
  }
}

// 헤더 삭제 함수 (인덱스 기반)
async function deleteHeaderByIndex(type, index) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  headers.splice(index, 1);
  await chrome.storage.local.set({ [`${type}Headers`]: headers });

  // background script에 업데이트 알림
  chrome.runtime.sendMessage({ action: "updateRules" });

  loadHeaders();
}

// 헤더 삭제 함수
async function deleteHeader(type, name) {
  const storage = await chrome.storage.local.get([`${type}Headers`]);
  const headers = storage[`${type}Headers`] || [];

  const filtered = headers.filter((h) => h.name !== name);
  await chrome.storage.local.set({ [`${type}Headers`]: filtered });

  // background script에 업데이트 알림
  chrome.runtime.sendMessage({ action: "updateRules" });

  loadHeaders();
}

// 저장된 헤더 목록 로드
async function loadHeaders() {
  const storage = await chrome.storage.local.get([
    "requestHeaders",
    "responseHeaders",
  ]);

  const requestHeaders = storage.requestHeaders || [];
  const responseHeaders = storage.responseHeaders || [];

  // 요청 헤더 렌더링
  renderHeaders("req", requestHeaders);

  // 응답 헤더 렌더링
  renderHeaders("res", responseHeaders);
}

// 헤더 목록 렌더링
function renderHeaders(prefix, headers) {
  const listElement = document.getElementById(`${prefix}-headers-list`);

  if (headers.length === 0) {
    listElement.innerHTML = `<div class="empty-state">${getMessage(
      "emptyState"
    )}</div>`;
    return;
  }

  const type = prefix === "req" ? "request" : "response";

  listElement.innerHTML = headers
    .map((header, index) => {
      // Response 헤더인 경우 수정 가능 여부 확인
      const isInvalid =
        type === "response" &&
        !MODIFIABLE_RESPONSE_HEADERS.includes(header.name.toLowerCase());
      const warningIcon = ""; //isInvalid ? " ⚠️" : "";
      const isEnabled = header.enabled !== false; // undefined면 true로 처리

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
          ${
            isInvalid
              ? `<div class="warning-text" data-i18n="warningNotApplied">${getMessage(
                  "warningNotApplied"
                )}</div>`
              : ""
          }
        </div>
        <button class="delete-btn" data-type="${type}" data-i18n="btnDelete" data-index="${index}">${getMessage(
        "btnDelete"
      )}</button>
      </div>
    `;
    })
    .join("");

  // 체크박스 이벤트 리스너 추가
  listElement.querySelectorAll(".header-toggle").forEach((checkbox) => {
    checkbox.addEventListener("change", async (e) => {
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      await toggleHeader(type, index, e.target.checked);
    });
  });

  // 헤더 이름 변경 이벤트 리스너 추가
  listElement.querySelectorAll(".header-name-input").forEach((input) => {
    input.addEventListener("blur", async (e) => {
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      const newName = e.target.value.trim();
      if (newName) {
        await updateHeaderName(type, index, newName);
      } else {
        loadHeaders(); // 빈 값이면 원래대로 복원
      }
    });
    // Enter 키로도 저장
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.target.blur();
      }
    });
  });

  // 헤더 값 변경 이벤트 리스너 추가
  listElement.querySelectorAll(".header-value-input").forEach((input) => {
    input.addEventListener("blur", async (e) => {
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      const newValue = e.target.value.trim();
      if (newValue) {
        await updateHeaderValue(type, index, newValue);
      } else {
        loadHeaders(); // 빈 값이면 원래대로 복원
      }
    });
    // Enter 키로도 저장
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.target.blur();
      }
    });
  });

  // 삭제 버튼 이벤트 리스너 추가
  listElement.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const index = parseInt(btn.dataset.index);
      deleteHeaderByIndex(type, index);
    });
  });
}

// XSS 방지를 위한 HTML 이스케이프
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

// 페이지 로드시 저장된 헤더 표시
loadHeaders();
