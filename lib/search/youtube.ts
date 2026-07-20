import type { SearchResult } from "../types.ts";

// YouTube Data API v3 검색 어댑터.

interface YouTubeSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
}
interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
}

export async function searchYouTube(
  query: string,
  lang: "ko" | "en",
  limit = 5,
): Promise<SearchResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.");

  // 최근 7일 이내 업로드된 영상만 (신규 자료 위주)
  const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    key,
    part: "snippet",
    q: query,
    type: "video",
    order: "date",
    maxResults: String(limit),
    publishedAfter,
    relevanceLanguage: lang,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) throw new Error(`YouTube 검색 실패: ${res.status}`);
  const data = (await res.json()) as YouTubeSearchResponse;

  return (data.items ?? [])
    .filter((it) => it.id?.videoId && it.snippet?.title)
    .map((it) => ({
      url: `https://youtube.com/watch?v=${it.id!.videoId}`,
      title: it.snippet!.title!,
      snippet: it.snippet!.description ?? "",
      source: "youtube" as const,
      thumbnail:
        it.snippet!.thumbnails?.medium?.url ??
        it.snippet!.thumbnails?.default?.url ??
        null,
    }));
}
