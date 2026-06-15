import { NextRequest, NextResponse } from "next/server";

type GatewayCheck = {
  id: string;
  status: "ok" | "warning" | "error";
  detail: string;
};

type ReferenceImage = {
  name: string;
  imageUrl: string;
};

type ValidImageRequest = {
  prompt: string;
  referenceImages: ReferenceImage[];
};

const maxImagePromptLength = 2500;
const maxReferenceImages = 6;
const maxReferenceImageLength = 1_600_000;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const checks: GatewayCheck[] = [];
  const parsed = await readJson(request, checks);

  if (!parsed.ok) {
    return fail(parsed.status, parsed.message, checks);
  }

  const imageRequest = validateImageRequest(parsed.body, checks);

  if (!imageRequest.ok) {
    return fail(400, imageRequest.message, checks);
  }

  const provider = getImageProvider(checks);

  if (provider === "mock") {
    checks.push({
      id: "provider",
      status: "warning",
      detail:
        imageRequest.value.referenceImages.length > 0
          ? "Mock image generation is active. Reference images were accepted but not rendered by a live model."
          : "Mock image generation is active. A placeholder image was created."
    });
    return NextResponse.json({
      imageUrl: createPlaceholder(
        imageRequest.value.prompt,
        imageRequest.value.referenceImages
      ),
      mock: true,
      gateway: {
        provider: "mock",
        mode: "mock",
        checks
      }
    });
  }

  try {
    const imageUrl =
      provider === "openai"
        ? await generateWithOpenAI(imageRequest.value, checks)
        : await generateWithCloudflare(imageRequest.value, checks);

    checks.push({
      id: "response-shape",
      status: "ok",
      detail: "The image provider returned an image payload the app can display."
    });

    return NextResponse.json({
      imageUrl,
      gateway: {
        provider,
        mode: "live",
        checks
      }
    });
  } catch (caught) {
    checks.push({
      id: "provider-response",
      status: "error",
      detail:
        caught instanceof Error
          ? caught.message
          : "The image provider failed for an unknown reason."
    });
    return fail(502, "The image gateway could not generate art.", checks);
  }
}

async function readJson(request: NextRequest, checks: GatewayCheck[]) {
  try {
    const body = (await request.json()) as unknown;
    checks.push({
      id: "json",
      status: "ok",
      detail: "Request body is valid JSON."
    });
    return { ok: true as const, body };
  } catch {
    checks.push({
      id: "json",
      status: "error",
      detail: "Request body was not valid JSON."
    });
    return {
      ok: false as const,
      status: 400,
      message: "The image request was not valid JSON."
    };
  }
}

function validateImageRequest(body: unknown, checks: GatewayCheck[]) {
  if (!isObject(body) || typeof body.prompt !== "string") {
    checks.push({
      id: "validation",
      status: "error",
      detail: "Image prompt is required."
    });
    return { ok: false as const, message: "Image prompt is required." };
  }

  const prompt = body.prompt.trim();

  if (!prompt) {
    checks.push({
      id: "validation",
      status: "error",
      detail: "Image prompt cannot be empty."
    });
    return { ok: false as const, message: "Image prompt cannot be empty." };
  }

  if (prompt.length > maxImagePromptLength) {
    checks.push({
      id: "validation",
      status: "error",
      detail: `Image prompt must be ${maxImagePromptLength} characters or less.`
    });
    return {
      ok: false as const,
      message: `Image prompt must be ${maxImagePromptLength} characters or less.`
    };
  }

  const referenceImages = validateReferenceImages(body.referenceImages, checks);

  if (!referenceImages.ok) {
    return referenceImages;
  }

  checks.push({
    id: "validation",
    status: "ok",
    detail: `Accepted image prompt with ${prompt.length} characters and ${referenceImages.value.length} reference image(s).`
  });

  return {
    ok: true as const,
    value: {
      prompt,
      referenceImages: referenceImages.value
    }
  };
}

