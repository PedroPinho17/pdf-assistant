export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * fetch() against the API with the session cookie attached.
 * A 401 on any non-auth route means the session expired: go to the login page.
 */
export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
  });
  if (
    res.status === 401 &&
    !path.startsWith("/auth/") &&
    typeof window !== "undefined" &&
    window.location.pathname !== "/login"
  ) {
    window.location.href = "/login";
  }
  return res;
}
