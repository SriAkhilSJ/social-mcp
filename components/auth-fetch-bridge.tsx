"use client";

import { useEffect } from "react";

const TOKEN_KEY = "socialix_session_token";

export function AuthFetchBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as Window & { __socialixFetchPatched?: boolean };
    if (win.__socialixFetchPatched) return;
    win.__socialixFetchPatched = true;

    const origFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

      const isInternalApi =
        urlStr.startsWith("/api/") ||
        urlStr.startsWith(`${window.location.origin}/api/`);

      let nextInit = init;
      if (isInternalApi) {
        try {
          const savedToken = window.localStorage.getItem(TOKEN_KEY);
          if (savedToken) {
            const hdrs = new Headers(init?.headers || {});
            if (!hdrs.has("x-socialix-token")) {
              hdrs.set("x-socialix-token", savedToken);
            }
            nextInit = { ...init, headers: hdrs };
          }
        } catch {
          // localStorage unavailable
        }
      }

      const res = await origFetch(input, nextInit);

      if (
        isInternalApi &&
        (urlStr.includes("/api/auth") || urlStr.includes("/api/campaigns"))
      ) {
        try {
          const cloned = res.clone();
          const data = await cloned.json();
          if (data?.signedOut) {
            window.localStorage.removeItem(TOKEN_KEY);
          } else if (typeof data?.token === "string" && data.token) {
            window.localStorage.setItem(TOKEN_KEY, data.token);
          }
        } catch {
          // Ignore non-JSON responses
        }
      }

      return res;
    };
  }, []);

  return null;
}
