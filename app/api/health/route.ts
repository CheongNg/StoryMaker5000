import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const storyProvider = normalizeProvider(process.env.STORY_PROVIDER, [
    "mock",
    "openai"
  ]);
  const imageProvider = normalizeProvider(process.env.IMAGE_PROVIDER, [
    "mock",
    "openai"
  ]);

  return NextResponse.json({
    ok: true,
    checks: [
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

  return {
    status: "ok",
    detail: `${provider} is configured.`
  };
}
