import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../context/AuthContext";

export default function ProtectedLayout() {
  const { accessToken, setSession, user } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (accessToken) {
        setReady(true);
        return;
      }

      // accessToken 없으면 refresh로 재발급 시도
      const r = await apiFetch("/auth/refresh", { method: "POST" });
      if (!r.ok) {
        setReady(true);
        return;
      }

      const data = await r.json();
      setSession(
        data.accessToken,
        user ?? { id: -1, email: null, name: null, pictureUrl: null }
      );
      setReady(true);
    })();
  }, [accessToken, setSession, user]);

  if (!ready) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!accessToken) return <Navigate to="/login" replace />;

  return <Outlet />;
}
