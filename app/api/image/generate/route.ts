import { NextRequest, NextResponse } from "next/server";

type ImageRequest = {
  prompt: string;
};

export async function POST(request: NextRequest) {
  const { prompt } = (await request.json()) as ImageRequest;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const model =
    process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";

  if (!accountId || !token) {
    return NextResponse.json({
      imageUrl: createPlaceholder(prompt),
      mock: true
    });
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    }
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "The image model could not generate art right now." },
      { status: response.status }
    );
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("image/")) {
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return NextResponse.json({
      imageUrl: `data:${contentType};base64,${base64}`
    });
  }

  const data = await response.json();
  const image =
    data?.result?.image ||
    data?.result?.images?.[0] ||
    data?.image ||
    data?.images?.[0];

  if (typeof image === "string") {
    const imageUrl = image.startsWith("data:")
      ? image
      : `data:image/png;base64,${image}`;
    return NextResponse.json({ imageUrl });
  }

  return NextResponse.json(
    { error: "The image model returned an unsupported response." },
    { status: 502 }
  );
}

function createPlaceholder(prompt: string) {
  const safePrompt = escapeXml(prompt || "Scene image prompt");
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <rect width="1200" height="760" fill="#dfe8ef"/>
  <rect x="72" y="72" width="1056" height="616" rx="24" fill="#ffffff" opacity="0.82"/>
  <path d="M0 604 C180 510 292 624 456 536 C640 438 776 548 936 468 C1072 400 1150 440 1200 398 L1200 760 L0 760 Z" fill="#0f766e" opacity="0.22"/>
  <circle cx="924" cy="214" r="86" fill="#f5b84b" opacity="0.75"/>
  <text x="96" y="128" fill="#172033" font-family="Arial, sans-serif" font-size="42" font-weight="700">Scene image placeholder</text>
  <foreignObject x="96" y="174" width="1008" height="280">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: #304057; font-size: 28px; line-height: 1.35;">
      ${safePrompt}
    </div>
  </foreignObject>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
