import React, { createContext, useContext, useMemo, useState, useEffect } from "react";

type User = {
  id: number;
  email: string | null;
  name: string | null;
  pictureUrl: string | null;
};

type AuthState = {
  accessToken: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const LS_TOKEN_KEY = "accessToken";
const LS_USER_KEY = "user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // 앱 시작 시 LocalStorage에서 세션 복구
  useEffect(() => {
    const token = localStorage.getItem(LS_TOKEN_KEY);
    const user = localStorage.getItem(LS_USER_KEY);

    if (token && user) {
      try {
        setAccessToken(token);
        setUser(JSON.parse(user) as User);
      }
      catch {
        localStorage.removeItem(LS_TOKEN_KEY);
        localStorage.removeItem(LS_USER_KEY);
      }
    }
  }, []);

  const value = useMemo(
    () => ({
      accessToken,
      user,

      // 로그인 성공: state + LocalStorage 저장
      setSession: (t: string, u: User) => {
        localStorage.setItem(LS_TOKEN_KEY, t);
        localStorage.setItem(LS_USER_KEY, JSON.stringify(u));
        setAccessToken(t);
        setUser(u);
      },
      // 로그아웃: state + LocalStorage 삭제
      clearSession: () => {
        localStorage.removeItem(LS_TOKEN_KEY);
        localStorage.removeItem(LS_USER_KEY);
        setAccessToken(null);
        setUser(null);
      },
    }),
    [accessToken, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
