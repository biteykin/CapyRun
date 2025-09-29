// app/api/decode-access-token/route.ts
import { NextResponse } from "next/server";

function base64UrlDecode(str: string) {
  // base64url -> base64
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  // pad
  while (str.length % 4) str += "=";
  try {
    return Buffer.from(str, "base64").toString("utf8");
  } catch (e) {
    return null;
  }
}

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = cookieHeader.split(";").map(s => s.trim()).filter(Boolean);
  const obj: Record<string,string> = {};
  cookies.forEach(c => {
    const [k, ...rest] = c.split("=");
    obj[k] = rest.join("=");
  });

  const token = obj["sb-access-token"] ?? obj["capyrun.auth"] ?? null;
  if (!token) return NextResponse.json({ ok: false, msg: "no token in cookies", cookies: Object.keys(obj) });

  // token might be "jwt" or prefixed; try to find first JWT-looking substring
  const maybeJwt = token.includes(".") ? token : (token.split(" ").pop() ?? token);

  const parts = maybeJwt.split(".");
  if (parts.length < 2) return NextResponse.json({ ok: false, msg: "not a jwt", sample: maybeJwt.slice(0,40) });

  const header = base64UrlDecode(parts[0]);
  const payload = base64UrlDecode(parts[1]);

  let payloadJson = null;
  try { payloadJson = JSON.parse(payload); } catch (e) { payloadJson = payload; }

  return NextResponse.json({
    ok: true,
    header,
    payload: payloadJson,
    cookies: Object.keys(obj)
  });
}
