#!/usr/bin/env node
// 텔레그램 웹훅 등록 헬퍼.
//
// 사용법:
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
//     node scripts/set-webhook.mjs https://your-app.vercel.app
//
// 배포 URL 뒤에 /api/telegram 이 자동으로 붙습니다.

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = process.argv[2];

if (!token || !base) {
  console.error("TELEGRAM_BOT_TOKEN 환경변수와 배포 URL 인자가 필요합니다.");
  console.error("예: node scripts/set-webhook.mjs https://your-app.vercel.app");
  process.exit(1);
}

const webhookUrl = `${base.replace(/\/$/, "")}/api/telegram`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: secret || undefined,
    allowed_updates: ["callback_query"],
  }),
});

const json = await res.json();
console.log(JSON.stringify(json, null, 2));
if (!json.ok) process.exit(1);
console.log(`\n✅ 웹훅 등록 완료: ${webhookUrl}`);
