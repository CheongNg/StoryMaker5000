import { NextRequest, NextResponse } from "next/server";
import {
  accessCookieName,
  getAccessSecretProblem,
  isAccessEnabled,
  isValidAccessToken
} from "../../../lib/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (await isAccessRequired(request)) {
    return accessDenied();
  }

  const storyProvider = normalizeProvider(process.env.STORY_PROVIDER, [
    "mock",
    "openai"
  ]);
  const imageProvider = normalizeProvider(process.env.IMAGE_PROVIDER, [
    "mock",
    "openai",
    "grok",
    "xai"
  ]);
  const accessProblem = getAccessSecretProblem();

  return NextResponse.json({
    ok: true,
    checks: [
      {
        id: "access",
        label: "Online access",
        status: !isAccessEnabled() || accessProblem ? "warning" : "ok",
        detail:
          !isAccessEnabled() || accessProblem
            ? "Use run-online.ps1 to generate a one-time online access code."
            : "One-time online access is configured."
      },
      {
        id: "story",
        label: "Story gateway",
        status: storyProvider.status,
        detail: storyProvider.detail
      },
      {
        id: "image",
        label: "Image gateway",
        status: imageProvider.status,
        detail: imageProvider.detail
      },
      {
        id: "runtime",
        label: "App runtime",
        status: "ok",
        detail: "Next.js API routes are responding."
      }
    ]
  });
}

async function isAccessRequired(request: NextRequest) {
  return (
    isAccessEnabled() &&
    !(await isValidAccessToken(request.cookies.get(accessCookieName)?.value))
  );
}

function accessDenied() {
  return NextResponse.json(
    { error: "Access code is required." },
    { status: 401 }
  );
}

function normalizeProvider(value: string | undefined, allowed: string[]) {
  const provider = value?.trim().toLowerCase() || "mock";

  if (!allowed.includes(provider)) {
    return {
      status: "warning",
      detail: `Unknown provider "${provider}". Using mock fallback until configuration is fixed.`
    };
  }

  if (provider === "mock") {
    return {
      status: "mock",
      detail: "Mock mode is active. The workflow works, but no external AI model is connected."
    };
  }

  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    return {
      status: "warning",
      detail: "OpenAI is selected, but OPENAI_API_KEY is missing."
    };
  }

  if ((provider === "grok" || provider === "xai") && !process.env.XAI_API_KEY) {
    return {
      status: "warning",
      detail: "Grok is selected, but XAI_API_KEY is missing."
    };
  }

  if (provider === "xai") {
    return {
      status: "ok",
      detail: "grok is configured."
    };
  }

  return {
    status: "ok",
    detail: `${provider} is configured.`
  };
}