function validateReferenceImages(value: unknown, checks: GatewayCheck[]) {
  if (value === undefined) {
    return { ok: true as const, value: [] };
  }

  if (!Array.isArray(value)) {
    checks.push({
      id: "reference-images",
      status: "error",
      detail: "Reference images must be an array."
    });
    return {
      ok: false as const,
      message: "Reference images must be an array."
    };
  }

  if (value.length > maxReferenceImages) {
    checks.push({
      id: "reference-images",
      status: "error",
      detail: `Use ${maxReferenceImages} reference images or fewer.`
    });
    return {
      ok: false as const,
      message: `Use ${maxReferenceImages} reference images or fewer.`
    };
  }

  const cleanImages: ReferenceImage[] = [];

  for (const item of value) {
    if (!isObject(item)) continue;

    const imageUrl = typeof item.imageUrl === "string" ? item.imageUrl.trim() : "";
    const name =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : "Character reference";

    if (!imageUrl) continue;

    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(imageUrl)) {
      checks.push({
        id: "reference-images",
        status: "error",
        detail: "Reference images must be JPG, PNG, or WEBP data URLs."
      });
      return {
        ok: false as const,
        message: "Reference images must be JPG, PNG, or WEBP data URLs."
      };
    }

    if (imageUrl.length > maxReferenceImageLength) {
      checks.push({
        id: "reference-images",
        status: "error",
        detail: "A reference image is too large after browser resizing."
      });
      return {
        ok: false as const,
        message: "A reference image is too large after browser resizing."
      };
    }

    cleanImages.push({ name, imageUrl });
  }

  if (cleanImages.length > 0) {
    checks.push({
      id: "reference-images",
      status: "ok",
      detail: `${cleanImages.length} character reference image(s) will be sent to providers that support image inputs.`
    });
  }

  return { ok: true as const, value: cleanImages };
}

function getImageProvider(checks: GatewayCheck[]) {
  const provider = (process.env.IMAGE_PROVIDER || "mock").toLowerCase();

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      checks.push({
        id: "configuration",
        status: "warning",
        detail: "IMAGE_PROVIDER=openai, but OPENAI_API_KEY is missing."
      });
      return "mock";
    }

    checks.push({
      id: "configuration",
      status: "ok",
      detail: `OpenAI image provider is configured with ${process.env.OPENAI_IMAGE_MODEL || "gpt-image-2"}.`
    });
    return "openai";
  }

  if (provider === "cloudflare") {
    if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
      checks.push({
        id: "configuration",
        status: "warning",
        detail:
          "IMAGE_PROVIDER=cloudflare, but CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is missing."
      });
      return "mock";
    }

    checks.push({
      id: "configuration",
      status: "ok",
      detail: `Cloudflare image provider is configured with ${process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell"}.`
    });
    return "cloudflare";
  }

  if (provider !== "mock") {
    checks.push({
      id: "configuration",
      status: "warning",
      detail: `Unknown IMAGE_PROVIDER "${provider}". Falling back to mock mode.`
    });
  }

  return "mock";
}

async function generateWithOpenAI(
  imageRequest: ValidImageRequest,
  checks: GatewayCheck[]
) {
  if (imageRequest.referenceImages.length > 0) {
    return generateWithOpenAIReferences(imageRequest, checks);
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt: imageRequest.prompt,
      size: "1024x1024"
    })
  });

  checks.push({
    id: "provider-status",
    status: response.ok ? "ok" : "error",
    detail: `OpenAI Images returned HTTP ${response.status}.`
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(readProviderError(data, "OpenAI rejected the image request."));
  }

  const base64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;

  if (typeof base64 === "string") {
    return `data:image/png;base64,${base64}`;
  }

  if (typeof url === "string") {
    return url;
  }

  throw new Error("OpenAI returned an unsupported image response.");
}

