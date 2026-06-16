"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Story = {
  title: string;
  genre: string;
  tone: string;
  worldRules: string;
  summary: string;
};

type Character = {
  id: string;
  name: string;
  role: string;
  personality: string;
  appearance: string;
  goals: string;
  secrets: string;
  portraitUrl?: string;
  portraitName?: string;
};

type Scene = {
  id: string;
  userPrompt?: string;
  title: string;
  text: string;
  summary: string;
  memoryNotes: string[];
  characterUpdates: string[];
  timelineUpdates: string[];
  imagePrompt: string;
  imageUrl?: string;
  createdAt: string;
  gateway?: GatewayReport;
};

type GatewayCheck = {
  id: string;
  label?: string;
  status: "ok" | "warning" | "error" | "mock";
  detail: string;
};

type GatewayReport = {
  provider?: string;
  mode?: "mock" | "live";
  checks?: GatewayCheck[];
};

type StoryResponse = {
  title: string;
  scene: string;
  summary: string;
  memoryNotes: string[];
  characterUpdates: string[];
  timelineUpdates: string[];
  imagePrompt: string;
  gateway?: GatewayReport;
  error?: string;
};

const defaultStory: Story = {
  title: "After Hours",
  genre: "Adult contemporary drama",
  tone: "Intimate, grounded, emotionally charged",
  worldRules:
    "Keep the scenario character-led, mature, and psychologically believable. Focus on desire, tension, consent, consequences, and private motivations.",
  summary:
    "Two adults are drawn into a complicated private situation where attraction, restraint, and old choices shape what happens next."
};

const starterCharacters: Character[] = [
  {
    id: "mira",
    name: "Mira Vale",
    role: "Main character",
    personality: "Observant, guarded, quietly direct when she feels safe",
    appearance: "Shoulder-length dark hair, tailored coat, understated jewelry",
    goals: "Understand what she wants without losing control of the situation",
    secrets: "She is more emotionally invested than she admits"
  }
];

const storageKey = "storymaker5000-state-v2";
const themeKey = "storymaker5000-theme";

