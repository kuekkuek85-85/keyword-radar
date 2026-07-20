import type { SearchResult } from "./types.js";

// 텔레그램 Bot API 얇은 래퍼.

const API_BASE = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN 환경변수가 설정되지 않았습니다.");
  return t;
}

async function call<T = unknown>(method: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new Error(`Telegram ${method} 실패: ${json.description ?? res.status}`);
  }
  return json.result as T;
}

const SOURCE_LABEL: Record<string, string> = {
  web: "🌐 웹",
  youtube: "▶️ 유튜브",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 자료 1건을 저장/취소 인라인 버튼과 함께 발송. 반환값은 message_id. */
export async function sendItemMessage(
  chatId: string,
  keywordText: string,
  scanId: string,
  item: SearchResult,
): Promise<number> {
  const label = SOURCE_LABEL[item.source] ?? item.source;
  const lines = [
    `<b>${escapeHtml(item.title)}</b>`,
    "",
    escapeHtml(item.snippet).slice(0, 400),
    "",
    `${label} · 🏷 ${escapeHtml(keywordText)}`,
    item.url,
  ];

  const result = await call<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: lines.join("\n"),
    parse_mode: "HTML",
    disable_web_page_preview: false,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💾 저장", callback_data: `save:${scanId}` },
          { text: "❌ 취소", callback_data: `dismiss:${scanId}` },
        ],
      ],
    },
  });
  return result.message_id;
}

/** 콜백 쿼리에 즉시 응답 (텔레그램 3초 타임아웃 대응). */
export async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

/** 저장 확정: 버튼 제거 후 "저장됨" 표시로 메시지 텍스트 갱신. */
export async function markSaved(chatId: string, messageId: number, originalText: string): Promise<void> {
  await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: `✅ <b>저장됨</b>\n\n${escapeHtml(originalText)}`.slice(0, 4096),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

/** 취소: 메시지 삭제. 48시간 경과 등으로 삭제 불가하면 만료 표시로 대체. */
export async function dismissMessage(chatId: string, messageId: number): Promise<void> {
  try {
    await call("deleteMessage", { chat_id: chatId, message_id: messageId });
  } catch {
    // 48시간 초과 등 삭제 불가 → 버튼만 제거하고 만료 표시
    await call("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    }).catch(() => undefined);
    await call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: "🗑 만료됨 (삭제할 수 없어 표시로 대체)",
    }).catch(() => undefined);
  }
}
