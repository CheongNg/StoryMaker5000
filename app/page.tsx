"use client";

import { useEffect, useMemo, useState } from "react";

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
};

type Scene = {
  id: string;
  title: string;
  text: string;
  summary: string;
  memoryNotes: string[];
  characterUpdates: string[];
  timelineUpdates: string[];
  imagePrompt: string;
  imageUrl?: string;
  createdAt: string;
};

type StoryResponse = {
  title: string;
  scene: string;
  summary: string;
  memoryNotes: string[];
  characterUpdates: string[];
  timelineUpdates: string[];
  imagePrompt: string;
  error?: string;
};

const defaultStory: Story = {
  title: "The Unwritten Gate",
  genre: "Fantasy mystery",
  tone: "Lyrical, tense, hopeful",
  worldRules:
    "Names have power. Forgotten places can only be found by someone who has lost something important.",
  summary:
    "A young seeker is drawn toward a hidden city that appears only when the old world is about to change."
};

const starterCharacters: Character[] = [
  {
    id: "mira",
    name: "Mira",
    role: "Lead character",
    personality: "Curious, guarded, brave when it matters",
    appearance: "Dark curls, travel-worn coat, silver compass pendant",
    goals: "Find the hidden city and learn why her memories are vanishing",
    secrets: "She once opened the gate as a child but cannot remember it"
  }
];

const storageKey = "storymaker5000-state";

