// 백엔드 주소
export const API_BASE = import.meta.env.VITE_API_BASE; 

let handling401 = false;

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

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include", // 쿠키포함(refreshToken: httpOnly 쿠키)
    headers,
  });

  // 세션 만료(401) 전역에서 한 번만 처이
  if (res.status === 401) {
    if (!handling401) {
      handling401 = true;

      localStorage.removeItem("accessToekn");
      alert("세션이 만료되었습니다. 다시 로그인해 주세요.");
      window.location.replace("/login");

      setTimeout(() => {
        handling401 = false;
      }, 1000);
    }

    // 에러 던져서 함수 종료
    throw new Error("Unauthorized");
  }

  return res;
}