async function generateWithOpenAIReferences(
  imageRequest: ValidImageRequest,
  checks: GatewayCheck[]
) {
  const form = new FormData();

  form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2");
  form.append("prompt", imageRequest.prompt);
  form.append("size", "1024x1024");

  imageRequest.referenceImages.forEach((reference, index) => {
    const file = dataUrlToFile(
      reference.imageUrl,
      `${safeFileName(reference.name || `reference-${index + 1}`)}.jpg`
    );
    form.append("image[]", file);
  });

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: form
  });

  checks.push({
    id: "provider-status",
    status: response.ok ? "ok" : "error",
    detail: `OpenAI image references returned HTTP ${response.status}.`
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      readProviderError(data, "OpenAI rejected the reference image request.")
    );
  }

  const base64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;

  if (typeof base64 === "string") {
    return `data:image/png;base64,${base64}`;
  }

  if (typeof url === "string") {
    return url;
  }

  throw new Error("OpenAI returned an unsupported reference image response.");
}

async function generateWithCloudflare(
  imageRequest: ValidImageRequest,
  checks: GatewayCheck[]
) {
  if (imageRequest.referenceImages.length > 0) {
    checks.push({
      id: "reference-images",
      status: "warning",
      detail:
        "Cloudflare image generation does not use the uploaded image bytes in this MVP; character references were folded into the prompt text."
    });
  }

  const model =
    process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt: imageRequest.prompt })
    }
  );

  checks.push({
    id: "provider-status",
    status: response.ok ? "ok" : "error",
    detail: `Cloudflare returned HTTP ${response.status}.`
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const errorBody = contentType.includes("application/json")
      ? await response.json()
      : undefined;
    throw new Error(
      readProviderError(errorBody, "Cloudflare rejected the image request.")
    );
  }

  if (contentType.includes("image/")) {
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  }

  const data = await response.json();
  const image =
    data?.result?.image ||
    data?.result?.images?.[0] ||
    data?.image ||
    data?.images?.[0];

  if (typeof image === "string") {
    return image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
  }

  throw new Error("Cloudflare returned an unsupported image response.");
}

function createPlaceholder(prompt: string, referenceImages: ReferenceImage[]) {
  const safePrompt = escapeXml(prompt || "Scene image prompt");
  const referenceText =
    referenceImages.length > 0
      ? `References accepted: ${referenceImages.map((image) => image.name).join(", ")}`
      : "No character reference image uploaded.";
  const safeReferenceText = escapeXml(referenceText);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <rect width="1200" height="760" fill="#eef2f7"/>
  <rect x="70" y="70" width="1060" height="620" rx="18" fill="#ffffff"/>
  <path d="M0 610 C160 515 312 636 472 540 C650 432 802 566 970 468 C1080 404 1150 438 1200 398 L1200 760 L0 760 Z" fill="#0f766e" opacity="0.2"/>
  <circle cx="930" cy="220" r="82" fill="#e3a83b" opacity="0.76"/>
  <text x="100" y="132" fill="#172033" font-family="Arial, sans-serif" font-size="42" font-weight="700">Scene image placeholder</text>
  <text x="100" y="178" fill="#536174" font-family="Arial, sans-serif" font-size="22">Image gateway is working in mock mode.</text>
  <text x="100" y="208" fill="#536174" font-family="Arial, sans-serif" font-size="22">${safeReferenceText}</text>
  <foreignObject x="100" y="225" width="1000" height="320">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: #304057; font-size: 28px; line-height: 1.35;">
      ${safePrompt}
    </div>
  </foreignObject>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function fail(status: number, error: string, checks: GatewayCheck[]) {
  return NextResponse.json({ error, gateway: { checks } }, { status });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readProviderError(data: unknown, fallback: string) {
  if (!isObject(data)) return fallback;

  const error = data.error;

  if (isObject(error) && typeof error.message === "string") {
    return error.message;
  }

  if (Array.isArray(data.errors) && data.errors[0]?.message) {
    return String(data.errors[0].message);
  }

  return fallback;
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const [meta, base64] = dataUrl.split(",");
  const mimeType = meta.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  const bytes = Buffer.from(base64 || "", "base64");
  return new File([bytes], filename, { type: mimeType });
}

function safeFileName(value: string) {
  const cleaned = value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return cleaned || "character-reference";
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
