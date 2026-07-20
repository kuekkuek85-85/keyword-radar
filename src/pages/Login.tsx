import { useAuth } from "../lib/auth";

export default function Login() {
  const { user, allowed, login, logout } = useAuth();

  // 로그인은 됐지만 화이트리스트에 없는 경우
  const blocked = user && !allowed;

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl">📡</div>
          <h1 className="mt-2 text-xl font-bold">키워드 레이더</h1>
          <p className="mt-1 text-sm text-slate-500">
            관심 키워드 자동 수집 · 아카이브
          </p>
        </div>

        {blocked ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-red-600">
              <b>{user?.email}</b> 계정은 접근이 허용되지 않았습니다.
            </p>
            <button
              onClick={() => logout()}
              className="w-full rounded-lg bg-slate-100 py-2.5 text-sm font-medium hover:bg-slate-200"
            >
              다른 계정으로 로그인
            </button>
          </div>
        ) : (
          <button
            onClick={() => login()}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Google 계정으로 로그인
          </button>
        )}
      </div>
    </div>
  );
}
