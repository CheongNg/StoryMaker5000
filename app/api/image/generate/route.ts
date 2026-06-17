import { NextRequest, NextResponse } from "next/server";
import { backendPictureInstructions } from "../../instructions";
import {
  accessCookieName,
  isValidAccessToken,
  shouldRequireAccess
} from "../../../../lib/access";

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

const maxImagePromptLength = 1200;
const maxReferenceImages = 3;
const maxGrokReferenceImages = 3;
const maxReferenceImageLength = 1_600_000;
const defaultImageSize = "1024x1024";
const defaultImageQuality = "low";
const defaultImageFormat = "jpeg";
const defaultImageCompression = 80;
const defaultReferenceFallback = true;
const defaultGrokImageModel = "grok-imagine-image-quality";
const defaultGrokAspectRatio = "16:9";
const defaultGrokResolution = "1k";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (await isAccessRequired(request)) {
    return accessDenied();
  }

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
    const startedAt = Date.now();
    const imageUrl =
      provider === "grok"
        ? await generateWithGrok(imageRequest.value, checks)
        : await generateWithOpenAI(imageRequest.value, checks);

    checks.push({
      id: "response-shape",
      status: "ok",
      detail: "The image provider returned an image payload the app can display."
    });
    checks.push({
      id: "latency",
      status: "ok",
      detail: `Image generation completed in ${formatDuration(Date.now() - startedAt)}.`
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
      detail: getErrorDetail(caught, "The image provider failed for an unknown reason.")
    });
    return fail(502, "The image gateway could not generate art.", checks);
  }
}

async function isAccessRequired(request: NextRequest) {
  return (
    shouldRequireAccess(request) &&
    !(await isValidAccessToken(request.cookies.get(accessCookieName)?.value))
  );
}

function accessDenied() {
  return NextResponse.json(
    { error: "Access code is required." },
    { status: 401 }
  );
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

  let prompt = body.prompt.trim();

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
      status: "warning",
      detail: `Image prompt was compacted to ${maxImagePromptLength} characters for provider efficiency.`
    });
    prompt = compactText(prompt, maxImagePromptLength);
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
      prompt: withBackendPictureLayer(prompt),
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

  if (provider === "grok" || provider === "xai") {
    if (!process.env.XAI_API_KEY) {
      checks.push({
        id: "configuration",
        status: "warning",
        detail: "IMAGE_PROVIDER=grok, but XAI_API_KEY is missing."
      });
      return "mock";
    }

    checks.push({
      id: "configuration",
      status: "ok",
      detail: `Grok Imagine image provider is configured with ${getGrokImageModel()} at ${getGrokResolution()} ${getGrokAspectRatio()}.`
    });
    return "grok";
  }

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
      detail: `OpenAI image provider is configured with ${process.env.OPENAI_IMAGE_MODEL || "gpt-image-2"} using ${getImageQuality()} quality and ${getImageFormat().toUpperCase()} output.`
    });
    return "openai";
  }

  if (provider !== "mock") {
    checks.push({
      id: "configuration",
      status: "warning",
      detail: `Unknown IMAGE_PROVIDER "${provider}". Use "grok", "openai", or "mock". Falling back to mock mode.`
    });
  }

  return "mock";
}

async function generateWithOpenAI(
  imageRequest: ValidImageRequest,
  checks: GatewayCheck[]
) {
  if (imageRequest.referenceImages.length > 0) {
    try {
      return await generateWithOpenAIReferences(imageRequest, checks);
    } catch (caught) {
      if (!shouldFallbackWithoutReferences("openai")) {
        throw caught;
      }

      checks.push({
        id: "reference-fallback",
        status: "warning",
        detail:
          caught instanceof Error
            ? `Reference image generation failed, so the gateway retried without character pictures. Provider detail: ${caught.message}`
            : "Reference image generation failed, so the gateway retried without character pictures."
      });

      return generateWithOpenAIBase(imageRequest.prompt, checks);
    }
  }

  return generateWithOpenAIBase(imageRequest.prompt, checks);
}

async function generateWithGrok(
  imageRequest: ValidImageRequest,
  checks: GatewayCheck[]
) {
  if (imageRequest.referenceImages.length > 0) {
    try {
      return await generateWithGrokReferences(imageRequest, checks);
    } catch (caught) {
      if (!shouldFallbackWithoutReferences("grok")) {
        throw caught;
      }

      checks.push({
        id: "reference-fallback",
        status: "warning",
        detail:
          caught instanceof Error
            ? `Grok reference image generation failed, so the gateway retried without character pictures. Provider detail: ${caught.message}`
            : "Grok reference image generation failed, so the gateway retried without character pictures."
      });

      return generateWithGrokBase(imageRequest.prompt, checks);
    }
  }

  return generateWithGrokBase(imageRequest.prompt, checks);
}

async function generateWithGrokBase(prompt: string, checks: GatewayCheck[]) {
  const response = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: getGrokImageModel(),
      prompt,
      n: 1,
      aspect_ratio: getGrokAspectRatio(),
      resolution: getGrokResolution(),
      response_format: "b64_json"
    })
  });

  checks.push({
    id: "provider-status",
    status: response.ok ? "ok" : "error",
    detail: `Grok Images returned HTTP ${response.status}.`
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(readProviderError(data, "Grok rejected the image request."));
  }

  return readImageResult(data, "Grok returned an unsupported image response.");
}

