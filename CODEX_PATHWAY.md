# StoryMaker5000 Build Pathway

Paste this into Codex when you want the next stage built.

## Goal

Build a phone-friendly PWA that helps me:

- Create and adapt story characters.
- Continue a long story from my prompt.
- Preserve memory across chapters.
- Generate scene images from the story.
- Use free or low-cost AI APIs where possible.

## Current foundation

The first version should include:

- A story setup panel.
- Character cards.
- A prompt box for continuing the story.
- A generated scene feed.
- Long-story memory notes.
- Optional image generation for a scene.
- Local browser storage so work persists before the database exists.

## Next implementation stages

1. Add Supabase authentication.
2. Add Supabase tables for stories, characters, scenes, memories, and generated images.
3. Replace local browser storage with Supabase sync.
4. Add pgvector memory search for long stories.
5. Add better character consistency for images.
6. Add export to Markdown, PDF, and EPUB.
7. Add a mobile install prompt and polished offline support.

## Preferred software

- Next.js
- React
- TypeScript
- Supabase
- Gemini API for story text
- Cloudflare Workers AI for image generation
- Vercel for hosting

## Memory design

Each generated scene should produce:

- Full scene text.
- Scene summary.
- Character updates.
- Timeline updates.
- New memory facts.
- Image prompt.

Before generating the next scene, retrieve:

- Story bible.
- Active characters.
- Recent scenes.
- Relevant older memories.
- User's current prompt.

## Next Codex prompt

Continue building StoryMaker5000. Add Supabase login and database sync for stories, characters, scenes, and memory notes. Keep the mobile-first design and preserve the existing local mock mode as a fallback.