export default function Home() {
  const [story, setStory] = useState<Story>(defaultStory);
  const [characters, setCharacters] = useState<Character[]>(starterCharacters);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [prompt, setPrompt] = useState(
    "Continue with Mira entering a private conversation where both people are careful about what they reveal."
  );
  const [busy, setBusy] = useState(false);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const [operationStartedAt, setOperationStartedAt] = useState<number | null>(null);
  const [elapsedTick, setElapsedTick] = useState(Date.now());
  const [notice, setNotice] = useState("");
  const [gateway, setGateway] = useState<GatewayReport>({ checks: [] });
  const [healthChecks, setHealthChecks] = useState<GatewayCheck[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [storageStatus, setStorageStatus] = useState<GatewayCheck>({
    id: "storage",
    label: "Browser storage",
    status: "warning",
    detail: "Storage has not been checked yet."
  });

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(themeKey);

    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }

    try {
      window.localStorage.setItem("storymaker5000-storage-check", "ok");
      window.localStorage.removeItem("storymaker5000-storage-check");
      setStorageStatus({
        id: "storage",
        label: "Browser storage",
        status: "ok",
        detail: "Drafts can be saved in this browser."
      });
    } catch {
      setStorageStatus({
        id: "storage",
        label: "Browser storage",
        status: "error",
        detail: "This browser blocked local draft storage."
      });
    }

    try {
      const saved = window.localStorage.getItem(storageKey);

      if (!saved) return;

      const parsed = JSON.parse(saved);
      setStory(normalizeStory(parsed.story));
      setCharacters(parsed.characters || starterCharacters);
      setScenes(parsed.scenes || []);
      setPrompt(parsed.prompt || "");
    } catch {
      window.localStorage.removeItem(storageKey);
      setNotice("Saved draft was unreadable, so the app started with defaults.");
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(themeKey, theme);
  }, [theme]);

  useEffect(() => {
    refreshHealth();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ story, characters, scenes, prompt })
      );
    } catch {
      setStorageStatus({
        id: "storage",
        label: "Browser storage",
        status: "error",
        detail: "This browser could not save the current draft."
      });
    }
  }, [story, characters, scenes, prompt]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!busy && !imageBusyId) return;

    setElapsedTick(Date.now());
    const timer = window.setInterval(() => setElapsedTick(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [busy, imageBusyId]);

  const memories = useMemo(
    () =>
      scenes.flatMap((scene) => [
        scene.summary,
        ...scene.memoryNotes,
        ...scene.characterUpdates,
        ...scene.timelineUpdates
      ]),
    [scenes]
  );

  const chatScenes = useMemo(() => [...scenes].reverse(), [scenes]);
  const latestScene = scenes[0];
  const imageBusyScene = scenes.find((scene) => scene.id === imageBusyId);
  const imageBusy = Boolean(imageBusyId);
  const elapsedSeconds = operationStartedAt
    ? Math.max(1, Math.round((elapsedTick - operationStartedAt) / 1000))
    : 0;

  const localChecks = useMemo(() => {
    const checks: GatewayCheck[] = [storageStatus];
    const validCharacters = characters.filter((character) => character.name.trim());

    checks.push({
      id: "characters",
      label: "Characters",
      status: validCharacters.length > 0 ? "ok" : "error",
      detail:
        validCharacters.length > 0
          ? `${validCharacters.length} usable character(s) available.`
          : "Add a named character before generating scenes."
    });

    checks.push({
      id: "prompt",
      label: "Prompt",
      status: prompt.trim() ? "ok" : "warning",
      detail: prompt.trim()
        ? `${prompt.trim().length} characters ready to send.`
        : "Prompt is empty."
    });

    return checks;
  }, [characters, prompt, storageStatus]);

  async function refreshHealth() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const data = (await response.json()) as { checks?: GatewayCheck[] };
      setHealthChecks(data.checks || []);
    } catch {
      setHealthChecks([
        {
          id: "health",
          label: "Gateway health",
          status: "error",
          detail: "Could not reach the local health endpoint."
        }
      ]);
    }
  }

  async function generateScene() {
    const localProblem = getLocalProblem();

    if (localProblem) {
      setNotice(localProblem);
      setGateway({
        checks: [
          {
            id: "local-validation",
            status: "error",
            detail: localProblem
          }
        ]
      });
      return;
    }

    setBusy(true);
    setOperationStartedAt(Date.now());
    setNotice("");

    try {
      const response = await fetch("/api/story/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story,
          characters,
          recentScenes: scenes.slice(0, 6).map((scene) => ({
            title: scene.title,
            text: scene.text,
            summary: scene.summary
          })),
          memories,
          prompt
        })
      });

      const data = (await response.json()) as StoryResponse;
      setGateway(data.gateway || { checks: [] });

      if (!response.ok || data.error) {
        throw new Error(data.error || "The scene could not be generated.");
      }

      const nextScene: Scene = {
        id: createId("scene"),
        userPrompt: prompt,
        title: data.title || "Untitled scene",
        text: data.scene || "",
        summary: data.summary || "",
        memoryNotes: data.memoryNotes || [],
        characterUpdates: data.characterUpdates || [],
        timelineUpdates: data.timelineUpdates || [],
        imagePrompt: data.imagePrompt || "",
        createdAt: new Date().toISOString(),
        gateway: data.gateway
      };

      setScenes((current) => [nextScene, ...current]);
      setStory((current) => ({
        ...current,
        summary: data.summary
          ? compactSummary(`${current.summary}\n\nLatest: ${data.summary}`)
          : current.summary
      }));
      setPrompt("");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setOperationStartedAt(null);
      refreshHealth();
    }
  }

  async function generateImage(scene: Scene) {
    const sourcePrompt = (scene.imagePrompt || scene.summary || scene.text).trim();
    const referenceImages = characters
      .filter((character) => character.portraitUrl)
      .slice(0, 6)
      .map((character) => ({
        name: character.name || "Unnamed character",
        imageUrl: character.portraitUrl || ""
      }));

    if (!sourcePrompt) {
      setNotice("This scene does not have enough visual detail for image generation.");
      return;
    }

    setImageBusyId(scene.id);
    setOperationStartedAt(Date.now());
    setNotice("");

    try {
      const response = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildImagePrompt(sourcePrompt, referenceImages),
          referenceImages
        })
      });
      const data = (await response.json()) as {
        imageUrl?: string;
        gateway?: GatewayReport;
        error?: string;
      };

      setGateway(data.gateway || { checks: [] });

      if (!response.ok || data.error || !data.imageUrl) {
        throw new Error(
          getGatewayProblem(data.gateway) ||
            data.error ||
            "The scene image could not be generated."
        );
      }

      setScenes((current) =>
        current.map((item) =>
          item.id === scene.id
            ? { ...item, imageUrl: data.imageUrl, gateway: data.gateway }
            : item
        )
      );
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setImageBusyId(null);
      setOperationStartedAt(null);
      refreshHealth();
    }
  }

  function getLocalProblem() {
    if (!prompt.trim()) return "Add a prompt before generating a scene.";
    if (prompt.length > 4000) return "Prompt is too long for this MVP gateway.";
    if (!characters.some((character) => character.name.trim())) {
      return "Add at least one named character before generating a scene.";
    }

    return "";
  }

  function addCharacter() {
    setCharacters((current) => [
      ...current,
      {
        id: createId("character"),
        name: "New character",
        role: "Supporting character",
        personality: "",
        appearance: "",
        goals: "",
        secrets: "",
        portraitUrl: "",
        portraitName: ""
      }
    ]);
  }

  function updateCharacter(id: string, patch: Partial<Character>) {
    setCharacters((current) =>
      current.map((character) =>
        character.id === id ? { ...character, ...patch } : character
      )
    );
  }

  function removeCharacter(id: string) {
    setCharacters((current) => current.filter((character) => character.id !== id));
  }

  async function uploadCharacterPortrait(id: string, files: FileList | null) {
    const file = files?.[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice("Use a JPG, PNG, or WEBP character image.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setNotice("Choose an image under 8 MB. Large photos should be cropped first.");
      return;
    }

    try {
      const portraitUrl = await resizeImage(file);
      updateCharacter(id, {
        portraitUrl,
        portraitName: file.name
      });
      setNotice("");
    } catch {
      setNotice("The character image could not be loaded.");
    }
  }

  function removeCharacterPortrait(id: string) {
    updateCharacter(id, {
      portraitUrl: "",
      portraitName: ""
    });
  }

  function resetDraft() {
    const shouldReset = window.confirm(
      "Reset this story? This will clear the current scenes, prompt, and scenario setup."
    );

    if (!shouldReset) return;

    setStory(defaultStory);
    setCharacters(starterCharacters);
    setScenes([]);
    setPrompt(
      "Continue with Mira entering a private conversation where both people are careful about what they reveal."
    );
    setGateway({ checks: [] });
    setNotice("");
  }

  return (
    <main className="app-shell">
      <section className="workspace chat-workspace">
        <header className="workspace-header chat-header">
          <div className="chat-title-row">
            <button
              aria-label="Open scenario setup"
              className="icon-button"
              type="button"
              onClick={() => setDrawerOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <h1>StoryMaker5000</h1>
              <span className="status-text">Running on local server</span>
            </div>
          </div>
          <div className="scenario-heading">
            <div>
              <h2>{story.title || "Untitled scenario"}</h2>
              <div className="metrics">
                <span>{characters.length} characters</span>
                <span>{scenes.length} scenes</span>
                <span>{memories.length} memory notes</span>
              </div>
            </div>
            <button
              className="button small"
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </header>

        <section className="chat-panel" aria-labelledby="chat-title">
          <h3 id="chat-title" className="visually-hidden">
            Story Chat
          </h3>
          <div className="chat-log">
            {chatScenes.length === 0 && !busy && !imageBusy && !notice ? (
              <div className="empty-chat">
                <strong>No messages yet</strong>
                <span>Submit a prompt to start the scenario.</span>
              </div>
            ) : (
              <>
              {chatScenes.map((scene) => (
                  <div className="chat-pair" key={scene.id}>
                    <article className="message user-message">
                      <div className="message-label">You</div>
                      <p>{scene.userPrompt || "Continue the story."}</p>
                    </article>

                    <article className="message assistant-message">
                      <div className="message-header">
                        <div>
                          <div className="message-label">StoryMaker</div>
                          <h3>{scene.title}</h3>
                        </div>
                        <span className="scene-meta">
                          {new Date(scene.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                      <p className="scene-text">{scene.text}</p>
                      {scene.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="scene-image chat-image"
                          src={scene.imageUrl}
                          alt={`Generated art for ${scene.title}`}
                        />
                      ) : null}
                    </article>
                  </div>
                ))}
              {busy ? (
                <div className="chat-pair" key="story-progress">
                  <article className="message user-message pending-message">
                    <div className="message-label">You</div>
                    <p>{prompt}</p>
                  </article>
                  <ProgressMessage
                    title="Writing scene"
                    detail={`StoryMaker is sending the prompt to OpenAI and drafting the next scene. ${formatElapsed(elapsedSeconds)} elapsed.`}
                    steps={[
                      "Checking story context",
                      "Generating prose",
                      "Preparing memory notes"
                    ]}
                  />
                </div>
              ) : null}
              {imageBusy && imageBusyScene ? (
                <ProgressMessage
                  key="image-progress"
                  title="Creating image"
                  detail={`Image generation is working on "${imageBusyScene.title}". ${formatElapsed(elapsedSeconds)} elapsed. Image calls can take around 1-2 minutes, especially with character references.`}
                  steps={[
                    "Sending scene prompt",
                    "Rendering draft image",
                    "Returning image to chat"
                  ]}
                />
              ) : null}
              {notice ? (
                <article className="message assistant-message status-message error-message">
                  <div className="message-label">Status</div>
                  <h3>Needs attention</h3>
                  <p>{notice}</p>
                </article>
              ) : null}
              </>
            )}
          </div>
        </section>

        <section className="composer chat-composer" aria-labelledby="composer-title">
          <div className="composer-topline">
            <h3 id="composer-title">Prompt</h3>
            <span className="count">{prompt.length}/4000</span>
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Write what should happen next..."
          />
          <div className="action-bar">
            <button
              className="button danger"
              type="button"
              disabled={busy || imageBusy}
              onClick={resetDraft}
            >
              Reset Story
            </button>
            <button
              className="button primary"
              type="button"
              disabled={busy}
              onClick={generateScene}
            >
              {busy ? "Submitting" : "Submit Prompt"}
            </button>
            <button
              className="button"
              type="button"
              disabled={!latestScene || imageBusy}
              onClick={() => latestScene && generateImage(latestScene)}
            >
              {imageBusy ? "Generating Image" : "Generate Image"}
            </button>
          </div>
          <div className="gateway-strip">
            <ProviderBadge gateway={gateway} />
            <span>{notice || summarizeChecks(gateway.checks || healthChecks)}</span>
          </div>
        </section>
      </section>

      <div
        aria-hidden={!drawerOpen}
        className={`drawer-backdrop ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        aria-label="Story setup drawer"
        className={`setup-drawer ${drawerOpen ? "open" : ""}`}
      >
        <div className="drawer-header">
          <div>
            <h2>Scenario Setup</h2>
            <span>Scenario and main characters</span>
          </div>
          <button
            aria-label="Close scenario setup"
            className="icon-button close-button"
            type="button"
            onClick={() => setDrawerOpen(false)}
          >
            <span />
            <span />
          </button>
        </div>

        <section className="drawer-section" aria-labelledby="scenario-background">
          <h3 id="scenario-background">Scenario Background</h3>
          <Field label="Title">
            <input
              value={story.title}
              onChange={(event) =>
                setStory({ ...story, title: event.target.value })
              }
            />
          </Field>
          <Field label="Story Type">
            <input
              value={story.genre}
              onChange={(event) =>
                setStory({ ...story, genre: event.target.value })
              }
            />
          </Field>
          <Field label="Tone">
            <input
              value={story.tone}
              onChange={(event) => setStory({ ...story, tone: event.target.value })}
            />
          </Field>
          <Field label="Scenario Notes">
            <textarea
              value={story.worldRules}
              onChange={(event) =>
                setStory({ ...story, worldRules: event.target.value })
              }
            />
          </Field>
          <Field label="Living Scenario Summary">
            <textarea
              value={story.summary}
              onChange={(event) =>
                setStory({ ...story, summary: event.target.value })
              }
            />
          </Field>
        </section>

        <section className="drawer-section" aria-labelledby="character-background">
          <div className="drawer-section-title">
            <h3 id="character-background">Main Characters</h3>
            <button className="button small" type="button" onClick={addCharacter}>
              Add Character
            </button>
          </div>

          <div className="character-summary-list" aria-label="Added characters">
            {characters.map((character, index) => (
              <div className="character-summary" key={`summary-${character.id}`}>
                {character.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={character.portraitUrl}
                    alt={`${character.name || `Character ${index + 1}`} reference`}
                  />
                ) : (
                  <span>{(character.name || `${index + 1}`).slice(0, 1)}</span>
                )}
                <div>
                  <strong>{character.name || `Main character ${index + 1}`}</strong>
                  <small>{character.role || "Main character"}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="drawer-character-list">
            {characters.map((character, index) => (
              <article className="drawer-character" key={character.id}>
                <div className="drawer-character-header">
                  <h4>{character.name || `Main character ${index + 1}`}</h4>
                  {characters.length > 1 ? (
                    <button
                      className="button danger small"
                      type="button"
                      onClick={() => removeCharacter(character.id)}
                    >
                      Remove
                    </button>
                    ) : null}
                </div>
                <div className="portrait-row">
                  {character.portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="portrait-preview"
                      src={character.portraitUrl}
                      alt={`${character.name || `Character ${index + 1}`} portrait`}
                    />
                  ) : (
                    <div className="portrait-placeholder">No image</div>
                  )}
                  <div className="portrait-actions">
                    <label className="upload-control">
                      <span>Upload picture</span>
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        type="file"
                        onChange={(event) =>
                          uploadCharacterPortrait(character.id, event.target.files)
                        }
                      />
                    </label>
                    {character.portraitUrl ? (
                      <button
                        className="button small"
                        type="button"
                        onClick={() => removeCharacterPortrait(character.id)}
                      >
                        Remove picture
                      </button>
                    ) : null}
                    <small>
                      {character.portraitName ||
                        "Used as a reference template for scene images."}
                    </small>
                  </div>
                </div>
                <Field label="Name">
                  <input
                    value={character.name}
                    onChange={(event) =>
                      updateCharacter(character.id, { name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Role">
                  <input
                    value={character.role}
                    onChange={(event) =>
                      updateCharacter(character.id, { role: event.target.value })
                    }
                  />
                </Field>
                <Field label="Personality">
                  <textarea
                    value={character.personality}
                    onChange={(event) =>
                      updateCharacter(character.id, {
                        personality: event.target.value
                      })
                    }
                  />
                </Field>
                <Field label="Appearance">
                  <textarea
                    value={character.appearance}
                    onChange={(event) =>
                      updateCharacter(character.id, {
                        appearance: event.target.value
                      })
                    }
                  />
                </Field>
                <Field label="Goals">
                  <textarea
                    value={character.goals}
                    onChange={(event) =>
                      updateCharacter(character.id, { goals: event.target.value })
                    }
                  />
                </Field>
                <Field label="Secrets">
                  <textarea
                    value={character.secrets}
                    onChange={(event) =>
                      updateCharacter(character.id, {
                        secrets: event.target.value
                      })
                    }
                  />
                </Field>
              </article>
            ))}
          </div>
        </section>

        <section className="drawer-section" aria-labelledby="drawer-status">
          <h3 id="drawer-status">Status</h3>
          <CheckList checks={[...localChecks, ...healthChecks]} />
        </section>
      </aside>
    </main>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field-group">
      <span>{label}</span>
      {children}
    </label>
  );
}

function CheckList({
  checks,
  empty = "No checks available."
}: {
  checks: GatewayCheck[];
  empty?: string;
}) {
  if (checks.length === 0) {
    return <div className="check muted">{empty}</div>;
  }

  return (
    <div className="check-list">
      {checks.map((check, index) => (
        <div className="check" key={`${check.id}-${index}`}>
          <span className={`dot ${check.status}`} />
          <div>
            <strong>{check.label || titleCase(check.id)}</strong>
            <p>{check.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressMessage({
  title,
  detail,
  steps
}: {
  title: string;
  detail: string;
  steps: string[];
}) {
  return (
    <article className="message assistant-message status-message">
      <div className="message-header">
        <div>
          <div className="message-label">StoryMaker</div>
          <h3>{title}</h3>
        </div>
        <span className="typing-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
      <p>{detail}</p>
      <ul className="progress-steps">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </article>
  );
}

function ProviderBadge({ gateway }: { gateway: GatewayReport }) {
  const provider = gateway.provider || "none";
  const mode = gateway.mode || "idle";

  return <span className="status-pill">{`${provider} / ${mode}`}</span>;
}

function titleCase(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarizeChecks(checks: GatewayCheck[]) {
  const error = checks.find((check) => check.status === "error");
  const warning = checks.find(
    (check) => check.status === "warning" || check.status === "mock"
  );

  if (error) return error.detail;
  if (warning) return warning.detail;
  if (checks.length > 0) return "Ready.";
  return "Waiting for first request.";
}

function getGatewayProblem(gateway?: GatewayReport) {
  const checks = gateway?.checks || [];
  const providerError = checks.find((check) => check.id === "provider-response");
  const error = providerError || checks.find((check) => check.status === "error");
  const warning = checks.find((check) => check.status === "warning");

  return error?.detail || warning?.detail || "";
}

function buildImagePrompt(
  sourcePrompt: string,
  referenceImages: Array<{ name: string; imageUrl: string }>
) {
  if (referenceImages.length === 0) return sourcePrompt;

  const names = referenceImages.map((image) => image.name).join(", ");
  return `${sourcePrompt}\n\nUse the uploaded character reference image(s) as visual templates for: ${names}. Preserve the characters' recognizable look, hairstyle, face shape, clothing cues, and overall visual identity while adapting pose, lighting, and setting to this scene.`;
}

function resizeImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read image."));
    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("Could not load image."));
      image.onload = () => {
        const maxDimension = 768;
        const scale = Math.min(
          1,
          maxDimension / Math.max(image.width, image.height)
        );
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Canvas is unavailable."));
          return;
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

function compactSummary(value: string) {
  const maxLength = 3000;

  if (value.length <= maxLength) return value;

  return `Earlier summary trimmed.\n\n${value.slice(value.length - maxLength)}`;
}

function normalizeStory(value: unknown): Story {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultStory;
  }

  return {
    ...defaultStory,
    ...(value as Partial<Story>)
  };
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function createId(prefix: string) {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return window.crypto.randomUUID();
  }

  const randomPart =
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.getRandomValues === "function"
      ? Array.from(window.crypto.getRandomValues(new Uint32Array(2)))
          .map((value) => value.toString(36))
          .join("")
      : Math.random().toString(36).slice(2);

  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}
