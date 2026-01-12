import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../context/AuthContext";

export default function MyPage() {
  const { accessToken, clearSession, user, setSession } = useAuth();
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!accessToken) return;

      const r = await apiFetch("/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (r.status === 401) {
        const rr = await apiFetch("/auth/refresh", { method: "POST" });
        if (!rr.ok) return;

        const d = await rr.json();
        setSession(
          d.accessToken,
          user ?? { id: -1, email: null, name: null, pictureUrl: null }
        );
        return;
      }

      const data = await r.json();
      setMe(data.user);
    })();
  }, [accessToken, setSession, user]);

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    clearSession();
    window.location.href = "/";
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>/my</h1>
      <pre>{JSON.stringify(me, null, 2)}</pre>
      <button onClick={logout}>로그아웃</button>
    </div>
  );
}
