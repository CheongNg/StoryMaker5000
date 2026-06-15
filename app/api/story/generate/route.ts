import { NextRequest, NextResponse } from "next/server";

type Character = {
  name: string;
  role: string;
  personality: string;
  appearance: string;
  goals: string;
  secrets: string;
};

type Scene = {
  title: string;
  text: string;
  summary: string;
};

type StoryRequest = {
  story: {
    title: string;
    genre: string;
    tone: string;
    worldRules: string;
    summary: string;
  };
  characters: Character[];
  recentScenes: Scene[];
  memories: string[];
  prompt: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as StoryRequest;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(createMockScene(body));
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const instruction = buildInstruction(body);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: instruction }]
          }
        ],
        generationConfig: {
          temperature: 0.85,
          responseMimeType: "application/json"
        }
      })
    }
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "The story model could not generate a scene right now." },
      { status: response.status }
    );
  }

  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!raw) {
    return NextResponse.json(
      { error: "The story model returned an empty response." },
      { status: 502 }
    );
  }

  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      { error: "The story model returned a response that was not valid JSON." },
      { status: 502 }
    );
  }
}

function buildInstruction(body: StoryRequest) {
  return `
You are the narrative engine for StoryMaker5000. Continue the user's long-form story.

Return only valid JSON using this exact shape:
{
  "title": "Short scene title",
  "scene": "Polished story prose, 700-1200 words unless the user asks otherwise.",
  "summary": "One paragraph summary of what changed.",
  "memoryNotes": ["Important persistent fact 1", "Important persistent fact 2"],
  "characterUpdates": ["Character change 1", "Character change 2"],
  "timelineUpdates": ["Timeline event 1", "Timeline event 2"],
  "imagePrompt": "A visual scene prompt with setting, characters, mood, lighting, and style."
}

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

function createMockScene(body: StoryRequest) {
  const hero = body.characters[0]?.name || "the lead character";
  const title = body.prompt
    ? body.prompt.split(/[.?!]/)[0].slice(0, 58)
    : "The Next Turning Point";

  return {
    title,
    scene: `${hero} paused at the edge of the next decision, feeling the old rules of ${body.story.title || "the story"} bend around the moment.\n\nThe air carried signs that something had shifted: a half-remembered promise, a sound from somewhere unseen, and the sharp certainty that the path ahead would not forgive hesitation. ${body.prompt || "The next scene begins here."}\n\nBy the time the scene ended, ${hero} understood one thing clearly: the story had opened a door, and stepping through it would change what every character believed was possible.`,
    summary: `${hero} follows the user's prompt and reaches a new turning point that should be remembered in future scenes.`,
    memoryNotes: [
      `${hero} experienced a turning point connected to: ${body.prompt || "the user's prompt"}.`,
      `The story tone remains ${body.story.tone || "dramatic and imaginative"}.`
    ],
    characterUpdates: [`${hero} is now more committed to the central conflict.`],
    timelineUpdates: [`A new scene advanced the story from the prompt: ${body.prompt || "continue the story"}.`],
    imagePrompt: `Cinematic story illustration of ${hero} facing a pivotal moment in ${body.story.genre || "a speculative"} setting, expressive lighting, detailed environment, cohesive character design.`
  };
}
