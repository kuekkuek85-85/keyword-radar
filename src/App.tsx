import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Login from "./pages/Login";
import Keywords from "./pages/Keywords";
import Archive from "./pages/Archive";
import Layout from "./components/Layout";

export default function App() {
  const { user, allowed, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        불러오는 중…
      </div>
    );
  }

  if (!user || !allowed) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Keywords />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
