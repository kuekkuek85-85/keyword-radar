import type { SearchResult } from "../types.js";

// 웹 검색 어댑터. SEARCH_PROVIDER 환경변수로 Serper / Tavily 를 전환합니다.
// 두 제공자의 응답을 공용 SearchResult 형태로 정규화합니다.

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
}
interface SerperResponse {
  organic?: SerperOrganic[];
}

async function searchSerper(query: string, lang: "ko" | "en", limit: number): Promise<SearchResult[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("SERPER_API_KEY 환경변수가 설정되지 않았습니다.");

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      q: query,
      gl: lang === "ko" ? "kr" : "us",
      hl: lang,
      num: limit,
      tbs: "qdr:w", // 최근 1주 (신규 자료 위주)
    }),
  });
  if (!res.ok) throw new Error(`Serper 검색 실패: ${res.status}`);
  const data = (await res.json()) as SerperResponse;

  return (data.organic ?? [])
    .filter((o) => o.link && o.title)
    .slice(0, limit)
    .map((o) => ({
      url: o.link!,
      title: o.title!,
      snippet: o.snippet ?? "",
      source: "web" as const,
      thumbnail: null,
    }));
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}
interface TavilyResponse {
  results?: TavilyResult[];
}

async function searchTavily(query: string, limit: number): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY 환경변수가 설정되지 않았습니다.");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: limit,
      topic: "news",
      days: 7,
    }),
  });
  if (!res.ok) throw new Error(`Tavily 검색 실패: ${res.status}`);
  const data = (await res.json()) as TavilyResponse;

  return (data.results ?? [])
    .filter((r) => r.url && r.title)
    .slice(0, limit)
    .map((r) => ({
      url: r.url!,
      title: r.title!,
      snippet: r.content ?? "",
      source: "web" as const,
      thumbnail: null,
    }));
}

export async function searchWeb(
  query: string,
  lang: "ko" | "en",
  limit = 10,
): Promise<SearchResult[]> {
  const provider = (process.env.SEARCH_PROVIDER ?? "serper").toLowerCase();
  if (provider === "tavily") return searchTavily(query, limit);
  return searchSerper(query, lang, limit);
}
