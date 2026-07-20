# 📡 키워드 레이더 (Keyword Radar)

관심 키워드를 등록하면 웹·유튜브를 주기적으로 검색해 새 자료를 찾아 **텔레그램으로 알리고**, 저장한 자료만 **Firestore에 아카이빙**하는 개인용 정보 수집 시스템입니다. 웹앱은 키워드 관리와 저장 자료 열람·검색을 담당합니다.

> PRD `keyword radar prd.md` 기반 구현. Phase 1~3(코어 파이프라인 · 버튼 콜백 · 웹앱)을 포함합니다.

## 아키텍처

```
[Vercel Cron] ─▶ /api/scan ─▶ 웹 검색 API · YouTube API
                    │
                    ▼
              Firestore (scan_history 기록)
                    │
                    ▼
         텔레그램 sendMessage (💾 저장 / ❌ 취소 버튼)
                    │
        사용자 탭 ─▶ [텔레그램 웹훅] ─▶ /api/telegram
                          저장: saved_items 기록 + 메시지 수정
                          취소: deleteMessage
[웹앱 React+Vite] ◀──▶ Firestore (키워드 CRUD, 아카이브)
```

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프론트엔드 | React + Vite + Tailwind |
| 서버리스 | Vercel (API Routes + Cron) |
| DB·인증 | Firebase Firestore + Auth |
| 알림 | Telegram Bot API |
| 웹 검색 | Serper 또는 Tavily (환경변수로 전환) |
| 영상 검색 | YouTube Data API v3 |

## 디렉터리 구조

```
api/
  scan.ts        # Vercel Cron 이 호출하는 스캔·알림 엔드포인트
  telegram.ts    # 텔레그램 웹훅 (저장/취소 콜백 처리)
lib/
  types.ts       # 공용 도메인 타입
  dedupe.ts      # URL 정규화 + 해시(중복 제거)
  firebaseAdmin.ts
  telegram.ts    # Bot API 래퍼
  search/
    web.ts       # Serper/Tavily 어댑터
    youtube.ts   # YouTube Data API v3 어댑터
src/             # 웹앱 (로그인 / 키워드 / 아카이브)
scripts/
  set-webhook.mjs
firestore.rules
vercel.json      # 크론 스케줄
```

## 로컬 개발

```bash
npm install
cp .env.example .env   # 값 채우기
npm run dev            # 웹앱 http://localhost:5173
```

> 로컬에서 `/api/*` 를 함께 실행하려면 `vercel dev` 를 사용하세요.

## 셋업 절차

### 1. Firebase
1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성.
2. **Firestore** 활성화(프로덕션 모드), **Authentication → Google** 로그인 사용 설정.
3. 프로젝트 설정 → 웹 앱 추가 → SDK 구성값을 `.env` 의 `VITE_FIREBASE_*` 에 입력.
4. 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 → JSON을 한 줄로 만들어 `FIREBASE_SERVICE_ACCOUNT_KEY` 에 입력.
5. `firestore.rules` 의 이메일을 본인 것으로 바꾼 뒤 콘솔의 규칙 탭에 붙여넣기.
6. `.env` 의 `VITE_ALLOWED_EMAILS` 에 로그인 허용 이메일 입력.

### 2. 텔레그램 봇
1. [@BotFather](https://t.me/BotFather) 로 봇 생성 → `TELEGRAM_BOT_TOKEN`.
2. 봇과 대화를 시작한 뒤 `TELEGRAM_CHAT_ID`(본인 채팅 ID) 확인.
   - 확인법: `https://api.telegram.org/bot<TOKEN>/getUpdates` 호출 후 `chat.id`.
3. `TELEGRAM_WEBHOOK_SECRET` 에 임의의 긴 랜덤 문자열 지정.
4. 배포 후 웹훅 등록:
   ```bash
   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
     node scripts/set-webhook.mjs https://your-app.vercel.app
   ```

### 3. 검색 API
- **웹**: `SEARCH_PROVIDER=serper`(기본) 또는 `tavily`. 해당 키 입력.
- **유튜브**: Google Cloud Console 에서 YouTube Data API v3 활성화 후 `YOUTUBE_API_KEY`.

### 4. Vercel 배포
1. GitHub 저장소를 Vercel 에 연결.
2. `.env.example` 의 모든 변수를 Vercel **Environment Variables** 에 등록.
   - `CRON_SECRET` 은 Vercel Cron 인증에 사용됩니다(자동으로 Bearer 헤더 부착).
3. 배포. 크론 스케줄은 `vercel.json` 의 `crons` 참조.

## 크론 스케줄

`vercel.json` 에서 `0 22 * * *` (UTC) = **매일 07:00 KST**. 시간대는 UTC 기준이므로 원하는 한국 시각 −9시간으로 설정하세요. 아침·저녁 2회로 늘리려면 `crons` 배열에 항목을 추가합니다.

키워드별 `frequency`(매일/주2회/주1회)는 `/api/scan` 안에서 `lastScanAt` 과 대조해 반영됩니다. 즉 크론은 매일 돌더라도, 주기가 안 된 키워드는 건너뜁니다.

## 데이터 모델 (Firestore)

- **keywords**: `text`, `sources[]`, `frequency`, `lang`, `active`, `createdAt`, `lastScanAt`, `lastNewCount`
- **scan_history** (중복 방지): 문서 ID = URL 해시. `keywordId`, `url`, `title`, `source`, `notifiedAt`, `messageId`, `status`(notified/saved/dismissed/expired)
- **saved_items**: `keywordId`, `keywordText`, `url`, `title`, `snippet`, `source`, `thumbnail`, `tags[]`, `memo`, `savedAt`

## 동작 요약

1. 크론 → `/api/scan`: 활성·주기 도래 키워드마다 웹/유튜브 검색.
2. URL 정규화·해시로 `scan_history` 대조 → 신규 건만, 키워드당 최대 `MAX_NOTIFY_PER_KEYWORD` 건 알림.
3. 텔레그램 메시지에 `[💾 저장] [❌ 취소]` 버튼.
4. 저장 → `/api/telegram` 웹훅이 `saved_items` 기록 + 메시지 "✅ 저장됨" 으로 수정.
5. 취소 → 메시지 삭제(48h 초과 시 만료 표시).
6. 웹앱 아카이브에서 검색·필터·태그·메모로 자료 관리.

## PRD 대비 범위

- ✅ Phase 1 코어 파이프라인 (스캔·중복제거·알림)
- ✅ Phase 2 버튼 콜백 (저장/취소)
- ✅ Phase 3 웹앱 (로그인·키워드 CRUD·아카이브)
- ✅ 유튜브 소스 (Phase 4 항목 조기 포함)
- ⏳ v2 후보: AI 요약 스니펫, 블로그 자동 포스팅, 주간 다이제스트, 태그 자동 제안
