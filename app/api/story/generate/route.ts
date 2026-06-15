import { NextRequest, NextResponse } from "next/server";

type Character = {
  id?: string;
  name: string;
  role: string;
  personality: string;
  appearance: string;
  goals: string;
  secrets: string;
};

type Story = {
  title: string;
  genre: string;
  tone: string;
  worldRules: string;
  summary: string;
};

type Scene = {
  title: string;
  text: string;
  summary: string;
};

type StoryRequest = {
  story: Story;
  characters: Character[];
  recentScenes: Scene[];
  memories: string[];
  prompt: string;
};

type StoryResponse = {
  title: string;
  scene: string;
  summary: string;
  memoryNotes: string[];
  characterUpdates: string[];
  timelineUpdates: string[];
  imagePrompt: string;
  gateway: {
    provider: string;
    mode: "mock" | "live";
    checks: GatewayCheck[];
  };
};

type GatewayCheck = {
  id: string;
  status: "ok" | "warning" | "error";
  detail: string;
};

const maxPromptLength = 4000;
const maxCharacters = 8;
const maxMemoryItems = 60;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const checks: GatewayCheck[] = [];
  const parsed = await readJson(request, checks);

  if (!parsed.ok) {
    return fail(parsed.status, parsed.message, checks);
  }

  const validation = validateStoryRequest(parsed.body, checks);

  if (!validation.ok) {
    return fail(400, validation.message, checks);
  }

  const body = validation.body;
  const provider = getStoryProvider(checks);

  if (provider === "mock") {
    checks.push({
      id: "provider",
      status: "warning",
      detail: "Mock story generation is active because no live provider is configured."
    });
    return NextResponse.json(withGateway(createMockScene(body), "mock", "mock", checks));
  }

  try {
    const result =
      provider === "openai"
        ? await generateWithOpenAI(body, checks)
        : await generateWithGemini(body, checks);

    const responseValidation = validateStoryResponse(result, checks);

    if (!responseValidation.ok) {
      return fail(502, responseValidation.message, checks);
    }

    return NextResponse.json(
      withGateway(responseValidation.body, provider, "live", checks)
    );
  } catch (caught) {
    checks.push({
      id: "provider-response",
      status: "error",
      detail:
        caught instanceof Error
          ? caught.message
          : "The story provider failed for an unknown reason."
    });

    return fail(502, "The story gateway could not generate a scene.", checks);
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
      message: "The story request was not valid JSON."
    };
  }
}

function validateStoryRequest(body: unknown, checks: GatewayCheck[]) {
  if (!isObject(body)) {
    return invalid("The story request must be an object.", checks);
  }

  const story = body.story;
  const characters = body.characters;
  const recentScenes = body.recentScenes;
  const memories = body.memories;
  const prompt = body.prompt;

  if (!isObject(story)) {
    return invalid("Story setup is missing.", checks);
  }

  if (!isNonEmptyString(prompt)) {
    return invalid("Prompt is required before a scene can be generated.", checks);
  }

  if (prompt.length > maxPromptLength) {
    return invalid(`Prompt must be ${maxPromptLength} characters or less.`, checks);
  }

  if (!Array.isArray(characters) || characters.length === 0) {
    return invalid("Add at least one character before generating a scene.", checks);
  }

  if (characters.length > maxCharacters) {
    return invalid(`Use ${maxCharacters} characters or fewer for this MVP.`, checks);
  }

  const cleanStory: Story = {
    title: stringOrDefault(story.title, "Untitled story"),
    genre: stringOrDefault(story.genre, "Adult contemporary drama"),
    tone: stringOrDefault(story.tone, "Intimate and character driven"),
    worldRules: stringOrDefault(story.worldRules, "No scenario constraints defined."),
    summary: stringOrDefault(story.summary, "The scenario is just beginning.")
  };

  const cleanCharacters = characters.map((character, index) => ({
    id: isObject(character) ? stringOrDefault(character.id, `character-${index}`) : `character-${index}`,
    name: isObject(character)
      ? stringOrDefault(character.name, `Character ${index + 1}`)
      : `Character ${index + 1}`,
    role: isObject(character) ? stringOrDefault(character.role, "Cast member") : "Cast member",
    personality: isObject(character) ? stringOrDefault(character.personality, "") : "",
    appearance: isObject(character) ? stringOrDefault(character.appearance, "") : "",
    goals: isObject(character) ? stringOrDefault(character.goals, "") : "",
    secrets: isObject(character) ? stringOrDefault(character.secrets, "") : ""
  }));

  const cleanRecentScenes = Array.isArray(recentScenes)
    ? recentScenes.slice(0, 6).filter(isObject).map((scene) => ({
        title: stringOrDefault(scene.title, "Previous scene"),
        text: stringOrDefault(scene.text, ""),
        summary: stringOrDefault(scene.summary, "")
      }))
    : [];

  const cleanMemories = Array.isArray(memories)
    ? memories
        .filter((memory): memory is string => typeof memory === "string")
        .map((memory) => memory.trim())
        .filter(Boolean)
        .slice(-maxMemoryItems)
    : [];

  checks.push({
    id: "validation",
    status: "ok",
    detail: `Accepted ${cleanCharacters.length} character(s), ${cleanRecentScenes.length} recent scene(s), and ${cleanMemories.length} memory note(s).`
  });

  return {
    ok: true as const,
    body: {
      story: cleanStory,
      characters: cleanCharacters,
      recentScenes: cleanRecentScenes,
      memories: cleanMemories,
      prompt: prompt.trim()
    }
  };
}

