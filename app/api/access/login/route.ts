import { createHash, timingSafeEqual } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  accessCookieMaxAge,
  accessCookieName,
  clearFailedAccessAttempts,
  createAccessToken,
  getAccessAttemptStatus,
  getAccessSecretProblem,
  recordFailedAccessAttempt,
  isAccessEnabled,
  shouldRequireAccess
} from "../../../../lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const oneTimeAccessPath = join(process.cwd(), ".access-otp.json");

export async function POST(request: NextRequest) {
  const wantsJson = request.headers
    .get("content-type")
    ?.toLowerCase()
    .includes("application/json") ?? false;
  const submitted = await readSubmittedAccess(request, wantsJson);
  const returnTo = normalizeReturnTo(submitted.returnTo);

  if (!shouldRequireAccess(request)) {
    return wantsJson ? NextResponse.json({ ok: true }) : redirectTo(returnTo);
  }

  const configurationProblem = getAccessSecretProblem();

  if (!isAccessEnabled() || configurationProblem) {
    return accessFailure(
      request,
      wantsJson,
      configurationProblem || "Online access is not configured.",
      503,
      undefined,
      returnTo
    );
  }

  const clientId = getClientIdentifier(request);
  const attemptStatus = getAccessAttemptStatus(clientId);

  if (!attemptStatus.allowed) {
    return accessFailure(
      request,
      wantsJson,
      `Too many failed attempts. Try again in ${attemptStatus.retryAfterSeconds} seconds.`,
      429,
      { "Retry-After": String(attemptStatus.retryAfterSeconds) }
    );
  }

  const code = submitted.code;
  const validOneTimeCode = await consumeValidOneTimeCode(code);

  if (!validOneTimeCode) {
    const failedAttempt = recordFailedAccessAttempt(clientId);

    return accessFailure(
      request,
      wantsJson,
      "Wrong or expired access code.",
      401,
      failedAttempt.locked
        ? { "Retry-After": String(failedAttempt.retryAfterSeconds) }
        : undefined,
      returnTo
    );
  }

  clearFailedAccessAttempts(clientId);

  const response = wantsJson
    ? NextResponse.json({ ok: true })
    : redirectTo(returnTo);
  response.cookies.set(accessCookieName, await createAccessToken(), {
    httpOnly: true,
    maxAge: accessCookieMaxAge,
    path: "/",
    sameSite: "strict",
    secure: isSecureRequest(request)
  });

  return response;
}

async function readSubmittedAccess(request: NextRequest, wantsJson: boolean) {
  if (wantsJson) {
    const body = (await request.json().catch(() => null)) as {
      code?: unknown;
      returnTo?: unknown;
    } | null;

    return {
      code: typeof body?.code === "string" ? body.code : "",
      returnTo: typeof body?.returnTo === "string" ? body.returnTo : "/"
    };
  }

  const formData = await request.formData();
  const code = formData.get("code");
  const returnTo = formData.get("returnTo");

  return {
    code: typeof code === "string" ? code : "",
    returnTo: typeof returnTo === "string" ? returnTo : "/"
  };
}

function accessFailure(
  request: NextRequest,
  wantsJson: boolean,
  message: string,
  status: number,
  headers?: HeadersInit,
  returnTo = "/"
) {
  if (wantsJson) {
    return NextResponse.json({ error: message }, { status, headers });
  }

  const redirectUrl = new URL("/access", request.url);
  redirectUrl.searchParams.set("returnTo", normalizeReturnTo(returnTo));
  redirectUrl.searchParams.set("error", message);
  const response = redirectTo(
    `/access?returnTo=${encodeURIComponent(
      normalizeReturnTo(returnTo)
    )}&error=${encodeURIComponent(message)}`
  );

  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, String(value));
    });
  }

  return response;
}

function normalizeReturnTo(value: string) {
  return value.startsWith("/") ? value : "/";
}

function redirectTo(location: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: normalizeReturnTo(location) }
  });
}

async function consumeValidOneTimeCode(code: string) {
  if (!code.trim()) return false;

  const record = await readOneTimeAccessRecord();

  if (!record) return false;

  if (record.expiresAt <= Date.now()) {
    await rm(oneTimeAccessPath, { force: true });
    return false;
  }

  const submittedHash = hashOneTimeCode(code);

  if (!safeHashEqual(submittedHash, record.hash)) {
    return false;
  }

  await rm(oneTimeAccessPath, { force: true });
  return true;
}

async function readOneTimeAccessRecord() {
  try {
    const raw = await readFile(oneTimeAccessPath, "utf8");
    const record = JSON.parse(raw.replace(/^\uFEFF/, "")) as {
      hash?: unknown;
      expiresAt?: unknown;
    };

    if (
      typeof record.hash !== "string" ||
      typeof record.expiresAt !== "number"
    ) {
      return null;
    }

    return {
      hash: record.hash,
      expiresAt: record.expiresAt
    };
  } catch {
    return null;
  }
}

function hashOneTimeCode(code: string) {
  return createHash("sha256")
    .update(`storymaker5000-access-otp-v1:${code.trim()}`)
    .digest("hex");
}

function safeHashEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function getClientIdentifier(request: NextRequest) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown-client"
  );
}

function isSecureRequest(request: NextRequest) {
  return (
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https"
  );
}
