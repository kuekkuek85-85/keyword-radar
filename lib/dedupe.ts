import { createHash } from "node:crypto";

// 추적용 쿼리 파라미터는 정규화 단계에서 제거해 동일 자료의 중복 알림을 막습니다.
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "igshid",
  "ref",
  "ref_src",
  "spm",
];

/**
 * URL 을 정규화합니다.
 * - 소문자 호스트, www. 제거
 * - 추적 파라미터 제거, 남은 쿼리는 키 정렬
 * - 마지막 슬래시 제거
 * - youtube.com/watch?v= 및 youtu.be 는 동영상 ID 기준으로 통일
 */
export function normalizeUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim().toLowerCase();
  }

  u.hash = "";
  u.host = u.host.toLowerCase().replace(/^www\./, "");
  u.protocol = "https:";

  // 유튜브 링크 통일
  if (u.host === "youtu.be") {
    const id = u.pathname.slice(1);
    return `https://youtube.com/watch?v=${id}`;
  }
  if (u.host === "youtube.com" || u.host === "m.youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return `https://youtube.com/watch?v=${v}`;
  }

  for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
  u.searchParams.sort();

  let out = u.toString();
  // 쿼리/해시가 없을 때만 끝 슬래시 제거
  if (!u.search) out = out.replace(/\/$/, "");
  return out;
}

/** 정규화된 URL 로부터 안정적인 문서 ID(해시)를 만듭니다. */
export function urlHash(raw: string): string {
  return createHash("sha256")
    .update(normalizeUrl(raw))
    .digest("hex")
    .slice(0, 24);
}
