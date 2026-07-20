import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "../lib/firebaseAdmin.ts";
import { searchWeb } from "../lib/search/web.ts";
import { searchYouTube } from "../lib/search/youtube.ts";
import { sendItemMessage } from "../lib/telegram.ts";
import { urlHash, normalizeUrl } from "../lib/dedupe.ts";
import type { Keyword, ScanHistoryItem, SearchResult } from "../lib/types.ts";

// Vercel Cron 이 정기 호출하는 스캔 엔드포인트.
// 활성 키워드마다 웹/유튜브를 검색해 신규 자료를 텔레그램으로 알립니다.

const DAY = 24 * 60 * 60 * 1000;

const FREQUENCY_INTERVAL: Record<Keyword["frequency"], number> = {
  daily: 1 * DAY,
  twice_weekly: 3 * DAY,
  weekly: 7 * DAY,
};

// 크론 호출 인증: Vercel Cron 은 Authorization: Bearer <CRON_SECRET> 를 붙입니다.
function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 시크릿 미설정 시 개발 편의상 통과
  return req.headers.authorization === `Bearer ${secret}`;
}

function dueForScan(kw: Keyword, now: number): boolean {
  if (!kw.active) return false;
  if (!kw.lastScanAt) return true;
  return now - kw.lastScanAt >= FREQUENCY_INTERVAL[kw.frequency] - 60 * 60 * 1000;
}

async function scanKeyword(
  db: FirebaseFirestore.Firestore,
  chatId: string,
  kw: Keyword,
  maxNotify: number,
): Promise<number> {
  // 1) 소스별 검색
  const found: SearchResult[] = [];
  if (kw.sources.includes("web")) {
    try {
      found.push(...(await searchWeb(kw.text, kw.lang, 10)));
    } catch (e) {
      console.error(`[scan] 웹 검색 실패 (${kw.text}):`, e);
    }
  }
  if (kw.sources.includes("youtube")) {
    try {
      found.push(...(await searchYouTube(kw.text, kw.lang, 5)));
    } catch (e) {
      console.error(`[scan] 유튜브 검색 실패 (${kw.text}):`, e);
    }
  }

  // 2) 이번 배치 내 중복 제거 (해시 기준)
  const byHash = new Map<string, SearchResult>();
  for (const r of found) {
    byHash.set(urlHash(r.url), r);
  }

  // 3) 기존 수집 이력과 대조 → 신규 건만, 알림 상한까지
  let notified = 0;
  for (const [id, item] of byHash) {
    if (notified >= maxNotify) break;

    const ref = db.collection("scan_history").doc(id);
    const snap = await ref.get();
    if (snap.exists) continue; // 이미 알림/저장/취소된 자료

    let messageId: number | null = null;
    try {
      messageId = await sendItemMessage(chatId, kw.text, id, item);
    } catch (e) {
      console.error(`[scan] 텔레그램 발송 실패 (${item.url}):`, e);
      continue;
    }

    const record: ScanHistoryItem = {
      id,
      keywordId: kw.id,
      url: normalizeUrl(item.url),
      title: item.title,
      source: item.source,
      notifiedAt: Date.now(),
      messageId,
      status: "notified",
    };
    await ref.set(record);
    notified++;
  }

  return notified;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    return res.status(500).json({ error: "TELEGRAM_CHAT_ID 미설정" });
  }

  const maxNotify = Number(process.env.MAX_NOTIFY_PER_KEYWORD ?? "5");
  const now = Date.now();

  try {
    const db = getDb();
    const kwSnap = await db.collection("keywords").where("active", "==", true).get();

    const summary: { keyword: string; newCount: number }[] = [];

    for (const doc of kwSnap.docs) {
      const kw = { ...(doc.data() as Keyword), id: doc.id };
      if (!dueForScan(kw, now)) continue;

      const newCount = await scanKeyword(db, chatId, kw, maxNotify);

      await doc.ref.update({ lastScanAt: Date.now(), lastNewCount: newCount });
      summary.push({ keyword: kw.text, newCount });
    }

    return res.status(200).json({ ok: true, scanned: summary.length, summary });
  } catch (e) {
    console.error("[scan] 실패:", e);
    return res.status(500).json({ error: String(e) });
  }
}
