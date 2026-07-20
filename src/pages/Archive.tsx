import { useEffect, useMemo, useState } from "react";
import {
  deleteSavedItem,
  listSavedItems,
  updateSavedItem,
} from "../lib/firestore";
import type { SavedItem, SourceKind } from "../../lib/types";

type SourceFilter = "all" | SourceKind;
type PeriodFilter = "all" | "7d" | "30d";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Archive() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");

  async function refresh() {
    setLoading(true);
    try {
      setItems(await listSavedItems());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const keywordOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const it of items) {
      set.set(it.keywordId, it.keywordText ?? it.keywordId);
    }
    return [...set.entries()];
  }, [items]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const periodMs =
      periodFilter === "7d"
        ? 7 * 864e5
        : periodFilter === "30d"
          ? 30 * 864e5
          : Infinity;
    const q = search.trim().toLowerCase();

    return items.filter((it) => {
      if (keywordFilter !== "all" && it.keywordId !== keywordFilter) return false;
      if (sourceFilter !== "all" && it.source !== sourceFilter) return false;
      if (now - it.savedAt > periodMs) return false;
      if (q) {
        const hay = `${it.title} ${it.snippet} ${it.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, keywordFilter, sourceFilter, periodFilter]);

  async function addTag(item: SavedItem, tag: string) {
    const t = tag.trim();
    if (!t || item.tags.includes(t)) return;
    const tags = [...item.tags, t];
    await updateSavedItem(item.id, { tags });
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, tags } : x)));
  }

  async function removeTag(item: SavedItem, tag: string) {
    const tags = item.tags.filter((x) => x !== tag);
    await updateSavedItem(item.id, { tags });
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, tags } : x)));
  }

  async function saveMemo(item: SavedItem, memo: string) {
    if (memo === item.memo) return;
    await updateSavedItem(item.id, { memo });
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, memo } : x)));
  }

  async function remove(item: SavedItem) {
    if (!confirm("이 자료를 삭제할까요?")) return;
    await deleteSavedItem(item.id);
    setItems((prev) => prev.filter((x) => x.id !== item.id));
  }

  return (
    <div className="space-y-4">
      {/* 검색 · 필터 */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제목·스니펫·태그 검색"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <div className="flex flex-wrap gap-2 text-sm">
          <select
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5"
          >
            <option value="all">모든 키워드</option>
            {keywordOptions.map(([id, text]) => (
              <option key={id} value={id}>
                {text}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="rounded-lg border border-slate-300 px-2 py-1.5"
          >
            <option value="all">모든 소스</option>
            <option value="web">웹</option>
            <option value="youtube">유튜브</option>
          </select>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
            className="rounded-lg border border-slate-300 px-2 py-1.5"
          >
            <option value="all">전체 기간</option>
            <option value="7d">최근 7일</option>
            <option value="30d">최근 30일</option>
          </select>
          <span className="ml-auto self-center text-xs text-slate-400">
            {filtered.length}건
          </span>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <p className="text-sm text-slate-400">불러오는 중…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          조건에 맞는 저장 자료가 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((it) => (
            <SavedCard
              key={it.id}
              item={it}
              onAddTag={addTag}
              onRemoveTag={removeTag}
              onSaveMemo={saveMemo}
              onDelete={remove}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface CardProps {
  item: SavedItem;
  onAddTag: (item: SavedItem, tag: string) => void;
  onRemoveTag: (item: SavedItem, tag: string) => void;
  onSaveMemo: (item: SavedItem, memo: string) => void;
  onDelete: (item: SavedItem) => void;
}

function SavedCard({ item, onAddTag, onRemoveTag, onSaveMemo, onDelete }: CardProps) {
  const [tagInput, setTagInput] = useState("");
  const [memo, setMemo] = useState(item.memo);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-slate-900 hover:underline"
          >
            {item.title}
          </a>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400">
            <span>{item.source === "web" ? "🌐 웹" : "▶️ 유튜브"}</span>
            {item.keywordText && <span>🏷 {item.keywordText}</span>}
            <span>{formatDate(item.savedAt)}</span>
          </div>
        </div>
        <button
          onClick={() => onDelete(item)}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50"
        >
          삭제
        </button>
      </div>

      {item.snippet && (
        <p className="mt-2 line-clamp-3 text-sm text-slate-600">{item.snippet}</p>
      )}

      {/* 태그 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {item.tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
          >
            {t}
            <button
              onClick={() => onRemoveTag(item, t)}
              className="text-slate-400 hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAddTag(item, tagInput);
              setTagInput("");
            }
          }}
          placeholder="+ 태그"
          className="w-20 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs outline-none focus:border-slate-900"
        />
      </div>

      {/* 메모 */}
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={() => onSaveMemo(item, memo)}
        placeholder="메모 추가…"
        rows={memo ? 2 : 1}
        className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-900"
      />
    </li>
  );
}
