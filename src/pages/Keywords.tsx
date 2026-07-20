import { useEffect, useState } from "react";
import {
  createKeyword,
  deleteKeyword,
  listKeywords,
  updateKeyword,
  type KeywordInput,
} from "../lib/firestore";
import type { Keyword, SourceKind } from "../../lib/types";

const FREQ_LABEL: Record<Keyword["frequency"], string> = {
  daily: "매일",
  twice_weekly: "주 2회",
  weekly: "주 1회",
};

function formatDate(ms: number | null): string {
  if (!ms) return "아직 없음";
  return new Date(ms).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EMPTY_FORM: KeywordInput = {
  text: "",
  sources: ["web", "youtube"],
  frequency: "daily",
  lang: "ko",
};

export default function Keywords() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<KeywordInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setKeywords(await listKeywords());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.text.trim() || form.sources.length === 0) return;
    setSaving(true);
    try {
      await createKeyword(form);
      setForm(EMPTY_FORM);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function toggleSource(src: SourceKind) {
    setForm((f) => ({
      ...f,
      sources: f.sources.includes(src)
        ? f.sources.filter((s) => s !== src)
        : [...f.sources, src],
    }));
  }

  async function toggleActive(kw: Keyword) {
    await updateKeyword(kw.id, { active: !kw.active });
    await refresh();
  }

  async function remove(kw: Keyword) {
    if (!confirm(`"${kw.text}" 키워드를 삭제할까요?`)) return;
    await deleteKeyword(kw.id);
    await refresh();
  }

  return (
    <div className="space-y-6">
      {/* 등록 폼 */}
      <form
        onSubmit={handleAdd}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 text-sm font-semibold text-slate-700">키워드 등록</h2>
        <input
          value={form.text}
          onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
          placeholder="예: 바이브코딩과 소프트웨어공학"
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex gap-2">
            {(["web", "youtube"] as SourceKind[]).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => toggleSource(src)}
                className={`rounded-lg border px-3 py-1.5 ${
                  form.sources.includes(src)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-500"
                }`}
              >
                {src === "web" ? "🌐 웹" : "▶️ 유튜브"}
              </button>
            ))}
          </div>

          <select
            value={form.frequency}
            onChange={(e) =>
              setForm((f) => ({ ...f, frequency: e.target.value as Keyword["frequency"] }))
            }
            className="rounded-lg border border-slate-300 px-2 py-1.5"
          >
            <option value="daily">매일</option>
            <option value="twice_weekly">주 2회</option>
            <option value="weekly">주 1회</option>
          </select>

          <select
            value={form.lang}
            onChange={(e) =>
              setForm((f) => ({ ...f, lang: e.target.value as Keyword["lang"] }))
            }
            className="rounded-lg border border-slate-300 px-2 py-1.5"
          >
            <option value="ko">한국어</option>
            <option value="en">영어</option>
          </select>

          <button
            type="submit"
            disabled={saving || !form.text.trim() || form.sources.length === 0}
            className="ml-auto rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {saving ? "추가 중…" : "추가"}
          </button>
        </div>
      </form>

      {/* 목록 */}
      {loading ? (
        <p className="text-sm text-slate-400">불러오는 중…</p>
      ) : keywords.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          등록된 키워드가 없습니다. 위에서 첫 키워드를 추가해 보세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {keywords.map((kw) => (
            <li
              key={kw.id}
              className={`flex items-center justify-between rounded-xl border bg-white p-4 ${
                kw.active ? "border-slate-200" : "border-slate-200 opacity-60"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{kw.text}</span>
                  {!kw.active && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      일시정지
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400">
                  <span>{kw.sources.map((s) => (s === "web" ? "웹" : "유튜브")).join("·")}</span>
                  <span>{FREQ_LABEL[kw.frequency]}</span>
                  <span>{kw.lang === "ko" ? "한" : "영"}</span>
                  <span>마지막 스캔: {formatDate(kw.lastScanAt)}</span>
                  {typeof kw.lastNewCount === "number" && (
                    <span>신규 {kw.lastNewCount}건</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => toggleActive(kw)}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                >
                  {kw.active ? "정지" : "재개"}
                </button>
                <button
                  onClick={() => remove(kw)}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
