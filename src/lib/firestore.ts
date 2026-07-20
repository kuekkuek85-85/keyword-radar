import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Keyword, SavedItem, SourceKind } from "../../lib/types";

// 웹앱에서 사용하는 Firestore 접근 헬퍼.

// ── keywords ─────────────────────────────────────────────────
export async function listKeywords(): Promise<Keyword[]> {
  const snap = await getDocs(query(collection(db, "keywords"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ ...(d.data() as Keyword), id: d.id }));
}

export interface KeywordInput {
  text: string;
  sources: SourceKind[];
  frequency: Keyword["frequency"];
  lang: Keyword["lang"];
}

export async function createKeyword(input: KeywordInput): Promise<void> {
  const ref = doc(collection(db, "keywords"));
  const kw: Keyword = {
    id: ref.id,
    text: input.text.trim(),
    sources: input.sources,
    frequency: input.frequency,
    lang: input.lang,
    active: true,
    createdAt: Date.now(),
    lastScanAt: null,
  };
  await setDoc(ref, kw);
}

export async function updateKeyword(id: string, patch: Partial<Keyword>): Promise<void> {
  await updateDoc(doc(db, "keywords", id), patch);
}

export async function deleteKeyword(id: string): Promise<void> {
  await deleteDoc(doc(db, "keywords", id));
}

// ── saved_items ──────────────────────────────────────────────
export async function listSavedItems(): Promise<SavedItem[]> {
  const snap = await getDocs(query(collection(db, "saved_items"), orderBy("savedAt", "desc")));
  return snap.docs.map((d) => ({ ...(d.data() as SavedItem), id: d.id }));
}

export async function updateSavedItem(id: string, patch: Partial<SavedItem>): Promise<void> {
  await updateDoc(doc(db, "saved_items", id), patch);
}

export async function deleteSavedItem(id: string): Promise<void> {
  await deleteDoc(doc(db, "saved_items", id));
}

// 특정 키워드로 필터된 저장 자료 (미사용 시 참고용)
export async function savedItemsByKeyword(keywordId: string): Promise<SavedItem[]> {
  const snap = await getDocs(
    query(collection(db, "saved_items"), where("keywordId", "==", keywordId)),
  );
  return snap.docs.map((d) => ({ ...(d.data() as SavedItem), id: d.id }));
}
