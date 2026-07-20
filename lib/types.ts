// 키워드 레이더 공용 도메인 타입.
// 클라이언트(src)와 서버(api/lib) 양쪽에서 참조합니다.

export type SourceKind = "web" | "youtube";

export type ScanStatus = "notified" | "saved" | "dismissed" | "expired";

// keywords 컬렉션
export interface Keyword {
  id: string;
  text: string;
  sources: SourceKind[];
  frequency: "daily" | "twice_weekly" | "weekly";
  lang: "ko" | "en";
  active: boolean;
  createdAt: number; // epoch ms
  lastScanAt: number | null;
  lastNewCount?: number;
}

// scan_history 컬렉션 (중복 방지용 수집 이력)
export interface ScanHistoryItem {
  id: string; // URL 정규화 후 해시
  keywordId: string;
  url: string;
  title: string;
  source: SourceKind;
  notifiedAt: number;
  messageId: number | null;
  status: ScanStatus;
}

// saved_items 컬렉션
export interface SavedItem {
  id: string;
  keywordId: string;
  keywordText?: string;
  url: string;
  title: string;
  snippet: string;
  source: SourceKind;
  thumbnail: string | null;
  tags: string[];
  memo: string;
  savedAt: number;
}

// 검색 어댑터가 반환하는 정규화된 결과 1건
export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  source: SourceKind;
  thumbnail: string | null;
}
