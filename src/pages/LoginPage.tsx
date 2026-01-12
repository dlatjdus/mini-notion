import { useEffect, useRef } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const btnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    const init = () => {
      if (!window.google || !btnRef.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: any) => {
          console.log('구글 콜백 fired', resp);
          const idToken = resp.credential as string;

          console.log('idToken 길이', idToken?.length);
          console.log('idToken: ', idToken);
          const r = await apiFetch("/auth/google", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ idToken }),
          });

          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            alert("로그인 실패: " + (err.message ?? "unknown"));
            return;
          }

          const data = await r.json();
          setSession(data.accessToken, data.user);
          navigate("/my");
        },
      });

      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
      });
    };

    const t = setInterval(() => {
      if (window.google) {
        clearInterval(t);
        init();
      }
    }, 50);

    return () => clearInterval(t);
  }, [setSession]);

  return (
    <div style={{ padding: 24 }}>
      <h1>로그인</h1>
      <div ref={btnRef} />
    </div>
  );
}