function getStoryProvider(checks: GatewayCheck[]) {
  const provider = (process.env.STORY_PROVIDER || "mock").toLowerCase();

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      checks.push({
        id: "configuration",
        status: "warning",
        detail: "STORY_PROVIDER=openai, but OPENAI_API_KEY is missing."
      });
      return "mock";
    }

    checks.push({
      id: "configuration",
      status: "ok",
      detail: `OpenAI story provider is configured with ${process.env.OPENAI_MODEL || "gpt-5-mini"}.`
    });
    return "openai";
  }

  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) {
      checks.push({
        id: "configuration",
        status: "warning",
        detail: "STORY_PROVIDER=gemini, but GEMINI_API_KEY is missing."
      });
      return "mock";
    }

    checks.push({
      id: "configuration",
      status: "ok",
      detail: `Gemini story provider is configured with ${process.env.GEMINI_MODEL || "gemini-2.5-flash"}.`
    });
    return "gemini";
  }

  if (provider !== "mock") {
    checks.push({
      id: "configuration",
      status: "warning",
      detail: `Unknown STORY_PROVIDER "${provider}". Falling back to mock mode.`
    });
  }

  return "mock";
}

async function generateWithOpenAI(body: StoryRequest, checks: GatewayCheck[]) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: buildInstruction(body),
      text: {
        format: {
          type: "json_object"
        }
      }
    })
  });

  checks.push({
    id: "provider-status",
    status: response.ok ? "ok" : "error",
    detail: `OpenAI returned HTTP ${response.status}.`
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(readProviderError(data, "OpenAI rejected the story request."));
  }

  const raw =
    data?.output_text ||
    data?.output
      ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
      ?.map((content: { text?: string }) => content.text)
      ?.filter(Boolean)
      ?.join("\n");

  if (!raw) {
    throw new Error("OpenAI returned an empty story response.");
  }

  return parseProviderJson(raw, "OpenAI");
}

async function generateWithGemini(body: StoryRequest, checks: GatewayCheck[]) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildInstruction(body) }]
          }
        ],
        generationConfig: {
          temperature: 0.85,
          responseMimeType: "application/json"
        }
      })
    }
  );

  checks.push({
    id: "provider-status",
    status: response.ok ? "ok" : "error",
    detail: `Gemini returned HTTP ${response.status}.`
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(readProviderError(data, "Gemini rejected the story request."));
  }

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!raw) {
    throw new Error("Gemini returned an empty story response.");
  }

  return parseProviderJson(raw, "Gemini");
}

