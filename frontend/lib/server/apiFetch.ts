import { headers } from "next/headers";

export async function apiGet<T>(path: string): Promise<T> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";

  if (!host) throw new Error("Missing host header");

  const res = await fetch(`${proto}://${host}${path}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      cookie: h.get("cookie") ?? "",
    },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

  return json as T;
}

