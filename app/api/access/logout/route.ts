import { NextResponse } from "next/server";
import { accessCookieName } from "../../../../lib/access";

export const dynamic = "force-dynamic";

export function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(accessCookieName, "", {
    maxAge: 0,
    path: "/"
  });

  return response;
}