function buildInstruction(body: StoryRequest) {
  return `
You are the narrative engine for StoryMaker5000. Continue the user's long-form story.

Return only valid JSON using this exact shape:
{
  "title": "Short scene title",
  "scene": "Polished story prose, 500-900 words unless the user asks otherwise.",
  "summary": "One paragraph summary of what changed.",
  "memoryNotes": ["Important persistent fact 1", "Important persistent fact 2"],
  "characterUpdates": ["Character change 1", "Character change 2"],
  "timelineUpdates": ["Timeline event 1", "Timeline event 2"],
  "imagePrompt": "A visual scene prompt with setting, characters, mood, lighting, and style."
}

Rules:
- Respect the user's prompt, but preserve continuity with the scenario notes.
- Treat this as mature adult fiction: prioritize believable psychology, consent, emotional tension, privacy, and consequences.
- If multiple characters are present, keep voices distinct.
- Do not mention that you are an AI model.
- Do not include markdown fences.

Story:
${JSON.stringify(body.story, null, 2)}

Characters:
${JSON.stringify(body.characters, null, 2)}

Recent scenes:
${JSON.stringify(body.recentScenes, null, 2)}

Long-term memory:
${JSON.stringify(body.memories.slice(-30), null, 2)}

User prompt:
${body.prompt}
`;
}

function parseProviderJson(raw: string, provider: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error(`${provider} returned text that did not contain JSON.`);
    }

    return JSON.parse(match[0]);
  }
}

function validateStoryResponse(body: unknown, checks: GatewayCheck[]) {
  if (!isObject(body)) {
    return {
      ok: false as const,
      message: "The story provider returned a non-object response."
    };
  }

  const scene = stringOrDefault(body.scene, "").trim();

  if (!scene) {
    return {
      ok: false as const,
      message: "The story provider did not return scene prose."
    };
  }

  checks.push({
    id: "response-shape",
    status: "ok",
    detail: "The story provider returned the expected scene structure."
  });

  return {
    ok: true as const,
    body: {
      title: stringOrDefault(body.title, "Untitled scene"),
      scene,
      summary: stringOrDefault(body.summary, "The story moved forward."),
      memoryNotes: stringArray(body.memoryNotes).slice(0, 6),
      characterUpdates: stringArray(body.characterUpdates).slice(0, 6),
      timelineUpdates: stringArray(body.timelineUpdates).slice(0, 6),
      imagePrompt: stringOrDefault(
        body.imagePrompt,
        "Cinematic story scene illustration with expressive lighting."
      )
    }
  };
}

function createMockScene(body: StoryRequest) {
  const hero = body.characters[0]?.name || "the lead character";
  const title = body.prompt
    ? body.prompt.split(/[.?!]/)[0]?.slice(0, 58) || "The Next Turning Point"
    : "The Next Turning Point";

  return {
    title,
    scene: `${hero} held still at the edge of the next decision, aware of the room, the silence, and the things neither person had said plainly yet.\n\nThe scenario turned on small signals: a guarded look, a careful pause, a choice to answer honestly instead of safely. ${body.prompt || "The next scene begins here."}\n\nBy the time the moment settled, ${hero} understood that the real tension was not only what might happen next, but what each person was willing to admit about wanting it.`,
    summary: `${hero} follows the user's prompt and reaches a mature emotional turning point that should be remembered in future scenes.`,
    memoryNotes: [
      `${hero} experienced a turning point connected to: ${body.prompt || "the user's prompt"}.`,
      `The scenario tone remains ${body.story.tone || "intimate and character driven"}.`
    ],
    characterUpdates: [`${hero} is now more aware of the emotional stakes.`],
    timelineUpdates: [
      `A new scene advanced the scenario from the prompt: ${body.prompt || "continue the story"}.`
    ],
    imagePrompt: `Cinematic adult contemporary story illustration of ${hero} in a private, emotionally charged ${body.story.genre || "dramatic"} scenario, expressive lighting, grounded setting, cohesive character design.`
  };
}

function withGateway(
  response: Omit<StoryResponse, "gateway">,
  provider: string,
  mode: "mock" | "live",
  checks: GatewayCheck[]
): StoryResponse {
  return {
    ...response,
    gateway: {
      provider,
      mode,
      checks
    }
  };
}

function invalid(message: string, checks: GatewayCheck[]) {
  checks.push({
    id: "validation",
    status: "error",
    detail: message
  });
  return { ok: false as const, message };
}

function fail(status: number, error: string, checks: GatewayCheck[]) {
  return NextResponse.json({ error, gateway: { checks } }, { status });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function readProviderError(data: unknown, fallback: string) {
  if (!isObject(data)) return fallback;

  const error = data.error;

  if (isObject(error) && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}
