"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import defaultPreset from "../story-library/presets/default-story.json";

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
  family: string;
  role: string;
  personality: string;
  appearance: string;
  goals: string;
  secrets: string;
  portraitUrl?: string;
  portraitName?: string;
};

type StoryPreset = {
  id: string;
  label: string;
  description: string;
  story: Story;
  starterCharacters: Character[];
  characterRoster: Character[];
  starterPrompt: string;
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

type StoryCheckpoint = {
  id: string;
  title: string;
  createdAt: string;
  storyline: string;
  keyCharacters: string[];
  attitudeShifts: string[];
};

type LivingMemory = {
  facts: string[];
  characterStates: string[];
  openThreads: string[];
  toneRules: string[];
  continuityWarnings: string[];
  updatedAt?: string;
};

type CoreMemoryImage = {
  id: string;
  title: string;
  imageUrl: string;
  capturedAt: string;
};

type CoreMemoryRecord = {
  id: string;
  title: string;
  createdAt: string;
  storyline: string;
  keyCharacters: string[];
  attitudeShifts: string[];
  livingMemory: LivingMemory;
  images: CoreMemoryImage[];
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
  livingMemory?: LivingMemory;
  imagePrompt: string;
  gateway?: GatewayReport;
  error?: string;
};

const storageKey = "storymaker5000-state-v2";
const coreLibraryKey = "storymaker5000-core-library-v1";
const themeKey = "storymaker5000-theme";
const defaultLivingMemory: LivingMemory = {
  facts: [],
  characterStates: [],
  openThreads: [],
  toneRules: [],
  continuityWarnings: []
};
const storyPresets: StoryPreset[] = [
  normalizeStoryPreset(defaultPreset)
];
const defaultStoryPreset = storyPresets[0];
const defaultStory: Story = defaultStoryPreset.story;
const starterCharacters: Character[] = defaultStoryPreset.starterCharacters;
const starterPrompt = defaultStoryPreset.starterPrompt;

export default function Home() {
  const [story, setStory] = useState<Story>(defaultStory);
  const [characters, setCharacters] = useState<Character[]>(starterCharacters);
  const [presetRoster, setPresetRoster] = useState<Character[]>(
    defaultStoryPreset.characterRoster
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    starterCharacters[0]?.id || ""
  );
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [storyCheckpoints, setStoryCheckpoints] = useState<StoryCheckpoint[]>([]);
  const [coreLibrary, setCoreLibrary] = useState<CoreMemoryRecord[]>([]);
  const [livingMemory, setLivingMemory] =
    useState<LivingMemory>(defaultLivingMemory);
  const [prompt, setPrompt] = useState(starterPrompt);
  const [busy, setBusy] = useState(false);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const [operationStartedAt, setOperationStartedAt] = useState<number | null>(null);
  const [elapsedTick, setElapsedTick] = useState(Date.now());
  const [notice, setNotice] = useState("");
  const [checkpointStatus, setCheckpointStatus] = useState("");
  const [gateway, setGateway] = useState<GatewayReport>({ checks: [] });
  const [healthChecks, setHealthChecks] = useState<GatewayCheck[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState(defaultStoryPreset.id);
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
      const savedCharacters = normalizeCharacters(parsed.characters);
      setStory(normalizeStory(parsed.story));
      setCharacters(savedCharacters);
      setSelectedCharacterId(savedCharacters[0]?.id || "");
      setScenes(parsed.scenes || []);
      setStoryCheckpoints(normalizeStoryCheckpoints(parsed.storyCheckpoints));
      setLivingMemory(normalizeLivingMemory(parsed.livingMemory));
      setPrompt(parsed.prompt || "");
      if (
        typeof parsed.selectedPresetId === "string" &&
        storyPresets.some((preset) => preset.id === parsed.selectedPresetId)
      ) {
        setSelectedPresetId(parsed.selectedPresetId);
      }
      const savedPreset =
        storyPresets.find((preset) => preset.id === parsed.selectedPresetId) ||
        defaultStoryPreset;
      setPresetRoster(savedPreset.characterRoster);
    } catch {
      window.localStorage.removeItem(storageKey);
      setNotice("Saved draft was unreadable, so the app started with defaults.");
    }

    try {
      const savedLibrary = window.localStorage.getItem(coreLibraryKey);

      if (savedLibrary) {
        setCoreLibrary(normalizeCoreLibrary(JSON.parse(savedLibrary)));
      }
    } catch {
      window.localStorage.removeItem(coreLibraryKey);
      setNotice("Saved core memory library was unreadable, so it was cleared.");
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
        JSON.stringify({
          story,
          characters,
          scenes,
          storyCheckpoints,
          livingMemory,
          prompt,
          selectedPresetId
        })
      );
    } catch {
      setStorageStatus({
        id: "storage",
        label: "Browser storage",
        status: "error",
        detail: "This browser could not save the current draft."
      });
    }
  }, [
    story,
    characters,
    scenes,
    storyCheckpoints,
    livingMemory,
    prompt,
    selectedPresetId
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(coreLibraryKey, JSON.stringify(coreLibrary));
    } catch {
      setStorageStatus({
        id: "core-library-storage",
        label: "Core memory library",
        status: "error",
        detail:
          "This browser could not save the core memory library. Try deleting older image-heavy memories."
      });
    }
  }, [coreLibrary]);

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

  const sceneMemories = useMemo(
    () =>
      scenes.flatMap((scene) => [
        scene.summary,
        ...scene.memoryNotes,
        ...scene.characterUpdates,
        ...scene.timelineUpdates
      ]),
    [scenes]
  );
  const checkpointMemories = useMemo(
    () => storyCheckpoints.flatMap(formatCheckpointForMemory),
    [storyCheckpoints]
  );
  const memories = useMemo(
    () => [
      ...formatLivingMemoryForPrompt(livingMemory),
      ...checkpointMemories,
      ...sceneMemories
    ],
    [checkpointMemories, livingMemory, sceneMemories]
  );

  const chatScenes = useMemo(() => [...scenes].reverse(), [scenes]);
  const latestScene = scenes[0];
  const familyGroups = useMemo(() => groupCharactersByFamily(characters), [characters]);
  const selectedCharacter =
    characters.find((character) => character.id === selectedCharacterId) ||
    characters[0];
  const selectedCharacterIndex = selectedCharacter
    ? characters.findIndex((character) => character.id === selectedCharacter.id)
    : -1;
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

      if (response.status === 401) {
        window.location.assign(
          `/access?returnTo=${encodeURIComponent(
            window.location.pathname + window.location.search
          )}`
        );
        return;
      }

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
    setCheckpointStatus("");

    try {
      const response = await fetch("/api/story/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story,
          characters,
          recentScenes: scenes.slice(0, 3).map((scene) => ({
            title: scene.title,
            text: scene.text,
            summary: scene.summary
          })),
          livingMemory,
          memories: memories.slice(0, 24),
          prompt
        })
      });

      const data = (await response.json()) as StoryResponse;
      setGateway(data.gateway || { checks: [] });

      if (!response.ok || data.error) {
        throw new Error(
          getGatewayProblem(data.gateway) ||
            data.error ||
            "The scene could not be generated."
        );
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
      setLivingMemory((current) =>
        normalizeLivingMemory(data.livingMemory, current)
      );
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
      .filter((character) => character.portraitUrl?.startsWith("data:image/"))
      .slice(0, 3)
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
    const nextCharacter: Character = {
      id: createId("character"),
      name: "New character",
      family: "",
      role: "Supporting character",
      personality: "",
      appearance: "",
      goals: "",
      secrets: "",
      portraitUrl: "",
      portraitName: ""
    };

    setCharacters((current) => [...current, nextCharacter]);
    setSelectedCharacterId(nextCharacter.id);
  }

  function toggleRosterCharacter(rosterChar: Character) {
    const isActive = characters.some((c) => c.id === rosterChar.id);

    if (isActive) {
      const nextCharacters = characters.filter((c) => c.id !== rosterChar.id);
      setCharacters(nextCharacters);
      if (selectedCharacterId === rosterChar.id) {
        setSelectedCharacterId(nextCharacters[0]?.id || "");
      }
    } else {
      setCharacters((current) => [...current, { ...rosterChar }]);
      setSelectedCharacterId(rosterChar.id);
    }
  }

  function updateCharacter(id: string, patch: Partial<Character>) {
    setCharacters((current) =>
      current.map((character) =>
        character.id === id ? { ...character, ...patch } : character
      )
    );
  }

  function removeCharacter(id: string) {
    const nextCharacters = characters.filter((character) => character.id !== id);

    setCharacters(nextCharacters);

    if (selectedCharacterId === id) {
      setSelectedCharacterId(nextCharacters[0]?.id || "");
    }
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

  function saveStoryCheckpoint() {
    const checkpoint = createStoryCheckpoint(story, characters, scenes);

    setStoryCheckpoints((current) => [checkpoint, ...current].slice(0, 12));
    setLivingMemory((current) =>
      updateLivingMemoryWithCheckpoint(current, checkpoint)
    );
    setCheckpointStatus("Story checkpoint saved into long-term living memory.");
  }

  async function saveCoreMemory() {
    const checkpoint = createStoryCheckpoint(story, characters, scenes);
    const nextMemory = updateLivingMemoryWithCheckpoint(livingMemory, checkpoint);
    const images = await collectCoreMemoryImages(scenes);
    const record: CoreMemoryRecord = {
      id: createId("core-memory"),
      title: checkpoint.title,
      createdAt: new Date().toISOString(),
      storyline: checkpoint.storyline,
      keyCharacters: checkpoint.keyCharacters,
      attitudeShifts: checkpoint.attitudeShifts,
      livingMemory: nextMemory,
      images
    };

    setStoryCheckpoints((current) => [checkpoint, ...current].slice(0, 12));
    setLivingMemory(nextMemory);
    setCoreLibrary((current) => [record, ...current].slice(0, 20));
    setCheckpointStatus(
      `Core memory saved locally with ${images.length} image${
        images.length === 1 ? "" : "s"
      }.`
    );
  }

  function removeStoryCheckpoint(id: string) {
    setStoryCheckpoints((current) =>
      current.filter((checkpoint) => checkpoint.id !== id)
    );
    setCheckpointStatus("Story checkpoint removed from long-term memory.");
  }

  function bringCoreMemoryIntoStory(record: CoreMemoryRecord) {
    const checkpoint: StoryCheckpoint = {
      id: createId("checkpoint"),
      title: record.title,
      createdAt: new Date().toISOString(),
      storyline: record.storyline,
      keyCharacters: record.keyCharacters,
      attitudeShifts: record.attitudeShifts
    };

    setLivingMemory((current) =>
      mergeLivingMemory(current, record.livingMemory, checkpoint)
    );
    setStoryCheckpoints((current) => [checkpoint, ...current].slice(0, 12));
    setCheckpointStatus("Core memory brought into the current story.");
  }

  function removeCoreMemory(id: string) {
    setCoreLibrary((current) => current.filter((record) => record.id !== id));
    setCheckpointStatus("Core memory removed from the local library.");
  }

  function applyStoryPreset(presetId: string) {
    const preset =
      storyPresets.find((item) => item.id === presetId) || defaultStoryPreset;
    const currentPreset =
      storyPresets.find((item) => item.id === selectedPresetId) ||
      defaultStoryPreset;
    const hasDraft =
      scenes.length > 0 ||
      storyCheckpoints.length > 0 ||
      countLivingMemoryItems(livingMemory) > 0 ||
      prompt.trim() !== currentPreset.starterPrompt ||
      story.title !== currentPreset.story.title;

    if (hasDraft) {
      const shouldReplace = window.confirm(
        "Switch story preset? This will replace the current draft, scenes, prompt, living memory, and checkpoints. Your Local Core Library will stay saved."
      );

      if (!shouldReplace) return;
    }

    setSelectedPresetId(preset.id);
    setStory(preset.story);
    setCharacters(preset.starterCharacters);
    setPresetRoster(preset.characterRoster);
    setSelectedCharacterId(preset.starterCharacters[0]?.id || "");
    setScenes([]);
    setStoryCheckpoints([]);
    setLivingMemory(defaultLivingMemory);
    setPrompt(preset.starterPrompt);
    setGateway({ checks: [] });
    setNotice("");
    setCheckpointStatus(`Loaded preset: ${preset.label}.`);
  }

  function resetDraft() {
    const shouldReset = window.confirm(
      "Reset this story? This will clear the current scenes, prompt, scenario setup, character setup, and story checkpoints."
    );

    if (!shouldReset) return;

    const preset =
      storyPresets.find((item) => item.id === selectedPresetId) ||
      defaultStoryPreset;

    setStory(preset.story);
    setCharacters(preset.starterCharacters);
    setPresetRoster(preset.characterRoster);
    setSelectedCharacterId(preset.starterCharacters[0]?.id || "");
    setScenes([]);
    setStoryCheckpoints([]);
    setLivingMemory(defaultLivingMemory);
    setPrompt(preset.starterPrompt);
    setGateway({ checks: [] });
    setNotice("");
    setCheckpointStatus("");
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
                <span>{countLivingMemoryItems(livingMemory)} living memories</span>
                <span>{storyCheckpoints.length} checkpoints</span>
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
          <div className="composer-input-row">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Write what should happen next..."
            />
            <div className="action-bar composer-actions">
              <button
                className="button primary"
                type="button"
                disabled={busy}
                onClick={generateScene}
              >
                {busy ? "Generating Story" : "Generate Story"}
              </button>
              <button
                className="button"
                type="button"
                disabled={!latestScene || imageBusy}
                onClick={() => latestScene && generateImage(latestScene)}
              >
                {imageBusy ? "Generating Image" : "Generate Image"}
              </button>
              <button
                className="button"
                type="button"
                disabled={busy || imageBusy}
                onClick={saveStoryCheckpoint}
              >
                Save Checkpoint
              </button>
            </div>
          </div>
          <div className="gateway-strip">
            <ProviderBadge gateway={gateway} />
            <span>
              {notice || checkpointStatus || summarizeChecks(gateway.checks || healthChecks)}
            </span>
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
          <Field label="Story Preset">
            <select
              value={selectedPresetId}
              onChange={(event) => applyStoryPreset(event.target.value)}
            >
              {storyPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </Field>
          <p className="preset-description">
            {storyPresets.find((preset) => preset.id === selectedPresetId)
              ?.description || defaultStoryPreset.description}
          </p>
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

        <section className="drawer-section" aria-labelledby="story-checkpoints">
          <div className="drawer-section-title">
            <h3 id="story-checkpoints">Story Checkpoints</h3>
            <button
              className="button small"
              type="button"
              onClick={saveStoryCheckpoint}
            >
              Save
            </button>
          </div>

          {storyCheckpoints.length > 0 ? (
            <div className="checkpoint-list">
              {storyCheckpoints.map((checkpoint) => (
                <article className="checkpoint-item" key={checkpoint.id}>
                  <div className="checkpoint-heading">
                    <div>
                      <strong>{checkpoint.title}</strong>
                      <span>
                        {new Date(checkpoint.createdAt).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })}
                      </span>
                    </div>
                    <button
                      className="button small"
                      type="button"
                      onClick={() => removeStoryCheckpoint(checkpoint.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="checkpoint-section">
                    <span>Storyline</span>
                    <p>{checkpoint.storyline}</p>
                  </div>
                  <div className="checkpoint-section">
                    <span>Key Characters</span>
                    <ul>
                      {checkpoint.keyCharacters.map((character) => (
                        <li key={character}>{character}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="checkpoint-section">
                    <span>Attitude Shifts</span>
                    <ul>
                      {checkpoint.attitudeShifts.map((shift) => (
                        <li key={shift}>{shift}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <h3>No checkpoints saved</h3>
              <p>Save the current storyline and character shifts when a scene lands.</p>
            </div>
          )}
        </section>

        <section className="drawer-section" aria-labelledby="living-memory">
          <div className="drawer-section-title">
            <h3 id="living-memory">Living Memory</h3>
            <span className="count">
              {countLivingMemoryItems(livingMemory)} items
            </span>
          </div>
          <div className="memory-grid">
            <MemoryList title="Facts" items={livingMemory.facts} />
            <MemoryList title="Character States" items={livingMemory.characterStates} />
            <MemoryList title="Open Threads" items={livingMemory.openThreads} />
            <MemoryList title="Tone Rules" items={livingMemory.toneRules} />
            <MemoryList
              title="Continuity Warnings"
              items={livingMemory.continuityWarnings}
            />
          </div>
        </section>

        <section className="drawer-section" aria-labelledby="core-library">
          <div className="drawer-section-title">
            <div>
              <h3 id="core-library">Local Core Library</h3>
              <span className="count">{coreLibrary.length} saved</span>
            </div>
            <button
              className="button small"
              type="button"
              disabled={busy || imageBusy}
              onClick={saveCoreMemory}
            >
              Save Core
            </button>
          </div>

          {coreLibrary.length > 0 ? (
            <div className="checkpoint-list">
              {coreLibrary.map((record) => (
                <article className="checkpoint-item" key={record.id}>
                  <div className="checkpoint-heading">
                    <div>
                      <strong>{record.title}</strong>
                      <span>
                        {new Date(record.createdAt).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })}
                      </span>
                    </div>
                    <div className="library-actions">
                      <button
                        className="button small"
                        type="button"
                        onClick={() => bringCoreMemoryIntoStory(record)}
                      >
                        Bring In
                      </button>
                      <button
                        className="button small"
                        type="button"
                        onClick={() => removeCoreMemory(record.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="checkpoint-section">
                    <span>Core Storyline</span>
                    <p>{record.storyline}</p>
                  </div>
                  {record.images.length > 0 ? (
                    <div className="library-image-grid">
                      {record.images.map((image) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={image.title}
                          key={image.id}
                          src={image.imageUrl}
                          title={image.title}
                        />
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <h3>No core memories saved</h3>
              <p>Save a core memory to keep durable story state and images.</p>
            </div>
          )}
        </section>

        <section className="drawer-section" aria-labelledby="additional-options">
          <div className="drawer-section-title">
            <h3 id="additional-options">Additional Options</h3>
          </div>
          <div className="option-row">
            <span>Reset current story</span>
            <button
              className="button danger"
              type="button"
              disabled={busy || imageBusy}
              onClick={resetDraft}
            >
              Reset Story
            </button>
          </div>
        </section>

        <section className="drawer-section" aria-labelledby="character-background">
          <div className="drawer-section-title">
            <h3 id="character-background">Cast</h3>
            <button className="button small" type="button" onClick={addCharacter}>
              Add Blank
            </button>
          </div>

          {presetRoster.length > 0 ? (
            <>
              <p className="roster-label">Tap a portrait to add or remove from the active cast:</p>
              <div className="roster-strip">
                {presetRoster.map((rosterChar) => {
                  const isActive = characters.some((c) => c.id === rosterChar.id);
                  return (
                    <button
                      className={`roster-card ${isActive ? "active" : ""}`}
                      key={rosterChar.id}
                      title={rosterChar.name}
                      type="button"
                      onClick={() => toggleRosterCharacter(rosterChar)}
                    >
                      {rosterChar.portraitUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={rosterChar.name}
                          src={rosterChar.portraitUrl}
                        />
                      ) : (
                        <div className="roster-avatar">
                          {(rosterChar.name || "?").slice(0, 1)}
                        </div>
                      )}
                      <span>{rosterChar.name.split(" ")[0] || "?"}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {characters.length > 0 ? (
            <div className="character-group-list">
              {familyGroups.map((group) => (
                <div className="character-group" key={group.family}>
                  <div className="character-group-heading">
                    <h4>{group.family}</h4>
                    <span>{group.characters.length}</span>
                  </div>
                  <div className="character-summary-list">
                    {group.characters.map((character) => {
                      const index = characters.findIndex((c) => c.id === character.id);
                      const fallbackName = `Character ${index + 1}`;
                      return (
                        <button
                          className={`character-summary compact ${
                            selectedCharacter?.id === character.id ? "selected" : ""
                          }`}
                          key={character.id}
                          type="button"
                          onClick={() => setSelectedCharacterId(character.id)}
                        >
                          {character.portraitUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt={`${character.name || fallbackName} portrait`}
                              src={character.portraitUrl}
                            />
                          ) : (
                            <span>{(character.name || `${index + 1}`).slice(0, 1)}</span>
                          )}
                          <div>
                            <strong>{character.name || fallbackName}</strong>
                            <small>{character.role || "No role set"}</small>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <h3>No active cast</h3>
              <p>Tap a portrait above to add a character to the story.</p>
            </div>
          )}

          <div className="drawer-character-list">
            {selectedCharacter ? (
              <article className="drawer-character" key={selectedCharacter.id}>
                <div className="drawer-character-header">
                  <h4>
                    {selectedCharacter.name ||
                      `Character ${selectedCharacterIndex + 1}`}
                  </h4>
                  {characters.length > 1 ? (
                    <button
                      className="button danger small"
                      type="button"
                      onClick={() => removeCharacter(selectedCharacter.id)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="portrait-row">
                  {selectedCharacter.portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="portrait-preview"
                      src={selectedCharacter.portraitUrl}
                      alt={`${
                        selectedCharacter.name ||
                        `Character ${selectedCharacterIndex + 1}`
                      } portrait`}
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
                          uploadCharacterPortrait(
                            selectedCharacter.id,
                            event.target.files
                          )
                        }
                      />
                    </label>
                    {selectedCharacter.portraitUrl ? (
                      <button
                        className="button small"
                        type="button"
                        onClick={() => removeCharacterPortrait(selectedCharacter.id)}
                      >
                        Remove picture
                      </button>
                    ) : null}
                    <small>
                      {selectedCharacter.portraitName ||
                        "Upload a photo to use as a reference for image generation."}
                    </small>
                  </div>
                </div>
                <Field label="Name">
                  <input
                    value={selectedCharacter.name}
                    onChange={(event) =>
                      updateCharacter(selectedCharacter.id, {
                        name: event.target.value
                      })
                    }
                  />
                </Field>
                <Field label="Family">
                  <input
                    value={selectedCharacter.family || ""}
                    placeholder="e.g. Luvhugetits"
                    onChange={(event) =>
                      updateCharacter(selectedCharacter.id, {
                        family: event.target.value
                      })
                    }
                  />
                </Field>
                <Field label="Role">
                  <input
                    value={selectedCharacter.role}
                    onChange={(event) =>
                      updateCharacter(selectedCharacter.id, {
                        role: event.target.value
                      })
                    }
                  />
                </Field>
                <Field label="Personality">
                  <textarea
                    value={selectedCharacter.personality}
                    onChange={(event) =>
                      updateCharacter(selectedCharacter.id, {
                        personality: event.target.value
                      })
                    }
                  />
                </Field>
                <Field label="Appearance">
                  <textarea
                    value={selectedCharacter.appearance}
                    onChange={(event) =>
                      updateCharacter(selectedCharacter.id, {
                        appearance: event.target.value
                      })
                    }
                  />
                </Field>
                <Field label="Goals">
                  <textarea
                    value={selectedCharacter.goals}
                    onChange={(event) =>
                      updateCharacter(selectedCharacter.id, {
                        goals: event.target.value
                      })
                    }
                  />
                </Field>
                <Field label="Secrets">
                  <textarea
                    value={selectedCharacter.secrets}
                    onChange={(event) =>
                      updateCharacter(selectedCharacter.id, {
                        secrets: event.target.value
                      })
                    }
                  />
                </Field>
              </article>
            ) : (
              <div className="empty-state">
                <h3>No character selected</h3>
                <p>Select a character above to start editing.</p>
              </div>
            )}
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

function MemoryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="memory-group">
      <span>{title}</span>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>No active memory yet.</p>
      )}
    </div>
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
  return `${sourcePrompt}\n\nUse references for: ${names}. Preserve identity while adapting pose, lighting, and setting.`;
}

function resizeImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read image."));
    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("Could not load image."));
      image.onload = () => {
        const maxDimension = 512;
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
        resolve(canvas.toDataURL("image/jpeg", 0.75));
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

function createStoryCheckpoint(
  story: Story,
  characters: Character[],
  scenes: Scene[]
): StoryCheckpoint {
  const latestScene = scenes[0];
  const sceneSummaries = scenes
    .slice(0, 5)
    .map((scene) => scene.summary || scene.title)
    .filter(Boolean)
    .reverse();
  const storyline = compactCheckpointText(
    [story.summary, ...sceneSummaries].filter(Boolean).join(" ")
  );
  const keyCharacters = characters
    .map((character) => {
      const details = [
        character.role,
        character.goals ? `wants ${character.goals}` : "",
        character.personality ? `attitude: ${character.personality}` : ""
      ].filter(Boolean);

      return compactCheckpointText(
        `${character.name || "Unnamed character"}${
          details.length ? ` - ${details.join("; ")}` : ""
        }`,
        260
      );
    })
    .slice(0, 6);
  const attitudeShifts = collectUnique(
    scenes.flatMap((scene) => scene.characterUpdates)
  )
    .slice(0, 8)
    .map((shift) => compactCheckpointText(shift, 220));

  return {
    id: createId("checkpoint"),
    title: latestScene?.title || story.title || "Story checkpoint",
    createdAt: new Date().toISOString(),
    storyline:
      storyline ||
      "The story checkpoint was saved before any major storyline movement.",
    keyCharacters:
      keyCharacters.length > 0
        ? keyCharacters
        : ["No key characters have been defined yet."],
    attitudeShifts:
      attitudeShifts.length > 0
        ? attitudeShifts
        : ["No durable character attitude shifts have been recorded yet."]
  };
}

function formatCheckpointForMemory(checkpoint: StoryCheckpoint) {
  return [
    `Checkpoint: ${checkpoint.storyline}`,
    `Checkpoint key characters: ${checkpoint.keyCharacters.join(" | ")}`,
    `Checkpoint attitude shifts: ${checkpoint.attitudeShifts.join(" | ")}`
  ];
}

function updateLivingMemoryWithCheckpoint(
  memory: LivingMemory,
  checkpoint: StoryCheckpoint
): LivingMemory {
  return normalizeLivingMemory({
    ...memory,
    facts: [
      `Checkpoint "${checkpoint.title}": ${checkpoint.storyline}`,
      ...memory.facts
    ],
    characterStates: [
      ...checkpoint.keyCharacters.map(
        (character) => `Checkpoint character: ${character}`
      ),
      ...checkpoint.attitudeShifts.map((shift) => `Checkpoint shift: ${shift}`),
      ...memory.characterStates
    ],
    updatedAt: new Date().toISOString()
  });
}

function mergeLivingMemory(
  current: LivingMemory,
  imported: LivingMemory,
  checkpoint?: StoryCheckpoint
): LivingMemory {
  const checkpointMemory = checkpoint
    ? updateLivingMemoryWithCheckpoint(defaultLivingMemory, checkpoint)
    : defaultLivingMemory;

  return normalizeLivingMemory({
    facts: [
      ...checkpointMemory.facts,
      ...imported.facts,
      ...current.facts
    ],
    characterStates: [
      ...checkpointMemory.characterStates,
      ...imported.characterStates,
      ...current.characterStates
    ],
    openThreads: [...imported.openThreads, ...current.openThreads],
    toneRules: [...imported.toneRules, ...current.toneRules],
    continuityWarnings: [
      ...imported.continuityWarnings,
      ...current.continuityWarnings
    ],
    updatedAt: new Date().toISOString()
  });
}

async function collectCoreMemoryImages(scenes: Scene[]) {
  const imageScenes = scenes
    .filter((scene) => scene.imageUrl)
    .slice(0, 6);
  const images = await Promise.all(
    imageScenes.map(async (scene) => ({
      id: createId("core-image"),
      title: scene.title || "Saved scene image",
      imageUrl: await preserveImageUrl(scene.imageUrl || ""),
      capturedAt: new Date().toISOString()
    }))
  );

  return images.filter((image) => image.imageUrl);
}

async function preserveImageUrl(imageUrl: string) {
  if (!imageUrl || imageUrl.startsWith("data:")) return imageUrl;

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) return imageUrl;

    const blob = await response.blob();

    if (blob.size > 1_500_000) return imageUrl;

    return await blobToDataUrl(blob);
  } catch {
    return imageUrl;
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not save image."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

function compactCheckpointText(value: string, maxLength = 520) {
  const clean = value.replace(/\s+/g, " ").trim();

  if (clean.length <= maxLength) return clean;

  return `${clean.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function collectUnique(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  values.forEach((value) => {
    const clean = value.trim();
    const key = clean.toLowerCase();

    if (!clean || seen.has(key)) return;

    seen.add(key);
    unique.push(clean);
  });

  return unique;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStoryPreset(value: unknown): StoryPreset {
  const source = isObject(value) ? value : {};
  const id = stringOrDefault(source.id, "story-preset")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const label = stringOrDefault(source.label, "Story Preset");
  const starterCharacters = normalizePresetCharacters(source.starterCharacters);

  return {
    id: id || "story-preset",
    label,
    description: stringOrDefault(source.description, `${label} preset.`),
    story: normalizePresetStory(source.story),
    starterCharacters,
    characterRoster: normalizePresetCharacters(source.characterRoster ?? source.starterCharacters),
    starterPrompt: stringOrDefault(
      source.starterPrompt,
      "Continue the story from the current setup."
    )
  };
}

function normalizePresetStory(value: unknown): Story {
  const source = isObject(value) ? value : {};

  return {
    title: stringOrDefault(source.title, "Untitled story"),
    genre: stringOrDefault(source.genre, "Adult contemporary drama"),
    tone: stringOrDefault(source.tone, "Intimate and character driven"),
    worldRules: stringOrDefault(source.worldRules, "No scenario constraints defined."),
    summary: stringOrDefault(source.summary, "The scenario is just beginning.")
  };
}

function normalizePresetCharacters(value: unknown): Character[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      {
        id: "lead",
        name: "Lead Character",
        family: "",
        role: "Main character",
        personality: "",
        appearance: "",
        goals: "",
        secrets: ""
      }
    ];
  }

  return value
    .filter((character) => isObject(character))
    .map((character, index) => ({
      id: stringOrDefault(character.id, `character-${index + 1}`),
      name: stringOrDefault(character.name, `Character ${index + 1}`),
      family: typeof character.family === "string" ? character.family : "",
      role: stringOrDefault(
        character.role,
        index === 0 ? "Main character" : "Supporting character"
      ),
      personality: stringOrDefault(character.personality, ""),
      appearance: stringOrDefault(character.appearance, ""),
      goals: stringOrDefault(character.goals, ""),
      secrets: stringOrDefault(character.secrets, ""),
      portraitUrl:
        typeof character.portraitUrl === "string" ? character.portraitUrl : "",
      portraitName:
        typeof character.portraitName === "string" ? character.portraitName : ""
    }));
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

function normalizeCharacters(value: unknown): Character[] {
  if (!Array.isArray(value) || value.length === 0) {
    return starterCharacters;
  }

  return value
    .filter((character): character is Partial<Character> & { importance?: string } =>
      Boolean(character && typeof character === "object" && !Array.isArray(character))
    )
    .map((character, index) => ({
      id: character.id || createId("character"),
      name: character.name || `Character ${index + 1}`,
      family: typeof character.family === "string" ? character.family : "",
      role: character.role || (index === 0 ? "Main character" : "Supporting character"),
      personality: character.personality || "",
      appearance: character.appearance || "",
      goals: character.goals || "",
      secrets: character.secrets || "",
      portraitUrl: character.portraitUrl || "",
      portraitName: character.portraitName || ""
    }));
}

function normalizeStoryCheckpoints(value: unknown): StoryCheckpoint[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((checkpoint): checkpoint is Partial<StoryCheckpoint> =>
      Boolean(
        checkpoint &&
          typeof checkpoint === "object" &&
          !Array.isArray(checkpoint)
      )
    )
    .map((checkpoint) => ({
      id: checkpoint.id || createId("checkpoint"),
      title: checkpoint.title || "Story checkpoint",
      createdAt: checkpoint.createdAt || new Date().toISOString(),
      storyline:
        checkpoint.storyline ||
        "The story checkpoint was saved before any major storyline movement.",
      keyCharacters:
        Array.isArray(checkpoint.keyCharacters) &&
        checkpoint.keyCharacters.length > 0
          ? checkpoint.keyCharacters.filter(
              (item): item is string => typeof item === "string" && Boolean(item.trim())
            )
          : ["No key characters have been defined yet."],
      attitudeShifts:
        Array.isArray(checkpoint.attitudeShifts) &&
        checkpoint.attitudeShifts.length > 0
          ? checkpoint.attitudeShifts.filter(
              (item): item is string => typeof item === "string" && Boolean(item.trim())
            )
          : ["No durable character attitude shifts have been recorded yet."]
    }))
    .filter((checkpoint) => checkpoint.storyline.trim())
    .slice(0, 12);
}

function normalizeCoreLibrary(value: unknown): CoreMemoryRecord[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((record): record is Partial<CoreMemoryRecord> =>
      Boolean(record && typeof record === "object" && !Array.isArray(record))
    )
    .map((record) => ({
      id: record.id || createId("core-memory"),
      title: record.title || "Core memory",
      createdAt: record.createdAt || new Date().toISOString(),
      storyline:
        typeof record.storyline === "string" && record.storyline.trim()
          ? compactCheckpointText(record.storyline)
          : "Saved core memory.",
      keyCharacters: cleanCoreTextItems(record.keyCharacters, 6, 260),
      attitudeShifts: cleanCoreTextItems(record.attitudeShifts, 8, 220),
      livingMemory: normalizeLivingMemory(record.livingMemory),
      images: normalizeCoreMemoryImages(record.images)
    }))
    .filter((record) => record.storyline.trim())
    .slice(0, 20);
}

function normalizeCoreMemoryImages(value: unknown): CoreMemoryImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((image): image is Partial<CoreMemoryImage> =>
      Boolean(image && typeof image === "object" && !Array.isArray(image))
    )
    .map((image) => ({
      id: image.id || createId("core-image"),
      title: image.title || "Saved scene image",
      imageUrl: image.imageUrl || "",
      capturedAt: image.capturedAt || new Date().toISOString()
    }))
    .filter((image) => image.imageUrl.trim())
    .slice(0, 6);
}

function cleanCoreTextItems(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];

  return collectUnique(
    value.filter((item): item is string => typeof item === "string")
  )
    .map((item) => compactCheckpointText(item, maxLength))
    .slice(0, maxItems);
}

function normalizeLivingMemory(
  value: unknown,
  fallback: LivingMemory = defaultLivingMemory
): LivingMemory {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<LivingMemory>)
      : fallback;

  return {
    facts: cleanLivingMemoryItems(source.facts),
    characterStates: cleanLivingMemoryItems(source.characterStates),
    openThreads: cleanLivingMemoryItems(source.openThreads),
    toneRules: cleanLivingMemoryItems(source.toneRules),
    continuityWarnings: cleanLivingMemoryItems(source.continuityWarnings),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString()
  };
}

function cleanLivingMemoryItems(value: unknown) {
  if (!Array.isArray(value)) return [];

  return collectUnique(
    value.filter((item): item is string => typeof item === "string")
  )
    .map((item) => compactCheckpointText(item, 180))
    .slice(0, 8);
}

function formatLivingMemoryForPrompt(memory: LivingMemory) {
  return [
    ...memory.facts.map((item) => `Living fact: ${item}`),
    ...memory.characterStates.map((item) => `Living character state: ${item}`),
    ...memory.openThreads.map((item) => `Living open thread: ${item}`),
    ...memory.toneRules.map((item) => `Living tone rule: ${item}`),
    ...memory.continuityWarnings.map(
      (item) => `Living continuity warning: ${item}`
    )
  ];
}

function countLivingMemoryItems(memory: LivingMemory) {
  return (
    memory.facts.length +
    memory.characterStates.length +
    memory.openThreads.length +
    memory.toneRules.length +
    memory.continuityWarnings.length
  );
}

function groupCharactersByFamily(
  characters: Character[]
): Array<{ family: string; characters: Character[] }> {
  const seen = new Map<string, { family: string; characters: Character[] }>();

  characters.forEach((character) => {
    const family = character.family?.trim() || "";
    const key = family.toLowerCase();

    if (!seen.has(key)) {
      seen.set(key, { family: family || "Unassigned", characters: [] });
    }
    seen.get(key)!.characters.push(character);
  });

  return Array.from(seen.values()).sort((a, b) => {
    if (a.family === "Unassigned") return 1;
    if (b.family === "Unassigned") return -1;
    return a.family.localeCompare(b.family);
  });
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
