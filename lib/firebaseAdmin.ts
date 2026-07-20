import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// 서버(API Routes / Cron)에서 사용하는 Firebase Admin SDK 초기화.
// 서버리스 환경에서 콜드스타트마다 중복 초기화되지 않도록 캐싱합니다.

let cachedDb: Firestore | null = null;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다.");
  }
  const parsed = JSON.parse(raw);
  // JSON 을 한 줄 문자열로 넣을 때 흔히 깨지는 private_key 개행 복원
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;

  let app: App;
  const existing = getApps();
  if (existing.length) {
    app = existing[0];
  } else {
    app = initializeApp({
      credential: cert(getServiceAccount()),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }

  cachedDb = getFirestore(app);
  return cachedDb;
}
