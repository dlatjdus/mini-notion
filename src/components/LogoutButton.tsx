import { apiFetch } from "../api";
import { useAuth } from "../context/AuthContext";

export const LogoutButton= () => {
  const { clearSession } = useAuth();

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    clearSession();           // accessToken, user 날림
    window.location.href = "/login";
  };

  return <button onClick={logout}>로그아웃</button>;
}
