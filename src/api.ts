// 백엔드 주소
export const API_BASE = import.meta.env.VITE_API_BASE; 

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem("accessToken");

  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // 토큰이 있으면 Authorization 헤더 추가
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include", // 쿠키포함(refreshToken: httpOnly 쿠키)
    headers,
  });
}