async function generateWithGrokReferences(
  imageRequest: ValidImageRequest,
  checks: GatewayCheck[]
) {
  const references = imageRequest.referenceImages.slice(0, maxGrokReferenceImages);

  if (imageRequest.referenceImages.length > maxGrokReferenceImages) {
    checks.push({
      id: "reference-images",
      status: "warning",
      detail: `Grok image editing supports up to ${maxGrokReferenceImages} reference image(s), so only the first ${maxGrokReferenceImages} were sent.`
    });
  }

  const imageObjects = references.map((reference) => ({
    type: "image_url",
    url: reference.imageUrl
  }));
  const payload =
    imageObjects.length === 1
      ? {
          model: getGrokImageModel(),
          prompt: imageRequest.prompt,
          image: imageObjects[0],
          aspect_ratio: getGrokAspectRatio(),
          resolution: getGrokResolution(),
          response_format: "b64_json"
        }
      : {
          model: getGrokImageModel(),
          prompt: imageRequest.prompt,
          images: imageObjects,
          aspect_ratio: getGrokAspectRatio(),
          resolution: getGrokResolution(),
          response_format: "b64_json"
        };

  const response = await fetch("https://api.x.ai/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  checks.push({
    id: "provider-status",
    status: response.ok ? "ok" : "error",
    detail: `Grok image references returned HTTP ${response.status}.`
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(readProviderError(data, "Grok rejected the reference image request."));
  }

  return readImageResult(data, "Grok returned an unsupported reference image response.");
}

async function generateWithOpenAIBase(prompt: string, checks: GatewayCheck[]) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt,
      size: defaultImageSize,
      quality: getImageQuality(),
      output_format: getImageFormat(),
      output_compression: getImageCompression()
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
    return toDataImageUrl(base64);
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
  form.append("size", defaultImageSize);
  form.append("quality", getImageQuality());
  form.append("output_format", getImageFormat());
  form.append("output_compression", String(getImageCompression()));

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
    return toDataImageUrl(base64);
  }

  if (typeof url === "string") {
    return url;
  }

  throw new Error("OpenAI returned an unsupported reference image response.");
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

function withBackendPictureLayer(prompt: string) {
  return compactText(
    `${prompt}\n\nPicture guardrails:\n${backendPictureInstructions}`,
    maxImagePromptLength
  );
}

function compactText(value: string, maxLength: number) {
  const clean = value.replace(/\s+/g, " ").trim();

  if (clean.length <= maxLength) return clean;

  return `${clean.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
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

function readImageResult(data: unknown, fallback: string) {
  if (!isObject(data)) {
    throw new Error(fallback);
  }

  const first = Array.isArray(data.data) ? data.data[0] : undefined;

  if (!isObject(first)) {
    throw new Error(fallback);
  }

  if (typeof first.b64_json === "string") {
    return toDataImageUrl(first.b64_json);
  }

  if (typeof first.url === "string") {
    return first.url;
  }

  throw new Error(fallback);
}

function getGrokImageModel() {
  return process.env.XAI_IMAGE_MODEL || defaultGrokImageModel;
}

function getGrokAspectRatio() {
  const value = (process.env.XAI_IMAGE_ASPECT_RATIO || defaultGrokAspectRatio).trim();
  const allowed = [
    "1:1",
    "16:9",
    "9:16",
    "4:3",
    "3:4",
    "3:2",
    "2:3",
    "2:1",
    "1:2",
    "19.5:9",
    "9:19.5",
    "20:9",
    "9:20",
    "auto"
  ];

  return allowed.includes(value) ? value : defaultGrokAspectRatio;
}

function getGrokResolution() {
  const value = (process.env.XAI_IMAGE_RESOLUTION || defaultGrokResolution).toLowerCase();
  return ["1k", "2k"].includes(value) ? value : defaultGrokResolution;
}

function getImageQuality() {
  const value = (process.env.OPENAI_IMAGE_QUALITY || defaultImageQuality).toLowerCase();
  return ["low", "medium", "high", "auto"].includes(value) ? value : defaultImageQuality;
}

function getImageFormat() {
  const value = (process.env.OPENAI_IMAGE_FORMAT || defaultImageFormat).toLowerCase();
  return ["png", "jpeg", "webp"].includes(value) ? value : defaultImageFormat;
}

function getImageCompression() {
  const value = Number(process.env.OPENAI_IMAGE_COMPRESSION);

  if (!Number.isFinite(value)) return defaultImageCompression;

  return Math.min(100, Math.max(0, Math.round(value)));
}

function shouldFallbackWithoutReferences(provider: "openai" | "grok") {
  const value = (
    provider === "grok"
      ? process.env.XAI_IMAGE_REFERENCE_FALLBACK
      : process.env.OPENAI_IMAGE_REFERENCE_FALLBACK
  )?.toLowerCase();

  if (value === "false" || value === "0" || value === "off") return false;

  return defaultReferenceFallback;
}

function toDataImageUrl(base64: string) {
  return `data:image/${getImageFormat()};base64,${base64}`;
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(1, Math.round(milliseconds / 1000));

  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
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

function getErrorDetail(caught: unknown, fallback: string) {
  if (!(caught instanceof Error)) return fallback;

  const cause = caught.cause;

  if (cause instanceof Error && cause.message) {
    return `${caught.message}: ${cause.message}`;
  }

  return caught.message || fallback;
}
