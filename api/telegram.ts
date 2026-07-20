import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "../lib/firebaseAdmin.js";
import { answerCallback, markSaved, dismissMessage } from "../lib/telegram.js";
import type { ScanHistoryItem, SavedItem } from "../lib/types.js";

// 텔레그램 웹훅. 인라인 버튼(저장/취소) 콜백을 처리합니다.
// 응답성: 즉시 answerCallbackQuery 로 응답 후 Firestore 작업을 진행합니다.

interface CallbackQuery {
  id: string;
  data?: string;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
}
interface Update {
  callback_query?: CallbackQuery;
}

// 웹훅 검증: setWebhook 시 등록한 secret_token 과 헤더를 대조.
function isValidSecret(req: VercelRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers["x-telegram-bot-api-secret-token"] === secret;
}

async function handleSave(scanId: string, chatId: number, messageId: number, text: string) {
  const db = getDb();
  const histRef = db.collection("scan_history").doc(scanId);
  const snap = await histRef.get();
  if (!snap.exists) return;

  const hist = snap.data() as ScanHistoryItem;
  if (hist.status === "saved") return; // 멱등: 중복 저장 방지

  // 키워드 텍스트 조회 (아카이브 필터 편의)
  let keywordText: string | undefined;
  try {
    const kwSnap = await db.collection("keywords").doc(hist.keywordId).get();
    keywordText = (kwSnap.data() as { text?: string } | undefined)?.text;
  } catch {
    /* 키워드가 삭제됐을 수 있음 — 무시 */
  }

  const saved: SavedItem = {
    id: scanId,
    keywordId: hist.keywordId,
    keywordText,
    url: hist.url,
    title: hist.title,
    snippet: text.slice(0, 500),
    source: hist.source,
    thumbnail: null,
    tags: [],
    memo: "",
    savedAt: Date.now(),
  };

  await db.collection("saved_items").doc(scanId).set(saved);
  await histRef.update({ status: "saved" });
  await markSaved(String(chatId), messageId, text);
}

async function handleDismiss(scanId: string, chatId: number, messageId: number) {
  const db = getDb();
  const histRef = db.collection("scan_history").doc(scanId);
  await histRef.update({ status: "dismissed" }).catch(() => undefined);
  await dismissMessage(String(chatId), messageId);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!isValidSecret(req)) {
    return res.status(401).json({ error: "invalid secret" });
  }

  const update = req.body as Update;
  const cq = update.callback_query;

  if (!cq || !cq.data || !cq.message) {
    return res.status(200).json({ ok: true });
  }

  const [action, scanId] = cq.data.split(":");
  const { message_id: messageId, chat, text } = cq.message;

  // 텔레그램 3초 타임아웃 대응: 먼저 콜백에 응답.
  await answerCallback(cq.id, action === "save" ? "저장했어요 💾" : "취소했어요").catch(
    () => undefined,
  );

  try {
    if (action === "save") {
      await handleSave(scanId, chat.id, messageId, text ?? "");
    } else if (action === "dismiss") {
      await handleDismiss(scanId, chat.id, messageId);
    }
  } catch (e) {
    console.error("[telegram] 콜백 처리 실패:", e);
  }

  return res.status(200).json({ ok: true });
}