export default function Home() {
  const [story, setStory] = useState<Story>(defaultStory);
  const [characters, setCharacters] = useState<Character[]>(starterCharacters);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [prompt, setPrompt] = useState(
    "Continue with Mira discovering a clue that the hidden city is awake."
  );
  const [busy, setBusy] = useState(false);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      setStory(parsed.story || defaultStory);
      setCharacters(parsed.characters || starterCharacters);
      setScenes(parsed.scenes || []);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ story, characters, scenes })
    );
  }, [story, characters, scenes]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

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

  async function generateScene() {
    if (!prompt.trim()) {
      setError("Add a prompt so the story knows where to go next.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/story/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story,
          characters,
          recentScenes: scenes.slice(0, 4).map((scene) => ({
            title: scene.title,
            text: scene.text,
            summary: scene.summary
          })),
          memories,
          prompt
        })
      });

      const data = (await response.json()) as StoryResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error || "The scene could not be generated.");
      }

      const nextScene: Scene = {
        id: crypto.randomUUID(),
        title: data.title || "Untitled scene",
        text: data.scene || "",
        summary: data.summary || "",
        memoryNotes: data.memoryNotes || [],
        characterUpdates: data.characterUpdates || [],
        timelineUpdates: data.timelineUpdates || [],
        imagePrompt: data.imagePrompt || "",
        createdAt: new Date().toISOString()
      };

      setScenes((current) => [nextScene, ...current]);
      setStory((current) => ({
        ...current,
        summary: data.summary
          ? `${current.summary}\n\nLatest: ${data.summary}`
          : current.summary
      }));
      setPrompt("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function generateImage(scene: Scene) {
    setImageBusyId(scene.id);
    setError("");

    try {
      const response = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: scene.imagePrompt || scene.summary })
      });
      const data = (await response.json()) as { imageUrl?: string; error?: string };

      if (!response.ok || data.error || !data.imageUrl) {
        throw new Error(data.error || "The scene image could not be generated.");
      }

      setScenes((current) =>
        current.map((item) =>
          item.id === scene.id ? { ...item, imageUrl: data.imageUrl } : item
        )
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setImageBusyId(null);
    }
  }

  function addCharacter() {
    setCharacters((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "New character",
        role: "Supporting character",
        personality: "",
        appearance: "",
        goals: "",
        secrets: ""
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

  function resetDemo() {
    setStory(defaultStory);
    setCharacters(starterCharacters);
    setScenes([]);
    setPrompt("Continue with Mira discovering a clue that the hidden city is awake.");
    setError("");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>StoryMaker5000</h1>
          <span className="status-pill">PWA ready</span>
        </div>

        <section className="panel" aria-labelledby="story-setup">
          <h2 id="story-setup">Story Setup</h2>
          <div className="field-group">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              value={story.title}
              onChange={(event) =>
                setStory({ ...story, title: event.target.value })
              }
            />
          </div>
          <div className="field-group">
            <label htmlFor="genre">Genre</label>
            <input
              id="genre"
              value={story.genre}
              onChange={(event) =>
                setStory({ ...story, genre: event.target.value })
              }
            />
          </div>
          <div className="field-group">
            <label htmlFor="tone">Tone</label>
            <input
              id="tone"
              value={story.tone}
              onChange={(event) => setStory({ ...story, tone: event.target.value })}
            />
          </div>
          <div className="field-group">
            <label htmlFor="rules">World rules</label>
            <textarea
              id="rules"
              value={story.worldRules}
              onChange={(event) =>
                setStory({ ...story, worldRules: event.target.value })
              }
            />
          </div>
          <div className="field-group">
            <label htmlFor="summary">Living story summary</label>
            <textarea
              id="summary"
              value={story.summary}
              onChange={(event) =>
                setStory({ ...story, summary: event.target.value })
              }
            />
          </div>
          <div className="button-row">
            <button className="button ghost" type="button" onClick={resetDemo}>
              Reset demo
            </button>
          </div>
        </section>
      </aside>

      <section className="workspace">
        <div className="workspace-header">
          <div className="workspace-title">
            <h2>{story.title || "Untitled story"}</h2>
            <p>
              Create characters, continue scenes, and let the memory notes carry
              the long story forward.
            </p>
          </div>
        </div>

        <div className="grid">
          <div>
            <section className="composer" aria-labelledby="composer-title">
              <div className="section-title">
                <h3 id="composer-title">Continue The Story</h3>
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Write what should happen next..."
              />
              <div className="button-row">
                <button
                  className="button primary"
                  type="button"
                  disabled={busy}
                  onClick={generateScene}
                >
                  {busy ? "Generating..." : "Generate scene"}
                </button>
              </div>
              {error ? <div className="error">{error}</div> : null}
            </section>

            <div className="section-title">
              <h3>Scenes</h3>
              <span className="status-pill">{scenes.length} saved</span>
            </div>

            <div className="scene-list">
              {scenes.length === 0 ? (
                <div className="empty-state">
                  <h3>No scenes yet</h3>
                  <p>
                    Generate the first scene, then come back later and continue
                    from the saved memory.
                  </p>
                </div>
              ) : (
                scenes.map((scene) => (
                  <article className="scene" key={scene.id}>
                    <div className="scene-body">
                      <header>
                        <div>
                          <h3>{scene.title}</h3>
                          <div className="scene-meta">
                            {new Date(scene.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <button
                          className="button"
                          type="button"
                          disabled={imageBusyId === scene.id}
                          onClick={() => generateImage(scene)}
                        >
                          {imageBusyId === scene.id ? "Creating..." : "Scene image"}
                        </button>
                      </header>
                      <p className="scene-text">{scene.text}</p>
                      <div className="tag-row">
                        {scene.memoryNotes.slice(0, 3).map((note) => (
                          <span className="tag" key={note}>
                            {note}
                          </span>
                        ))}
                      </div>
                    </div>
                    {scene.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="scene-image"
                        src={scene.imageUrl}
                        alt={`Generated art for ${scene.title}`}
                      />
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>

          <aside>
            <div className="section-title">
              <h3>Characters</h3>
              <button className="button" type="button" onClick={addCharacter}>
                Add
              </button>
            </div>
            <div className="character-list">
              {characters.map((character) => (
                <article className="character-card" key={character.id}>
                  <header>
                    <h3>{character.name}</h3>
                    <button
                      className="button danger"
                      type="button"
                      onClick={() => removeCharacter(character.id)}
                    >
                      Remove
                    </button>
                  </header>
                  <div className="field-group">
                    <label>Name</label>
                    <input
                      value={character.name}
                      onChange={(event) =>
                        updateCharacter(character.id, { name: event.target.value })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label>Role</label>
                    <input
                      value={character.role}
                      onChange={(event) =>
                        updateCharacter(character.id, { role: event.target.value })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label>Personality</label>
                    <textarea
                      value={character.personality}
                      onChange={(event) =>
                        updateCharacter(character.id, {
                          personality: event.target.value
                        })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label>Appearance</label>
                    <textarea
                      value={character.appearance}
                      onChange={(event) =>
                        updateCharacter(character.id, {
                          appearance: event.target.value
                        })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label>Goals</label>
                    <textarea
                      value={character.goals}
                      onChange={(event) =>
                        updateCharacter(character.id, { goals: event.target.value })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label>Secrets</label>
                    <textarea
                      value={character.secrets}
                      onChange={(event) =>
                        updateCharacter(character.id, {
                          secrets: event.target.value
                        })
                      }
                    />
                  </div>
                </article>
              ))}
            </div>

            <div className="section-title">
              <h3>Memory</h3>
              <span className="status-pill">{memories.length} notes</span>
            </div>
            <div className="memory-list">
              {memories.length === 0 ? (
                <div className="memory-item">Memory will appear after scenes.</div>
              ) : (
                memories.slice(0, 12).map((memory, index) => (
                  <div className="memory-item" key={`${memory}-${index}`}>
                    {memory}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
