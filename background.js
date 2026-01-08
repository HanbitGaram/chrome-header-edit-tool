// 확장 프로그램 설치시 초기화
chrome.runtime.onInstalled.addListener(() => {
  console.log("헤더 수정기 확장 프로그램이 설치되었습니다.");
  updateRules();
});

// 확장 프로그램 시작시 규칙 업데이트
chrome.runtime.onStartup.addListener(() => {
  updateRules();
});

// popup에서 메시지 받기
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateRules") {
    updateRules();
  }
});

// Chrome에서 수정 가능한 response 헤더 목록 (소문자)
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

// declarativeNetRequest 규칙 업데이트
async function updateRules() {
  try {
    // 기존 규칙 삭제
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map((rule) => rule.id);

    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
      });
    }

    // 저장된 헤더 가져오기
    const storage = await chrome.storage.local.get([
      "requestHeaders",
      "responseHeaders",
    ]);
    const requestHeaders = storage.requestHeaders || [];
    const responseHeaders = storage.responseHeaders || [];

    const newRules = [];
    let ruleId = 1;

    // 요청 헤더 규칙 생성 (enabled가 true인 것만)
    const enabledRequestHeaders = requestHeaders.filter(
      (h) => h.enabled !== false
    );
    if (enabledRequestHeaders.length > 0) {
      newRules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: enabledRequestHeaders.map((header) => ({
            header: header.name,
            operation: "set",
            value: header.value,
          })),
        },
        condition: {
          urlFilter: "*",
          resourceTypes: [
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
          ],
        },
      });
    }

    // 응답 헤더 규칙 생성 (enabled가 true인 것만)
    const enabledResponseHeaders = responseHeaders.filter(
      (h) => h.enabled !== false
    );
    if (enabledResponseHeaders.length > 0) {
      // 수정 가능한 헤더만 필터링
      const validResponseHeaders = enabledResponseHeaders.filter((header) => {
        const isValid = MODIFIABLE_RESPONSE_HEADERS.includes(
          header.name.toLowerCase()
        );
        if (!isValid) {
          console.warn(
            `⚠️ 경고: "${
              header.name
            }" 헤더는 Chrome에서 수정할 수 없습니다. 수정 가능한 헤더: ${MODIFIABLE_RESPONSE_HEADERS.join(
              ", "
            )}`
          );
        }
        // return isValid;
      });

      if (enabledResponseHeaders.length > 0) {
        newRules.push({
          id: ruleId++,
          priority: 1,
          action: {
            type: "modifyHeaders",
            responseHeaders: enabledResponseHeaders.map((header) => ({
              header: header.name.toLowerCase(),
              operation: "set",
              value: header.value,
            })),
          },
          condition: {
            urlFilter: "|http*://*/*",
            resourceTypes: [
              // "main_frame", "sub_frame", "xmlhttprequest"
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
            ],
          },
        });

        console.log(
          `✅ Response 헤더 규칙 생성됨: ${enabledResponseHeaders.length}개`
        );
      } else if (responseHeaders.length > 0) {
        console.error(
          `❌ ${responseHeaders.length}개의 response 헤더가 모두 Chrome에서 지원되지 않습니다.`
        );
      }
    }

    // 새 규칙 추가
    if (newRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules,
      });
      console.log("✅ 헤더 규칙이 업데이트되었습니다:", newRules);
      console.log("📊 규칙 수:", newRules.length);
      console.log("📝 요청 헤더 수:", requestHeaders.length);
      console.log("📝 응답 헤더 수:", responseHeaders.length);
    } else {
      console.log("⚠️ 적용할 헤더 규칙이 없습니다.");
    }

    // 적용 상태를 저장 (UI에서 확인용)
    await chrome.storage.local.set({
      lastUpdate: new Date().toISOString(),
      appliedRulesCount: newRules.length,
    });
  } catch (error) {
    console.error("❌ 규칙 업데이트 중 오류 발생:", error);
    await chrome.storage.local.set({
      lastError: error.message,
      lastUpdate: new Date().toISOString(),
    });
  }
}
